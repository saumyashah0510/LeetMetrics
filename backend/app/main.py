from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.api.analytics_routes import router as analytics_router
from app.core.redis import get_redis_client
import logging

logger = logging.getLogger("app.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Redis connection if configured
    redis = get_redis_client()
    if redis:
        logger.info("Redis connection pool initialized.")
    else:
        logger.warning("Redis is not configured. Rate limiting will run in fail-safe open mode.")
        
    yield
    
    # Shutdown: Close Redis
    from app.core.redis import redis_client
    if redis_client:
        await redis_client.aclose()
        logger.info("Async Redis client closed.")

app = FastAPI(title="LeetMetrics API", version="1.0.0", lifespan=lifespan)


# ── CORS — allow the Vite dev server to call the API ──────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for production deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────
app.include_router(router, prefix="/api")
app.include_router(analytics_router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "LeetMetrics API is running"}
