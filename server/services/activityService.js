import BaseService from './BaseService.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Activity Logging Service
 * Logs user actions for audit trail and SuperAdmin dashboard
 */
class ActivityService extends BaseService {
    constructor() {
        super();
        this._requestStore = null;
        this._siemService = null;
    }

    /**
     * Initialize dependencies
     */
    async init() {
        await super.init();
        if (!this._requestStore) {
            const { default: requestStore } = await import('../utils/requestStore.js');
            this._requestStore = requestStore;
        }
        if (!this._siemService) {
            const { default: siemService } = await import('./siemService.js');
            this._siemService = siemService;
        }
        return this;
    }

    /**
     * Set dependencies for testing
     */
    setDependencies(newDeps) {
        super.setDependencies(newDeps);
        if (newDeps.requestStore) this._requestStore = newDeps.requestStore;
        if (newDeps.siemService) this._siemService = newDeps.siemService;
    }

    /**
     * Log an activity
     */
    async log(params) {
        await this.init();

        const correlationId = this._requestStore && this._requestStore.getCorrelationId
            ? this._requestStore.getCorrelationId()
            : null;

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

        try {
            await this.queryRun(sql, [
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
            ]);

            // Prestige Layer: Stream to external SIEM
            if (this._siemService) {
                this._siemService.stream({
                    id: activityId,
                    organizationId,
                    userId,
                    action,
                    entityType,
                    entityId,
                    correlationId,
                    metadata: { ipAddress, userAgent }
                }).catch(() => { });
            }
        } catch (err) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('[ActivityService] Failed to log activity:', err.message);
            }
            // resolve anyway to prevent crashing caller
        }
    }

    /**
     * Get recent activities for SuperAdmin dashboard
     */
    async getRecent(limit = 50) {
        await this.init();
        const sql = `
            SELECT 
                al.*,
                u.first_name || ' ' || u.last_name as user_name,
                u.email as user_email,
                o.name as organization_name
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            LEFT JOIN organizations o ON al.organization_id = o.id
            ORDER BY al.created_at DESC
            LIMIT ?
        `;

        return this.queryAll(sql, [limit]);
    }

    /**
     * Get activities by organization
     */
    async getByOrganization(organizationId, limit = 50) {
        await this.init();
        const sql = `
            SELECT 
                al.*,
                u.first_name || ' ' || u.last_name as user_name,
                u.email as user_email
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.organization_id = ?
            ORDER BY al.created_at DESC
            LIMIT ?
        `;

        return this.queryAll(sql, [organizationId, limit]);
    }

    /**
     * Get activity stats
     */
    async getStats() {
        await this.init();
        const sql = `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN created_at > datetime('now', '-1 hour') THEN 1 END) as last_hour,
                COUNT(CASE WHEN created_at > datetime('now', '-24 hours') THEN 1 END) as last_24h,
                COUNT(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 END) as last_7d
            FROM activity_logs
        `;

        const row = await this.queryOne(sql, []);
        return row || { total: 0, last_hour: 0, last_24h: 0, last_7d: 0 };
    }
}

const service = new ActivityService();
export default service;

