import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WinstonLoggerService } from '../logger/winston-logger.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: WinstonLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') {
      this.logger.error(
        'Non-HTTP exception',
        exception instanceof Error ? exception.stack : undefined,
        AllExceptionsFilter.name,
      );
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let messageKey = 'error.internal';
    let message: string | string[] = 'Internal server error';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      let serviceProvidedKey = false;
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        message = (r.message as string | string[]) ?? exception.message;
        if (typeof r.messageKey === 'string' && r.messageKey.length > 0) {
          messageKey = r.messageKey;
          serviceProvidedKey = true;
        }
        details = r.details;
      }
      // Only fall back to a generic key when the service didn't
      // bother specifying one. Otherwise the domain-specific key
      // (e.g. wallet.insufficient_funds) gets swallowed by the
      // catch-all `validation.failed` and the frontend has no way
      // to render a useful message.
      if (!serviceProvidedKey) {
        if (status === HttpStatus.BAD_REQUEST) messageKey = 'validation.failed';
        else if (status === HttpStatus.UNAUTHORIZED) messageKey = 'auth.unauthorized';
        else if (status === HttpStatus.FORBIDDEN) messageKey = 'auth.forbidden';
        else if (status === HttpStatus.NOT_FOUND) messageKey = 'resource.not_found';
        else if (status === 429) messageKey = 'auth.rate_limited';
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
        AllExceptionsFilter.name,
      );
      message = 'Internal server error';
    }

    // Log structured error for all 5xx and important 4xx
    if (status >= 400) {
      this.logger.error(
        `HTTP ${status} ${request.method} ${request.url} — ${messageKey}: ${Array.isArray(message) ? message.join(', ') : message}`,
        exception instanceof Error ? exception.stack : undefined,
        AllExceptionsFilter.name,
      );
      this.logger.event('http_error', {
        statusCode: status,
        method: request.method,
        url: request.url,
        messageKey,
        message: Array.isArray(message) ? message.join(', ') : message,
        details,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    }

    response.status(status).json({
      statusCode: status,
      messageKey,
      message,
      details,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
