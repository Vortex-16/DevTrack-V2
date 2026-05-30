import { Injectable } from '@nestjs/common';
import { AIOptions, AIProvider, AIResult } from './ai-provider.interface';

/**
 * Mock AI provider for local development and CI.
 * Keep it deterministic so tests stay simple.
 */
@Injectable()
export class MockProvider implements AIProvider {
  readonly name = 'mock';
  readonly model = 'mock/v1';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async complete(prompt: string, options?: AIOptions): Promise<AIResult> {
    const text = `Mock AI response. Prompt length: ${prompt.length}. Max tokens: ${options?.maxTokens ?? 0}.`;

    return {
      text,
      tokensUsed: 0,
      latencyMs: 1,
      provider: this.name,
      model: this.model,
    };
  }
}
