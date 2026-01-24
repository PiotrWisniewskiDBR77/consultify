/**
 * Activity Logging Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Logs user actions for audit trail and SuperAdmin dashboard
 */

import { v4 as uuidv4 } from 'uuid';

import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { getCorrelationId } from '../utils/RequestStore.js';

// ==========================================
// TYPES
// ==========================================

export interface ActivityLogParams {
    organizationId: string;
    userId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    entityName?: string;
    oldValue?: unknown;
    newValue?: unknown;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
}

export interface ActivityLog {
    id: string;
    organization_id: string;
    user_id?: string;
    action: string;
    entity_type: string;
    entity_id?: string;
    entity_name?: string;
    old_value?: string;
    new_value?: string;
    ip_address?: string;
    user_agent?: string;
    correlation_id?: string;
    created_at: string;
}

// ==========================================
// ACTIVITY SERVICE
// ==========================================

class ActivityService {
    private deps = {
        dbRun: DbPromise.run,
        dbAll: DbPromise.all,
        dbGet: DbPromise.get,
    };

    /**
     * Set dependencies (for testing)
     */
    setDependencies(newDeps: any): void {
        if (newDeps.db) {
            // Mapping for backward compatibility with old mockDb.run pattern
            this.deps.dbRun = (async (sql: string, params?: unknown[]) => {
                return new Promise((resolve) => {
                    newDeps.db.run(sql, params || [], (err: any) => {
                        if (err) resolve({ success: false, error: err.message });
                        else resolve({ success: true });
                    });
                });
            }) as any;
            this.deps.dbAll = (async (sql: string, params?: unknown[]) => {
                return new Promise((resolve, reject) => {
                    newDeps.db.all(sql, params || [], (err: any, rows: any) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });
            }) as any;
        }
        if (newDeps.dbRun) this.deps.dbRun = newDeps.dbRun;
        if (newDeps.dbAll) this.deps.dbAll = newDeps.dbAll;
    }

    /**
     * Log an activity
     */
    async log(params: ActivityLogParams): Promise<void> {
        try {
            const correlationId = getCorrelationId();
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
                metadata,
            } = params;

            const sql = `
                INSERT INTO activity_logs 
                (id, organization_id, user_id, action, entity_type, entity_id, entity_name, old_value, new_value, ip_address, user_agent, correlation_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const activityId = uuidv4();

            await this.deps.dbRun(sql, [
                activityId,
                organizationId,
                userId || null,
                action,
                entityType,
                entityId || null,
                entityName || null,
                oldValue ? JSON.stringify(oldValue) : null,
                newValue || metadata ? JSON.stringify(newValue || metadata) : null,
                ipAddress || null,
                userAgent || null,
                correlationId,
            ]);
        } catch (err) {
            const error = err as Error;
            if (process.env.NODE_ENV !== 'production') {
                logger.warn('[ActivityService] Failed to log activity:', { error: error.message });
            }
        }
    }

    /**
     * Get recent activities for SuperAdmin dashboard
     */
    async getRecent(limit = 50): Promise<ActivityLog[]> {
        const sql = `
            SELECT 
                al.*,
                u.email as user_email,
                u.first_name || ' ' || u.last_name as user_name
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.created_at DESC
            LIMIT ?
        `;

        return (await this.deps.dbAll(sql, [limit])) as ActivityLog[];
    }

    /**
     * Get activities for a specific organization
     */
    async getByOrganization(organizationId: string, limit = 50): Promise<ActivityLog[]> {
        const sql = `
            SELECT 
                al.*,
                u.email as user_email,
                u.first_name || ' ' || u.last_name as user_name
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.organization_id = ?
            ORDER BY al.created_at DESC
            LIMIT ?
        `;

        return (await this.deps.dbAll(sql, [organizationId, limit])) as ActivityLog[];
    }

    /**
     * Get activity statistics for SuperAdmin dashboard
     */
    async getStats(): Promise<{ total: number; last_hour: number; last_24h: number; last_7d: number }> {
        try {
            const result = await this.deps.dbGet<{ total: number; last_hour: number; last_24h: number; last_7d: number }>(`
                SELECT 
                    (SELECT COUNT(*) FROM activity_logs) as total,
                    (SELECT COUNT(*) FROM activity_logs WHERE created_at > datetime('now', '-1 hour')) as last_hour,
                    (SELECT COUNT(*) FROM activity_logs WHERE created_at > datetime('now', '-24 hours')) as last_24h,
                    (SELECT COUNT(*) FROM activity_logs WHERE created_at > datetime('now', '-7 days')) as last_7d
            `);
            return result || { total: 0, last_hour: 0, last_24h: 0, last_7d: 0 };
        } catch {
            return { total: 0, last_hour: 0, last_24h: 0, last_7d: 0 };
        }
    }
}

export const activityService = new ActivityService();
export default activityService;
