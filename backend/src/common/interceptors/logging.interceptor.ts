import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { WinstonLoggerService } from '../logger/winston-logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: WinstonLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const start = Date.now();
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse();
    const { method, originalUrl, ip, headers } = req;
    const userAgent = headers['user-agent'] ?? '';
    const requestId = headers['x-request-id'] as string | undefined;

    // Extract actor info if available (set by guards)
    const actor = (req as any).actor as
      | { type: string; role?: string; participantId?: string; userId?: string; adminId?: string }
      | undefined;

    const dealPublicId = (req.params?.publicId || req.params?.id || req.body?.public_id) as string | undefined;

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          const statusCode = res.statusCode ?? 200;
          this.logger.httpAccess({
            method,
            url: originalUrl,
            statusCode,
            durationMs: ms,
            ip: ip ?? undefined,
            userAgent,
            requestId,
            actorType: actor?.type,
            actorId: actor?.participantId ?? actor?.userId ?? actor?.adminId,
            dealId: dealPublicId,
          });
        },
        error: (err) => {
          const ms = Date.now() - start;
          const statusCode = err?.status ?? err?.statusCode ?? 500;
          this.logger.httpAccess({
            method,
            url: originalUrl,
            statusCode,
            durationMs: ms,
            ip: ip ?? undefined,
            userAgent,
            requestId,
            actorType: actor?.type,
            actorId: actor?.participantId ?? actor?.userId ?? actor?.adminId,
            dealId: dealPublicId,
            error: err?.message ?? 'Unknown error',
          });
        },
      }),
    );
  }
}
