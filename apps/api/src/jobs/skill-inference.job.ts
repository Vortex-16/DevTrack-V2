import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { SkillConfidenceService } from '../intelligence/skill-confidence/skill-confidence.service';

/**
 * SkillInferenceJob — infers skills from repositories and commits.
 * Runs weekly on Sunday at 04:00 UTC.
 */
@Injectable()
export class SkillInferenceJob {
  private readonly logger = new Logger(SkillInferenceJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly skillService: SkillConfidenceService,
  ) {}

  @Cron('0 4 * * 0', { name: 'skill-inference-weekly', timeZone: 'UTC' }) // Sunday 04:00 UTC
  async infer() {
    this.logger.log('Starting skill inference');

    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });

    for (const user of users) {
      try {
        await this.skillService.inferSkills(user.id);
      } catch (error) {
        this.logger.error(`Failed to infer skills for user ${user.id}:`, error);
      }
    }

    this.logger.log(`Skill inference complete (${users.length} users)`);
  }
}
