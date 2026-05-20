import asyncio
import os
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.sql import func
import httpx
from datetime import datetime
import random

from app.models.models import SyncLog, Submission, Problem, User, DSACurriculum, ProblemCurriculumMapping
from app.services.leetcode_client import LeetCodeClient

class SyncEngine:
    def __init__(self, db: AsyncSession, session_cookie: str, username: str):
        self.db = db
        self.username = username
        self.lc_client = LeetCodeClient(session_cookie)
        self.user = None
        self.sync_log = None

    async def _init_user_and_log(self):
        """Fetch or create the user, and start a sync log."""
        result = await self.db.execute(select(User).where(User.username == self.username))
        self.user = result.scalars().first()
        
        if not self.user:
            self.user = User(username=self.username)
            self.db.add(self.user)
            await self.db.commit()
            await self.db.refresh(self.user)
        
        self.sync_log = SyncLog(user_id=self.user.id, status='in_progress')
        self.db.add(self.sync_log)
        await self.db.commit()
        await self.db.refresh(self.sync_log)

    async def _get_or_create_problem(self, title_slug: str):
        """Dynamically fetch and map a missing problem on-the-fly to prevent crashes."""
        result = await self.db.execute(select(Problem).where(Problem.url_name == title_slug))
        problem = result.scalars().first()
        if problem:
            return problem
            
        print(f"Missing problem detected! Fetching '{title_slug}' dynamically...")
        data = await self.lc_client.get_problem_details(title_slug)
        q_data = data.get("data", {}).get("question")
        
        if not q_data:
            raise Exception(f"Failed to fetch metadata for {title_slug} via GraphQL.")
            
        topics_list = [t["name"] for t in q_data.get("topicTags", [])]
        
        problem = Problem(
            url_name=q_data["titleSlug"],
            frontend_id=int(q_data["questionFrontendId"]),
            title=q_data["title"],
            difficulty=q_data["difficulty"],
            ac_rate=q_data.get("acRate"),
            leetcode_topics=topics_list
        )
        self.db.add(problem)
        await self.db.flush() # Flush to get it into the transaction
        
        await self._map_problem_curriculum(problem, topics_list)
        return problem

    async def _map_problem_curriculum(self, problem: Problem, topics: list):
        """Applies the Two-Layer Smart Mapping to categorize the problem."""
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
        try:
            with open(os.path.join(base_dir, "data", "manual_overrides.json"), 'r') as f:
                overrides = json.load(f)
            with open(os.path.join(base_dir, "data", "tag_mapping.json"), 'r') as f:
                tag_mapping = json.load(f)
        except Exception:
            return # Skip if JSONs don't exist yet
            
        pattern_to_assign = None
        is_manual = False
        
        # Layer 2: Explicit Override Check
        if problem.url_name in overrides:
            pattern_to_assign = overrides[problem.url_name]
            is_manual = True
        else:
            # Layer 1: Generic Tag Mapping Fallback
            for t in topics:
                if t in tag_mapping:
                    pattern_to_assign = tag_mapping[t]
                    break 
                    
        if not pattern_to_assign:
            return
            
        result = await self.db.execute(select(DSACurriculum).where(DSACurriculum.sub_pattern == pattern_to_assign))
        curr = result.scalars().first()
        
        if curr:
            mapping = ProblemCurriculumMapping(
                problem_url_name=problem.url_name,
                curriculum_id=curr.id,
                is_manual_override=is_manual
            )
            self.db.add(mapping)

    async def run_sync(self):
        """The core ingestion loop."""
        try:
            await self._init_user_and_log()
            
            offset = 0
            limit = 20
            has_next = True
            submissions_added = 0
            
            stop_timestamp = self.user.last_sync_timestamp or 0
            latest_timestamp_fetched = stop_timestamp
            
            while has_next:
                data = await self.lc_client.get_submissions(offset, limit)
                submissions = data.get("submissions_dump", [])
                
                if not submissions:
                    break
                    
                for sub in submissions:
                    sub_timestamp = int(sub.get("timestamp", 0))
                    
                    if sub_timestamp <= stop_timestamp:
                        has_next = False
                        break
                        
                    latest_timestamp_fetched = max(latest_timestamp_fetched, sub_timestamp)
                    
                    if sub.get("status_display") != "Accepted":
                        continue
                        
                    title_slug = sub.get("title_slug")
                    if not title_slug:
                        continue
                        
                    # BULLETPROOF: Dynamically ensure the problem exists!
                    try:
                        await self._get_or_create_problem(title_slug)
                    except Exception as e:
                        print(f"Skipping submission for {title_slug}: {e}")
                        continue
                    
                    # Safely insert the submission (using merge to act as an UPSERT just in case)
                    import re
                    # Safe parsing of runtime/memory which come back as strings like "45 ms"
                    runtime_str = str(sub.get("runtime", "0"))
                    runtime_val = int(re.sub(r'[^0-9]', '', runtime_str)) if re.sub(r'[^0-9]', '', runtime_str) else 0
                    
                    memory_str = str(sub.get("memory", "0"))
                    memory_val = int(re.sub(r'[^0-9]', '', memory_str)) if re.sub(r'[^0-9]', '', memory_str) else 0

                    submission = Submission(
                        id=int(sub.get("id")),
                        user_id=self.user.id,
                        problem_url_name=title_slug,
                        timestamp=datetime.fromtimestamp(sub_timestamp),
                        runtime=runtime_val,
                        memory=memory_val,
                        language=sub.get("lang"),
                        code=sub.get("code")
                    )
                    await self.db.merge(submission)
                    submissions_added += 1
                
                if has_next:
                    offset += limit
                    await asyncio.sleep(random.uniform(2.5, 5.0)) 
                    
            self.sync_log.status = 'success'
            self.sync_log.completed_at = func.now()
            
            self.user.last_sync_timestamp = latest_timestamp_fetched
            self.user.last_synced_at = func.now()
            
            await self.db.commit()
            return submissions_added
            
        except Exception as e:
            if self.sync_log:
                self.sync_log.status = 'failed'
                self.sync_log.error_message = str(e)
                self.sync_log.completed_at = func.now()
                await self.db.commit()
            raise e
        finally:
            await self.lc_client.close()
