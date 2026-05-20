from fastapi import FastAPI
from app.api.routes import router

app = FastAPI(title="LeetMetrics API", version="1.0.0")

# Include the API routers
app.include_router(router, prefix="/api")

from app.api.analytics_routes import router as analytics_router
app.include_router(analytics_router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "LeetMetrics API is running"}
