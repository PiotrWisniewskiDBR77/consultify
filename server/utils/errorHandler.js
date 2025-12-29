const logger = require('./logger');

/**
 * Standardized AppError Class
 */
class AppError extends Error {
    constructor(message, statusCode, code = 'INTERNAL_ERROR', details = {}) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Error types/codes
 */
const ERROR_CODES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    DATABASE_ERROR: 'DATABASE_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    RATE_LIMIT: 'RATE_LIMIT',
    BAD_REQUEST: 'BAD_REQUEST'
};

/**
 * Create standardized error response object (Legacy support)
 */
function createError(code, message, details = {}) {
    return {
        error: {
            code,
            message,
            ...details,
            timestamp: new Date().toISOString()
        }
    };
}

/**
 * Express error handler middleware
 */
function errorHandlerMiddleware(err, req, res, next) {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log the error
    if (err.statusCode >= 500) {
        logger.error(`[ErrorHandler] ${err.message}`, {
            stack: err.stack,
            path: req.path,
            method: req.method,
            userId: req.user?.id
        });
    } else {
        logger.warn(`[ErrorHandler] ${err.message}`, {
            statusCode: err.statusCode,
            path: req.path
        });
    }

    // Development response
    if (process.env.NODE_ENV === 'development') {
        return res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        });
    }

    // Production response
    if (err.isOperational) {
        // Known operational error (AppError)
        res.status(err.statusCode).json({
            status: err.status,
            error: {
                code: err.code || 'ERROR',
                message: err.message,
                ...err.details,
                timestamp: new Date().toISOString()
            }
        });
    } else {
        // Unknown programming/system error
        res.status(500).json({
            status: 'error',
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Something went very wrong!',
                timestamp: new Date().toISOString()
            }
        });
    }
}

/**
 * Async route wrapper to catch errors
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = {
    AppError,
    ERROR_CODES,
    errorHandlerMiddleware,
    asyncHandler,
    // Legacy exports for backward compatibility
    createError,
    validationError: (msg, fields) => new AppError(msg, 400, ERROR_CODES.VALIDATION_ERROR, { fields }),
    notFoundError: (res, id) => new AppError(`${res} not found`, 404, ERROR_CODES.NOT_FOUND, { id }),
};








