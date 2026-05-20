import asyncio
import os
import json
import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from app.core.database import AsyncSessionLocal
from app.models.models import Problem, DSACurriculum, ProblemCurriculumMapping

async def fetch_all_problems():
    url = "https://leetcode.com/graphql"
    query = """
    query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
      problemsetQuestionList: questionList(
        categorySlug: $categorySlug
        limit: $limit
        skip: $skip
        filters: $filters
      ) {
        total: totalNum
        questions: data {
          acRate
          difficulty
          frontendQuestionId: questionFrontendId
          title
          titleSlug
          topicTags {
            name
          }
        }
      }
    }
    """
    
    limit = 100
    skip = 0
    total = 100 
    problems = []
    
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0"
    }
    
    async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
        while skip < total:
            print(f"Fetching problems {skip} to {skip+limit}...", flush=True)
            response = await client.post(url, json={
                "query": query,
                "variables": {"categorySlug": "", "limit": limit, "skip": skip, "filters": {}}
            })
            response.raise_for_status()
            data = response.json()
            
            pl = data.get("data", {}).get("problemsetQuestionList", {})
            if not pl:
                break
                
            total = pl.get("total", 0)
            questions = pl.get("questions", [])
            
            if not questions:
                break
                
            problems.extend(questions)
            skip += limit
            await asyncio.sleep(0.5) 
            
    return problems

async def run_pipeline():
    print("Starting Bulk Problem Ingestion Pipeline...", flush=True)
    problems_data = await fetch_all_problems()
    print(f"Fetched {len(problems_data)} problems from LeetCode.", flush=True)
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(base_dir, "data", "manual_overrides.json"), 'r') as f:
        overrides = json.load(f)
    with open(os.path.join(base_dir, "data", "tag_mapping.json"), 'r') as f:
        tag_mapping = json.load(f)
        
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(DSACurriculum))
        curriculums = result.scalars().all()
        curr_map = {c.sub_pattern: c.id for c in curriculums}
        
        # Clear old mappings to recreate them fresh
        print("Clearing old mappings...", flush=True)
        from sqlalchemy import text
        await db.execute(text("TRUNCATE TABLE problem_curriculum_mapping CASCADE;"))
        await db.commit()
        
        problems_to_insert = []
        for q in problems_data:
            problems_to_insert.append({
                "url_name": q["titleSlug"],
                "frontend_id": int(q["frontendQuestionId"]),
                "title": q["title"],
                "difficulty": q["difficulty"],
                "ac_rate": q.get("acRate"),
                "leetcode_topics": [t["name"] for t in q.get("topicTags", [])]
            })
            
        print("Bulk inserting problems...", flush=True)
        if problems_to_insert:
            stmt = insert(Problem).values(problems_to_insert)
            stmt = stmt.on_conflict_do_update(
                index_elements=['url_name'],
                set_={
                    'ac_rate': stmt.excluded.ac_rate,
                    'difficulty': stmt.excluded.difficulty
                }
            )
            await db.execute(stmt)
            
        mappings_to_insert = []
        for q in problems_data:
            title_slug = q["titleSlug"]
            topics = [t["name"] for t in q.get("topicTags", [])]
            
            patterns_to_assign = []
            is_manual = False
            
            if title_slug in overrides:
                val = overrides[title_slug]
                if isinstance(val, list):
                    patterns_to_assign.extend(val)
                elif isinstance(val, str):
                    patterns_to_assign.append(val)
                is_manual = True
            else:
                for t in topics:
                    if t in tag_mapping:
                        patterns_to_assign.append(tag_mapping[t])
                        
            for pattern in set(patterns_to_assign):
                if pattern in curr_map:
                    mappings_to_insert.append({
                        "problem_url_name": title_slug,
                        "curriculum_id": curr_map[pattern],
                        "is_manual_override": is_manual
                    })
                    
        print("Bulk inserting mappings...", flush=True)
        if mappings_to_insert:
            stmt2 = insert(ProblemCurriculumMapping).values(mappings_to_insert)
            stmt2 = stmt2.on_conflict_do_nothing(
                index_elements=['problem_url_name', 'curriculum_id']
            )
            await db.execute(stmt2)
            
        await db.commit()
        print(f"Success! Upserted {len(problems_to_insert)} problems and mapped {len(mappings_to_insert)} patterns.", flush=True)

if __name__ == "__main__":
    asyncio.run(run_pipeline())
