
DevTrack V2
Full System Architecture
The Engineering Growth Operating System
Version	3.0 — Identity Edition
Status	Architecture Design Phase
Scope	Free Tier + Identity Layer + Scale Path
Author	Staff Engineering
 


 
1.  The Identity Architecture Vision
GitHub tracks repositories. DevTrack tracks the engineer behind them. That is the category-defining idea, and everything in this architecture serves it.
The V2 architecture extends the solid free-tier foundation (NestJS, Neon, Clerk, Groq) with a new Intelligence Layer — a set of domain modules that transform raw GitHub and learning data into longitudinal developer identity. This is not analytics on top of GitHub. It is a developer growth operating system.

The Three-Layer Model
Layer	What it does	Key modules	Owned data
Data Ingestion	Collects raw signals from GitHub, learning logs, tasks, sessions	github/, learning/, jobs/	CommitStat, LearningLog, GitHubRepo
Intelligence	Derives meaning — scores, graphs, DNA, memory, momentum	intelligence/	DeveloperGraph, ProjectDNA, BuildMemory, SkillConfidence
Identity	Synthesizes into a persistent developer profile, reputation, and portfolio	identity/, profiles/	DeveloperReputation, EngineeringTimeline, CareerSnapshot

Positioning: "Your engineering growth operating system." Not a dashboard. Not a GitHub clone. An identity layer that follows every developer's evolution.

2.  Core Identity Feature Stack
The eight features below form the moat. Each maps to one or more new domain modules in the architecture. All are designed to be additive — the free-tier base remains untouched.

2.1  Developer Growth Graph
The most powerful moat. A multi-dimensional score that evolves monthly — not a point-in-time snapshot.
Dimension	Derived from	Update frequency	Storage
Backend architecture confidence	RepoAnalysis complexity_hotspots, file structure patterns	Weekly	DeveloperGraph.dimensions (JSON)
Frontend depth	Language breakdown, component patterns in repos	Weekly	DeveloperGraph.dimensions
Testing discipline	Presence of test files, test-to-code ratio per repo	Per sync	DeveloperGraph.dimensions
Commit quality	CommitStat message scoring (AI), atomicity, linked issues	Per sync	CommitQualityScore
Learning retention	LearningLog topics vs actual usage in repos (correlation)	Weekly	DeveloperGraph.dimensions
Consistency	Streak engine + gap analysis	Daily	LearningStreak + DeveloperGraph
Architecture maturity	Project DNA scores aggregated across all repos	Per analysis	DeveloperGraph.dimensions
AI dependency ratio	Commits with AI-generated patterns vs handwritten logic	Per analysis	DeveloperGraph.dimensions
Deployment experience	CI/CD file presence, deployment mentions in commits	Per sync	DeveloperGraph.dimensions
Collaboration quality	PR review participation, issue comments (future webhook)	Weekly	DeveloperGraph.dimensions

New schema additions
model DeveloperGraph {
  id           String   @id @default(uuid())
  user_id      String   @unique
  user         User     @relation(...)
  dimensions   Json     // { backend: 74, frontend: 52, testing: 31, ... }
  delta_30d    Json     // { backend: +18, frontend: +3, ... }
  computed_at  DateTime @default(now())
  history      DeveloperGraphSnapshot[]
}

model DeveloperGraphSnapshot {
  id           String          @id @default(uuid())
  graph_id     String
  graph        DeveloperGraph  @relation(...)
  dimensions   Json            // point-in-time snapshot
  snapshot_at  DateTime
  @@index([graph_id, snapshot_at])
}

2.2  AI Engineering Coach
A stateful AI persona that knows the developer's history. Not a generic chatbot — a coach that can say: "You solved auth differently in 4 repos. Want me to help standardise it?"

Architecture approach
•	Coach lives in apps/api/src/modules/intelligence/coach/
•	Context is assembled at request time from: DeveloperGraph, BuildMemory, ProjectDNA, recent LearningLogs, open Tasks
•	System prompt versioned under ai/prompts/coach/v1/coach-context.prompt.ts
•	Conversation history stored in CoachSession — max 20 turns retained, summarised by AI on overflow
•	Triggered on-demand (user opens chat) and proactively (weekly cron surfaces one insight)

