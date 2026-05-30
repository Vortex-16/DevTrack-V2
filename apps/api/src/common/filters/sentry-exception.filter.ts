import { ArgumentsHost, Catch } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

/**
 * Extends the default NestJS exception filter to forward unhandled errors to Sentry.
 * 4xx client errors are NOT forwarded — only 5xx server errors are captured.
 *
 * Register globally in main.ts after app.useLogger():
 *   app.useGlobalFilters(new SentryExceptionFilter());
 */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const isClientError =
      exception instanceof Error &&
      'status' in exception &&
      typeof (exception as { status: number }).status === 'number' &&
      (exception as { status: number }).status < 500;

    // Do not report client-side 4xx errors to Sentry
    if (!isClientError) {
      Sentry.captureException(exception);
    }

    super.catch(exception, host);
  }
}
