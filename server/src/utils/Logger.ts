/**
 * Logger Utility
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export interface LoggerMeta {
  [key: string]: unknown;
}

export interface Logger {
  error: (message: string, ...meta: any[]) => void;
  warn: (message: string, ...meta: any[]) => void;
  info: (message: string, ...meta: any[]) => void;
  http: (message: string, ...meta: any[]) => void;
  debug: (message: string, ...meta: any[]) => void;
}

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const level = () => {
  // Allow overriding log level locally (e.g. LOG_LEVEL=info).
  const configured = (process.env.LOG_LEVEL || '').toLowerCase();
  if (configured && Object.prototype.hasOwnProperty.call(levels, configured)) {
    return configured;
  }

  const env = process.env.NODE_ENV || 'development';
  if (env === 'test') {
    return 'warn';
  }
  return env === 'development' ? 'debug' : 'warn';
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Safe JSON stringify that handles circular references and errors
const safeStringify = (obj: unknown): string => {
  try {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      // Handle Error objects specially
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      }
      return value;
    });
  } catch (err) {
    return String(obj);
  }
};

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    const metaStr = Object.keys(meta).length ? ` ${safeStringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${metaStr}`;
  })
);

// File logging can be surprisingly expensive in local dev (disk I/O + massive debug volume).
// Enable it only when explicitly requested or in production-like environments.
const enableFileLogs = process.env.LOG_TO_FILE === 'true' || process.env.NODE_ENV === 'production';

const transports: winston.transport[] = [new winston.transports.Console()];
if (enableFileLogs) {
  transports.push(
    new DailyRotateFile({
      filename: 'server/logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '50m',
      maxFiles: '7d',
      zippedArchive: true,
    }),
    new DailyRotateFile({
      filename: 'server/logs/all-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '50m',
      maxFiles: '7d',
      zippedArchive: true,
    })
  );
}

const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

export { logger };
export default logger;
