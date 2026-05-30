# DevTrack V2 Backend Completion Plan — Intelligence Layer

## Executive Summary

**Goal**: Complete the DevTrack V2 backend by implementing the Intelligence Layer (Phase 2.11) with full API surface, service logic, and proper integration.

**Current State**: 
- ✓ Schema models exist for all 8 intelligence features
- ✓ 3 jobs compute data (DeveloperGraph, ProjectDNA, MomentumSignal)
- ✗ **Zero API endpoints** to access computed data
- ✗ **Zero service layer** to encapsulate business logic
- ✗ 5 features completely unimplemented (BuildMemory, SkillConfidence, DeveloperReputation, CoachSession, CommitQualityScore)

**Outcome**: Full intelligence layer with 30+ new endpoints, 8 services, proper DTOs, and updated ROADMAP.

---

## Architecture Pattern (Following Existing Conventions)

Based on audit of `analytics/`, `projects/`, `learning/` modules:

```
apps/api/src/intelligence/
├── intelligence.module.ts          # Aggregate module
├── intelligence.controller.ts      # Unified controller (or split per feature)
│
├── developer-graph/
│   ├── developer-graph.service.ts
│   └── dto/
│       ├── graph-response.dto.ts
│       └── graph-query.dto.ts
│
├── project-dna/
│   ├── project-dna.service.ts
│   └── dto/
│       ├── dna-response.dto.ts
│       └── analyze-request.dto.ts
│
├── build-memory/
│   ├── build-memory.service.ts
│   └── dto/
│       ├── create-memory.dto.ts
│       ├── update-memory.dto.ts
│       └── memory-response.dto.ts
│
├── momentum-signal/
│   ├── momentum-signal.service.ts
│   └── dto/
│       ├── momentum-response.dto.ts
│       └── momentum-history.dto.ts
│
├── skill-confidence/
│   ├── skill-confidence.service.ts
│   └── dto/
│       ├── skill-response.dto.ts
│       └── update-skill.dto.ts
│
├── developer-reputation/
│   ├── developer-reputation.service.ts
│   └── dto/
│       └── reputation-response.dto.ts
│
├── coach-session/
│   ├── coach-session.service.ts
│   └── dto/
│       ├── create-session.dto.ts
│       └── session-response.dto.ts
│
└── commit-quality/
    ├── commit-quality.service.ts
    └── dto/
        └── quality-response.dto.ts
```

---

## Implementation Phases

### Phase 1: Expose Existing Computed Data (High Priority)
**Goal**: Make DeveloperGraph, ProjectDNA, MomentumSignal data accessible via API

#### 1.1 DeveloperGraph Service & Endpoints
**Service**: `apps/api/src/intelligence/developer-graph/developer-graph.service.ts`
- `getGraph(userId: string)` — fetch latest graph snapshot
- `getNeighbors(userId: string)` — extract neighbors from graph JSON
- `getCentralityScore(userId: string)` — return score 0-100
- `getGraphHistory(userId: string, limit: number)` — historical snapshots

**Endpoints**: `/api/v1/intelligence/graph`
- `GET /graph` — current user's graph
- `GET /graph/neighbors` — current user's collaboration network
- `GET /graph/score` — current user's centrality score
- `GET /graph/history` — historical graph snapshots

**Job Refactor**: Move graph computation logic from `GraphComputeJob` into service; job becomes thin trigger

---

#### 1.2 ProjectDNA Service & Endpoints
**Service**: `apps/api/src/intelligence/project-dna/project-dna.service.ts`
- `getDNA(projectId: string)` — fetch DNA fingerprint
- `analyzeDNA(projectId: string)` — trigger on-demand analysis
- `compareDNA(projectId1: string, projectId2: string)` — similarity score

**Endpoints**: `/api/v1/intelligence/dna`
- `GET /dna/:projectId` — project DNA fingerprint
- `POST /dna/:projectId/analyze` — trigger analysis
- `GET /dna/compare?projects=id1,id2` — compare projects

