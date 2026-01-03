/**
 * Multi-Framework Audit Service
 * 
 * Provides comprehensive audit logging for all multi-framework assessment actions.
 * Logs all changes with actor information, timestamps, and diff calculation.
 */

import db from '../database.js';



// ============================================
// ACTION CONSTANTS
// ============================================

const ACTIONS = {
    // Assessment lifecycle
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
    RESTORE: 'RESTORE',
    
    // Workflow
    SUBMIT_REVIEW: 'SUBMIT_REVIEW',
    APPROVE: 'APPROVE',
    REJECT: 'REJECT',
    ASSIGN_REVIEWER: 'ASSIGN_REVIEWER',
    COMPLETE_REVIEW: 'COMPLETE_REVIEW',
    
    // Collaboration
    ADD_COMMENT: 'ADD_COMMENT',
    RESOLVE_COMMENT: 'RESOLVE_COMMENT',
    
    // Export/Import
    EXPORT_PDF: 'EXPORT_PDF',
    EXPORT_EXCEL: 'EXPORT_EXCEL',
    IMPORT_PDF: 'IMPORT_PDF',
    
    // Reports
    GENERATE_REPORT: 'GENERATE_REPORT',
    GENERATE_INITIATIVES: 'GENERATE_INITIATIVES',
    
    // Security
    PERMISSION_CHANGE: 'PERMISSION_CHANGE',
    
    // System
    BULK_UPDATE: 'BULK_UPDATE',
    DATA_MIGRATION: 'DATA_MIGRATION',
    SCORE_RECALCULATE: 'SCORE_RECALCULATE',
};

const ACTION_CATEGORIES = {
    ASSESSMENT: ['CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'BULK_UPDATE', 'SCORE_RECALCULATE'],
    WORKFLOW: ['SUBMIT_REVIEW', 'APPROVE', 'REJECT', 'ASSIGN_REVIEWER', 'COMPLETE_REVIEW'],
    COLLABORATION: ['ADD_COMMENT', 'RESOLVE_COMMENT'],
    EXPORT: ['EXPORT_PDF', 'EXPORT_EXCEL'],
    IMPORT: ['IMPORT_PDF'],
    REPORT: ['GENERATE_REPORT'],
    INITIATIVE: ['GENERATE_INITIATIVES'],
    SECURITY: ['PERMISSION_CHANGE'],
    SYSTEM: ['DATA_MIGRATION'],
};

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Log an audit action
 * @param {Object} params - Audit parameters
 * @returns {Promise<number>} Audit log ID
 */
async function logAction({
    assessmentId,
    framework,
    action,
    actorId,
    oldData = null,
    newData = null,
    entityType = 'ASSESSMENT',
    entityId = null,
    entityName = null,
    notes = null,
    tags = [],
    ipAddress = null,
    userAgent = null,
    requestId = null,
}) {
    try {
        // Calculate diff if both old and new data provided
        let diff = null;
        if (oldData && newData) {
            diff = calculateDiff(oldData, newData);
        }

        // Get actor details
        let actorName = null;
        let actorEmail = null;
        let actorRole = null;
        
        if (actorId) {
            const actorResult = await db.query(
                `SELECT first_name || ' ' || last_name AS name, email, role 
                 FROM users WHERE id = $1`,
                [actorId]
            );
            if (actorResult.rows.length > 0) {
                actorName = actorResult.rows[0].name;
                actorEmail = actorResult.rows[0].email;
                actorRole = actorResult.rows[0].role;
            }
        }

        // Get project and organization from assessment
        let projectId = null;
        let organizationId = null;
        
        if (assessmentId) {
            const assessmentResult = await db.query(
                'SELECT project_id, organization_id FROM multi_framework_assessments WHERE id = $1',
                [assessmentId]
            );
            if (assessmentResult.rows.length > 0) {
                projectId = assessmentResult.rows[0].project_id;
                organizationId = assessmentResult.rows[0].organization_id;
            }
        }

        // Determine action category
        const actionCategory = Object.entries(ACTION_CATEGORIES).find(
            ([, actions]) => actions.includes(action)
        )?.[0] || 'ASSESSMENT';

        // Insert audit log
        const result = await db.query(`
            INSERT INTO multi_framework_audit_log (
                assessment_id, framework, action, action_category,
                actor_id, actor_name, actor_email, actor_role,
                old_data, new_data, diff,
                entity_type, entity_id, entity_name,
                project_id, organization_id,
                ip_address, user_agent, request_id,
                notes, tags,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW())
            RETURNING id
        `, [
            assessmentId,
            framework,
            action,
            actionCategory,
            actorId,
            actorName,
            actorEmail,
            actorRole,
            oldData ? JSON.stringify(oldData) : null,
            newData ? JSON.stringify(newData) : null,
            diff ? JSON.stringify(diff) : null,
            entityType,
            entityId || assessmentId,
            entityName,
            projectId,
            organizationId,
            ipAddress,
            userAgent,
            requestId,
            notes,
            JSON.stringify(tags),
        ]);

        return result.rows[0].id;
    } catch (error) {
        console.error('[AuditService] Failed to log action:', error);
        // Don't throw - audit logging should not break main operations
        return null;
    }
}

/**
 * Calculate difference between old and new data
 * @param {Object} oldData - Previous data state
 * @param {Object} newData - New data state
 * @returns {Object} Diff object
 */
function calculateDiff(oldData, newData) {
    const diff = {
        added: {},
        removed: {},
        changed: {},
    };

    // Find added and changed keys
    Object.keys(newData).forEach(key => {
        if (!(key in oldData)) {
            diff.added[key] = newData[key];
        } else if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
            diff.changed[key] = {
                old: oldData[key],
                new: newData[key],
            };
        }
    });

    // Find removed keys
    Object.keys(oldData).forEach(key => {
        if (!(key in newData)) {
            diff.removed[key] = oldData[key];
        }
    });

    return diff;
}

