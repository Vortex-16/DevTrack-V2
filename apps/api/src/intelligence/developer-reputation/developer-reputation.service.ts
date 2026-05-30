import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface ReputationSources {
  commits: number;
  repos: number;
  centrality: number;
  streak: number;
  learning: number;
  publicProfile: number; // Changed from boolean to number for consistency
  [key: string]: number; // Index signature for Prisma JSON compatibility
}

@Injectable()
export class DeveloperReputationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute reputation score for a user.
   */
  async computeReputation(userId: string) {
    // Gather metrics
    const [commitCount, repoCount, graph, streak, learningCount, profile] = await Promise.all([
      this.prisma.commit.count({
        where: { repository: { userId } },
      }),
      this.prisma.repository.count({
        where: { userId },
      }),
      this.prisma.developerGraph.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.streak.findMany({
        where: { userId, committed: true },
      }),
      this.prisma.learningLog.count({
        where: { userId },
      }),
      this.prisma.profile.findUnique({
        where: { userId },
      }),
    ]);

    const centralityScore = graph?.score || 0;
    const streakDays = streak.length;
    const isPublic = profile?.isPublic || false;

    // Scoring algorithm
    const sources: ReputationSources = {
      commits: Math.min(30, commitCount * 0.03), // Max 30 points (1000 commits)
      repos: Math.min(20, repoCount * 2), // Max 20 points (10 repos)
      centrality: Math.min(20, centralityScore * 0.2), // Max 20 points (centrality 100)
      streak: Math.min(15, streakDays * 0.15), // Max 15 points (100 days)
      learning: Math.min(10, learningCount * 0.5), // Max 10 points (20 logs)
      publicProfile: isPublic ? 5 : 0, // 5 points bonus
    };

    const score = Math.round(
      sources.commits +
      sources.repos +
      sources.centrality +
      sources.streak +
      sources.learning +
      sources.publicProfile
    );

    // Upsert reputation
    await this.prisma.developerReputation.upsert({
      where: { userId },
      create: {
        userId,
        score,
        sources,
      },
      update: {
        score,
        sources,
        computedAt: new Date(),
      },
    });

    return { userId, score, sources };
  }

  /**
   * Get reputation for a user.
   */
  async getReputation(userId: string) {
    let reputation = await this.prisma.developerReputation.findUnique({
      where: { userId },
    });

    // Compute if not exists
    if (!reputation) {
      const computed = await this.computeReputation(userId);
      reputation = await this.prisma.developerReputation.findUnique({
        where: { userId },
      });
    }

    return {
      userId: reputation!.userId,
      score: reputation!.score,
      sources: reputation!.sources as ReputationSources,
      computedAt: reputation!.computedAt,
    };
  }

  /**
   * Get reputation breakdown.
   */
  async getBreakdown(userId: string) {
    const reputation = await this.getReputation(userId);

    return {
      userId,
      score: reputation.score,
      breakdown: reputation.sources,
      computedAt: reputation.computedAt,
    };
  }
}
