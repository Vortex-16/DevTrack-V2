import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { ProjectDnaService } from '../intelligence/project-dna/project-dna.service';

/**
 * DnaAnalysisJob — computes a lightweight ProjectDNA fingerprint per project.
 * Run nightly for active projects.
 * Refactored to use ProjectDnaService (thin trigger pattern).
 */
@Injectable()
export class DnaAnalysisJob {
  private readonly logger = new Logger(DnaAnalysisJob.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly dnaService: ProjectDnaService,
  ) {}

  @Cron('0 2 * * *') // daily at 02:00 UTC
  async analyze() {
    this.logger.log('Starting ProjectDNA analysis');

    const projects = await this.prisma.project.findMany({
      where: { deletedAt: null },
      select: { id: true, userId: true },
    });

    for (const project of projects) {
      try {
        await this.dnaService.computeDNA(project.id, project.userId);
      } catch (error) {
        this.logger.error(`Failed to compute DNA for project ${project.id}:`, error);
      }
    }

    this.logger.log(`ProjectDNA analysis complete (${projects.length} projects)`);
  }
}
