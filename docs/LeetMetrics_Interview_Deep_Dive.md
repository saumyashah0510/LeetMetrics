# LeetMetrics — Backend Concepts Interview Deep-Dive

> **How to use this document:**  
> Read each section top-to-bottom. The pattern is always:  
> ① Concept explained simply → ② A standalone example → ③ How LeetMetrics uses it → ④ Code evidence  
> The final section is a spoken-word cheat-sheet for when an interviewer asks you.

---

## Table of Contents

1. [API Design — REST vs. GraphQL](#1-api-design--rest-vs-graphql)
2. [How an API Call Flows End-to-End](#2-how-an-api-call-flows-end-to-end)
3. [Database Design — Schema, Relational Tables & PostgreSQL](#3-database-design--schema-relational-tables--postgresql)
4. [Row-Level Locking — Race Conditions & SELECT FOR UPDATE](#4-row-level-locking--race-conditions--select-for-update)
5. [Caching with Redis — Hit, Miss, TTL & Invalidation](#5-caching-with-redis--hit-miss-ttl--invalidation)
6. [Rate Limiting — Sliding-Window Algorithm](#6-rate-limiting--sliding-window-algorithm)
7. [The Mastery-Score Algorithm](#7-the-mastery-score-algorithm)
8. [Load Testing with Locust](#8-load-testing-with-locust)
9. [Interview Cheat-Sheet — Say This Out Loud](#9-interview-cheat-sheet--say-this-out-loud)

---

## 1. API Design — REST vs. GraphQL

### The Concept (teach it from scratch)

Imagine you walk into a **restaurant**. There are two ways the kitchen can work:

**REST** is like a fixed menu. Every dish has its own page:
- Page 1 → Appetizers
- Page 2 → Main Course
- Page 3 → Desserts

You always get back the full page — even if you only wanted to know the price of one dessert, the waiter brings you the entire dessert-page menu.

**GraphQL** is like a custom-order counter. You walk up and say *"I want just the name and price of the cheesecake."* The kitchen gives back only and exactly what you asked for. One counter handles everything; you define the shape of the answer.

**Technical definitions (one line each):**
- **REST** (Representational State Transfer): An API style where each URL represents a *resource*, and HTTP verbs (GET, POST, PUT, DELETE) say what to do with it.
- **GraphQL**: A *query language for APIs* where the client describes exactly what data it needs in a single request to a single endpoint.
- **Endpoint**: A URL your backend listens on (e.g., `/api/dashboard`).
- **Schema (GraphQL)**: A typed contract that defines what data can be queried.

---

### Basic Example (no project context)

**REST way** to get a user's name and their posts:

```
GET /users/42          → returns the whole user object (id, name, email, phone, address...)
GET /users/42/posts    → returns all posts (title, body, date, likes...)
```

Two requests. You got way more data than you needed.

**GraphQL way:**

```graphql
query {
  user(id: 42) {
    name
    posts {
      title
    }
  }
}
```

One request. Returns only `name` and `posts.title`. Nothing else.

---

### How LeetMetrics Uses It

LeetMetrics uses **both** — for two totally different jobs:

**GraphQL (as a CLIENT, not a server):**
LeetCode does not have an official public REST API. Their website talks to their own GraphQL server internally. LeetMetrics reverse-engineered this and calls LeetCode's GraphQL endpoint directly.

The `LeetCodeClient` (`backend/app/services/leetcode_client.py`) sends GraphQL queries to `https://leetcode.com/graphql` with your session cookie to fetch:

1. **Problem metadata** (title, difficulty, topic tags) — using the `questionData` query
2. **Contest history** (ratings, rankings) — using the `userContestRankingInfo` query

```python
# From leetcode_client.py
query = """
query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId
    title
    difficulty
    acRate
    topicTags { name }
  }
}
"""
response = await self.client.post(
    self.GRAPHQL_URL,
    json={"query": query, "variables": {"titleSlug": title_slug}}
)
```

**REST (as a SERVER):**
LeetMetrics' own FastAPI backend exposes a REST API to the React frontend. The frontend calls standard REST endpoints like `GET /api/dashboard?username=foo` or `POST /api/sync`.

**The design choice in plain English:**
> "We talk to LeetCode using GraphQL (because that's what LeetCode's server speaks), but our own backend is a REST API (because it's simpler and sufficient for what our frontend needs)."

**Why GraphQL was chosen for LeetCode specifically:**
LeetCode's GraphQL endpoint lets us request exactly the fields we need. Their submission *history* is served via a REST endpoint (`/api/submissions/`), while problem details and contest data live on GraphQL. LeetMetrics uses each where it fits — there's no dogma, just pragmatism.

---

## 2. How an API Call Flows End-to-End

### The Concept

Think of an API call like **ordering a pizza by phone:**

1. **You (the browser/frontend)** dial the number and say what you want.
2. **The phone operator (FastAPI endpoint)** hears your order, validates it, and passes it to the kitchen.
3. **The kitchen (database query)** looks up the ingredients and prepares the response.
4. **The operator** packages the response and reads it back to you.

---

### Basic Example

A user visits a weather website and the page loads the temperature:

```
Browser → GET https://api.weather.com/city?name=Mumbai
  → Server receives request
    → Validates: is "name" present? Is it a real city?
      → Queries DB: SELECT temperature FROM cities WHERE name='Mumbai'
        → Returns: { "city": "Mumbai", "temp": 32 }
  → Browser renders "32°C"
```

---

### How LeetMetrics Uses It

**Full trace of `GET /api/dashboard?username=saumyashah05`:**

```
React Frontend (TanStack Query)
    |
    |  HTTP GET /api/dashboard?username=saumyashah05
    v
FastAPI App (main.py)
    |  app.include_router(analytics_router, prefix="/api")
    |
    v
@router.get("/dashboard")          <-- analytics_routes.py, line 211
    |
    |-- Step 1: Check Redis Cache
    |       redis.get("dashboard:saumyashah05")
    |       If HIT  → return immediately (~36ms) ← CACHE HIT
    |       If MISS → continue below             ← CACHE MISS
    |
    |-- Step 2 (Cache Miss): Resolve username to user_id
    |       SELECT id FROM users WHERE username = 'saumyashah05'
    |
    |-- Step 3: Run 3 SQL queries in sequence
    |       Query A: Top weaknesses  (mastery_scores JOIN dsa_curriculum)
    |       Query B: Recent 5 solves (submissions JOIN problems)
    |       Query C: Solved count by difficulty
    |
    |-- Step 4: Assemble JSON response dict
    |       { top_weaknesses, recent_solves, solved_stats }
    |
    |-- Step 5: Write to Redis (TTL = 300s)
    |       redis.set("dashboard:saumyashah05", json_data, ex=300)
    |
    v
Return JSON → TanStack Query caches on frontend too → UI renders
```

**Key components involved:**

| File | Role |
|---|---|
| `main.py` | Registers routers, starts/closes Redis on startup/shutdown |
| `database.py` | Provides async DB sessions via `get_db()` dependency injection |
| `analytics_routes.py` | Contains all query logic and Redis read/write |
| `redis.py` | Cache client, rate limiter |

**Dependency Injection** (one-liner): FastAPI's way of automatically creating and passing shared objects (like a DB session) to your route function — you declare `db: AsyncSession = Depends(get_db)` and FastAPI handles the lifecycle so you never manually open or close it.

---

## 3. Database Design — Schema, Relational Tables & PostgreSQL

### The Concept

A **database schema** is like the **architectural blueprint of a building**. Before you pour concrete, you decide: how many rooms, what size, how they connect.

In a database, the "rooms" are **tables**. Each table stores one *type of thing*:
- A `users` table stores people
- A `problems` table stores LeetCode problems
- A `submissions` table stores "who solved what, when"

**Relational** means tables can *reference each other* using IDs — like how a library card (user) links to borrowed books (submissions) via a borrower ID. You don't copy the user's name into every submission row — you store their ID, and JOIN when you need both.

**Technical definitions:**
- **Table**: A grid of rows and columns, like a spreadsheet tab.
- **Primary Key**: A unique ID for each row. No two rows can share it.
- **Foreign Key**: A column that points to another table's primary key — enforces that the reference must actually exist.
- **JOIN**: A SQL command that combines rows from two tables where IDs match.
- **UNIQUE constraint**: A rule that prevents duplicate values in a column (or combination of columns).
- **Index**: A sorted lookup structure on a column so the database doesn't scan every row — like a book's index page vs. reading every page.
- **UPSERT**: INSERT or UPDATE in a single statement — insert if not exists, update if it does.

---

### Basic Example

**Library system:**

```
books table:                    loans table:
+----+--------------+          +----+---------+---------+
| id | title        |          | id | book_id | user_id |
+----+--------------+          +----+---------+---------+
|  1 | Clean Code   |  <-----  |  1 |    1    |   42    |
|  2 | SICP         |          |  2 |    2    |   42    |
+----+--------------+          +----+---------+---------+

loans.book_id is a FOREIGN KEY pointing to books.id.
You cannot loan a book that doesn't exist in books.
```

---

### How LeetMetrics Uses It

**The full schema has 10 tables.** Here is the relationship map:

```
users
  |-- sync_logs          (1 user → many sync attempts)
  |-- submissions        (1 user → many solved problems)
  |-- mastery_scores     (1 user → 88 pattern scores, precomputed)
  |-- contest_history    (1 user → many contest participations)

problems
  |-- problem_curriculum_mapping  (many-to-many bridge to dsa_curriculum)
  |-- submissions                 (every submission references a problem)
  |-- company_questions           (which companies ask which problem)

dsa_curriculum             (88 DSA patterns in 17 major categories)
  |-- problem_curriculum_mapping
  |-- mastery_scores

contests
  |-- contest_history
```

**Key design decisions and why they were made:**

---

**Decision 1 — UUID primary keys instead of integers:**

```sql
-- schema.sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    ...
);
```

*Why UUIDs?* Integer IDs are sequential — if user #5 exists, someone can guess that users #1–#10 probably exist and probe them. UUIDs are 128-bit random values (`550e8400-e29b-41d4-a716-...`). They're collision-safe across distributed databases and harder to enumerate in attacks.

---

**Decision 2 — Many-to-many via a join table:**

```sql
CREATE TABLE problem_curriculum_mapping (
    problem_url_name TEXT    REFERENCES problems(url_name) ON DELETE CASCADE,
    curriculum_id    INTEGER REFERENCES dsa_curriculum(id) ON DELETE CASCADE,
    is_manual_override BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (problem_url_name, curriculum_id)   -- composite primary key
);
```

*Why?* One problem can belong to multiple patterns (e.g., "Two Sum" → Array Fundamentals AND Hash Map). One pattern has many problems. This is a **many-to-many** relationship. You can't put a list of curriculum IDs in a `problems` column — that violates relational normal form. The join table is the standard solution.

The composite `PRIMARY KEY (problem_url_name, curriculum_id)` automatically prevents duplicate mappings.

---

**Decision 3 — UPSERT with `ON CONFLICT`:**

```sql
-- analytics_engine.py, executed after every sync
INSERT INTO mastery_scores (user_id, curriculum_id, score, volume_score, ...)
VALUES (:user_id, :curriculum_id, :score, :volume_score, ...)
ON CONFLICT (user_id, curriculum_id)
DO UPDATE SET
    score = EXCLUDED.score,
    volume_score = EXCLUDED.volume_score,
    computed_at = NOW();
```

*What this does:* If a `mastery_scores` row for (user X, pattern Y) already exists — update it. If not — insert it. One query handles both create and update. The `UNIQUE (user_id, curriculum_id)` constraint on the table is what makes `ON CONFLICT` work.

`EXCLUDED` is a PostgreSQL keyword referring to the values you *tried* to insert before the conflict triggered.

---

**Decision 4 — Composite indexes for fast queries:**

```sql
CREATE INDEX idx_submissions_user_problem ON submissions(user_id, problem_url_name);
CREATE INDEX idx_submissions_timestamp    ON submissions(timestamp);
CREATE INDEX idx_mastery_scores_user_curr ON mastery_scores(user_id, curriculum_id);
```

Without `idx_submissions_user_problem`, this query:
```sql
SELECT * FROM submissions WHERE user_id = 'abc-123'
```
...would scan *every single submission in the table* (sequential scan = O(n)).

With the index, PostgreSQL jumps directly to the user's rows using a B-tree (O(log n)). Under 50 concurrent users, this difference is the gap between 2 seconds and 50ms.

---

**Decision 5 — JSONB for flexible topic tags:**

```sql
CREATE TABLE problems (
    url_name TEXT PRIMARY KEY,
    ...
    leetcode_topics JSONB    -- stores a list like ["Array", "Hash Table", "Sorting"]
);
```

`JSONB` (Binary JSON) stores a JSON blob efficiently in PostgreSQL. Since LeetCode topics vary per problem and we only need to store them (not query inside them), JSONB is simpler than creating a separate `topics` table.

---

**Decision 6 — Row Level Security (RLS):**

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_only" ON users
    FOR ALL USING (auth.role() = 'service_role');
```

This is a Neon/Supabase-style RLS policy. Only the backend's `service_role` connection can read or write these tables. Even if someone obtained a database URL with reduced privileges, they'd see empty results. A defense-in-depth measure.

---

## 4. Row-Level Locking — Race Conditions & SELECT FOR UPDATE

### The Concept

Imagine two bank tellers both look at your account at the same moment. Both see $100. Teller A processes your $80 withdrawal. Teller B processes your $80 withdrawal. Both succeed because they both read $100 before either wrote the new balance. Your account now shows -$60. **This is a race condition.**

A **race condition** is when two operations run simultaneously and interfere with each other because neither knew the other was happening.

A **lock** is like a "Do Not Disturb" sign on your account file. Teller A puts it there. Teller B must *wait* until the sign is removed before they can even look at the file.

**Row-level locking** means: instead of locking the entire database table (which would block everyone), you lock only the specific *row* you're modifying.

**Technical definitions:**
- **Race condition**: A bug that occurs when correctness depends on the relative timing of concurrent operations.
- **Transaction**: A group of database operations that succeed or fail together atomically.
- **`SELECT FOR UPDATE`**: A SQL command that reads a row AND locks it simultaneously. Other transactions trying to access the same row must wait until this transaction commits or rolls back.
- **Deadlock**: Two transactions each waiting for the other's lock — PostgreSQL detects this and aborts one automatically.

---

### Basic Example

```sql
-- Session A (Teller A)                 -- Session B (Teller B — BLOCKED)
BEGIN;
SELECT balance
FROM accounts
WHERE id = 42
FOR UPDATE;   <-- acquires lock         BEGIN;
                                        SELECT balance
                                        FROM accounts
                                        WHERE id = 42
                                        FOR UPDATE;  <-- WAITS HERE...

-- balance = 100
UPDATE accounts SET balance = 20 ...;
COMMIT;  <-- lock released
                                        -- Session B now gets the lock
                                        -- reads balance = 20 (correct!)
```

---

### How LeetMetrics Uses It

**The problem it solves:** If the same user opens LeetMetrics in two browser tabs and clicks "Sync" in both simultaneously, two background sync workers start for the same user. Both try to insert the same submissions. Result: duplicate rows, wasted LeetCode API calls, and DB connection pool exhaustion.

**The guarantee:**
```
Concurrent Sync Workers ≤ 1 per user at any time
```

**The implementation in `sync_engine.py`:**

```python
async def _init_user_and_log(self):
    # Step 1: First, ensure user exists (without a lock)
    result = await self.db.execute(
        select(User).where(User.username == self.username)
    )
    self.user = result.scalars().first()

    if not self.user:
        self.user = User(username=self.username, ...)
        self.db.add(self.user)
        await self.db.commit()

    # Step 2: NOW acquire the row-level lock
    result = await self.db.execute(
        select(User)
        .where(User.username == self.username)
        .with_for_update()          # <-- SELECT ... FOR UPDATE
    )
    self.user = result.scalars().first()

    # Step 3: With the lock held, check for existing active sync
    active_log = await self.db.execute(
        select(SyncLog).where(
            SyncLog.user_id == self.user.id,
            SyncLog.status == 'in_progress'
        )
    )
    active_log = active_log.scalars().first()

    if active_log:
        elapsed = (now - active_log.started_at).total_seconds()
        if elapsed < 15 * 60:
            raise ValueError("A sync is already in progress for this user.")

    # Step 4: Create a new sync_log marked 'in_progress'
    self.sync_log = SyncLog(user_id=self.user.id, status='in_progress')
    self.db.add(self.sync_log)
    await self.db.commit()   # <-- releases the lock
```

**Why not just check `sync_logs` without the lock?**

The check-then-act sequence is inherently unsafe:

```
Tab A: Check sync_logs → sees none → (about to insert)
Tab B: Check sync_logs → sees none → (about to insert)   ← RACE WINDOW
Tab A: Insert 'in_progress'
Tab B: Insert 'in_progress'  ← both succeeded! Bug!
```

The `FOR UPDATE` lock collapses the check + write into an atomic step. Tab B cannot read the user row until Tab A has committed its `in_progress` log entry. By the time Tab B proceeds, the `in_progress` record is already there, and Tab B aborts.

**Load test evidence:**  
Under 50 concurrent users hammering `/api/sync`, zero duplicate submission rows appeared in the database. The locking worked perfectly.

---

## 5. Caching with Redis — Hit, Miss, TTL & Invalidation

### The Concept

Imagine you're a librarian. Every time someone asks "What's the capital of France?", you walk to the back room, pull out the encyclopedia, find page 412, read "Paris," walk back, and tell them. That takes 30 seconds.

Now imagine you write "France → Paris" on a sticky note on your desk. Next time someone asks, you glance at the sticky note: 1 second. The answer is the same. Why repeat the 30-second walk?

**Redis is the sticky note.** It's an in-memory key-value store — a database that lives entirely in RAM (no disk). RAM is roughly 100× faster than reading from an SSD.

**Technical definitions:**
- **Cache**: Fast temporary storage holding copies of expensive-to-compute results.
- **Cache Hit**: The sticky note has the answer. Return immediately.
- **Cache Miss**: No sticky note yet. Do the slow work, write a note, return the answer.
- **TTL (Time-to-Live)**: How long before the sticky note automatically expires. Prevents serving outdated data indefinitely.
- **Cache Invalidation**: Deliberately discarding a cache entry because the underlying data changed — considered one of the hardest problems in computer science.
- **Redis**: Remote Dictionary Server — stores data as key-value pairs entirely in RAM. Supports strings, lists, sets, sorted sets, hashes.

---

### Basic Example

```python
def get_weather(city):
    cached = redis.get(f"weather:{city}")
    if cached:                              # Cache HIT (~1ms)
        return cached

    result = slow_weather_api(city)         # Cache MISS (~500ms)
    redis.set(f"weather:{city}", result, ex=3600)  # TTL = 1 hour
    return result
```

---

### How LeetMetrics Uses It

**The problem it solves:** The `/api/curriculum/{username}` endpoint runs 5+ heavy SQL queries with multiple JOINs — across 88 patterns, thousands of mapped problems, and all user submissions. Under load this takes **6,060ms** (over 6 seconds). That's completely unusable for a web app.

**The caching pattern (same for all cached endpoints):**

```python
@router.get("/curriculum/{username}")
async def get_curriculum(username: str, db: AsyncSession = Depends(get_db)):
    # --- STEP 1: Try the cache ---
    redis = get_redis_client()
    if redis:
        cached = await redis.get(f"curriculum:{username}")
        if cached:
            return json.loads(cached)   # CACHE HIT: ~300ms, no DB at all

    # --- STEP 2 (Cache Miss): Run all the expensive queries ---
    # ... 5+ SQL queries, JOINs, Python assembly logic ...
    curriculum_data = {"curriculum": result}   # Takes ~6,060ms

    # --- STEP 3: Store in cache for future requests ---
    await redis.set(
        f"curriculum:{username}",
        json.dumps(curriculum_data),
        ex=300             # TTL = 300 seconds (5 minutes)
    )

    return curriculum_data
```

**Complete cache key map:**

| Redis Key | TTL | What it stores | Where set |
|---|---|---|---|
| `dashboard:{username}` | 300s | Dashboard summary | `analytics_routes.py` line ~299 |
| `curriculum:{username}` | 300s | Full curriculum tree | `analytics_routes.py` line ~513 |
| `companies:list` | 3600s | List of 218 companies | `analytics_routes.py` line ~551 |
| `company_questions:{user}:{co}:{tf}` | 300s | Company question set | `analytics_routes.py` line ~678 |

**Cache Invalidation after sync:**

When a sync completes, the DB has new submissions. Old cache entries are now stale. They must be deleted so the next request gets fresh data:

```python
# sync_engine.py — runs right after a successful sync
redis = get_redis_client()
if redis:
    # Delete simple keys directly
    await redis.delete(f"dashboard:{self.username}")
    await redis.delete(f"curriculum:{self.username}")

    # Delete all company question caches for this user (wildcard pattern)
    async for key in redis.scan_iter(match=f"company_questions:{self.username}:*"):
        await redis.delete(key)
```

`scan_iter` is Redis's *safe* incremental key scanner. The alternative `KEYS *` would lock Redis for the entire scan — dangerous in production. `scan_iter` paginates through keys without blocking.

**The fail-open design:**

```python
def get_redis_client():
    if redis_client is None:
        if not settings.REDIS_URL:
            logger.warning("REDIS_URL not set. Bypassing Redis.")
            return None   # Returns None — callers check for None before using
    ...

# In every route:
if redis:          # None-check before every Redis call
    cached = await redis.get(...)
```

If Redis is down or misconfigured, `get_redis_client()` returns `None`. Every route checks for `None` before using Redis and skips gracefully to the DB. The application keeps working — just slower. No crash.

**Benchmark results under 50 concurrent users:**

| Endpoint | No Cache (DB) | With Cache (Redis) | Speedup |
|---|---|---|---|
| `/api/dashboard` | 2,430 ms | **36 ms** | **67.5×** |
| `/api/curriculum` | 6,060 ms | **300 ms** | **20.2×** |

Formula used:
```
Speedup Factor = Cache Miss Latency / Cache Hit Latency
              = 2430 / 36 = 67.5x
```

---

## 6. Rate Limiting — Sliding-Window Algorithm

### The Concept

Imagine a nightclub with a policy: **no one can enter more than 5 times per hour.**

A **fixed window** approach counts entries per hour-block: 12:00–1:00, 1:00–2:00, etc. Someone could enter 5 times at 12:59 and 5 more at 1:01 — that's 10 entries in 2 minutes. They gamed the boundary.

A **sliding window** approach says: at *any given moment*, look back exactly 60 minutes from *right now* and count. If you see 5+ entries in that rolling window, deny entry. The window slides forward in time with every request.

**Technical definitions:**
- **Rate limiting**: Restricting how many times a client can hit an endpoint within a time period.
- **Fixed window**: Counting in fixed time buckets. Fast to implement, vulnerable to burst at boundaries.
- **Sliding window**: Counting within a rolling lookback from the current moment. More precise, prevents boundary gaming.
- **HTTP 429**: The status code for "Too Many Requests."
- **Redis Sorted Set (ZSET)**: A Redis data structure where each member has a float *score*. Members are kept sorted by score. Used here: member = unique request ID, score = Unix timestamp. Enables O(log n) time-range queries.
- **Redis Pipeline**: Batching multiple Redis commands into one round-trip, optionally executed as an atomic transaction.

---

### Step-by-Step Walkthrough (limit = 3 per 60s)

```
t=10s  → Request arrives
         Remove entries older than t=10-60=-50s → removes nothing
         Count remaining = 0 < 3 → ALLOW
         Add {req-A: score=10} to ZSET

t=20s  → Request arrives
         Remove older than t=-40s → nothing
         Count = 1 < 3 → ALLOW
         Add {req-B: score=20}

t=30s  → Request arrives
         Remove older than t=-30s → nothing
         Count = 2 < 3 → ALLOW
         Add {req-C: score=30}

t=40s  → Request arrives
         Remove older than t=-20s → nothing removed (all entries > -20)
         Count = 3 >= 3 → DENY (429)

t=71s  → Request arrives
         Remove older than t=11s → removes req-A (score=10 < 11)
         Count = 2 < 3 → ALLOW
         Add {req-D: score=71}
```

---

### How LeetMetrics Uses It

**The problem it solves:** Without rate limiting, a malicious user (or even a Locust load test) could trigger hundreds of syncs per minute. Each sync calls LeetCode's API — LeetCode would IP-ban the server. Each sync also holds a database connection — unbounded syncs would exhaust the PostgreSQL connection pool, crashing all queries.

**The constraint:**
```
≤ 5 sync requests per user per 60 seconds
```

**The full implementation in `redis.py`:**

```python
class RateLimiter:
    def __init__(self, times: int = 5, minutes: int = 1):
        self.times = times           # 5 requests max
        self.seconds = minutes * 60  # per 60-second window

    async def __call__(self, request: Request):
        redis = get_redis_client()
        if not redis:
            return   # Fail-open: no Redis = no rate limiting (graceful)

        # Identify by username (parsed from request body) or fall back to IP
        body = json.loads(await request.body())
        identifier = f"sync:{body['username']}"  # e.g. "sync:saumyashah05"
        key = f"rate_limit:{identifier}"

        now = time.time()
        clear_before = now - self.seconds    # Everything before this is "too old"

        # ATOMIC STEP 1: Remove stale entries AND count in one pipeline
        async with redis.pipeline(transaction=True) as pipe:
            await pipe.zremrangebyscore(key, "-inf", clear_before)  # Remove old
            await pipe.zcard(key)                                    # Count remaining
            results = await pipe.execute()                           # Both at once

        current_count = results[1]   # Result of ZCARD

        # CHECK: Are we at the limit?
        if current_count >= self.times:
            raise HTTPException(status_code=429,
                detail="Rate limit exceeded. Maximum 5 sync requests per minute.")

        # ATOMIC STEP 2: Record this new request
        member = f"{now}-{uuid.uuid4()}"   # Unique ID (prevent ZSET score collisions)
        async with redis.pipeline(transaction=True) as pipe:
            await pipe.zadd(key, {member: now})        # Score = timestamp
            await pipe.expire(key, int(self.seconds))  # Auto-delete key after 60s
            await pipe.execute()
```

**Why `pipeline(transaction=True)` for the remove+count step?**
If two requests arrive simultaneously and you do these separately:
- Request A removes old entries
- Request B removes old entries
- Request A counts
- Request B counts (could see a different count than A!)

The pipeline with `transaction=True` sends both commands to Redis as one atomic unit — no other operation can interleave. Redis is single-threaded inside, so the pipeline is guaranteed sequential.

**How it's attached to the route (zero boilerplate):**

```python
# routes.py
@router.post(
    "/sync",
    dependencies=[Depends(RateLimiter(times=5, minutes=1))]
)
async def trigger_sync(request: SyncRequest, ...):
    ...
```

FastAPI runs `RateLimiter.__call__()` *before* `trigger_sync` even starts. If the limiter raises `HTTPException(429)`, `trigger_sync` never runs.

**Load test proof:**  
183 sync requests from 50 concurrent users → **178 blocked (97.3%)** with 429 responses.  
Only 5 per user per minute got through — mathematically correct.

---

## 7. The Mastery-Score Algorithm

### The Concept

If you solved 50 Binary Search problems 2 years ago and haven't touched them since, are you really good at Binary Search today? Probably not — human memory fades exponentially over time.

The mastery score is a **mathematical model of your *current* skill level** for each of the 88 DSA patterns. It accounts for three things:

1. **How many problems you solved** (volume — more is better, but with diminishing returns)
2. **How hard they were** (difficulty — a Hard problem proves more than an Easy)
3. **How recently you practiced** (recency — old practice decays, new practice restores)

The formula:
```
Final Score = (Volume Score + Difficulty Score) × Recency Multiplier
```

Each component uses an **asymptotic curve** — it grows toward a ceiling but never exceeds it. This reflects real learning: your 100th Binary Search problem adds almost nothing new that your 10th didn't.

---

### Component 1: Volume Score — `50 × (1 - e^(-n/k))`

Rewards solving more problems in a pattern, with diminishing returns.

- `n` = number of unique problems you solved in this pattern
- `k` = denominator = `max(total_problems_in_pattern × 0.25, 10.0)` — scales with bucket size

**Why `1 - e^(-x)`?**
- At x=0 (solved nothing): `1 - e^0 = 1 - 1 = 0` → score = 0
- As x→∞ (solved everything): `1 - e^(-∞) = 1 - 0 = 1` → score approaches 50
- The curve rises fast at first, then flattens — exactly like learning curves

**Worked example — "Sliding Window" pattern, 20 total problems:**

```
k = max(20 × 0.25, 10) = max(5, 10) = 10

n=0:   50 × (1 - e^0)        = 50 × 0.000 =  0.0
n=5:   50 × (1 - e^(-5/10))  = 50 × 0.394 = 19.7
n=10:  50 × (1 - e^(-10/10)) = 50 × 0.632 = 31.6
n=15:  50 × (1 - e^(-15/10)) = 50 × 0.777 = 38.9
n=20:  50 × (1 - e^(-20/10)) = 50 × 0.865 = 43.3
(solved 100% → boosted to 50.0 by small-bucket rule)
```

*Going from 0→10 solves gets you 31.6 points. The next 10 solves only add 11.7 more. The returns shrink.*

**Code:**
```python
# analytics_engine.py
volume_denominator = max(total_in_bucket * 0.25, 10.0)
volume_score = 50.0 * (1.0 - math.exp(-solved_count / volume_denominator))
```

---

### Component 2: Difficulty Score — `50 × (1 - e^(-W/40))`

Rewards solving harder problems, since they prove deeper understanding.

**Weights:**
- Easy = 1.0×
- Medium = 2.5×
- Hard = 5.0×

`W` = (easy_count × 1) + (medium_count × 2.5) + (hard_count × 5.0)

**Worked example:**

```
5 Easy only:   W = 5×1   = 5.0   →  50 × (1 - e^(-5/40))  =  5.9
5 Medium only: W = 5×2.5 = 12.5  →  50 × (1 - e^(-12.5/40)) = 13.4
5 Hard only:   W = 5×5   = 25.0  →  50 × (1 - e^(-25/40))  = 23.2

Mixed (2 Easy + 2 Medium + 1 Hard):
  W = (2×1) + (2×2.5) + (1×5) = 2 + 5 + 5 = 12
  → 50 × (1 - e^(-12/40)) = 50 × 0.259 = 12.9
```

*5 Hard problems scores 23.2. 5 Easy problems scores only 5.9. The algorithm incentivizes stretching into harder problems.*

**Code:**
```python
total_weight = (easy_count * 1) + (medium_count * 2.5) + (hard_count * 5.0)
difficulty_score = 50.0 * (1.0 - math.exp(-total_weight / 40.0))
```

---

### Component 3: Recency Multiplier — `e^(-λ × days)`

This is **exponential decay** — the same mathematical model used for radioactive decay, drug metabolism, and memory science (the "forgetting curve").

- λ (lambda) = 0.001 — the decay rate constant
- `days` = days since your most recent practice session in this pattern

**Worked example:**

```
Practiced today (0 days):    e^(-0.001 × 0)   = 1.000  (100% — full multiplier)
Practiced 30 days ago:       e^(-0.001 × 30)  = 0.970  (97%)
Practiced 6 months (180d):   e^(-0.001 × 180) = 0.835  (83.5%)
Practiced 1 year (365d):     e^(-0.001 × 365) = 0.694  (69.4%)
Practiced 2 years (730d):    e^(-0.001 × 730) = 0.482  (48%)
```

**The `max()` trick:**
```python
# analytics_engine.py
decay_values = []
for practice_day in unique_practice_days:
    days = max(0, (now - practice_day).days)
    decay_values.append(math.exp(-0.001 * days))

recency_multiplier = max(decay_values)  # Take the MOST RECENT practice day
```

`max()` means your recency score is driven by your *most recent* practice day. Solving even one problem today immediately snaps the multiplier back to 1.0 — modeling how refreshing your memory on even one problem reactivates the whole pattern.

**Why unique practice *days*, not unique submissions?**  
```python
practice_days = set()
for ts in submission_timestamps:
    practice_days.add(ts.date())   # Only the DATE, not datetime
```
Submitting the same problem 20 times in one day counts as **one practice day**. This prevents score inflation from automated spam submissions.

---

### Full Worked Example End-to-End

**Pattern: "Binary Search", 30 total problems**  
**You solved:** 3 Easy, 2 Medium, 1 Hard  
**Last practiced:** 60 days ago

```
Step 1 — Volume Score:
  n = 6, k = max(30 × 0.25, 10) = 10
  volume_score = 50 × (1 - e^(-6/10))
               = 50 × (1 - 0.5488)
               = 50 × 0.4512
               = 22.56

Step 2 — Difficulty Score:
  W = (3×1) + (2×2.5) + (1×5) = 3 + 5 + 5 = 13
  difficulty_score = 50 × (1 - e^(-13/40))
                   = 50 × (1 - 0.7225)
                   = 50 × 0.2775
                   = 13.88

Step 3 — Recency Multiplier:
  days = 60
  recency = e^(-0.001 × 60) = e^(-0.06) = 0.9418

Step 4 — Final Score:
  (22.56 + 13.88) × 0.9418
  = 36.44 × 0.9418
  = 34.32 / 100
```

Now if you solve a Hard problem *today*:
```
Recency: e^(-0.001 × 0) = 1.0       (snaps back to full)
New W = 13 + 5 = 18
difficulty_score = 50 × (1 - e^(-18/40)) = 50 × 0.362 = 18.1
n = 7 (one more unique problem)
volume_score = 50 × (1 - e^(-7/10)) = 50 × 0.503 = 25.15

Final = (25.15 + 18.1) × 1.0 = 43.25 / 100
```

One Hard problem today jumps your score from **34.3 → 43.3** — a ~26% improvement.

---

## 8. Load Testing with Locust

### The Concept

Before a bridge opens, engineers don't just hope it holds. They drive heavy trucks across it — deliberately stressing it — to find the breaking point *before* real traffic arrives.

**Load testing** is the same idea for software. You simulate many users hitting your API simultaneously to answer:
- At what load does response time degrade?
- At what load does the system break entirely?
- Are the caches, rate limiters, and locks actually working as designed?

**Technical definitions:**
- **Concurrent users**: Multiple users making requests *at the same time* (not sequentially).
- **Requests per second (RPS)**: Throughput — how many requests the server handles every second.
- **Spawn rate**: How quickly new virtual users are added during ramp-up (e.g., 5 users per second).
- **p50 / Median latency**: The time where half of all requests are faster and half are slower. Represents the *typical* user experience.
- **p95 latency**: 95% of requests are faster than this. Reveals worst-case tail latency.
- **Locust**: A Python load testing framework where you define user behavior as Python classes and tasks.

---

### How to Interpret p50

If you have 100 requests with these response times:
```
50 requests: 20ms–50ms     (fast — cache hits)
40 requests: 200ms–500ms   (moderate)
10 requests: 1000ms–3000ms (slow — cache misses or DB heavy queries)

p50 = the 50th fastest value = ~50ms  (half are faster)
p95 = the 95th fastest value = ~500ms (5% are slower)
```

A low p50 with a high p95 means: most users are fine, but a small fraction have a terrible experience. Usually caused by cache misses hitting the DB cold.

---

### How LeetMetrics Uses It

**The `locustfile.py`:**

```python
class LeetMetricsLoadTestUser(HttpUser):
    wait_time = between(1, 3)  # Each virtual user waits 1-3s between tasks (realistic)

    @task(4)    # Runs 4x more often — users check dashboard frequently
    def view_dashboard(self):
        self.client.get("/api/dashboard?username=saumyashah05")

    @task(2)    # Runs 2x more often — users browse curriculum occasionally
    def view_curriculum(self):
        self.client.get("/api/curriculum/saumyashah05")

    @task(1)    # Runs least often — syncing is a deliberate action
    def trigger_sync(self):
        self.client.post("/api/sync", json={
            "session_cookie": "LEETCODE_SESSION=dummy",
            "username": "saumyashah05"
        })
```

**Task weights (4:2:1)** model real user behavior. The load test is realistic, not just a worst-case hammer.

**How to run:**

```bash
# Terminal 1: Start the backend
python run.py

# Terminal 2: Start Locust
cd backend
.\venv\Scripts\activate
locust

# Open http://localhost:8089
# Users: 50  |  Spawn rate: 5  |  Host: http://localhost:8000
# Click Start
```

**Results from the 50-user test:**

| Endpoint | Requests | Failures | Median (p50) | p95 |
|---|---|---|---|---|
| GET `/api/dashboard` | ~400 | 0 | **36 ms** | ~70 ms |
| GET `/api/curriculum` | ~200 | 0 | **300 ms** | ~400 ms |
| POST `/api/sync` | 183 | **178 (97.3%)** | — | — |

**How to explain each number:**

**Dashboard p50 = 36ms:**
The first request (cache miss) hits the DB in ~2,430ms. Redis caches the response for 300 seconds. Every subsequent request from any of the 50 users returns in ~36ms from Redis. *This confirms the cache is working and the math (67.5x speedup) is real.*

**Curriculum p50 = 300ms (not 36ms):**
The curriculum payload is a large JSON (~100KB+) — even a cache hit involves deserializing and transmitting a bigger object. Still 20× faster than the 6,060ms DB path.

**Sync failures = 97.3%:**
In Locust, any non-2xx response counts as a "failure." These are all HTTP 429 responses from the rate limiter — which is *correct* behavior. 178 out of 183 sync attempts were blocked. Only the mathematically allowed 5 per user per minute got through. *This confirms the rate limiter is working.*

**The chart pattern:**
- The response time graph shows a spike on the very first requests (cold cache misses), then flatlines to near-zero once Redis warms up — visual proof that caching kicks in under load.
- The RPS graph shows a "failures" spike that represents the 429s, not real errors.

**What the load test verified in total:**
- ✅ Redis caching delivers 67.5× speedup under concurrency
- ✅ Rate limiter correctly blocks 97.3% of excess sync calls
- ✅ Row-level locking prevents duplicate submissions (zero DB corruption found)
- ✅ System handles 50 concurrent users without crashing or DB connection pool exhaustion

---

## 9. Interview Cheat-Sheet — Say This Out Loud

> These are the precise spoken-word answers. Practice reading each one aloud until it feels natural. These cover the questions an interviewer is most likely to ask.

---

**Q: "Tell me about REST vs GraphQL. Why did you use both?"**

A: "REST uses different URL endpoints for different resources and returns whatever the server decides to return. GraphQL uses one endpoint where the *client* specifies exactly which fields it needs. In LeetMetrics, I consume LeetCode's GraphQL API because their server only speaks GraphQL — I can ask for exactly the fields I need, like title, difficulty, and topic tags, without getting back extra bloat. My own FastAPI backend is REST, because it's simpler and the frontend's data needs are predictable and fixed."

---

**Q: "Walk me through how a request flows in your system."**

A: "The React frontend makes an HTTP GET to FastAPI. FastAPI first checks Redis — if there's a cached result, it returns immediately in under 50 milliseconds. If not, it's a cache miss: it runs SQL queries against PostgreSQL using SQLAlchemy's async session, assembles a JSON response, writes it to Redis with a five-minute TTL, then returns it to the client. After a user syncs new submissions, the sync engine explicitly deletes the relevant Redis keys so stale data is never served."

---

**Q: "What is a database schema? Explain the one in this project."**

A: "A schema is the blueprint of the database — it defines every table, every column's data type, and the foreign key relationships between tables. LeetMetrics has 10 tables. The core data model is: users have many submissions, submissions reference problems, and problems are many-to-many mapped to 88 DSA patterns via a join table called `problem_curriculum_mapping`. Mastery scores are pre-computed and stored in a `mastery_scores` table — one row per user per pattern — updated by an UPSERT after every sync."

---

**Q: "What is a race condition, and how did you handle it?"**

A: "A race condition is when two concurrent operations both read the same shared state, act on it independently, and produce an incorrect result because neither saw the other's changes. In LeetMetrics, if you sync from two browser tabs simultaneously, both workers could try to insert the same submissions, creating duplicates. I solved this with PostgreSQL's `SELECT FOR UPDATE`. When a sync starts, it acquires a row-level lock on the user's row. The second sync blocks, waits for the lock, then reads an `in_progress` sync log entry already committed by the first sync, and aborts cleanly. This guarantees at most one sync worker per user at any time."

---

**Q: "Explain caching. What is TTL? What is cache invalidation?"**

A: "Caching stores the result of an expensive computation in fast memory — Redis in this case — so future requests skip the expensive work. TTL, Time-to-Live, is how long the cached result stays valid before Redis automatically discards it. After five minutes, the next request re-runs the DB queries and refreshes the cache. Cache invalidation is proactively deleting a cache entry when you *know* the underlying data changed — in LeetMetrics, immediately after a sync completes, we delete all that user's cache keys so their next dashboard load shows the new submissions, not five-minute-old data."

---

**Q: "What is rate limiting? How does the sliding window work?"**

A: "Rate limiting caps how many requests a client can make in a given time period, protecting both your backend and any downstream APIs. The sliding window algorithm stores each request's Unix timestamp in a Redis sorted set. When a new request arrives, I first remove all entries older than 60 seconds — this is the slide — then count what remains. If it's five or more, I return 429. This avoids the boundary problem of fixed windows, where someone could send five requests at 11:59 and five more at 12:01. In LeetMetrics, under 50 concurrent users, 97.3% of sync requests were correctly blocked as rate-limited."

---

**Q: "Explain the mastery score algorithm. What is exponential decay?"**

A: "The mastery score has three components. Volume score uses a saturation curve — fifty times one minus e to the negative n over k — which rewards solving more problems but with diminishing returns, so the twentieth solve matters less than the second. Difficulty score weights Hard problems five times more than Easy ones, using the same curve shape, incentivizing harder problems. Recency multiplier applies exponential decay — e to the negative lambda times days — where lambda is 0.001. This means a pattern you practiced two years ago is worth roughly 48% of its full value, while anything practiced today is worth 100%. One new solve today snaps the multiplier back to 1.0 instantly, modelling how refreshing your memory reactivates prior knowledge. The final score is volume plus difficulty, multiplied by recency."

---

**Q: "What is load testing? How do you read a p50 latency number?"**

A: "Load testing simulates many concurrent users hitting an API simultaneously to verify it holds up under real traffic and that your optimizations actually work. p50, the median latency, means half of requests completed faster than that number — it's the typical experience. In LeetMetrics, under 50 concurrent users, the dashboard p50 was 36 milliseconds because Redis was serving cached responses. The very first request on a cold cache takes 2,430 milliseconds, but all subsequent requests from any user hit Redis and return in 36 milliseconds. The 97% sync failure rate in the load test is actually correct — those are rate-limit 429 responses, proving the rate limiter was working exactly as designed."

---

*Document prepared from a complete source review of LeetMetrics backend.*  
*Files reviewed: `sync_engine.py`, `analytics_engine.py`, `redis.py`, `database.py`, `analytics_routes.py`, `routes.py`, `leetcode_client.py`, `schema.sql`, `locustfile.py`, `main.py`, `README.md`, `SYSTEM_DESIGN.md`*

*Built by Saumya Shah — LeetMetrics v1.0*
