import asyncio
import csv
import sys
import os
import httpx
import json
from sqlalchemy import text
from sqlalchemy.future import select

# Add backend directory to path so we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine, AsyncSessionLocal
from app.models.models import Problem, ProblemCurriculumMapping, DSACurriculum, CompanyQuestion

TIMEFRAMES = ["thirty-days", "three-months", "six-months"]
TIMEFRAME_MAP = {
    "thirty-days": "30-days",
    "three-months": "3-months",
    "six-months": "6-months"
}

GITHUB_RAW_BASE = "https://raw.githubusercontent.com/snehasishroy/leetcode-companywise-interview-questions/master"

headers = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

# Load mappings and overrides once
base_dir = os.path.dirname(os.path.abspath(__file__))
try:
    with open(os.path.join(base_dir, "data", "manual_overrides.json"), 'r') as f:
        overrides = json.load(f)
    with open(os.path.join(base_dir, "data", "tag_mapping.json"), 'r') as f:
        tag_mapping = json.load(f)
except Exception as e:
    print(f"Warning: Failed to load mappings/overrides: {e}")
    overrides = {}
    tag_mapping = {}

def extract_slug(url: str) -> str:
    return url.rstrip("/").split("/")[-1]

async def map_problem_curriculum(db, problem_url_name, topics):
    patterns_to_assign = []
    is_manual = False

    if problem_url_name in overrides:
        val = overrides[problem_url_name]
        if isinstance(val, list):
            patterns_to_assign.extend(val)
        elif isinstance(val, str):
            patterns_to_assign.append(val)
        is_manual = True
    else:
        for t in topics:
            if t in tag_mapping:
                if t == "Array":
                    continue
                patterns_to_assign.append(tag_mapping[t])
                
        if not patterns_to_assign and "Array" in topics:
            patterns_to_assign.append("Array Fundamentals")

    if not patterns_to_assign:
        patterns_to_assign.append("Array Fundamentals")

    for pattern in set(patterns_to_assign):
        result = await db.execute(select(DSACurriculum).where(DSACurriculum.sub_pattern == pattern))
        curr = result.scalars().first()
        
        if curr:
            mapping = ProblemCurriculumMapping(
                problem_url_name=problem_url_name,
                curriculum_id=curr.id,
                is_manual_override=is_manual
            )
            await db.merge(mapping)

async def get_all_companies(client):
    try:
        resp = await client.get("https://api.github.com/repos/snehasishroy/leetcode-companywise-interview-questions/contents")
        if resp.status_code == 200:
            items = resp.json()
            dirs = [item["name"] for item in items if item["type"] == "dir" and not item["name"].startswith(".")]
            if dirs:
                return dirs
    except Exception as e:
        print(f"Warning: Failed to fetch directory list from GitHub API: {e}")
    
    # Solid fallback list if GitHub API rate-limits us
    return [
        "google", "meta", "amazon", "microsoft", "apple", "netflix", "uber", "bloomberg",
        "airbnb", "adobe", "bytedance", "coinbase", "databricks", "doordash", "dropbox",
        "ebay", "expedia", "flipkart", "goldman-sachs", "grab", "linkedin", "lyft",
        "oracle", "paypal", "pinterest", "salesforce", "snapchat", "spotify", "stripe",
        "twitter", "walmart-labs", "yahoo", "yandex", "zoom"
    ]

async def download_company_timeframe(client, company, timeframe, semaphore):
    async with semaphore:
        csv_url = f"{GITHUB_RAW_BASE}/{company}/{timeframe}.csv"
        try:
            resp = await client.get(csv_url)
            if resp.status_code == 404:
                return company, timeframe, None
            resp.raise_for_status()
            return company, timeframe, resp.text
        except Exception as e:
            return company, timeframe, None

