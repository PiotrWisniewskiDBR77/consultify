/**
 * Async Handler Utility
 * Wraps async route handlers to properly catch and forward errors
 */

import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest, AsyncHandler } from '../types';

/**
 * Wraps an async route handler to catch errors and pass them to Express error handler
 */
export const asyncHandler = (fn: AsyncHandler) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Alternative: Creates a typed async handler that ensures response is returned
 */
export const createAsyncHandler = <T>(
    fn: (req: AuthenticatedRequest, res: Response) => Promise<T>
): AsyncHandler => {
    return async (req, res, next) => {
        try {
            const result = await fn(req, res);
            if (result !== undefined && !res.headersSent) {
                res.json(result);
            }
        } catch (error) {
            next(error);
        }
    };
};


