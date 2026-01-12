/**
 * Data Loss Prevention (DLP) Service
 * Manages DLP policies and violations
 */

// Dependency injection for testing
const deps = {
    _db: null,
    _uuidv4: null,

    get db() { return this._db; },
    set db(val) { this._db = val; },

    get uuidv4() { return this._uuidv4; },
    set uuidv4(val) { this._uuidv4 = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._db) {
        const { default: db } = await import('../src/database/index.js');
        deps._db = db;
    }
    if (!deps._uuidv4) {
        const { v4 } = await import('uuid');
        deps._uuidv4 = v4;
    }
}

/**
 * Set dependencies for testing
 */
const setDependencies = (newDeps) => {
    if (newDeps.db) deps.db = newDeps.db;
    if (newDeps.uuidv4) deps.uuidv4 = newDeps.uuidv4;
};

/**
 * Policy types
 */
const POLICY_TYPES = {
    DATA_CLASSIFICATION: 'data_classification',
    PII_DETECTION: 'pii_detection',
    SENSITIVE_DATA: 'sensitive_data',
    FINANCIAL_DATA: 'financial_data',
    HEALTHCARE_DATA: 'healthcare_data',
    INTELLECTUAL_PROPERTY: 'intellectual_property',
    CREDENTIALS: 'credentials',
    CUSTOM: 'custom'
};

/**
 * Enforcement actions
 */
const ENFORCEMENT_ACTIONS = {
    WARN: 'warn',
    BLOCK: 'block',
    ENCRYPT: 'encrypt',
    MASK: 'mask',
    LOG_ONLY: 'log_only'
};

/**
 * Severity levels
 */
const SEVERITY_LEVELS = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
};

// ================================
// DLP POLICIES
// ================================

/**
 * Create a new DLP policy
 */
const createPolicy = async ({ name, description, policyType, rules = [], enforcementAction, createdBy }) => {
    await initDeps();
    const id = deps.uuidv4();
    
    const sql = `
        INSERT INTO dlp_policies (
            id, name, description, policy_type, rules_json, enforcement_action, is_active, created_by, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))
    `;
    
    await deps.db.run(sql, [
        id,
        name,
        description,
        policyType,
        JSON.stringify(rules),
        enforcementAction || ENFORCEMENT_ACTIONS.WARN,
        createdBy
    ]);
    
    return {
        id,
        name,
        description,
        policyType,
        rules,
        enforcementAction: enforcementAction || ENFORCEMENT_ACTIONS.WARN,
        isActive: true,
        createdBy,
        createdAt: new Date().toISOString()
    };
};

/**
 * Get policy by ID
 */
const getPolicyById = async (id) => {
    await initDeps();
    const sql = `
        SELECT p.*, u.email as created_by_email
        FROM dlp_policies p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.id = ?
    `;
    const policy = await deps.db.get(sql, [id]);
    
    if (!policy) return null;
    
    return {
        id: policy.id,
        name: policy.name,
        description: policy.description,
        policyType: policy.policy_type,
        rules: JSON.parse(policy.rules_json || '[]'),
        enforcementAction: policy.enforcement_action,
        isActive: policy.is_active === 1,
        createdBy: policy.created_by,
        createdByEmail: policy.created_by_email,
        createdAt: policy.created_at,
        updatedAt: policy.updated_at
    };
};

/**
 * Get all DLP policies
 */
const getPolicies = async ({ policyType, isActive, limit = 100, offset = 0 } = {}) => {
    await initDeps();
    let sql = `
        SELECT p.*, u.email as created_by_email
        FROM dlp_policies p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE 1=1
    `;
    const params = [];
    
    if (policyType) {
        sql += ` AND p.policy_type = ?`;
        params.push(policyType);
    }
    if (isActive !== undefined) {
        sql += ` AND p.is_active = ?`;
        params.push(isActive ? 1 : 0);
    }
    
    sql += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const policies = await deps.db.all(sql, params);
    
    return policies.map(policy => ({
        id: policy.id,
        name: policy.name,
        description: policy.description,
        policyType: policy.policy_type,
        rules: JSON.parse(policy.rules_json || '[]'),
        enforcementAction: policy.enforcement_action,
        isActive: policy.is_active === 1,
        createdBy: policy.created_by,
        createdByEmail: policy.created_by_email,
        createdAt: policy.created_at,
        updatedAt: policy.updated_at
    }));
};

/**
 * Update a DLP policy
 */
