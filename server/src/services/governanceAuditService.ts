/**
 * Governance Audit Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/services/governanceAuditService.js (CommonJS) to TypeScript (ES Modules)
 * Step 14: Governance, Security & Enterprise Controls
 *
 * Immutable audit logging with PII redaction and optional tamper-evident hash chain.
 * All administrative actions are logged here for SOC2/ISO compliance.
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.ts';
import logger from '../utils/Logger.ts';

// Lazy-loaded dependencies
let PiiRedactor: any;

async function initDeps(): Promise<void> {
    if (!PiiRedactor) {
        const piiRedactorModule = await import('../utils/piiRedactor.js');
        PiiRedactor = piiRedactorModule.default || piiRedactorModule;
    }
}

// ==========================================
// TYPES
// ==========================================

export const AUDIT_ACTIONS = {
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
    PUBLISH: 'PUBLISH',
    TOGGLE: 'TOGGLE',
    DELETE_SOFT: 'DELETE_SOFT',
    GRANT_PERMISSION: 'GRANT_PERMISSION',
    REVOKE_PERMISSION: 'REVOKE_PERMISSION',
    BREAK_GLASS_START: 'BREAK_GLASS_START',
    BREAK_GLASS_CLOSE: 'BREAK_GLASS_CLOSE',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const RESOURCE_TYPES = {
    POLICY_RULE: 'POLICY_RULE',
    PLAYBOOK_TEMPLATE: 'PLAYBOOK_TEMPLATE',
    CONNECTOR: 'CONNECTOR',
    PERMISSION: 'PERMISSION',
    USER: 'USER',
    ORGANIZATION: 'ORGANIZATION',
    BREAK_GLASS_SESSION: 'BREAK_GLASS_SESSION',
    GLOBAL_TOGGLE: 'GLOBAL_TOGGLE',
    // Economics Module Resources
    DIGITIZATION_ANALYSIS: 'DIGITIZATION_ANALYSIS',
    DIGITIZATION_SCORE: 'DIGITIZATION_SCORE',
    DIGITIZATION_VERSION: 'DIGITIZATION_VERSION',
    DIGITIZATION_EVIDENCE: 'DIGITIZATION_EVIDENCE',
    DIGITIZATION_COMPARISON: 'DIGITIZATION_COMPARISON',
    DIGITIZATION_EXPORT: 'DIGITIZATION_EXPORT',
} as const;

export type ResourceType = (typeof RESOURCE_TYPES)[keyof typeof RESOURCE_TYPES];

interface LogAuditParams {
    actorId: string;
    actorRole?: string;
    orgId: string;
    action: AuditAction;
    resourceType: ResourceType;
    resourceId?: string | null;
    before?: unknown | null;
    after?: unknown | null;
    correlationId?: string | null;
}

interface LogAuditResult {
    id: string;
    organizationId: string;
    actorId: string;
    action: AuditAction;
    resourceType: ResourceType;
    resourceId: string | null;
    correlationId: string;
    createdAt: string;
}

interface GetAuditLogParams {
    orgId?: string;
    superadminBypass?: boolean;
    action?: AuditAction | null;
    resourceType?: ResourceType | null;
    resourceId?: string | null;
    actorId?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    limit?: number;
    offset?: number;
}

interface AuditLogEntry {
    id: string;
    organizationId: string;
    actorId: string;
    actorRole?: string | null;
    action: AuditAction;
    resourceType: ResourceType;
    resourceId: string | null;
    before: unknown | null;
    after: unknown | null;
    correlationId?: string | null;
    createdAt: string;
}

interface ExportAuditLogParams {
    orgId?: string;
    format?: 'csv' | 'json';
    superadminBypass?: boolean;
    startDate?: string | null;
    endDate?: string | null;
}

interface ExportAuditLogResult {
    format: 'csv' | 'json';
    data: string | AuditLogEntry[];
}

interface HashChainVerificationError {
    index: number;
    id: string;
    error: string;
}

interface VerifyHashChainResult {
    valid: boolean;
    totalRecords: number;
    errors: HashChainVerificationError[];
}

interface AuditLogRow {
    id: string;
    organization_id: string;
    actor_id: string;
    actor_role?: string | null;
    action: string;
    resource_type: string;
    resource_id?: string | null;
    before_json?: string | null;
    after_json?: string | null;
    correlation_id?: string | null;
    prev_hash?: string | null;
    record_hash: string;
    created_at: string;
}

interface PreviousHashRow {
    record_hash: string;
}

// ==========================================
// SERVICE
// ==========================================

let db: IDatabase = getDatabase();

/**
 * Set database instance (for testing)
 */
