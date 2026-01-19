/**
 * Mock Metrics Middleware
 */
import { NextFunction, Request, Response } from 'express';

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  next();
};
