const db = require('../database');

/**
 * Audit Export Service
 * Step 9.7: Export audit logs for compliance (CSV/JSON).
 */
const AuditExportService = {
    /**
     * Export decisions audit log.
     * @param {Object} options
     * @param {string} options.organizationId - Org ID (or 'SUPERADMIN_BYPASS')
     * @param {string} [options.format] - 'json' or 'csv'
     * @param {boolean} [options.includeArchived] - Include archived records
     * @returns {Promise<{data: Array|string, format: string}>}
     */
    exportDecisions: async (options) => {
        const { organizationId, format = 'json', includeArchived = false } = options;

        let sql = `SELECT 
            ad.id, ad.proposal_id, ad.organization_id, ad.correlation_id,
            ad.decision, ad.decided_by_user_id, ad.decision_reason,
            ad.action_type, ad.scope, ad.created_at, ad.archived_at,
            u.email as user_email, u.first_name, u.last_name
        FROM action_decisions ad
        LEFT JOIN users u ON ad.decided_by_user_id = u.id
        WHERE 1=1 `;

        const params = [];

        if (organizationId !== 'SUPERADMIN_BYPASS') {
            sql += ` AND ad.organization_id = ? `;
            params.push(organizationId);
        }

        if (!includeArchived) {
            sql += ` AND ad.archived_at IS NULL `;
        }

        sql += ` ORDER BY ad.created_at DESC`;

        const rows = await new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        if (format === 'csv') {
            return { data: AuditExportService._toCSV(rows), format: 'csv' };
        }

        return { data: rows, format: 'json' };
    },

    /**
     * Export executions audit log.
     * @param {Object} options
     * @param {string} options.organizationId - Org ID (or 'SUPERADMIN_BYPASS')
     * @param {string} [options.format] - 'json' or 'csv'
     * @param {boolean} [options.includeArchived] - Include archived records
     * @returns {Promise<{data: Array|string, format: string}>}
     */
    exportExecutions: async (options) => {
        const { organizationId, format = 'json', includeArchived = false } = options;

        let sql = `SELECT 
            id, decision_id, proposal_id, action_type, organization_id, correlation_id,
            executed_by, status, error_code, error_message, duration_ms, created_at, archived_at
        FROM action_executions
        WHERE 1=1 `;

        const params = [];

        if (organizationId !== 'SUPERADMIN_BYPASS') {
            sql += ` AND organization_id = ? `;
            params.push(organizationId);
        }

        if (!includeArchived) {
            sql += ` AND archived_at IS NULL `;
        }

        sql += ` ORDER BY created_at DESC`;

        const rows = await new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        if (format === 'csv') {
            return { data: AuditExportService._toCSV(rows), format: 'csv' };
        }

        return { data: rows, format: 'json' };
    },

    /**
     * Convert rows to CSV string.
     * @private
     */
    _toCSV: (rows) => {
        if (!rows || rows.length === 0) {
            return '';
        }

        const headers = Object.keys(rows[0]);
        const csvLines = [headers.join(',')];

        for (const row of rows) {
            const values = headers.map(h => {
                let val = row[h];
                if (val === null || val === undefined) {
                    return '';
                }
                val = String(val);
                // Escape quotes and wrap in quotes if contains comma or quote
                if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                    val = '"' + val.replace(/"/g, '""') + '"';
                }
                return val;
            });
            csvLines.push(values.join(','));
        }

        return csvLines.join('\n');
    }
};

module.exports = AuditExportService;
