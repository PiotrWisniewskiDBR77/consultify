const db = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * ActionDecisionService
 * Handles persistence and retrieval of human decisions for AI action proposals.
 * This is an APPEND-ONLY audit trail.
 */
const ActionDecisionService = {
    /**
     * Records a decision for an action proposal.
     * Decisions are immutable - once recorded, they cannot be deleted or changed.
     * If a new decision is made for the same proposal, it is appended to the log.
     * 
     * @param {Object} data - Decision data
     * @param {string} data.proposal_id - ID of the proposal being decided on
     * @param {string} data.decision - APPROVED | REJECTED | MODIFIED
     * @param {string} data.decided_by_user_id - ID of the user who made the decision
     * @param {string} [data.reason] - Optional reason for the decision
     * @param {Object|null} [data.original_payload] - The original payload (stored for execution)
     * @param {Object|null} [data.modified_payload] - Optional modified payload if decision is MODIFIED
     * @returns {Promise<Object>} The recorded decision record
     */
    recordDecision: async (data) => {
        const { proposal_id, decision, decided_by_user_id, reason, original_payload, modified_payload } = data;

        if (!proposal_id || !decision || !decided_by_user_id) {
            throw new Error('Missing required decision fields: proposal_id, decision, or decided_by_user_id');
        }

        const validDecisions = ['APPROVED', 'REJECTED', 'MODIFIED'];
        if (!validDecisions.includes(decision)) {
            throw new Error(`Invalid decision: ${decision}. Must be one of ${validDecisions.join(', ')}`);
        }

        const id = `ad-${uuidv4()}`;
        const originalPayloadStr = original_payload ? JSON.stringify(original_payload) : null;
        const modifiedPayloadStr = modified_payload ? JSON.stringify(modified_payload) : null;

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO action_decisions (id, proposal_id, decision, decided_by_user_id, decision_reason, original_payload, modified_payload)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, proposal_id, decision, decided_by_user_id, reason, originalPayloadStr, modifiedPayloadStr],
                function (err) {
                    if (err) {
                        console.error('[ActionDecisionService] Error recording decision:', err);
                        return reject(err);
                    }
                    resolve({
                        id,
                        proposal_id,
                        decision,
                        decided_by_user_id,
                        decision_reason: reason,
                        original_payload: original_payload || null,
                        modified_payload: modified_payload || null,
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
                    resolve(rows.map(row => ({
                        ...row,
                        original_payload: row.original_payload ? JSON.parse(row.original_payload) : null,
                        modified_payload: row.modified_payload ? JSON.parse(row.modified_payload) : null
                    })));
                }
            );
        });
    },

    /**
     * Gets the full audit log of decisions.
     * @returns {Promise<Array>} List of all decision records.
     */
    getAuditLog: async () => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT ad.*, u.email as user_email, u.first_name, u.last_name, u.organization_id 
                 FROM action_decisions ad
                 LEFT JOIN users u ON ad.decided_by_user_id = u.id
                 ORDER BY ad.created_at DESC`,
                [],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows.map(row => ({
                        ...row,
                        original_payload: row.original_payload ? JSON.parse(row.original_payload) : null,
                        modified_payload: row.modified_payload ? JSON.parse(row.modified_payload) : null
                    })));
                }
            );
        });
    }
};

module.exports = ActionDecisionService;
