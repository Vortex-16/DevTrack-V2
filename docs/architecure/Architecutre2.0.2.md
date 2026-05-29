


SYSTEM ARCHITECTURE DOCUMENT
DevTrack Hackathon Mode
Advanced Backend Architecture — Scoring Intelligence & Pipeline Design
Version 2.0  |  Confidential
Architecture Team  |  May 2026




1. Executive Summary
DevTrack Hackathon Mode is a code-progress intelligence platform that ingests GitHub activity, filters noise, and produces structured scoring intelligence for organizers, mentors, and judges. This document defines the advanced backend architecture with particular emphasis on:
•	Efficient, non-blocking commit analysis pipeline
•	Deterministic + AI-hybrid scoring engine
•	Security-first design with RBAC, webhook verification, and audit trails
•	Data layer optimized for real-time dashboard queries
•	Queue-based async processing that scales without blocking

Layer	Technology	Purpose
Frontend	Next.js + TypeScript	Role-based dashboards, live SSE updates
API Gateway	NestJS / Express	Auth, RBAC, validation, rate limiting
Worker Layer	BullMQ + Redis	Async commit ingestion, AI analysis, sync
Database	PostgreSQL 15+	Transactional data, scoring, audit logs
Cache / Queue	Redis 7+	Job queues, session cache, pub/sub
Object Storage	S3-compatible	Raw diffs, CSVs, generated reports
AI Inference	Claude / hosted model	Commit classification and summarization
Observability	Prometheus + Grafana	Metrics, alerting, queue health

2. Commit Analysis Pipeline
The pipeline is designed webhook-first with zero blocking. Every webhook returns HTTP 200 immediately and delegates all processing to queued workers.
2.1 End-to-End Flow
Step	Stage	Detail	Latency Target
1	Webhook Received	GitHub push hits POST /api/webhooks/github. HMAC-SHA256 signature verified before any processing. Timestamp checked to reject replays > 5 minutes old.	< 50ms
2	Enqueue Ingest Job	Verified payload pushed to BullMQ commit.ingest queue (priority HIGH). HTTP 200 returned immediately to GitHub — no blocking on diff fetch.	< 10ms
3	Fetch Full Diff	Worker calls GitHub API for commit metadata + file diffs. Result cached in Redis (key: commit:{sha}:diff, TTL 60s) to absorb burst events on same commit.	100-400ms
4	File Relevance Filter	Each changed file scored 0.0–1.0 using deterministic rule set. Files scoring below threshold (0.4) discarded before any AI call. Scores cached by file path hash.	< 20ms
5	Code Chunking	Relevant diffs split into chunks of max 800 tokens with 50-token overlap for context continuity. Each chunk tagged with file path and function context.	< 30ms
6	AI Classification	Chunks sent to AI inference endpoint with strict JSON output schema. Each chunk receives: commit_type, summary, feature_tag, progress_value, risk_flag, confidence.	500ms-2s
7	Score Calculation	Deterministic scoring model applied using AI output as advisory input. Weighted formula combines implementation, test, breadth, consistency, and quality dimensions.	< 15ms
8	Persist + Notify	Results written to commits, file_changes, analysis_results tables in a single transaction. Redis pub/sub notifies dashboard SSE handlers. Cache keys invalidated.	< 50ms

