/**
 * Mock Admin Middleware
 */
import { Request, Response, NextFunction } from 'express';

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