model CoachSession {
  id           String   @id @default(uuid())
  user_id      String
  turns        Json[]   // [{ role, content, timestamp }]
  summary      String?  // AI-compressed older context
  context_hash String   // invalidated when graph/memory changes
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt
  @@index([user_id])
}

2.3  Project DNA Analysis
Each repo gets an architectural fingerprint — far beyond "uses TypeScript". The DNA is a structured profile that reveals architecture patterns, maturity level, and persistent gaps.

DNA dimension	How derived	Example output
Architecture pattern	File structure analysis + AI classification	SaaS MVC / event-driven / monolith / microservice
Engineering maturity	CI file presence, test coverage signals, README quality	Junior-to-mid scaling pattern (score: 58/100)
Complexity map	RepoAnalysis.complexity_hotspots + file depth	High coupling in /services/, shallow test coverage
Persistent gaps	Aggregated across all repos for that user	Consistently missing: caching, monitoring, CI/CD
Similarity fingerprint	Embedding of architecture summary for cross-repo matching	Vector stored in BuildMemory for recall

model ProjectDNA {
  id                 String     @id @default(uuid())
  repo_id            String     @unique
  repo               GitHubRepo @relation(...)
  architecture_type  String     // "saas-mvc" | "event-driven" | ...
  maturity_score     Int        // 0-100
  complexity_profile Json       // hotspots, coupling scores
  persistent_gaps    String[]   // ["no-tests", "no-ci", "no-monitoring"]
  similarity_vector  Bytes?     // pgvector embedding (V2.3)
  prompt_version     String
  analyzed_at        DateTime   @default(now())
  expires_at         DateTime
}

2.4  Build Memory System
Developers forget how they solved problems. DevTrack remembers for them — creating a personal engineering archive that surfaces relevant past solutions at the right moment.

Memory capture pipeline
1.	GitHub sync detects a new repo analysis or significant commit pattern
2.	AI extracts decision fingerprint: problem solved, solution approach, technologies used
3.	Stored in BuildMemory with semantic tags and optional embedding
4.	On new repo analysis or Coach query, similarity search returns relevant past memories
5.	Coach presents: "You solved a similar Redis caching issue in Project X in March. Want to reuse that approach?"

model BuildMemory {
  id          String   @id @default(uuid())
  user_id     String
  repo_id     String?  // null = learning-derived memory
  memory_type MemoryType
  title       String   // short problem statement
  solution    String   // what was done
  tech_tags   String[] // ["redis", "node", "caching"]
  embedding   Bytes?   // semantic vector (V2.3)
  relevance   Float    @default(1.0) // decays if never recalled
  recalled_at DateTime?
  created_at  DateTime @default(now())
  @@index([user_id, memory_type])
}

enum MemoryType {
  ARCHITECTURE_DECISION
  DEBUG_FIX
  DEPLOYMENT_PATTERN
  AUTH_IMPLEMENTATION
  PERFORMANCE_OPTIMIZATION
  LEARNING_APPLICATION
}

2.5  Momentum Detection
DevTrack detects burnout risk, abandonment patterns, and productivity dips — before the developer realises they're in one.

Signal	Pattern detected	Trigger
Abandonment risk	Commit velocity drop >60% over 14 days on active project	Notify Coach, flag in dashboard
Post-UI drop-off	Projects consistently go quiet after frontend milestone	Proactive Coach message
Burnout indicator	LearningLog mood = TIRED or BURNED_OUT 3+ consecutive days	Gentle wellbeing check in Coach
Comeback detection	Activity resumes after 14+ day gap	Positive reinforcement message
Deep work session	3+ hour focused activity with meaningful commits	Positive acknowledgement

