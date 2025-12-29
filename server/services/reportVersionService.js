/**
 * Report Version Service
 * 
 * Version control for Management Reports.
 * Tracks changes, enables comparisons, and supports version restoration.
 * 
 * PMO Standards:
 * - Configuration Management (PRINCE2)
 * - Document Control (ISO 21500)
 * - Change Management (PMBOK 7)
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// Database helpers
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

const ReportVersionService = {
    /**
     * Create a new version of a report
     * Called automatically on significant changes
     * 
     * @param {string} reportId - Report ID
     * @param {Object} content - Report content to snapshot
     * @param {string} userId - User creating version
     * @param {string} changeSummary - Description of changes
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Created version
     */
    createVersion: async (reportId, content, userId, changeSummary = null, options = {}) => {
        const report = await dbGet('SELECT * FROM management_reports WHERE id = ?', [reportId]);
        if (!report) {
            throw new Error('Report not found');
        }

        // Get current version number
        const currentVersion = await dbGet(
            'SELECT MAX(version_number) as max_version FROM management_report_versions WHERE report_id = ?',
            [reportId]
        );
        
        const newVersionNumber = (currentVersion?.max_version || 0) + 1;
        
        // Calculate version label based on type
        const versionLabel = ReportVersionService._calculateVersionLabel(
            newVersionNumber,
            options.versionType || 'minor'
        );

        const id = uuidv4();
        
        // Parse content if it's a string
        let contentJson = content;
        if (typeof content === 'string') {
            try {
                contentJson = JSON.parse(content);
            } catch (e) {
                contentJson = content;
            }
        }

        await dbRun(`
            INSERT INTO management_report_versions 
            (id, report_id, version_number, version_label, content, ai_narrative, ai_warnings, change_summary, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            id,
            reportId,
            newVersionNumber,
            versionLabel,
            JSON.stringify(contentJson),
            report.ai_narrative,
            report.ai_warnings,
            changeSummary,
            userId
        ]);

        // Update report's current version
        await dbRun(`
            UPDATE management_reports 
            SET current_version = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [newVersionNumber, reportId]);

        // Log audit
        const ReportAuditService = require('./reportAuditService');
        await ReportAuditService.log(reportId, 'VERSION_CREATED', userId, {
            versionNumber: newVersionNumber,
            versionLabel,
            changeSummary
        });

        return {
            id,
            reportId,
            versionNumber: newVersionNumber,
            versionLabel,
            changeSummary,
            createdBy: userId,
            createdAt: new Date().toISOString()
        };
    },

    /**
     * Get all versions of a report
     * 
     * @param {string} reportId - Report ID
     * @param {Object} options - Pagination options
     * @returns {Promise<Object>} Versions list
     */
    getVersions: async (reportId, options = {}) => {
        const { limit = 50, offset = 0, includeContent = false } = options;

        const contentSelect = includeContent ? ', content' : '';

        const versions = await dbAll(`
            SELECT mrv.id, mrv.report_id, mrv.version_number, mrv.version_label, 
                   mrv.change_summary, mrv.created_by, mrv.created_at,
                   u.first_name || ' ' || u.last_name as created_by_name
                   ${contentSelect}
            FROM management_report_versions mrv
            LEFT JOIN users u ON mrv.created_by = u.id
            WHERE mrv.report_id = ?
            ORDER BY mrv.version_number DESC
            LIMIT ? OFFSET ?
        `, [reportId, limit, offset]);

        const countResult = await dbGet(
            'SELECT COUNT(*) as total FROM management_report_versions WHERE report_id = ?',
            [reportId]
        );

        return {
            versions: versions.map(v => ({
                id: v.id,
                reportId: v.report_id,
                versionNumber: v.version_number,
                versionLabel: v.version_label,
                changeSummary: v.change_summary,
                createdBy: v.created_by,
                createdByName: v.created_by_name,
                createdAt: v.created_at,
                ...(includeContent && { content: JSON.parse(v.content || '{}') })
            })),
            total: countResult?.total || 0,
            limit,
            offset
        };
    },

    /**
     * Get a specific version
     * 
     * @param {string} reportId - Report ID
     * @param {number} versionNumber - Version number to retrieve
     * @returns {Promise<Object>} Version data
     */
    getVersion: async (reportId, versionNumber) => {
        const version = await dbGet(`
            SELECT mrv.*, u.first_name || ' ' || u.last_name as created_by_name
            FROM management_report_versions mrv
            LEFT JOIN users u ON mrv.created_by = u.id
            WHERE mrv.report_id = ? AND mrv.version_number = ?
        `, [reportId, versionNumber]);

        if (!version) {
            throw new Error(`Version ${versionNumber} not found for report ${reportId}`);
        }

        return {
            id: version.id,
            reportId: version.report_id,
            versionNumber: version.version_number,
            versionLabel: version.version_label,
            content: JSON.parse(version.content || '{}'),
            aiNarrative: version.ai_narrative,
            aiWarnings: version.ai_warnings ? JSON.parse(version.ai_warnings) : [],
            changeSummary: version.change_summary,
            createdBy: version.created_by,
            createdByName: version.created_by_name,
            createdAt: version.created_at
        };
    },

    /**
     * Get the latest version
     * 
     * @param {string} reportId - Report ID
     * @returns {Promise<Object>} Latest version
     */
    getCurrentVersion: async (reportId) => {
        const version = await dbGet(`
            SELECT mrv.*, u.first_name || ' ' || u.last_name as created_by_name
            FROM management_report_versions mrv
            LEFT JOIN users u ON mrv.created_by = u.id
            WHERE mrv.report_id = ?
            ORDER BY mrv.version_number DESC
            LIMIT 1
        `, [reportId]);

        if (!version) {
            return null;
        }

        return {
            id: version.id,
            reportId: version.report_id,
            versionNumber: version.version_number,
            versionLabel: version.version_label,
            content: JSON.parse(version.content || '{}'),
            aiNarrative: version.ai_narrative,
            changeSummary: version.change_summary,
            createdBy: version.created_by,
            createdByName: version.created_by_name,
            createdAt: version.created_at
        };
    },

    /**
     * Compare two versions
     * 
     * @param {string} reportId - Report ID
     * @param {number} v1 - First version number
     * @param {number} v2 - Second version number
     * @returns {Promise<Object>} Comparison result
     */
    compareVersions: async (reportId, v1, v2) => {
        const [version1, version2] = await Promise.all([
            ReportVersionService.getVersion(reportId, v1),
            ReportVersionService.getVersion(reportId, v2)
        ]);

        const changes = ReportVersionService._compareContents(
            version1.content,
            version2.content
        );

        const summary = ReportVersionService._generateChangeSummary(changes);

        return {
            version1: {
                versionNumber: version1.versionNumber,
                versionLabel: version1.versionLabel,
                createdAt: version1.createdAt,
                createdByName: version1.createdByName
            },
            version2: {
                versionNumber: version2.versionNumber,
                versionLabel: version2.versionLabel,
                createdAt: version2.createdAt,
                createdByName: version2.createdByName
            },
            changes,
            summary
        };
    },

    /**
     * Restore a previous version
     * Creates a new version with the old content
     * 
     * @param {string} reportId - Report ID
     * @param {number} versionNumber - Version to restore
     * @param {string} userId - User restoring
     * @returns {Promise<Object>} New version (restored)
     */
    restoreVersion: async (reportId, versionNumber, userId) => {
        const report = await dbGet('SELECT * FROM management_reports WHERE id = ?', [reportId]);
        if (!report) {
            throw new Error('Report not found');
        }

        if (report.locked_at) {
            throw new Error('Cannot restore version on a locked report');
        }

        const versionToRestore = await ReportVersionService.getVersion(reportId, versionNumber);

        // Create new version with restored content
        const newVersion = await ReportVersionService.createVersion(
            reportId,
            versionToRestore.content,
            userId,
            `Restored from version ${versionNumber} (${versionToRestore.versionLabel})`,
            { versionType: 'minor' }
        );

        // Update report content
        await dbRun(`
            UPDATE management_reports 
            SET content = ?, 
                ai_narrative = ?,
                ai_warnings = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            JSON.stringify(versionToRestore.content),
            versionToRestore.aiNarrative,
            JSON.stringify(versionToRestore.aiWarnings || []),
            reportId
        ]);

        return {
            ...newVersion,
            restoredFrom: versionNumber,
            restoredFromLabel: versionToRestore.versionLabel
        };
    },

    /**
     * Increment version number
     * 
     * @param {string} reportId - Report ID
     * @param {string} type - 'major', 'minor', or 'patch'
     * @returns {Promise<string>} New version label
     */
    incrementVersion: async (reportId, type = 'minor') => {
        const currentVersion = await ReportVersionService.getCurrentVersion(reportId);
        
        if (!currentVersion) {
            return '1.0';
        }

        const label = currentVersion.versionLabel || '1.0';
        const parts = label.split('.').map(Number);
        
        switch (type) {
            case 'major':
                parts[0] = (parts[0] || 1) + 1;
                parts[1] = 0;
                if (parts.length > 2) parts[2] = 0;
                break;
            case 'minor':
                parts[1] = (parts[1] || 0) + 1;
                if (parts.length > 2) parts[2] = 0;
                break;
            case 'patch':
                if (parts.length < 3) parts.push(1);
                else parts[2] = (parts[2] || 0) + 1;
                break;
        }

        return parts.join('.');
    },

    /**
     * Calculate version label from number
     * @private
     */
    _calculateVersionLabel: (versionNumber, type) => {
        // Simple: 1 -> "1.0", 2 -> "1.1", etc.
        // Major versions (type='major') reset minor
        const major = Math.floor((versionNumber - 1) / 10) + 1;
        const minor = (versionNumber - 1) % 10;
        return `${major}.${minor}`;
    },

    /**
     * Compare two content objects
     * @private
     */
    _compareContents: (content1, content2, path = '') => {
        const changes = [];
        const allKeys = new Set([
            ...Object.keys(content1 || {}),
            ...Object.keys(content2 || {})
        ]);

        for (const key of allKeys) {
            const currentPath = path ? `${path}.${key}` : key;
            const val1 = content1?.[key];
            const val2 = content2?.[key];

            if (val1 === undefined && val2 !== undefined) {
                changes.push({
                    field: currentPath,
                    type: 'added',
                    newValue: val2
                });
            } else if (val1 !== undefined && val2 === undefined) {
                changes.push({
                    field: currentPath,
                    type: 'removed',
                    oldValue: val1
                });
            } else if (typeof val1 === 'object' && typeof val2 === 'object' && 
                       val1 !== null && val2 !== null && !Array.isArray(val1) && !Array.isArray(val2)) {
                // Recurse into objects
                changes.push(...ReportVersionService._compareContents(val1, val2, currentPath));
            } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
                changes.push({
                    field: currentPath,
                    type: 'modified',
                    oldValue: val1,
                    newValue: val2
                });
            }
        }

        return changes;
    },

    /**
     * Generate summary from changes
     * @private
     */
    _generateChangeSummary: (changes) => {
        const added = changes.filter(c => c.type === 'added').length;
        const removed = changes.filter(c => c.type === 'removed').length;
        const modified = changes.filter(c => c.type === 'modified').length;

        const parts = [];
        if (added > 0) parts.push(`${added} added`);
        if (removed > 0) parts.push(`${removed} removed`);
        if (modified > 0) parts.push(`${modified} modified`);

        if (parts.length === 0) {
            return 'No changes detected';
        }

        return `${parts.join(', ')} (${changes.length} total changes)`;
    },

    /**
     * Snapshot current report state as version
     * Helper to create version from current report data
     * 
     * @param {string} reportId - Report ID
     * @param {string} userId - User ID
     * @param {string} changeSummary - Change description
     * @returns {Promise<Object>} Created version
     */
    snapshotCurrentState: async (reportId, userId, changeSummary = 'Manual snapshot') => {
        const report = await dbGet('SELECT * FROM management_reports WHERE id = ?', [reportId]);
        if (!report) {
            throw new Error('Report not found');
        }

        const content = report.content ? JSON.parse(report.content) : {};
        
        return ReportVersionService.createVersion(reportId, content, userId, changeSummary);
    }
};

module.exports = ReportVersionService;