export function setDependencies(newDeps: { db?: IDatabase } = {}): void {
    if (newDeps.db) {
        db = newDeps.db;
    }
}

/**
 * Compute SHA-256 hash for tamper evidence
 */
function computeHash(
    prevHash: string | null,
    record: {
        id: string;
        actor_id: string;
        action: string;
        resource_type: string;
        resource_id: string | null;
        created_at: string;
    },
): string {
    const data = `${prevHash || ''}|${record.id}|${record.actor_id}|${record.action}|${record.resource_type}|${record.resource_id}|${record.created_at}`;
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Log an audit entry (immutable)
 */
export async function logAudit(params: LogAuditParams): Promise<LogAuditResult> {
    await initDeps();
    const {
        actorId,
        actorRole,
        orgId,
        action,
        resourceType,
        resourceId = null,
        before = null,
        after = null,
        correlationId = null,
    } = params;

    if (!actorId || !orgId || !action || !resourceType) {
        throw new Error('Missing required audit parameters: actorId, orgId, action, resourceType');
    }

    if (!Object.values(AUDIT_ACTIONS).includes(action)) {
        throw new Error(`Invalid action: ${action}`);
    }

    const auditId = uuidv4();
    const createdAt = new Date().toISOString();
    const corrId = correlationId || `audit-${uuidv4()}`;

    // Redact PII from before/after snapshots
    const beforeJson = before ? PiiRedactor.createAuditSnapshot(before) : null;
    const afterJson = after ? PiiRedactor.createAuditSnapshot(after) : null;

    // Get previous hash for tamper-evident chain
    let prevHash: string | null = null;
    try {
        const prevRow = await DbPromise.get<PreviousHashRow>(
            db,
            `SELECT record_hash FROM governance_audit_log 
             WHERE organization_id = ? 
             ORDER BY created_at DESC LIMIT 1`,
            [orgId],
        );
        prevHash = prevRow?.record_hash || null;
    } catch (err: unknown) {
        logger.error('[GovernanceAudit] Error fetching prev hash:', err);
        // Continue without hash chain if error
    }

    const recordForHash = {
        id: auditId,
        actor_id: actorId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        created_at: createdAt,
    };
    const recordHash = computeHash(prevHash, recordForHash);

    await DbPromise.run(
        db,
        `INSERT INTO governance_audit_log 
         (id, organization_id, actor_id, actor_role, action, resource_type, 
          resource_id, before_json, after_json, correlation_id, prev_hash, record_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            auditId,
            orgId,
            actorId,
            actorRole || null,
            action,
            resourceType,
            resourceId,
            beforeJson,
            afterJson,
            corrId,
            prevHash,
            recordHash,
            createdAt,
        ],
    );

    logger.info(`[GovernanceAudit] Logged: ${action} on ${resourceType}/${resourceId} by ${actorId}`);

    return {
        id: auditId,
        organizationId: orgId,
        actorId,
        action,
        resourceType,
        resourceId,
        correlationId: corrId,
        createdAt,
    };
}

/**
 * Get audit log with filters and pagination
 */
export async function getAuditLog(params: GetAuditLogParams): Promise<AuditLogEntry[]> {
    const {
        orgId,
        superadminBypass = false,
        action = null,
        resourceType = null,
        resourceId = null,
        actorId = null,
        startDate = null,
        endDate = null,
        limit = 100,
        offset = 0,
    } = params;

    let sql = `SELECT * FROM governance_audit_log WHERE 1=1`;
    const sqlParams: unknown[] = [];

    // Organization isolation (unless SUPERADMIN bypass)
    if (!superadminBypass && orgId) {
        sql += ` AND organization_id = ?`;
        sqlParams.push(orgId);
    }

    if (action) {
        sql += ` AND action = ?`;
        sqlParams.push(action);
    }

    if (resourceType) {
        sql += ` AND resource_type = ?`;
        sqlParams.push(resourceType);
    }

    if (resourceId) {
        sql += ` AND resource_id = ?`;
        sqlParams.push(resourceId);
    }

    if (actorId) {
        sql += ` AND actor_id = ?`;
        sqlParams.push(actorId);
    }

    if (startDate) {
        sql += ` AND created_at >= ?`;
        sqlParams.push(startDate);
    }

    if (endDate) {
        sql += ` AND created_at <= ?`;
        sqlParams.push(endDate);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    sqlParams.push(limit, offset);

    const rows = await DbPromise.all<AuditLogRow>(db, sql, sqlParams);

    return (rows || []).map((row) => ({
        id: row.id,
        organizationId: row.organization_id,
        actorId: row.actor_id,
        actorRole: row.actor_role,
        action: row.action as AuditAction,
        resourceType: row.resource_type as ResourceType,
        resourceId: row.resource_id || null,
        before: row.before_json ? JSON.parse(row.before_json) : null,
        after: row.after_json ? JSON.parse(row.after_json) : null,
        correlationId: row.correlation_id || null,
        createdAt: row.created_at,
    }));
}

/**
 * Export audit log as CSV or JSON
 */
export async function exportAuditLog(params: ExportAuditLogParams): Promise<ExportAuditLogResult> {
    const { orgId, format = 'json', superadminBypass = false, startDate = null, endDate = null } = params;

    const entries = await getAuditLog({
        orgId,
        superadminBypass,
        startDate,
        endDate,
        limit: 10000, // Max export limit
    });

    if (format === 'csv') {
        const headers = [
            'id',
            'organization_id',
            'actor_id',
            'actor_role',
            'action',
            'resource_type',
            'resource_id',
            'correlation_id',
            'created_at',
        ];
        const csvRows = [headers.join(',')];

        entries.forEach((entry) => {
            csvRows.push(
                [
                    entry.id,
                    entry.organizationId,
                    entry.actorId,
                    entry.actorRole || '',
                    entry.action,
                    entry.resourceType,
                    entry.resourceId || '',
                    entry.correlationId || '',
                    entry.createdAt,
                ]
                    .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                    .join(','),
            );
        });

        return { format: 'csv', data: csvRows.join('\n') };
    }

    return { format: 'json', data: entries };
}

/**
 * Verify hash chain integrity for an organization's audit log
 */
export async function verifyHashChain(orgId: string): Promise<VerifyHashChainResult> {
    const rows = await DbPromise.all<AuditLogRow>(
        db,
        `SELECT * FROM governance_audit_log 
         WHERE organization_id = ? 
         ORDER BY created_at ASC`,
        [orgId],
    );

    const errors: HashChainVerificationError[] = [];
    let expectedPrevHash: string | null = null;

    (rows || []).forEach((row, idx) => {
        // Check prev_hash matches previous record's record_hash
        if (row.prev_hash !== expectedPrevHash) {
            errors.push({
                index: idx,
                id: row.id,
                error: `prev_hash mismatch: expected ${expectedPrevHash}, got ${row.prev_hash}`,
            });
        }

        // Recompute hash and verify
        const recomputed = computeHash(row.prev_hash || null, {
            id: row.id,
            actor_id: row.actor_id,
            action: row.action,
            resource_type: row.resource_type,
            resource_id: row.resource_id || null,
            created_at: row.created_at,
        });

        if (row.record_hash !== recomputed) {
            errors.push({
                index: idx,
                id: row.id,
                error: `record_hash mismatch: stored ${row.record_hash}, computed ${recomputed}`,
            });
        }

        expectedPrevHash = row.record_hash;
    });

    return {
        valid: errors.length === 0,
        totalRecords: (rows || []).length,
        errors,
    };
}

// Default export for backward compatibility
const GovernanceAuditService = {
    AUDIT_ACTIONS,
    RESOURCE_TYPES,
    setDependencies,
    logAudit,
    getAuditLog,
    exportAuditLog,
    verifyHashChain,
};

export default GovernanceAuditService;