model MomentumSignal {
  id           String        @id @default(uuid())
  user_id      String
  signal_type  MomentumType
  severity     Int           // 1-5
  metadata     Json          // project_id, velocity_delta, mood_data, etc.
  is_resolved  Boolean       @default(false)
  detected_at  DateTime      @default(now())
  @@index([user_id, signal_type])
  @@index([user_id, is_resolved])
}

enum MomentumType {
  ABANDONMENT_RISK
  BURNOUT_INDICATOR
  COMEBACK_DETECTED
  DEEP_WORK_SESSION
  STREAK_MILESTONE
  VELOCITY_SPIKE
}

2.6  Skill Confidence System
Instead of "Skills: React, Node.js" on a profile, DevTrack infers confidence levels from actual usage evidence. This is far more credible to recruiters and collaborators.

Evidence signal	Weight	Example
Number of repos using the technology	25%	React in 12 of 18 repos
Depth of usage (LOC, patterns used)	30%	Hooks, context, routing, testing used
Time span of consistent usage	20%	Used continuously for 18 months
Applied after learning (retention signal)	15%	Learned Redux, used in next project within 7 days
Architecture-level vs tutorial-level usage	10%	State management patterns vs simple components

model SkillConfidence {
  id              String   @id @default(uuid())
  user_id         String
  skill           String   // "react" | "postgresql" | "docker"
  confidence      Int      // 0-100
  evidence        Json     // { repo_count, depth_score, months_active, ... }
  last_used_at    DateTime
  computed_at     DateTime @default(now())
  @@unique([user_id, skill])
  @@index([user_id, confidence])
}

2.7  Developer Reputation System
A credibility score based on real engineering behaviour — not followers or stars. Valuable for hackathons, team-building, and open source collaboration.

Reputation dimension	Signal source	Range
Reliability score	Project completion rate, milestone consistency	0-100
Code quality trend	Commit quality score improving vs declining over 90d	0-100
Learning commitment	Learning streak consistency, topic breadth	0-100
Architecture growth	DeveloperGraph maturity dimension delta	0-100
Documentation habit	README quality, commit message clarity	0-100

model DeveloperReputation {
  id           String   @id @default(uuid())
  user_id      String   @unique
  overall      Int      // weighted composite 0-100
  dimensions   Json     // { reliability, code_quality, learning, architecture, docs }
  badges       String[] // ["ships-consistently", "strong-backend", "weak-docs"]
  computed_at  DateTime @default(now())
  history      ReputationSnapshot[]
}

2.8  Anti-Fake Productivity Engine
Most tools reward volume — more commits, more hours. DevTrack rewards meaningful progress. This makes the Daily Dev Score credible and hard to game.

•	Low-signal commit detection: Commits touching only whitespace, comments, or version bumps get 0.1x weight
•	Feature completion bonus: Closing a task linked to a commit adds 3x weight to those commits
•	Deep work detection: Commits clustered within a 3+ hour window on a single file tree get a depth bonus
•	Architecture maturity gates: Score thresholds unlock new Coach insights (e.g., "your architecture shows mid-level patterns")
•	Learning-to-build correlation: "You learned Docker 3 weeks ago but haven't applied it. Want a micro-challenge?"

 
3.  Updated Module Architecture
The base NestJS module structure from V0.2 is preserved. The new Intelligence domain is added as a first-class module group — never coupled into existing domain modules.

