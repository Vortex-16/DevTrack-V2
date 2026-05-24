// ─────────────────────────────────────────────────────────────
// @devtrack/shared-types
// Pure TypeScript — zero runtime dependencies.
// Schema-derived types flow: Prisma schema → here → API → Frontend
// ─────────────────────────────────────────────────────────────

// ── Enums (mirrored from Prisma for frontend consumption) ────

export enum Plan {
  FREE = 'FREE',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum SyncStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
}

export enum InsightType {
  COMMIT_PATTERN = 'COMMIT_PATTERN',
  LANGUAGE_TREND = 'LANGUAGE_TREND',
  PRODUCTIVITY_SCORE = 'PRODUCTIVITY_SCORE',
  GROWTH_SUMMARY = 'GROWTH_SUMMARY',
  REPO_ANALYSIS = 'REPO_ANALYSIS',
}

export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  BLOCKED = 'BLOCKED',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum Mood {
  GREAT = 'GREAT',
  GOOD = 'GOOD',
  NEUTRAL = 'NEUTRAL',
  TIRED = 'TIRED',
  BLOCKED = 'BLOCKED',
}

// ── API Response Envelopes ───────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}

export interface ApiError {
  statusCode: number;
  message: string;
  traceId?: string;
  timestamp: string;
}

// ── User Types ───────────────────────────────────────────────

export interface UserPublic {
  id: string;
  username: string | null;
  plan: Plan;
  profile: ProfilePublic | null;
  createdAt: string;
}

export interface ProfilePublic {
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  website: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  isPublic: boolean;
}

// ── GitHub Types ─────────────────────────────────────────────

export interface RepositorySummary {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  isPrivate: boolean;
  starCount: number;
  forkCount: number;
  lastPushedAt: string | null;
  syncedAt: string | null;
}

export interface CommitSummary {
  id: string;
  sha: string;
  message: string;
  authorLogin: string | null;
  committedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
}

export interface SyncJobStatus {
  id: string;
  status: SyncStatus;
  startedAt: string | null;
  endedAt: string | null;
  errorMsg: string | null;
  meta: SyncJobMeta | null;
  createdAt: string;
}

export interface SyncJobMeta {
  reposProcessed: number;
  commitsIngested: number;
  reposSkipped: number;
}

// ── Analytics Types ──────────────────────────────────────────

export interface StreakDay {
  date: string; // ISO date "2026-05-10"
  committed: boolean;
  mood: Mood | null;
  noteCount: number;
}

export interface VelocityMetrics {
  commits7d: number;
  commits30d: number;
  avgCommitsPerDay7d: number;
  avgCommitsPerDay30d: number;
  topLanguages: LanguageStat[];
  activeDays7d: number;
  activeDays30d: number;
}

export interface LanguageStat {
  language: string;
  percentage: number;
  commitCount: number;
}

export interface ProductivityScore {
  score: number; // 0-100
  trend: 'up' | 'down' | 'stable';
  breakdown: {
    consistency: number;
    volume: number;
    diversity: number;
  };
}

// ── AI Types ─────────────────────────────────────────────────

export interface AIInsightResponse {
  id: string;
  provider: string;
  model: string;
  response: string;
  tokensUsed: number | null;
  latencyMs: number | null;
  createdAt: string;
}

// ── Project Types ────────────────────────────────────────────

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  deadline: string | null;
  taskCounts: {
    total: number;
    done: number;
    inProgress: number;
    blocked: number;
  };
  createdAt: string;
}

export interface TaskSummary {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  completedAt: string | null;
}

// ── Learning Types ───────────────────────────────────────────

export interface LearningLogEntry {
  id: string;
  topic: string;
  notes: string | null;
  source: string | null;
  tags: string[];
  duration: number | null;
  loggedAt: string;
}
