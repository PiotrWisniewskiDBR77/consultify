/**
 * Legal Export Service
 * 
 * Provides CSV/JSON export functionality for compliance audits.
 * Supports exports for:
 * - User/organization acceptance records
 * - Legal event audit log
 * 
 * Required for:
 * - Enterprise procurement due diligence
 * - ISO/SOC2 audits
 * - Customer legal reviews
 */

const db = require('../database');
const { LegalEventLogger } = require('./legalEventLogger');

const LegalExportService = {
    /**
     * Export acceptance records
     * 
     * @param {Object} filters - Export filters
     * @param {string} [filters.organizationId] - Filter by organization
     * @param {string} [filters.userId] - Filter by user
     * @param {string} [filters.docType] - Filter by document type
     * @param {string} [filters.dateFrom] - Start date (ISO string)
     * @param {string} [filters.dateTo] - End date (ISO string)
     * @param {string} [filters.format] - 'csv' or 'json' (default: 'json')
     * @returns {Promise<Object>} Export data with format metadata
     */
    exportAcceptances: async ({ organizationId, userId, docType, dateFrom, dateTo, format = 'json' }) => {
        let sql = `
            SELECT 
                la.id as acceptance_id,
                la.organization_id,
                la.user_id,
                u.email as user_email,
                u.first_name,
                u.last_name,
                la.doc_type,
                la.version,
                ld.title as document_title,
                la.accepted_at,
                la.accepted_ip,
                la.acceptance_scope,
                la.evidence_json
            FROM legal_acceptances la
            LEFT JOIN users u ON la.user_id = u.id
            LEFT JOIN legal_documents ld ON la.doc_type = ld.doc_type AND la.version = ld.version
            WHERE 1=1
        `;
        const params = [];

        if (organizationId) {
            sql += ' AND la.organization_id = ?';
            params.push(organizationId);
        }

        if (userId) {
            sql += ' AND la.user_id = ?';
            params.push(userId);
        }

        if (docType) {
            sql += ' AND la.doc_type = ?';
            params.push(docType);
        }

        if (dateFrom) {
            sql += ' AND la.accepted_at >= ?';
            params.push(dateFrom);
        }

        if (dateTo) {
            sql += ' AND la.accepted_at <= ?';
            params.push(dateTo);
        }

        sql += ' ORDER BY la.accepted_at DESC';

        const rows = await new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });

        if (format === 'csv') {
            return LegalExportService.toCSV(rows, [
                'acceptance_id', 'organization_id', 'user_id', 'user_email',
                'first_name', 'last_name', 'doc_type', 'version', 'document_title',
                'accepted_at', 'accepted_ip', 'acceptance_scope'
            ]);
        }

        return {
            format: 'json',
            count: rows.length,
            exportedAt: new Date().toISOString(),
            filters: { organizationId, userId, docType, dateFrom, dateTo },
            data: rows
        };
    },

    /**
     * Export audit log events
     * 
     * @param {Object} filters - Export filters
     * @returns {Promise<Object>} Export data
     */
    exportAuditLog: async ({ organizationId, userId, documentId, eventTypes, dateFrom, dateTo, format = 'json' }) => {
        const events = await LegalEventLogger.getEvents({
            organizationId,
            userId,
            documentId,
            eventTypes,
            dateFrom,
            dateTo,
            limit: 10000 // Higher limit for exports
        });

        // Parse metadata JSON for each event
        const parsedEvents = events.map(e => ({
            ...e,
            metadata: typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata
        }));

        if (format === 'csv') {
            return LegalExportService.toCSV(events, [
                'id', 'event_type', 'document_id', 'document_version',
                'user_id', 'organization_id', 'performed_by', 'created_at', 'metadata'
            ]);
        }

        return {
            format: 'json',
            count: parsedEvents.length,
            exportedAt: new Date().toISOString(),
            filters: { organizationId, userId, documentId, eventTypes, dateFrom, dateTo },
            data: parsedEvents
        };
    },

    /**
     * Convert rows to CSV format
     * 
     * @param {Array} rows - Data rows
     * @param {Array} columns - Column names
     * @returns {Object} CSV export object
     */
    toCSV: (rows, columns) => {
        const escape = (val) => {
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const header = columns.join(',');
        const lines = rows.map(row =>
            columns.map(col => escape(row[col])).join(',')
        );

        return {
            format: 'csv',
            count: rows.length,
            exportedAt: new Date().toISOString(),
            contentType: 'text/csv',
            data: [header, ...lines].join('\n')
        };
    },

    /**
     * Get compliance summary for an organization
     * 
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Object>} Compliance summary
     */
    getComplianceSummary: async (organizationId) => {
        // Get all users in org
        const users = await new Promise((resolve, reject) => {
            db.all(
                'SELECT id, email, first_name, last_name, role FROM users WHERE organization_id = ?',
                [organizationId],
                (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });

        // Get active documents
        const activeDocs = await new Promise((resolve, reject) => {
            db.all(
                'SELECT doc_type, version, title FROM legal_documents WHERE is_active = 1',
                [],
                (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });

        // Get all acceptances for org
        const acceptances = await new Promise((resolve, reject) => {
            db.all(
                `SELECT user_id, doc_type, version, accepted_at 
                 FROM legal_acceptances 
                 WHERE organization_id = ? OR user_id IN (SELECT id FROM users WHERE organization_id = ?)`,
                [organizationId, organizationId],
                (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });

        // Build acceptance map
        const acceptanceMap = {};
        acceptances.forEach(a => {
            acceptanceMap[`${a.user_id}:${a.doc_type}:${a.version}`] = a.accepted_at;
        });

        // Calculate compliance stats
        let totalRequired = users.length * activeDocs.length;
        let totalAccepted = 0;

        users.forEach(user => {
            activeDocs.forEach(doc => {
                if (acceptanceMap[`${user.id}:${doc.doc_type}:${doc.version}`]) {
                    totalAccepted++;
                }
            });
        });

        const complianceRate = totalRequired > 0
            ? Math.round((totalAccepted / totalRequired) * 100)
            : 100;

        return {
            organizationId,
            generatedAt: new Date().toISOString(),
            totalUsers: users.length,
            totalDocuments: activeDocs.length,
            totalRequiredAcceptances: totalRequired,
            totalAcceptances: totalAccepted,
            complianceRate,
            documents: activeDocs.map(doc => ({
                docType: doc.doc_type,
                version: doc.version,
                title: doc.title
            })),
            isFullyCompliant: complianceRate === 100
        };
    }
};

module.exports = LegalExportService;
