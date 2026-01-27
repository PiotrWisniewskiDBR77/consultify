/**
 * Input Sanitization Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Input sanitization middleware (no-op fallback for tests)
 */

import type { NextFunction, Request, Response } from 'express';

/**
 * Input sanitization middleware
 */
export const inputSanitizationMiddleware = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next();
};

export default inputSanitizationMiddleware;
