import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiService } from '../../ai/ai.service';

export interface CreateCoachSessionDto {
  prompt: string;
}

@Injectable()
export class CoachSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Create a new coaching session with AI-generated response.
   */
  async createSession(userId: string, data: CreateCoachSessionDto) {
    // Gather user context for the AI
    const [commits, streak, velocity, skills] = await Promise.all([
      this.prisma.commit.count({
        where: {
          repository: { userId },
          committedAt: { gte: new Date(Date.now() - 30 * 86400_000) },
        },
      }),
      this.prisma.streak.findMany({
        where: { userId, committed: true },
        orderBy: { date: 'desc' },
        take: 30,
      }),
      this.prisma.momentumSignal.findFirst({
        where: { userId },
        orderBy: { computedAt: 'desc' },
      }),
      this.prisma.skillConfidence.findMany({
        where: { userId },
        orderBy: { confidence: 'desc' },
        take: 5,
      }),
    ]);

    const context = {
      recentCommits: commits,
      currentStreak: streak.length,
      velocity: velocity?.velocity || 0,
      burnoutRisk: velocity?.burnoutRisk || 0,
      topSkills: skills.map((s) => s.skill),
    };

    // Build system prompt
    const systemPrompt = `You are an Engineering Coach helping developers grow their skills and maintain healthy work habits.

Developer Context:
- Recent commits (30 days): ${context.recentCommits}
- Current streak: ${context.currentStreak} days
- Velocity: ${context.velocity.toFixed(2)} commits/day
- Burnout risk: ${(context.burnoutRisk * 100).toFixed(0)}%
- Top skills: ${context.topSkills.join(', ') || 'None yet'}

Provide actionable, specific advice. Be encouraging but honest. Keep responses under 300 words.`;

    // Call AI service
    const response = await this.aiService.complete(
      userId,
      `${systemPrompt}\n\nDeveloper question: ${data.prompt}`,
      { maxTokens: 512 },
    );

    // Store session
    const session = await this.prisma.coachSession.create({
      data: {
        userId,
        prompt: data.prompt,
        response: response.text,
        model: response.model,
      },
    });

    return {
      id: session.id,
      prompt: session.prompt,
      response: session.response,
      model: session.model,
      createdAt: session.createdAt,
    };
  }

  /**
   * Get coaching session history.
   */
  async getSessions(userId: string, limit = 20) {
    const sessions = await this.prisma.coachSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        prompt: true,
        response: true,
        model: true,
        createdAt: true,
      },
    });

    return sessions;
  }

  /**
   * Get a single coaching session.
   */
  async getSession(id: string, userId: string) {
    const session = await this.prisma.coachSession.findFirst({
      where: { id, userId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    return {
      id: session.id,
      prompt: session.prompt,
      response: session.response,
      model: session.model,
      createdAt: session.createdAt,
    };
  }
}
