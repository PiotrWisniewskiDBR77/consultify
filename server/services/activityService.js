/**
 * Activity Logging Service
 * Logs user actions for audit trail and SuperAdmin dashboard
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const ActivityService = {
    /**
     * Log an activity
     * @param {Object} params - Activity parameters
     * @param {string} params.organizationId - Organization ID
     * @param {string} params.userId - User ID (optional)
     * @param {string} params.action - Action type (created, updated, deleted, etc.)
     * @param {string} params.entityType - Entity type (task, project, user, etc.)
     * @param {string} params.entityId - Entity ID
     * @param {string} params.entityName - Entity name/title
     * @param {Object} params.oldValue - Previous value (optional)
     * @param {Object} params.newValue - New value (optional)
     * @param {string} params.ipAddress - IP address (optional)
     * @param {string} params.userAgent - User agent (optional)
     */
    log: (params) => {
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
            (id, organization_id, user_id, action, entity_type, entity_id, entity_name, old_value, new_value, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [
            uuidv4(),
            organizationId,
            userId || null,
            action,
            entityType,
            entityId || null,
            entityName || null,
            oldValue ? JSON.stringify(oldValue) : null,
            newValue ? JSON.stringify(newValue) : null,
            ipAddress || null,
            userAgent || null
        ]);
    },

    /**
     * Get recent activities for SuperAdmin dashboard
     * @param {number} limit - Number of activities to return
     * @returns {Promise<Array>} Activities
     */
    getRecent: (limit = 50) => {
        return new Promise((resolve, reject) => {
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

            db.all(sql, [limit], (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Get activities by organization
     * @param {string} organizationId - Organization ID
     * @param {number} limit - Number of activities to return
     * @returns {Promise<Array>} Activities
     */
    getByOrganization: (organizationId, limit = 50) => {
        return new Promise((resolve, reject) => {
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

            db.all(sql, [organizationId, limit], (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Get activity stats
     * @returns {Promise<Object>} Statistics
     */
    getStats: () => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN created_at > datetime('now', '-1 hour') THEN 1 END) as last_hour,
                    COUNT(CASE WHEN created_at > datetime('now', '-24 hours') THEN 1 END) as last_24h,
                    COUNT(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 END) as last_7d
                FROM activity_logs
            `;

            db.get(sql, [], (err, row) => {
                if (err) return reject(err);
                resolve(row || { total: 0, last_hour: 0, last_24h: 0, last_7d: 0 });
            });
        });
    }
};

module.exports = ActivityService;
