import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface DNAFingerprint {
  repoCount: number;
  taskCount: number;
  recentCommits: number;
  languages?: Record<string, number>;
  complexity?: number;
  [key: string]: any; // Index signature for Prisma JSON compatibility
}

@Injectable()
export class ProjectDnaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get DNA fingerprint for a project.
   */
  async getDNA(projectId: string) {
    const dna = await this.prisma.projectDNA.findUnique({
      where: { projectId },
    });

    if (!dna) {
      throw new NotFoundException('No DNA data found for this project');
    }

    return {
      id: dna.id,
      projectId: dna.projectId,
      fingerprint: dna.fingerprint as DNAFingerprint,
      summary: dna.summary,
      createdAt: dna.createdAt,
      updatedAt: dna.updatedAt,
    };
  }

  /**
   * Trigger on-demand DNA analysis for a project.
   */
  async analyzeDNA(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.computeDNA(projectId, project.userId);

    return this.getDNA(projectId);
  }

  /**
   * Compare DNA fingerprints of two projects.
   */
  async compareDNA(projectId1: string, projectId2: string) {
    const [dna1, dna2] = await Promise.all([
      this.getDNA(projectId1),
      this.getDNA(projectId2),
    ]);

    const fp1 = dna1.fingerprint as DNAFingerprint;
    const fp2 = dna2.fingerprint as DNAFingerprint;

    // Simple similarity score based on metrics
    const repoSimilarity = 1 - Math.abs(fp1.repoCount - fp2.repoCount) / Math.max(fp1.repoCount, fp2.repoCount, 1);
    const taskSimilarity = 1 - Math.abs(fp1.taskCount - fp2.taskCount) / Math.max(fp1.taskCount, fp2.taskCount, 1);
    const commitSimilarity = 1 - Math.abs(fp1.recentCommits - fp2.recentCommits) / Math.max(fp1.recentCommits, fp2.recentCommits, 1);

    const similarity = (repoSimilarity + taskSimilarity + commitSimilarity) / 3;

    return {
      projectId1,
      projectId2,
      similarity: Math.round(similarity * 100),
      comparison: {
        repos: { project1: fp1.repoCount, project2: fp2.repoCount },
        tasks: { project1: fp1.taskCount, project2: fp2.taskCount },
        commits: { project1: fp1.recentCommits, project2: fp2.recentCommits },
      },
    };
  }

  /**
   * Compute DNA fingerprint for a project (called by job).
   * Enhanced analysis beyond simple counts.
   */
  async computeDNA(projectId: string, userId: string): Promise<void> {
    // Basic counts
    const repoCount = await this.prisma.repository.count({
      where: { userId },
    });

    const taskCount = await this.prisma.task.count({
      where: { projectId },
    });

    const since = new Date(Date.now() - 90 * 86400_000);
    const recentCommits = await this.prisma.commit.count({
      where: {
        repository: { userId },
        committedAt: { gte: since },
      },
    });

    // Language breakdown
    const repos = await this.prisma.repository.findMany({
      where: { userId },
      select: { language: true },
    });

    const languages: Record<string, number> = {};
    for (const repo of repos) {
      if (repo.language) {
        languages[repo.language] = (languages[repo.language] || 0) + 1;
      }
    }

    // Complexity heuristic (0-10 scale)
    // Based on: repo count, task count, language diversity
    const languageCount = Object.keys(languages).length;
    const complexity = Math.min(10, (repoCount * 0.5 + taskCount * 0.3 + languageCount * 0.2));

    const fingerprint: DNAFingerprint = {
      repoCount,
      taskCount,
      recentCommits,
      languages,
      complexity: Math.round(complexity * 10) / 10,
    };

    const summary = `${repoCount} repos, ${taskCount} tasks, ${languageCount} languages, complexity ${complexity.toFixed(1)}/10`;

    await this.prisma.projectDNA.upsert({
      where: { projectId },
      create: { projectId, fingerprint, summary },
      update: { fingerprint, summary, updatedAt: new Date() },
    });
  }
}
