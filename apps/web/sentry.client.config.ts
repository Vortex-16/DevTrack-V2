import * as Sentry from '@sentry/nextjs';

// Sentry browser-side initialization.
// Only runs in the browser — does NOT run during SSR or builds.
// Loaded automatically by the @sentry/nextjs SDK via instrumentation.ts.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Capture 10% of sessions as performance traces in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

  // Record user interactions (clicks, navigation) for session replays
  replaysOnErrorSampleRate: 1.0,   // 100% of error sessions get a replay
  replaysSessionSampleRate: 0.05,  // 5% of normal sessions get a replay

  integrations: [
    Sentry.replayIntegration(),
  ],
});
