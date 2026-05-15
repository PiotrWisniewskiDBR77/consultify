/**
 * Assessment Audit Logger
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Logs all assessment-related actions for compliance
 */

import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../middleware/auth.middleware.js';
import { run as dbRun } from '../utils/DbPromise.js';
import logger from './Logger.js';

// ==========================================
// TYPES
// ==========================================

// Database interface no longer needed - using DbPromise directly

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
  dbRun: typeof dbRun;
  uuidv4: () => string;
}

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies;

const getDeps = (): Dependencies => {
  if (!deps) {
    deps = {
      dbRun,
      uuidv4,
    };
  }
  return deps;
};

// ==========================================
// CLASS
// ==========================================

export class AssessmentAuditLogger {
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
    const { uuidv4: uuid, dbRun: run } = getDeps();

    try {
      const auditId = uuid();

      const sql = `
                INSERT INTO activity_logs (
                    id, organization_id, user_id,
                    action, entity_type, entity_id,
                    new_value, ip_address, user_agent,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `;

      const runResult = await run(sql, [
        auditId,
        params.organizationId,
        params.userId,
        params.action,
        params.resourceType,
        params.resourceId,
        JSON.stringify(params.details || {}),
        params.ipAddress || null,
        params.userAgent || null,
      ]);

      if (!runResult.success) {
        throw new Error(runResult.error || 'Failed to log audit');
      }

      return auditId;
    } catch (error: unknown) {
      logger.error('[AuditLog] Error logging assessment action:', error);
      // Re-throw in test environment so tests can verify error handling
      if (process.env.NODE_ENV === 'test') {
        throw error;
      }
      // Non-blocking in production - don't fail the request if audit fails
      return undefined;
    }
  }

  /**
   * Log from request object (for backward compatibility)
   */
  async logFromRequest(
    req: Request & { user?: { id?: string; organizationId?: string } },
    action: string,
    resourceType: string,
    resourceId: string,
    details?: Record<string, unknown>
  ): Promise<string | undefined> {
    return this.log({
      userId: req.user?.id || '',
      organizationId: req.user?.organizationId || '',
      action,
      resourceType,
      resourceId,
      details,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
  }

  /**
   * Log assessment creation
   */
  async logCreation(
    req: AuthRequest,
    assessmentId: string,
    assessmentType: string
  ): Promise<string | undefined> {
    return this.log({
      userId: req.user?.id || '',
      organizationId: req.user?.organizationId || '',
      action: 'ASSESSMENT_CREATED',
      resourceType: assessmentType,
      resourceId: assessmentId,
      details: { assessmentType },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
  }

  /**
   * Log file upload
   */
  async logFileUpload(
    req: Request & { user?: { id?: string; organizationId?: string } },
    fileId: string,
    fileName: string,
    fileSize: number
  ): Promise<string | undefined> {
    return this.log({
      userId: req.user?.id || '',
      organizationId: req.user?.organizationId || '',
      action: 'FILE_UPLOADED',
      resourceType: 'ASSESSMENT_FILE',
      resourceId: fileId,
      details: { fileName, fileSize },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
  }

  /**
   * Log assessment deletion
   */
  async logDeletion(
    req: AuthRequest,
    assessmentId: string,
    assessmentType: string
  ): Promise<string | undefined> {
    return this.log({
      userId: req.user?.id || '',
      organizationId: req.user?.organizationId || '',
      action: 'ASSESSMENT_DELETED',
      resourceType: assessmentType,
      resourceId: assessmentId,
      details: { assessmentType },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
  }

  /**
   * Log assessment update/save
   */
  async logUpdate(
    req: AuthRequest,
    assessmentId: string,
    details?: Record<string, unknown>
  ): Promise<string | undefined> {
    return this.log({
      userId: req.user?.id || '',
      organizationId: req.user?.organizationId || '',
      action: 'ASSESSMENT_UPDATED',
      resourceType: 'ASSESSMENT',
      resourceId: assessmentId,
      details: details || {},
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
  }

  /**
   * Log level achieved
   */
  async logLevelAchieved(
    req: AuthRequest,
    assessmentId: string,
    areaId: string,
    level: number
  ): Promise<string | undefined> {
    return this.log({
      userId: req.user?.id || '',
      organizationId: req.user?.organizationId || '',
      action: 'LEVEL_ACHIEVED',
      resourceType: 'ASSESSMENT',
      resourceId: assessmentId,
      details: { areaId, level },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
  }

  /**
   * Log target level set
   */
  async logTargetSet(
    req: AuthRequest,
    assessmentId: string,
    areaId: string,
    level: number
  ): Promise<string | undefined> {
    return this.log({
      userId: req.user?.id || '',
      organizationId: req.user?.organizationId || '',
      action: 'LEVEL_TARGET_SET',
      resourceType: 'ASSESSMENT',
      resourceId: assessmentId,
      details: { areaId, level },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
  }

  /**
   * Log level skipped
   */
  async logLevelSkipped(
    req: AuthRequest,
    assessmentId: string,
    areaId: string,
    level: number
  ): Promise<string | undefined> {
    return this.log({
      userId: req.user?.id || '',
      organizationId: req.user?.organizationId || '',
      action: 'LEVEL_SKIPPED',
      resourceType: 'ASSESSMENT',
      resourceId: assessmentId,
      details: { areaId, level },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
  }

  /**
   * Log comment added
   */
  async logCommentAdded(
    req: AuthRequest,
    assessmentId: string,
    areaId: string,
    level: number,
    comment?: string
  ): Promise<string | undefined> {
    return this.log({
      userId: req.user?.id || '',
      organizationId: req.user?.organizationId || '',
      action: 'COMMENT_ADDED',
      resourceType: 'ASSESSMENT',
      resourceId: assessmentId,
      details: { areaId, level, comment: comment?.slice(0, 100) },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
  }

  /**
   * Log link added
   */
  async logLinkAdded(
    req: AuthRequest,
    assessmentId: string,
    areaId: string,
    level: number,
    url: string
  ): Promise<string | undefined> {
    return this.log({
      userId: req.user?.id || '',
      organizationId: req.user?.organizationId || '',
      action: 'LINK_ADDED',
      resourceType: 'ASSESSMENT',
      resourceId: assessmentId,
      details: { areaId, level, url },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
  }

  /**
   * Log status change
   */
  async logStatusChange(
    req: AuthRequest,
    assessmentId: string,
    fromStatus: string,
    toStatus: string
  ): Promise<string | undefined> {
    return this.log({
      userId: req.user?.id || '',
      organizationId: req.user?.organizationId || '',
      action: 'STATUS_CHANGED',
      resourceType: 'ASSESSMENT',
      resourceId: assessmentId,
      details: { from: fromStatus, to: toStatus },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
  }

  /**
   * Log report generated
   */
  async logReportGenerated(
    req: AuthRequest,
    assessmentId: string,
    reportId?: string
  ): Promise<string | undefined> {
    return this.log({
      userId: req.user?.id || '',
      organizationId: req.user?.organizationId || '',
      action: 'REPORT_GENERATED',
      resourceType: 'ASSESSMENT',
      resourceId: assessmentId,
      details: { reportId },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
  }

  /**
   * Log initiatives generated
   */
  async logInitiativesGenerated(
    req: AuthRequest,
    assessmentId: string,
    count: number
  ): Promise<string | undefined> {
    return this.log({
      userId: req.user?.id || '',
      organizationId: req.user?.organizationId || '',
      action: 'INITIATIVES_GENERATED',
      resourceType: 'ASSESSMENT',
      resourceId: assessmentId,
      details: { count },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
  }

  /**
   * Log chat context attached
   */
  async logChatContextAttached(
    req: AuthRequest,
    assessmentId: string,
    conversationId: string,
    messageCount: number
  ): Promise<string | undefined> {
    return this.log({
      userId: req.user?.id || '',
      organizationId: req.user?.organizationId || '',
      action: 'CHAT_CONTEXT_ATTACHED',
      resourceType: 'ASSESSMENT',
      resourceId: assessmentId,
      details: { conversationId, messageCount },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
  }
}

// Export singleton instance
export const assessmentAuditLogger = new AssessmentAuditLogger();
export default assessmentAuditLogger;
