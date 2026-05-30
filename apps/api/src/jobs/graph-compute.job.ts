import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';

/**
 * GraphComputeJob — computes DeveloperGraph snapshots periodically.
 * Implementation:
 * - Fetch recent commits and group authors by repository
 * - Build co-contribution edges between authors (edge weight = number of shared repos)
 * - Compute a simple centrality score per user and persist a JSON graph snapshot
 */
@Injectable()
export class GraphComputeJob {
  private readonly logger = new Logger(GraphComputeJob.name);
  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 5 * * 1', { name: 'graph-weekly-compute', timeZone: 'UTC' }) // every Monday at 05:00 UTC
  async compute(): Promise<void> {
    this.logger.log('Starting DeveloperGraph computation');

    // Fetch commits from the last 90 days to build a reasonably-sized graph
    const since = new Date(Date.now() - 90 * 86400_000);
    const commits = await this.prisma.commit.findMany({
      where: { committedAt: { gte: since } },
      select: { authorEmail: true, authorLogin: true, repositoryId: true },
    });

    // Map repoId -> set of author identifiers (email or login)
    const repoAuthors = new Map<string, Set<string>>();
    for (const c of commits) {
      const author = c.authorEmail ?? c.authorLogin ?? undefined;
      const repoId = c.repositoryId;
      if (!author || !repoId) continue;
      const set = repoAuthors.get(repoId) ?? new Set<string>();
      set.add(author);
      repoAuthors.set(repoId, set);
    }

    // Build co-contribution edges: authorId -> Map<authorId, weight>
    const edges = new Map<string, Map<string, number>>();
    for (const authors of repoAuthors.values()) {
      const list = Array.from(authors) as string[];
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          if (!a || !b) continue;
          const rowA = edges.get(a) ?? new Map<string, number>();
          rowA.set(b, (rowA.get(b) ?? 0) + 1);
          edges.set(a, rowA);

          const rowB = edges.get(b) ?? new Map<string, number>();
          rowB.set(a, (rowB.get(a) ?? 0) + 1);
          edges.set(b, rowB);
        }
      }
    }

    // Compute a simple centrality score: sum of edge weights
    const scores = new Map<string, number>();
    for (const [userId, neighbours] of edges.entries()) {
      let sum = 0;
      for (const w of neighbours.values()) sum += w;
      scores.set(userId, sum);
    }

    // Normalize scores to 0-100
    const max = Math.max(0, ...Array.from(scores.values()));

    // Persist snapshots for each user present in the graph
    for (const [userId, rawScore] of scores.entries()) {
      const score = max > 0 ? Math.round((rawScore / max) * 100) : 0;
      const graphSnapshot = {
        userId,
        neighbors: Array.from(edges.get(userId)?.entries() ?? []).map(([other, weight]) => ({ other, weight })),
        computedAt: new Date().toISOString(),
      };

      const existing = await this.prisma.developerGraph.findFirst({ where: { userId } });
      if (existing) {
        await this.prisma.developerGraph.update({ where: { id: existing.id }, data: { graph: graphSnapshot, score } });
      } else {
        await this.prisma.developerGraph.create({ data: { userId, graph: graphSnapshot, score } });
      }
    }

    this.logger.log('DeveloperGraph computation complete');
  }
}