3.1  New directory structure
apps/api/src/
├── modules/
│   ├── auth/                    (unchanged)
│   ├── users/                   (unchanged)
│   ├── github/                  (unchanged)
│   ├── analytics/               (unchanged)
│   ├── ai/                      (unchanged — provider abstraction)
│   ├── projects/                (unchanged)
│   ├── learning/                (unchanged)
│   ├── profiles/                (extended — SkillConfidence, Reputation)
│   ├── subscriptions/           (unchanged)
│   │
│   ├── intelligence/            ← NEW: Core identity layer
│   │   ├── intelligence.module.ts
│   │   ├── graph/               ← DeveloperGraph computation
│   │   │   ├── graph.service.ts
│   │   │   └── graph-dimensions.calculator.ts
│   │   ├── dna/                 ← ProjectDNA analysis
│   │   │   ├── dna.service.ts
│   │   │   └── dna-classifier.ts
│   │   ├── memory/              ← BuildMemory capture & recall
│   │   │   ├── memory.service.ts
│   │   │   └── memory-extractor.ts
│   │   ├── momentum/            ← Burnout & velocity detection
│   │   │   ├── momentum.service.ts
│   │   │   └── signal-detector.ts
│   │   ├── reputation/          ← DeveloperReputation scoring
│   │   │   └── reputation.service.ts
│   │   ├── skill-confidence/    ← Skill evidence aggregation
│   │   │   └── confidence.service.ts
│   │   └── coach/               ← AI Engineering Coach
│   │       ├── coach.service.ts
│   │       └── context-assembler.ts
│   │
│   └── jobs/                    (extended — new intelligence jobs)
│       ├── github-sync.job.ts   (unchanged)
│       ├── ai-analysis.job.ts   (unchanged)
│       ├── streak-compute.job.ts(unchanged)
│       ├── insight-gen.job.ts   (unchanged)
│       ├── graph-compute.job.ts ← NEW @Cron('0 5 * * *')
│       ├── dna-analysis.job.ts  ← NEW @Cron('0 6 * * 1')
│       ├── memory-extract.job.ts← NEW @Cron('0 7 * * *')
│       └── momentum-scan.job.ts ← NEW @Cron('0 8 * * *')

3.2  Intelligence module design principles
The Intelligence modules follow the same BullMQ-ready pattern as the existing Jobs module — each service is a standalone injectable with domain logic fully isolated from the trigger mechanism.

•	No circular dependencies: Intelligence modules consume data from github/, learning/, analytics/ via their services. They never write back to those modules.
•	Event-driven output: When a graph or DNA computation completes, it emits internal events (EventEmitter2) that other modules can subscribe to without coupling.
•	Idempotent computation: All intelligence jobs are safe to re-run. They compute fresh and upsert — no state machines, no partial-write risks.
•	Versioned prompts for all AI calls: Graph dimension inference, DNA classification, and memory extraction each have versioned prompts under ai/prompts/v1/.

3.3  Context Assembler — AI Coach
The Coach's power comes from rich context. The ContextAssembler builds a structured prompt payload at request time:
// intelligence/coach/context-assembler.ts
export class ContextAssembler {
  async buildContext(userId: string): Promise<CoachContext> {
    const [graph, dna, memory, reputation, recent] = await Promise.all([
      this.graphService.getLatest(userId),
      this.dnaService.getTopProjects(userId, 5),
      this.memoryService.getRecent(userId, 10),
      this.reputationService.get(userId),
      this.learningService.getRecent(userId, 14),   // last 14 days
    ]);
    return {
      developerProfile: { graph, reputation },
      recentActivity:   { learning: recent },
      projectInsights:  { dna, openProjects },
      memoryHighlights: memory,
    };
  }
}

 
4.  Scalability & Maintainability Design
4.1  Data volume projections
Table	Rows @ 500 users	Rows @ 5,000 users	Growth driver	Mitigation
DeveloperGraph	500	5,000	One per user	Snapshot + prune >90d history
DeveloperGraphSnapshot	6,000	60,000	~12 snapshots/user/year	Retain 24 months, archive older
ProjectDNA	5,000	50,000	One per repo	Expires_at = 14d, re-computed lazily
BuildMemory	10,000	100,000	~20 memories/user	Soft-delete + relevance decay
MomentumSignal	15,000	150,000	~30 signals/user	Auto-resolve + prune >60d
SkillConfidence	5,000	50,000	~10 skills/user	Recomputed weekly, no history
CoachSession	5,000	50,000	One active per user	Summary compression at 20 turns
CommitQualityScore	50,000	500,000	Per commit batch	Index on repo_id + date only

Total estimated storage at 5,000 users: ~900MB. Upgrade to Neon Launch ($19/mo) before hitting 2,000 active users. At 5,000 users the business is generating revenue — this cost is trivial.

