import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { DeveloperGraphService } from '../intelligence/developer-graph/developer-graph.service';

/**
 * GraphComputeJob — computes DeveloperGraph snapshots periodically.
 * Refactored to use DeveloperGraphService (thin trigger pattern).
 */
@Injectable()
export class GraphComputeJob {
  private readonly logger = new Logger(GraphComputeJob.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly graphService: DeveloperGraphService,
  ) {}

  @Cron('0 5 * * 1', { name: 'graph-weekly-compute', timeZone: 'UTC' }) // every Monday at 05:00 UTC
  async compute(): Promise<void> {
    this.logger.log('Starting DeveloperGraph computation');

    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });

    for (const user of users) {
      try {
        await this.graphService.computeGraph(user.id);
      } catch (error) {
        this.logger.error(`Failed to compute graph for user ${user.id}:`, error);
      }
    }

    this.logger.log(`DeveloperGraph computation complete (${users.length} users)`);
  }
}
