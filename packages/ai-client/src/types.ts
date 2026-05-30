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

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  isAvailable(): Promise<boolean>;
  complete(prompt: string, options?: AIOptions): Promise<AIResult>;
}

export interface LoggerInterface {
  debug(data: Record<string, unknown> | string): void;
  warn(data: Record<string, unknown> | string): void;
  error(data: Record<string, unknown> | string | Error): void;
}
