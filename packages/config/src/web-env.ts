import { z } from 'zod';

// Web environment schema — validated at build/boot time.
// NEXT_PUBLIC_ variables are bundled into the client bundle by Next.js.
// Server-only variables (no NEXT_PUBLIC_ prefix) must never reach the browser.
export const webEnvSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // API
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),

  // Clerk — public key goes to the browser, secret key stays server-only
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  CLERK_SECRET_KEY: z.string().startsWith('sk_'),

  // Clerk redirect routes
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default('/sign-in'),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default('/sign-up'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default('/dashboard'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().default('/dashboard'),

  // Observability (both optional for local dev)
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

/**
 * Validates process.env against the web app schema.
 * Call once in next.config.ts to catch missing variables at build time.
 *
 * Usage:
 *   import { validateWebEnv } from '@devtrack/config';
 *   validateWebEnv(process.env);
 */
export function validateWebEnv(config: Record<string, unknown>): WebEnv {
  const result = webEnvSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`\n[DevTrack Web] Environment validation failed:\n${errors}\n`);
  }
  return result.data;
}
