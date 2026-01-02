/**
 * ApprovalPatternService
 * 
 * HITL Learning System - Learns from user approval/rejection decisions
 * and automatically handles similar actions in the future.
 * 
 * Features:
 * - Generate action signatures to identify similar actions
 * - Pattern matching with fuzzy similarity
 * - Confidence calculation based on history
 * - Auto-approve/reject based on learned patterns
 * 
 * @module server/services/approvalPatternService
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Dependency injection for testing
const deps = {
    db,
    uuidv4
};

// Fields to exclude from signature generation (volatile fields)
const SIGNATURE_EXCLUDE_FIELDS = [
    'id', 'created_at', 'updated_at', 'timestamp', 'correlation_id',
    '_forceApproval', '_internal', 'uuid', 'requestId'
];

// Risk level thresholds for auto-decision
const AUTO_DECISION_THRESHOLDS = {
    LOW: { minConfidence: 0.85, minDecisions: 2 },
    MEDIUM: { minConfidence: 0.95, minDecisions: 3 },
    HIGH: { minConfidence: 1.0, minDecisions: Infinity } // Never auto-decide HIGH risk
};

const ApprovalPatternService = {
    /**
     * Allow dependency injection for testing
     */
    setDependencies: (newDeps) => {
        Object.assign(deps, newDeps);
    },

    /**
     * Generate a signature from action type and payload
     * This signature identifies similar actions for pattern matching
     * 
     * @param {string} actionType - Type of action (CREATE_DRAFT_TASK, etc.)
     * @param {object} payload - Action payload
     * @returns {string} - SHA256 hash signature
     */
    generateSignature: (actionType, payload) => {
        if (!actionType) return null;

        // Normalize payload - extract structural signature
        const normalizedPayload = ApprovalPatternService._normalizePayload(payload);
        
        // Create signature from action type + normalized payload structure
        const signatureData = JSON.stringify({
            actionType,
            payloadKeys: Object.keys(normalizedPayload).sort(),
            payloadTypes: ApprovalPatternService._extractPayloadTypes(normalizedPayload)
        });

        return crypto.createHash('sha256').update(signatureData).digest('hex').substring(0, 32);
    },

    /**
     * Normalize payload by removing volatile fields and extracting structure
     * @private
     */
    _normalizePayload: (payload) => {
        if (!payload || typeof payload !== 'object') return {};

        const normalized = {};
        for (const [key, value] of Object.entries(payload)) {
            if (SIGNATURE_EXCLUDE_FIELDS.includes(key)) continue;
            if (key.startsWith('_')) continue; // Skip internal fields

            // For nested objects, just store the key structure
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                normalized[key] = Object.keys(value).sort();
            } else if (Array.isArray(value)) {
                normalized[key] = 'array';
            } else {
                normalized[key] = typeof value;
            }
        }
        return normalized;
    },

    /**
     * Extract type information from payload for signature
     * @private
     */
    _extractPayloadTypes: (payload) => {
        const types = {};
        for (const [key, value] of Object.entries(payload)) {
            types[key] = Array.isArray(value) ? 'array' : typeof value;
        }
        return types;
    },

    /**
     * Find matching pattern for an action
     * 
     * @param {string} userId - User ID
     * @param {string} actionType - Action type
     * @param {object} payload - Action payload
     * @returns {Promise<object|null>} - Matching pattern or null
     */
    findMatchingPattern: async (userId, actionType, payload) => {
        const signature = ApprovalPatternService.generateSignature(actionType, payload);
        if (!signature) return null;

        return new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT * FROM ai_approval_patterns 
                 WHERE user_id = ? AND action_type = ? AND action_signature = ?`,
                [userId, actionType, signature],
                (err, row) => {
                    if (err) {
                        console.error('[ApprovalPatternService] findMatchingPattern error:', err);
                        resolve(null);
                        return;
                    }
                    
                    if (row) {
                        try {
                            row.payload_template = row.payload_template ? JSON.parse(row.payload_template) : {};
                        } catch (e) {
                            row.payload_template = {};
                        }
                    }
                    
                    resolve(row || null);
                }
            );
        });
    },

    /**
     * Calculate confidence score for a pattern match
     * 
     * @param {object} pattern - Stored pattern
     * @param {object} newPayload - New action payload
     * @returns {number} - Confidence score 0-1
     */
    calculateConfidence: (pattern, newPayload) => {
        if (!pattern) return 0;

        // Base confidence from historical decisions
        const decisionCount = pattern.decision_count || 1;
        let historyConfidence;
        
        if (decisionCount >= 5) historyConfidence = 0.95;
        else if (decisionCount >= 3) historyConfidence = 0.9;
        else if (decisionCount >= 2) historyConfidence = 0.75;
        else historyConfidence = 0.5;

        // Payload similarity (compare normalized structures)
        const storedTemplate = pattern.payload_template || {};
        const newNormalized = ApprovalPatternService._normalizePayload(newPayload);
        const similarity = ApprovalPatternService._calculateSimilarity(storedTemplate, newNormalized);

        // Recency factor - recent patterns are more relevant
        const recencyFactor = ApprovalPatternService._calculateRecencyFactor(pattern.last_decision_at);

        // Final confidence
        return Math.min(1, historyConfidence * similarity * recencyFactor);
    },

    /**
     * Calculate structural similarity between two payload templates
     * @private
     */
    _calculateSimilarity: (template1, template2) => {
        const keys1 = new Set(Object.keys(template1));
        const keys2 = new Set(Object.keys(template2));
        
        if (keys1.size === 0 && keys2.size === 0) return 1;
        
        const intersection = new Set([...keys1].filter(x => keys2.has(x)));
        const union = new Set([...keys1, ...keys2]);
        
        // Jaccard similarity
        return union.size > 0 ? intersection.size / union.size : 0;
    },

    /**
     * Calculate recency factor - more recent patterns are more relevant
     * @private
     */
    _calculateRecencyFactor: (lastDecisionAt) => {
        if (!lastDecisionAt) return 0.8;

        const daysSince = (Date.now() - new Date(lastDecisionAt).getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSince <= 7) return 1.0;
        if (daysSince <= 30) return 0.95;
        if (daysSince <= 90) return 0.85;
        return 0.7;
    },

    /**
     * Check if an action can be auto-decided based on learned patterns
     * 
     * @param {string} userId - User ID
     * @param {string} actionType - Action type
     * @param {object} payload - Action payload
     * @param {string} riskLevel - Risk level (LOW, MEDIUM, HIGH)
     * @returns {Promise<{canAutoDecide: boolean, decision?: string, confidence?: number, pattern?: object}>}
     */
    canAutoDecide: async (userId, actionType, payload, riskLevel = 'LOW') => {
        try {
            // HIGH risk actions never auto-decide
            if (riskLevel === 'HIGH') {
                return { canAutoDecide: false, reason: 'HIGH_RISK_REQUIRES_MANUAL' };
            }

            const pattern = await ApprovalPatternService.findMatchingPattern(userId, actionType, payload);
            
            if (!pattern) {
                return { canAutoDecide: false, reason: 'NO_PATTERN_FOUND' };
            }

            // Check if auto-apply is enabled for this pattern
            if (!pattern.auto_apply) {
                return { 
                    canAutoDecide: false, 
                    reason: 'AUTO_APPLY_DISABLED',
                    pattern,
                    suggestion: `Pattern found with ${pattern.decision_count} previous ${pattern.decision} decisions. Enable auto-apply to automate.`
                };
            }

            // Calculate confidence
            const confidence = ApprovalPatternService.calculateConfidence(pattern, payload);
            
            // Get threshold for this risk level
            const threshold = AUTO_DECISION_THRESHOLDS[riskLevel] || AUTO_DECISION_THRESHOLDS.LOW;
            
            // Check if confidence meets threshold
            const meetsConfidence = confidence >= threshold.minConfidence;
            const meetsDecisionCount = pattern.decision_count >= threshold.minDecisions;

            if (meetsConfidence && meetsDecisionCount) {
                return {
                    canAutoDecide: true,
                    decision: pattern.decision,
                    confidence,
                    pattern,
                    reason: `Auto-decided based on ${pattern.decision_count} consistent ${pattern.decision} decisions with ${Math.round(confidence * 100)}% confidence`
                };
            }

            return {
                canAutoDecide: false,
                reason: !meetsConfidence ? 'CONFIDENCE_TOO_LOW' : 'INSUFFICIENT_DECISION_COUNT',
                confidence,
                pattern,
                required: threshold
            };

        } catch (error) {
            console.error('[ApprovalPatternService] canAutoDecide error:', error);
            return { canAutoDecide: false, reason: 'ERROR', error: error.message };
        }
    },

    /**
     * Record a user's decision and update/create patterns
     * 
     * @param {string} userId - User ID
     * @param {string} organizationId - Organization ID
     * @param {string} actionType - Action type
     * @param {object} payload - Action payload
     * @param {string} decision - APPROVED or REJECTED
     * @param {string} riskLevel - Risk level
     * @param {boolean} enableAutoApply - Whether to enable auto-apply for this pattern
     * @returns {Promise<object>} - Updated or created pattern
     */
    recordDecision: async (userId, organizationId, actionType, payload, decision, riskLevel = 'LOW', enableAutoApply = false) => {
        const signature = ApprovalPatternService.generateSignature(actionType, payload);
        if (!signature) {
            throw new Error('Could not generate signature for action');
        }

        const normalizedPayload = ApprovalPatternService._normalizePayload(payload);
        const existingPattern = await ApprovalPatternService.findMatchingPattern(userId, actionType, payload);

        return new Promise((resolve, reject) => {
            if (existingPattern) {
                // Update existing pattern
                const newDecisionCount = existingPattern.decision === decision 
                    ? existingPattern.decision_count + 1 
                    : 1; // Reset count if decision changed
                
                const autoApply = enableAutoApply ? 1 : (existingPattern.auto_apply || 0);

                deps.db.run(
                    `UPDATE ai_approval_patterns 
                     SET decision = ?, 
                         decision_count = ?, 
                         last_decision_at = CURRENT_TIMESTAMP,
                         auto_apply = ?,
                         payload_template = ?,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [decision, newDecisionCount, autoApply, JSON.stringify(normalizedPayload), existingPattern.id],
                    function(err) {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        resolve({
                            id: existingPattern.id,
                            updated: true,
                            decision,
                            decision_count: newDecisionCount,
                            auto_apply: autoApply === 1,
                            consistency: existingPattern.decision === decision ? 'CONSISTENT' : 'CHANGED'
                        });
                    }
                );
            } else {
                // Create new pattern
                const id = deps.uuidv4();
                
                deps.db.run(
                    `INSERT INTO ai_approval_patterns 
                     (id, user_id, organization_id, action_type, action_signature, 
                      payload_template, decision, decision_count, auto_apply, risk_level)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
                    [id, userId, organizationId, actionType, signature, 
                     JSON.stringify(normalizedPayload), decision, enableAutoApply ? 1 : 0, riskLevel],
                    function(err) {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        resolve({
                            id,
                            created: true,
                            decision,
                            decision_count: 1,
                            auto_apply: enableAutoApply,
                            message: 'New pattern learned'
                        });
                    }
                );
            }
        });
    },

    /**
     * Get all patterns for a user
     * 
     * @param {string} userId - User ID
     * @param {string} actionType - Optional: filter by action type
     * @returns {Promise<Array>} - List of patterns
     */
    getUserPatterns: async (userId, actionType = null) => {
        return new Promise((resolve, reject) => {
            let sql = `SELECT * FROM ai_approval_patterns WHERE user_id = ?`;
            const params = [userId];
            
            if (actionType) {
                sql += ` AND action_type = ?`;
                params.push(actionType);
            }
            
            sql += ` ORDER BY decision_count DESC, last_decision_at DESC`;

            deps.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const patterns = (rows || []).map(row => {
                    try {
                        row.payload_template = row.payload_template ? JSON.parse(row.payload_template) : {};
                    } catch (e) {
                        row.payload_template = {};
                    }
                    row.auto_apply = row.auto_apply === 1;
                    return row;
                });
                
                resolve(patterns);
            });
        });
    },

    /**
     * Enable or disable auto-apply for a pattern
     * 
     * @param {string} patternId - Pattern ID
     * @param {boolean} enabled - Enable or disable
     * @param {string} userId - User ID (for authorization)
     * @returns {Promise<{success: boolean}>}
     */
    setAutoApply: async (patternId, enabled, userId) => {
        return new Promise((resolve, reject) => {
            deps.db.run(
                `UPDATE ai_approval_patterns 
                 SET auto_apply = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND user_id = ?`,
                [enabled ? 1 : 0, patternId, userId],
                function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    resolve({ 
                        success: this.changes > 0,
                        patternId,
                        autoApply: enabled
                    });
                }
            );
        });
    },

    /**
     * Delete a pattern (user wants to "forget" this pattern)
     * 
     * @param {string} patternId - Pattern ID
     * @param {string} userId - User ID (for authorization)
     * @returns {Promise<{success: boolean}>}
     */
    deletePattern: async (patternId, userId) => {
        return new Promise((resolve, reject) => {
            deps.db.run(
                `DELETE FROM ai_approval_patterns WHERE id = ? AND user_id = ?`,
                [patternId, userId],
                function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    resolve({ success: this.changes > 0, deleted: this.changes > 0 });
                }
            );
        });
    },

    /**
     * Get pattern statistics for a user
     * 
     * @param {string} userId - User ID
     * @returns {Promise<object>} - Statistics
     */
    getPatternStats: async (userId) => {
        return new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT 
                    COUNT(*) as total_patterns,
                    SUM(CASE WHEN auto_apply = 1 THEN 1 ELSE 0 END) as auto_enabled,
                    SUM(CASE WHEN decision = 'APPROVED' THEN decision_count ELSE 0 END) as total_approvals,
                    SUM(CASE WHEN decision = 'REJECTED' THEN decision_count ELSE 0 END) as total_rejections,
                    AVG(decision_count) as avg_decisions_per_pattern
                 FROM ai_approval_patterns 
                 WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    resolve({
                        totalPatterns: row?.total_patterns || 0,
                        autoEnabled: row?.auto_enabled || 0,
                        totalApprovals: row?.total_approvals || 0,
                        totalRejections: row?.total_rejections || 0,
                        avgDecisionsPerPattern: Math.round((row?.avg_decisions_per_pattern || 0) * 10) / 10
                    });
                }
            );
        });
    },

    /**
     * Clean up old patterns that haven't been used recently
     * 
     * @param {number} daysOld - Delete patterns older than this many days
     * @returns {Promise<{deleted: number}>}
     */
    cleanupOldPatterns: async (daysOld = 180) => {
        return new Promise((resolve, reject) => {
            deps.db.run(
                `DELETE FROM ai_approval_patterns 
                 WHERE last_decision_at < datetime('now', '-' || ? || ' days')
                 AND auto_apply = 0`,
                [daysOld],
                function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    console.log(`[ApprovalPatternService] Cleaned up ${this.changes} old patterns`);
                    resolve({ deleted: this.changes });
                }
            );
        });
    }
};

module.exports = ApprovalPatternService;



