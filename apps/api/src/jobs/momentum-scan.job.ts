import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';

/**
 * MomentumScanJob — simple burnout/momentum signal scanner.
 * Run daily to compute MomentumSignal entries.
 */
@Injectable()
export class MomentumScanJob {
  private readonly logger = new Logger(MomentumScanJob.name);
  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *') // daily at 03:00 UTC
  async scan() {
    this.logger.log('Starting MomentumScan');

    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const u of users) {
      const commits14d = await this.prisma.commit.count({ where: { repository: { userId: u.id }, committedAt: { gte: new Date(Date.now() - 14 * 86400_000) } } });
      const velocity = commits14d / 14;
      const burnoutRisk = Math.max(0, Math.min(1, 0.5 - velocity * 0.05));

      await this.prisma.momentumSignal.create({ data: { userId: u.id, windowDays: 14, velocity, burnoutRisk } });
    }

    this.logger.log('MomentumScan complete');
  }
}
