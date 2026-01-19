/**
 * Mock CSRF Middleware
 */
import { NextFunction, Request, Response } from 'express';

export const csrfTokenMiddleware = (req: Request, res: Response, next: NextFunction) => {
  next();
};

export const getCsrfTokenHandler = (req: Request, res: Response) => {
  res.json({ csrfToken: 'mock-csrf-token' });
};
