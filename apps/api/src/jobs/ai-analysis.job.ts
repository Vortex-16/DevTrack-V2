import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../database/prisma.service';

/**
 * AiAnalysisJob — nightly AI insight generation.
 * Runs at 03:00 UTC (after GitHub sync at 02:00 completes).
 * Cost-controlled: one analysis per user per night maximum.
 *
 * BullMQ upgrade path:
 *   Replace @Cron with queue.add('ai-analysis', userId, { repeat: ... })
 */
@Injectable()
export class AiAnalysisJob {
  private readonly logger = new Logger(AiAnalysisJob.name);

  private static readonly GROWTH_SUMMARY_PROMPT = (stats: {
    commits7d: number;
    commits30d: number;
    topLanguage: string;
  }) =>
    `You are a developer growth coach. Based on these stats:
- Commits last 7 days: ${stats.commits7d}
- Commits last 30 days: ${stats.commits30d}
- Primary language: ${stats.topLanguage}

Provide a concise (3-4 sentences) growth insight with one specific, actionable recommendation. Be encouraging but honest.`;

  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('0 3 * * *', { name: 'ai-nightly-analysis', timeZone: 'UTC' })
  async run(): Promise<void> {
    const traceId = crypto.randomUUID();
    this.logger.log({ msg: 'Nightly AI analysis triggered', traceId });

    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, githubAccount: { isNot: null } },
      select: { id: true },
    });

    this.logger.log({ msg: `Analysing ${users.length} users`, traceId });

    for (const user of users) {
      try {
        await this.analyseUser(user.id, traceId);
      } catch (error) {
        // Non-fatal — log and continue to next user
        this.logger.error({
          msg: 'AI analysis failed for user',
          userId: user.id,
          traceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async analyseUser(userId: string, traceId: string): Promise<void> {
    // Check if insight already generated today (cost guard)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.aIInsight.findFirst({
      where: { userId, createdAt: { gte: today } },
    });

    if (existing) {
      this.logger.debug({ msg: 'AI insight already generated today', userId, traceId });
      return;
    }

    // Build prompt from recent commit stats
    const [commits7d, commits30d, topLang] = await Promise.all([
      this.prisma.commit.count({
        where: {
          repository: { userId },
          committedAt: { gte: new Date(Date.now() - 7 * 86400_000) },
        },
      }),
      this.prisma.commit.count({
        where: {
          repository: { userId },
          committedAt: { gte: new Date(Date.now() - 30 * 86400_000) },
        },
      }),
      this.prisma.repository.findFirst({
        where: { userId, language: { not: null } },
        orderBy: { starCount: 'desc' },
        select: { language: true },
      }),
    ]);

    const prompt = AiAnalysisJob.GROWTH_SUMMARY_PROMPT({
      commits7d,
      commits30d,
      topLanguage: topLang?.language ?? 'various languages',
    });

    await this.aiService.complete(userId, prompt, {
      maxTokens: 512,
      systemPrompt: 'You are a concise, data-driven developer growth coach.',
    });

    this.logger.log({ msg: 'AI analysis complete', userId, traceId });
  }
}
