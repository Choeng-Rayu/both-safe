import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
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
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        message = (r.message as string | string[]) ?? exception.message;
        messageKey = (r.messageKey as string) ?? messageKey;
        details = r.details;
      }
      if (status === HttpStatus.BAD_REQUEST) messageKey = 'validation.failed';
      if (status === HttpStatus.UNAUTHORIZED) messageKey = 'auth.unauthorized';
      if (status === HttpStatus.FORBIDDEN) messageKey = 'auth.forbidden';
      if (status === HttpStatus.NOT_FOUND) messageKey = 'resource.not_found';
      if (status === 429) messageKey = 'auth.rate_limited';
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      message = 'Internal server error';
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
