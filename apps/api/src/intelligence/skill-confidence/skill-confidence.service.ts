import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface SkillEvidence {
  repos: string[];
  commitCount: number;
  lastUsed: Date;
  [key: string]: any; // Index signature for Prisma JSON compatibility
}

@Injectable()
export class SkillConfidenceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Infer skills from user's repositories and commits.
   */
  async inferSkills(userId: string) {
    const repos = await this.prisma.repository.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        language: true,
        topics: true,
        _count: {
          select: { commits: true },
        },
      },
    });

    const skillMap = new Map<string, { repos: string[]; commitCount: number; lastUsed: Date }>();

    // Extract skills from primary languages
    for (const repo of repos) {
      if (repo.language) {
        const skill = repo.language;
        const existing = skillMap.get(skill) || { repos: [], commitCount: 0, lastUsed: new Date(0) };
        existing.repos.push(repo.name);
        existing.commitCount += repo._count.commits;
        skillMap.set(skill, existing);
      }

      // Extract skills from topics (frameworks, tools)
      for (const topic of repo.topics) {
        const skill = topic;
        const existing = skillMap.get(skill) || { repos: [], commitCount: 0, lastUsed: new Date(0) };
        existing.repos.push(repo.name);
        existing.commitCount += repo._count.commits;
        skillMap.set(skill, existing);
      }
    }

    // Get last commit date per skill
    for (const [skill, evidence] of skillMap.entries()) {
      const lastCommit = await this.prisma.commit.findFirst({
        where: {
          repository: {
            userId,
            OR: [
              { language: skill },
              { topics: { has: skill } },
            ],
          },
        },
        orderBy: { committedAt: 'desc' },
        select: { committedAt: true },
      });

      if (lastCommit) {
        evidence.lastUsed = lastCommit.committedAt;
      }
    }

    // Compute confidence (0-1) based on commit count and recency
    const now = Date.now();
    const maxCommits = Math.max(...Array.from(skillMap.values()).map((e) => e.commitCount), 1);

    for (const [skill, evidence] of skillMap.entries()) {
      const commitScore = evidence.commitCount / maxCommits; // 0-1
      const daysSinceUse = (now - evidence.lastUsed.getTime()) / (86400_000);
      const recencyScore = Math.max(0, 1 - daysSinceUse / 365); // Decay over 1 year

      const confidence = (commitScore * 0.7 + recencyScore * 0.3);

      // Upsert skill confidence
      await this.prisma.skillConfidence.upsert({
        where: {
          userId_skill: { userId, skill },
        },
        create: {
          userId,
          skill,
          confidence,
          evidence: {
            repos: evidence.repos,
            commitCount: evidence.commitCount,
            lastUsed: evidence.lastUsed,
          },
        },
        update: {
          confidence,
          evidence: {
            repos: evidence.repos,
            commitCount: evidence.commitCount,
            lastUsed: evidence.lastUsed,
          },
        },
      });
    }

    return { message: 'Skills inferred successfully', skillCount: skillMap.size };
  }

  /**
   * Get all skills for a user.
   */
  async getSkills(userId: string) {
    const skills = await this.prisma.skillConfidence.findMany({
      where: { userId },
      orderBy: { confidence: 'desc' },
      select: {
        skill: true,
        confidence: true,
        evidence: true,
        updatedAt: true,
      },
    });

    return skills;
  }

  /**
   * Update skill confidence manually.
   */
  async updateSkill(userId: string, skill: string, confidence: number) {
    const existing = await this.prisma.skillConfidence.findUnique({
      where: { userId_skill: { userId, skill } },
    });

    if (!existing) {
      throw new NotFoundException('Skill not found');
    }

    const updated = await this.prisma.skillConfidence.update({
      where: { userId_skill: { userId, skill } },
      data: { confidence },
    });

    return updated;
  }

  /**
   * Get evidence for a specific skill.
   */
  async getEvidence(userId: string, skill: string) {
    const skillData = await this.prisma.skillConfidence.findUnique({
      where: { userId_skill: { userId, skill } },
    });

    if (!skillData) {
      throw new NotFoundException('Skill not found');
    }

    return {
      skill: skillData.skill,
      confidence: skillData.confidence,
      evidence: skillData.evidence as SkillEvidence,
    };
  }
}
