/**
 * Mock Input Sanitization Middleware
 */
import { NextFunction, Request, Response } from 'express';

export const inputSanitizationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  next();
};
