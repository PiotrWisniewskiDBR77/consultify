/**
 * DLP (Data Loss Prevention) Service - Stub Implementation
 * 
 * This is a stub implementation for testing purposes.
 * Provides DLP policy management and violation scanning.
 */

import { v4 as uuidv4 } from 'uuid';

// Constants
const POLICY_TYPES = {
    PII_DETECTION: 'pii_detection',
    CREDENTIALS: 'credentials',
    FINANCIAL: 'financial',
    HEALTH: 'health',
    CUSTOM: 'custom'
};

const ENFORCEMENT_ACTIONS = {
    WARN: 'warn',
    BLOCK: 'block',
    REDACT: 'redact',
    LOG: 'log'
};

const SEVERITY_LEVELS = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
};

// In-memory storage for testing
let policies = [];
let violations = [];
let db = null;

const dlpService = {
    POLICY_TYPES,
    ENFORCEMENT_ACTIONS,
    SEVERITY_LEVELS,

    setDependencies: (deps) => {
        if (deps.db) db = deps.db;
    },

    // Policy CRUD
    createPolicy: async (policyData) => {
        const policy = {
            id: uuidv4(),
            name: policyData.name,
            description: policyData.description || '',
            policyType: policyData.policyType || 'custom',
            rules: policyData.rules || [],
            enforcementAction: policyData.enforcementAction || 'warn',
            isActive: true,
            createdBy: policyData.createdBy,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        policies.push(policy);
        return policy;
    },

    getPolicyById: async (id) => {
        if (db && db.get) {
            const row = await new Promise((resolve, reject) => {
                if (typeof db.get === 'function') {
                    db.get(`SELECT * FROM dlp_policies WHERE id = ?`, [id], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                } else {
                    resolve(null);
                }
            });
            if (!row) return null;
            return {
                id: row.id,
                name: row.name,
                description: row.description,
                policyType: row.policy_type,
                rules: JSON.parse(row.rules_json || '[]'),
                enforcementAction: row.enforcement_action,
                isActive: row.is_active === 1,
                createdBy: row.created_by,
                createdByEmail: row.created_by_email,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        }
        return policies.find(p => p.id === id) || null;
    },

    getPolicies: async (filters = {}) => {
        if (db && db.all) {
            let sql = 'SELECT * FROM dlp_policies WHERE 1=1';
            const params = [];
            
            if (filters.policyType) {
                sql += ' AND policy_type = ?';
                params.push(filters.policyType);
            }
            if (filters.isActive !== undefined) {
                sql += ' AND is_active = ?';
                params.push(filters.isActive ? 1 : 0);
            }
            
            const rows = await new Promise((resolve, reject) => {
                db.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });
            
            return rows.map(row => ({
                id: row.id,
                name: row.name,
                description: row.description,
                policyType: row.policy_type,
                rules: JSON.parse(row.rules_json || '[]'),
                enforcementAction: row.enforcement_action,
                isActive: row.is_active === 1,
                createdBy: row.created_by,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }));
        }
        return policies;
    },

    updatePolicy: async (id, updates) => {
        const allowedFields = ['name', 'description', 'rules', 'enforcementAction', 'isActive'];
        const hasAllowedFields = Object.keys(updates).some(key => allowedFields.includes(key));
        if (!hasAllowedFields) return false;

        if (db && db.run) {
            const setClauses = [];
            const params = [];
            
            if (updates.name) { setClauses.push('name = ?'); params.push(updates.name); }
            if (updates.description) { setClauses.push('description = ?'); params.push(updates.description); }
            if (updates.rules) { setClauses.push('rules_json = ?'); params.push(JSON.stringify(updates.rules)); }
            if (updates.enforcementAction) { setClauses.push('enforcement_action = ?'); params.push(updates.enforcementAction); }
            
            setClauses.push('updated_at = ?');
            params.push(new Date().toISOString());
            params.push(id);
            
            await new Promise((resolve, reject) => {
                db.run(`UPDATE dlp_policies SET ${setClauses.join(', ')} WHERE id = ?`, params, function(err) {
                    if (err) reject(err);
                    else resolve(this.changes > 0);
                });
            });
        }
        
        const idx = policies.findIndex(p => p.id === id);
        if (idx >= 0) {
            policies[idx] = { ...policies[idx], ...updates, updatedAt: new Date().toISOString() };
        }
        return true;
    },

    togglePolicyActive: async (id, isActive) => {
        if (db && db.run) {
            await new Promise((resolve, reject) => {
                db.run(`UPDATE dlp_policies SET is_active = ? WHERE id = ?`, [isActive ? 1 : 0, id], function(err) {
                    if (err) reject(err);
                    else resolve(this.changes > 0);
                });
            });
        }
        
        const idx = policies.findIndex(p => p.id === id);
        if (idx >= 0) {
            policies[idx].isActive = isActive;
        }
        return true;
    },

    deletePolicy: async (id) => {
        if (db && db.run) {
            const result = await new Promise((resolve, reject) => {
                db.run(`DELETE FROM dlp_policies WHERE id = ?`, [id], function(err) {
                    if (err) reject(err);
                    else resolve(this.changes > 0);
                });
            });
            return result;
        }
        
        const idx = policies.findIndex(p => p.id === id);
        if (idx >= 0) {
            policies.splice(idx, 1);
            return true;
        }
        return false;
    },

    // Violations
    recordViolation: async (violationData) => {
        const violation = {
            id: uuidv4(),
            policyId: violationData.policyId,
            resourceType: violationData.resourceType,
            resourceId: violationData.resourceId,
            violationType: violationData.violationType,
            severity: violationData.severity || 'MEDIUM',
            detectedAt: new Date().toISOString(),
            resolvedAt: null,
            resolvedBy: null
        };
        violations.push(violation);
        return violation;
    },

    getViolations: async (filters = {}) => {
        if (db && db.all) {
            let sql = `
                SELECT v.*, p.name as policy_name, p.policy_type 
                FROM dlp_violations v
                LEFT JOIN dlp_policies p ON v.policy_id = p.id
                WHERE 1=1
            `;
            const params = [];
            
            if (filters.isResolved === false) {
                sql += ' AND v.resolved_at IS NULL';
            } else if (filters.isResolved === true) {
                sql += ' AND v.resolved_at IS NOT NULL';
            }
            
            const rows = await new Promise((resolve, reject) => {
                db.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });
            
            return rows.map(row => ({
                id: row.id,
                policyId: row.policy_id,
                policyName: row.policy_name,
                policyType: row.policy_type,
                resourceType: row.resource_type,
                resourceId: row.resource_id,
                violationType: row.violation_type,
                severity: row.severity,
                detectedAt: row.detected_at,
                resolvedAt: row.resolved_at,
                resolvedBy: row.resolved_by
            }));
        }
        return violations;
    },

    resolveViolation: async (id, resolvedBy) => {
        if (db && db.run) {
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE dlp_violations SET resolved_at = ?, resolved_by = ? WHERE id = ?`,
                    [new Date().toISOString(), resolvedBy, id],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.changes > 0);
                    }
                );
            });
        }
        
        const idx = violations.findIndex(v => v.id === id);
        if (idx >= 0) {
            violations[idx].resolvedAt = new Date().toISOString();
            violations[idx].resolvedBy = resolvedBy;
        }
        return true;
    },

    // Statistics
    getStats: async () => {
        if (db && db.get) {
            const policyStats = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as total_policies, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_policies FROM dlp_policies`,
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row || { total_policies: 0, active_policies: 0 });
                    }
                );
            });
            
            const violationStats = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        COUNT(*) as total_violations,
                        SUM(CASE WHEN resolved_at IS NULL THEN 1 ELSE 0 END) as unresolved_count,
                        SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count,
                        SUM(CASE WHEN severity = 'HIGH' THEN 1 ELSE 0 END) as high_count,
                        SUM(CASE WHEN severity = 'MEDIUM' THEN 1 ELSE 0 END) as medium_count,
                        SUM(CASE WHEN severity = 'LOW' THEN 1 ELSE 0 END) as low_count
                    FROM dlp_violations
                `, (err, row) => {
                    if (err) reject(err);
                    else resolve(row || {});
                });
            });
            
            return {
                policies: {
                    total: policyStats.total_policies || 0,
                    active: policyStats.active_policies || 0
                },
                violations: {
                    total: violationStats.total_violations || 0,
                    unresolved: violationStats.unresolved_count || 0,
                    bySeverity: {
                        critical: violationStats.critical_count || 0,
                        high: violationStats.high_count || 0,
                        medium: violationStats.medium_count || 0,
                        low: violationStats.low_count || 0
                    }
                }
            };
        }
        
        return {
            policies: { total: policies.length, active: policies.filter(p => p.isActive).length },
            violations: {
                total: violations.length,
                unresolved: violations.filter(v => !v.resolvedAt).length,
                bySeverity: {
                    critical: violations.filter(v => v.severity === 'CRITICAL').length,
                    high: violations.filter(v => v.severity === 'HIGH').length,
                    medium: violations.filter(v => v.severity === 'MEDIUM').length,
                    low: violations.filter(v => v.severity === 'LOW').length
                }
            }
        };
    },

    // Scanning
    scanResource: async (resourceType, resourceId, content) => {
        const activePolicies = await dlpService.getPolicies({ isActive: true });
        const foundViolations = [];
        
        for (const policy of activePolicies) {
            for (const rule of (policy.rules || [])) {
                if (rule.pattern) {
                    const regex = new RegExp(rule.pattern, 'gi');
                    const matches = content.match(regex);
                    if (matches && matches.length > 0) {
                        const violation = await dlpService.recordViolation({
                            policyId: policy.id,
                            resourceType,
                            resourceId,
                            violationType: rule.name || 'pattern_match',
                            severity: rule.severity || 'HIGH'
                        });
                        foundViolations.push(violation);
                    }
                }
            }
        }
        
        return {
            scanned: true,
            violationsFound: foundViolations.length,
            violations: foundViolations
        };
    }
};

export default dlpService;

