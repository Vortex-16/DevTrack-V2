import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Injects a trace ID into every request/response cycle.
 * - Reads X-Trace-Id from incoming request headers (forwarded from frontend)
 * - Generates a new UUID if none present
 * - Sets X-Trace-Id on the response header for client correlation
 * - Attaches traceId to the request object for downstream use
 */
@Injectable()
export class TraceIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request & { traceId?: string }>();
    const response = ctx.getResponse<Response>();

    const traceId =
      (request.headers['x-trace-id'] as string | undefined) ??
      crypto.randomUUID();

    // Attach to request object so controllers/services can access it
    request.traceId = traceId;

    // Propagate back to client for correlation
    response.setHeader('X-Trace-Id', traceId);

    return next.handle().pipe(
      tap(() => {
        // Trace ID already set; hook available for future metric recording
      }),
    );
  }
}
