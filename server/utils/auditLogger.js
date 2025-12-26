/**
 * Audit Logger
 * Step 9.5: Structured JSON logging for AI Actions observability.
 * Outputs logs in a consistent format for monitoring, debugging, and SOC2 compliance.
 * 
 * PMO Standards Compliance (v2.0):
 * - ISO 21500:2021 - Project Management Guidance
 * - PMI PMBOK 7th Edition - Performance Domains
 * - PRINCE2 - Governance Themes
 * 
 * All PMO audit entries include automatic standards mapping for certification traceability.
 */

const LOG_LEVELS = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
};

/**
 * PMO Standards Mapping for automatic audit enrichment
 * Maps object types to ISO 21500, PMBOK 7, and PRINCE2 terminology
 */
const PMO_STANDARDS_MAPPING = {
    // Governance & Decision Making
    DECISION: {
        iso21500: 'Governance Decision (Clause 4.3.4)',
        pmbok: 'Project Decision / Authorization',
        prince2: 'Project Board Decision',
        domain: 'GOVERNANCE_DECISION_MAKING'
    },
    STAGE_GATE: {
        iso21500: 'Phase Gate (Clause 4.3)',
        pmbok: 'Management Gate / Phase Gate',
        prince2: 'Stage Gate / End Stage Assessment',
        domain: 'GOVERNANCE_DECISION_MAKING'
    },
    ESCALATION: {
        iso21500: 'Escalation (Clause 4.3.4)',
        pmbok: 'Escalation Path',
        prince2: 'Exception Report',
        domain: 'GOVERNANCE_DECISION_MAKING'
    },
    
    // Scope & Change Control
    INITIATIVE: {
        iso21500: 'Work Package (Clause 4.4.4)',
        pmbok: 'Deliverable Group / Work Package',
        prince2: 'Work Package',
        domain: 'SCOPE_CHANGE_CONTROL'
    },
    TASK: {
        iso21500: 'Activity (Clause 4.4.5)',
        pmbok: 'Activity',
        prince2: 'Activity',
        domain: 'SCOPE_CHANGE_CONTROL'
    },
    BASELINE: {
        iso21500: 'Baseline (Clause 4.4.10)',
        pmbok: 'Performance Measurement Baseline',
        prince2: 'Stage Plan (baselined)',
        domain: 'SCOPE_CHANGE_CONTROL'
    },
    CHANGE_REQUEST: {
        iso21500: 'Change Request (Clause 4.4.23)',
        pmbok: 'Change Request',
        prince2: 'Request for Change (RFC)',
        domain: 'SCOPE_CHANGE_CONTROL'
    },
    
    // Schedule & Milestones
    PHASE: {
        iso21500: 'Project Phase (Clause 4.2)',
        pmbok: 'Project Life Cycle Phase',
        prince2: 'Stage (Management Stage)',
        domain: 'SCHEDULE_MILESTONES'
    },
    ROADMAP: {
        iso21500: 'Project Schedule (Clause 4.4.10)',
        pmbok: 'Project Schedule',
        prince2: 'Project Plan / Stage Plan',
        domain: 'SCHEDULE_MILESTONES'
    },
    
    // Resource & Responsibility
    PROJECT_MEMBER: {
        iso21500: 'Project Team (Clause 4.6.2)',
        pmbok: 'Team Performance Domain',
        prince2: 'Organization Theme (Roles)',
        domain: 'RESOURCE_RESPONSIBILITY'
    },
    WORKSTREAM: {
        iso21500: 'Work Breakdown Structure (Clause 4.4.3)',
        pmbok: 'Work Package Grouping',
        prince2: 'Work Package Cluster',
        domain: 'RESOURCE_RESPONSIBILITY'
    },
    ASSIGNMENT: {
        iso21500: 'Resource Assignment (Clause 4.6.2)',
        pmbok: 'Resource Assignment',
        prince2: 'Team Assignment',
        domain: 'RESOURCE_RESPONSIBILITY'
    },
    
    // Performance Monitoring
    PMO_HEALTH: {
        iso21500: 'Project Performance Measurement (Clause 4.4.22)',
        pmbok: 'Project Performance Information',
        prince2: 'Highlight Report',
        domain: 'PERFORMANCE_MONITORING'
    },
    KPI: {
        iso21500: 'Performance Metric (Clause 4.4.22)',
        pmbok: 'Key Performance Indicator',
        prince2: 'Progress Indicator',
        domain: 'PERFORMANCE_MONITORING'
    },
    
    // Benefits Realization
    VALUE_HYPOTHESIS: {
        iso21500: 'Benefits Identification (Clause 4.4.1)',
        pmbok: 'Benefits Documentation',
        prince2: 'Expected Benefits (Business Case)',
        domain: 'BENEFITS_REALIZATION'
    },
    
    // Risk & Issue Management
    RISK: {
        iso21500: 'Risk (Clause 4.8)',
        pmbok: 'Risk',
        prince2: 'Risk',
        domain: 'RISK_ISSUE_MANAGEMENT'
    },
    ISSUE: {
        iso21500: 'Issue (Clause 4.8)',
        pmbok: 'Issue',
        prince2: 'Issue',
        domain: 'RISK_ISSUE_MANAGEMENT'
    }
};

