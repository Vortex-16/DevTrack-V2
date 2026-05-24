import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter — catches all unhandled exceptions and returns
 * a consistent JSON error envelope. Logs structured errors with trace ID.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const traceId = (request.headers['x-trace-id'] as string | undefined) ?? 'unknown';

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      message =
        typeof res === 'string'
          ? res
          : (res as { message?: string | string[] }).message?.toString() ??
            exception.message;
    }

    // Always log 5xx as errors, 4xx as warnings
    if (statusCode >= 500) {
      this.logger.error({
        msg: 'Unhandled exception',
        traceId,
        statusCode,
        path: request.url,
        method: request.method,
        error: exception instanceof Error ? exception.stack : String(exception),
      });
    } else {
      this.logger.warn({
        msg: 'Client error',
        traceId,
        statusCode,
        path: request.url,
        method: request.method,
        message,
      });
    }

    response.status(statusCode).json({
      statusCode,
      message,
      traceId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
