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
    };
  }
}
