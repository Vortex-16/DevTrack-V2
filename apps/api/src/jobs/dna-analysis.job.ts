import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';

/**
 * DnaAnalysisJob — computes a lightweight ProjectDNA fingerprint per project.
 * Run nightly for active projects.
 */
@Injectable()
export class DnaAnalysisJob {
  private readonly logger = new Logger(DnaAnalysisJob.name);
  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 2 * * *') // daily at 02:00 UTC
  async analyze() {
    this.logger.log('Starting ProjectDNA analysis');

    const projects = await this.prisma.project.findMany({ where: { deletedAt: null } });
    for (const p of projects) {
      // Placeholder fingerprint: count of repos, tasks, and recent commits
      const repoCount = await this.prisma.repository.count({ where: { userId: p.userId } });
      const taskCount = await this.prisma.task.count({ where: { projectId: p.id } });
      const recentCommits = await this.prisma.commit.count({ where: { repository: { userId: p.userId }, committedAt: { gte: new Date(Date.now() - 90 * 86400_000) } } });

      const fingerprint = { repoCount, taskCount, recentCommits };

      await this.prisma.projectDNA.upsert({
        where: { projectId: p.id },
        create: { projectId: p.id, fingerprint, summary: `repos:${repoCount} tasks:${taskCount}` },
        update: { fingerprint, summary: `repos:${repoCount} tasks:${taskCount}`, updatedAt: new Date() },
      });
    }

    this.logger.log('ProjectDNA analysis complete');
  }
}
