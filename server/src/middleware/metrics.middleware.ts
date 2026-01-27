/**
 * Metrics Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Metrics collection middleware (no-op fallback for tests)
 */

import type { NextFunction, Request, Response } from 'express';

/**
 * Metrics middleware
 */
export const metricsMiddleware = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next();
};

export default metricsMiddleware;
