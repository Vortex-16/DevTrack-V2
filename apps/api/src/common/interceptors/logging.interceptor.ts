import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

/**
 * Logs the duration of every HTTP request at the controller level.
 * Works alongside Pino HTTP middleware (which logs at transport level).
 * This interceptor logs after-controller timing for SLA observability.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { traceId?: string }>();

    const { method, url } = request;
    const traceId = request.traceId ?? 'unknown';
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.debug(`${method} ${url} +${duration}ms [${traceId}]`);
      }),
    );
  }
}
