/**
 * Mock Input Sanitization Middleware
 */
import { Request, Response, NextFunction } from 'express';

export const inputSanitizationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  next();
};