**Job Refactor**: Move DNA computation into service; enhance fingerprint beyond simple counts (add language breakdown, file structure depth, dependency count)

---

#### 1.3 MomentumSignal Service & Endpoints
**Service**: `apps/api/src/intelligence/momentum-signal/momentum-signal.service.ts`
- `getCurrentMomentum(userId: string)` — latest signal
- `getMomentumHistory(userId: string, days: number)` — time series
- `getBurnoutRisk(userId: string)` — current burnout risk 0-1
- `getVelocityTrend(userId: string)` — velocity over time

**Endpoints**: `/api/v1/intelligence/momentum`
- `GET /momentum` — current momentum signal
- `GET /momentum/history` — historical momentum data
- `GET /momentum/burnout-risk` — burnout risk score
- `GET /momentum/velocity` — velocity trend

**Job Refactor**: Move momentum computation into service; improve burnout heuristic (consider commit size variance, time-of-day patterns, weekend work)

---

### Phase 2: Implement Missing CRUD Features (Medium Priority)

#### 2.1 BuildMemory Service & Endpoints
**Service**: `apps/api/src/intelligence/build-memory/build-memory.service.ts`
- `create(userId: string, data: CreateMemoryDto)` — save memory
- `findAll(userId: string, filters?: { tags?: string[] })` — list memories
- `findOne(id: string, userId: string)` — get single memory
- `update(id: string, userId: string, data: UpdateMemoryDto)` — update memory
- `delete(id: string, userId: string)` — soft delete memory
- `search(userId: string, query: string)` — full-text search (Postgres `@@` operator)

**Endpoints**: `/api/v1/intelligence/memory`
- `POST /memory` — create memory
- `GET /memory` — list memories (with tag filters)
- `GET /memory/:id` — get memory
- `PATCH /memory/:id` — update memory
- `DELETE /memory/:id` — delete memory
- `GET /memory/search?q=...` — search memories

**DTOs**:
```typescript
class CreateMemoryDto {
  @IsString() @IsNotEmpty() title: string;
  @IsString() @IsNotEmpty() content: string;
  @IsArray() @IsString({ each: true }) tags: string[];
}

class UpdateMemoryDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsArray() tags?: string[];
}
```

---

#### 2.2 SkillConfidence Service & Endpoints
**Service**: `apps/api/src/intelligence/skill-confidence/skill-confidence.service.ts`
- `inferSkills(userId: string)` — infer skills from repos/commits (language breakdown, framework detection)
- `getSkills(userId: string)` — list all skills with confidence
- `updateSkill(userId: string, skill: string, confidence: number)` — manual override
- `getEvidence(userId: string, skill: string)` — retrieve evidence JSON

**Endpoints**: `/api/v1/intelligence/skills`
- `GET /skills` — list skills with confidence
- `POST /skills/infer` — trigger skill inference
- `PATCH /skills/:skill` — update confidence
- `GET /skills/:skill/evidence` — get evidence

**Inference Logic**:
- Parse `Repository.language` → primary language skills
- Parse `Repository.topics` → framework/tool skills (e.g., "react", "docker")
- Commit count per language → confidence boost
- Recent activity (last 90 days) → higher confidence

**DTOs**:
```typescript
class SkillResponseDto {
  skill: string;
  confidence: number; // 0-1
  evidence?: {
    repos: string[];
    commitCount: number;
    lastUsed: Date;
  };
}

class UpdateSkillDto {
  @IsNumber() @Min(0) @Max(1) confidence: number;
}
```

---

#### 2.3 DeveloperReputation Service & Endpoints
**Service**: `apps/api/src/intelligence/developer-reputation/developer-reputation.service.ts`
- `computeReputation(userId: string)` — compute reputation score
- `getReputation(userId: string)` — fetch reputation
- `getBreakdown(userId: string)` — sources breakdown