/**
 * Logs a structured JSON audit event.
 * @param {Object} params - Log parameters
 * @param {string} params.level - Log level (INFO, WARN, ERROR, DEBUG)
 * @param {string} params.event - Event name (e.g., 'DECISION_RECORDED', 'EXECUTION_STARTED')
 * @param {string} [params.correlation_id] - Correlation ID for tracing
 * @param {string} [params.organization_id] - Organization ID
 * @param {string} [params.proposal_id] - Proposal ID
 * @param {string} [params.decision_id] - Decision ID
 * @param {string} [params.execution_id] - Execution ID
 * @param {string} [params.action_type] - Action type (TASK_CREATE, etc.)
 * @param {string} [params.status] - Status (SUCCESS, FAILED, etc.)
 * @param {number} [params.duration_ms] - Duration in milliseconds
 * @param {string} [params.error_code] - Error code from catalog
 * @param {string} [params.error_message] - Human-readable error message
 * @param {Object} [params.metadata] - Additional metadata
 */
function log(params) {
    const {
        level = LOG_LEVELS.INFO,
        event,
        correlation_id,
        organization_id,
        proposal_id,
        decision_id,
        execution_id,
        action_type,
        status,
        duration_ms,
        error_code,
        error_message,
        metadata
    } = params;

    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        event,
        correlation_id: correlation_id || null,
        organization_id: organization_id || null,
        proposal_id: proposal_id || null,
        decision_id: decision_id || null,
        execution_id: execution_id || null,
        action_type: action_type || null,
        status: status || null,
        duration_ms: duration_ms !== undefined ? duration_ms : null,
        error_code: error_code || null,
        error_message: error_message || null,
        ...(metadata ? { metadata } : {})
    };

    // Clean null values for cleaner output
    const cleanEntry = Object.fromEntries(
        Object.entries(logEntry).filter(([_, v]) => v !== null)
    );

    const jsonLine = JSON.stringify(cleanEntry);

    // Output based on level
    switch (level) {
        case LOG_LEVELS.ERROR:
            console.error(`[AUDIT] ${jsonLine}`);
            break;
        case LOG_LEVELS.WARN:
            console.warn(`[AUDIT] ${jsonLine}`);
            break;
        case LOG_LEVELS.DEBUG:
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[AUDIT] ${jsonLine}`);
            }
            break;
        default:
            console.log(`[AUDIT] ${jsonLine}`);
    }

    return cleanEntry;
}

// Convenience methods
const info = (event, params = {}) => log({ ...params, level: LOG_LEVELS.INFO, event });
const warn = (event, params = {}) => log({ ...params, level: LOG_LEVELS.WARN, event });
const error = (event, params = {}) => log({ ...params, level: LOG_LEVELS.ERROR, event });
const debug = (event, params = {}) => log({ ...params, level: LOG_LEVELS.DEBUG, event });

/**
 * Log a PMO audit entry with automatic standards mapping
 * 
 * @param {Object} params - Audit parameters
 * @param {string} params.projectId - Project ID
 * @param {string} params.objectType - PMO object type (DECISION, TASK, etc.)
 * @param {string} params.objectId - Object ID
 * @param {string} params.action - Action performed (CREATED, APPROVED, etc.)
 * @param {string} [params.actorId] - Who performed the action
 * @param {string} [params.pmoPhase] - Current SCMS phase (1-6)
 * @param {Object} [params.metadata] - Additional context
 * @returns {Object} Log entry with standards mapping
 */
function logPMOAudit(params) {
    const {
        projectId,
        objectType,
        objectId,
        action,
        actorId,
        pmoPhase,
        metadata = {}
    } = params;

    // Get standards mapping for this object type
    const mapping = PMO_STANDARDS_MAPPING[objectType] || {
        iso21500: 'Project Element',
        pmbok: 'Project Element',
        prince2: 'Project Element',
        domain: 'GOVERNANCE_DECISION_MAKING'
    };

    const pmoAuditEntry = {
        timestamp: new Date().toISOString(),
        level: LOG_LEVELS.INFO,
        event: 'PMO_AUDIT',
        
        // Core identifiers
        projectId,
        objectType,
        objectId,
        action,
        actorId,
        
        // PMO context
        pmoDomainId: mapping.domain,
        pmoPhase: pmoPhase || null,
        
        // Standards mapping for certification
        iso21500Mapping: mapping.iso21500,
        pmbokMapping: mapping.pmbok,
        prince2Mapping: mapping.prince2,
        
        // Additional context
        metadata
    };

    // Clean null values
    const cleanEntry = Object.fromEntries(
        Object.entries(pmoAuditEntry).filter(([_, v]) => v !== null && v !== undefined)
    );

    const jsonLine = JSON.stringify(cleanEntry);
    console.log(`[PMO_AUDIT] ${jsonLine}`);

    return cleanEntry;
}

/**
 * Get standards mapping for an object type
 * 
 * @param {string} objectType - PMO object type
 * @returns {Object} Standards mapping
 */
function getStandardsMapping(objectType) {
    return PMO_STANDARDS_MAPPING[objectType] || null;
}

/**
 * Get all available object types with mappings
 * 
 * @returns {string[]} List of object types
 */
function getAuditableObjectTypes() {
    return Object.keys(PMO_STANDARDS_MAPPING);
}

module.exports = {
    LOG_LEVELS,
    PMO_STANDARDS_MAPPING,
    log,
    info,
    warn,
    error,
    debug,
    logPMOAudit,
    getStandardsMapping,
    getAuditableObjectTypes
};