4.2  Job scheduling — no bottleneck
All new Intelligence jobs follow the existing BullMQ-ready pattern. They process users sequentially with rate-limit-safe delays. The schedule is staggered to avoid API thundering-herd:
Job	Schedule (UTC)	Duration est. (500 users)	AI provider calls
github-sync	02:00	~45 min	None (GitHub API only)
ai-analysis	03:00	~30 min	Groq — repo analysis
streak-compute	00:00	~5 min	None
insight-gen	04:00 Mon	~20 min	Groq — weekly insight
graph-compute	05:00	~15 min	Groq — dimension inference
dna-analysis	06:00 Mon	~25 min	Groq — DNA classification
memory-extract	07:00	~20 min	Groq — memory extraction
momentum-scan	08:00	~5 min	None (rule-based)

Groq free tier: 30 req/min, 6,000 req/day. At 500 users with 4 AI jobs, peak daily usage is ~2,000 calls (well within limits). At 1,500 users, upgrade to Groq paid or add NVIDIA NIM as secondary — one config change in factory.ts.

4.3  Reusability principles
•	All Intelligence services are pure domain logic. Zero awareness of HTTP, cron, or BullMQ. Fully unit-testable without mocking transport.
•	All AI calls go through IAIProvider. Swapping Groq to NIM to Gemini is one line in factory.ts. Intelligence modules never import a provider directly.
•	All prompts are versioned and immutable. intelligence/graph/v1/, intelligence/dna/v1/, etc. New behaviour = new version file, never an edit.
•	EventEmitter2 for cross-module communication. graph.computed, dna.analyzed, momentum.detected — subscribed by Coach and Reputation without coupling.
•	All schema additions are additive. No existing tables modified. New tables only. Zero risk to existing data or existing jobs.

4.4  Upgrade path — Intelligence layer
Current (free)	Trigger	Upgraded solution	Cost
Sequential user processing in jobs	1,500+ active users, jobs taking >2hr	Migrate to BullMQ — syncUser() unchanged, add queue producer	+$17/mo
Groq free (6k req/day)	Job queue saturating at ~1,000 users	Groq paid or NVIDIA NIM — factory.ts change only	+$20-50/mo
No vector search (BuildMemory)	V2.3 milestone — memory recall quality	pgvector on Neon — add extension, populate similarity_vector column	Included in Neon
In-memory graph snapshots	History >100k rows	Neon Launch + retention policy job	+$19/mo
Rule-based momentum detection	False positive rate too high	Fine-tune with user feedback loop — same schema, new AI prompt version	No cost

 
5.  Complete Schema Additions
All additions to packages/database/prisma/schema.prisma. Existing models are unchanged. Add these after the existing Subscription model.

// ════════════════════════════════════════════════
// INTELLIGENCE LAYER — new models
// ════════════════════════════════════════════════

model DeveloperGraph {
  id         String                  @id @default(uuid())
  user_id    String                  @unique
  user       User                    @relation(fields: [user_id], references: [id])
  dimensions Json
  delta_30d  Json
  computed_at DateTime               @default(now())
  history    DeveloperGraphSnapshot[]
}

model DeveloperGraphSnapshot {
  id          String         @id @default(uuid())
  graph_id    String
  graph       DeveloperGraph @relation(fields: [graph_id], references: [id])
  dimensions  Json
  snapshot_at DateTime
  @@index([graph_id, snapshot_at])
}

model ProjectDNA {
  id                String     @id @default(uuid())
  repo_id           String     @unique
  repo              GitHubRepo @relation(fields: [repo_id], references: [id])
  architecture_type String
  maturity_score    Int
  complexity_profile Json
  persistent_gaps   String[]
  similarity_vector Bytes?
  prompt_version    String
  analyzed_at       DateTime   @default(now())
  expires_at        DateTime
}

model BuildMemory {
  id           String     @id @default(uuid())
  user_id      String
  repo_id      String?
  memory_type  MemoryType
  title        String
  solution     String
  tech_tags    String[]
  embedding    Bytes?
  relevance    Float      @default(1.0)
  recalled_at  DateTime?
  created_at   DateTime   @default(now())
  @@index([user_id, memory_type])
}

