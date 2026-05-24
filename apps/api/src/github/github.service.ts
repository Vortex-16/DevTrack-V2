import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../database/prisma.service';
import { GithubApiClient } from './github-api.client';
import { GithubTokenService } from './github-token.service';
import { Prisma, SyncStatus } from '@devtrack/database';

/**
 * GithubService — orchestrates the full sync pipeline.
 *
 * Flow:
 *   1. Find all users with connected GitHub accounts
 *   2. For each user: decrypt token, check rate limit, fetch repos + commits
 *   3. Upsert to DB (idempotent — safe to re-run)
 *   4. Update SyncJob record throughout for observability
 *   5. Emit 'github.sync.completed' event for analytics recomputation
 *
 * This method is called by GithubSyncJob — never called directly from HTTP.
 */
@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly apiClient: GithubApiClient,
    private readonly tokenService: GithubTokenService,
    private readonly events: EventEmitter2,
  ) {}

  async runScheduledSync(traceId: string = crypto.randomUUID()): Promise<void> {
    this.logger.log({ msg: 'Starting scheduled GitHub sync', traceId });

    const accounts = await this.prisma.gitHubAccount.findMany({
      include: { user: true },
    });

    this.logger.log({
      msg: `Found ${accounts.length} accounts to sync`,
      traceId,
    });

    for (const account of accounts) {
      await this.syncAccount(account.userId, account, traceId);
    }

    this.logger.log({ msg: 'Scheduled GitHub sync complete', traceId });
  }

  private async syncAccount(
    userId: string,
    account: { id: string; encryptedToken: string; login: string },
    traceId: string,
  ): Promise<void> {
    // Create SyncJob record for observability
    const syncJob = await this.prisma.syncJob.create({
      data: {
        userId,
        status: SyncStatus.RUNNING,
        traceId,
        startedAt: new Date(),
      },
    });

    try {
      const token = this.tokenService.decrypt(account.encryptedToken);
      const octokit = this.apiClient.createClient(token);

      // Pre-flight rate limit check
      const rateLimit = await this.apiClient.getRateLimitInfo(octokit);
      if (!this.apiClient.isSafeToFetch(rateLimit)) {
        this.logger.warn({
          msg: 'Rate limit too low — skipping user',
          userId,
          traceId,
          remaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt,
        });
        await this.updateSyncJob(syncJob.id, SyncStatus.RATE_LIMITED, {
          reposProcessed: 0,
          commitsIngested: 0,
          reposSkipped: 0,
        });
        return;
      }

      // Fetch and upsert repositories
      const repos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
        per_page: 100,
        sort: 'pushed',
      });

      let commitsIngested = 0;

      for (const repo of repos) {
        const upsertedRepo = await this.prisma.repository.upsert({
          where: { githubRepoId: String(repo.id) },
          create: {
            userId,
            githubRepoId: String(repo.id),
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description ?? null,
            language: repo.language ?? null,
            isPrivate: repo.private,
            isFork: repo.fork,
            starCount: repo.stargazers_count ?? 0,
            forkCount: repo.forks_count ?? 0,
            openIssueCount: repo.open_issues_count ?? 0,
            topics: repo.topics ?? [],
            lastPushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
            syncedAt: new Date(),
          },
          update: {
            description: repo.description ?? null,
            language: repo.language ?? null,
            starCount: repo.stargazers_count ?? 0,
            forkCount: repo.forks_count ?? 0,
            openIssueCount: repo.open_issues_count ?? 0,
            topics: repo.topics ?? [],
            lastPushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
            syncedAt: new Date(),
          },
        });

        // Fetch recent commits (last 90 days only — bounded ingestion)
        const since = new Date();
        since.setDate(since.getDate() - 90);

        try {
          const commits = await octokit.paginate(octokit.repos.listCommits, {
            owner: account.login,
            repo: repo.name,
            since: since.toISOString(),
            per_page: 100,
          });

          for (const commit of commits) {
            if (!commit.commit.author?.date) continue;
            await this.prisma.commit.upsert({
              where: { sha: commit.sha },
              create: {
                repositoryId: upsertedRepo.id,
                sha: commit.sha,
                message: commit.commit.message.slice(0, 500), // cap length
                authorLogin: commit.author?.login ?? null,
                authorEmail: commit.commit.author?.email ?? null,
                committedAt: new Date(commit.commit.author.date),
                additions: commit.stats?.additions ?? 0,
                deletions: commit.stats?.deletions ?? 0,
                changedFiles: commit.stats?.total ?? 0,
              },
              update: {}, // SHA is immutable — no updates needed
            });
            commitsIngested++;
          }
        } catch (_e) {
          // Some repos may block commit listing — non-fatal, continue
          this.logger.warn({ msg: 'Failed to fetch commits', repo: repo.full_name, traceId });
        }
      }

      await this.updateSyncJob(syncJob.id, SyncStatus.SUCCESS, {
        reposProcessed: repos.length,
        commitsIngested,
        reposSkipped: 0,
      });

      // Emit domain event — analytics engine listens to recompute streaks/velocity
      this.events.emit('github.sync.completed', { userId, traceId });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error({ msg: 'Sync failed', userId, traceId, error: errorMsg });
      await this.updateSyncJob(syncJob.id, SyncStatus.FAILED, undefined, errorMsg);
    }
  }

  private async updateSyncJob(
    id: string,
    status: SyncStatus,
    meta?: { reposProcessed: number; commitsIngested: number; reposSkipped: number },
    errorMsg?: string,
  ): Promise<void> {
    await this.prisma.syncJob.update({
      where: { id },
      data: {
        status,
        endedAt: new Date(),
        // Prisma JSON null requires Prisma.JsonNull, not plain null
        meta: meta !== undefined ? (meta as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        errorMsg: errorMsg ?? null,
      },
    });
  }
}
