from fastapi import FastAPI

app = FastAPI(title="LeetMetrics API", version="1.0.0")

@app.get("/")
async def root():
    return {"message": "LeetMetrics API is running"}
