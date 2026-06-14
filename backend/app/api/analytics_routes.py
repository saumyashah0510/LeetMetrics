from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, distinct
import collections
from app.core.database import get_db
from app.models.models import User, MasteryScore, DSACurriculum, Submission, Problem, ProblemCurriculumMapping, CompanyQuestion

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
    # Order by ASC to calculate rating changes chronologically
    sql = text("""
        SELECT c.title, c.start_time, ch.ranking, ch.problems_solved, ch.rating
        FROM contest_history ch
        JOIN contests c ON ch.contest_id = c.id
        WHERE ch.user_id = :user_id
        ORDER BY c.start_time ASC
    """)
    result = await db.execute(sql, {"user_id": user_id})
    rows = result.fetchall()
    
    contests = []
    prev_rating = 1500.0 # Base LeetCode rating
    
    for r in rows:
        rating_change = r.rating - prev_rating
        contests.append({
            "contest_name": r.title,
            "date": r.start_time,
            "rank": r.ranking if r.ranking > 0 else None,
            "problems_solved": r.problems_solved,
            "rating_change": rating_change,
            "rating": r.rating
        })
        prev_rating = r.rating
        
    # Reverse to return newest first
    contests.reverse()
    return contests

@router.get("/dashboard")
async def get_dashboard_summary(username: str, db: AsyncSession = Depends(get_db)):
    redis = None
    try:
        from app.core.redis import get_redis_client
        import json
        redis = get_redis_client()
        if redis:
            cached = await redis.get(f"dashboard:{username}")
            if cached:
                return json.loads(cached)
    except Exception as e:
        print(f"Warning: Redis read failed for dashboard cache: {e}")

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
        SELECT p.title, s.timestamp, p.difficulty,
               (SELECT dc.major_category 
                FROM problem_curriculum_mapping pcm 
                JOIN dsa_curriculum dc ON pcm.curriculum_id = dc.id 
                WHERE pcm.problem_url_name = p.url_name 
                LIMIT 1) as category,
               (SELECT dc.sub_pattern 
                FROM problem_curriculum_mapping pcm 
                JOIN dsa_curriculum dc ON pcm.curriculum_id = dc.id 
                WHERE pcm.problem_url_name = p.url_name 
                LIMIT 1) as subtopic,
               (SELECT dc.id 
                FROM problem_curriculum_mapping pcm 
                JOIN dsa_curriculum dc ON pcm.curriculum_id = dc.id 
                WHERE pcm.problem_url_name = p.url_name 
                LIMIT 1) as subtopic_id
        FROM submissions s
        JOIN problems p ON s.problem_url_name = p.url_name
        WHERE s.user_id = :user_id
        ORDER BY s.timestamp DESC
        LIMIT 5
    """)
    recent_res = await db.execute(recent_sql, {"user_id": user_id})
    recent_solves = [
        {
            "title": r.title, 
            "date": r.timestamp.isoformat() if r.timestamp else None, 
            "difficulty": r.difficulty,
            "category": r.category,
            "subtopic": r.subtopic,
            "subtopic_id": r.subtopic_id
        } for r in recent_res.fetchall()
    ]
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
            
    dashboard_data = {
        "top_weaknesses": weaknesses,
        "recent_solves": recent_solves,
        "solved_stats": {
            "solved": solved_stats,
            "total": {"Easy": 944, "Medium": 2057, "Hard": 934}
        }
    }

    try:
        if redis:
            await redis.set(f"dashboard:{username}", json.dumps(dashboard_data), ex=300)
    except Exception as e:
        print(f"Warning: Redis write failed for dashboard cache: {e}")

    return dashboard_data


@router.get("/curriculum/{username}")
async def get_curriculum(username: str, db: AsyncSession = Depends(get_db)):
    """
    Returns the complete DSA curriculum broken down by major topic and subtopic.
    For each subtopic, includes:
    - Mastery score
    - Progress (solved / total)
    - Targeted recommendations (1 Easy, 3 Medium, 1 Hard unsolved problems)
    """
    redis = None
    try:
        from app.core.redis import get_redis_client
        import json
        redis = get_redis_client()
        if redis:
            cached = await redis.get(f"curriculum:{username}")
            if cached:
                return json.loads(cached)
    except Exception as e:
        print(f"Warning: Redis read failed for curriculum cache: {e}")
    user_res = await db.execute(select(User).where(User.username == username))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user_id = user.id

    # Load mindmap details
    import json
    import os
    mindmap_data = {}
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    try:
        with open(os.path.join(base_dir, "data", "mindmap_details.json"), 'r') as f:
            mindmap_data = json.load(f)
    except Exception as e:
        print(f"Warning: Failed to load mindmap_details.json: {e}")

    # Fetch all company badges for timeframe 'six-months'
    company_sql = text("""
        SELECT problem_url_name, company_name, frequency_score
        FROM company_questions
        WHERE timeframe = 'six-months'
    """)
    company_res = await db.execute(company_sql)
    companies_by_prob = collections.defaultdict(list)
    for r in company_res.fetchall():
        companies_by_prob[r.problem_url_name].append({
            "name": r.company_name.capitalize(),
            "frequency": r.frequency_score
        })

    # 1. Fetch all solved problems by the user (with latest submission timestamp)
    solved_res = await db.execute(
        select(distinct(Submission.problem_url_name)).where(Submission.user_id == user_id)
    )
    solved_urls = {row[0] for row in solved_res.fetchall()}

    # 1b. Fetch latest submission timestamp per problem for this user
    solved_ts_sql = text("""
        SELECT problem_url_name, MAX(timestamp) as solved_at
        FROM submissions
        WHERE user_id = :user_id
        GROUP BY problem_url_name
    """)
    solved_ts_res = await db.execute(solved_ts_sql, {"user_id": user_id})
    solved_timestamps = {row.problem_url_name: row.solved_at for row in solved_ts_res.fetchall()}

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
            heuristics = mindmap_data.get(major, {})
            hierarchy[major] = {
                "major_category": major,
                "total_score": 0,
                "subtopics": [],
                "core_concepts": heuristics.get("core_concepts", []),
                "recognition_cues": heuristics.get("recognition_cues", []),
                "common_combinations": heuristics.get("common_combinations", [])
            }
            
        sub_probs = probs_by_curr.get(cid, [])
        total_count = len(sub_probs)
        
        solved_count = 0
        unsolved_easy = []
        unsolved_med = []
        unsolved_hard = []
        solved_list = []
        
        for p in sub_probs:
            if p.url_name in solved_urls:
                solved_count += 1
                solved_list.append(p)
            else:
                if p.difficulty == "Easy": unsolved_easy.append(p)
                elif p.difficulty == "Medium": unsolved_med.append(p)
                elif p.difficulty == "Hard": unsolved_hard.append(p)
        
        # Sort solved problems by latest submission timestamp (newest first)
        solved_list.sort(
            key=lambda x: solved_timestamps.get(x.url_name) or "1970-01-01",
            reverse=True
        )
        
        # Build a recommendation POOL (10 Easy, 30 Medium, 10 Hard = up to 50)
        # so the frontend can rotate through them for refresh / premium skipping
        pool = []
        if unsolved_easy: pool.extend(unsolved_easy[:10])
        if unsolved_med:  pool.extend(unsolved_med[:30])
        if unsolved_hard: pool.extend(unsolved_hard[:10])

        # If no unsolved problems exist, return solved ones to practice
        if not pool:
            solved_probs_for_rec = [p for p in sub_probs if p.url_name in solved_urls]
            solved_probs_for_rec.sort(key=lambda x: (x.difficulty != "Hard", x.difficulty != "Medium", -x.ac_rate))
            pool.extend(solved_probs_for_rec[:5])

        # Format pool
        formatted_recs = [{
            "frontend_id": r.frontend_id,
            "title": r.title,
            "url_name": r.url_name,
            "difficulty": r.difficulty,
            "ac_rate": r.ac_rate,
            "solved": r.url_name in solved_urls,
            "companies": companies_by_prob.get(r.url_name, [])
        } for r in pool]

        # Format solved problems list (ordered by latest solve)
        formatted_solved = [{
            "frontend_id": p.frontend_id,
            "title": p.title,
            "url_name": p.url_name,
            "difficulty": p.difficulty,
            "ac_rate": p.ac_rate,
            "solved_at": solved_timestamps.get(p.url_name).isoformat() if solved_timestamps.get(p.url_name) else None,
            "companies": companies_by_prob.get(p.url_name, [])
        } for p in solved_list]
        
        hierarchy[major]["subtopics"].append({
            "id": cid,
            "sub_pattern": sub,
            "score": round(score, 1),
            "progress": {
                "solved": solved_count,
                "total": total_count
            },
            "recommendations": formatted_recs,
            "solved_problems": formatted_solved
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
    
    curriculum_data = {"curriculum": result}
    try:
        if redis:
            await redis.set(f"curriculum:{username}", json.dumps(curriculum_data), ex=300)
    except Exception as e:
        print(f"Warning: Redis write failed for curriculum cache: {e}")
        
    return curriculum_data


@router.get("/companies")
async def get_companies(db: AsyncSession = Depends(get_db)):
    sql = text("""
        SELECT company_name, COUNT(*) as q_count
        FROM company_questions
        GROUP BY company_name
    """)
    result = await db.execute(sql)
    companies = []
    for r in result.fetchall():
        if r.company_name:
            companies.append({
                "name": r.company_name.capitalize(),
                "count": r.q_count
            })
    companies.sort(key=lambda x: x["name"])
    return companies


@router.get("/companies/{company_name}")
async def get_company_questions(
    company_name: str,
    timeframe: str = Query("6-months", pattern="^(30-days|3-months|6-months|all)$"),
    username: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    # Get user_id
    user_id = await get_user_id(username, db)
    
    # Get solved problems for this user to mark solved status
    solved_res = await db.execute(
        text("SELECT DISTINCT problem_url_name FROM submissions WHERE user_id = :user_id"),
        {"user_id": user_id}
    )
    solved_urls = {row[0] for row in solved_res.fetchall()}
    
    # Fetch questions for this company and timeframe mapped to curriculum
    sql = text("""
        SELECT 
            p.frontend_id, p.title, p.url_name, p.difficulty, p.ac_rate,
            cq.frequency_score, cq.importance_level,
            COALESCE(dc.major_category, 'General') as major_category,
            COALESCE(dc.sub_pattern, 'Uncategorized') as sub_pattern,
            COALESCE(dc.id, 0) as curriculum_id
        FROM company_questions cq
        JOIN problems p ON cq.problem_url_name = p.url_name
        LEFT JOIN problem_curriculum_mapping pcm ON p.url_name = pcm.problem_url_name
        LEFT JOIN dsa_curriculum dc ON pcm.curriculum_id = dc.id
        WHERE LOWER(cq.company_name) = :company_name AND cq.timeframe = :timeframe
        ORDER BY cq.frequency_score DESC
    """)
    result = await db.execute(sql, {"company_name": company_name.lower(), "timeframe": timeframe})
    rows = result.fetchall()
    
    # 1. Compute stats (deduplicated by url_name)
    unique_probs = {}
    for r in rows:
        unique_probs[r.url_name] = {
            "difficulty": r.difficulty,
            "solved": r.url_name in solved_urls
        }
        
    stats = {
        "total": len(unique_probs),
        "solved": sum(1 for p in unique_probs.values() if p["solved"]),
        "by_difficulty": {
            "Easy": {"total": 0, "solved": 0},
            "Medium": {"total": 0, "solved": 0},
            "Hard": {"total": 0, "solved": 0}
        }
    }
    for p in unique_probs.values():
        diff = p["difficulty"]
        if diff in stats["by_difficulty"]:
            stats["by_difficulty"][diff]["total"] += 1
            if p["solved"]:
                stats["by_difficulty"][diff]["solved"] += 1
                
    # 2. Group by Major Category and Subtopic
    groups = collections.defaultdict(lambda: collections.defaultdict(list))
    for r in rows:
        q_data = {
            "frontend_id": r.frontend_id,
            "title": r.title,
            "url_name": r.url_name,
            "difficulty": r.difficulty,
            "ac_rate": r.ac_rate,
            "frequency": r.frequency_score,
            "importance": r.importance_level,
            "solved": r.url_name in solved_urls
        }
        groups[r.major_category][r.sub_pattern].append(q_data)
        
    # Format categories for response
    categories_list = []
    for major, subs in groups.items():
        subtopics_list = []
        for sub, q_list in subs.items():
            # Deduplicate questions in same subtopic
            seen = set()
            dedup_q = []
            for q in q_list:
                if q["url_name"] not in seen:
                    seen.add(q["url_name"])
                    dedup_q.append(q)
            subtopics_list.append({
                "pattern": sub,
                "questions": dedup_q
            })
            
        categories_list.append({
            "category": major,
            "subtopics": subtopics_list
        })
        
    # Sort categories alphabetically
    categories_list.sort(key=lambda x: x["category"])
    
    return {
        "company_name": company_name.capitalize(),
        "timeframe": timeframe,
        "stats": stats,
        "categories": categories_list
    }
