import { z } from 'zod';

// API environment schema — validated at boot, throws on missing
export const apiEnvSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  API_URL: z.string().url().default('http://localhost:3001'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // Database (Neon)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL is required'),

  // Clerk Auth
  CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),
  CLERK_SECRET_KEY: z.string().startsWith('sk_').optional(),
  CLERK_ISSUER_URL: z.string().url(),
  CLERK_JWKS_URL: z.string().url().optional(),

  // Security
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes)'),

  // GitHub OAuth
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_CALLBACK_URL: z.string().url(),
  MOBILE_DEEP_LINK_BASE: z.string().default('devtrack://oauth/github'),

  // AI Providers (all optional — service degrades gracefully)
  NVIDIA_NIM_API_KEY: z.string().optional(),
  NVIDIA_NIM_BASE_URL: z.string().url().optional(),
  NVIDIA_NIM_MODEL: z.string().optional(),

  GEMINI_API_KEY: z.string().optional(),

  GROQ_API_KEY: z.string().optional(),
  GROQ_BASE_URL: z.string().url().optional(),
  GROQ_MODEL: z.string().optional(),

  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),

  // Observability
  SENTRY_DSN: z.string().url().optional(),
  LOGTAIL_SOURCE_TOKEN: z.string().optional(),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

/**
 * Validates process.env against the API schema.
 * Call once at bootstrap — throws with clear error messages if invalid.
 *
 * Usage in NestJS:
 *   ConfigModule.forRoot({ validate: validateApiEnv })
 */
export function validateApiEnv(config: Record<string, unknown>): ApiEnv {
  const result = apiEnvSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  • ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`\n[DevTrack] Environment validation failed:\n${errors}\n`);
  }
  return result.data;
}
