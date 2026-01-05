/**
 * Audit Service (HARDENED)
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Provides centralized, structured logging for all critical actions.
 * Fully migrated from server/services/auditService.js
 *
 * Security Features:
 * - sanitizeMetadata: Redacts sensitive fields (tokens, passwords, secrets)
 * - Standard actor types: USER, CONSULTANT, SYSTEM, AI
 * - Fail-silent: Audit failures don't break main flow
 */

import type { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export const ACTOR_TYPES = {
    USER: 'USER',
    CONSULTANT: 'CONSULTANT',
    SYSTEM: 'SYSTEM',
    AI: 'AI',
} as const;

export type ActorType = (typeof ACTOR_TYPES)[keyof typeof ACTOR_TYPES];

export const ACTION_TYPES = {
    // Invites
    INVITE_CREATED: 'INVITE_CREATED',
    INVITE_ACCEPTED: 'INVITE_ACCEPTED',
    INVITE_REVOKED: 'INVITE_REVOKED',

    // Trial & Org Lifecycle
    TRIAL_STARTED: 'TRIAL_STARTED',
    TRIAL_EXPIRED: 'TRIAL_EXPIRED',
    TRIAL_CONVERTED: 'TRIAL_CONVERTED',
    ORG_CREATED: 'ORG_CREATED',
    ORG_ACTIVATED: 'ORG_ACTIVATED',
    ORG_DEACTIVATED: 'ORG_DEACTIVATED',

    // RBAC
    ROLE_CHANGED: 'ROLE_CHANGED',
    PERMISSION_GRANTED: 'PERMISSION_GRANTED',
    PERMISSION_REVOKED: 'PERMISSION_REVOKED',
    MEMBER_ADDED: 'MEMBER_ADDED',
    MEMBER_REMOVED: 'MEMBER_REMOVED',
    CONSULTANT_LINKED: 'CONSULTANT_LINKED',
    CONSULTANT_UNLINKED: 'CONSULTANT_UNLINKED',

    // Tokens
    TOKEN_CREDITED: 'TOKEN_CREDITED',
    TOKEN_DEBITED: 'TOKEN_DEBITED',

    // Initiatives & Tasks
    INITIATIVE_CREATED: 'INITIATIVE_CREATED',
    INITIATIVE_UPDATED: 'INITIATIVE_UPDATED',
    INITIATIVE_DELETED: 'INITIATIVE_DELETED',
    TASK_CREATED: 'TASK_CREATED',
    TASK_UPDATED: 'TASK_UPDATED',
    TASK_DELETED: 'TASK_DELETED',

    // AI
    AI_PROPOSAL_CREATED: 'AI_PROPOSAL_CREATED',
    AI_ACTION_EXECUTED: 'AI_ACTION_EXECUTED',
    AI_ACTION_REJECTED: 'AI_ACTION_REJECTED',

    // Auth
    USER_LOGIN: 'USER_LOGIN',
    USER_LOGOUT: 'USER_LOGOUT',
    USER_REGISTERED: 'USER_REGISTERED',

    // Security
    ACCESS_DENIED: 'ACCESS_DENIED',
    TENANT_HOPPING_ATTEMPT: 'TENANT_HOPPING_ATTEMPT',

    // Generic
    ENTITY_VIEWED: 'ENTITY_VIEWED',
    ENTITY_EXPORTED: 'ENTITY_EXPORTED',

    // Phase E: Onboarding
    ONBOARDING_CONTEXT_SAVED: 'ONBOARDING_CONTEXT_SAVED',
    ONBOARDING_PLAN_GENERATED: 'ONBOARDING_PLAN_GENERATED',
    ONBOARDING_PLAN_ACCEPTED: 'ONBOARDING_PLAN_ACCEPTED',
} as const;

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];

interface LogEventParams {
    actorUserId?: string | null;
    actorType?: ActorType;
    orgId?: string | null;
    actionType: ActionType | string;
    entityType?: string | null;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
    ip?: string | null;
    userAgent?: string | null;
}

interface LogEventResult {
    success: boolean;
    id?: string;
    actionType?: string;
    entityType?: string | null;
    entityId?: string | null;
    error?: string;
}

interface GetEventsParams {
    orgId?: string;
    actorUserId?: string;
    actionType?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
    offset?: number;
}

interface AuditEvent {
    id: string;
    ts: string;
    actor_user_id: string | null;
    actor_type: ActorType;
    org_id: string | null;
    action_type: string;
    entity_type: string | null;
    entity_id: string | null;
    metadata_json: string;
    ip: string | null;
    user_agent: string | null;
    metadata?: Record<string, unknown>;
}

interface AuditServiceDependencies {
    db?: IDatabase;
}

interface ExpressRequestWithUser extends Request {
    user?: {
        id: string;
        organization_id?: string;
    };
    org?: {
        id?: string;
        isConsultant?: boolean;
    };
    orgContext?: {
        orgId?: string;
    };
    // method and originalUrl are already in Request
}

