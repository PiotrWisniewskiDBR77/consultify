/**
 * Policy Engine (Step 9.8)
 * 
 * Enables conditional auto-approval of AI Action Proposals based on
 * clearly defined rules. Policy-driven delegation of trust.
 * 
 * CRITICAL RULES:
 * - Policy Engine NEVER executes actions
 * - Only decides if Approval = AUTO_APPROVED
 * - All decisions are deterministic and auditable
 * - Can be globally disabled by SUPERADMIN
 */

const db = require('../database');

const PolicyEngine = {
    /**
     * Safety Guardrails - Rules that cannot be bypassed
     */
    NEVER_AUTO_APPROVE_RISK_LEVELS: ['HIGH'],
    ALWAYS_MANUAL_ACTION_TYPES: ['MEETING_SCHEDULE'],

    /**
     * Evaluates whether a proposal matches any active policy rule.
     * 
     * @param {Object} params
     * @param {Object} params.proposal - The action proposal
     * @param {string} params.organizationId - Organization ID
     * @returns {Promise<{matched: boolean, decision: string|null, reason: string|null, rule_id: string|null}>}
     */
    evaluatePolicy: async ({ proposal, organizationId }) => {
        // 1. Check global policy engine status
        const isEnabled = await PolicyEngine.isGloballyEnabled();
        if (!isEnabled) {
            return { matched: false, decision: null, reason: 'Policy Engine globally disabled', rule_id: null };
        }

        // 2. Apply safety guardrails (cannot be bypassed)
        if (PolicyEngine.NEVER_AUTO_APPROVE_RISK_LEVELS.includes(proposal.risk_level)) {
            return { matched: false, decision: null, reason: 'HIGH risk requires manual approval', rule_id: null };
        }

        if (PolicyEngine.ALWAYS_MANUAL_ACTION_TYPES.includes(proposal.action_type)) {
            return { matched: false, decision: null, reason: `${proposal.action_type} always requires manual approval`, rule_id: null };
        }

        // 3. Fetch matching rules
        const rules = await PolicyEngine.getMatchingRules(organizationId, proposal);

        if (rules.length === 0) {
            return { matched: false, decision: null, reason: null, rule_id: null };
        }

        // 4. Evaluate conditions for first matching rule
        for (const rule of rules) {
            const conditionsMatch = await PolicyEngine.evaluateConditions(rule.conditions, proposal, organizationId);
            if (conditionsMatch) {
                return {
                    matched: true,
                    decision: rule.auto_decision,
                    reason: rule.auto_decision_reason,
                    rule_id: rule.id
                };
            }
        }

        return { matched: false, decision: null, reason: null, rule_id: null };
    },

    /**
     * Checks if Policy Engine is globally enabled.
     * @returns {Promise<boolean>}
     */
    isGloballyEnabled: async () => {
        return new Promise((resolve) => {
            db.get(
                `SELECT policy_engine_enabled FROM ai_policy_settings WHERE id = 'singleton'`,
                [],
                (err, row) => {
                    if (err || !row) return resolve(true); // Default to enabled
                    resolve(row.policy_engine_enabled === 1);
                }
            );
        });
    },

    /**
     * Sets global Policy Engine status (SUPERADMIN only).
     * @param {boolean} enabled
     * @param {string} userId - SUPERADMIN user ID
     * @returns {Promise<void>}
     */
    setGlobalStatus: async (enabled, userId) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE ai_policy_settings SET policy_engine_enabled = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'singleton'`,
                [enabled ? 1 : 0, userId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ success: true, enabled });
                }
            );
        });
    },

    /**
     * Gets matching rules for a proposal.
     * @param {string} organizationId
     * @param {Object} proposal
     * @returns {Promise<Array>}
     */
    getMatchingRules: async (organizationId, proposal) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM ai_policy_rules 
                 WHERE organization_id = ? 
                 AND enabled = 1 
                 AND action_type = ? 
                 AND scope = ?
                 AND (
                     max_risk_level = 'HIGH' OR
                     (max_risk_level = 'MEDIUM' AND ? IN ('LOW', 'MEDIUM')) OR
                     (max_risk_level = 'LOW' AND ? = 'LOW')
                 )
                 ORDER BY created_at ASC`,
                [organizationId, proposal.action_type, proposal.scope, proposal.risk_level, proposal.risk_level],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(r => ({
                        ...r,
                        conditions: r.conditions ? JSON.parse(r.conditions) : {}
                    })));
                }
            );
        });
    },

    /**
     * Evaluates all conditions in a rule against a proposal.
     * @param {Object} conditions - Rule conditions JSON
     * @param {Object} proposal
     * @param {string} organizationId
     * @returns {Promise<boolean>}
     */
    evaluateConditions: async (conditions, proposal, organizationId) => {
        const handlers = PolicyEngine.CONDITION_HANDLERS;

        for (const [conditionKey, conditionValue] of Object.entries(conditions)) {
            const handler = handlers[conditionKey];
            if (!handler) {
                console.warn(`[PolicyEngine] Unknown condition: ${conditionKey}`);
                return false; // Unknown condition = no match for safety
            }

            const result = await handler(conditionValue, proposal, organizationId);
            if (!result) return false; // All conditions must match
        }

        return true;
    },

    /**
     * Condition Handlers (v1)
     */
    CONDITION_HANDLERS: {
        /**
         * risk_level_lte: Matches if proposal risk <= configured level
         */
        risk_level_lte: async (value, proposal) => {
            const levels = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3 };
            return levels[proposal.risk_level] <= levels[value];
        },

        /**
         * action_type_in: Matches if proposal action type is in the list
         */
        action_type_in: async (value, proposal) => {
            if (!Array.isArray(value)) return false;
            return value.includes(proposal.action_type);
        },

        /**
         * scope_eq: Matches if proposal scope equals configured value
         */
        scope_eq: async (value, proposal) => {
            return proposal.scope === value;
        },

        /**
         * signal_in: Matches if proposal's origin signal is in the list
         */
        signal_in: async (value, proposal) => {
            if (!Array.isArray(value)) return false;
            return value.includes(proposal.origin_signal);
        },

        /**
         * max_actions_per_day: Checks if org hasn't exceeded daily auto-approved count
         */
        max_actions_per_day: async (value, proposal, organizationId) => {
            const todayCount = await PolicyEngine.getAutoApprovedCountToday(organizationId);
            return todayCount < value;
        },

        /**
         * time_window: Checks if current time is within allowed window
         * - 'business_hours': Mon-Fri 9:00-17:00
         * - 'anytime': Always matches
         */
        time_window: async (value) => {
            if (value === 'anytime') return true;
            if (value === 'business_hours') {
                const now = new Date();
                const day = now.getDay();
                const hour = now.getHours();
                // Monday-Friday, 9:00-17:00
                return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
            }
            return false;
        }
    },

    /**
     * Gets count of auto-approved decisions today for an org.
     * @param {string} organizationId
     * @returns {Promise<number>}
     */
    getAutoApprovedCountToday: async (organizationId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count FROM action_decisions 
                 WHERE organization_id = ? 
                 AND decided_by_user_id = 'SYSTEM_POLICY_ENGINE'
                 AND DATE(created_at) = DATE('now')`,
                [organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row?.count || 0);
                }
            );
        });
    },

    /**
     * Gets all policy rules for an organization.
     * @param {string} organizationId
     * @returns {Promise<Array>}
     */
    getRules: async (organizationId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM ai_policy_rules WHERE organization_id = ? ORDER BY created_at DESC`,
                [organizationId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(r => ({
                        ...r,
                        conditions: r.conditions ? JSON.parse(r.conditions) : {}
                    })));
                }
            );
        });
    },

    /**
     * Gets all policy rules (SUPERADMIN only).
     * @returns {Promise<Array>}
     */
    getAllRules: async () => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT pr.*, o.name as organization_name 
                 FROM ai_policy_rules pr
                 LEFT JOIN organizations o ON pr.organization_id = o.id
                 ORDER BY pr.created_at DESC`,
                [],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(r => ({
                        ...r,
                        conditions: r.conditions ? JSON.parse(r.conditions) : {}
                    })));
                }
            );
        });
    },

    /**
     * Toggles rule enabled status.
     * @param {string} ruleId
     * @param {boolean} enabled
     * @returns {Promise<Object>}
     */
    toggleRule: async (ruleId, enabled) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE ai_policy_rules SET enabled = ? WHERE id = ?`,
                [enabled ? 1 : 0, ruleId],
                function (err) {
                    if (err) return reject(err);
                    if (this.changes === 0) {
                        return reject(new Error('Rule not found'));
                    }
                    resolve({ success: true, rule_id: ruleId, enabled });
                }
            );
        });
    },

    /**
     * Creates a new policy rule.
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    createRule: async (data) => {
        const { v4: uuidv4 } = require('uuid');
        const id = `pr-${uuidv4()}`;

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO ai_policy_rules 
                 (id, organization_id, action_type, scope, max_risk_level, conditions, auto_decision, auto_decision_reason, created_by_user_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    data.organization_id,
                    data.action_type,
                    data.scope,
                    data.max_risk_level,
                    JSON.stringify(data.conditions || {}),
                    data.auto_decision,
                    data.auto_decision_reason,
                    data.created_by_user_id
                ],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id, ...data });
                }
            );
        });
    },

    /**
     * Gets global policy engine status.
     * @returns {Promise<Object>}
     */
    getGlobalStatus: async () => {
        return new Promise((resolve) => {
            db.get(
                `SELECT * FROM ai_policy_settings WHERE id = 'singleton'`,
                [],
                (err, row) => {
                    if (err || !row) {
                        return resolve({ policy_engine_enabled: true, updated_by: null, updated_at: null });
                    }
                    resolve({
                        policy_engine_enabled: row.policy_engine_enabled === 1,
                        updated_by: row.updated_by,
                        updated_at: row.updated_at
                    });
                }
            );
        });
    }
};

module.exports = PolicyEngine;
