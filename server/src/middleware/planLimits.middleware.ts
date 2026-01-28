/**
 * Plan Limits Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Plan limit checking middleware (no-op fallback for tests)
 */

import type { NextFunction, Request, Response } from 'express';

/**
 * Check plan limit middleware factory
 */
export const checkPlanLimit = (_limitKey: string) => {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    next();
  };
};

export default checkPlanLimit;
