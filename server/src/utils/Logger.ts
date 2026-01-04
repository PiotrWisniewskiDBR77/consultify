/**
 * Production Logger
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Outputs structured JSON logs for easy parsing by log aggregators
 * Powered by Winston
 */

import 'winston-daily-rotate-file';

import type { NextFunction, Request, Response } from 'express';
import winston from 'winston';

import { getCorrelationId } from './RequestStore.ts';

const isProduction = process.env.NODE_ENV === 'production';

// ==========================================
// TYPES
// ==========================================

export interface LoggerMeta {
    [key: string]: unknown;
}

export interface Logger {
    info: (message: string, meta?: LoggerMeta) => void;
    warn: (message: string, meta?: LoggerMeta) => void;
    error: (message: string, error?: Error | null, meta?: LoggerMeta) => void;
    debug: (message: string, meta?: LoggerMeta) => void;
    requestLogger: (req: Request, res: Response, next: NextFunction) => void;
}

// ==========================================
// WINSTON CONFIGURATION
// ==========================================

// Define custom formats
const addCorrelationId = winston.format((info) => {
    info.correlationId = getCorrelationId();
    return info;
});

// Configure transports
const transports: winston.transport[] = [new winston.transports.Console()];

// Add file logging in production or if explicitly enabled
if (isProduction || process.env.ENABLE_FILE_LOGGING === 'true') {
    // Import 'winston-daily-rotate-file' dynamically or assume it's available if added to project
    // Note: In ESM/TS, we might need a require or import.
    // Since we are in TS, we rely on the import above.
    // However, winston-daily-rotate-file usually needs to be required to attach itself to winston.transports
    // @ts-ignore
    await import('winston-daily-rotate-file');

    transports.push(
        new winston.transports.DailyRotateFile({
            filename: 'logs/error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            level: 'error',
            format: winston.format.json(),
        }),
        new winston.transports.DailyRotateFile({
            filename: 'logs/combined-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '30d',
            format: winston.format.json(),
        }),
    );
}

// Configure Winston Logger
const winstonLogger = winston.createLogger({
    level: isProduction ? 'info' : 'debug',
    format: winston.format.combine(
        addCorrelationId(),
        winston.format.timestamp(),
        isProduction
            ? winston.format.json()
            : winston.format.combine(
                  winston.format.colorize(),
                  winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
                      const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
                      const cid = correlationId ? `[${correlationId}] ` : '';
                      return `${timestamp} ${level}: ${cid}${message} ${metaStr}`;
                  }),
              ),
    ),
    transports,
});

// ==========================================
// LOGGER IMPLEMENTATION
// ==========================================

const logger: Logger = {
    info: (message: string, meta: LoggerMeta = {}): void => {
        winstonLogger.info(message, meta);
    },

    warn: (message: string, meta: LoggerMeta = {}): void => {
        winstonLogger.warn(message, meta);
    },

    error: (message: string, error: Error | null = null, meta: LoggerMeta = {}): void => {
        const logData: LoggerMeta = { ...meta };
        if (error) {
            logData.error = error.message;
            logData.stack = error.stack;
            logData.name = error.name;
        }
        winstonLogger.error(message, logData);
    },

    debug: (message: string, meta: LoggerMeta = {}): void => {
        winstonLogger.debug(message, meta);
    },

    // Request logging middleware
    requestLogger: (req: Request, res: Response, next: NextFunction): void => {
        const start = Date.now();

        // Log request start (debug only)
        if (!isProduction) {
            winstonLogger.debug(`Incoming ${req.method} ${req.originalUrl}`);
        }

        res.on('finish', () => {
            const duration = Date.now() - start;
            const logData: LoggerMeta = {
                method: req.method,
                url: req.originalUrl,
                status: res.statusCode,
                duration: `${duration}ms`,
                ip: req.ip || (req.socket.remoteAddress ?? 'unknown'),
                userAgent: req.get('User-Agent') ?? 'unknown',
            };

            const msg = `HTTP ${req.method} ${req.originalUrl} - ${res.statusCode}`;

            if (res.statusCode >= 500) {
                winstonLogger.error(msg, logData);
            } else if (res.statusCode >= 400) {
                winstonLogger.warn(msg, logData);
            } else {
                winstonLogger.info(msg, logData);
            }
        });

        next();
    },
};

export default logger;
