import * as Sentry from '@sentry/nextjs';

// Sentry server-side initialization.
// Runs on the Next.js Node.js server (SSR, API routes).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
});
