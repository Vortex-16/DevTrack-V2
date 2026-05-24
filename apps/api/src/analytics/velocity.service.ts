import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface VelocityMetrics {
  commits7d: number;
  commits30d: number;
  allTimeCommits: number;
  avgCommitsPerDay7d: number;
  activeDays7d: number;
  activeDays30d: number;
  topLanguages: { language: string; count: number }[];
}

/**
 * VelocityService — rolling window commit velocity calculations.
 * Reads only from the local Commit table — never re-fetches from GitHub.
 */
@Injectable()
export class VelocityService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(userId: string): Promise<VelocityMetrics> {
    const now = new Date();
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [commits7d, commits30d, allTimeCommits, languages] = await Promise.all([
      this.prisma.commit.count({
        where: { repository: { userId }, committedAt: { gte: since7d } },
      }),
      this.prisma.commit.count({
        where: { repository: { userId }, committedAt: { gte: since30d } },
      }),
      this.prisma.commit.count({
        where: { repository: { userId } },
      }),
      this.prisma.repository.groupBy({
        by: ['language'],
        where: { userId, language: { not: null } },
        _count: { language: true },
        orderBy: { _count: { language: 'desc' } },
        take: 5,
      }),
    ]);

    // Active day counts (distinct dates with commits)
    const [activeDays7dRows, activeDays30dRows] = await Promise.all([
      this.prisma.commit.findMany({
        where: { repository: { userId }, committedAt: { gte: since7d } },
        select: { committedAt: true },
        distinct: ['committedAt'],
      }),
      this.prisma.commit.findMany({
        where: { repository: { userId }, committedAt: { gte: since30d } },
        select: { committedAt: true },
        distinct: ['committedAt'],
      }),
    ]);

    const activeDates7d = new Set(
      activeDays7dRows.map((r: { committedAt: Date }) =>
        r.committedAt.toISOString().split('T')[0],
      ),
    );
    const activeDates30d = new Set(
      activeDays30dRows.map((r: { committedAt: Date }) =>
        r.committedAt.toISOString().split('T')[0],
      ),
    );

    return {
      commits7d,
      commits30d,
      allTimeCommits,
      avgCommitsPerDay7d: activeDates7d.size > 0 ? commits7d / activeDates7d.size : 0,
      activeDays7d: activeDates7d.size,
      activeDays30d: activeDates30d.size,
      topLanguages: languages.map((l: { language: string | null; _count: { language: number } }) => ({
        language: l.language ?? 'Unknown',
        count: l._count.language,
      })),
    };
  }
}
