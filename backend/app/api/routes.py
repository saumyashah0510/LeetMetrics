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
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")

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
        message="Sync process has been started in the background.",
        submissions_added=0
    )

@router.get("/sync/status")
async def get_sync_status(username: str, db: AsyncSession = Depends(get_db)):
    """Poll this endpoint to check if a sync has completed for a given user."""
    # Look up user
    user_res = await db.execute(
        text("SELECT id FROM users WHERE username = :u LIMIT 1"),
        {"u": username}
    )
    user_id = user_res.scalar()

    if not user_id:
        return {"status": "not_started", "submissions_count": 0, "message": "User not found"}

    # Latest sync log entry
    log_res = await db.execute(
        text("""
            SELECT status, completed_at, error_message
            FROM sync_logs
            WHERE user_id = :uid
            ORDER BY started_at DESC
            LIMIT 1
        """),
        {"uid": str(user_id)}
    )
    log = log_res.fetchone()

    # Submission count
    count_res = await db.execute(
        text("SELECT COUNT(*) FROM submissions WHERE user_id = :uid"),
        {"uid": str(user_id)}
    )
    submissions_count = count_res.scalar() or 0

    if not log:
        return {"status": "running", "submissions_count": submissions_count, "message": "Sync in progress..."}

    return {
        "status": log.status,           # "success" | "failed" | "running"
        "submissions_count": submissions_count,
        "completed_at": str(log.completed_at) if log.completed_at else None,
        "error_message": log.error_message,
    }
