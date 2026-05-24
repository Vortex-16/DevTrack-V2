export interface AIOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface AIResult {
  text: string;
  tokensUsed: number | null;
  latencyMs: number;
  provider: string;
  model: string;
}

/**
 * All AI provider implementations must implement this interface.
 * AiService orchestrates providers — never depends on concrete implementations.
 */
export interface AIProvider {
  readonly name: string;
  readonly model: string;
  isAvailable(): Promise<boolean>;
  complete(prompt: string, options?: AIOptions): Promise<AIResult>;
}
