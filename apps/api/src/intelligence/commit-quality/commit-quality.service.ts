import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface QualityDetails {
  messageQuality: number;
  filesChanged: number;
  additionsBalance: number;
  commitFrequency: number;
  timeOfDay: number;
  [key: string]: number; // Index signature for Prisma JSON compatibility
}

@Injectable()
export class CommitQualityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Score a commit based on quality heuristics.
   */
  async scoreCommit(commitId: string) {
    const commit = await this.prisma.commit.findUnique({
      where: { id: commitId },
      include: {
        repository: {
          select: { userId: true },
        },
      },
    });

    if (!commit) {
      throw new NotFoundException('Commit not found');
    }

    // Heuristic 1: Message quality (0-100)
    const messageLength = commit.message.length;
    const hasConventionalFormat = /^(feat|fix|docs|style|refactor|test|chore|perf)(\(.+\))?:/.test(commit.message);
    let messageQuality = Math.min(100, messageLength * 2); // Longer messages = better
    if (hasConventionalFormat) messageQuality = Math.min(100, messageQuality + 20);

    // Heuristic 2: Files changed (0-100)
    // Sweet spot: 1-5 files = 100, >20 files = 0
    let filesScore = 100;
    if (commit.changedFiles > 5) {
      filesScore = Math.max(0, 100 - (commit.changedFiles - 5) * 5);
    }

    // Heuristic 3: Additions/deletions balance (0-100)
    const total = commit.additions + commit.deletions;
    const ratio = total > 0 ? commit.additions / total : 0.5;
    // Balanced changes (40-60% additions) = good
    const balanceScore = 100 - Math.abs(ratio - 0.5) * 200;

    // Heuristic 4: Commit frequency (avoid spam)
    // Check commits in same hour
    const hourStart = new Date(commit.committedAt);
    hourStart.setMinutes(0, 0, 0);
    const hourEnd = new Date(hourStart);
    hourEnd.setHours(hourEnd.getHours() + 1);

    const commitsInHour = await this.prisma.commit.count({
      where: {
        repository: { userId: commit.repository.userId },
        committedAt: { gte: hourStart, lt: hourEnd },
      },
    });

    const frequencyScore = Math.max(0, 100 - commitsInHour * 10);

    // Heuristic 5: Time of day (working hours = better)
    const hour = commit.committedAt.getHours();
    let timeScore = 100;
    if (hour < 6 || hour > 22) {
      timeScore = 50; // Late night commits = potential burnout
    }

    // Weighted average
    const details: QualityDetails = {
      messageQuality: Math.round(messageQuality),
      filesChanged: Math.round(filesScore),
      additionsBalance: Math.round(balanceScore),
      commitFrequency: Math.round(frequencyScore),
      timeOfDay: Math.round(timeScore),
    };

    const score = Math.round(
      messageQuality * 0.3 +
      filesScore * 0.2 +
      balanceScore * 0.2 +
      frequencyScore * 0.15 +
      timeScore * 0.15
    );

    // Store score
    await this.prisma.commitQualityScore.upsert({
      where: { commitId },
      create: {
        commitId,
        score,
        details,
      },
      update: {
        score,
        details,
        computedAt: new Date(),
      },
    });

    return { commitId, score, details, computedAt: new Date() };
  }

  /**
   * Get quality score for a commit.
   */
  async getScore(commitId: string) {
    let score = await this.prisma.commitQualityScore.findUnique({
      where: { commitId },
    });

    // Compute if not exists
    if (!score) {
      const computed = await this.scoreCommit(commitId);
      score = await this.prisma.commitQualityScore.findUnique({
        where: { commitId },
      });
    }

    return {
      commitId: score!.commitId,
      score: score!.score,
      details: score!.details as QualityDetails,
      computedAt: score!.computedAt,
    };
  }

  /**
   * Get top quality commits for a user.
   */
  async getTopCommits(userId: string, limit = 10) {
    const commits = await this.prisma.commit.findMany({
      where: { repository: { userId } },
      select: { id: true, sha: true, message: true, committedAt: true },
      take: 100, // Sample recent commits
      orderBy: { committedAt: 'desc' },
    });

    // Score all commits
    const scored = await Promise.all(
      commits.map(async (c) => {
        try {
          const quality = await this.getScore(c.id);
          return { ...c, score: quality.score };
        } catch {
          return { ...c, score: 0 };
        }
      })
    );

    // Sort by score and return top N
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Get worst quality commits for a user.
   */
  async getWorstCommits(userId: string, limit = 10) {
    const commits = await this.prisma.commit.findMany({
      where: { repository: { userId } },
      select: { id: true, sha: true, message: true, committedAt: true },
      take: 100,
      orderBy: { committedAt: 'desc' },
    });

    const scored = await Promise.all(
      commits.map(async (c) => {
        try {
          const quality = await this.getScore(c.id);
          return { ...c, score: quality.score };
        } catch {
          return { ...c, score: 100 };
        }
      })
    );

    return scored.sort((a, b) => a.score - b.score).slice(0, limit);
  }
}
