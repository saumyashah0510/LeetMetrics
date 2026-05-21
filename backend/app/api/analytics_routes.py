from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, distinct
import collections
from app.core.database import get_db
from app.models.models import User, MasteryScore, DSACurriculum, Submission, Problem, ProblemCurriculumMapping

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
        WITH pattern_weights AS (
            SELECT curriculum_id, COUNT(*) as total_problems
            FROM problem_curriculum_mapping
            GROUP BY curriculum_id
        )
        SELECT 
            dc.id, dc.major_category, dc.sub_pattern,
            COALESCE(ms.volume_score, 0) as volume_score,
            COALESCE(ms.difficulty_score, 0) as difficulty_score,
            COALESCE(ms.recency_multiplier, 0) as recency_multiplier,
            COALESCE(ms.score, 0) as score,
            COALESCE(pw.total_problems, 1) as weight
        FROM dsa_curriculum dc
        LEFT JOIN mastery_scores ms ON dc.id = ms.curriculum_id AND ms.user_id = :user_id
        LEFT JOIN pattern_weights pw ON dc.id = pw.curriculum_id
        ORDER BY dc.major_category, dc.id
    """)
    result = await db.execute(sql, {"user_id": user_id})
    return [{"id": r.id, "category": r.major_category, "pattern": r.sub_pattern, 
             "volume_score": r.volume_score, "difficulty_score": r.difficulty_score,
             "recency_multiplier": r.recency_multiplier, "score": r.score,
             "weight": r.weight} for r in result.fetchall()]

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
    # Solved Stats
    stats_sql = text("""
        SELECT p.difficulty, COUNT(DISTINCT p.url_name) as cnt
        FROM submissions s
        JOIN problems p ON s.problem_url_name = p.url_name
        WHERE s.user_id = :user_id
        GROUP BY p.difficulty
    """)
    stats_res = await db.execute(stats_sql, {"user_id": user_id})
    solved_stats = {"Easy": 0, "Medium": 0, "Hard": 0}
    for r in stats_res.fetchall():
        if r.difficulty in solved_stats:
            solved_stats[r.difficulty] = r.cnt
            
    return {
        "top_weaknesses": weaknesses,
        "recent_solves": recent_solves,
        "solved_stats": {
            "solved": solved_stats,
            "total": {"Easy": 944, "Medium": 2057, "Hard": 934}
        }
    }


@router.get("/curriculum/{username}")
async def get_curriculum(username: str, db: AsyncSession = Depends(get_db)):
    """
    Returns the complete DSA curriculum broken down by major topic and subtopic.
    For each subtopic, includes:
    - Mastery score
    - Progress (solved / total)
    - Targeted recommendations (1 Easy, 3 Medium, 1 Hard unsolved problems)
    """
    user_res = await db.execute(select(User).where(User.username == username))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user_id = user.id

    # 1. Fetch all solved problems by the user
    solved_res = await db.execute(
        select(distinct(Submission.problem_url_name)).where(Submission.user_id == user_id)
    )
    solved_urls = {row[0] for row in solved_res.fetchall()}

    # 2. Fetch the full curriculum tree with mastery scores
    curr_sql = text("""
        SELECT c.id, c.major_category, c.sub_pattern, m.score
        FROM dsa_curriculum c
        LEFT JOIN mastery_scores m ON c.id = m.curriculum_id AND m.user_id = :user_id
    """)
    curr_res = await db.execute(curr_sql, {"user_id": user_id})
    curriculums = curr_res.fetchall()

    # 3. Fetch all problem mappings with problem details (title, difficulty, url, ac_rate)
    # We order by ac_rate DESC so recommendations favor easier/higher acceptance problems first
    prob_sql = text("""
        SELECT pcm.curriculum_id, p.url_name, p.title, p.difficulty, p.ac_rate, p.frontend_id
        FROM problem_curriculum_mapping pcm
        JOIN problems p ON pcm.problem_url_name = p.url_name
        ORDER BY p.ac_rate DESC NULLS LAST
    """)
    prob_res = await db.execute(prob_sql)
    all_problems = prob_res.fetchall()

    # Group problems by curriculum
    probs_by_curr = collections.defaultdict(list)
    for p in all_problems:
        probs_by_curr[p.curriculum_id].append(p)

    # 4. Build the hierarchical response
    hierarchy = {}
    
    for row in curriculums:
        cid = row.id
        major = row.major_category
        sub = row.sub_pattern
        score = row.score if row.score is not None else 0
        
        if major not in hierarchy:
            hierarchy[major] = {
                "major_category": major,
                "total_score": 0,
                "subtopics": []
            }
            
        sub_probs = probs_by_curr.get(cid, [])
        total_count = len(sub_probs)
        
        solved_count = 0
        unsolved_easy = []
        unsolved_med = []
        unsolved_hard = []
        
        for p in sub_probs:
            if p.url_name in solved_urls:
                solved_count += 1
            else:
                if p.difficulty == "Easy": unsolved_easy.append(p)
                elif p.difficulty == "Medium": unsolved_med.append(p)
                elif p.difficulty == "Hard": unsolved_hard.append(p)
        
        # Pick recommendations: 1 Easy, 3 Medium, 1 Hard (already sorted by ac_rate DESC)
        recs = []
        if unsolved_easy: recs.extend(unsolved_easy[:1])
        if unsolved_med: recs.extend(unsolved_med[:3])
        if unsolved_hard: recs.extend(unsolved_hard[:1])
        
        # Format recs
        formatted_recs = [{
            "frontend_id": r.frontend_id,
            "title": r.title,
            "url_name": r.url_name,
            "difficulty": r.difficulty,
            "ac_rate": r.ac_rate
        } for r in recs]
        
        hierarchy[major]["subtopics"].append({
            "id": cid,
            "sub_pattern": sub,
            "score": round(score, 1),
            "progress": {
                "solved": solved_count,
                "total": total_count
            },
            "recommendations": formatted_recs
        })

    # Sort major categories by overall average score descending
    result = []
    for major, data in hierarchy.items():
        if not data["subtopics"]: continue
        
        # Weight scores by total problems to get an accurate major category score
        total_weighted = 0
        total_probs = 0
        for sub in data["subtopics"]:
            total_weighted += (sub["score"] * sub["progress"]["total"])
            total_probs += sub["progress"]["total"]
            
        data["total_score"] = round(total_weighted / total_probs, 1) if total_probs > 0 else 0
        
        # Sort subtopics by score descending
        data["subtopics"].sort(key=lambda x: x["score"], reverse=True)
        result.append(data)
        
    result.sort(key=lambda x: x["total_score"], reverse=True)
    
    return {"curriculum": result}
