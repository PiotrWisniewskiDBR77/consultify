/**
 * Mock Demo Guard Middleware
 */
import { Request, Response, NextFunction } from 'express';

export const demoGuard = (req: Request, res: Response, next: NextFunction) => {
    next();
};
