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
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Suppress default NestJS logger; Pino takes over
    bufferLogs: true,
    rawBody: true,
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

  // ── HTTP security headers (Helmet) ───────────────────────────
  try {
    // Use runtime require so CI/dev machines without the package can still run typecheck
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const helmet = require('helmet') as any;
    app.use(
      helmet({
        // Basic CSP tailored for API responses; frontend CSP is managed by the web app
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            connectSrc: [process.env.FRONTEND_URL ?? 'http://localhost:3000'],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            imgSrc: ["'self'", 'data:'],
            styleSrc: ["'self'", "'unsafe-inline'"],
          },
        },
      }),
    );
  } catch (e) {
    // Helmet not installed — skip middleware (dev environments may omit it)
  }

  // ── Swagger API Documentation ────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('DevTrack V2 API')
      .setDescription('Engineering Growth OS - Track commits, analyze patterns, and accelerate developer growth')
      .setVersion('2.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your Clerk JWT token',
        },
        'JWT',
      )
      .addTag('auth', 'Authentication & Authorization')
      .addTag('users', 'User Management')
      .addTag('github', 'GitHub Integration')
      .addTag('analytics', 'Analytics & Insights')
      .addTag('ai', 'AI-Powered Features')
      .addTag('intelligence', 'Intelligence Layer')
      .addTag('projects', 'Project Management')
      .addTag('learning', 'Learning Logs')
      .addTag('admin', 'Admin Operations')
      .addTag('health', 'Health Checks')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'DevTrack V2 API Docs',
      customfavIcon: 'https://nestjs.com/img/logo-small.svg',
      customCss: '.swagger-ui .topbar { display: none }',
    });

    process.stdout.write('[DevTrack API] Swagger docs available at /api/docs\n');
  }

  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port, '0.0.0.0');

  process.stdout.write(
    `[DevTrack API] Listening on port ${port} (${process.env.NODE_ENV ?? 'development'})\n`,
  );
}

void bootstrap();
