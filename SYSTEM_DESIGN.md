# LeetMetrics: System Design & Architecture

## 1. Project Overview & Features
LeetMetrics is a highly robust, self-hosted web application acting as a mastery dashboard for algorithmic problem-solving. It uses your LeetCode session cookie to ingest your submission history, maps it to a curated DSA curriculum, and generates targeted study plans.

---

## 2. Full Database Schema (Supabase / PostgreSQL)
The schema is the absolute foundation. We use a strictly normalized structure. **Note: We only store `Accepted` submissions to keep the analytics focused on actual mastery.**

### Table: `users`
* `id` (UUID, Primary Key)
* `username` (String)
* `ranking` (Integer)
* `rating` (Float)
* `session_cookie` (Text, encrypted) - Stored safely so the sync engine can run without requiring manual input on every sync.

### Table: `sync_logs`
Records every sync attempt to prevent data corruption and aid debugging.
* `id` (UUID, Primary Key)
* `user_id` (Foreign Key -> users.id)
* `started_at` (Timestamp)
* `completed_at` (Timestamp, nullable)
* `status` (Enum: 'success', 'failed', 'in_progress')
* `error_message` (Text, nullable)
* `last_successful_submission_timestamp` (Integer) - The anchor point for the *next* sync.

### Table: `problems`
The master dictionary of all ~3,900+ LeetCode problems.
* `url_name` (String, Primary Key) - e.g., 'two-sum'
* `frontend_id` (Integer)
* `title` (String)
* `difficulty` (Enum: Easy, Medium, Hard)
* `ac_rate` (Float)
* `leetcode_topics` (JSONB) - Original tags from LeetCode.

### Table: `dsa_curriculum`
Our 15-20 pristine categories.
* `id` (Integer, Primary Key)
* `major_category` (String) - e.g., 'Dynamic Programming'
* `sub_pattern` (String) - e.g., 'Knapsack'

### Table: `problem_curriculum_mapping` (Join Table)
Explicitly links problems to curriculum topics.
* `problem_url_name` (Foreign Key -> problems.url_name)
* `curriculum_id` (Foreign Key -> dsa_curriculum.id)
* `is_manual_override` (Boolean) - True if this mapping came from our manual override file rather than auto-mapping.

### Table: `submissions`
Only **Accepted** attempts are stored. 
* `id` (Integer, Primary Key) - LeetCode's submission ID.
* `user_id` (Foreign Key -> users.id)
* `problem_url_name` (Foreign Key -> problems.url_name)
* `timestamp` (Timestamp)
* `runtime` (Integer, nullable)
* `memory` (Integer, nullable)
* `language` (String)
* `code` (Text, nullable) - Allows viewing past solutions directly in the UI without re-fetching.

### Table: `mastery_scores`
Stores historical mastery scores to track progress over time (e.g., "Your DP score went from 32 to 58 this month").
* `id` (UUID, Primary Key)
* `user_id` (Foreign Key -> users.id)
* `curriculum_id` (Foreign Key -> dsa_curriculum.id)
* `score` (Float)
* `computed_at` (Timestamp)

### Table: `contests` & `contest_history`
Tracks your contest performance to analyze which specific problem slots (Q1/Q2/Q3/Q4) you struggle with.
* **`contests`**: `id` (PK), `title`, `start_time`
* **`contest_history`**: `user_id` (FK), `contest_id` (FK), `rating`, `ranking`, `problems_solved`, `finish_time_seconds`

---

## 3. The Robust Sync Pipeline
The sync engine is the most critical backend component. It handles fragile cookies and rate limits.
1. **Pre-Sync Health Check (`/health`):** Before syncing, the backend decrypts the `session_cookie`, hits a lightweight LeetCode endpoint to verify the cookie is alive, and verifies the DB connection.
2. **Rate-Limited Pagination:** The GraphQL loop will feature a strict **1.5 to 2.0-second `asyncio.sleep()`** delay between pages.
3. **Partial Sync Safety:** If the sync fails midway, the `sync_logs` table catches it. No duplicate data is committed.

---

## 4. Curriculum Mapping & Manual Overrides
1. **`tag_mapping.json`:** A strict dictionary mapping LeetCode's 70+ tags to our 15 buckets.
2. **`manual_overrides.json`:** A file for edge cases. Overwrites the auto-mapping for specific problems.

---

## 5. Mastery Score Mathematics
The specific formula to be used in the analytics engine:
```python
score = (solved_in_topic / total_in_topic) * 0.6 + recency_factor * 0.4
# Recency factor using an exponential decay curve
# λ (lambda) controls how fast the score decays (e.g., 0.05)
recency_factor = avg(e^(-λ * days_since_solve)) # across all solves in the topic
```

## 6. Study Plan Generator Algorithm
The exact recommendation logic:
1. **Identify Weakness:** Filter all curriculum topics where the user's Mastery Score is `< 40%`.
2. **Sort:** Order these weak topics by Mastery Score (ascending).
3. **Query Unsolved:** For the top 3 weakest topics, query the `problems` table for problems mapped to those topics that do *not* exist in the user's `submissions` table. Apply `DISTINCT ON (problem_url_name)` to prevent multi-tag problems from appearing twice.
4. **Select Optimal Problems:** Sort these unsolved problems by `difficulty` and `ac_rate` descending.
5. **Output:** Return exactly 5 problems as the "Weekly Focus".


// keep in mind that when adding total questions from leetcode we have to manualy enter method like fast slow pointer for linked list as leetcode topic will only be linked list and not patterns. so when we will be adding total questions we will manually give tags for patterns and methods. 