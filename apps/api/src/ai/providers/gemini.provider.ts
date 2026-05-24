import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProvider, AIOptions, AIResult } from './ai-provider.interface';

/**
 * Gemini provider — fallback when NVIDIA NIM is unavailable or fails.
 * Uses Gemini 1.5 Flash via REST API (generous free tier).
 */
@Injectable()
export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  readonly model = 'gemini-1.5-flash';
  private readonly apiKey: string;
  private readonly logger = new Logger(GeminiProvider.name);

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY') ?? '';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async complete(prompt: string, options: AIOptions = {}): Promise<AIResult> {
    const start = Date.now();

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.4,
      },
      ...(options.systemPrompt
        ? { systemInstruction: { parts: [{ text: options.systemPrompt }] } }
        : {}),
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as {
      candidates: { content: { parts: { text: string }[] } }[];
      usageMetadata?: { totalTokenCount: number };
    };

    const text = data.candidates[0]?.content.parts[0]?.text ?? '';
    const latencyMs = Date.now() - start;

    this.logger.debug({
      msg: 'Gemini completion',
      model: this.model,
      tokensUsed: data.usageMetadata?.totalTokenCount,
      latencyMs,
    });

    return {
      text,
      tokensUsed: data.usageMetadata?.totalTokenCount ?? null,
      latencyMs,
      provider: this.name,
      model: this.model,
    };
  }
}
