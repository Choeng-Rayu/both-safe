import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { Logger } from 'winston';
import { createWinstonLogger } from './winston.config';

@Injectable()
export class WinstonLoggerService implements LoggerService {
  private readonly logger: Logger;

  constructor() {
    this.logger = createWinstonLogger();
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { context, trace });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
  }

  // Additional structured logging for business events
  event(eventName: string, metadata: Record<string, unknown>) {
    this.logger.info(`[EVENT] ${eventName}`, { event: eventName, ...metadata });
  }

  // HTTP access logging
  httpAccess(meta: {
    method: string;
    url: string;
    statusCode: number;
    durationMs: number;
    ip?: string;
    userAgent?: string;
    requestId?: string;
    actorType?: string;
    actorId?: string;
    dealId?: string;
    error?: string;
  }) {
    this.logger.info(
      `[HTTP] ${meta.method} ${meta.url} ${meta.statusCode} ${meta.durationMs}ms`,
      {
        type: 'http_access',
        ...meta,
      },
    );
  }

  // Business action logging for debugging issues
  action(actionName: string, meta: Record<string, unknown>) {
    this.logger.info(`[ACTION] ${actionName}`, { action: actionName, ...meta });
  }

  setLogLevels(levels: LogLevel[]) {
    this.logger.level = levels[0] ?? 'info';
  }
}
