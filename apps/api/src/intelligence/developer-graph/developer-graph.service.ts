import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface GraphNeighbor {
  other: string;
  weight: number;
}

export interface GraphSnapshot {
  userId: string;
  neighbors: GraphNeighbor[];
  computedAt: string;
  [key: string]: any; // Index signature for Prisma JSON compatibility
}

@Injectable()
export class DeveloperGraphService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the latest developer graph snapshot for a user.
   */
  async getGraph(userId: string) {
    const graph = await this.prisma.developerGraph.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!graph) {
      throw new NotFoundException('No graph data found for this user');
    }

    return {
      id: graph.id,
      userId: graph.userId,
      graph: graph.graph as GraphSnapshot,
      score: graph.score,
      createdAt: graph.createdAt,
    };
  }

  /**
   * Extract neighbors from the graph snapshot.
   */
  async getNeighbors(userId: string) {
    const graph = await this.getGraph(userId);
    const snapshot = graph.graph as GraphSnapshot;

    return {
      userId: graph.userId,
      neighbors: snapshot.neighbors || [],
      totalCollaborators: snapshot.neighbors?.length || 0,
    };
  }

  /**
   * Get the centrality score (0-100) for a user.
   */
  async getCentralityScore(userId: string) {
    const graph = await this.getGraph(userId);

    return {
      userId: graph.userId,
      score: graph.score || 0,
      computedAt: graph.createdAt,
    };
  }

  /**
   * Get historical graph snapshots.
   */
  async getGraphHistory(userId: string, limit = 10) {
    const graphs = await this.prisma.developerGraph.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        score: true,
        createdAt: true,
      },
    });

    return {
      userId,
      history: graphs,
    };
  }

  /**
   * Compute developer graph for a user (called by job).
   * Builds co-contribution edges from recent commits.
   */
  async computeGraph(userId: string): Promise<void> {
    const since = new Date(Date.now() - 90 * 86400_000);

    // Fetch commits from user's repositories
    const commits = await this.prisma.commit.findMany({
      where: {
        repository: { userId },
        committedAt: { gte: since },
      },
      select: {
        authorEmail: true,
        authorLogin: true,
        repositoryId: true,
      },
    });

    // Map repoId -> set of author identifiers
    const repoAuthors = new Map<string, Set<string>>();
    for (const c of commits) {
      const author = c.authorEmail ?? c.authorLogin ?? undefined;
      const repoId = c.repositoryId;
      if (!author || !repoId) continue;

      const set = repoAuthors.get(repoId) ?? new Set<string>();
      set.add(author);
      repoAuthors.set(repoId, set);
    }

    // Build co-contribution edges
    const edges = new Map<string, Map<string, number>>();
    for (const authors of repoAuthors.values()) {
      const list = Array.from(authors);
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

    // Compute centrality score
    let totalWeight = 0;
    const userEdges = edges.get(userId);
    if (userEdges) {
      for (const weight of userEdges.values()) {
        totalWeight += weight;
      }
    }

    // Normalize to 0-100 (simple heuristic: 1 point per collaboration)
    const score = Math.min(100, totalWeight);

    // Build graph snapshot
    const graphSnapshot: GraphSnapshot = {
      userId,
      neighbors: Array.from(userEdges?.entries() ?? []).map(([other, weight]) => ({
        other,
        weight,
      })),
      computedAt: new Date().toISOString(),
    };

    // Upsert to database
    const existing = await this.prisma.developerGraph.findFirst({
      where: { userId },
    });

    if (existing) {
      await this.prisma.developerGraph.update({
        where: { id: existing.id },
        data: { graph: graphSnapshot, score },
      });
    } else {
      await this.prisma.developerGraph.create({
        data: { userId, graph: graphSnapshot, score },
      });
    }
  }
}
