const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const ActionProposalEngine = require('./actionProposalEngine');
const PolicyEngine = require('./policyEngine');
const auditLogger = require('../utils/auditLogger');
const { ACTION_ERROR_CODES, classifyError } = require('./actionErrors');
const EvidenceLedgerService = require('../services/evidenceLedgerService');


/**
 * ActionDecisionService
 * Handles persistence and retrieval of human decisions for AI action proposals.
 * This is an APPEND-ONLY audit trail.
 */
const ActionDecisionService = {
    // Defines which fields can be modified during human review, per action type.
    MODIFIED_ALLOWLIST: {
        'TASK_CREATE': ['title', 'description', 'due_date', 'assignee_user_id'],
        'PLAYBOOK_ASSIGN': ['playbook_key', 'target_user_id'],
        'MEETING_SCHEDULE': ['participants', 'title', 'proposed_timeslot'],
        'ROLE_SUGGESTION': ['suggested_role', 'entity_id']
    },

    /**
     * Records a decision for an action proposal.
     * 
     * @param {Object} data - Decision data
     * @param {string} data.proposal_id - ID of the proposal
     * @param {string} data.organization_id - Org of the admin
     * @param {string} data.decision - APPROVED | REJECTED | MODIFIED
     * @param {string} data.decided_by_user_id - ID of the admin
     * @param {string} [data.reason] - Optional reason
     * @param {Object} [data.modified_payload] - Optional modified payload
     * @returns {Promise<Object>} The recorded decision record
     */
    recordDecision: async (data) => {
        const { proposal_id, organization_id, decision, decided_by_user_id, reason, modified_payload } = data;

        if (!proposal_id || !decision || !decided_by_user_id || !organization_id) {
            throw new Error('Missing required decision fields: proposal_id, organization_id, decision, or decided_by_user_id');
        }

        const validDecisions = ['APPROVED', 'REJECTED', 'MODIFIED'];
        if (!validDecisions.includes(decision)) {
            const error = new Error(`Invalid decision: ${decision}. Must be one of ${validDecisions.join(', ')}`);
            error.status = 400;
            throw error;
        }

        // 1. Fetch Proposal Server-Side (SNAPSHOT)
        const proposal = await ActionProposalEngine.getProposalById(organization_id, proposal_id);
        if (!proposal) {
            const error = new Error(`Proposal ${proposal_id} not found for this organization.`);
            error.status = 404;
            throw error;
        }

        // 2. Check for Double Approval Conflict
        const existingDecisions = await ActionDecisionService.getDecisionsByProposal(proposal_id);
        const hasActiveApproval = existingDecisions.some(d => d.decision === 'APPROVED' || d.decision === 'MODIFIED');
        if (hasActiveApproval && (decision === 'APPROVED' || decision === 'MODIFIED')) {
            const error = new Error(`Proposal ${proposal_id} already has an active approval.`);
            error.status = 409;
            throw error;
        }

        // 3. Modified Payload Validation (ALLOWLIST)
        let finalModifiedPayload = null;
        if (decision === 'MODIFIED') {
            if (!modified_payload) {
                const error = new Error('modified_payload is required for MODIFIED decision');
                error.status = 400;
                throw error;
            }

            const allowlist = ActionDecisionService.MODIFIED_ALLOWLIST[proposal.action_type] || [];
            const filteredPayload = {};
            const keys = Object.keys(modified_payload);

            for (const key of keys) {
                if (allowlist.includes(key)) {
                    filteredPayload[key] = modified_payload[key];
                } else {
                    const error = new Error(`Field '${key}' is not allowed to be modified for action type ${proposal.action_type}`);
                    error.status = 400;
                    throw error;
                }
            }
            finalModifiedPayload = filteredPayload;
        }

        const id = `ad-${uuidv4()}`;
        // Propagate correlation_id from proposal, or generate new if missing
        const correlationId = proposal.correlation_id || `corr-${uuidv4()}`;
        const snapshotStr = JSON.stringify(proposal);
        const modifiedPayloadStr = finalModifiedPayload ? JSON.stringify(finalModifiedPayload) : null;

        // Check for policy_rule_id (set by autoDecideByPolicy or passed from caller)
        const policyRuleId = data.policy_rule_id || null;

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO action_decisions (
                    id, proposal_id, organization_id, correlation_id, action_type, scope, 
                    decision, decided_by_user_id, decision_reason, 
                    proposal_snapshot, modified_payload, policy_rule_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, proposal_id, organization_id, correlationId, proposal.action_type, proposal.scope,
                    decision, decided_by_user_id, reason || null,
                    snapshotStr, modifiedPayloadStr, policyRuleId
                ],
                function (err) {
                    if (err) {
                        auditLogger.error('DECISION_RECORD_FAILED', {
                            correlation_id: correlationId,
                            organization_id,
                            proposal_id,
                            decision_id: id,
                            action_type: proposal.action_type,
                            error_code: classifyError(err),
                            error_message: err.message
                        });
                        return reject(err);
                    }

                    auditLogger.info('DECISION_RECORDED', {
                        correlation_id: correlationId,
                        organization_id,
                        proposal_id,
                        decision_id: id,
                        action_type: proposal.action_type,
                        status: decision
                    });

                    // Step 15: Record evidence and reasoning for this decision
                    (async () => {
                        try {
                            // Create evidence object from proposal snapshot
                            const evidence = await EvidenceLedgerService.createEvidenceObject(
                                organization_id,
                                EvidenceLedgerService.EVIDENCE_TYPES.SIGNAL,
                                'actionDecisionService',
                                {
                                    proposal_id,
                                    action_type: proposal.action_type,
                                    scope: proposal.scope,
                                    signal_type: proposal.signal_type,
                                    risk_level: proposal.risk_level,
                                    confidence: proposal.confidence,
                                    context_snapshot: proposal.context_snapshot
                                }
                            );

                            // Link evidence to decision
                            await EvidenceLedgerService.linkEvidence(
                                EvidenceLedgerService.ENTITY_TYPES.DECISION,
                                id,
                                evidence.id,
                                1.0,
                                `Proposal snapshot at decision time`
                            );

                            // Record reasoning entry
                            const assumptions = [];
                            if (proposal.simulation) {
                                assumptions.push(`Impact simulation: ${proposal.simulation.impact_summary || 'analyzed'}`);
                            }
                            if (policyRuleId) {
                                assumptions.push(`Policy rule ${policyRuleId} was applied`);
                            }

                            await EvidenceLedgerService.recordReasoning(
                                'decision',
                                id,
                                proposal.reasoning || `Decision ${decision} for ${proposal.action_type} action`,
                                assumptions,
                                proposal.confidence || 0.5
                            );
                        } catch (evidenceErr) {
                            // Non-blocking: log but don't fail the decision
                            console.warn('[ActionDecisionService] Evidence recording failed:', evidenceErr.message);
                        }
                    })();

                    resolve({
                        id,
                        proposal_id,
                        organization_id,
                        correlation_id: correlationId,
                        action_type: proposal.action_type,
                        scope: proposal.scope,
                        decision,
                        decided_by_user_id,
                        decision_reason: reason || null,
                        proposal_snapshot: proposal,
                        modified_payload: finalModifiedPayload,
                        policy_rule_id: policyRuleId,
                        created_at: new Date().toISOString()
                    });
                }
            );
        });
    },


    /**
     * Gets all decisions for a specific proposal.
     * @param {string} proposalId - The proposal ID.
     * @returns {Promise<Array>} List of decision records.
     */
    getDecisionsByProposal: async (proposalId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM action_decisions WHERE proposal_id = ? ORDER BY created_at ASC`,
                [proposalId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(row => ({
                        ...row,
                        proposal_snapshot: row.proposal_snapshot ? JSON.parse(row.proposal_snapshot) : null,
                        modified_payload: row.modified_payload ? JSON.parse(row.modified_payload) : null
                    })));
                }
            );
        });
    },

    /**
     * Gets the audit log of decisions with organization isolation.
     * @param {string} organizationId - The organization ID.
     * @param {Object} [filters] - Optional filters (actionType, decision, limit)
     * @returns {Promise<Array>} List of decision records.
     */
    getAuditLog: async (organizationId, filters = {}) => {
        const { actionType, decision, limit = 50, offset = 0 } = filters;

        return new Promise((resolve, reject) => {
            let sql = `SELECT ad.*, u.email as user_email, u.first_name, u.last_name, u.organization_id 
                       FROM action_decisions ad
                       LEFT JOIN users u ON ad.decided_by_user_id = u.id
                       WHERE 1=1 `;
            const params = [];

            if (organizationId !== 'SUPERADMIN_BYPASS') {
                sql += ` AND ad.organization_id = ? `;
                params.push(organizationId);
            }

            if (actionType) {
                sql += ` AND ad.action_type = ? `;
                params.push(actionType);
            }

            if (decision) {
                sql += ` AND ad.decision = ? `;
                params.push(decision);
            }

            sql += ` ORDER BY ad.created_at DESC LIMIT ? OFFSET ? `;
            params.push(limit, offset);

            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve((rows || []).map(row => ({
                    ...row,
                    proposal_snapshot: row.proposal_snapshot ? JSON.parse(row.proposal_snapshot) : null,
                    modified_payload: row.modified_payload ? JSON.parse(row.modified_payload) : null
                })));
            });
        });
    },

    /**
     * Evaluates a proposal against policy rules (without recording a decision).
     * Used for UI display and pre-check.
     * 
     * @param {Object} proposal - The AI action proposal
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Object>} Policy evaluation result
     */
    evaluatePolicyForProposal: async (proposal, organizationId) => {
        return PolicyEngine.evaluatePolicy({ proposal, organizationId });
    },

    /**
     * Automatically decides on a proposal based on policy rules.
     * If a matching policy is found, records the decision with SYSTEM_POLICY_ENGINE as decider.
     * 
     * @param {Object} proposal - The AI action proposal
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Object|null>} The recorded decision if auto-approved, null otherwise
     */
    autoDecideByPolicy: async (proposal, organizationId) => {
        // Evaluate policy
        const policyResult = await PolicyEngine.evaluatePolicy({ proposal, organizationId });

        if (!policyResult.matched) {
            return null; // No matching policy, requires manual approval
        }

        // Record the auto-decision
        const decisionRecord = await ActionDecisionService.recordDecision({
            proposal_id: proposal.proposal_id,
            organization_id: organizationId,
            decision: policyResult.decision,
            decided_by_user_id: 'SYSTEM_POLICY_ENGINE',
            reason: policyResult.reason,
            policy_rule_id: policyResult.rule_id
        });

        auditLogger.info('POLICY_AUTO_DECISION', {
            organization_id: organizationId,
            proposal_id: proposal.proposal_id,
            decision: policyResult.decision,
            rule_id: policyResult.rule_id,
            reason: policyResult.reason
        });

        return {
            ...decisionRecord,
            policy_matched: true,
            policy_result: policyResult
        };
    }
};

module.exports = ActionDecisionService;
