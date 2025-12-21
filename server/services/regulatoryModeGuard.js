/**
 * Regulatory Mode Guard Service
 * 
 * Central enforcement layer for Regulatory Mode.
 * When enabled, AI can ONLY explain, warn, and educate.
 * All mutations are blocked regardless of AI Role.
 * 
 * AI Core Layer — Enterprise PMO Brain
 */

// Dependency injection container (for deterministic unit tests)
const deps = {
    db: require('../database'),
    AIAuditLogger: require('./aiAuditLogger')
};

// Actions that are ALWAYS allowed in regulatory mode
const ALLOWED_ACTIONS = [
    'EXPLAIN_CONTEXT',
    'ANALYZE_RISKS',
    'PREPARE_DECISION_SUMMARY',
    'EDUCATE',
    'WARN',
    'DESCRIBE',
    'LIST',
    'SUMMARIZE',
    'REVIEW'
];

// Actions that are ALWAYS blocked in regulatory mode
const BLOCKED_ACTIONS = [
    'CREATE_DRAFT_TASK',
    'CREATE_DRAFT_INITIATIVE',
    'SUGGEST_ROADMAP_CHANGE',
    'EXECUTE_ACTION',
    'UPDATE_STATUS',
    'ASSIGN_USER',
    'MODIFY_ENTITY',
    'DELETE_ENTITY',
    'GENERATE_REPORT',
    'CREATE_DECISION',
    'APPROVE_ACTION',
    'REJECT_ACTION'
];

// Verbs that indicate action intent (used for prompt filtering)
const FORBIDDEN_VERBS = [
    'create', 'execute', 'update', 'delete', 'assign',
    'modify', 'change', 'add', 'remove', 'submit',
    'approve', 'reject', 'complete', 'start', 'finish'
];

// Advisory language that should be used
const ADVISORY_PHRASES = [
    'consider', 'you may want to', 'we recommend evaluating',
    'it would be advisable to', 'you should review',
    'it is suggested that', 'you might consider'
];

