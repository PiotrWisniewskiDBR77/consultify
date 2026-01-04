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
export declare const getRequestContext: (req: RequestWithUser) => RequestContext;
export {};
//# sourceMappingURL=requestContext.d.ts.map