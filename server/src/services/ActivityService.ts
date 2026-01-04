/**
 * Activity Logging Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/services/activityService.js (ES Modules) to TypeScript (ES Modules)
 * Logs user actions for audit trail and SuperAdmin dashboard
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';

import type RequestStore from '../utils/RequestStore.js';

// ==========================================
// TYPES
// ==========================================

interface LogActivityParams {
    organizationId: string;
    userId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    entityName?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    ipAddress?: string | null;
    userAgent?: string | null;
}

interface ActivityLogRow {
    id: string;
    organization_id: string;
    user_id?: string | null;
    action: string;
    entity_type: string;
    entity_id?: string | null;
    entity_name?: string | null;
    old_value?: string | null;
    new_value?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
    correlation_id?: string | null;
    created_at: string;
    user_name?: string | null;
    user_email?: string | null;
    organization_name?: string | null;
}

interface ActivityStats {
    total: number;
    last_hour: number;
    last_24h: number;
    last_7d: number;
}

interface ISiemService {
    stream(event: any): Promise<void>;
}

// ==========================================
// SERVICE
// ==========================================

let db: IDatabase = getDatabase();
let requestStore: typeof RequestStore | undefined;
let siemService: ISiemService | undefined;

async function initDeps(): Promise<void> {
    if (!requestStore) {
        const requestStoreModule = await import('../utils/RequestStore.js');
        requestStore = requestStoreModule.default;
    }
    if (!siemService) {
        const siemServiceModule = await import('./siemService.js');
        siemService = (siemServiceModule.default || siemServiceModule) as unknown as ISiemService;
    }
}

/**
 * Set dependencies for testing
 */
export function setDependencies(
    newDeps: { db?: IDatabase; requestStore?: typeof RequestStore; siemService?: ISiemService } = {},
): void {
    if (newDeps.db) {
        db = newDeps.db;
    }
    if (newDeps.requestStore) {
        requestStore = newDeps.requestStore;
    }
    if (newDeps.siemService) {
        siemService = newDeps.siemService;
    }
}

/**
 * Log an activity
 */
export async function log(params: LogActivityParams): Promise<void> {
    await initDeps();

    const correlationId = requestStore && requestStore.getCorrelationId ? requestStore.getCorrelationId() : null;
    const {
        organizationId,
        userId,
        action,
        entityType,
        entityId,
        entityName,
        oldValue,
        newValue,
        ipAddress,
        userAgent,
    } = params;

    const activityId = uuidv4();

    try {
        await DbPromise.run(
            db,
            `INSERT INTO activity_logs 
             (id, organization_id, user_id, action, entity_type, entity_id, entity_name, old_value, new_value, ip_address, user_agent, correlation_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                activityId,
                organizationId,
                userId || null,
                action,
                entityType,
                entityId || null,
                entityName || null,
                oldValue ? JSON.stringify(oldValue) : null,
                newValue ? JSON.stringify(newValue) : null,
                ipAddress || null,
                userAgent || null,
                correlationId,
            ],
        );

        // Prestige Layer: Stream to external SIEM
        try {
            if (siemService) {
                await siemService.stream({
                    id: activityId,
                    organizationId,
                    userId,
                    action,
                    entityType,
                    entityId,
                    correlationId,
                    metadata: { ipAddress, userAgent },
                });
            }
        } catch {
            // Ignore SIEM errors
        }
    } catch (err: unknown) {
        if (process.env.NODE_ENV !== 'production') {
            const error = err as Error;
            console.warn('[ActivityService] Failed to log activity:', error.message);
        }
        // Resolve anyway to prevent crashing caller
    }
}

/**
 * Get recent activities for SuperAdmin dashboard
 */
export async function getRecent(limit: number = 50): Promise<ActivityLogRow[]> {
    const rows = await DbPromise.all<ActivityLogRow>(
        db,
        `SELECT 
            al.*,
            u.first_name || ' ' || u.last_name as user_name,
            u.email as user_email,
            o.name as organization_name
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN organizations o ON al.organization_id = o.id
        ORDER BY al.created_at DESC
        LIMIT ?`,
        [limit],
    );

    return rows || [];
}

/**
 * Get activities by organization
 */
export async function getByOrganization(organizationId: string, limit: number = 50): Promise<ActivityLogRow[]> {
    const rows = await DbPromise.all<ActivityLogRow>(
        db,
        `SELECT 
            al.*,
            u.first_name || ' ' || u.last_name as user_name,
            u.email as user_email
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.organization_id = ?
        ORDER BY al.created_at DESC
        LIMIT ?`,
        [organizationId, limit],
    );

    return rows || [];
}

/**
 * Get activity stats
 */
export async function getStats(): Promise<ActivityStats> {
    const row = await DbPromise.get<ActivityStats>(
        db,
        `SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN created_at > datetime('now', '-1 hour') THEN 1 END) as last_hour,
            COUNT(CASE WHEN created_at > datetime('now', '-24 hours') THEN 1 END) as last_24h,
            COUNT(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 END) as last_7d
        FROM activity_logs`,
    );

    return row || { total: 0, last_hour: 0, last_24h: 0, last_7d: 0 };
}

// Default export for backward compatibility
const ActivityService = {
    setDependencies,
    log,
    getRecent,
    getByOrganization,
    getStats,
};

export default ActivityService;
