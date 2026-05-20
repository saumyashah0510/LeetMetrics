import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.sql import func
import httpx
from datetime import datetime
import random

from app.models.models import SyncLog, Submission, Problem, User
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

    async def run_sync(self):
        """The core ingestion loop."""
        try:
            await self._init_user_and_log()
            
            offset = 0
            limit = 20
            has_next = True
            submissions_added = 0
            
            # The anchor point so we don't fetch duplicates
            stop_timestamp = self.user.last_sync_timestamp or 0
            latest_timestamp_fetched = stop_timestamp
            
            while has_next:
                data = await self.lc_client.get_submissions(offset, limit)
                
                # The REST API returns a 'submissions_dump' list
                submissions = data.get("submissions_dump", [])
                
                if not submissions:
                    break # No more submissions
                    
                for sub in submissions:
                    sub_timestamp = int(sub.get("timestamp", 0))
                    
                    if sub_timestamp <= stop_timestamp:
                        has_next = False
                        break # We have reached older submissions we already have
                        
                    latest_timestamp_fetched = max(latest_timestamp_fetched, sub_timestamp)
                    
                    # We ONLY care about actual mastery (Accepted)
                    if sub.get("status_display") != "Accepted":
                        continue
                        
                    # NOTE: Before inserting the submission, we must ensure the Problem exists in the DB.
                    # In Phase 2, we will download the master problem dictionary.
                    # For now, we simulate the submission addition.
                    
                    submissions_added += 1
                
                if has_next:
                    offset += limit
                    # CRITICAL: Cloudflare will block us if we ping exactly every 1.5s
                    # We add "jitter" (a random delay between 2.5 and 5.0 seconds) to look human
                    jitter_delay = random.uniform(2.5, 5.0)
                    await asyncio.sleep(jitter_delay) 
                    
            # Sync completed successfully
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
