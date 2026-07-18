import redis.asyncio as aioredis
from app.core.config import settings
from fastapi import Request, HTTPException
import logging
import json
import time
import uuid

logger = logging.getLogger("app.redis")

redis_client = None

def get_redis_client() -> aioredis.Redis:
    """Retrieve or create the global async Redis client."""
    global redis_client
    if redis_client is None:
        redis_url = settings.REDIS_URL.strip("'\" ") if settings.REDIS_URL else None
        if not redis_url:
            logger.warning("REDIS_URL is not set. Bypassing Redis initialization.")
            return None
        
        try:
            redis_client = aioredis.from_url(redis_url, encoding="utf-8", decode_responses=True)
            logger.info("Async Redis client successfully initialized.")
        except Exception as e:
            logger.error(f"Failed to initialize Redis client from URL: {e}")
            redis_client = None
            
    return redis_client


class RateLimiter:
    def __init__(self, times: int = 5, minutes: int = 1):
        self.times = times
        self.seconds = minutes * 60

    async def __call__(self, request: Request):
        redis = get_redis_client()
        if not redis:
            # Redis is not configured, bypass rate limiting
            return

        # Default identifier is client IP
        ip = request.client.host
        identifier = ip

        # Try to parse the request body to get the username if available
        try:
            body_bytes = await request.body()
            # Rewind the body stream so down-stream route parameters/Pydantic validation can read it
            async def receive():
                return {"type": "http.request", "body": body_bytes, "more_body": False}
            request._receive = receive

            if body_bytes:
                body = json.loads(body_bytes)
                if "username" in body and body["username"]:
                    identifier = f"sync:{body['username']}"
        except Exception as e:
            logger.debug(f"RateLimiter body parsing skipped/failed: {e}")

        key = f"rate_limit:{identifier}"
        now = time.time()
        clear_before = now - self.seconds

        try:
            # 1. Clean old requests and get the current active request count
            async with redis.pipeline(transaction=True) as pipe:
                await pipe.zremrangebyscore(key, "-inf", clear_before)
                await pipe.zcard(key)
                results = await pipe.execute()
            
            current_count = results[1]

            if current_count >= self.times:
                logger.warning(f"Rate limit hit for key: {key}")
                raise HTTPException(
                    status_code=429, 
                    detail="Rate limit exceeded. Maximum 5 sync requests per minute allowed."
                )

            # 2. Add current request as a unique member in the ZSET
            member = f"{now}-{uuid.uuid4()}"
            async with redis.pipeline(transaction=True) as pipe:
                await pipe.zadd(key, {member: now})
                await pipe.expire(key, int(self.seconds))
                await pipe.execute()
                
        except HTTPException:
            raise
        except Exception as e:
            # Fail-open: if Redis connection fails, allow requests through
            logger.error(f"Redis RateLimiter error (failing open): {e}")
            return

