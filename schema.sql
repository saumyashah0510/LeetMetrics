-- ==========================================
-- STEP 1: Drop everything in reverse order
-- (respect foreign key dependencies)
-- ==========================================
DROP POLICY IF EXISTS "service_only" ON mastery_scores;
DROP POLICY IF EXISTS "service_only" ON sync_logs;
DROP POLICY IF EXISTS "service_only" ON submissions;
DROP POLICY IF EXISTS "service_only" ON users;

DROP INDEX IF EXISTS idx_contest_history_user;
DROP INDEX IF EXISTS idx_problems_difficulty;
DROP INDEX IF EXISTS idx_mastery_scores_computed_at;
DROP INDEX IF EXISTS idx_submissions_timestamp;
DROP INDEX IF EXISTS idx_sync_logs_user_id;
DROP INDEX IF EXISTS idx_mastery_scores_user_curr;
DROP INDEX IF EXISTS idx_submissions_user_problem;

DROP TABLE IF EXISTS contest_history;
DROP TABLE IF EXISTS contests;
DROP TABLE IF EXISTS company_questions;
DROP TABLE IF EXISTS mastery_scores;
DROP TABLE IF EXISTS submissions;
DROP TABLE IF EXISTS problem_curriculum_mapping;
DROP TABLE IF EXISTS dsa_curriculum;
DROP TABLE IF EXISTS problems;
DROP TABLE IF EXISTS sync_logs;
DROP TABLE IF EXISTS users;

-- ==========================================
-- STEP 2: Recreate everything fresh
-- ==========================================

-- 1. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    ranking INTEGER,
    rating FLOAT,
    session_cookie TEXT,
    last_sync_timestamp INTEGER DEFAULT 0,
    last_synced_at TIMESTAMP WITH TIME ZONE
);

-- 2. Sync Logs Table
CREATE TABLE sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT CHECK (status IN ('success', 'failed', 'in_progress')),
    error_message TEXT
);

-- 3. Problems Table
CREATE TABLE problems (
    url_name TEXT PRIMARY KEY,
    frontend_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    ac_rate FLOAT,
    leetcode_topics JSONB
);

-- 4. DSA Curriculum Table
CREATE TABLE dsa_curriculum (
    id SERIAL PRIMARY KEY,
    major_category TEXT NOT NULL,
    sub_pattern TEXT NOT NULL
);

-- 5. Problem Curriculum Mapping (Join Table)
CREATE TABLE problem_curriculum_mapping (
    problem_url_name TEXT REFERENCES problems(url_name) ON DELETE CASCADE,
    curriculum_id INTEGER REFERENCES dsa_curriculum(id) ON DELETE CASCADE,
    is_manual_override BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (problem_url_name, curriculum_id)
);

-- 6. Submissions Table
CREATE TABLE submissions (
    id INTEGER PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    problem_url_name TEXT REFERENCES problems(url_name) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    runtime INTEGER,
    memory INTEGER,
    language TEXT,
    code TEXT
);

-- 7. Mastery Scores Table
CREATE TABLE mastery_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    curriculum_id INTEGER REFERENCES dsa_curriculum(id) ON DELETE CASCADE,
    volume_score FLOAT NOT NULL,
    difficulty_score FLOAT NOT NULL,
    recency_multiplier FLOAT NOT NULL,
    score FLOAT NOT NULL,
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, curriculum_id)
);

-- 8. Contests Table
CREATE TABLE contests (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 9. Contest History Table
CREATE TABLE contest_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    contest_id INTEGER REFERENCES contests(id) ON DELETE CASCADE,
    rating FLOAT,
    ranking INTEGER,
    problems_solved INTEGER,
    finish_time_seconds INTEGER,
    rating_change FLOAT
);

-- 10. Company Questions Table
CREATE TABLE company_questions (
    id SERIAL PRIMARY KEY,
    company_name TEXT NOT NULL,
    timeframe TEXT NOT NULL CHECK (timeframe IN ('30-days', '3-months', '6-months', 'all')),
    problem_url_name TEXT NOT NULL REFERENCES problems(url_name) ON DELETE CASCADE,
    frequency_score FLOAT,
    importance_level TEXT CHECK (importance_level IN ('Most Frequent', 'Important', 'Regular')),
    UNIQUE (company_name, timeframe, problem_url_name)
);

-- ==========================================
-- STEP 3: Performance Indexes
-- ==========================================
CREATE INDEX idx_submissions_user_problem ON submissions(user_id, problem_url_name);
CREATE INDEX idx_mastery_scores_user_curr ON mastery_scores(user_id, curriculum_id);
CREATE INDEX idx_sync_logs_user_id ON sync_logs(user_id);
CREATE INDEX idx_submissions_timestamp ON submissions(timestamp);
CREATE INDEX idx_mastery_scores_computed_at ON mastery_scores(computed_at);
CREATE INDEX idx_problems_difficulty ON problems(difficulty);
CREATE INDEX idx_contest_history_user ON contest_history(user_id);
CREATE INDEX idx_company_questions_lookup ON company_questions(company_name, timeframe);

-- ==========================================
-- STEP 4: Row Level Security
-- ==========================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mastery_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_only" ON users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_only" ON submissions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_only" ON sync_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_only" ON mastery_scores FOR ALL USING (auth.role() = 'service_role');