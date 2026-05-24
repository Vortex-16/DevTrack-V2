import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StreakService } from '../analytics/streak.service';
import { PrismaService } from '../database/prisma.service';

/**
 * StreakComputeJob — safety net for streak recomputation.
 * Runs at 01:00 UTC (before GitHub sync) to catch any missed event-driven updates.
 * The event-driven path (github.sync.completed) handles real-time updates.
 * This cron is the durable fallback.
 */
@Injectable()
export class StreakComputeJob {
  private readonly logger = new Logger(StreakComputeJob.name);

  constructor(
    private readonly streakService: StreakService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('0 1 * * *', { name: 'streak-nightly-compute', timeZone: 'UTC' })
  async run(): Promise<void> {
    const traceId = crypto.randomUUID();
    this.logger.log({ msg: 'Nightly streak recompute triggered', traceId });

    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });

    for (const user of users) {
      try {
        await this.streakService.recomputeFor(user.id, traceId);
      } catch (error) {
        this.logger.error({
          msg: 'Streak recompute failed',
          userId: user.id,
          traceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
