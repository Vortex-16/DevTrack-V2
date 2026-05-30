import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NvidiaNimProvider as SharedNvidiaNimProvider } from '@devtrack/ai-client';
import { AIProvider } from './ai-provider.interface';

/**
 * NVIDIA NIM provider — primary AI provider.
 * Extends the shared package provider implementation.
 */
@Injectable()
export class NvidiaNimProvider extends SharedNvidiaNimProvider implements AIProvider {
  private readonly nestLogger = new Logger(NvidiaNimProvider.name);

  constructor(private readonly config: ConfigService) {
    super({
      apiKey: config.get<string>('NVIDIA_NIM_API_KEY') ?? '',
      baseUrl: config.get<string>('NVIDIA_NIM_BASE_URL') ?? 'https://integrate.api.nvidia.com/v1',
      model: config.get<string>('NVIDIA_NIM_MODEL') ?? 'meta/llama-3.1-70b-instruct',
      logger: {
        debug: (data) => this.nestLogger.debug(data),
        warn: (data) => this.nestLogger.warn(data),
        error: (data) => this.nestLogger.error(data),
      },
    });
  }
}
