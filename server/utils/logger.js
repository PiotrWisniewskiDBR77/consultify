/**
 * Production Logger (Winston)
 * Enterprise SaaS Architecture
 *
 * Replaces custom console logger with structured Winston logging.
 * Supports log rotation, levels, and JSON formatting.
 */
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
// Define log levels (npm style is standard: error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6)
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};
winston.addColors(colors);
const format = winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston.format.errors({ stack: true }), // Include stack trace on errors
    isProduction ? winston.format.json() : winston.format.colorize({ all: true }), winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`));
const transports = [
    // Console transport (Always active, restricted level in prod)
    new winston.transports.Console({
        level: isProduction ? 'info' : 'debug',
        silent: isTest, // Silence logs in tests unless debugging
    }),
];
// Add file transports in production
if (isProduction) {
    transports.push(new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        level: 'error',
    }));
    transports.push(new DailyRotateFile({
        filename: 'logs/all-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
    }));
}
const winstonLogger = winston.createLogger({
    levels,
    format,
    transports,
});
// Wrapper to match existing Logger interface
const logger = {
    info: (message, meta) => winstonLogger.info(message, meta),
    warn: (message, meta) => winstonLogger.warn(message, meta),
    error: (message, error, meta) => {
        if (error) {
            winstonLogger.error(message, { error: error.message, stack: error.stack, ...meta });
        }
        else {
            winstonLogger.error(message, meta);
        }
    },
    debug: (message, meta) => winstonLogger.debug(message, meta),
    http: (message, meta) => winstonLogger.http(message, meta),
    // Request logging middleware
    requestLogger: (req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
            const meta = {
                method: req.method,
                url: req.originalUrl,
                status: res.statusCode,
                duration: `${duration}ms`,
                ip: req.ip || req.socket?.remoteAddress || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
            };
            if (res.statusCode >= 500) {
                winstonLogger.error(message, meta);
            }
            else if (res.statusCode >= 400) {
                winstonLogger.warn(message, meta);
            }
            else {
                winstonLogger.http(message, meta);
            }
        });
        next();
    },
};
export const aiLogger = logger;
export default logger;
//# sourceMappingURL=logger.js.map