const updatePolicy = async (id, updates) => {
    await initDeps();
    const allowedFields = ['name', 'description', 'policy_type', 'rules_json', 'enforcement_action', 'is_active'];
    const setClauses = [];
    const params = [];
    
    const fieldMapping = {
        name: 'name',
        description: 'description',
        policyType: 'policy_type',
        rules: 'rules_json',
        enforcementAction: 'enforcement_action',
        isActive: 'is_active'
    };
    
    for (const [key, value] of Object.entries(updates)) {
        const dbField = fieldMapping[key];
        if (dbField && allowedFields.includes(dbField) && value !== undefined) {
            if (key === 'rules') {
                setClauses.push(`${dbField} = ?`);
                params.push(JSON.stringify(value));
            } else if (key === 'isActive') {
                setClauses.push(`${dbField} = ?`);
                params.push(value ? 1 : 0);
            } else {
                setClauses.push(`${dbField} = ?`);
                params.push(value);
            }
        }
    }
    
    if (setClauses.length === 0) return false;
    
    setClauses.push(`updated_at = datetime('now')`);
    params.push(id);
    
    const sql = `UPDATE dlp_policies SET ${setClauses.join(', ')} WHERE id = ?`;
    const result = await deps.db.run(sql, params);
    return result.changes > 0;
};

/**
 * Toggle policy active status
 */
const togglePolicyActive = async (id, isActive) => {
    await initDeps();
    const sql = `UPDATE dlp_policies SET is_active = ?, updated_at = datetime('now') WHERE id = ?`;
    const result = await deps.db.run(sql, [isActive ? 1 : 0, id]);
    return result.changes > 0;
};

/**
 * Delete a DLP policy
 */
const deletePolicy = async (id) => {
    await initDeps();
    const sql = `DELETE FROM dlp_policies WHERE id = ?`;
    const result = await deps.db.run(sql, [id]);
    return result.changes > 0;
};

// ================================
// DLP VIOLATIONS
// ================================

/**
 * Record a DLP violation
 */
const recordViolation = async ({ policyId, resourceType, resourceId, violationType, severity }) => {
    await initDeps();
    const id = deps.uuidv4();
    
    const sql = `
        INSERT INTO dlp_violations (
            id, policy_id, resource_type, resource_id, violation_type, severity, detected_at, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `;
    
    await deps.db.run(sql, [
        id,
        policyId,
        resourceType,
        resourceId,
        violationType,
        severity || SEVERITY_LEVELS.MEDIUM
    ]);
    
    return {
        id,
        policyId,
        resourceType,
        resourceId,
        violationType,
        severity: severity || SEVERITY_LEVELS.MEDIUM,
        detectedAt: new Date().toISOString()
    };
};

/**
 * Get violation by ID
 */
const getViolationById = async (id) => {
    await initDeps();
    const sql = `
        SELECT v.*, p.name as policy_name, p.policy_type, u.email as resolved_by_email
        FROM dlp_violations v
        LEFT JOIN dlp_policies p ON v.policy_id = p.id
        LEFT JOIN users u ON v.resolved_by = u.id
        WHERE v.id = ?
    `;
    const violation = await deps.db.get(sql, [id]);
    
    if (!violation) return null;
    
    return {
        id: violation.id,
        policyId: violation.policy_id,
        policyName: violation.policy_name,
        policyType: violation.policy_type,
        resourceType: violation.resource_type,
        resourceId: violation.resource_id,
        violationType: violation.violation_type,
        severity: violation.severity,
        detectedAt: violation.detected_at,
        resolvedAt: violation.resolved_at,
        resolvedBy: violation.resolved_by,
        resolvedByEmail: violation.resolved_by_email,
        createdAt: violation.created_at
    };
};

/**
 * Get all violations
 */