model MomentumSignal {
  id           String       @id @default(uuid())
  user_id      String
  signal_type  MomentumType
  severity     Int
  metadata     Json
  is_resolved  Boolean      @default(false)
  detected_at  DateTime     @default(now())
  @@index([user_id, signal_type])
}

model SkillConfidence {
  id           String   @id @default(uuid())
  user_id      String
  skill        String
  confidence   Int
  evidence     Json
  last_used_at DateTime
  computed_at  DateTime @default(now())
  @@unique([user_id, skill])
  @@index([user_id, confidence])
}

model DeveloperReputation {
  id          String   @id @default(uuid())
  user_id     String   @unique
  overall     Int
  dimensions  Json
  badges      String[]
  computed_at DateTime @default(now())
}

model CoachSession {
  id           String   @id @default(uuid())
  user_id      String
  turns        Json
  summary      String?
  context_hash String
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt
  @@index([user_id])
}

model CommitQualityScore {
  id            String   @id @default(uuid())
  repo_id       String
  date          DateTime @db.Date
  avg_score     Float
  sample_count  Int
  score_detail  Json
  computed_at   DateTime @default(now())
  @@unique([repo_id, date])
  @@index([repo_id, date])
}

// ════ NEW ENUMS ════
enum MemoryType {
  ARCHITECTURE_DECISION
  DEBUG_FIX
  DEPLOYMENT_PATTERN
  AUTH_IMPLEMENTATION
  PERFORMANCE_OPTIMIZATION
  LEARNING_APPLICATION
}

enum MomentumType {
  ABANDONMENT_RISK
  BURNOUT_INDICATOR
  COMEBACK_DETECTED
  DEEP_WORK_SESSION
  STREAK_MILESTONE
  VELOCITY_SPIKE
}

 
6.  New API Endpoints
Method	Endpoint	Description	Auth	Cache
GET	/intelligence/graph	Current DeveloperGraph with delta_30d	JWT	1 hour
GET	/intelligence/graph/history	Snapshot history (last 12 months)	JWT	6 hours
GET	/intelligence/dna/:repoId	ProjectDNA for one repo	JWT	24 hours
GET	/intelligence/dna	DNA across all user repos	JWT	6 hours
GET	/intelligence/memory	BuildMemory entries (paginated)	JWT	none
GET	/intelligence/memory/recall	Similar memories for context query	JWT	none
GET	/intelligence/momentum	Active MomentumSignals	JWT	30 min
GET	/intelligence/skills	All SkillConfidence entries sorted desc	JWT	6 hours
GET	/intelligence/reputation	DeveloperReputation with badge explanations	JWT	6 hours
POST	/intelligence/coach/message	Send message to AI Coach	JWT	none
GET	/intelligence/coach/session	Current session with turn history	JWT	none
DELETE	/intelligence/coach/session	Clear session (start fresh)	JWT	none
GET	/intelligence/timeline	Engineering Timeline (milestones)	JWT	1 hour
GET	/profiles/:slug/reputation	Public reputation (if profile is public)	none	1 hour
GET	/profiles/:slug/skills	Public skill confidence (if public)	none	1 hour

 
7.  Revised Roadmap
Phase	Weeks	Deliverables
MVP Core Loop	1-8	Monorepo scaffold, CI/CD, Auth, Neon/Prisma, GitHub sync, Learning log, Analytics dashboard, AI repo analysis, Public profile
V2.1 — Intelligence Foundations	9-14	DeveloperGraph (10 dimensions), ProjectDNA, BuildMemory (no vectors yet), Momentum Detection, Skill Confidence, AI Engineering Coach (text)
V2.2 — Identity & Power Features	15-20	Developer Reputation System, Anti-Fake Productivity Engine, Commit Quality Scoring, GitHub webhooks (real-time sync), Milestone cards, Career tools (resume, case studies)
V2.3 — Scale & Vector Intelligence	21+	Migrate to BullMQ (paid workers), pgvector for BuildMemory recall, Team workspaces, Vector search on insights, AI mentor full context, Public API v2

 
8.  New Architecture Decision Records
ADR-009: Intelligence as a separate domain module
The Intelligence layer reads from existing domain models but never writes to them. All derived data (graphs, DNA, memory, momentum) lives in its own tables. This enforces the domain isolation tenet — a bug in graph computation cannot corrupt GitHub or learning data.

