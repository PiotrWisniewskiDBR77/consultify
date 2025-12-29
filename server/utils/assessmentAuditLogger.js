/**
 * Assessment Audit Logger
 * Logs all assessment-related actions for compliance
 */

const defaultDb = require('../database');
const { v4: defaultUuidv4 } = require('uuid');

class AssessmentAuditLogger {
    constructor() {
        this.db = defaultDb;
        this.uuidv4 = defaultUuidv4;
    }

    /**
     * Inject dependencies for testing
     * @param {Object} deps 
     */
    setDependencies(deps) {
        if (deps.db) this.db = deps.db;
        if (deps.uuidv4) this.uuidv4 = deps.uuidv4;
    }

    /**
     * Log assessment action
     * @param {Object} params - Audit parameters
     */
    async log({
        userId,
        organizationId,
        action,
        resourceType,
        resourceId,
        details = {},
        ipAddress,
        userAgent
    }) {
        try {
            const auditId = this.uuidv4();

            const sql = `
                INSERT INTO audit_logs (
                    id, user_id, organization_id,
                    action, resource_type, resource_id,
                    details, ip_address, user_agent,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `;

            await new Promise((resolve, reject) => {
                this.db.run(sql, [
                    auditId,
                    userId,
                    organizationId,
                    action,
                    resourceType,
                    resourceId,
                    JSON.stringify(details),
                    ipAddress,
                    userAgent
                ], function (err) {
                    if (err) return reject(err);
                    resolve();
                });
            });

            return auditId;
        } catch (error) {
            console.error('[AuditLog] Error logging assessment action:', error);
            // Non-blocking - don't fail the request if audit fails
        }
    }

    /**
     * Log assessment creation
     */
    async logCreation(req, assessmentId, assessmentType) {
        return this.log({
            userId: req.user.id,
            organizationId: req.user.organizationId,
            action: 'ASSESSMENT_CREATED',
            resourceType: assessmentType,
            resourceId: assessmentId,
            details: { assessmentType },
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });
    }

    /**
     * Log file upload
     */
    async logFileUpload(req, fileId, fileName, fileSize) {
        return this.log({
            userId: req.user.id,
            organizationId: req.user.organizationId,
            action: 'FILE_UPLOADED',
            resourceType: 'ASSESSMENT_FILE',
            resourceId: fileId,
            details: { fileName, fileSize },
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });
    }

    /**
     * Log assessment deletion
     */
    async logDeletion(req, assessmentId, assessmentType) {
        return this.log({
            userId: req.user.id,
            organizationId: req.user.organizationId,
            action: 'ASSESSMENT_DELETED',
            resourceType: assessmentType,
            resourceId: assessmentId,
            details: { assessmentType },
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });
    }
}

// Export singleton instance
module.exports = new AssessmentAuditLogger();