const getViolations = async ({ policyId, severity, isResolved, limit = 100, offset = 0 } = {}) => {
    await initDeps();
    let sql = `
        SELECT v.*, p.name as policy_name, p.policy_type, u.email as resolved_by_email
        FROM dlp_violations v
        LEFT JOIN dlp_policies p ON v.policy_id = p.id
        LEFT JOIN users u ON v.resolved_by = u.id
        WHERE 1=1
    `;
    const params = [];
    
    if (policyId) {
        sql += ` AND v.policy_id = ?`;
        params.push(policyId);
    }
    if (severity) {
        sql += ` AND v.severity = ?`;
        params.push(severity);
    }
    if (isResolved !== undefined) {
        if (isResolved) {
            sql += ` AND v.resolved_at IS NOT NULL`;
        } else {
            sql += ` AND v.resolved_at IS NULL`;
        }
    }
    
    sql += ` ORDER BY v.detected_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const violations = await deps.db.all(sql, params);
    
    return violations.map(violation => ({
        id: violation.id,
        policyId: violation.policy_id,
        policyName: violation.policy_name,
        policyType: violation.policy_type,
        resourceType: violation.resource_type,
        resourceId: violation.resource_id,
        violationType: violation.violation_type,
        severity: violation.severity,
        detectedAt: violation.detected_at,
        resolvedAt: violation.resolved_at,
        resolvedBy: violation.resolved_by,
        resolvedByEmail: violation.resolved_by_email,
        createdAt: violation.created_at
    }));
};

/**
 * Resolve a violation
 */
const resolveViolation = async (id, resolvedBy) => {
    await initDeps();
    const sql = `UPDATE dlp_violations SET resolved_at = datetime('now'), resolved_by = ? WHERE id = ?`;
    const result = await deps.db.run(sql, [resolvedBy, id]);
    return result.changes > 0;
};

/**
 * Get DLP statistics
 */
const getStats = async () => {
    await initDeps();
    const policySql = `
        SELECT 
            COUNT(*) as total_policies,
            SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_policies
        FROM dlp_policies
    `;
    
    const violationSql = `
        SELECT 
            COUNT(*) as total_violations,
            SUM(CASE WHEN resolved_at IS NULL THEN 1 ELSE 0 END) as unresolved_count,
            SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count,
            SUM(CASE WHEN severity = 'HIGH' THEN 1 ELSE 0 END) as high_count,
            SUM(CASE WHEN severity = 'MEDIUM' THEN 1 ELSE 0 END) as medium_count,
            SUM(CASE WHEN severity = 'LOW' THEN 1 ELSE 0 END) as low_count
        FROM dlp_violations
    `;
    
    const [policyStats, violationStats] = await Promise.all([
        deps.db.get(policySql),
        deps.db.get(violationSql)
    ]);
    
    return {
        policies: {
            total: policyStats?.total_policies || 0,
            active: policyStats?.active_policies || 0
        },
        violations: {
            total: violationStats?.total_violations || 0,
            unresolved: violationStats?.unresolved_count || 0,
            bySeverity: {
                critical: violationStats?.critical_count || 0,
                high: violationStats?.high_count || 0,
                medium: violationStats?.medium_count || 0,
                low: violationStats?.low_count || 0
            }
        }
    };
};

/**
 * Scan resource for DLP violations
 * This is a simplified implementation - in production, this would use more sophisticated scanning
 */
const scanResource = async (resourceType, resourceId, content) => {
    await initDeps();
    const activePolicies = await getPolicies({ isActive: true });
    const violations = [];
    
    for (const policy of activePolicies) {
        const rules = policy.rules || [];
        
        for (const rule of rules) {
            let matched = false;
            
            // Simple pattern matching
            if (rule.pattern) {
                try {
                    const regex = new RegExp(rule.pattern, 'gi');
                    matched = regex.test(content);
                } catch (e) {
                    console.error(`Invalid regex pattern: ${rule.pattern}`);
                }
            }
            
            // Keyword matching
            if (rule.keywords && Array.isArray(rule.keywords)) {
                matched = matched || rule.keywords.some(keyword => 
                    content.toLowerCase().includes(keyword.toLowerCase())
                );
            }
            
            if (matched) {
                const violation = await recordViolation({
                    policyId: policy.id,
                    resourceType,
                    resourceId,
                    violationType: rule.name || 'pattern_match',
                    severity: rule.severity || policy.enforcementAction === 'block' ? 'HIGH' : 'MEDIUM'
                });
                violations.push(violation);
            }
        }
    }
    
    return {
        scanned: true,
        resourceType,
        resourceId,
        violationsFound: violations.length,
        violations
    };
};

export {
setDependencies,
    // Policies
    createPolicy,
    getPolicyById,
    getPolicies,
    updatePolicy,
    togglePolicyActive,
    deletePolicy,
    // Violations
    recordViolation,
    getViolationById,
    getViolations,
    resolveViolation,
    // Stats & Scanning
    getStats,
    scanResource,
    // Constants
    POLICY_TYPES,
    ENFORCEMENT_ACTIONS,
    SEVERITY_LEVELS
};

export default {
    setDependencies,
    // Policies
    createPolicy,
    getPolicyById,
    getPolicies,
    updatePolicy,
    togglePolicyActive,
    deletePolicy,
    // Violations
    recordViolation,
    getViolationById,
    getViolations,
    resolveViolation,
    // Stats & Scanning
    getStats,
    scanResource,
    // Constants
    POLICY_TYPES,
    ENFORCEMENT_ACTIONS,
    SEVERITY_LEVELS
};