**Endpoints**: `/api/v1/intelligence/reputation`
- `GET /reputation` — current reputation
- `POST /reputation/compute` — trigger computation
- `GET /reputation/breakdown` — score breakdown

**Scoring Algorithm**:
```typescript
reputation = (
  commitCount * 0.3 +
  repoCount * 0.2 +
  centralityScore * 0.2 +
  streakDays * 0.15 +
  learningLogCount * 0.1 +
  publicProfileBonus * 0.05
) / maxPossible * 100
```

**DTOs**:
```typescript
class ReputationResponseDto {
  score: number; // 0-100
  sources: {
    commits: number;
    repos: number;
    centrality: number;
    streak: number;
    learning: number;
    publicProfile: boolean;
  };
  computedAt: Date;
}
```

---

### Phase 3: Implement AI-Powered Features (High Value)

#### 3.1 CoachSession Service & Endpoints
**Service**: `apps/api/src/intelligence/coach-session/coach-session.service.ts`
- `createSession(userId: string, prompt: string)` — AI coaching session
- `getSessions(userId: string, limit: number)` — session history
- `getSession(id: string, userId: string)` — single session

**Endpoints**: `/api/v1/intelligence/coach`
- `POST /coach` — create coaching session
- `GET /coach` — list sessions
- `GET /coach/:id` — get session

**AI Integration**:
- Use existing `AiService` with fallback chain (NIM → Groq → Gemini)
- System prompt: "You are an Engineering Coach. Analyze the developer's data and provide actionable growth advice."
- Context injection: recent commits, streak, velocity, skills, momentum
- Store prompt + response in `CoachSession` table

**DTOs**:
```typescript
class CreateCoachSessionDto {
  @IsString() @IsNotEmpty() @MaxLength(2000) prompt: string;
}

class CoachSessionResponseDto {
  id: string;
  prompt: string;
  response: string;
  model: string;
  createdAt: Date;
}
```

---

#### 3.2 CommitQualityScore Service & Endpoints
**Service**: `apps/api/src/intelligence/commit-quality/commit-quality.service.ts`
- `scoreCommit(commitId: string)` — compute quality score
- `getScore(commitId: string)` — fetch score
- `getTopCommits(userId: string, limit: number)` — best commits
- `getWorstCommits(userId: string, limit: number)` — worst commits

**Endpoints**: `/api/v1/intelligence/commit-quality`
- `GET /commit-quality/:commitId` — get commit score
- `POST /commit-quality/:commitId/score` — trigger scoring
- `GET /commit-quality/top` — top commits
- `GET /commit-quality/worst` — worst commits

**Scoring Heuristics**:
```typescript
score = (
  messageQuality * 0.3 +      // length, conventional commits format
  filesChanged * 0.2 +         // 1-5 files = good, >20 = bad
  additionsBalance * 0.2 +     // additions vs deletions ratio
  commitFrequency * 0.15 +     // not too frequent (avoid spam)
  timeOfDay * 0.15             // working hours vs late night
) / maxPossible * 100
```

**DTOs**:
```typescript
class CommitQualityResponseDto {
  commitId: string;
  score: number; // 0-100
  details: {
    messageQuality: number;
    filesChanged: number;
    additionsBalance: number;
    commitFrequency: number;
    timeOfDay: number;
  };
  computedAt: Date;
}
```

---

### Phase 4: Job Refactoring & Service Integration

#### 4.1 Refactor Existing Jobs
**Pattern**: Jobs should be thin triggers; business logic lives in services

**Before**:
```typescript
@Cron('0 3 * * *')
async scan() {
  const users = await this.prisma.user.findMany(...);
  for (const u of users) {
    // 20 lines of computation logic
  }
}
```

**After**:
```typescript
@Cron('0 3 * * *')
async scan() {
  const users = await this.prisma.user.findMany(...);
  for (const u of users) {
    await this.momentumService.computeMomentum(u.id);
  }
}
```

