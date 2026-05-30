import { Injectable, Logger, ServiceUnavailableException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NvidiaNimProvider } from './providers/nvidia-nim.provider';
import { GroqProvider } from './providers/groq.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { MockProvider } from './providers/mock.provider';
import { AIOptions, AIResult } from './providers/ai-provider.interface';
import { ConfigService } from '@nestjs/config';
import { buildRepoAnalysisPrompt } from './prompts/v1/repo-analysis.prompt';

/**
 * AiService — orchestrates the provider fallback chain.
 *
 * Chain: NVIDIA NIM → Groq → Gemini → ServiceUnavailableException
 *
 * All completions are logged to AIInsight table for:
 * - Cost auditing
 * - User-level usage caps
 * - Debugging prompt/response quality
 *
 * Cost guard: maxTokens hard-capped per call to prevent runaway costs.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private static readonly MAX_TOKENS_CAP = 2048;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly nvidia: NvidiaNimProvider,
    private readonly groq: GroqProvider,
    private readonly gemini: GeminiProvider,
    private readonly mock: MockProvider,
  ) {}

  async complete(
    userId: string,
    prompt: string,
    options: AIOptions = {},
  ): Promise<AIResult> {
    // Hard cap on tokens — never allow callers to exceed this
    const safeOptions: AIOptions = {
      ...options,
      maxTokens: Math.min(options.maxTokens ?? 1024, AiService.MAX_TOKENS_CAP),
    };

    const result = await this.tryProviders(prompt, safeOptions);

    // Persist to AIInsight for auditability
    await this.prisma.aIInsight.create({
      data: {
        userId,
        provider: result.provider,
        model: result.model,
        prompt: prompt.slice(0, 5000), // cap stored prompt length
        response: result.text,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
      },
    });

    return result;
  }

  /**
   * Fetch a single AIInsight owned by `userId` or throw NotFound.
   */
  async getInsightOwned(userId: string, id: string) {
    const insight = await this.prisma.aIInsight.findFirst({ where: { id, userId } });
    if (!insight) throw new NotFoundException('Insight not found');
    return insight;
  }

  /**
   * Delete an AIInsight owned by `userId` or throw NotFound.
   */
  async deleteInsightOwned(userId: string, id: string) {
    const insight = await this.prisma.aIInsight.findFirst({ where: { id, userId } });
    if (!insight) throw new NotFoundException('Insight not found');
    await this.prisma.aIInsight.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Run a repo analysis for a repository owned by `userId`.
   * Centralizes ownership check and upserts the summary.
   */
  async runRepoAnalysisOwned(userId: string, repositoryId: string) {
    const repo = await this.prisma.repository.findFirst({ where: { id: repositoryId, userId } });
    if (!repo) throw new NotFoundException('Repository not found');

    const [commits7d, commits30d] = await Promise.all([
      this.prisma.commit.count({ where: { repositoryId: repo.id, committedAt: { gte: new Date(Date.now() - 7 * 86400_000) } } }),
      this.prisma.commit.count({ where: { repositoryId: repo.id, committedAt: { gte: new Date(Date.now() - 30 * 86400_000) } } }),
    ]);

    const prompt = buildRepoAnalysisPrompt({ commits7d, commits30d, topLanguage: repo.language ?? 'various' });

    const result = await this.complete(userId, prompt, { maxTokens: 512 });

    await this.prisma.repoAnalysis.upsert({
      where: { repositoryId: repo.id },
      create: { repositoryId: repo.id, summary: result.text, languages: {} },
      update: { summary: result.text, analyzedAt: new Date() },
    });

    return { summary: result.text, provider: result.provider, model: result.model };
  }

  /**
   * Returns availability status for configured providers.
   */
  async getProvidersStatus(): Promise<{ name: string; available: boolean }[]> {
    const providers = [this.mock, this.nvidia, this.groq, this.gemini];
    const out: { name: string; available: boolean }[] = [];
    for (const p of providers) {
      try {
        const available = await p.isAvailable();
        out.push({ name: p.name, available });
      } catch (e) {
        out.push({ name: p.name, available: false });
      }
    }
    return out;
  }

  private async tryProviders(
    prompt: string,
    options: AIOptions,
  ): Promise<AIResult> {
    const useMock =
      this.config.get<string>('NODE_ENV') === 'test' ||
      this.config.get<string>('AI_MOCK_PROVIDER') === 'true';

    const providers = useMock
      ? [this.mock, this.nvidia, this.groq, this.gemini]
      : [this.nvidia, this.groq, this.gemini];

    for (const provider of providers) {
      const available = await provider.isAvailable();
      if (!available) {
        this.logger.warn(`Provider ${provider.name} not configured — skipping`);
        continue;
      }

      try {
        return await provider.complete(prompt, options);
      } catch (error) {
        this.logger.warn({
          msg: `Provider ${provider.name} failed — trying next`,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    throw new ServiceUnavailableException('All configured AI providers failed to generate a response. Please check your API keys.');
  }
}