2.2 File Relevance Filter
Applied deterministically before AI is ever invoked. Saves tokens, reduces latency, and ensures AI only sees meaningful code changes.
File Pattern / Type	Score	Rationale
Source code (.ts, .js, .py, .go, .rs, .java)	+0.9	Core implementation — highest signal
Test files (*spec*, *test*, __tests__/)	+0.8	Test coverage is a key quality indicator
Schema / migration files	+0.8	Data model changes represent feature progress
Route / controller / handler files	+0.7	API surface changes indicate feature work
Configuration files (.env.example, *.yaml)	+0.5	Infrastructure changes — moderate signal
Documentation (.md, README, .txt)	+0.3	Low but non-zero — context for reviewers
package-lock.json / yarn.lock / poetry.lock	−1.0	Pure noise — no engineering signal
node_modules/, vendor/, .venv/	−1.0	Dependencies — must never be scored
dist/, build/, coverage/, .next/	−1.0	Build artifacts — generated, not authored
*.min.js, *.bundle.*, *.map	−1.0	Minified/generated output
Binary files, images, fonts	−0.8	Non-code assets (unless it's a UI feature commit)
Formatting-only changes (whitespace delta)	−0.6	Detected by diff analysis — cosmetic risk flag

2.3 Queue Architecture
Queue Name	Workers	Priority	Retry Policy	Notes
commit.ingest	5 concurrent	HIGH	3x, exp backoff	Entry point for all GitHub events
commit.ai-analyze	3 concurrent	HIGH	2x, 5s delay	Calls AI inference — limited concurrency
repo.sync	2 concurrent	MEDIUM	3x, 30s delay	Scheduled / on-demand full sync
report.generate	1 concurrent	LOW	1x, no retry	Organizer-triggered, non-critical path
dead.letter	1 monitor	ALERT	Manual review	Failed jobs after all retries exhausted

3. Progress Scoring Engine
The scoring model is deterministic at its core. AI output is advisory — it provides progress_value (0.0–1.0) and confidence signals that feed multipliers, but the final score is always computed by the deterministic layer.
3.1 Scoring Formula
score = Σ(dimension_score × weight) × relevance_multiplier × ai_confidence_factor
team_score = rolling_average(commit_scores, window=7d) × consistency_bonus

3.2 Score Dimensions
Dimension	Weight	Input Signal	Calculation
Implementation Progress	35%	Relevant source files changed, additions, complexity delta	meaningful_lines / max_meaningful_lines × 100
Test Coverage Delta	20%	Test files added/modified, coverage % change if available	test_file_count × 20 + coverage_gain × 80
Code Breadth	15%	Number of distinct domains (backend, frontend, DB, API) touched	distinct_domains × 25, capped at 100
Consistency	15%	Commit cadence over hackathon duration, commit distribution	cadence_score = 1 - std_dev(commit_gaps) / total_duration
Quality Signals	15%	AI confidence score, commit message quality, PR descriptions	ai_confidence × 60 + message_quality × 40

3.3 Anomaly Detection Rules
All anomalies are flagged automatically and surfaced to organizers for manual review. Anomalies reduce the ai_confidence_factor but do not directly override the score — the organizer decides.
Anomaly Pattern	Signal Type	Severity	Auto Action
Mass file additions with zero logical change (line count >> meaningful changes)	Padding	CRITICAL	Flag commit, reduce confidence to 0.1, alert organizer immediately
100% whitespace/formatting diffs, no semantic change	Cosmetic	HIGH	Label commit_type=chore, apply 0.2× multiplier
Identical or near-identical commits repeated (>80% similarity)	Duplicate	CRITICAL	Deduplicate scoring, flag team for review
AI confidence < 0.3 across all files in a commit	Low Signal	MEDIUM	Score computed but confidence_factor = 0.5
Commit burst in final 30 minutes of hackathon (> 40% of total commits)	Cramming	MEDIUM	Flag pattern, apply 0.7× to burst commits
All changes in lockfiles, generated code, or assets only	Pure Noise	LOW	Score = 0, no penalty to team total
No test changes after significant backend feature (> 200 LOC)	Quality Risk	LOW	Advisory note on AI summary only

3.4 AI Prompt Contract
The AI receives a structured prompt per code chunk. It must return valid JSON only — no prose, no markdown. The backend validates the schema before using any values.
// Input sent to AI per chunk
{ commit_sha, repo_name, file_path, change_type, diff_chunk, team_context, previous_summary }

// Required JSON output (schema-validated before use)
{
  "commit_type": "feature" | "fix" | "refactor" | "test" | "docs" | "chore",
  "summary": "string (max 120 chars)",
  "feature_tag": "string | null",
  "progress_value": 0.0 – 1.0,
  "risk_flag": "none" | "padding" | "cosmetic" | "anomaly",
  "confidence": 0.0 – 1.0
}

4. Security Architecture
4.1 Authentication & Session Management
Mechanism	Implementation Detail
JWT Access Tokens	15-minute TTL. Signed with RS256 (asymmetric). Payload includes user_id, role, hackathon_scope. Never stored in localStorage — memory only.
Refresh Tokens	7-day TTL. Stored in httpOnly, Secure, SameSite=Strict cookie. Rotated on every use. Old token invalidated immediately after rotation.
Password Hashing	Argon2id with memory=65536, iterations=3, parallelism=4. Never MD5/SHA1/bcrypt.
GitHub Integration	GitHub App preferred over OAuth tokens. App installation tokens scoped per repository. Access tokens AES-256-GCM encrypted at rest.
Session Revocation	Active token list maintained in Redis. On logout or role change, token hash added to deny list (TTL = remaining token lifetime).

4.2 RBAC Permissions Matrix
Action	Participant	Organizer	Judge	Admin
Sign in / register	Yes	Yes	Yes	Yes
Join team / connect GitHub	Yes	No	No	No
View own progress dashboard	Yes	No	No	No
View all team progress	Own team only	Yes	Yes	Yes
Upload CSV / create hackathon	No	Yes	No	Yes
Trigger repo sync	Limited	Yes	No	Yes
View AI summaries	Own/team only	Yes	Yes	Yes
Review / dismiss anomalies	No	Yes	No	Yes
Configure scoring weights	No	Yes	No	Yes
Export reports	No	Yes	Yes	Yes
View audit logs	No	No	No	Yes
Manage users & roles	No	No	No	Yes

4.3 Webhook Security
Control	Implementation
Signature Verification	HMAC-SHA256 of raw payload using webhook secret. Constant-time comparison (crypto.timingSafeEqual) to prevent timing attacks. Reject if missing.
Replay Protection	X-GitHub-Delivery header (UUID) stored in Redis with 5-minute TTL. Duplicate delivery IDs rejected with 409 Conflict.
Timestamp Validation	X-GitHub-Event timestamp checked. Reject events older than 5 minutes to prevent replay of captured requests.
Rate Limiting	100 requests/minute per source IP on webhook endpoint. Excess returns 429 Too Many Requests without processing payload.
Deduplication	commit SHA checked against Redis dedup set (TTL 5min) before enqueuing. Duplicate webhooks for same commit silently dropped.

4.4 Rate Limiting Policy
Endpoint	Limit	Window	Scope
POST /api/auth/login	5 requests	1 minute	Per IP address
POST /api/auth/signup	3 requests	10 minutes	Per IP address
POST /api/webhooks/github	100 requests	1 minute	Per source IP
POST /api/analysis/*	10 requests	1 minute	Per team
POST /api/hackathons/:id/imports/csv	3 requests	1 minute	Per user
GET /api/*/progress	60 requests	1 minute	Per authenticated user
All other endpoints	200 requests	1 minute	Per authenticated user

5. Data Layer Design
5.1 Additional Critical Tables
The following tables extend the base schema and are required for efficient scoring, trend analysis, and anomaly workflows.
Table	Key Columns	Purpose
team_progress_snapshots	team_id, snapshot_at, total_score, implementation_score, test_score, consistency_score, anomaly_count, risk_level	Point-in-time score snapshots taken after each commit analysis. Enables trend charts and progress over time. Never deleted — append-only.
scoring_weights	hackathon_id, dimension, weight, version, created_by, created_at	Organizer-configurable dimension weights per hackathon. Versioned so historical scores remain reproducible with original weights.
anomaly_events	commit_id, team_id, anomaly_type, severity, auto_detected, reviewed_by, resolution, created_at	Tracks all detected anomalies with full review workflow. Status: OPEN, REVIEWED, DISMISSED. Immutable once resolved.
file_relevance_cache	file_path_hash, repo_id, relevance_score, rule_breakdown_json, computed_at	Caches relevance scores by file path hash to avoid recomputing on repeated file patterns. TTL-invalidated on rule version bump.

5.2 Indexing Strategy
Index Definition	Query Pattern Served
commits(repository_id, committed_at DESC)	Timeline queries on repository — dashboard commit list
commits(author_username, committed_at)	Per-participant history and activity timeline
file_changes(commit_id, relevance_score DESC)	Fast filter of relevant files per commit
analysis_results(repository_id, created_at DESC)	Recent AI results per repository
anomaly_events(team_id, severity, created_at)	Risk dashboard — open anomalies by team
team_progress_snapshots(team_id, snapshot_at DESC)	Score trend graph data per team
audit_logs(actor_user_id, created_at DESC)	User-specific audit trail export
commits(sha) UNIQUE	Deduplication on ingest — prevent double processing

5.3 Redis Cache Patterns
Cache Key Pattern	TTL	Purpose & Invalidation
team:{id}:progress	30s	Live dashboard score. Invalidated via pub/sub after each scoring run.
hackathon:{id}:ranking	60s	Leaderboard. Invalidated on any team score update in hackathon.
repo:{id}:commits:page:{n}	120s	Paginated commit list. Invalidated on new commit ingestion.
user:{id}:session	15min	JWT session validation cache. Cleared on logout/revocation.
webhook:dedup:{delivery_id}	5min	Replay deduplication. Auto-expires.
ai:result:{commit_sha}	24h	AI analysis result cache. Prevents redundant AI calls on re-sync.
file_relevance:{path_hash}	1h	File scoring cache. Invalidated on rule version change.
rate_limit:{endpoint}:{ip}	1min	Sliding window counter. Auto-expires per window.

6. API Design Patterns
6.1 Response Envelope Standard
All endpoints return a consistent envelope. Never return raw objects.
// Success response
{ "ok": true, "data": { ... }, "meta": { "page": 1, "total": 42, "limit": 20 } }

// Error response
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": [] } }

6.2 Error Code Registry
Error Code	HTTP	When Thrown
AUTH_REQUIRED	401	Missing, expired, or revoked access token
FORBIDDEN	403	Authenticated user lacks role permission for this resource
NOT_FOUND	404	Resource does not exist or is not in user's scope
VALIDATION_ERROR	422	Request body fails Zod schema validation
CSV_INVALID	422	Uploaded CSV fails structure or required column check
WEBHOOK_SIG_FAIL	401	GitHub webhook signature verification failed
WEBHOOK_REPLAY	409	Duplicate delivery ID detected within 5-minute window
REPO_LIMIT	429	GitHub API rate limit hit — retry after header provided
ANALYSIS_QUEUE_FULL	503	BullMQ worker backlog exceeds threshold
HACKATHON_NOT_ACTIVE	400	Operation attempted on non-active hackathon

6.3 Core Scoring & Analysis Endpoints
Method	Path	Auth	Description
GET	/api/teams/:id/progress	Organizer+	Live score with full dimension breakdown and trend delta
GET	/api/hackathons/:id/ranking	All	Team leaderboard ordered by total_score
GET	/api/teams/:id/snapshots	Organizer+	Score trend over time for charts
POST	/api/analysis/commit	Worker	Trigger manual analysis on a specific commit SHA
GET	/api/analysis/commit/:id	Organizer+	Full AI result, risk flags, confidence, file breakdown
GET	/api/teams/:id/anomalies	Organizer+	Anomaly event list filtered by severity
PATCH	/api/teams/:id/anomalies/:aid	Organizer	Review or dismiss an anomaly event
POST	/api/hackathons/:id/scoring-weights	Organizer	Set custom dimension weights for this hackathon
GET	/api/hackathons/:id/overview	Organizer+	Aggregate stats: active teams, stalled teams, risk flags
POST	/api/reports/generate	Organizer+	Queue async PDF/CSV report generation

6.4 Real-Time Delivery (SSE + Redis Pub/Sub)
Dashboard updates are delivered via Server-Sent Events on a per-hackathon channel. After each scoring run, the worker publishes to Redis. The API SSE handler subscribes and streams diffs to connected clients. Fallback: 30-second polling if SSE connection drops.
SSE Endpoint / Channel	Event Type	Payload
GET /api/sse/hackathon/:id → hackathon:{id}:scores	score.updated	{ team_id, new_score, delta, dimension_breakdown }
GET /api/sse/hackathon/:id → hackathon:{id}:anomalies	anomaly.detected	{ team_id, anomaly_type, severity, commit_sha }
GET /api/sse/team/:id → team:{id}:commits	commit.processed	{ commit_sha, summary, progress_value, risk_flag }

7. MVP Delivery Phases
Phase	Name	Deliverables	Duration
Phase 1	Core Tracking	Auth + RBAC, CSV import, team creation, repo connection, commit ingestion, file relevance filter, basic dashboard	2–3 weeks
Phase 2	Intelligence Layer	AI analysis integration, scoring engine (all 5 dimensions), anomaly detection, team comparison views, score snapshots	2–3 weeks
Phase 3	Organizer Operations	Judge/mentor views, report export (PDF/CSV), event analytics, scoring weight configuration, submission review	1–2 weeks
Phase 4	Scale & Reliability	Webhook hardening, retry policies, dead-letter monitoring, multi-hackathon support, observability dashboards, backup routines	1–2 weeks

8. Key Design Principles
1. Track useful work, not activity.
Count meaningful engineering progress. Noise reduction before AI analysis is more efficient than filtering after.
2. Deterministic rules own the score.
AI provides advisory signals (progress_value, confidence). The formula is always deterministic. This makes scores auditable and reproducible.
3. Never block a webhook.
Return 200 immediately. All processing is async. GitHub will retry on non-200 — duplicates are handled by dedup logic, not by being slow.
4. Cache aggressively, invalidate precisely.
Dashboard reads are far more frequent than write events. Cache everything with tight TTLs. Use pub/sub invalidation — not polling.
5. AI only where interpretation is needed.
AI is expensive. File relevance filtering, score calculation, deduplication, and webhook verification are all deterministic. AI enters only at the classification and summarization step.
6. Separate read from write.
Dashboard queries run against read replicas or Redis cache. Write operations (ingest, scoring, analysis) never compete with dashboard loads.
7. Anomalies advise, humans decide.
Automatic detection flags suspicious patterns. Organizers review and resolve. The system never silently penalizes a team — every flag is transparent.
8. Store secrets correctly.
AES-256-GCM for tokens at rest. Argon2id for passwords. Never log secrets. Never commit .env files. Rotate keys on any suspected exposure.