**Jobs to Refactor**:
- `GraphComputeJob` → call `DeveloperGraphService.computeGraph(userId)`
- `DnaAnalysisJob` → call `ProjectDnaService.analyzeDNA(projectId)`
- `MomentumScanJob` → call `MomentumSignalService.computeMomentum(userId)`

---

#### 4.2 Add New Jobs
**SkillInferenceJob** — weekly skill inference
```typescript
@Cron('0 4 * * 0') // Sunday 04:00 UTC
async infer() {
  const users = await this.prisma.user.findMany(...);
  for (const u of users) {
    await this.skillService.inferSkills(u.id);
  }
}
```

**ReputationComputeJob** — weekly reputation scoring
```typescript
@Cron('0 5 * * 0') // Sunday 05:00 UTC
async compute() {
  const users = await this.prisma.user.findMany(...);
  for (const u of users) {
    await this.reputationService.computeReputation(u.id);
  }
}
```

---

### Phase 5: Module Wiring & Integration

#### 5.1 Create IntelligenceModule
**File**: `apps/api/src/intelligence/intelligence.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { IntelligenceController } from './intelligence.controller';
import { DeveloperGraphService } from './developer-graph/developer-graph.service';
import { ProjectDnaService } from './project-dna/project-dna.service';
import { BuildMemoryService } from './build-memory/build-memory.service';
import { MomentumSignalService } from './momentum-signal/momentum-signal.service';
import { SkillConfidenceService } from './skill-confidence/skill-confidence.service';
import { DeveloperReputationService } from './developer-reputation/developer-reputation.service';
import { CoachSessionService } from './coach-session/coach-session.service';
import { CommitQualityService } from './commit-quality/commit-quality.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule], // for CoachSessionService
  controllers: [IntelligenceController],
  providers: [
    DeveloperGraphService,
    ProjectDnaService,
    BuildMemoryService,
    MomentumSignalService,
    SkillConfidenceService,
    DeveloperReputationService,
    CoachSessionService,
    CommitQualityService,
  ],
  exports: [
    DeveloperGraphService,
    MomentumSignalService,
    SkillConfidenceService,
    DeveloperReputationService,
  ],
})
export class IntelligenceModule {}
```

---

#### 5.2 Wire into AppModule
**File**: `apps/api/src/app.module.ts`

Add import:
```typescript
import { IntelligenceModule } from './intelligence/intelligence.module';
```

Add to imports array (after `LearningModule`):
```typescript
IntelligenceModule,
```

---

#### 5.3 Update JobsModule
**File**: `apps/api/src/jobs/jobs.module.ts`

Add new jobs:
```typescript
import { SkillInferenceJob } from './skill-inference.job';
import { ReputationComputeJob } from './reputation-compute.job';
```

Add to providers:
```typescript
providers: [
  // ... existing jobs
  SkillInferenceJob,
  ReputationComputeJob,
],
```

Import `IntelligenceModule`:
```typescript
imports: [IntelligenceModule],
```

---

### Phase 6: Testing & Validation

#### 6.1 Update Integration Test
**File**: `dev/test-api.js`

Add intelligence layer tests:
```javascript
console.log('\n--- Running Intelligence Layer Tests ---');

// DeveloperGraph
const graphRes = await request('/api/v1/intelligence/graph', 'GET', null, authHeader);
printResult('Get Developer Graph', graphRes, 200);

// MomentumSignal
const momentumRes = await request('/api/v1/intelligence/momentum', 'GET', null, authHeader);
printResult('Get Momentum Signal', momentumRes, 200);

// BuildMemory
const createMemoryRes = await request('/api/v1/intelligence/memory', 'POST', {
  title: 'Learned NestJS Guards',
  content: 'Guards execute before route handlers and can deny access.',
  tags: ['nestjs', 'auth']
}, authHeader);
printResult('Create Build Memory', createMemoryRes, 201);

// SkillConfidence
const skillsRes = await request('/api/v1/intelligence/skills', 'GET', null, authHeader);
printResult('Get Skills', skillsRes, 200);

// DeveloperReputation
const reputationRes = await request('/api/v1/intelligence/reputation', 'GET', null, authHeader);
printResult('Get Reputation', reputationRes, 200);

// CoachSession
const coachRes = await request('/api/v1/intelligence/coach', 'POST', {
  prompt: 'How can I improve my commit quality?'
}, authHeader);
printResult('Create Coach Session', coachRes, 201);
```

