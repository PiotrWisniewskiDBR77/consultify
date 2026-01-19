/**
 * Mock Admin Middleware
 */
import { NextFunction, Request, Response } from 'express';

export const verifyAdmin = (req: Request, res: Response, next: NextFunction) => {
  next();
};

export const checkPermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    next();
  };
};

export const setDependencies = (deps: any) => {
  // No-op for mock
};
