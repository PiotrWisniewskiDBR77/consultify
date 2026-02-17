/**
 * Async Handler Utility
 * Wraps async route handlers to properly catch and forward errors
 */

import type { NextFunction, Response } from 'express';

import type { AsyncHandler, AuthenticatedRequest } from '../types/index.js';

/**
 * Wraps an async route handler to catch errors and pass them to Express error handler
 */
export const asyncHandler = (fn: AsyncHandler) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> => {
    return Promise.resolve()
      .then(() => fn(req, res, next))
      .catch(next);
  };
};

/**
 * Alternative: Creates a typed async handler that ensures response is returned
 */
export const createAsyncHandler = <T>(
  fn: (req: AuthenticatedRequest, res: Response) => Promise<T>
): AsyncHandler => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await fn(req, res);
      if (result !== undefined && !res.headersSent) {
        res.json(result);
      }
    } catch (error: unknown) {
      next(error);
    }
  };
};
