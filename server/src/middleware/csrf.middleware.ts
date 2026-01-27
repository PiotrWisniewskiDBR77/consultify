/**
 * CSRF Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * CSRF protection middleware (no-op fallback for tests)
 */

import type { NextFunction, Request, Response } from 'express';

/**
 * CSRF token middleware
 */
export const csrfTokenMiddleware = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next();
};

/**
 * Get CSRF token handler
 */
export const getCsrfTokenHandler = (_req: Request, res: Response): void => {
  res.json({ token: 'test-csrf-token' });
};

export default csrfTokenMiddleware;
