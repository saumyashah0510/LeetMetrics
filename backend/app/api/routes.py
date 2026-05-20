from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import httpx

from app.core.database import get_db
from app.schemas.sync import SyncRequest, SyncResponse
from app.services.leetcode_client import LeetCodeClient
from app.services.sync_engine import SyncEngine

router = APIRouter()

@router.post("/health")
async def check_health(request: SyncRequest, db: AsyncSession = Depends(get_db)):
    """Check if the provided cookie is valid and the DB connection works."""
    # 1. DB Check
    try:
        # A simple query to ensure the DB connection is alive
        await db.execute(text("SELECT 1"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")

    # 2. LeetCode Cookie Check
    lc_client = LeetCodeClient(request.session_cookie)
    try:
        data = await lc_client.check_health()
        user_status = data.get("data", {}).get("userStatus", {})
        
        if not user_status.get("isSignedIn"):
            raise HTTPException(status_code=401, detail="LeetCode session cookie is invalid or expired.")
        
        username = user_status.get("username")
        if username != request.username:
             raise HTTPException(status_code=400, detail=f"Cookie belongs to {username}, not {request.username}")
             
        return {"status": "ok", "message": f"Successfully authenticated as {username}. Database is connected!"}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Error contacting LeetCode: {str(e)}")
    finally:
        await lc_client.close()

@router.post("/sync", response_model=SyncResponse)
async def trigger_sync(request: SyncRequest, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """Triggers the background sync process."""
    
    async def _run_background_sync(cookie: str, user: str):
        # We need a new isolated DB session for the background task to prevent session closure errors
        from app.core.database import AsyncSessionLocal
        async with AsyncSessionLocal() as bg_db:
            engine = SyncEngine(bg_db, cookie, user)
            try:
                await engine.run_sync()
            except Exception as e:
                print(f"Background sync failed: {e}")

    background_tasks.add_task(_run_background_sync, request.session_cookie, request.username)
    
    return SyncResponse(
        status="started",
        message="Sync process has been started in the background. Check logs for completion status.",
        submissions_added=0
    )
