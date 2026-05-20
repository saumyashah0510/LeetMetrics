from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db

router = APIRouter()

async def get_user_id(username: str, db: AsyncSession) -> str:
    sql = text("SELECT id FROM users WHERE username = :username LIMIT 1")
    result = await db.execute(sql, {"username": username})
    user_id = result.scalar()
    if not user_id:
        raise HTTPException(status_code=404, detail=f"User {username} not found. Please sync first.")
    return str(user_id)

@router.get("/mastery")
async def get_all_mastery(username: str, db: AsyncSession = Depends(get_db)):
    user_id = await get_user_id(username, db)
    sql = text("""
        SELECT 
            dc.id, dc.major_category, dc.sub_pattern,
            COALESCE(ms.volume_score, 0) as volume_score,
            COALESCE(ms.difficulty_score, 0) as difficulty_score,
            COALESCE(ms.recency_multiplier, 0) as recency_multiplier,
            COALESCE(ms.score, 0) as score
        FROM dsa_curriculum dc
        LEFT JOIN mastery_scores ms ON dc.id = ms.curriculum_id AND ms.user_id = :user_id
        ORDER BY dc.major_category, dc.id
    """)
    result = await db.execute(sql, {"user_id": user_id})
    return [{"id": r.id, "category": r.major_category, "pattern": r.sub_pattern, 
             "volume_score": r.volume_score, "difficulty_score": r.difficulty_score,
             "recency_multiplier": r.recency_multiplier, "score": r.score} for r in result.fetchall()]

@router.get("/mastery/{category}")
async def get_category_mastery(category: str, username: str, db: AsyncSession = Depends(get_db)):
    user_id = await get_user_id(username, db)
    sql = text("""
        SELECT 
            dc.id, dc.major_category, dc.sub_pattern,
            COALESCE(ms.volume_score, 0) as volume_score,
            COALESCE(ms.difficulty_score, 0) as difficulty_score,
            COALESCE(ms.recency_multiplier, 0) as recency_multiplier,
            COALESCE(ms.score, 0) as score
        FROM dsa_curriculum dc
        LEFT JOIN mastery_scores ms ON dc.id = ms.curriculum_id AND ms.user_id = :user_id
        WHERE dc.major_category = :category
        ORDER BY dc.id
    """)
    result = await db.execute(sql, {"user_id": user_id, "category": category})
    return [{"id": r.id, "category": r.major_category, "pattern": r.sub_pattern, 
             "volume_score": r.volume_score, "difficulty_score": r.difficulty_score,
             "recency_multiplier": r.recency_multiplier, "score": r.score} for r in result.fetchall()]

@router.get("/topics")
async def get_topics_overview(username: str, db: AsyncSession = Depends(get_db)):
    user_id = await get_user_id(username, db)
    sql = text("""
        WITH bucket_totals AS (
            SELECT curriculum_id, COUNT(*) as total_problems
            FROM problem_curriculum_mapping
            GROUP BY curriculum_id
        ),
        solved_totals AS (
            SELECT pcm.curriculum_id, COUNT(DISTINCT s.problem_url_name) as solved_count
            FROM submissions s
            JOIN problem_curriculum_mapping pcm ON s.problem_url_name = pcm.problem_url_name
            WHERE s.user_id = :user_id
            GROUP BY pcm.curriculum_id
        )
        SELECT 
            dc.id, dc.major_category, dc.sub_pattern,
            COALESCE(bt.total_problems, 0) as total_problems,
            COALESCE(st.solved_count, 0) as solved_problems
        FROM dsa_curriculum dc
        LEFT JOIN bucket_totals bt ON dc.id = bt.curriculum_id
        LEFT JOIN solved_totals st ON dc.id = st.curriculum_id
    """)
    result = await db.execute(sql, {"user_id": user_id})
    return [{"id": r.id, "category": r.major_category, "pattern": r.sub_pattern, 
             "total_problems": r.total_problems, "solved_problems": r.solved_problems} for r in result.fetchall()]

@router.get("/topics/{pattern_id}")
async def get_unsolved_in_pattern(pattern_id: int, username: str, db: AsyncSession = Depends(get_db)):
    user_id = await get_user_id(username, db)
    sql = text("""
        SELECT p.url_name, p.title, p.difficulty, p.ac_rate
        FROM problem_curriculum_mapping pcm
        JOIN problems p ON pcm.problem_url_name = p.url_name
        WHERE pcm.curriculum_id = :pattern_id
        AND p.url_name NOT IN (
            SELECT problem_url_name FROM submissions WHERE user_id = :user_id
        )
        ORDER BY p.ac_rate DESC
    """)
    result = await db.execute(sql, {"pattern_id": pattern_id, "user_id": user_id})
    return [{"slug": r.url_name, "title": r.title, "difficulty": r.difficulty, "ac_rate": r.ac_rate} for r in result.fetchall()]

