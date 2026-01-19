/**
 * Mock Rate Limiting Middleware
 */
import { NextFunction, Request, Response } from 'express';

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
