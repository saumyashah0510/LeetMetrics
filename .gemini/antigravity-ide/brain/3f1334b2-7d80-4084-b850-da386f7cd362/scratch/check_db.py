import asyncio
import sys
import os

sys.path.append("c:\\Users\\OMEN\\OneDrive\\Desktop\\LeetMetrics\\backend")

from app.core.database import AsyncSessionLocal
from app.models.models import CompanyQuestion
from sqlalchemy import select

async def main():
    db = AsyncSessionLocal()
    res = await db.execute(select(CompanyQuestion.frequency_score))
    scores = [r for r in res.scalars().all() if r is not None]
    
    if not scores:
        print("No scores found.")
        await db.close()
        return
        
    most_freq = sum(1 for s in scores if s >= 60.0)
    important = sum(1 for s in scores if s >= 35.0 and s < 60.0)
    regular = sum(1 for s in scores if s < 35.0)
    
    total = len(scores)
    print(f"Total: {total}")
    print(f"Most Frequent (>= 60%): {most_freq} ({most_freq/total*100:.1f}%)")
    print(f"Important (>= 35% and < 60%): {important} ({important/total*100:.1f}%)")
    print(f"Regular (< 35%): {regular} ({regular/total*100:.1f}%)")
    
    await db.close()

if __name__ == "__main__":
    asyncio.run(main())
