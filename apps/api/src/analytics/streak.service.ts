import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../database/prisma.service';

/**
 * StreakService — append-only streak tracking.
 *
 * Design: Each day is one record per user (@@unique[userId, date]).
 * Records are never updated retroactively — only new days are created.
 * This preserves full auditability of streak history.
 *
 * Triggered by: 'github.sync.completed' domain event
 */
@Injectable()
export class StreakService {
  private readonly logger = new Logger(StreakService.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('github.sync.completed')
  async onSyncCompleted(payload: { userId: string; traceId: string }): Promise<void> {
    await this.recomputeFor(payload.userId, payload.traceId);
  }

  async recomputeFor(userId: string, traceId = 'manual'): Promise<void> {
    this.logger.log({ msg: 'Recomputing streaks', userId, traceId });

    // Find all distinct commit dates for this user (last 365 days)
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);

    const commitDates = await this.prisma.commit.findMany({
      where: {
        repository: { userId },
        committedAt: { gte: since },
      },
      select: { committedAt: true },
      distinct: ['committedAt'],
      orderBy: { committedAt: 'asc' },
    });

    // Group by calendar date — filter() removes undefined from noUncheckedIndexedAccess
    const activeDates = new Set(
      commitDates
        .map((c: { committedAt: Date }) => c.committedAt.toISOString().split('T')[0])
        .filter((d: string | undefined): d is string => d !== undefined),
    );

    // Upsert streak records for each active date
    for (const dateStr of activeDates) {
      await this.prisma.streak.upsert({
        where: {
          userId_date: {
            userId,
            date: new Date(dateStr as string),
          },
        },
        create: {
          userId,
          date: new Date(dateStr as string),
          committed: true,
        },
        update: { committed: true },
      });
    }

    this.logger.log({
      msg: 'Streak recomputation complete',
      userId,
      activeDays: activeDates.size,
      traceId,
    });
  }

  async getCurrentStreak(userId: string): Promise<number> {
    const streaks = await this.prisma.streak.findMany({
      where: { userId, committed: true },
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    if (streaks.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const latest = new Date(streaks[0]!.date);
    latest.setHours(0, 0, 0, 0);

    if (latest.getTime() < yesterday.getTime()) {
      return 0;
    }

    const referenceDate = latest;
    let streak = 0;

    for (let i = 0; i < streaks.length; i++) {
      const expected = new Date(referenceDate);
      expected.setDate(expected.getDate() - i);
      const actual = new Date(streaks[i]!.date);
      actual.setHours(0, 0, 0, 0);

      if (actual.getTime() !== expected.getTime()) break;
      streak++;
    }

    return streak;
  }
}
