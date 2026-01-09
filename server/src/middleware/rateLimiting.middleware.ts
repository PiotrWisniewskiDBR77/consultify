/**
 * Mock Rate Limiting Middleware
 */
import { Request, Response, NextFunction } from 'express';

export const aiRateLimiter = (req: Request, res: Response, next: NextFunction) => {
    next();
};

export const defaultRateLimiter = (req: Request, res: Response, next: NextFunction) => {
    next();
};

export const apiRateLimiter = (req: Request, res: Response, next: NextFunction) => {
    next();
};

export const authRateLimiter = (req: Request, res: Response, next: NextFunction) => {
    next();
};