// ============================================
// SECURITY: Sensitive field redaction
// ============================================

const SENSITIVE_KEYS = new Set([
    // Auth & Tokens
    'password',
    'passwordHash',
    'password_hash',
    'token',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'jwt',
    'jwtToken',
    'bearer',
    'authorization',
    'auth',

    // Secrets & Keys
    'apiKey',
    'api_key',
    'apikey',
    'secret',
    'secretKey',
    'secret_key',
    'clientSecret',
    'client_secret',
    'privateKey',
    'private_key',
    'encryptionKey',
    'encryption_key',

    // Invite & Access Codes
    'inviteCode',
    'invite_code',
    'accessCode',
    'access_code',
    'verificationCode',
    'verification_code',
    'resetToken',
    'reset_token',

    // PII (optional redaction)
    'ssn',
    'socialSecurityNumber',
    'creditCard',
    'credit_card',
    'cardNumber',
    'card_number',
    'cvv',
    'cvc',
]);

/**
 * Recursively sanitize metadata object, redacting sensitive fields.
 */
export function sanitizeMetadata(obj: unknown, depth = 0): unknown {
    if (depth > 10) return '[MAX_DEPTH]';
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeMetadata(item, depth + 1));
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        const keyLower = key.toLowerCase();

        // Check if key is sensitive
        if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(keyLower)) {
            sanitized[key] = '[REDACTED]';
        }
        // Recursively sanitize nested objects
        else if (value && typeof value === 'object') {
            sanitized[key] = sanitizeMetadata(value, depth + 1);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

// ============================================
// AUDIT SERVICE CLASS
// ============================================

class AuditServiceClass {
    private db: IDatabase;

    constructor(deps?: AuditServiceDependencies) {
        this.db = deps?.db || getDatabase();
    }

    /**
     * Database helper: Run query
     */
    private async dbRun(sql: string, params: unknown[] = []): Promise<{ lastID?: number; changes: number }> {
        const result = await DbPromise.run(sql, params);
        return {
            lastID: result.lastID,
            changes: result.changes || 0,
        };
    }

    /**
     * Database helper: Get all rows
     */
    private async dbAll<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
        return await DbPromise.all<T>(sql, params);
    }

    /**
     * Log an audit event to the database.
     */
    async logEvent(params: LogEventParams): Promise<LogEventResult> {
        const id = uuidv4();
        const {
            actorUserId = null,
            actorType = ACTOR_TYPES.USER,
            orgId = null,
            actionType,
            entityType = null,
            entityId = null,
            metadata = {},
            ip = null,
            userAgent = null,
        } = params;

        // SECURITY: Always sanitize metadata
        const sanitizedMetadata = sanitizeMetadata(metadata);
        const metadataJson = JSON.stringify(sanitizedMetadata);

        try {
            await this.dbRun(
                `INSERT INTO audit_events 
                 (id, actor_user_id, actor_type, org_id, action_type, entity_type, entity_id, metadata_json, ip, user_agent)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, actorUserId, actorType, orgId, actionType, entityType, entityId, metadataJson, ip, userAgent],
            );

            return {
                success: true,
                id,
                actionType,
                entityType,
                entityId,
            };
        } catch (err: any) {
            logger.error('[AuditService] Failed to log event:', err instanceof Error ? err.message : String(err));
            // Fail-silent: audit failures should not break main flow
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }

    /**
     * Log from Express request context.
     * Automatically extracts user, org, IP, and user-agent.
     */
    async logFromRequest(
        req: ExpressRequestWithUser,
        actionType: ActionType | string,
        entityType: string | null,
        entityId: string | null,
        metadata: Record<string, unknown> = {},
    ): Promise<LogEventResult> {
        // Determine actor type from request context
        let actorType: ActorType = ACTOR_TYPES.USER;
        if (req.org?.isConsultant) {
            actorType = ACTOR_TYPES.CONSULTANT;
        }

        const actorUserId = req.user?.id || null;
        const orgId = req.org?.id || req.orgContext?.orgId || req.user?.organization_id || null;
        const ip = req.ip || (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() || null;
        const userAgent = req.headers?.['user-agent'] || null;

        return this.logEvent({
            actorUserId,
            actorType,
            orgId,
            actionType,
            entityType,
            entityId,
            metadata,
            ip,
            userAgent,
        });
    }

    /**
     * Log a SYSTEM event (no user actor).
     */
    async logSystemEvent(
        actionType: ActionType | string,
        entityType: string | null,
        entityId: string | null,
        orgId: string | null = null,
        metadata: Record<string, unknown> = {},
    ): Promise<LogEventResult> {
        return this.logEvent({
            actorUserId: null,
            actorType: ACTOR_TYPES.SYSTEM,
            orgId,
            actionType,
            entityType,
            entityId,
            metadata,
        });
    }

    /**
     * Log an AI event.
     */
    async logAIEvent(
        actionType: ActionType | string,
        entityType: string | null,
        entityId: string | null,
        orgId: string | null = null,
        metadata: Record<string, unknown> = {},
    ): Promise<LogEventResult> {
        return this.logEvent({
            actorUserId: null,
            actorType: ACTOR_TYPES.AI,
            orgId,
            actionType,
            entityType,
            entityId,
            metadata,
        });
    }

    /**
     * Log a security event (access denied, tenant hopping, etc.)
     */
    async logSecurityEvent(
        req: ExpressRequestWithUser,
        actionType: ActionType | string,
        metadata: Record<string, unknown> = {},
    ): Promise<LogEventResult> {
        return this.logFromRequest(req, actionType, 'SECURITY', null, {
            ...metadata,
            attemptedOrg: req.params?.orgId || req.headers?.['x-org-id'],
            userOrg: req.user?.organization_id,
            path: req.originalUrl,
            method: req.method,
        });
    }

    /**
     * Query audit events with filters.
     */
    async getEvents(params: GetEventsParams = {}): Promise<AuditEvent[]> {
        const { orgId, actorUserId, actionType, entityType, entityId, limit = 100, offset = 0 } = params;

        const conditions: string[] = [];
        const queryParams: unknown[] = [];

        if (orgId) {
            conditions.push('org_id = ?');
            queryParams.push(orgId);
        }
        if (actorUserId) {
            conditions.push('actor_user_id = ?');
            queryParams.push(actorUserId);
        }
        if (actionType) {
            conditions.push('action_type = ?');
            queryParams.push(actionType);
        }
        if (entityType) {
            conditions.push('entity_type = ?');
            queryParams.push(entityType);
        }
        if (entityId) {
            conditions.push('entity_id = ?');
            queryParams.push(entityId);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const rows = await this.dbAll<AuditEvent>(
            `SELECT * FROM audit_events ${whereClause} ORDER BY ts DESC LIMIT ? OFFSET ?`,
            [...queryParams, limit, offset],
        );

        return rows.map((row) => ({
            ...row,
            metadata: JSON.parse(row.metadata_json || '{}') as Record<string, unknown>,
        }));
    }

    /**
     * Generate CSV content for audit events.
     */
    async getCSVExport(params: { orgId?: string; limit?: number } = {}): Promise<string> {
        const { orgId, limit = 1000 } = params;
        const events = await this.getEvents({ orgId, limit });

        const headers = ['Timestamp', 'Actor ID', 'Actor Type', 'Action', 'Entity Type', 'Entity ID', 'IP', 'Metadata'];
        const rows = events.map((e) => [
            e.ts,
            e.actor_user_id || 'System',
            e.actor_type,
            e.action_type,
            e.entity_type || 'N/A',
            e.entity_id || 'N/A',
            e.ip || 'N/A',
            JSON.stringify(e.metadata || {}).replace(/"/g, '""'),
        ]);

        const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join(
            '\n',
        );

        return csvContent;
    }

    /**
     * Alias for logEvent (for backward compatibility)
     */
    async log(params: LogEventParams): Promise<LogEventResult> {
        return this.logEvent(params);
    }
}

// ============================================
// EXPORTS
// ===========================================

// Export singleton instance
const auditService = new AuditServiceClass();

// Export class for testing
export { AuditServiceClass };

// Export default instance (for backward compatibility)
export default auditService;

// Export individual functions for backward compatibility
export const logEvent = (params: LogEventParams) => auditService.logEvent(params);
export const logFromRequest = (
    req: ExpressRequestWithUser,
    actionType: ActionType | string,
    entityType: string | null,
    entityId: string | null,
    metadata: Record<string, unknown> = {},
) => auditService.logFromRequest(req, actionType, entityType, entityId, metadata);
export const logSystemEvent = (
    actionType: ActionType | string,
    entityType: string | null,
    entityId: string | null,
    orgId: string | null = null,
    metadata: Record<string, unknown> = {},
) => auditService.logSystemEvent(actionType, entityType, entityId, orgId, metadata);
export const logAIEvent = (
    actionType: ActionType | string,
    entityType: string | null,
    entityId: string | null,
    orgId: string | null = null,
    metadata: Record<string, unknown> = {},
) => auditService.logAIEvent(actionType, entityType, entityId, orgId, metadata);
export const logSecurityEvent = (
    req: ExpressRequestWithUser,
    actionType: ActionType | string,
    metadata: Record<string, unknown> = {},
) => auditService.logSecurityEvent(req, actionType, metadata);
export const getEvents = (params: GetEventsParams = {}) => auditService.getEvents(params);
export const getCSVExport = (params: { orgId?: string; limit?: number } = {}) => auditService.getCSVExport(params);
