from fastapi import FastAPI
from app.api.routes import router

app = FastAPI(title="LeetMetrics API", version="1.0.0")

# Include the API router
app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "LeetMetrics API is running"}
