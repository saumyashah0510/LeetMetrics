import asyncio
import sys
import os
from sqlalchemy import select, func

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models.models import CompanyQuestion, Problem

async def main():
    async with AsyncSessionLocal() as db:
        prob_count = await db.scalar(select(func.count(Problem.url_name)))
        cq_count = await db.scalar(select(func.count(CompanyQuestion.id)))
        
        # Get unique companies and counts of questions for each
        res = await db.execute(select(CompanyQuestion.company_name, func.count(CompanyQuestion.id)).group_by(CompanyQuestion.company_name))
        company_counts = res.all()
        
        print(f"Problems Count: {prob_count}")
        print(f"CompanyQuestion Count: {cq_count}")
        print(f"Unique Companies ({len(company_counts)}):")
        for company, count in sorted(company_counts, key=lambda x: x[1], reverse=True)[:20]:
            print(f"  - {company}: {count} questions")
        if len(company_counts) > 20:
            print(f"  ... and {len(company_counts) - 20} more")

if __name__ == "__main__":
    asyncio.run(main())