---

#### 6.2 Manual Testing Checklist
- [ ] All endpoints return 401 without auth
- [ ] All endpoints return 200/201 with valid token
- [ ] Graph endpoint returns valid JSON with neighbors array
- [ ] Momentum endpoint returns velocity + burnoutRisk
- [ ] BuildMemory CRUD works (create, list, update, delete)
- [ ] Skills endpoint returns inferred skills from repos
- [ ] Reputation endpoint returns score 0-100 with breakdown
- [ ] Coach endpoint returns AI response
- [ ] Commit quality endpoint returns score with details

---

### Phase 7: Documentation & ROADMAP Update

#### 7.1 Update ROADMAP.md
**File**: `docs/ROADMAP.md`

Update Phase 2.11 status from `~Partial` to `[✓] Done`:

```markdown
### Phase 2.11 — Intelligence Layer (V2.1) [✓] COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| `intelligence/` module scaffold | [✓] Done | Full module with 8 services |
| `DeveloperGraph` — 10-dimension score | [✓] Done | Service + 4 endpoints |
| `ProjectDNA` — repo architectural fingerprint | [✓] Done | Service + 3 endpoints |
| `BuildMemory` — personal engineering archive | [✓] Done | Full CRUD + search |
| `MomentumSignal` — burnout / velocity detection | [✓] Done | Service + 4 endpoints |
| `SkillConfidence` — evidence-based skills | [✓] Done | Inference + 4 endpoints |
| `DeveloperReputation` — credibility score | [✓] Done | Scoring + 3 endpoints |
| `CoachSession` — AI Engineering Coach | [✓] Done | AI-powered + 3 endpoints |
| `CommitQualityScore` — per-commit scoring | [✓] Done | Heuristic scoring + 4 endpoints |
```

Update overall backend completion:
```markdown
| 2 | Backend (NestJS API) | ~95% |
```

Add to "What Can Be Shipped Right Now":
```markdown
[✓] Intelligence Layer — 30+ endpoints for developer insights
[✓] AI Engineering Coach — personalized growth advice
[✓] Skill inference from code — evidence-based skill tracking
[✓] Developer reputation scoring — 0-100 credibility score
[✓] Commit quality analysis — per-commit scoring
```

---

#### 7.2 Create API Documentation
**File**: `docs/API_INTELLIGENCE.md`

Document all 30+ endpoints with:
- Method + path
- Auth requirements
- Request body schema
- Response schema
- Example curl commands

---

## File Checklist (New Files to Create)

### Services (8 files)
- [ ] `apps/api/src/intelligence/developer-graph/developer-graph.service.ts`
- [ ] `apps/api/src/intelligence/project-dna/project-dna.service.ts`
- [ ] `apps/api/src/intelligence/build-memory/build-memory.service.ts`
- [ ] `apps/api/src/intelligence/momentum-signal/momentum-signal.service.ts`
- [ ] `apps/api/src/intelligence/skill-confidence/skill-confidence.service.ts`
- [ ] `apps/api/src/intelligence/developer-reputation/developer-reputation.service.ts`
- [ ] `apps/api/src/intelligence/coach-session/coach-session.service.ts`
- [ ] `apps/api/src/intelligence/commit-quality/commit-quality.service.ts`

### Controllers (1 file, unified)
- [ ] `apps/api/src/intelligence/intelligence.controller.ts`

