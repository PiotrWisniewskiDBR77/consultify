/**
 * Production Logger
 * Outputs structured JSON logs for easy parsing by log aggregators
 */

const isProduction = process.env.NODE_ENV === 'production';

const formatLog = (level, message, meta = {}) => ({
    level,
    timestamp: new Date().toISOString(),
    message,
    ...meta,
    ...(meta.error && !isProduction ? { stack: meta.error.stack } : {})
});

const logger = {
    info: (message, meta = {}) => {
        if (isProduction) {
            console.log(JSON.stringify(formatLog('info', message, meta)));
        } else {
            console.log(`[INFO] ${message}`, meta);
        }
    },

    warn: (message, meta = {}) => {
        if (isProduction) {
            console.warn(JSON.stringify(formatLog('warn', message, meta)));
        } else {
            console.warn(`[WARN] ${message}`, meta);
        }
    },

    error: (message, error = null, meta = {}) => {
        const logData = {
            ...meta,
            ...(error ? { error: error.message, errorName: error.name } : {})
        };

        if (isProduction) {
            console.error(JSON.stringify(formatLog('error', message, logData)));
        } else {
            console.error(`[ERROR] ${message}`, error || '', meta);
        }
    },

    debug: (message, meta = {}) => {
        if (!isProduction) {
            console.log(`[DEBUG] ${message}`, meta);
        }
    },

    // Request logging middleware
    requestLogger: (req, res, next) => {
        const start = Date.now();

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

            if (res.statusCode >= 400) {
                logger.warn('Request failed', logData);
            } else if (isProduction) {
                logger.info('Request completed', logData);
            }
        });

        next();
    }
};

module.exports = logger;
