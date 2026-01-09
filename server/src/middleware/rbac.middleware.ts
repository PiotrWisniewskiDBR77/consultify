// @ts-nocheck
/**
 * Mock RBAC Middleware
 */
import { Request, Response, NextFunction } from 'express';

export const ORG_ROLE_HIERARCHY = {
    OWNER: 4,
    ADMIN: 3,
    CONSULTANT: 2,
    MEMBER: 1,
};

export const requireRole = (role: string | string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        next();
    };
};

export const requireConsultantScope = (req: Request, res: Response, next: NextFunction) => {
    next();
};

export const requireOrgAccess = (options?: any) => {
    return (req: Request, res: Response, next: NextFunction) => {
        next();
    };
};

export const requireOrgMember = (req: Request, res: Response, next: NextFunction) => {
    if (typeof req === 'function') {
        // Factory pattern: requireOrgMember()(req, res, next)
        return (q: Request, s: Response, n: NextFunction) => n();
    }
    next();
};

export const requireOrgRole = (role: string | string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        next();
    };
};

export const requireOrgRoleOrHigher = (role: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        next();
    };
};

export const requireOwnerOrSuperadmin = (req: Request, res: Response, next: NextFunction) => {
    if (typeof req === 'function') {
        return (q: Request, s: Response, n: NextFunction) => n();
    }
    next();
};




