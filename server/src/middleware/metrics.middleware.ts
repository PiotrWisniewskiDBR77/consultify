/**
 * Mock Metrics Middleware
 */
import { Request, Response, NextFunction } from 'express';

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    next();
};



