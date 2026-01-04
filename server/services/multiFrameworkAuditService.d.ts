declare namespace _default {
    export { ACTIONS };
    export { ACTION_CATEGORIES };
    export { logAction };
    export { calculateDiff };
    export { getAssessmentAuditHistory };
    export { getProjectAuditHistory };
    export { getOrganizationAuditHistory };
    export { getAuditSummary };
    export { logCreate };
    export { logUpdate };
    export { logDelete };
    export { logWorkflowChange };
    export { logReportGeneration };
    export { logInitiativeGeneration };
    export { logPDFExport };
    export { logPDFImport };
}
export default _default;
declare namespace ACTIONS {
    let CREATE: string;
    let UPDATE: string;
    let DELETE: string;
    let RESTORE: string;
    let SUBMIT_REVIEW: string;
    let APPROVE: string;
    let REJECT: string;
    let ASSIGN_REVIEWER: string;
    let COMPLETE_REVIEW: string;
    let ADD_COMMENT: string;
    let RESOLVE_COMMENT: string;
    let EXPORT_PDF: string;
    let EXPORT_EXCEL: string;
    let IMPORT_PDF: string;
    let GENERATE_REPORT: string;
    let GENERATE_INITIATIVES: string;
    let PERMISSION_CHANGE: string;
    let BULK_UPDATE: string;
    let DATA_MIGRATION: string;
    let SCORE_RECALCULATE: string;
}
declare namespace ACTION_CATEGORIES {
    let ASSESSMENT: string[];
    let WORKFLOW: string[];
    let COLLABORATION: string[];
    let EXPORT: string[];
    let IMPORT: string[];
    let REPORT: string[];
    let INITIATIVE: string[];
    let SECURITY: string[];
    let SYSTEM: string[];
}
/**
 * Log an audit action
 * @param {Object} params - Audit parameters
 * @returns {Promise<number>} Audit log ID
 */
declare function logAction({ assessmentId, framework, action, actorId, oldData, newData, entityType, entityId, entityName, notes, tags, ipAddress, userAgent, requestId, }: Object): Promise<number>;
/**
 * Calculate difference between old and new data
 * @param {Object} oldData - Previous data state
 * @param {Object} newData - New data state
 * @returns {Object} Diff object
 */
declare function calculateDiff(oldData: Object, newData: Object): Object;
/**
 * Get audit history for an assessment
 * @param {string} assessmentId - Assessment UUID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Audit log entries
 */
declare function getAssessmentAuditHistory(assessmentId: string, options?: Object): Promise<any[]>;
/**
 * Get audit history for a project
 * @param {string} projectId - Project UUID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Audit log entries
 */
declare function getProjectAuditHistory(projectId: string, options?: Object): Promise<any[]>;
/**
 * Get audit history for an organization
 * @param {string} organizationId - Organization UUID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Audit log entries
 */
declare function getOrganizationAuditHistory(organizationId: string, options?: Object): Promise<any[]>;
/**
 * Get audit summary statistics
 * @param {Object} filter - Filter options
 * @returns {Promise<Object>} Summary statistics
 */
declare function getAuditSummary(filter?: Object): Promise<Object>;
/**
 * Log assessment creation
 */
declare function logCreate(assessmentId: any, framework: any, actorId: any, data: any, options?: {}): Promise<number>;
/**
 * Log assessment update
 */
declare function logUpdate(assessmentId: any, framework: any, actorId: any, oldData: any, newData: any, options?: {}): Promise<number>;
/**
 * Log assessment deletion
 */
declare function logDelete(assessmentId: any, framework: any, actorId: any, data: any, options?: {}): Promise<number>;
/**
 * Log workflow state change
 */
declare function logWorkflowChange(assessmentId: any, framework: any, actorId: any, action: any, details?: {}, options?: {}): Promise<number>;
/**
 * Log report generation
 */
declare function logReportGeneration(assessmentId: any, framework: any, actorId: any, reportId: any, reportType: any, options?: {}): Promise<number>;
/**
 * Log initiative generation
 */
declare function logInitiativeGeneration(assessmentId: any, framework: any, actorId: any, initiativeCount: any, options?: {}): Promise<number>;
/**
 * Log PDF export
 */
declare function logPDFExport(assessmentId: any, framework: any, actorId: any, options?: {}): Promise<number>;
/**
 * Log PDF import
 */
declare function logPDFImport(assessmentId: any, framework: any, actorId: any, fileName: any, confidence: any, options?: {}): Promise<number>;
//# sourceMappingURL=multiFrameworkAuditService.d.ts.map