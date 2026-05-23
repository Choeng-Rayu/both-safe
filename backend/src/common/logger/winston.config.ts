import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';

const { combine, timestamp, json, errors, printf, colorize } = format;

const LOGS_DIR = process.env.LOGS_DIR || path.join(process.cwd(), 'logs');

// Console format for development — human readable
const consoleFormat = printf(
  ({ level, message, timestamp: ts, context, ...metadata }) => {
    const ctx = context ? ` [${context}]` : '';
    const meta = Object.keys(metadata).length
      ? ` ${JSON.stringify(metadata)}`
      : '';
    return `${ts}${ctx} ${level}: ${message}${meta}`;
  },
);

// File format — structured JSON for parsing
const fileFormat = combine(timestamp(), errors({ stack: true }), json());

// Daily rotate file transport for all logs
const dailyRotateCombined = new DailyRotateFile({
  dirname: LOGS_DIR,
  filename: 'bothsafe-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  format: fileFormat,
});

// Daily rotate file transport for errors only
const dailyRotateError = new DailyRotateFile({
  dirname: LOGS_DIR,
  filename: 'bothsafe-error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '60d',
  level: 'error',
  format: fileFormat,
});

// Console transport
const consoleTransport = new transports.Console({
  format: combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    consoleFormat,
  ),
});

export function createWinstonLogger() {
  return createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: 'bothsafe-backend' },
    transports: [consoleTransport, dailyRotateCombined, dailyRotateError],
    // Don't exit on uncaught errors — let NestJS handle it
    exitOnError: false,
  });
}

export { LOGS_DIR };
