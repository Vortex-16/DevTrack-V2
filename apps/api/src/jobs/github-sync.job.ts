import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GithubService } from '../github/github.service';

/**
 * GithubSyncJob — trigger only.
 * Runs nightly at 02:00 UTC to avoid peak GitHub API usage.
 *
 * BullMQ upgrade path:
 *   Replace @Cron with: this.queue.add('github-sync', {}, { repeat: { cron: '0 2 * * *' } })
 *   No changes needed in GithubService.
 */
@Injectable()
export class GithubSyncJob {
  private readonly logger = new Logger(GithubSyncJob.name);

  constructor(private readonly githubService: GithubService) {}

  @Cron('0 2 * * *', { name: 'github-nightly-sync', timeZone: 'UTC' })
  async run(): Promise<void> {
    const traceId = crypto.randomUUID();
    this.logger.log({ msg: 'Nightly GitHub sync triggered', traceId });
    await this.githubService.runScheduledSync(traceId);
  }
}
