import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { MomentumSignalService } from '../intelligence/momentum-signal/momentum-signal.service';

/**
 * MomentumScanJob — simple burnout/momentum signal scanner.
 * Run daily to compute MomentumSignal entries.
 * Refactored to use MomentumSignalService (thin trigger pattern).
 */
@Injectable()
export class MomentumScanJob {
  private readonly logger = new Logger(MomentumScanJob.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly momentumService: MomentumSignalService,
  ) {}

  @Cron('0 3 * * *') // daily at 03:00 UTC
  async scan() {
    this.logger.log('Starting MomentumScan');

    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });

    for (const user of users) {
      try {
        await this.momentumService.computeMomentum(user.id);
      } catch (error) {
        this.logger.error(`Failed to compute momentum for user ${user.id}:`, error);
      }
    }

    this.logger.log(`MomentumScan complete (${users.length} users)`);
  }
}
