import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GroqProvider as SharedGroqProvider } from '@devtrack/ai-client';
import { AIProvider } from './ai-provider.interface';

/**
 * Groq provider — high speed inference provider.
 * Extends the shared package provider implementation.
 */
@Injectable()
export class GroqProvider extends SharedGroqProvider implements AIProvider {
  private readonly nestLogger = new Logger(GroqProvider.name);

  constructor(private readonly config: ConfigService) {
    super({
      apiKey: config.get<string>('GROQ_API_KEY') ?? '',
      baseUrl: config.get<string>('GROQ_BASE_URL') ?? 'https://api.groq.com/openai/v1',
      model: config.get<string>('GROQ_MODEL') ?? 'llama3-8b-8192',
      logger: {
        debug: (data) => this.nestLogger.debug(data),
        warn: (data) => this.nestLogger.warn(data),
        error: (data) => this.nestLogger.error(data),
      },
    });
  }
}
