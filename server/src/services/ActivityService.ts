/**
 * Activity Logging Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Logs user actions for audit trail and SuperAdmin dashboard
 */

import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import { v4 as uuidv4 } from 'uuid';
import { getCorrelationId } from '../utils/RequestStore.js';
import logger from '../utils/Logger.js';

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
    private db: IDatabase;

    constructor(dbInstance?: IDatabase) {
        this.db = dbInstance || getDatabase();
    }

    /**
     * Log an activity
     */
    async log(params: ActivityLogParams): Promise<void> {
        return new Promise((resolve) => {
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
                userAgent
            } = params;

            const sql = `
                INSERT INTO activity_logs 
                (id, organization_id, user_id, action, entity_type, entity_id, entity_name, old_value, new_value, ip_address, user_agent, correlation_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const activityId = uuidv4();

            this.db.run(sql, [
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
                correlationId
            ], (err) => {
                if (err) {
                    if (process.env.NODE_ENV !== 'production') {
                        logger.warn('[ActivityService] Failed to log activity:', { error: err.message });
                    }
                    // resolve anyway to prevent crashing caller
                    return resolve();
                }

                // TODO: Stream to external SIEM when siemService is migrated
                // deps.siemService.stream({...}).catch(() => {}).finally(resolve);

                resolve();
            });
        });
    }

    /**
     * Get recent activities for SuperAdmin dashboard
     */
    async getRecent(limit = 50): Promise<ActivityLog[]> {
        return new Promise((resolve, reject) => {
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

            this.db.all<ActivityLog>(sql, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows || []);
            });
        });
    }

    /**
     * Get activities for a specific organization
     */
    async getByOrganization(organizationId: string, limit = 50): Promise<ActivityLog[]> {
        return new Promise((resolve, reject) => {
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

            this.db.all<ActivityLog>(sql, [organizationId, limit], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows || []);
            });
        });
    }
}

export const activityService = new ActivityService();
export default activityService;
