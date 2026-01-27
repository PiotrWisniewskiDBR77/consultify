/**
 * Alert Watchdog Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Alert monitoring middleware (no-op fallback for tests)
 */

import type { NextFunction, Request, Response } from 'express';

/**
 * Alert watchdog middleware
 */
const alertWatchdog = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next();
};

export default alertWatchdog;
