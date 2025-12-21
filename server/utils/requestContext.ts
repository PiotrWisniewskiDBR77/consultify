/**
 * Request Context Utility
 * 
 * Safely extracts user and organization context from a request object.
 * Used for logging, auditing, and server-side RBAC enforcement.
 */

import { Request } from 'express';

interface User {
    id?: string;
    organization_id?: string;
    role?: string;
}

interface Session {
    user?: User;
}

interface RequestWithUser extends Request {
    user?: User;
    session?: Session;
}

export interface RequestContext {
    userId: string | null;
    orgId: string | null;
    role: string;
    ip: string;
    userAgent: string;
    method: string;
    path: string;
    requestId: string;
}

export const getRequestContext = (req: RequestWithUser): RequestContext => {
    // Depending on auth middleware, user info might be in req.user or req.session.user
    const user = req.user || (req.session && req.session.user) || {};

    return {
        userId: user.id || null,
        orgId: user.organization_id || null,
        role: user.role || 'GUEST',
        ip: req.ip || (req.socket?.remoteAddress) || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        method: req.method,
        path: req.path,
        requestId: req.get('X-Request-Id') || 'none'
    };
};

