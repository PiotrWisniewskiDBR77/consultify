/**
 * Production Logger
 * Outputs structured JSON logs for easy parsing by log aggregators
 */

import { Request, Response, NextFunction } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

interface LogMeta {
    [key: string]: unknown;
    error?: Error;
}

interface LogFormat {
    level: string;
    timestamp: string;
    message: string;
    [key: string]: unknown;
}

const formatLog = (level: string, message: string, meta: LogMeta = {}): LogFormat => {
    const log: LogFormat = {
        level,
        timestamp: new Date().toISOString(),
        message,
        ...meta,
    };
    
    if (meta.error && !isProduction) {
        log.stack = meta.error.stack;
    }
    
    return log;
};

interface Logger {
    info: (message: string, meta?: LogMeta) => void;
    warn: (message: string, meta?: LogMeta) => void;
    error: (message: string, error?: Error | null, meta?: LogMeta) => void;
    debug: (message: string, meta?: LogMeta) => void;
    requestLogger: (req: Request, res: Response, next: NextFunction) => void;
}

const logger: Logger = {
    info: (message: string, meta: LogMeta = {}) => {
        if (isProduction) {
            console.log(JSON.stringify(formatLog('info', message, meta)));
        } else {
            console.log(`[INFO] ${message}`, meta);
        }
    },

    warn: (message: string, meta: LogMeta = {}) => {
        if (isProduction) {
            console.warn(JSON.stringify(formatLog('warn', message, meta)));
        } else {
            console.warn(`[WARN] ${message}`, meta);
        }
    },

    error: (message: string, error: Error | null = null, meta: LogMeta = {}) => {
        const logData: LogMeta = {
            ...meta,
        };
        
        if (error) {
            logData.error = error.message;
            logData.errorName = error.name;
        }

        if (isProduction) {
            console.error(JSON.stringify(formatLog('error', message, logData)));
        } else {
            console.error(`[ERROR] ${message}`, error || '', meta);
        }
    },

    debug: (message: string, meta: LogMeta = {}) => {
        if (!isProduction) {
            console.log(`[DEBUG] ${message}`, meta);
        }
    },

    // Request logging middleware
    requestLogger: (req: Request, res: Response, next: NextFunction) => {
        const start = Date.now();

        res.on('finish', () => {
            const duration = Date.now() - start;
            const logData: LogMeta = {
                method: req.method,
                url: req.originalUrl,
                status: res.statusCode,
                duration: `${duration}ms`,
                ip: req.ip || (req.socket?.remoteAddress) || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
            };

            if (res.statusCode >= 400) {
                logger.warn('Request failed', logData);
            } else if (isProduction) {
                logger.info('Request completed', logData);
            }
        });

        next();
    }
};

export default logger;

