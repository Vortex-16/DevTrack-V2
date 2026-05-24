import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NvidiaNimProvider } from './providers/nvidia-nim.provider';
import { GroqProvider } from './providers/groq.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { AIOptions, AIResult } from './providers/ai-provider.interface';

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
    private readonly nvidia: NvidiaNimProvider,
    private readonly groq: GroqProvider,
    private readonly gemini: GeminiProvider,
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

  private async tryProviders(
    prompt: string,
    options: AIOptions,
  ): Promise<AIResult> {
    const providers = [this.nvidia, this.groq, this.gemini];

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
