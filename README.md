# LeetMetrics 🚀

LeetMetrics is an advanced, Data Science-driven analytics engine and dashboard designed to replace generic LeetCode statistics with **mathematically rigorous, Explainable AI (XAI)** mastery tracking. 

While LeetCode groups problems into massive, unhelpful buckets (e.g., 2,300+ problems tagged simply as "Array"), LeetMetrics uses a custom two-layer ETL pipeline to re-classify your submissions into **68 granular micro-patterns** (e.g., *Monotonic Stack*, *Topological Sort (Kahn's)*, *Segment Tree with Lazy Propagation*).

## 🧠 The Analytics Engine (Mathematical Heuristics)
LeetMetrics goes far beyond raw problem counting. It runs a secure background inference pipeline to calculate a **0-100 Mastery Score** for every specific DSA pattern, evaluating three meticulously engineered features:

1. **Asymptotic Volume Scaling**: Grinding easy problems yields diminishing returns. Volume scores scale logarithmically against the total size of the curriculum bucket, meaning mastering a massive 200-problem bucket requires significantly more effort than a niche 10-problem bucket.
2. **Difficulty Weighting**: Problem difficulty is handled via non-linear weights (Easy = 0.5, Medium = 2.0, Hard = 5.0). Hard problems grant immense progression leaps but are bounded by an asymptotic curve to prevent artificial maxing.
3. **Exponential Recency Decay**: Memory retention is calculated using `e^(-0.001 * days)`. Spamming repetitive submissions is automatically blocked via unique-day session grouping. The `max()` decay formula ensures that undertaking an active revision session instantly snaps your memory multiplier back to `1.0x`.

## ✨ Key Features
- **Micro-Pattern Granularity**: Tracks extremely specific skills instead of broad, useless macro-categories.
- **Intelligent Study Plans**: Automatically generates a highly targeted 5-problem study plan based on your top 3 weaknesses (Mastery Score < 60), applying an automated ELO constraint to force at least one *Hard* problem into the curriculum if your global rating exceeds 1500.
- **Global Contest Tracking**: Syncs your actual LeetCode Contest rating history via GraphQL to measure your ultimate performance under pressure.
- **Explainable AI**: Every mastery score exposes its internal `volume_score`, `difficulty_score`, and `recency_multiplier` directly from the database, so you know exactly *why* your score shifted and exactly how to fix it.

## 🏗️ Architecture
- **Backend API**: High-performance, asynchronous `FastAPI` serving lightning-fast precomputed metrics.
- **Data Layer**: Relational `PostgreSQL` database utilizing strict foreign-key joins, bulk upserts, and an optimized schema for rapid background caching.
- **ETL Pipeline**: Dual-layer synchronization engine that prioritizes manually curated community overrides (NeetCode/Striver datasets) while dynamically cleaning and mapping raw LeetCode GraphQL tags as a fallback.

## 🚀 Getting Started

### 1. Database Setup
Execute the `schema.sql` script in your PostgreSQL instance to establish the relational tables, unique constraints, and Row-Level Security policies.

### 2. Environment Variables
Create a `.env` file in the `backend/` directory:
```env
DATABASE_URL=postgresql+psycopg2://<user>:<password>@<host>/<dbname>
```

### 3. Pipeline Initialization
Install dependencies and run the ETL pipeline to ingest all 3,900+ LeetCode problems and seed the pristine 68-bucket DSA curriculum mappings.
```bash
cd backend
python run_pipeline.py
```

### 4. Run the API Server
Start the FastAPI application to begin serving the analytics endpoints:
```bash
uvicorn app.main:app --reload
```
