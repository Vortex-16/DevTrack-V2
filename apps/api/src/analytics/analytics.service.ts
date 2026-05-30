import { Injectable } from '@nestjs/common';
import { StreakService } from './streak.service';
import { VelocityService } from './velocity.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly streakService: StreakService,
    private readonly velocityService: VelocityService,
    private readonly prisma: PrismaService,
  ) {}

  async getDashboardSummary(userId: string) {
    const [velocity, currentStreak, recentStreaks] = await Promise.all([
      this.velocityService.getMetrics(userId),
      this.streakService.getCurrentStreak(userId),
      this.prisma.streak.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 90,
        select: { date: true, committed: true, mood: true },
      }),
    ]);

    return {
      velocity,
      currentStreak,
      recentStreaks,
      languages: velocity.topLanguages,
    };
  }

  async getStreakHistory(userId: string, days = 90) {
    return this.prisma.streak.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: days,
      select: { date: true, committed: true, mood: true },
    });
  }

  async getCommitsGraph(userId: string, days = 30) {
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const commits = await this.prisma.commit.findMany({
      where: { repository: { userId }, committedAt: { gte: since } },
      select: { committedAt: true },
      orderBy: { committedAt: 'asc' },
    });

    const map = new Map<string, number>();
    for (const c of commits) {
      const d = (c.committedAt as Date).toISOString().split('T')[0] as string;
      map.set(d, ((map.get(d) ?? 0) + 1) as number);
    }

    const out: { date: string; count: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - (days - 1 - i));
      const key = d.toISOString().split('T')[0] as string;
      out.push({ date: key, count: (map.get(key) ?? 0) as number });
    }

    return out;
  }

  async getLanguageBreakdown(userId: string) {
    const metrics = await this.velocityService.getMetrics(userId);
    return metrics.topLanguages;
  }
}
