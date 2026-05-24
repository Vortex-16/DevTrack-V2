import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Suppress default NestJS logger; Pino takes over
    bufferLogs: true,
  });

  // ── Pino structured logger ──────────────────────────────────
  app.useLogger(app.get(Logger));

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

  // Use process.stdout.write to avoid importing a logger before it's ready
  process.stdout.write(
    `[DevTrack API] Listening on port ${port} (${process.env.NODE_ENV ?? 'development'})\n`,
  );
}

void bootstrap();
