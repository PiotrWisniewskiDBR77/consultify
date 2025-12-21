/**
 * Error Handler Utility
 * 
 * Centralized error handling and response formatting.
 * Provides consistent error responses across the API.
 */

const express = require('express');
const logger = require('./logger');

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
 * Create standardized error response
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
 * Handle validation errors
 */
function validationError(message = 'Validation failed', fields = {}) {
    return createError(ERROR_CODES.VALIDATION_ERROR, message, { fields });
}

/**
 * Handle not found errors
 */
function notFoundError(resource = 'Resource', id = null) {
    const message = id 
        ? `${resource} with ID ${id} not found`
        : `${resource} not found`;
    return createError(ERROR_CODES.NOT_FOUND, message);
}

/**
 * Handle unauthorized errors
 */
function unauthorizedError(message = 'Unauthorized') {
    return createError(ERROR_CODES.UNAUTHORIZED, message);
}

/**
 * Handle forbidden errors
 */
function forbiddenError(message = 'Access forbidden') {
    return createError(ERROR_CODES.FORBIDDEN, message);
}

/**
 * Handle database errors
 */
function databaseError(error, operation = 'Database operation') {
    logger.error(`[ErrorHandler] ${operation} failed:`, error);
    
    // Don't expose internal database errors to client
    const message = process.env.NODE_ENV === 'production'
        ? `${operation} failed. Please try again later.`
        : error.message;
    
    return createError(ERROR_CODES.DATABASE_ERROR, message, {
        operation,
        // Include stack trace only in development
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
    });
}

/**
 * Handle internal server errors
 */
function internalError(error, context = 'Internal server error') {
    logger.error(`[ErrorHandler] ${context}:`, error);
    
    const message = process.env.NODE_ENV === 'production'
        ? 'An internal error occurred. Please try again later.'
        : error.message;
    
    return createError(ERROR_CODES.INTERNAL_ERROR, message, {
        context,
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
    });
}

/**
 * Express error handler middleware
 */
function errorHandlerMiddleware(err, req, res, next) {
    logger.error('[ErrorHandler] Unhandled error:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        userId: req.user?.id
    });

    // Default to internal error
    let errorResponse = internalError(err, 'Unhandled error');
    let statusCode = 500;

    // Map known error types to status codes
    if (err.code === ERROR_CODES.VALIDATION_ERROR) {
        statusCode = 400;
        errorResponse = validationError(err.message, err.fields);
    } else if (err.code === ERROR_CODES.NOT_FOUND) {
        statusCode = 404;
        errorResponse = notFoundError(err.resource || 'Resource', err.id);
    } else if (err.code === ERROR_CODES.UNAUTHORIZED) {
        statusCode = 401;
        errorResponse = unauthorizedError(err.message);
    } else if (err.code === ERROR_CODES.FORBIDDEN) {
        statusCode = 403;
        errorResponse = forbiddenError(err.message);
    } else if (err.code === ERROR_CODES.DATABASE_ERROR) {
        statusCode = 500;
        errorResponse = databaseError(err, err.operation);
    }

    res.status(statusCode).json(errorResponse);
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
    ERROR_CODES,
    createError,
    validationError,
    notFoundError,
    unauthorizedError,
    forbiddenError,
    databaseError,
    internalError,
    errorHandlerMiddleware,
    asyncHandler
};
