import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';
import * as fs from 'fs';

const { combine, timestamp, json, errors, printf, colorize } = format;

const LOGS_DIR = process.env.LOGS_DIR || path.join(process.cwd(), 'logs');

// Make sure the logs directory exists *before* any transport tries to
// write to it. winston-daily-rotate-file creates intermediate dirs but
// failing earlier with a clearer error is friendlier in dev.
fs.mkdirSync(LOGS_DIR, { recursive: true });

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

// Dedicated transports for uncaught exceptions / unhandled rejections.
// Without these, Node's default behaviour is to print to stderr and
// exit — and we lose the trace from any file-based observer.
const exceptionTransport = new DailyRotateFile({
  dirname: LOGS_DIR,
  filename: 'bothsafe-exceptions-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '90d',
  format: fileFormat,
});

const rejectionTransport = new DailyRotateFile({
  dirname: LOGS_DIR,
  filename: 'bothsafe-rejections-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '90d',
  format: fileFormat,
});

export function createWinstonLogger() {
  return createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: 'bothsafe-backend' },
    transports: [consoleTransport, dailyRotateCombined, dailyRotateError],
    exceptionHandlers: [consoleTransport, exceptionTransport],
    rejectionHandlers: [consoleTransport, rejectionTransport],
    // Don't exit on uncaught errors — let NestJS handle it
    exitOnError: false,
  });
}

export { LOGS_DIR };
