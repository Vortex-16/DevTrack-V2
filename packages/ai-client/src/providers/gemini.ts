import { AIProvider, AIOptions, AIResult, LoggerInterface } from '../types';

export interface GeminiOptions {
  apiKey: string;
  model?: string;
  logger?: LoggerInterface;
}

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  readonly model: string;
  private readonly apiKey: string;
  private readonly logger?: LoggerInterface;

  constructor(options: GeminiOptions) {
    this.apiKey = (options.apiKey ?? '').replace(/^["']|["']$/g, '');
    this.model = (options.model ?? 'gemini-1.5-flash').replace(/^["']|["']$/g, '');
    if (options.logger) this.logger = options.logger;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && this.apiKey !== 'AIza...' && this.apiKey !== '';
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

    if (this.logger) {
      this.logger.debug({
        msg: 'Gemini completion completed',
        model: this.model,
        tokensUsed: data.usageMetadata?.totalTokenCount ?? null,
        latencyMs,
      });
    }

    return {
      text,
      tokensUsed: data.usageMetadata?.totalTokenCount ?? null,
      latencyMs,
      provider: this.name,
      model: this.model,
    };
  }
}
