import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider as SharedGeminiProvider } from '@devtrack/ai-client';
import { AIProvider } from './ai-provider.interface';

/**
 * Gemini provider — fallback when NVIDIA NIM is unavailable or fails.
 * Extends the shared package provider implementation.
 */
@Injectable()
export class GeminiProvider extends SharedGeminiProvider implements AIProvider {
  private readonly nestLogger = new Logger(GeminiProvider.name);

  constructor(private readonly config: ConfigService) {
    super({
      apiKey: config.get<string>('GEMINI_API_KEY') ?? config.get<string>('GOOGLE_API_KEY') ?? '',
      logger: {
        debug: (data) => this.nestLogger.debug(data),
        warn: (data) => this.nestLogger.warn(data),
        error: (data) => this.nestLogger.error(data),
      },
    });
  }
}
