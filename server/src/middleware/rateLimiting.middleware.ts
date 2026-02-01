/**
 * Rate Limiting Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Rate limiting middleware (no-op fallback for tests)
 */

import type { NextFunction, Request, Response } from 'express';

/**
 * Auth rate limiter
 */
export const authRateLimiter = (_req: Request, _res: Response, next: NextFunction): void => {
  next();
};

/**
 * Default rate limiter
 */
export const defaultRateLimiter = (_req: Request, _res: Response, next: NextFunction): void => {
  next();
};

/**
 * AI rate limiter
 */
export const aiRateLimiter = (_req: Request, _res: Response, next: NextFunction): void => {
  next();
};

export default defaultRateLimiter;
