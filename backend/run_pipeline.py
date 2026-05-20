import asyncio
import os
import json
import httpx
from sqlalchemy import select
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
    total = 100 # initial placeholder
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
        # Pre-fetch curriculums
        result = await db.execute(select(DSACurriculum))
        curriculums = result.scalars().all()
        curr_map = {c.sub_pattern: c.id for c in curriculums}
        
        inserted_count = 0
        mapped_count = 0
        
        for q in problems_data:
            title_slug = q["titleSlug"]
            
            # Use merge to upsert the problem
            topics = [t["name"] for t in q.get("topicTags", [])]
            prob = Problem(
                url_name=title_slug,
                frontend_id=int(q["frontendQuestionId"]),
                title=q["title"],
                difficulty=q["difficulty"],
                ac_rate=q.get("acRate"),
                leetcode_topics=topics
            )
            await db.merge(prob)
            inserted_count += 1
            
            # Mapping Logic
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
                        break
                        
            for pattern in set(patterns_to_assign):
                if pattern in curr_map:
                    mapping = ProblemCurriculumMapping(
                        problem_url_name=title_slug,
                        curriculum_id=curr_map[pattern],
                        is_manual_override=is_manual
                    )
                    await db.merge(mapping)
                    mapped_count += 1
                    
        await db.commit()
        print(f"Success! Upserted {inserted_count} problems and mapped {mapped_count} patterns.")

if __name__ == "__main__":
    asyncio.run(run_pipeline())
