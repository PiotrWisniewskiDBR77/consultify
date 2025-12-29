/**
 * Production Logger
 * Outputs structured JSON logs for easy parsing by log aggregators
 * Powered by Winston
 */

const winston = require('winston');
const requestStore = require('./requestStore');

const isProduction = process.env.NODE_ENV === 'production';

// Define custom formats
const addCorrelationId = winston.format((info) => {
    info.correlationId = requestStore.getCorrelationId();
    return info;
});

// Configure Winston Logger
const winstonLogger = winston.createLogger({
    level: isProduction ? 'info' : 'debug',
    format: winston.format.combine(
        addCorrelationId(),
        winston.format.timestamp(),
        isProduction ? winston.format.json() : winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
                const cid = correlationId ? `[${correlationId}] ` : '';
                return `${timestamp} ${level}: ${cid}${message} ${metaStr}`;
            })
        )
    ),
    transports: [
        new winston.transports.Console()
    ]
});

const logger = {
    info: (message, meta = {}) => {
        winstonLogger.info(message, meta);
    },

    warn: (message, meta = {}) => {
        winstonLogger.warn(message, meta);
    },

    error: (message, error = null, meta = {}) => {
        const logData = { ...meta };
        if (error) {
            logData.error = error.message;
            logData.stack = error.stack;
            logData.name = error.name;
        }
        winstonLogger.error(message, logData);
    },

    debug: (message, meta = {}) => {
        winstonLogger.debug(message, meta);
    },

    // Request logging middleware
    requestLogger: (req, res, next) => {
        const start = Date.now();

        // Log request start (debug only)
        if (!isProduction) {
            winstonLogger.debug(`Incoming ${req.method} ${req.originalUrl}`);
        }

        res.on('finish', () => {
            const duration = Date.now() - start;
            const logData = {
                method: req.method,
                url: req.originalUrl,
                status: res.statusCode,
                duration: `${duration}ms`,
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent')
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
    }
};

module.exports = logger;
