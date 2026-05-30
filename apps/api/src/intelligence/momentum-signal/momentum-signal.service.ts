import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MomentumSignalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the latest momentum signal for a user.
   */
  async getCurrentMomentum(userId: string) {
    const signal = await this.prisma.momentumSignal.findFirst({
      where: { userId },
      orderBy: { computedAt: 'desc' },
    });

    if (!signal) {
      throw new NotFoundException('No momentum data found for this user');
    }

    return {
      id: signal.id,
      userId: signal.userId,
      windowDays: signal.windowDays,
      velocity: signal.velocity,
      burnoutRisk: signal.burnoutRisk,
      computedAt: signal.computedAt,
    };
  }

  /**
   * Get momentum history over time.
   */
  async getMomentumHistory(userId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400_000);

    const signals = await this.prisma.momentumSignal.findMany({
      where: {
        userId,
        computedAt: { gte: since },
      },
      orderBy: { computedAt: 'asc' },
      select: {
        velocity: true,
        burnoutRisk: true,
        computedAt: true,
      },
    });

    return {
      userId,
      history: signals,
    };
  }

  /**
   * Get current burnout risk (0-1 scale).
   */
  async getBurnoutRisk(userId: string) {
    const signal = await this.getCurrentMomentum(userId);

    return {
      userId: signal.userId,
      burnoutRisk: signal.burnoutRisk ?? 0,
      velocity: signal.velocity,
      computedAt: signal.computedAt,
    };
  }

  /**
   * Get velocity trend over time.
   */
  async getVelocityTrend(userId: string, days = 30) {
    const history = await this.getMomentumHistory(userId, days);

    return {
      userId,
      trend: history.history.map((h) => ({
        velocity: h.velocity,
        date: h.computedAt,
      })),
    };
  }

  /**
   * Compute momentum signal for a user (called by job).
   * Analyzes commit patterns to detect velocity and burnout risk.
   */
  async computeMomentum(userId: string): Promise<void> {
    const windowDays = 14;
    const since = new Date(Date.now() - windowDays * 86400_000);

    // Count commits in the window
    const commits = await this.prisma.commit.findMany({
      where: {
        repository: { userId },
        committedAt: { gte: since },
      },
      select: {
        committedAt: true,
        additions: true,
        deletions: true,
      },
    });

    const commitCount = commits.length;
    const velocity = commitCount / windowDays;

    // Enhanced burnout heuristic
    // - Low velocity → low burnout risk
    // - High velocity + large commits → moderate risk
    // - Very high velocity → high risk
    let burnoutRisk = 0;

    if (velocity < 1) {
      burnoutRisk = 0.1; // Low activity
    } else if (velocity < 3) {
      burnoutRisk = 0.2; // Healthy pace
    } else if (velocity < 5) {
      burnoutRisk = 0.4; // Active
    } else if (velocity < 10) {
      burnoutRisk = 0.6; // Very active
    } else {
      burnoutRisk = 0.8; // Potentially unsustainable
    }

    // Adjust for commit size variance (large commits = more stress)
    if (commits.length > 0) {
      const avgSize = commits.reduce((sum, c) => sum + c.additions + c.deletions, 0) / commits.length;
      if (avgSize > 500) {
        burnoutRisk = Math.min(1, burnoutRisk + 0.1);
      }
    }

    // Create momentum signal
    await this.prisma.momentumSignal.create({
      data: {
        userId,
        windowDays,
        velocity,
        burnoutRisk,
      },
    });
  }
}
