import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../database/prisma.service';
import { buildWeeklyInsightPrompt, WEEKLY_INSIGHT_SYSTEM_PROMPT } from '../ai/prompts/v1/weekly-insight.prompt';

/**
 * InsightGenJob — weekly AI insights.
 * Runs at 04:00 UTC on Monday after the nightly analysis and sync jobs.
 * Cost-controlled: one weekly insight per user maximum.
 *
 * BullMQ upgrade path:
 *   Replace @Cron with queue.add('insight-gen', userId, { repeat: { cron: '0 4 * * 1' } })
 */
@Injectable()
export class InsightGenJob {
  private readonly logger = new Logger(InsightGenJob.name);

  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('0 4 * * 1', { name: 'weekly-insight-gen', timeZone: 'UTC' })
  async run(): Promise<void> {
    const traceId = crypto.randomUUID();
    this.logger.log({ msg: 'Weekly AI insight triggered', traceId });

    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, githubAccount: { isNot: null } },
      select: { id: true },
    });

    for (const user of users) {
      try {
        await this.generateForUser(user.id, traceId);
      } catch (error) {
        this.logger.error({
          msg: 'Weekly insight generation failed',
          userId: user.id,
          traceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async generateForUser(userId: string, traceId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monday = new Date(today);
    const day = monday.getDay();
    const diff = day === 0 ? 6 : day - 1;
    monday.setDate(monday.getDate() - diff);

    const existing = await this.prisma.aIInsight.findFirst({
      where: { userId, createdAt: { gte: monday } },
    });

    if (existing) {
      this.logger.debug({ msg: 'Weekly insight already generated this week', userId, traceId });
      return;
    }

    const [commits7d, commits30d, currentStreak, topLang] = await Promise.all([
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
      this.prisma.streak.findFirst({
        where: { userId, committed: true },
        orderBy: { date: 'desc' },
        select: { date: true },
      }).then(async (latest) => {
        if (!latest) return 0;
        const rows = await this.prisma.streak.findMany({
          where: { userId, committed: true },
          orderBy: { date: 'desc' },
          select: { date: true },
        });
        const first = new Date(rows[0]!.date);
        first.setHours(0, 0, 0, 0);
        const yesterday = new Date();
        yesterday.setHours(0, 0, 0, 0);
        yesterday.setDate(yesterday.getDate() - 1);
        if (first.getTime() < yesterday.getTime()) return 0;
        let streak = 0;
        for (let i = 0; i < rows.length; i++) {
          const expected = new Date(first);
          expected.setDate(expected.getDate() - i);
          const actual = new Date(rows[i]!.date);
          actual.setHours(0, 0, 0, 0);
          if (actual.getTime() !== expected.getTime()) break;
          streak++;
        }
        return streak;
      }),
      this.prisma.repository.findFirst({
        where: { userId, language: { not: null } },
        orderBy: { starCount: 'desc' },
        select: { language: true },
      }),
    ]);

    const prompt = buildWeeklyInsightPrompt({
      commits7d,
      commits30d,
      currentStreak,
      topLanguage: topLang?.language ?? 'various languages',
    });

    await this.aiService.complete(userId, prompt, {
      maxTokens: 512,
      systemPrompt: WEEKLY_INSIGHT_SYSTEM_PROMPT,
    });

    this.logger.log({ msg: 'Weekly AI insight complete', userId, traceId });
  }
}
