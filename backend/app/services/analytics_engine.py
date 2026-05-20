import math
import logging
from datetime import datetime, timezone
from sqlalchemy import text
from app.core.database import engine

logger = logging.getLogger(__name__)

class AnalyticsEngine:
    @staticmethod
    def compute_recency_factor(submission_timestamps: list[datetime]) -> float:
        """
        Calculates exponential decay based on recency.
        Extracts unique practice days to prevent spam submissions from inflating memory trace.
        Uses max() decay value so active revision instantly restores mastery to 1.0x.
        """
        if not submission_timestamps:
            return 0.0
            
        now = datetime.now(timezone.utc)
        practice_days = set()
        
        for ts in submission_timestamps:
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            practice_days.add(ts.date())
            
        if not practice_days:
            return 0.0
            
        decay_values = []
        for d in practice_days:
            # Convert date back to datetime at midnight to get accurate days diff
            dt = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
            days = max(0, (now - dt).days)
            # Exponential decay: e^(-λ * days), λ=0.001 gives ~83% at 180 days (6 months)
            decay_values.append(math.exp(-0.001 * days))
            
        return max(decay_values)

    @staticmethod
    async def compute_mastery_for_user(user_id: str):
        """
        Computes the mastery scores for all curriculum patterns for a specific user
        and upserts them into the mastery_scores table.
        """
        logger.info(f"Starting mastery calculation for user {user_id}")
        
        async with engine.begin() as conn:
            # 1. Fetch total problems per curriculum bucket
            total_counts_sql = text("""
                SELECT curriculum_id, COUNT(*) as total_problems
                FROM problem_curriculum_mapping
                GROUP BY curriculum_id
            """)
            result = await conn.execute(total_counts_sql)
            bucket_sizes = {row.curriculum_id: row.total_problems for row in result.fetchall()}
            
            # 2. Fetch user's solved problems, joined with curriculum mapping and difficulty
            solved_sql = text("""
                SELECT 
                    pcm.curriculum_id,
                    p.url_name,
                    p.difficulty,
                    s.timestamp
                FROM submissions s
                JOIN problems p ON s.problem_url_name = p.url_name
                JOIN problem_curriculum_mapping pcm ON p.url_name = pcm.problem_url_name
                WHERE s.user_id = :user_id
            """)
            result = await conn.execute(solved_sql, {"user_id": user_id})
            solved_rows = result.fetchall()
            
            # Aggregate data per curriculum_id
            pattern_data = {}
            for row in solved_rows:
                cid = row.curriculum_id
                prob = row.url_name
                diff = row.difficulty.lower() if row.difficulty else "medium"
                
                if cid not in pattern_data:
                    pattern_data[cid] = {
                        "unique_problems": set(),
                        "easy": 0, "medium": 0, "hard": 0,
                        "timestamps": []
                    }
                
                # Only count unique problems for volume and difficulty
                if prob not in pattern_data[cid]["unique_problems"]:
                    pattern_data[cid]["unique_problems"].add(prob)
                    if diff in pattern_data[cid]:
                        pattern_data[cid][diff] += 1
                        
                # Use all submissions for memory trace (filtered by unique days in compute_recency_factor)
                pattern_data[cid]["timestamps"].append(row.timestamp)
                
            # 3. Calculate Mastery Scores
            upsert_data = []
            
            # Fetch all curriculum IDs to ensure we zero out un-practiced buckets
            all_cids_sql = text("SELECT id FROM dsa_curriculum")
            result = await conn.execute(all_cids_sql)
            all_cids = [row.id for row in result.fetchall()]
            
            for cid in all_cids:
                total_in_bucket = bucket_sizes.get(cid, 0)
                if total_in_bucket == 0:
                    continue # Skip empty buckets
                    
                data = pattern_data.get(cid)
                if not data:
                    upsert_data.append({
                        "user_id": user_id, 
                        "curriculum_id": cid, 
                        "volume_score": 0.0,
                        "difficulty_score": 0.0,
                        "recency_multiplier": 0.0,
                        "score": 0.0
                    })
                    continue
                    
                easy_count = data["easy"]
                medium_count = data["medium"]
                hard_count = data["hard"]
                solved_count = easy_count + medium_count + hard_count
                
                # Volume Score: Asymptotic curve 50 * (1 - e^(-solved / denominator))
                volume_denominator = max(total_in_bucket * 0.40, 10.0)
                volume_score = 50.0 * (1.0 - math.exp(-solved_count / volume_denominator))
                
                # Difficulty Score: Asymptotic curve 50 * (1 - e^(-weight / 40))
                total_weight = (easy_count * 0.5) + (medium_count * 2.0) + (hard_count * 5.0)
                difficulty_score = 50.0 * (1.0 - math.exp(-total_weight / 40.0))
                
                # Recency Factor Calculation
                recency_multiplier = AnalyticsEngine.compute_recency_factor(data["timestamps"])
                
                # Final Mastery Score
                final_score = (volume_score + difficulty_score) * recency_multiplier
                final_score = round(final_score, 2)
                
                upsert_data.append({
                    "user_id": user_id, 
                    "curriculum_id": cid, 
                    "volume_score": round(volume_score, 2),
                    "difficulty_score": round(difficulty_score, 2),
                    "recency_multiplier": round(recency_multiplier, 4),
                    "score": final_score
                })
                
            # 4. Bulk Upsert into mastery_scores
            if upsert_data:
                upsert_sql = text("""
                    INSERT INTO mastery_scores (
                        user_id, curriculum_id, volume_score, difficulty_score, recency_multiplier, score, computed_at
                    )
                    VALUES (
                        :user_id, :curriculum_id, :volume_score, :difficulty_score, :recency_multiplier, :score, NOW()
                    )
                    ON CONFLICT (user_id, curriculum_id) 
                    DO UPDATE SET 
                        volume_score = EXCLUDED.volume_score,
                        difficulty_score = EXCLUDED.difficulty_score,
                        recency_multiplier = EXCLUDED.recency_multiplier,
                        score = EXCLUDED.score, 
                        computed_at = EXCLUDED.computed_at;
                """)
                await conn.execute(upsert_sql, upsert_data)
                
        logger.info(f"Successfully computed and upserted mastery scores for user {user_id}")
