// Sentry MUST be initialized before any other imports so it can instrument
// the entire application — including NestJS lifecycle hooks, providers, and pipes.
import * as Sentry from '@sentry/node';

const sentryDsn = process.env.SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV ?? 'development',
    // Only send traces in production to avoid noise during development
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    // Capture unhandled promise rejections automatically
    integrations: [Sentry.onUncaughtExceptionIntegration()],
  });
}

import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Suppress default NestJS logger; Pino takes over
    bufferLogs: true,
  });

  // ── Pino structured logger ──────────────────────────────────
  app.useLogger(app.get(Logger));

  // ── Sentry global error capture ──────────────────────────────
  if (sentryDsn) {
    const { httpAdapter } = app.get(HttpAdapterHost);
    app.useGlobalFilters(new SentryExceptionFilter(httpAdapter));
  }

  // ── Global validation pipe ──────────────────────────────────
  // whitelist: strip unknown properties silently
  // forbidNonWhitelisted: raise 400 on unknown props
  // transform: auto-cast to DTO types
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── URI versioning (/api/v1/...) ────────────────────────────
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ── CORS ────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Trace-Id'],
  });

  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port, '0.0.0.0');

  process.stdout.write(
    `[DevTrack API] Listening on port ${port} (${process.env.NODE_ENV ?? 'development'})\n`,
  );
}

void bootstrap();