@router.get("/study-plan")
async def get_study_plan(username: str, db: AsyncSession = Depends(get_db)):
    user_id = await get_user_id(username, db)
    
    # Check ELO rating
    rating_sql = text("SELECT rating FROM users WHERE id = :user_id")
    rating_res = await db.execute(rating_sql, {"user_id": user_id})
    contest_rating = rating_res.scalar() or 0.0
    
    # 1. Get Top 3 Weak Patterns (< 60 score)
    weak_sql = text("""
        SELECT curriculum_id 
        FROM mastery_scores 
        WHERE user_id = :user_id AND score < 60
        ORDER BY score ASC
        LIMIT 3
    """)
    weak_res = await db.execute(weak_sql, {"user_id": user_id})
    weak_patterns = [r.curriculum_id for r in weak_res.fetchall()]
    
    if not weak_patterns:
        return {"message": "You have mastered all patterns!", "plan": []}
        
    # 2. Get unsolved problems for those patterns
    plan_sql = text("""
        SELECT p.url_name, p.title, p.difficulty, p.ac_rate, dc.sub_pattern
        FROM problem_curriculum_mapping pcm
        JOIN problems p ON pcm.problem_url_name = p.url_name
        JOIN dsa_curriculum dc ON pcm.curriculum_id = dc.id
        WHERE pcm.curriculum_id = ANY(:weak_patterns)
        AND p.url_name NOT IN (SELECT problem_url_name FROM submissions WHERE user_id = :user_id)
        ORDER BY 
            CASE p.difficulty WHEN 'Medium' THEN 0 WHEN 'Easy' THEN 1 ELSE 2 END ASC,
            p.ac_rate DESC
        LIMIT 4
    """)
    plan_res = await db.execute(plan_sql, {"weak_patterns": weak_patterns, "user_id": user_id})
    plan = [{"slug": r.url_name, "title": r.title, "difficulty": r.difficulty, "ac_rate": r.ac_rate, "pattern": r.sub_pattern} for r in plan_res.fetchall()]
    
    # 3. Apply Hard Floor
    if contest_rating > 1500:
        hard_sql = text("""
            SELECT p.url_name, p.title, p.difficulty, p.ac_rate, dc.sub_pattern
            FROM problem_curriculum_mapping pcm
            JOIN problems p ON pcm.problem_url_name = p.url_name
            JOIN dsa_curriculum dc ON pcm.curriculum_id = dc.id
            WHERE p.difficulty = 'Hard'
            AND p.url_name NOT IN (SELECT problem_url_name FROM submissions WHERE user_id = :user_id)
            ORDER BY p.ac_rate DESC
            LIMIT 1
        """)
        hard_res = await db.execute(hard_sql, {"user_id": user_id})
        hard_prob = hard_res.fetchone()
        if hard_prob:
            plan.append({"slug": hard_prob.url_name, "title": hard_prob.title, "difficulty": hard_prob.difficulty, "ac_rate": hard_prob.ac_rate, "pattern": hard_prob.sub_pattern})
            
    return {"plan": plan}

@router.get("/contests/summary")
async def get_contests_summary(username: str, db: AsyncSession = Depends(get_db)):
    user_id = await get_user_id(username, db)
    sql = text("SELECT rating, ranking FROM users WHERE id = :user_id")
    result = await db.execute(sql, {"user_id": user_id})
    row = result.fetchone()
    if not row or not row.rating:
         return {"rating": 0, "global_ranking": 0, "trend": 0}
         
    return {"rating": round(row.rating, 2), "global_ranking": row.ranking, "trend": 0}

@router.get("/contests")
async def get_contests(username: str, db: AsyncSession = Depends(get_db)):
    user_id = await get_user_id(username, db)
    sql = text("""
        SELECT c.title, c.start_time, ch.ranking, ch.problems_solved, ch.rating_change, ch.rating
        FROM contest_history ch
        JOIN contests c ON ch.contest_id = c.id
        WHERE ch.user_id = :user_id
        ORDER BY c.start_time DESC
    """)
    result = await db.execute(sql, {"user_id": user_id})
    return [{"contest_name": r.title, "date": r.start_time, "rank": r.ranking, 
             "problems_solved": r.problems_solved, "rating_change": r.rating_change, "rating": r.rating} for r in result.fetchall()]

@router.get("/dashboard")
async def get_dashboard_summary(username: str, db: AsyncSession = Depends(get_db)):
    user_id = await get_user_id(username, db)
    
    # Top weaknesses
    weak_sql = text("""
        SELECT dc.sub_pattern, ms.score
        FROM mastery_scores ms
        JOIN dsa_curriculum dc ON ms.curriculum_id = dc.id
        WHERE ms.user_id = :user_id
        ORDER BY ms.score ASC
        LIMIT 3
    """)
    weak_res = await db.execute(weak_sql, {"user_id": user_id})
    weaknesses = [{"pattern": r.sub_pattern, "score": r.score} for r in weak_res.fetchall()]
    
    # Recent solves (last 5)
    recent_sql = text("""
        SELECT p.title, s.timestamp, p.difficulty
        FROM submissions s
        JOIN problems p ON s.problem_url_name = p.url_name
        WHERE s.user_id = :user_id
        ORDER BY s.timestamp DESC
        LIMIT 5
    """)
    recent_res = await db.execute(recent_sql, {"user_id": user_id})
    recent_solves = [{"title": r.title, "date": r.timestamp, "difficulty": r.difficulty} for r in recent_res.fetchall()]
    
    return {
        "top_weaknesses": weaknesses,
        "recent_solves": recent_solves
    }
