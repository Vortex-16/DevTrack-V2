import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateApiEnv } from '@devtrack/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { getPinoOptions } from '@devtrack/logger';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GithubModule } from './github/github.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AiModule } from './ai/ai.module';
import { ProjectsModule } from './projects/projects.module';
import { LearningModule } from './learning/learning.module';
import { JobsModule } from './jobs/jobs.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // ── Config (must be first) ────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
      validate: validateApiEnv,
    }),

    // ── Structured logging (Pino) ─────────────────────────────
    LoggerModule.forRoot({
      pinoHttp: {
        ...getPinoOptions({
          nodeEnv: process.env.NODE_ENV ?? 'development',
          serviceName: 'api',
        }),
        customProps: (req: import('http').IncomingMessage) => ({
          traceId:
            (req.headers['x-trace-id'] as string | undefined) ?? crypto.randomUUID(),
        }),
        autoLogging: {
          ignore: (req: import('http').IncomingMessage) =>
            req.url === '/health' || req.url?.startsWith('/health?') === true,
        },
      },
    }),

    // ── Rate limiting (free-tier abuse prevention) ────────────
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },   // 10 req/s burst
      { name: 'long',  ttl: 60000, limit: 100 },  // 100 req/min sustained
    ]),

    // ── Async infrastructure ──────────────────────────────────
    EventEmitterModule.forRoot({ wildcard: true, maxListeners: 20 }),
    ScheduleModule.forRoot(),

    // ── Feature domains ───────────────────────────────────────
    DatabaseModule,
    AuthModule,
    UsersModule,
    GithubModule,
    AnalyticsModule,
    AiModule,
    ProjectsModule,
    LearningModule,
    JobsModule,
    HealthModule,
  ],
})
export class AppModule {}
