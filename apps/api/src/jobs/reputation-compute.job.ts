import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { DeveloperReputationService } from '../intelligence/developer-reputation/developer-reputation.service';

/**
 * ReputationComputeJob — computes developer reputation scores.
 * Runs weekly on Sunday at 05:00 UTC.
 */
@Injectable()
export class ReputationComputeJob {
  private readonly logger = new Logger(ReputationComputeJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reputationService: DeveloperReputationService,
  ) {}

  @Cron('0 5 * * 0', { name: 'reputation-compute-weekly', timeZone: 'UTC' }) // Sunday 05:00 UTC
  async compute() {
    this.logger.log('Starting reputation computation');

    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });

    for (const user of users) {
      try {
        await this.reputationService.computeReputation(user.id);
      } catch (error) {
        this.logger.error(`Failed to compute reputation for user ${user.id}:`, error);
      }
    }

    this.logger.log(`Reputation computation complete (${users.length} users)`);
  }
}
