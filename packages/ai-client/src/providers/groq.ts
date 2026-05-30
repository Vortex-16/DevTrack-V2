import { AIProvider, AIOptions, AIResult, LoggerInterface } from '../types';

export interface GroqOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  logger?: LoggerInterface;
}

export class GroqProvider implements AIProvider {
  readonly name = 'groq';
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly logger?: LoggerInterface;

  constructor(options: GroqOptions) {
    this.apiKey = (options.apiKey ?? '').replace(/^["']|["']$/g, '');
    this.baseUrl = (options.baseUrl ?? 'https://api.groq.com/openai/v1').replace(/^["']|["']$/g, '');
    this.model = (options.model ?? 'llama3-8b-8192').replace(/^["']|["']$/g, '');
    if (options.logger) this.logger = options.logger;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && this.apiKey !== 'gsk_...';
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
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Groq error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
      usage?: { total_tokens: number };
    };

    const text = data.choices[0]?.message.content ?? '';
    const latencyMs = Date.now() - start;

    if (this.logger) {
      this.logger.debug({
        msg: 'Groq completion completed',
        model: this.model,
        tokensUsed: data.usage?.total_tokens ?? null,
        latencyMs,
      });
    }

    return {
      text,
      tokensUsed: data.usage?.total_tokens ?? null,
      latencyMs,
      provider: this.name,
      model: this.model,
    };
  }
}