// ============================================
// QUERY FUNCTIONS
// ============================================

/**
 * Get audit history for an assessment
 * @param {string} assessmentId - Assessment UUID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Audit log entries
 */
async function getAssessmentAuditHistory(assessmentId, options = {}) {
    const { limit = 100, offset = 0, action = null, actorId = null } = options;

    let query = `
        SELECT 
            al.*,
            aa.name AS action_name,
            aa.severity AS action_severity
        FROM multi_framework_audit_log al
        LEFT JOIN multi_framework_audit_actions aa ON al.action = aa.code
        WHERE al.assessment_id = $1
    `;
    const params = [assessmentId];
    let paramIndex = 2;

    if (action) {
        query += ` AND al.action = $${paramIndex}`;
        params.push(action);
        paramIndex++;
    }

    if (actorId) {
        query += ` AND al.actor_id = $${paramIndex}`;
        params.push(actorId);
        paramIndex++;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
}

/**
 * Get audit history for a project
 * @param {string} projectId - Project UUID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Audit log entries
 */
async function getProjectAuditHistory(projectId, options = {}) {
    const { limit = 100, offset = 0, framework = null } = options;

    let query = `
        SELECT 
            al.*,
            mfa.name AS assessment_name,
            aa.name AS action_name,
            aa.severity AS action_severity
        FROM multi_framework_audit_log al
        LEFT JOIN multi_framework_assessments mfa ON al.assessment_id = mfa.id
        LEFT JOIN multi_framework_audit_actions aa ON al.action = aa.code
        WHERE al.project_id = $1
    `;
    const params = [projectId];
    let paramIndex = 2;

    if (framework) {
        query += ` AND al.framework = $${paramIndex}`;
        params.push(framework);
        paramIndex++;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
}

/**
 * Get audit history for an organization
 * @param {string} organizationId - Organization UUID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Audit log entries
 */
async function getOrganizationAuditHistory(organizationId, options = {}) {
    const { limit = 100, offset = 0, startDate = null, endDate = null } = options;

    let query = `
        SELECT 
            al.*,
            mfa.name AS assessment_name,
            p.name AS project_name,
            aa.name AS action_name,
            aa.severity AS action_severity
        FROM multi_framework_audit_log al
        LEFT JOIN multi_framework_assessments mfa ON al.assessment_id = mfa.id
        LEFT JOIN projects p ON al.project_id = p.id
        LEFT JOIN multi_framework_audit_actions aa ON al.action = aa.code
        WHERE al.organization_id = $1
    `;
    const params = [organizationId];
    let paramIndex = 2;

    if (startDate) {
        query += ` AND al.created_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
    }

    if (endDate) {
        query += ` AND al.created_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
}

/**
 * Get audit summary statistics
 * @param {Object} filter - Filter options
 * @returns {Promise<Object>} Summary statistics
 */
async function getAuditSummary(filter = {}) {
    const { organizationId, projectId, framework, startDate, endDate } = filter;

    let whereClause = '1=1';
    const params = [];
    let paramIndex = 1;

    if (organizationId) {
        whereClause += ` AND organization_id = $${paramIndex}`;
        params.push(organizationId);
        paramIndex++;
    }

    if (projectId) {
        whereClause += ` AND project_id = $${paramIndex}`;
        params.push(projectId);
        paramIndex++;
    }

    if (framework) {
        whereClause += ` AND framework = $${paramIndex}`;
        params.push(framework);
        paramIndex++;
    }

    if (startDate) {
        whereClause += ` AND created_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
    }

    if (endDate) {
        whereClause += ` AND created_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
    }

    const result = await db.query(`
        SELECT 
            COUNT(*) AS total_actions,
            COUNT(DISTINCT actor_id) AS unique_actors,
            COUNT(DISTINCT assessment_id) AS affected_assessments,
            action_category,
            COUNT(*) AS category_count
        FROM multi_framework_audit_log
        WHERE ${whereClause}
        GROUP BY action_category
    `, params);

    const summary = {
        totalActions: 0,
        uniqueActors: 0,
        affectedAssessments: 0,
        byCategory: {},
    };

    result.rows.forEach(row => {
        summary.totalActions = parseInt(row.total_actions) || summary.totalActions;
        summary.uniqueActors = parseInt(row.unique_actors) || summary.uniqueActors;
        summary.affectedAssessments = parseInt(row.affected_assessments) || summary.affectedAssessments;
        summary.byCategory[row.action_category] = parseInt(row.category_count);
    });

    return summary;
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Log assessment creation
 */
async function logCreate(assessmentId, framework, actorId, data, options = {}) {
    return logAction({
        assessmentId,
        framework,
        action: ACTIONS.CREATE,
        actorId,
        newData: data,
        ...options,
    });
}

/**
 * Log assessment update
 */
async function logUpdate(assessmentId, framework, actorId, oldData, newData, options = {}) {
    return logAction({
        assessmentId,
        framework,
        action: ACTIONS.UPDATE,
        actorId,
        oldData,
        newData,
        ...options,
    });
}

/**
 * Log assessment deletion
 */
async function logDelete(assessmentId, framework, actorId, data, options = {}) {
    return logAction({
        assessmentId,
        framework,
        action: ACTIONS.DELETE,
        actorId,
        oldData: data,
        ...options,
    });
}

/**
 * Log workflow state change
 */
async function logWorkflowChange(assessmentId, framework, actorId, action, details = {}, options = {}) {
    return logAction({
        assessmentId,
        framework,
        action,
        actorId,
        newData: details,
        ...options,
    });
}

/**
 * Log report generation
 */
async function logReportGeneration(assessmentId, framework, actorId, reportId, reportType, options = {}) {
    return logAction({
        assessmentId,
        framework,
        action: ACTIONS.GENERATE_REPORT,
        actorId,
        entityType: 'REPORT',
        entityId: reportId,
        newData: { reportType },
        ...options,
    });
}

/**
 * Log initiative generation
 */
async function logInitiativeGeneration(assessmentId, framework, actorId, initiativeCount, options = {}) {
    return logAction({
        assessmentId,
        framework,
        action: ACTIONS.GENERATE_INITIATIVES,
        actorId,
        newData: { initiativeCount },
        ...options,
    });
}

/**
 * Log PDF export
 */
async function logPDFExport(assessmentId, framework, actorId, options = {}) {
    return logAction({
        assessmentId,
        framework,
        action: ACTIONS.EXPORT_PDF,
        actorId,
        ...options,
    });
}

/**
 * Log PDF import
 */
async function logPDFImport(assessmentId, framework, actorId, fileName, confidence, options = {}) {
    return logAction({
        assessmentId,
        framework,
        action: ACTIONS.IMPORT_PDF,
        actorId,
        newData: { fileName, confidence },
        ...options,
    });
}

// ============================================
// EXPORTS
// ============================================

export default {
    // Constants
    ACTIONS,
    ACTION_CATEGORIES,
    
    // Core functions
    logAction,
    calculateDiff,
    
    // Query functions
    getAssessmentAuditHistory,
    getProjectAuditHistory,
    getOrganizationAuditHistory,
    getAuditSummary,
    
    // Convenience functions
    logCreate,
    logUpdate,
    logDelete,
    logWorkflowChange,
    logReportGeneration,
    logInitiativeGeneration,
    logPDFExport,
    logPDFImport,
};








