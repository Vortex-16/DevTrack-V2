import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProvider, AIOptions, AIResult } from './ai-provider.interface';

/**
 * NVIDIA NIM provider — primary AI provider.
 * Uses OpenAI-compatible REST API with llama-3.1-70b-instruct.
 * Max free tokens: check https://build.nvidia.com/nim for current limits.
 */
@Injectable()
export class NvidiaNimProvider implements AIProvider {
  readonly name = 'nvidia-nim';
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly logger = new Logger(NvidiaNimProvider.name);

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('NVIDIA_NIM_API_KEY') ?? '';
    this.baseUrl =
      this.config.get<string>('NVIDIA_NIM_BASE_URL') ??
      'https://integrate.api.nvidia.com/v1';
    this.model =
      this.config.get<string>('NVIDIA_NIM_MODEL') ??
      'meta/llama-3.1-70b-instruct';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async complete(prompt: string, options: AIOptions = {}): Promise<AIResult> {
    const start = Date.now();
    const maxTokens = options.maxTokens ?? 1024;

    const body = {
      model: this.model,
      messages: [
        ...(options.systemPrompt
          ? [{ role: 'system', content: options.systemPrompt }]
          : []),
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: options.temperature ?? 0.4,
      stream: false,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000), // 30s timeout
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`NVIDIA NIM error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
      usage?: { total_tokens: number };
    };

    const text = data.choices[0]?.message.content ?? '';
    const latencyMs = Date.now() - start;

    this.logger.debug({
      msg: 'NVIDIA NIM completion',
      model: this.model,
      tokensUsed: data.usage?.total_tokens,
      latencyMs,
    });

    return {
      text,
      tokensUsed: data.usage?.total_tokens ?? null,
      latencyMs,
      provider: this.name,
      model: this.model,
    };
  }
}