async def seed():
    async with AsyncSessionLocal() as db:
        print("==================================================")
        print("  LeetMetrics — Bulk Seeding All GitHub Companies")
        print("==================================================")

        # 1. Pre-fetch existing data for O(1) checks
        print("[+] Pre-fetching existing problems from database...")
        prob_res = await db.execute(select(Problem.url_name))
        existing_problems = set(prob_res.scalars().all())
        print(f"  [+] Loaded {len(existing_problems)} existing problems.")

        print("[+] Pre-fetching existing company questions from database...")
        cq_res = await db.execute(select(CompanyQuestion))
        cqs_by_key = {}
        for cq in cq_res.scalars().all():
            cqs_by_key[(cq.company_name.lower(), cq.timeframe, cq.problem_url_name)] = cq
        print(f"  [+] Loaded {len(cqs_by_key)} existing company questions.")

    # 2. Fetch all company directories from GitHub contents
    async with httpx.AsyncClient(headers=headers, timeout=20.0) as client:
        companies = await get_all_companies(client)
        print(f"\n[+] Total companies to sync: {len(companies)}")

        # Sync concurrently with a Semaphore of 50 concurrent HTTP connections
        semaphore = asyncio.Semaphore(50)
        
        tasks = []
        for company in companies:
            for timeframe in TIMEFRAMES:
                tasks.append(
                    download_company_timeframe(client, company, timeframe, semaphore)
                )
        
        print(f"[+] Downloading {len(tasks)} CSV files concurrently...")
        downloaded = await asyncio.gather(*tasks)
        
        # 3. Sequential database insertions
        print("[+] Processing and writing to database...")
        async with AsyncSessionLocal() as db:
            total_added = 0
            synced_companies = set()
            
            for company, timeframe, csv_text in downloaded:
                if not csv_text:
                    continue
                    
                lines = csv_text.splitlines()
                reader = csv.DictReader(lines)
                db_timeframe = TIMEFRAME_MAP[timeframe]
                
                batch_added = 0
                for row in reader:
                    url = row.get("URL")
                    if not url:
                        continue
                    slug = extract_slug(url)
                    frontend_id_str = row.get("ID", "")
                    frontend_id = int(frontend_id_str) if frontend_id_str.isdigit() else 0
                    title = row.get("Title", "").strip()
                    difficulty = row.get("Difficulty", "").strip()
                    
                    ac_rate_str = row.get("Acceptance %", "0%").replace("%", "").strip()
                    ac_rate = float(ac_rate_str) if ac_rate_str else 0.0
                    
                    freq_str = row.get("Frequency %", "0%").replace("%", "").strip()
                    freq_score = float(freq_str) if freq_str else 0.0

                    if freq_score >= 50.0:
                        importance = "Most Frequent"
                    elif freq_score >= 30.0:
                        importance = "Important"
                    else:
                        importance = "Regular"

                    # 1. Insert problem if missing
                    if slug not in existing_problems:
                        problem = Problem(
                            url_name=slug,
                            frontend_id=frontend_id,
                            title=title,
                            difficulty=difficulty if difficulty in ["Easy", "Medium", "Hard"] else "Medium",
                            ac_rate=ac_rate,
                            leetcode_topics=[]
                        )
                        db.add(problem)
                        await db.flush()
                        await map_problem_curriculum(db, slug, [])
                        existing_problems.add(slug)
                        
                    # 2. Insert/Upsert company_question
                    cq_key = (company.lower(), db_timeframe, slug)
                    cq = cqs_by_key.get(cq_key)
                    if not cq:
                        cq = CompanyQuestion(
                            company_name=company,
                            timeframe=db_timeframe,
                            problem_url_name=slug,
                            frequency_score=freq_score,
                            importance_level=importance
                        )
                        db.add(cq)
                        cqs_by_key[cq_key] = cq
                    else:
                        cq.frequency_score = freq_score
                        cq.importance_level = importance
                        
                    batch_added += 1
                    total_added += 1
                
                if batch_added > 0:
                    synced_companies.add(company)
                    await db.commit()
            
            print(f"\n[+] Sync complete! Mapped {total_added} questions across {len(synced_companies)} companies.")

if __name__ == "__main__":
    asyncio.run(seed())
