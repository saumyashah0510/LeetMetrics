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
        """Fetch or create the user with row locking, update session cookie, and start a sync log."""
        # Check if user exists. If not, create them.
        result = await self.db.execute(select(User).where(User.username == self.username))
        self.user = result.scalars().first()
        
        if not self.user:
            self.user = User(username=self.username, session_cookie=self.lc_client.session_cookie)
            self.db.add(self.user)
            await self.db.commit()
            await self.db.refresh(self.user)
        
        # Acquire row-level lock on User to prevent concurrent sync races
        result = await self.db.execute(
            select(User).where(User.username == self.username).with_for_update()
        )
        self.user = result.scalars().first()
        
        # Update session cookie on the locked user row
        self.user.session_cookie = self.lc_client.session_cookie
        
        # Check for any active "in_progress" sync log started in the last 15 minutes
        active_log_query = select(SyncLog).where(
            SyncLog.user_id == self.user.id,
            SyncLog.status == 'in_progress'
        ).order_by(SyncLog.started_at.desc())
        
        log_res = await self.db.execute(active_log_query)
        active_log = log_res.scalars().first()
        
        if active_log:
            from datetime import timezone
            import datetime
            started_at = active_log.started_at
            now = datetime.datetime.now(timezone.utc) if started_at.tzinfo else datetime.datetime.now()
            if (now - started_at).total_seconds() < 15 * 60:
                raise ValueError("A sync is already in progress for this user.")
        
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
            
        patterns_to_assign = []
        is_manual = False
        
        # Layer 2: Explicit Override Check
        if problem.url_name in overrides:
            val = overrides[problem.url_name]
            if isinstance(val, list):
                patterns_to_assign.extend(val)
            elif isinstance(val, str):
                patterns_to_assign.append(val)
            is_manual = True
        else:
            # Layer 1: Generic Tag Mapping Fallback
            for t in topics:
                if t in tag_mapping:
                    if t == "Array":
                        continue
                    patterns_to_assign.append(tag_mapping[t])
                    
            if not patterns_to_assign and "Array" in topics:
                patterns_to_assign.append("Array Fundamentals")
                    
        if not patterns_to_assign:
            return
            
        for pattern in set(patterns_to_assign):
            result = await self.db.execute(select(DSACurriculum).where(DSACurriculum.sub_pattern == pattern))
            curr = result.scalars().first()
            
            if curr:
                mapping = ProblemCurriculumMapping(
                    problem_url_name=problem.url_name,
                    curriculum_id=curr.id,
                    is_manual_override=is_manual
                )
                # Use merge to avoid duplicates if mapping already exists
                await self.db.merge(mapping)

    async def run_sync(self):
        """The core ingestion loop."""
        try:
            await self._init_user_and_log()
            
            offset = 0
            limit = 20
            has_next = True
            last_key = ""
            submissions_added = 0
            oldest_skipped_timestamp = None
            
            stop_timestamp = self.user.last_sync_timestamp or 0
            latest_timestamp_fetched = stop_timestamp
            
            print(f"Starting sync. stop_timestamp={stop_timestamp}")
            
            while has_next:
                print(f"Fetching offset={offset}, last_key={last_key}...")
                data = await self.lc_client.get_submissions(offset, limit, last_key)
                submissions = data.get("submissions_dump", [])
                
                if not submissions:
                    break
                    
                for sub in submissions:
                    sub_timestamp = int(sub.get("timestamp", 0))
                    
                    # Stop if we hit a submission we've already synced
                    if stop_timestamp > 0 and sub_timestamp <= stop_timestamp:
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
                        if oldest_skipped_timestamp is None or sub_timestamp < oldest_skipped_timestamp:
                            oldest_skipped_timestamp = sub_timestamp
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
                        language=sub.get("lang")
                        # code=sub.get("code")  # Removed to save database space
                    )
                    await self.db.merge(submission)
                    submissions_added += 1
                
                # Commit after every page so the frontend can see the count increase in real-time
                await self.db.commit()
                
                if has_next:
                    api_has_next = data.get("has_next", True)
                    last_key = data.get("last_key", "")
                    
                    if not api_has_next:
                        print("API returned has_next=False. Stopping pagination.")
                        has_next = False
                    else:
                        offset += limit
                        await asyncio.sleep(random.uniform(2.5, 5.0))
                    
            if oldest_skipped_timestamp is not None:
                # If there were any ingestion failures, only advance the sync pointer
                # up to the second before the oldest failed submission to retry it next time.
                self.user.last_sync_timestamp = oldest_skipped_timestamp - 1
            else:
                self.user.last_sync_timestamp = latest_timestamp_fetched
            self.user.last_synced_at = func.now()
            
            # Commit the submissions and user update BEFORE contests
            await self.db.commit()
            
            # --- CONTEST SYNC ---
            try:
                print(f"Fetching contest history for {self.username}...")
                contest_data = await self.lc_client.get_contest_history(self.username)
                
                ranking_info = contest_data.get("data", {}).get("userContestRanking", {})
                if ranking_info:
                    self.user.rating = ranking_info.get("rating")
                    self.user.ranking = ranking_info.get("globalRanking")
                
                history = contest_data.get("data", {}).get("userContestRankingHistory", [])
                if history:
                    from app.models.models import Contest, ContestHistory
                    for h in history:
                        if not h.get("attended"):
                            continue
                            
                        contest_info = h.get("contest", {})
                        title = contest_info.get("title")
                        start_time_ts = contest_info.get("startTime")
                        if not title or not start_time_ts:
                            continue
                            
                        # 1. Upsert Contest
                        res = await self.db.execute(select(Contest).where(Contest.title == title))
                        contest = res.scalars().first()
                        if not contest:
                            contest = Contest(
                                title=title,
                                start_time=datetime.fromtimestamp(start_time_ts)
                            )
                            self.db.add(contest)
                            await self.db.flush()
                            
                        # 2. Upsert ContestHistory
                        res = await self.db.execute(
                            select(ContestHistory)
                            .where(ContestHistory.user_id == self.user.id)
                            .where(ContestHistory.contest_id == contest.id)
                        )
                        ch = res.scalars().first()
                        if not ch:
                            ch = ContestHistory(
                                user_id=self.user.id,
                                contest_id=contest.id,
                                rating=h.get("rating"),
                                ranking=0,
                                problems_solved=h.get("problemsSolved"),
                                finish_time_seconds=h.get("finishTimeInSeconds")
                            )
                            self.db.add(ch)
                        else:
                            ch.rating = h.get("rating")
                            ch.problems_solved = h.get("problemsSolved")
                            ch.finish_time_seconds = h.get("finishTimeInSeconds")
            except Exception as e:
                print(f"Failed to fetch contest history: {e}")
                await self.db.rollback() # Rollback the contest transaction to prevent dirty session
                
            await self.db.commit()
            
            try:
                from app.services.analytics_engine import AnalyticsEngine
                print(f"Triggering analytics computation for user {self.user.id}...")
                await AnalyticsEngine.compute_mastery_for_user(str(self.user.id))
            except Exception as e:
                print(f"Warning: Analytics engine computation failed: {e}")
                
            # Finally, mark the sync as fully complete
            self.sync_log.status = 'success'
            self.sync_log.completed_at = func.now()
            await self.db.commit()
            
            # Invalidate Redis cache
            try:
                from app.core.redis import get_redis_client
                redis = get_redis_client()
                if redis:
                    dashboard_key = f"dashboard:{self.username}"
                    curriculum_key = f"curriculum:{self.username}"
                    await redis.delete(dashboard_key, curriculum_key)
                    # Dynamically clear all company question caches for this user
                    async for key in redis.scan_iter(match=f"company_questions:{self.username}:*"):
                        await redis.delete(key)
                    print(f"Invalidated cache for user: {self.username}")
            except Exception as cache_err:
                print(f"Warning: Failed to invalidate cache on success: {cache_err}")
                
            return submissions_added
            
        except Exception as e:
            await self.db.rollback() # VERY IMPORTANT to rollback failed transactions
            if self.sync_log:
                self.sync_log.status = 'failed'
                self.sync_log.error_message = str(e)
                self.sync_log.completed_at = func.now()
                self.db.add(self.sync_log)
                await self.db.commit()
            raise e
        finally:
            await self.lc_client.close()