### DTOs (16+ files)
- [ ] `apps/api/src/intelligence/developer-graph/dto/graph-response.dto.ts`
- [ ] `apps/api/src/intelligence/project-dna/dto/dna-response.dto.ts`
- [ ] `apps/api/src/intelligence/build-memory/dto/create-memory.dto.ts`
- [ ] `apps/api/src/intelligence/build-memory/dto/update-memory.dto.ts`
- [ ] `apps/api/src/intelligence/build-memory/dto/memory-response.dto.ts`
- [ ] `apps/api/src/intelligence/momentum-signal/dto/momentum-response.dto.ts`
- [ ] `apps/api/src/intelligence/skill-confidence/dto/skill-response.dto.ts`
- [ ] `apps/api/src/intelligence/skill-confidence/dto/update-skill.dto.ts`
- [ ] `apps/api/src/intelligence/developer-reputation/dto/reputation-response.dto.ts`
- [ ] `apps/api/src/intelligence/coach-session/dto/create-session.dto.ts`
- [ ] `apps/api/src/intelligence/coach-session/dto/session-response.dto.ts`
- [ ] `apps/api/src/intelligence/commit-quality/dto/quality-response.dto.ts`

### Modules (1 file)
- [ ] `apps/api/src/intelligence/intelligence.module.ts`

### Jobs (2 new files)
- [ ] `apps/api/src/jobs/skill-inference.job.ts`
- [ ] `apps/api/src/jobs/reputation-compute.job.ts`

### Documentation (1 file)
- [ ] `docs/API_INTELLIGENCE.md`

### Modified Files (5 files)
- [ ] `apps/api/src/app.module.ts` — add IntelligenceModule
- [ ] `apps/api/src/jobs/jobs.module.ts` — add new jobs + import IntelligenceModule
- [ ] `apps/api/src/jobs/graph-compute.job.ts` — refactor to use service
- [ ] `apps/api/src/jobs/dna-analysis.job.ts` — refactor to use service
- [ ] `apps/api/src/jobs/momentum-scan.job.ts` — refactor to use service
- [ ] `dev/test-api.js` — add intelligence layer tests
- [ ] `docs/ROADMAP.md` — update Phase 2.11 to [✓] Done

**Total**: 36 new files + 7 modified files

---

## Estimated Effort

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | Expose existing data (3 services + endpoints) | 4-6 hours |
| Phase 2 | CRUD features (3 services + endpoints) | 6-8 hours |
| Phase 3 | AI features (2 services + endpoints) | 4-6 hours |
| Phase 4 | Job refactoring | 2-3 hours |
| Phase 5 | Module wiring | 1-2 hours |
| Phase 6 | Testing | 2-3 hours |
| Phase 7 | Documentation | 1-2 hours |
| **Total** | | **20-30 hours** |

---

## Success Criteria

- [ ] All 8 intelligence services implemented
- [ ] 30+ new endpoints accessible via API
- [ ] Integration test passes with all intelligence endpoints
- [ ] ROADMAP.md updated to reflect completion
- [ ] Backend completion raised from 78% to 95%
- [ ] Zero breaking changes to existing endpoints
- [ ] All endpoints protected with `ClerkAuthGuard`
- [ ] All DTOs validated with `class-validator`
- [ ] Jobs refactored to use services (thin trigger pattern)

---

## Risk Mitigation

**Risk**: Breaking existing functionality
**Mitigation**: Run full integration test suite before and after; no changes to existing modules except job refactoring

**Risk**: AI provider costs for CoachSession
**Mitigation**: Reuse existing cost guard pattern from `AiAnalysisJob` (1/user/day limit)

**Risk**: Performance degradation from complex queries
**Mitigation**: Add indexes to Prisma schema if needed; use `select` to limit fields

**Risk**: Incomplete skill inference
**Mitigation**: Start with simple language + topic parsing; iterate based on user feedback

---

## Next Steps After Plan Approval

1. Create directory structure: `apps/api/src/intelligence/`
2. Implement Phase 1 (expose existing data) — highest ROI
3. Run integration tests after each phase
4. Update ROADMAP.md incrementally
5. Deploy to Railway and verify in production
