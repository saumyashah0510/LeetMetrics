import uvicorn

if __name__ == "__main__":
    # Runs the FastAPI application with auto-reload enabled for development
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