ADR-010: Rule-based momentum detection, not ML
Momentum signals are computed with simple threshold rules (velocity drop >60%, mood streaks). This is intentional — interpretable rules build user trust ("your score dropped because X"), are debuggable, and can be iterated without model retraining. ML upgrade path exists in V2.3 but is not the default.

ADR-011: BuildMemory without vectors at launch
Semantic vector search (pgvector) is deferred to V2.3. At MVP, BuildMemory recall uses tech_tag matching and recency. This delivers 80% of the value with zero infrastructure cost. pgvector is available free on Neon and can be added with a single migration — the similarity_vector column is nullable and ready.

ADR-012: Reputation is always user-owned
DeveloperReputation is computed entirely from the user's own data. It is never derived from comparison to other users (no percentiles, no leaderboards) because that creates anxiety, not growth. Reputation improves when the developer improves — full stop.

ADR-013: Coach context assembled at request time
The AI Coach does not maintain a live state machine. Context is assembled fresh from database on each session load. This is slightly slower than caching, but ensures the Coach always reflects the latest graph, memory, and reputation data. context_hash detects staleness cheaply.

ADR-014: Anti-fake productivity is algorithmic, not gameable
The Daily Dev Score weighting (commit quality, feature completion, learning retention) is computed server-side from data the developer cannot directly manipulate. Commit count is a weak signal that contributes <15% of the score. This makes the score honest and resistant to gaming — which is what makes it trustworthy enough to share on a public profile.

 
Appendix: Full Feature-to-Module Mapping
Feature	Primary module	Schema tables	AI needed	Free tier safe
Developer Growth Graph	intelligence/graph/	DeveloperGraph, DeveloperGraphSnapshot	Yes (dimension inference)	Yes
AI Engineering Coach	intelligence/coach/	CoachSession	Yes (GPT-style chat)	Yes (within Groq limits)
Project DNA Analysis	intelligence/dna/	ProjectDNA	Yes (classification)	Yes
Build Memory System	intelligence/memory/	BuildMemory	Yes (extraction)	Yes (no vectors yet)
Momentum Detection	intelligence/momentum/	MomentumSignal	No (rule-based)	Yes
Skill Confidence	intelligence/skill-confidence/	SkillConfidence	No (evidence aggregation)	Yes
Developer Reputation	intelligence/reputation/	DeveloperReputation	No (weighted score)	Yes
Commit Quality Score	intelligence/graph/	CommitQualityScore	Yes (message scoring)	Yes
Anti-Fake Productivity	analytics/ (extended)	Extends CommitStat	Partial	Yes
Daily Dev Score	analytics/ (extended)	Extends existing	Partial	Yes
Engineering Timeline	identity/	Derived — no new table	No	Yes
Milestone Cards	identity/	MilestoneEvent	No	Yes
AI Résumé Generator	profiles/ (extended)	Derives from existing	Yes	Yes
Portfolio Case Studies	profiles/ (extended)	Derives from existing	Yes	Yes
Recruiter View Mode	profiles/ (extended)	DeveloperProfile (flag)	No	Yes
GitHub Webhooks	github/ (extended)	No new table	No	V2.2+
Multi-account GitHub	github/ (extended)	Extends GitHubAccount	No	V2.1
Weekly Retro Prompts	learning/ (extended)	Extends LearningLog	Yes	Yes
Spaced Repetition Nudges	learning/ (extended)	No new table	No	Yes
Focus Sessions	learning/ (extended)	FocusSession	No	Yes

End of Document