const RegulatoryModeGuard = {
    ALLOWED_ACTIONS,
    BLOCKED_ACTIONS,
    FORBIDDEN_VERBS,
    ADVISORY_PHRASES,

    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },

    /**
     * Check if regulatory mode is enabled for a project
     * @param {string} projectId - Project ID to check
     * @returns {Promise<boolean>} - True if regulatory mode is enabled
     */
    isEnabled: async (projectId) => {
        if (!projectId) return false;

        return new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT regulatory_mode_enabled FROM projects WHERE id = ?`,
                [projectId],
                (err, row) => {
                    if (err) {
                        console.error('RegulatoryModeGuard.isEnabled error:', err);
                        // Fail-safe: if error, assume enabled for safety
                        resolve(true);
                        return;
                    }
                    // Default to enabled (1) if column doesn't exist or is null
                    resolve(row?.regulatory_mode_enabled !== 0);
                }
            );
        });
    },

    /**
     * Set regulatory mode status for a project
     * @param {string} projectId - Project ID
     * @param {boolean} enabled - Whether to enable or disable
     * @returns {Promise<{success: boolean}>}
     */
    setEnabled: async (projectId, enabled) => {
        return new Promise((resolve, reject) => {
            deps.db.run(
                `UPDATE projects SET regulatory_mode_enabled = ? WHERE id = ?`,
                [enabled ? 1 : 0, projectId],
                function (err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({ success: this.changes > 0 });
                }
            );
        });
    },

    /**
     * Check if an action is allowed under regulatory mode
     * @param {string} actionType - The action being attempted
     * @returns {boolean} - True if allowed
     */
    isActionAllowed: (actionType) => {
        if (!actionType) return true;
        const normalizedAction = actionType.toUpperCase();

        // Explicitly blocked actions
        if (BLOCKED_ACTIONS.includes(normalizedAction)) {
            return false;
        }

        // Explicitly allowed actions
        if (ALLOWED_ACTIONS.includes(normalizedAction)) {
            return true;
        }

        // Check if action contains mutation keywords
        const lowerAction = actionType.toLowerCase();
        const hasMutationKeyword = ['create', 'update', 'delete', 'modify', 'execute', 'assign']
            .some(keyword => lowerAction.includes(keyword));

        return !hasMutationKeyword;
    },

    /**
     * Main enforcement function - call before any AI-triggered mutation
     * @param {Object} context - Context with userId, organizationId, projectId
     * @param {string} attemptedAction - The action being attempted
     * @returns {Promise<{blocked: boolean, reason?: string}>}
     */
    enforceRegulatoryMode: async (context, attemptedAction) => {
        const { projectId } = context;

        if (!projectId) {
            return { blocked: false };
        }

        const isEnabled = await RegulatoryModeGuard.isEnabled(projectId);

        if (!isEnabled) {
            return { blocked: false };
        }

        const isAllowed = RegulatoryModeGuard.isActionAllowed(attemptedAction);

        if (!isAllowed) {
            // Log the blocked attempt
            await RegulatoryModeGuard.logBlockedAttempt(context, attemptedAction, 'REGULATORY_MODE');

            return {
                blocked: true,
                reason: 'REGULATORY_MODE',
                message: `Action "${attemptedAction}" blocked: Regulatory Mode is enabled. AI can only explain and advise.`
            };
        }

        return { blocked: false };
    },

    /**
     * Log a blocked action attempt to the audit trail
     * @param {Object} context - Context with userId, organizationId, projectId
     * @param {string} attemptedAction - The action that was blocked
     * @param {string} reason - Reason for blocking
     */
    logBlockedAttempt: async (context, attemptedAction, reason) => {
        const { userId, organizationId, projectId } = context;

        try {
            await deps.AIAuditLogger.logInteraction({
                userId: userId || 'SYSTEM',
                organizationId: organizationId || 'UNKNOWN',
                projectId,
                actionType: 'AI_ACTION_BLOCKED',
                actionDescription: `Blocked action: ${attemptedAction}`,
                contextSnapshot: {
                    attemptedAction,
                    reason,
                    timestamp: new Date().toISOString(),
                    regulatoryModeEnabled: true
                },
                dataSourcesUsed: [],
                aiRole: 'ADVISOR',
                policyLevel: 'REGULATORY_MODE',
                confidenceLevel: 1.0,
                aiSuggestion: null,
                userDecision: 'BLOCKED',
                userFeedback: null
            });
        } catch (err) {
            console.error('RegulatoryModeGuard.logBlockedAttempt error:', err);
        }
    },

    /**
     * Get the regulatory mode prompt constraints
     * Used to modify AI behavior when regulatory mode is active
     * @returns {string} - Prompt text to inject
     */
    getRegulatoryPrompt: () => {
        return `
=== REGULATORY COMPLIANCE MODE ACTIVE ===

You are operating in STRICT COMPLIANCE MODE for a regulated organization.

ABSOLUTE PROHIBITIONS (NEVER DO THESE):
- Do NOT use action verbs like: create, execute, update, delete, assign, modify, change, add, remove, submit, approve, reject, complete, start, finish
- Do NOT propose or suggest any executable actions
- Do NOT generate drafts, tasks, initiatives, or any data objects
- Do NOT offer to make changes to the system
- Do NOT use phrases like "I will create...", "Let me update...", "I can execute..."

REQUIRED BEHAVIOR:
- Use ONLY advisory language: "consider", "you may want to", "we recommend evaluating", "it would be advisable to"
- Focus EXCLUSIVELY on: explanations, risk descriptions, educational content, context analysis
- Always clarify that the USER must take any action themselves
- When asked to do something, explain what SHOULD be done, not offer to do it

EXAMPLE RESPONSES:
❌ WRONG: "I'll create a task for this."
✅ CORRECT: "You may want to consider creating a task for this. The task should include..."

❌ WRONG: "Let me update the status."
✅ CORRECT: "It would be advisable to update the status to reflect the current state."

This is a legal and compliance requirement. Violations may result in regulatory penalties.
=== END REGULATORY MODE ===
`;
    },

    /**
     * Get a summary of regulatory mode status for a project
     * @param {string} projectId - Project ID
     * @returns {Promise<Object>} - Status summary
     */
    getStatus: async (projectId) => {
        const isEnabled = await RegulatoryModeGuard.isEnabled(projectId);

        return {
            enabled: isEnabled,
            allowedActions: ALLOWED_ACTIONS,
            blockedActions: BLOCKED_ACTIONS,
            description: isEnabled
                ? 'AI is restricted to advisory-only mode. No system modifications allowed.'
                : 'AI operates with normal policy-based permissions.'
        };
    }
};

module.exports = RegulatoryModeGuard;
