/**
 * Assessment Audit Logger
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Logs all assessment-related actions for compliance
 */

import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';

// ==========================================
// TYPES
// ==========================================

interface Database {
    run: (sql: string, params: unknown[], callback: (this: { lastID?: number; changes: number }, err: Error | null) => void) => void;
}

interface LogParams {
    userId: string;
    organizationId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}

interface Dependencies {
    db: Database;
    uuidv4: () => string;
}

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies;

const getDeps = (): Dependencies => {
    if (!deps) {
        const defaultDb = require('../../database');
        deps = {
            db: defaultDb,
            uuidv4,
        };
    }
    return deps;
};

// ==========================================
// CLASS
// ==========================================

class AssessmentAuditLogger {
    /**
     * Set dependencies (for testing)
     */
    setDependencies(newDeps: Partial<Dependencies>): void {
        deps = { ...getDeps(), ...newDeps };
    }

    /**
     * Log assessment action
     */
    async log(params: LogParams): Promise<string | undefined> {
        const { db, uuidv4: uuid } = getDeps();
        
        try {
            const auditId = uuid();

            const sql = `
                INSERT INTO audit_logs (
                    id, user_id, organization_id,
                    action, resource_type, resource_id,
                    details, ip_address, user_agent,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `;

            await new Promise<void>((resolve, reject) => {
                db.run(sql, [
                    auditId,
                    params.userId,
                    params.organizationId,
                    params.action,
                    params.resourceType,
                    params.resourceId,
                    JSON.stringify(params.details || {}),
                    params.ipAddress || null,
                    params.userAgent || null
                ], function (err) {
                    if (err) return reject(err);
                    resolve();
                });
            });

            return auditId;
        } catch (error) {
            console.error('[AuditLog] Error logging assessment action:', error);
            // Non-blocking - don't fail the request if audit fails
            return undefined;
        }
    }

    /**
     * Log assessment creation
     */
    async logCreation(req: AuthRequest, assessmentId: string, assessmentType: string): Promise<string | undefined> {
        return this.log({
            userId: req.user?.id || '',
            organizationId: req.user?.organizationId || '',
            action: 'ASSESSMENT_CREATED',
            resourceType: assessmentType,
            resourceId: assessmentId,
            details: { assessmentType },
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined
        });
    }

    /**
     * Log file upload
     */
    async logFileUpload(req: Request & { user?: { id?: string; organizationId?: string } }, fileId: string, fileName: string, fileSize: number): Promise<string | undefined> {
        return this.log({
            userId: req.user?.id || '',
            organizationId: req.user?.organizationId || '',
            action: 'FILE_UPLOADED',
            resourceType: 'ASSESSMENT_FILE',
            resourceId: fileId,
            details: { fileName, fileSize },
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined
        });
    }

    /**
     * Log assessment deletion
     */
    async logDeletion(req: AuthRequest, assessmentId: string, assessmentType: string): Promise<string | undefined> {
        return this.log({
            userId: req.user?.id || '',
            organizationId: req.user?.organizationId || '',
            action: 'ASSESSMENT_DELETED',
            resourceType: assessmentType,
            resourceId: assessmentId,
            details: { assessmentType },
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined
        });
    }
}

// Export singleton instance
export const assessmentAuditLogger = new AssessmentAuditLogger();
export default assessmentAuditLogger;

