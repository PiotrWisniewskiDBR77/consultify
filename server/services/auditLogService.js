/**
 * Audit Log Service
 * 
 * Comprehensive audit logging for enterprise compliance and security.
 * Features:
 * - Immutable audit trail
 * - Risk level classification
 * - Compliance tagging (GDPR, SOC2, ISO27001)
 * - Search and filtering
 * - Export capabilities
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');

class AuditLogService {
    /**
     * Create an audit log entry
     */
    async createLog(logData) {
        const {
            user_id,
            user_email,
            ip_address,
            user_agent,
            action_type,
            resource_type,
            resource_id,
            before_data,
            after_data,
            risk_level = 'LOW',
            compliance_tags = [],
            request_id,
            organization_id,
            metadata = {}
        } = logData;

        const id = uuidv4();
        const timestamp = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO audit_logs (
                    id, timestamp, user_id, user_email, ip_address, user_agent,
                    action_type, resource_type, resource_id, before_data, after_data,
                    risk_level, compliance_tags, request_id, organization_id, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, timestamp, user_id, user_email, ip_address, user_agent,
                    action_type, resource_type, resource_id,
                    before_data ? JSON.stringify(before_data) : null,
                    after_data ? JSON.stringify(after_data) : null,
                    risk_level, JSON.stringify(compliance_tags), request_id,
                    organization_id, JSON.stringify(metadata)
                ],
                function (err) {
                    if (err) {
                        console.error('[AuditLog] Error creating log:', err);
                        return reject(err);
                    }
                    resolve({ id, timestamp });
                }
            );
        });
    }

    /**
     * Get audit logs with filtering and pagination
     */
    async getLogs(filters = {}, pagination = { page: 1, pageSize: 50 }) {
        const {
            search,
            riskLevel,
            flaggedOnly,
            startDate,
            endDate,
            userId,
            actionType,
            resourceType,
            resourceId,
            organizationId,
            complianceTag
        } = filters;

        const { page = 1, pageSize = 50 } = pagination;
        const offset = (page - 1) * pageSize;

        let query = 'SELECT * FROM audit_logs WHERE 1=1';
        const params = [];

        if (search) {
            query += ` AND (
                action_type LIKE ? OR 
                resource_type LIKE ? OR 
                user_email LIKE ? OR
                request_id LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (riskLevel && riskLevel !== 'ALL') {
            query += ' AND risk_level = ?';
            params.push(riskLevel);
        }

        if (startDate) {
            query += ' AND timestamp >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND timestamp <= ?';
            params.push(endDate);
        }

        if (userId) {
            query += ' AND user_id = ?';
            params.push(userId);
        }

        if (actionType) {
            query += ' AND action_type = ?';
            params.push(actionType);
        }

        if (resourceType) {
            query += ' AND resource_type = ?';
            params.push(resourceType);
        }

        if (resourceId) {
            query += ' AND resource_id = ?';
            params.push(resourceId);
        }

        if (organizationId) {
            query += ' AND organization_id = ?';
            params.push(organizationId);
        }

        if (complianceTag) {
            query += ' AND compliance_tags LIKE ?';
            params.push(`%${complianceTag}%`);
        }

        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(pageSize, offset);

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[AuditLog] Error fetching logs:', err);
                    return reject(err);
                }

                // Parse JSON fields
                const logs = rows.map(row => ({
                    ...row,
                    before_data: row.before_data ? JSON.parse(row.before_data) : null,
                    after_data: row.after_data ? JSON.parse(row.after_data) : null,
                    compliance_tags: row.compliance_tags ? JSON.parse(row.compliance_tags) : [],
                    metadata: row.metadata ? JSON.parse(row.metadata) : {}
                }));

                resolve(logs);
            });
        });
    }

    /**
     * Get total count of logs matching filters
     */
    async getLogsCount(filters = {}) {
        const {
            search,
            riskLevel,
            startDate,
            endDate,
            userId,
            actionType,
            resourceType,
            organizationId
        } = filters;

        let query = 'SELECT COUNT(*) as count FROM audit_logs WHERE 1=1';
        const params = [];

        if (search) {
            query += ` AND (
                action_type LIKE ? OR 
                resource_type LIKE ? OR 
                user_email LIKE ? OR
                request_id LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (riskLevel && riskLevel !== 'ALL') {
            query += ' AND risk_level = ?';
            params.push(riskLevel);
        }

        if (startDate) {
            query += ' AND timestamp >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND timestamp <= ?';
            params.push(endDate);
        }

        if (userId) {
            query += ' AND user_id = ?';
            params.push(userId);
        }

        if (actionType) {
            query += ' AND action_type = ?';
            params.push(actionType);
        }

        if (resourceType) {
            query += ' AND resource_type = ?';
            params.push(resourceType);
        }

        if (organizationId) {
            query += ' AND organization_id = ?';
            params.push(organizationId);
        }

        return new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
                if (err) {
                    console.error('[AuditLog] Error counting logs:', err);
                    return reject(err);
                }
                resolve(row ? row.count : 0);
            });
        });
    }

    /**
     * Get audit log by ID
     */
    async getLogById(id) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM audit_logs WHERE id = ?', [id], (err, row) => {
                if (err) {
                    console.error('[AuditLog] Error fetching log:', err);
                    return reject(err);
                }

                if (!row) {
                    return resolve(null);
                }

                resolve({
                    ...row,
                    before_data: row.before_data ? JSON.parse(row.before_data) : null,
                    after_data: row.after_data ? JSON.parse(row.after_data) : null,
                    compliance_tags: row.compliance_tags ? JSON.parse(row.compliance_tags) : [],
                    metadata: row.metadata ? JSON.parse(row.metadata) : {}
                });
            });
        });
    }

    /**
     * Get audit log statistics
     */
    async getStats(filters = {}) {
        const { startDate, endDate, organizationId } = filters;

        let query = `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN risk_level = 'HIGH' THEN 1 END) as high_risk,
                COUNT(CASE WHEN risk_level = 'MEDIUM' THEN 1 END) as medium_risk,
                COUNT(CASE WHEN risk_level = 'LOW' THEN 1 END) as low_risk,
                COUNT(CASE WHEN risk_level = 'CRITICAL' THEN 1 END) as critical_risk
            FROM audit_logs
            WHERE 1=1
        `;
        const params = [];

        if (startDate) {
            query += ' AND timestamp >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND timestamp <= ?';
            params.push(endDate);
        }

        if (organizationId) {
            query += ' AND organization_id = ?';
            params.push(organizationId);
        }

        return new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
                if (err) {
                    console.error('[AuditLog] Error fetching stats:', err);
                    return reject(err);
                }
                resolve(row || { total: 0, high_risk: 0, medium_risk: 0, low_risk: 0, critical_risk: 0 });
            });
        });
    }

    /**
     * Export audit logs to CSV format
     */
    async exportToCSV(filters = {}) {
        const logs = await this.getLogs(filters, { page: 1, pageSize: 10000 });

        const headers = [
            'ID', 'Timestamp', 'User ID', 'User Email', 'IP Address',
            'Action Type', 'Resource Type', 'Resource ID', 'Risk Level',
            'Compliance Tags', 'Request ID', 'Organization ID'
        ];

        const rows = logs.map(log => [
            log.id,
            log.timestamp,
            log.user_id || '',
            log.user_email || '',
            log.ip_address || '',
            log.action_type,
            log.resource_type || '',
            log.resource_id || '',
            log.risk_level,
            Array.isArray(log.compliance_tags) ? log.compliance_tags.join(',') : '',
            log.request_id || '',
            log.organization_id || ''
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        return csv;
    }

    /**
     * Get compliance report for a specific framework
     */
    async getComplianceReport(framework, filters = {}) {
        const { startDate, endDate, organizationId } = filters;

        let query = `
            SELECT * FROM audit_logs
            WHERE compliance_tags LIKE ?
        `;
        const params = [`%${framework}%`];

        if (startDate) {
            query += ' AND timestamp >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND timestamp <= ?';
            params.push(endDate);
        }

        if (organizationId) {
            query += ' AND organization_id = ?';
            params.push(organizationId);
        }

        query += ' ORDER BY timestamp DESC';

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[AuditLog] Error fetching compliance report:', err);
                    return reject(err);
                }

                const logs = rows.map(row => ({
                    ...row,
                    before_data: row.before_data ? JSON.parse(row.before_data) : null,
                    after_data: row.after_data ? JSON.parse(row.after_data) : null,
                    compliance_tags: row.compliance_tags ? JSON.parse(row.compliance_tags) : [],
                    metadata: row.metadata ? JSON.parse(row.metadata) : {}
                }));

                resolve(logs);
            });
        });
    }
}

module.exports = new AuditLogService();




