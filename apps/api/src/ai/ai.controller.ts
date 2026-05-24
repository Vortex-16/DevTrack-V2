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

@Controller({ path: 'ai', version: '1' })
@UseGuards(ClerkAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
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
      provider: result.provider,
      model: result.model,
      generatedAt: new Date().toISOString(),
    };
  }
}
