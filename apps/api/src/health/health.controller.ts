import { Controller, Get } from '@nestjs/common';

/**
 * Health check — no auth, no DB.
 * Used by load balancers, Render health checks, and mobile connectivity tests.
 * Intentionally kept minimal to avoid logging noise (excluded by Pino autoLogging).
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'devtrack-api',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }
}
