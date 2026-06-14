import asyncio
import json
from httpx import AsyncClient

from sqlalchemy import text
from app.core.database import engine
from app.services.analytics_engine import AnalyticsEngine
from app.main import app

async def run_tests():
    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT id, username FROM users LIMIT 1"))
        row = result.fetchone()
        if not row:
            print("No users found in database. Please run sync first.")
            return
        user_id, username = row.id, row.username
        
    print(f"--- 1. Computing Mastery for {username} ---")
    await AnalyticsEngine.compute_mastery_for_user(str(user_id))
    
    print(f"\n--- 2. Testing API Endpoints for {username} ---")
    
    # We must use ASGITransport for modern httpx versions
    from httpx import ASGITransport
    transport = ASGITransport(app=app)
    
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        print("\n[GET /api/dashboard]")
        resp = await ac.get(f"/api/dashboard?username={username}")
        if resp.status_code == 200:
            print(json.dumps(resp.json(), indent=2))
        else:
            print(f"Error {resp.status_code}: {resp.text}")
        
        print("\n[GET /api/study-plan]")
        resp = await ac.get(f"/api/study-plan?username={username}")
        if resp.status_code == 200:
            print(json.dumps(resp.json(), indent=2))
        else:
            print(f"Error {resp.status_code}: {resp.text}")

        print("\n[GET /api/mastery]")
        resp = await ac.get(f"/api/mastery?username={username}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"\nReturned {len(data)} pattern mastery scores.")
            if len(data) > 0:
                print("Sample Data:", json.dumps(data[0], indent=2))
        else:
            print(f"Error {resp.status_code}: {resp.text}")
            
        print("\n[GET /api/contests/summary]")
        resp = await ac.get(f"/api/contests/summary?username={username}")
        if resp.status_code == 200:
            print(json.dumps(resp.json(), indent=2))
        else:
            print(f"Error {resp.status_code}: {resp.text}")

        print("\n[GET /api/companies]")
        resp = await ac.get("/api/companies")
        if resp.status_code == 200:
            print(json.dumps(resp.json(), indent=2))
        else:
            print(f"Error {resp.status_code}: {resp.text}")

        print(f"\n[GET /api/companies/Google?username={username}]")
        resp = await ac.get(f"/api/companies/Google?username={username}&timeframe=6-months")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Company: {data.get('company_name')}, Timeframe: {data.get('timeframe')}")
            print(f"Stats: {json.dumps(data.get('stats'), indent=2)}")
            cats = data.get('categories', [])
            print(f"Returned {len(cats)} categories.")
            if len(cats) > 0:
                print("First category sample:", cats[0].get("category"))
                if len(cats[0].get("subtopics", [])) > 0:
                    sub = cats[0]["subtopics"][0]
                    print("  Subtopic sample:", sub.get("pattern"))
                    if len(sub.get("questions", [])) > 0:
                        print("    Question sample:", json.dumps(sub["questions"][0], indent=2))
        else:
            print(f"Error {resp.status_code}: {resp.text}")

if __name__ == "__main__":
    asyncio.run(run_tests())

