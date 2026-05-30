# DevTrack V2 — Phase-Wise Completion Roadmap

> **Priority Order:** System → Backend → Security → App → Website
> **Status Legend:** [✓] Done · [~] Partial · [ ] Not Started · [▶] In Progress

---

## Current Overall Status

| Priority | Domain | Completion |
|----------|--------|------------|
| 1 | System (Infra + Monorepo + CI/CD) | ~70% |
| 2 | Backend (NestJS API) | ~78% |
| 3 | Security | ~70% |
| 4 | App (Mobile — Expo) | ~60% |
| 5 | Website (Next.js Web) | ~5% |


---

## Deployment Setup & Secrets Guide (100% Free Tier Compatible)

This setup is fully designed to run on the standard **free tiers** of GitHub, Railway, Neon, and Vercel.

### 1. GitHub Secrets (Repository Settings → Secrets and variables → Actions)
Configure these secrets to enable automated type-checking, database migrations, and deployments:

| Secret Name | Value | Purpose |
|-------------|-------|---------|
| `RAILWAY_TOKEN` | *Your Railway Account Token* | Authenticates the Railway CLI for deploying the NestJS API. |
| `DATABASE_URL` | `postgresql://...` (Pooled connection) | Neon connection string with PgBouncer enabled for Prisma client. |
| `DIRECT_URL` | `postgresql://...` (Direct connection) | Neon connection string without PgBouncer for running migrations in CI. |
| `TURBO_TOKEN` | *Vercel Access Token* (Optional) | Speeds up builds using Next.js/Turborepo remote caching. |
| `TURBO_TEAM` | *Vercel Team Username* (Optional) | Speeds up builds using Next.js/Turborepo remote caching. |

---

### 2. Railway Variables (NestJS API App Service Settings)
Define these in the Railway service dashboard to allow the backend API to run:

| Variable Name | Example/Value | Purpose |
|---------------|---------------|---------|
| `DATABASE_URL` | `postgresql://...` (Pooled) | High-concurrency pooled connection. |
| `DIRECT_URL` | `postgresql://...` (Direct) | Direct connection for Prisma schema interactions. |
| `CLERK_ISSUER_URL` | `https://next-manatee-62.clerk.accounts.dev` | Your Clerk Instance URL to verify JWT issuers. |
| `CLERK_JWKS_URL` | `.../.well-known/jwks.json` | Clerk JWKS path for signing key rotation. |
| `ENCRYPTION_KEY` | *64-character hex string* | AES-256-GCM encryption key for GitHub access tokens. |
| `GITHUB_CLIENT_ID` | *Your GitHub OAuth Client ID* | Authenticates the OAuth flow. |
| `GITHUB_CLIENT_SECRET` | *Your GitHub OAuth Client Secret* | Authenticates the OAuth flow securely. |
| `GITHUB_CALLBACK_URL` | `https://<railway-domain>/api/v1/github/callback` | Callback endpoint for OAuth. |
| `NVIDIA_NIM_API_KEY` | `nvapi-...` (Optional) | Primary AI provider key. |
| `GROQ_API_KEY` | `gsk_...` (Optional) | Fallback AI provider key. |
| `GEMINI_API_KEY` | `AIza...` (Optional) | Fallback AI provider key. |
| `PORT` | `3001` | Server execution port. |
| `NODE_ENV` | `production` | Enables performance optimizations. |

---

### 3. Vercel Variables (Next.js Frontend settings)
Configure these on Vercel to allow the Next.js web application to connect:

| Variable Name | Example/Value | Purpose |
|---------------|---------------|---------|
| `NEXT_PUBLIC_API_URL` | `https://<railway-domain>` | Target backend REST URL for API calls. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` | Public key to instantiate Clerk UI widgets. |
| `CLERK_SECRET_KEY` | `sk_test_...` | Server-side key for secure Clerk requests. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | Sign-in redirection router route. |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | Sign-up redirection router route. |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` | Post sign-in path redirection. |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/dashboard` | Post sign-up path redirection. |

---

## PRIORITY 1 — SYSTEM

> Monorepo scaffold, deployment, CI/CD, Docker, environment config.

### Phase 1.1 — Monorepo Foundation
| Task | Status | Notes |
|------|--------|-------|
| Turborepo + pnpm workspace setup | [✓] Done | `turbo.json`, `pnpm-workspace.yaml` |
| Root `tsconfig.base.json` | [✓] Done | Extended by all apps |
| `packages/database` (Prisma + Neon) | [✓] Done | Schema + 1 migration |
| `packages/shared-types` | [✓] Done | Complete set of enums, DTOs, and API responses |
| `packages/config` (Zod env validation) | [✓] Done | Zod env schema library created |
| `packages/ui` (shadcn/ui design system) | [ ] Not Started | Needed by web + app |
| `packages/ai-client` (shared provider pkg) | [✓] Done | Extracted from `apps/api`; NIM, Groq, Gemini providers |
| `packages/logger` (shared Pino config) | [✓] Done | Shared Pino configuration wrapper pkg |
| `.prettierrc` at root | [✓] Done | |
| `.gitignore` at root | [✓] Done | |

### Phase 1.2 — Environment & Config
| Task | Status | Notes |
|------|--------|-------|
| `apps/api/.env.example` | [✓] Done | Full key list documented |
| `apps/web/.env.example` | [✓] Done | |
| `apps/mobile/.env.example` | [✓] Done | |
| `packages/config` — Zod env schema for API | [✓] Done | Integrates with NestJS ConfigModule |
| `packages/config` — Zod env schema for Web | [✓] Done | Wired into next.config.ts, validates at build time |
| Reconcile deployment target: **Railway vs Render** | [✓] Done | Railway for API, Vercel for web (documented in railway.toml) |

### Phase 1.3 — Infrastructure & Docker
| Task | Status | Notes |
|------|--------|-------|
| `infra/docker/` Dockerfiles per app | [✓] Done | Dockerfile.api + Dockerfile.web (multi-stage) |
| `infra/compose/docker-compose.local.yml` | [✓] Done | Postgres + Redis for local dev |
| `infra/scripts/db-backup.sh` | [✓] Done | pg_dump with optional S3 upload, keeps last 7 |
| Railway `railway.toml` (or `render.yaml`) | [✓] Done | Configured for Nixpacks API start |

### Phase 1.4 — CI/CD (GitHub Actions)
| Task | Status | Notes |
|------|--------|-------|
| `.github/workflows/ci.yml` — lint + typecheck | [✓] Done | Configured with cache |
| `.github/workflows/ci.yml` — unit tests | [✓] Done | Runs on main & dev branches |
| `.github/workflows/deploy-api.yml` — Railway | [✓] Done | Unified inside CI workflow |
| `.github/workflows/deploy-web.yml` — Vercel | [✓] Done | Pre-deploy typecheck; Vercel GitHub App handles actual deploys |
| Vercel preview deploy on PRs | [✓] Done | Handled automatically by Vercel GitHub App (no workflow needed) |
| `prisma migrate deploy` in CI | [✓] Done | Runs before Railway deploy step in ci.yml |
| Turbo remote cache setup | [✓] Done | `remoteCache` in turbo.json; activate with TURBO_TOKEN + TURBO_TEAM secrets |

### Phase 1.5 — Observability
| Task | Status | Notes |
|------|--------|-------|
| Pino JSON logging (API) | [✓] Done | Dev = pretty-print, prod = JSON |
| `traceId` on all log lines | [✓] Done | Propagated through async chain |
| `SyncJob` DB records for observability | [✓] Done | Full sync lifecycle tracked |
| Health endpoint (`/health`) | [✓] Done | Excluded from access logs |
| Sentry integration (error tracking) | [✓] Done | API + Web; SentryExceptionFilter captures 5xx only |
| Logtail / log aggregation | [✓] Done | Pino multi-transport in packages/logger; activate with LOGTAIL_SOURCE_TOKEN |
| UptimeRobot or equivalent uptime check | [✓] Done | Free external service; point to /api/v1/health, 5-min checks |

### Phase 1.6 — Database
| Task | Status | Notes |
|------|--------|-------|
| Prisma schema — all core models | [✓] Done | 12 models, all indexed |
| Initial migration (`20260524_init`) | [✓] Done | |
| `DATABASE_URL` (pooled) + `DIRECT_URL` | [✓] Done | Neon PgBouncer config |
| Database branching per PR (Neon) | [✓] Done | Branching guide + helper script added in `packages/database` |
| Intelligence layer schema additions | [✓] Done | Lightweight models added to Prisma schema (V2.1) |

---

## PRIORITY 2 — BACKEND

> NestJS API — all domain modules, jobs, analytics, AI.

### Phase 2.1 — Core API Infrastructure [✓] COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| NestJS bootstrap (`main.ts`) | [✓] Done | ValidationPipe, CORS, versioning |
| `AppModule` with all domain modules | [✓] Done | Clean import order |
| `DatabaseModule` (PrismaService) | [✓] Done | Singleton, lifecycle hooks |
| `GlobalExceptionFilter` | [✓] Done | Consistent error envelope + traceId |
| URI versioning (`/api/v1/`) | [✓] Done | Default version = 1 |
| Global `ValidationPipe` (whitelist + transform) | [✓] Done | |
| Pino logger (`LoggerModule`) | [✓] Done | |
| `ThrottlerModule` (10/s burst, 100/min) | [✓] Done | |
| `EventEmitterModule` (wildcard, 20 listeners) | [✓] Done | |
| `ScheduleModule` (cron jobs) | [✓] Done | |

### Phase 2.2 — Auth Module [✓] COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| Clerk JWKS RS256 strategy | [✓] Done | `clerk.strategy.ts` |
| JWKS caching (10min, rate-limited) | [✓] Done | `jwks-rsa` |
| Issuer URL validation | [✓] Done | Prevents token reuse across instances |
| `ClerkGuard` | [✓] Done | |
| `PlansGuard` (subscription gating) | [✓] Done | |
| `@CurrentUser()` decorator | [✓] Done | |
| `@RequirePlans()` decorator | [✓] Done | |
| Lazy user provisioning on first login | [✓] Done | Race-safe upsert |

### Phase 2.3 — Users Module [✓] COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| `findOrCreateByClerkId` (upsert) | [✓] Done | |
| User profile CRUD | [✓] Done | |
| Soft delete (`deletedAt`) | [✓] Done | |
| DTOs with class-validator | [✓] Done | |

### Phase 2.4 — GitHub Module [✓] COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| `GithubTokenService` (AES-256-GCM encrypt/decrypt) | [✓] Done | |
| `GithubApiClient` (Octokit + rate limit check) | [✓] Done | |
| `GithubOAuthService` (token exchange) | [✓] Done | |
| `GithubService.runScheduledSync()` | [✓] Done | Idempotent, full pipeline |
| Rate limit detection (`< 100 → skip`) | [✓] Done | |
| `SyncJob` observability records | [✓] Done | PENDING → RUNNING → SUCCESS/FAILED |
| `skipDuplicates: true` on commit batch insert | [✓] Done | |
| `EventEmitter2` `github.sync.completed` event | [✓] Done | |
| `POST /api/v1/github/sync` (manual trigger) | [✓] Done | |
| `GET /api/v1/github/repos` | [✓] Done | |
| GitHub webhook (real-time sync) | [ ] Not Started | V2.2 |

### Phase 2.5 — Analytics Module
| Task | Status | Notes |
|------|--------|-------|
| `StreakService` (append-only, per-day) | [✓] Done | Exact algorithm implemented |
| Streak recompute on `github.sync.completed` | [✓] Done | `@OnEvent` listener |
| `VelocityService` | [✓] Done | |
| `AnalyticsController` | [✓] Done | Streak, commits, languages, velocity, summary |
| `GET /analytics/streak` — current streak | [✓] Done | |
| `GET /analytics/commits` — commit graph data | [✓] Done | |
| `GET /analytics/languages` — language breakdown | [✓] Done | |
| `GET /analytics/velocity` — commit velocity | [✓] Done | |
| `GET /analytics/summary` — full dashboard data | [✓] Done | |

### Phase 2.6 — AI Module
| Task | Status | Notes |
|------|--------|-------|
| `IAIProvider` interface | [✓] Done | |
| NVIDIA NIM provider | [✓] Done | |
| Groq provider | [✓] Done | |
| Gemini provider (fallback) | [✓] Done | |
| Provider fallback chain (NIM → Groq → Gemini) | [✓] Done | |
| Token hard cap (`MAX_TOKENS_CAP = 2048`) | [✓] Done | |
| All AI calls logged to `AIInsight` table | [✓] Done | |
| ElevenLabs service (TTS) | [✓] Done | Bonus — not in arch docs |
| Mock provider (for CI/testing) | [✓] Done | Deterministic mock provider added |
| Versioned prompt files (`ai/prompts/v1/`) | [✓] Done | Growth insight + assistant prompts moved out of controller |
| `AiController` endpoints | [~] Partial | Main endpoints exist; full intelligence surface still pending |
| Repo analysis prompt + pipeline | [✓] Done | Prompt extracted to `ai/prompts/v1/repo-analysis.prompt.ts` |
| Weekly insight prompt + pipeline | [✓] Done | Added weekly prompt + `InsightGenJob` |

### Phase 2.7 — Jobs Module
| Task | Status | Notes |
|------|--------|-------|
| `GithubSyncJob` — `@Cron('0 2 * * *')` | [✓] Done | Trigger-only pattern |
| `AiAnalysisJob` — `@Cron('0 3 * * *')` | [✓] Done | With cost guard (1/user/day) |
| `StreakComputeJob` | [✓] Done | |
| BullMQ upgrade comment in every job | [✓] Done | |
| `InsightGenJob` — weekly AI insights | [✓] Done | `@Cron('0 4 * * 1')` |
| `GraphComputeJob` (V2.1) | [ ] Not Started | DeveloperGraph |
| `DnaAnalysisJob` (V2.1) | [ ] Not Started | ProjectDNA |
| `MomentumScanJob` (V2.1) | [ ] Not Started | Burnout detection |

### Phase 2.8 — Projects Module [✓] COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| Project CRUD (create, read, update, delete) | [✓] Done | |
| Task management (per project) | [✓] Done | |
| Soft delete | [✓] Done | |

### Phase 2.9 — Learning Module [✓] COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| Learning log CRUD | [✓] Done | |
| Tags, duration, source, notes | [✓] Done | |

### Phase 2.10 — Profiles Module
| Task | Status | Notes |
|------|--------|-------|
| Profile CRUD (bio, links, visibility) | [✓] Done | Schema + basic service |
| `GET /profiles/:slug` (public profile) | [ ] Not Started | |
| Public profile toggle (`isPublic` flag) | [~] Partial | Schema ready, no route |
| Skill confidence (V2.1) | [ ] Not Started | |
| Developer reputation (V2.1) | [ ] Not Started | |

### Phase 2.11 — Intelligence Layer (V2.1)
| Task | Status | Notes |
|------|--------|-------|
| `intelligence/` module scaffold | [ ] Not Started | |
| `DeveloperGraph` — 10-dimension score | [ ] Not Started | Schema additions ready in arch doc |
| `ProjectDNA` — repo architectural fingerprint | [ ] Not Started | |
| `BuildMemory` — personal engineering archive | [ ] Not Started | |
| `MomentumSignal` — burnout / velocity detection | [ ] Not Started | |
| `SkillConfidence` — evidence-based skills | [ ] Not Started | |
| `DeveloperReputation` — credibility score | [ ] Not Started | |
| `CoachSession` — AI Engineering Coach | [ ] Not Started | |
| `CommitQualityScore` — per-commit scoring | [ ] Not Started | |

---

## PRIORITY 3 — SECURITY

> Auth, encryption, rate limiting, webhook hardening, audit.

### Phase 3.1 — Authentication [✓] COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| Clerk JWKS RS256 (key rotation support) | [✓] Done | |
| JWT issuer validation | [✓] Done | |
| JWKS key caching (rate-limited) | [✓] Done | |
| `ClerkGuard` on all protected routes | [✓] Done | |
| Mobile Expo Clerk token compatibility | [✓] Done | Same Bearer flow |

### Phase 3.2 — Authorization
| Task | Status | Notes |
|------|--------|-------|
| Plan-based access guard (`PlansGuard`) | [✓] Done | |
| `@RequirePlans()` decorator | [✓] Done | |
| RBAC permissions matrix (Participant/Organizer/Judge/Admin) | [ ] Not Started | Arch 2.0.2 requirement |
| `@Roles()` guard | [ ] Not Started | |
| Resource ownership checks (user can't access other user's data) | [~] Partial | Some controllers — not consistent |

### Phase 3.3 — Encryption & Token Security
| Task | Status | Notes |
|------|--------|-------|
| GitHub access tokens — AES-256-GCM at rest | [✓] Done | `GithubTokenService` |
| Encryption key from environment (never hardcoded) | [✓] Done | |
| Token scope storage (`scopes[]` in schema) | [✓] Done | |
| Key rotation strategy | [ ] Not Started | No rotation mechanism yet |

### Phase 3.4 — Rate Limiting
| Task | Status | Notes |
|------|--------|-------|
| Global throttler (10/s burst, 100/min) | [✓] Done | `@nestjs/throttler` |
| Per-endpoint limits (auth routes: 5/min) | [~] Partial | GitHub auth/sync routes throttled; more endpoints can be tuned later |
| GitHub API rate limit detection | [✓] Done | Skip user if < 100 remaining |
| Manual sync throttle (1/hr per user) | [ ] Not Started | |
| AI analysis cost guard (1/user/day) | [✓] Done | |

### Phase 3.5 — HTTP Security Headers
| Task | Status | Notes |
|------|--------|-------|
| CORS locked to `FRONTEND_URL` | [✓] Done | |
| `helmet` middleware | [ ] Not Started | Missing from `main.ts` |
| `Content-Security-Policy` header | [ ] Not Started | |

### Phase 3.6 — Webhook Security (V2.2)
| Task | Status | Notes |
|------|--------|-------|
| HMAC-SHA256 signature verification | [ ] Not Started | Arch 2.0.2 requirement |
| `crypto.timingSafeEqual` for constant-time compare | [ ] Not Started | |
| Replay protection (delivery ID dedup in Redis) | [ ] Not Started | |
| Timestamp validation (reject > 5min old) | [ ] Not Started | |
| Webhook rate limiting (100 req/min per IP) | [ ] Not Started | |

### Phase 3.7 — Audit & Observability
| Task | Status | Notes |
|------|--------|-------|
| `SyncJob` records (full sync lifecycle) | [✓] Done | |
| `AIInsight` records (all AI calls logged) | [✓] Done | Cost + debug auditability |
| `AuditLog` model (security mutations) | [ ] Not Started | Schema in arch doc — not built |
| Structured error logging (5xx = error, 4xx = warn) | [✓] Done | `GlobalExceptionFilter` |

---

## PRIORITY 4 — APP (Mobile — Expo React Native)

> Expo Router, Clerk auth, 5 screens, API integration.

### Phase 4.1 — Foundation [✓] COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| Expo Router setup | [✓] Done | |
| `(tabs)` + `(auth)` route groups | [✓] Done | |
| Clerk auth (sign-in, sign-up) | [✓] Done | `(auth)/sign-in.tsx`, `sign-up.tsx` |
| API client (`src/api/client.ts`) | [✓] Done | Bearer token injection |
| Shared icon set (`Icons.tsx`) | [✓] Done | 16KB — comprehensive |
| EAS build config (`eas.json`) | [✓] Done | |
| Metro config | [✓] Done | |

### Phase 4.2 — Core Screens [✓] BUILT (needs polish)
| Task | Status | Notes |
|------|--------|-------|
| Dashboard screen | [✓] Done | 16KB — full layout |
| Analytics screen | [✓] Done | 13KB |
| Projects screen | [✓] Done | 36KB — most complex screen |
| Insights screen | [✓] Done | |
| Profile screen | [✓] Done | 14KB |

### Phase 4.3 — API Integration
| Task | Status | Notes |
|------|--------|-------|
| Connect dashboard to real API data | [ ] Not Started | Currently likely static/mock |
| Connect analytics to real commit/streak data | [ ] Not Started | Needs `GET /analytics/*` endpoints |
| Connect projects to API CRUD | [ ] Not Started | |
| Connect insights to `AIInsight` data | [ ] Not Started | |
| Connect profile to user/profile API | [ ] Not Started | |
| GitHub sync trigger from app | [ ] Not Started | `POST /github/sync` |
| Polling / pull-to-refresh | [ ] Not Started | |

### Phase 4.4 — App Quality
| Task | Status | Notes |
|------|--------|-------|
| Error states on all screens | [ ] Not Started | |
| Loading skeletons | [ ] Not Started | |
| Offline handling | [ ] Not Started | |
| Push notifications (sync complete, insights) | [ ] Not Started | |
| Add to monorepo Turbo pipeline | [ ] Not Started | Not in `turbo.json` currently |
| EAS Submit (App Store / Play Store) | [ ] Not Started | |

---

## PRIORITY 5 — WEBSITE (Next.js Web)

> Next.js 15, Clerk middleware, TanStack Query, shadcn/ui.

### Phase 5.1 — Foundation
| Task | Status | Notes |
|------|--------|-------|
| Next.js 15 app router scaffolded | [✓] Done | Default template only |
| Clerk middleware (`middleware.ts`) | [ ] Not Started | Required for auth |
| TanStack Query setup (`QueryClientProvider`) | [ ] Not Started | |
| shadcn/ui install + design tokens | [ ] Not Started | |
| API client (with Clerk token injection) | [ ] Not Started | |
| Global layout + font setup | [ ] Not Started | |

### Phase 5.2 — Auth Pages
| Task | Status | Notes |
|------|--------|-------|
| `/login` page (Clerk `SignIn` component) | [ ] Not Started | |
| Redirect after login → dashboard | [ ] Not Started | |
| Clerk session handling | [ ] Not Started | |

### Phase 5.3 — Dashboard Pages
| Task | Status | Notes |
|------|--------|-------|
| `/(dashboard)/layout.tsx` — shell + sidebar + navbar | [ ] Not Started | |
| `/(dashboard)/overview` — main dashboard | [ ] Not Started | |
| `/(dashboard)/analytics` — commit graph, streaks | [ ] Not Started | |
| `/(dashboard)/github` — repos list, sync status | [ ] Not Started | |
| `/(dashboard)/projects` — project + task board | [ ] Not Started | |
| `/(dashboard)/learning` — learning log | [ ] Not Started | |
| `/(dashboard)/insights` — AI insights feed | [ ] Not Started | |
| `/(dashboard)/settings` — profile settings | [ ] Not Started | |

### Phase 5.4 — Public Pages
| Task | Status | Notes |
|------|--------|-------|
| `/(public)/u/[slug]` — public developer profile (SSR) | [ ] Not Started | |
| SEO meta tags for public profiles | [ ] Not Started | |
| Open Graph tags | [ ] Not Started | |

### Phase 5.5 — Data & UX
| Task | Status | Notes |
|------|--------|-------|
| TanStack Query hooks per domain | [ ] Not Started | |
| Optimistic updates (task status, log saves) | [ ] Not Started | |
| Server Components for initial page render | [ ] Not Started | |
| Real-time SSE for sync status polling | [ ] Not Started | |
| Responsive layout (mobile-first) | [ ] Not Started | |

---

## Milestone Summary

| Milestone | What it unlocks | Estimated effort |
|-----------|----------------|-----------------|
| **M1** — System complete (1.2–1.4) | CI/CD live, can deploy | 1 week |
| **M2** — Backend complete (2.5–2.10) | All API endpoints ready | 1–2 weeks |
| **M3** — Security hardened (3.2–3.7) | Production-safe | 3–5 days |
| **M4** — App connected to API | Mobile app fully functional | 1–2 weeks |
| **M5** — Web dashboard built | Browser-accessible product | 2–3 weeks |
| **M6** — Intelligence Layer (V2.1) | Category-defining features | 3–4 weeks |

---

## What Can Be Shipped Right Now

If you needed to demo DevTrack V2 **today**, here's what works:

[✓] Full GitHub OAuth connect + sync pipeline (runs at 2AM UTC)
[✓] Streak tracking auto-computed from commits
[✓] AI growth insights generated nightly
[✓] Projects + task management (CRUD)
[✓] Learning log (CRUD)
[✓] 3-provider AI fallback (NIM → Groq → Gemini)
[✓] Mobile app — 5 screens with auth (needs API wiring)

[-] No browser UI (web is a placeholder)
[-] Not deployed anywhere (no CI/CD)
[-] No public developer profiles

---

*Last updated: May 30, 2026 | Generated from architecture audit of docs/architecure + docs/monorepo*
