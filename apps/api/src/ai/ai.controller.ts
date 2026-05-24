import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AiService } from './ai.service';
import { AIOptions } from './providers/ai-provider.interface';
import { PrismaService } from '../database/prisma.service';
import { IsString, MaxLength, IsOptional, IsNumber, Min, Max, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

class AiCompleteDto {
  @IsString()
  @MaxLength(4000)
  prompt!: string;

  @IsOptional()
  @IsNumber()
  @Min(64)
  @Max(2048)
  maxTokens?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  systemPrompt?: string;
}

class InsightsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number;
}

import { ElevenLabsService } from './providers/elevenlabs.service';

class ChatAssistantDto {
  @IsString()
  @MaxLength(2000)
  message!: string;
}

@Controller({ path: 'ai', version: '1' })
@UseGuards(ClerkAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
    private readonly elevenLabs: ElevenLabsService,
  ) {}

  /**
   * POST /api/v1/ai/complete
   * Raw AI completion — for custom prompts.
   */
  @Post('complete')
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AiCompleteDto,
  ) {
    const options: AIOptions = {};
    if (dto.maxTokens !== undefined) options.maxTokens = dto.maxTokens;
    if (dto.systemPrompt !== undefined) options.systemPrompt = dto.systemPrompt;
    return this.aiService.complete(user.id, dto.prompt, options);
  }

  /**
   * GET /api/v1/ai/insights
   * Returns the user's AI-generated growth insights (paginated).
   * Insights are generated nightly by AiAnalysisJob.
   */
  @Get('insights')
  async getInsights(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: InsightsQueryDto,
  ) {
    const limit = query.limit ?? 10;

    const insights = await this.prisma.aIInsight.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        provider: true,
        model: true,
        response: true,
        tokensUsed: true,
        latencyMs: true,
        createdAt: true,
        // Omit prompt from list view for privacy / response size
      },
    });

    return { insights, count: insights.length };
  }

  /**
   * GET /api/v1/ai/insights/latest
   * Returns the single most recent insight.
   * Used by mobile dashboard for the "Today's Insight" card.
   */
  @Get('insights/latest')
  async getLatestInsight(@CurrentUser() user: AuthenticatedUser) {
    const insight = await this.prisma.aIInsight.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        provider: true,
        model: true,
        response: true,
        createdAt: true,
      },
    });

    return insight ?? null;
  }

  /**
   * POST /api/v1/ai/insights/generate
   * Manually trigger an AI insight generation for the current user.
   * Useful for onboarding and testing without waiting for the nightly cron.
   */
  @Post('insights/generate')
  async generateInsight(@CurrentUser() user: AuthenticatedUser) {
    const [commits7d, commits30d, topLang] = await Promise.all([
      this.prisma.commit.count({
        where: {
          repository: { userId: user.id },
          committedAt: { gte: new Date(Date.now() - 7 * 86400_000) },
        },
      }),
      this.prisma.commit.count({
        where: {
          repository: { userId: user.id },
          committedAt: { gte: new Date(Date.now() - 30 * 86400_000) },
        },
      }),
      this.prisma.repository.findFirst({
        where: { userId: user.id, language: { not: null } },
        orderBy: { starCount: 'desc' },
        select: { language: true },
      }),
    ]);

    const prompt = `You are a developer growth coach. Based on these stats:
- Commits last 7 days: ${commits7d}
- Commits last 30 days: ${commits30d}
- Primary language: ${topLang?.language ?? 'various'}

Provide a concise 3-4 sentence growth insight with one specific, actionable recommendation.`;

    const result = await this.aiService.complete(user.id, prompt, {
      maxTokens: 512,
      systemPrompt: 'You are a concise, data-driven developer growth coach.',
    });

    return {
      text: result.text,
      response: result.text,
      provider: result.provider,
      model: result.model,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * POST /api/v1/ai/assistant/chat
   * RAG-powered developer workspace AI Assistant.
   * Leverages projects, tasks, repositories, and commits context.
   * Can return optional ElevenLabs base64 voice feedback.
   */
  @Post('assistant/chat')
  async assistantChat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChatAssistantDto,
  ) {
    // 1. Gather RAG context (projects, tasks, repos, commits)
    const [projects, repos] = await Promise.all([
      this.prisma.project.findMany({
        where: { userId: user.id, deletedAt: null },
        include: { tasks: true },
      }),
      this.prisma.repository.findMany({
        where: { userId: user.id },
        include: {
          commits: {
            orderBy: { committedAt: 'desc' },
            take: 5,
          },
        },
      }),
    ]);

    // 2. Build contextual representation
    let contextStr = 'USER WORKSPACE CONTEXT:\n\n';
    
    contextStr += 'PROJECTS AND TASKS:\n';
    if (projects.length === 0) {
      contextStr += 'No projects created yet.\n';
    } else {
      for (const p of projects) {
        contextStr += `- Project: ${p.name} (Status: ${p.status})\n`;
        if (p.description) contextStr += `  Description: ${p.description}\n`;
        const activeTasks = p.tasks.filter((t) => t.status !== 'DONE');
        if (activeTasks.length > 0) {
          contextStr += `  Active Tasks:\n`;
          for (const t of activeTasks) {
            contextStr += `    * [${t.status}] ${t.title} (Priority: ${t.priority})\n`;
          }
        }
      }
    }

    contextStr += '\nGITHUB REPOSITORIES AND RECENT ACTIVITY:\n';
    if (repos.length === 0) {
      contextStr += 'No GitHub repositories synced yet. Connection might be pending.\n';
    } else {
      for (const r of repos) {
        contextStr += `- Repo: ${r.fullName} (Language: ${r.language ?? 'Various'})\n`;
        contextStr += `  Stats: ${r.starCount} stars | ${r.openIssueCount} open issues\n`;
        if (r.commits.length > 0) {
          contextStr += `  Recent Commits:\n`;
          for (const c of r.commits) {
            contextStr += `    * ${c.message} (${c.committedAt.toISOString().split('T')[0]})\n`;
          }
        }
      }
    }

    // 3. Complete using our AI pipeline
    const systemPrompt = `You are DevTrack AI, a professional developer assistant/workspace copilot.
You have access to the user's local projects, tasks, connected GitHub repositories, and commits.
Provide a professional, concise (1-3 sentences), highly actionable answer to the user's request.
Always reference their actual projects/repositories/tasks if relevant to make it specific.

${contextStr}`;

    const completion = await this.aiService.complete(user.id, dto.message, {
      systemPrompt,
      maxTokens: 512,
      temperature: 0.3,
    });

    // 4. Generate TTS via ElevenLabs if configured
    let audioBase64: string | null = null;
    if (await this.elevenLabs.isAvailable()) {
      audioBase64 = await this.elevenLabs.textToSpeech(completion.text);
    }

    return {
      text: completion.text,
      provider: completion.provider,
      model: completion.model,
      audio: audioBase64,
    };
  }
}
