// PMO Status State Machine - Validates status transitions
// Step 3: PMO Objects, Statuses & Stage Gates

const INITIATIVE_STATUSES = {
    DRAFT: 'DRAFT',
    PLANNED: 'PLANNED',
    APPROVED: 'APPROVED',
    IN_EXECUTION: 'IN_EXECUTION',
    BLOCKED: 'BLOCKED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED'
};

const TASK_STATUSES = {
    TODO: 'TODO',
    IN_PROGRESS: 'IN_PROGRESS',
    BLOCKED: 'BLOCKED',
    DONE: 'DONE'
};

const DECISION_STATUSES = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED'
};

// Valid Initiative Transitions
const INITIATIVE_TRANSITIONS = {
    [INITIATIVE_STATUSES.DRAFT]: [INITIATIVE_STATUSES.PLANNED, INITIATIVE_STATUSES.CANCELLED],
    [INITIATIVE_STATUSES.PLANNED]: [INITIATIVE_STATUSES.APPROVED, INITIATIVE_STATUSES.DRAFT, INITIATIVE_STATUSES.CANCELLED],
    [INITIATIVE_STATUSES.APPROVED]: [INITIATIVE_STATUSES.IN_EXECUTION, INITIATIVE_STATUSES.BLOCKED, INITIATIVE_STATUSES.CANCELLED],
    [INITIATIVE_STATUSES.IN_EXECUTION]: [INITIATIVE_STATUSES.BLOCKED, INITIATIVE_STATUSES.COMPLETED, INITIATIVE_STATUSES.CANCELLED],
    [INITIATIVE_STATUSES.BLOCKED]: [INITIATIVE_STATUSES.IN_EXECUTION, INITIATIVE_STATUSES.CANCELLED],
    [INITIATIVE_STATUSES.COMPLETED]: [], // Terminal state
    [INITIATIVE_STATUSES.CANCELLED]: []  // Terminal state
};

// Valid Task Transitions
const TASK_TRANSITIONS = {
    [TASK_STATUSES.TODO]: [TASK_STATUSES.IN_PROGRESS, TASK_STATUSES.BLOCKED],
    [TASK_STATUSES.IN_PROGRESS]: [TASK_STATUSES.BLOCKED, TASK_STATUSES.DONE, TASK_STATUSES.TODO],
    [TASK_STATUSES.BLOCKED]: [TASK_STATUSES.TODO, TASK_STATUSES.IN_PROGRESS],
    [TASK_STATUSES.DONE]: [TASK_STATUSES.IN_PROGRESS] // Allow reopening
};

const StatusMachine = {
    INITIATIVE_STATUSES,
    TASK_STATUSES,
    DECISION_STATUSES,

    /**
     * Check if initiative status transition is valid
     */
    canTransitionInitiative: (from, to) => {
        const allowed = INITIATIVE_TRANSITIONS[from] || [];
        return allowed.includes(to);
    },

    /**
     * Check if task status transition is valid
     */
    canTransitionTask: (from, to) => {
        const allowed = TASK_TRANSITIONS[from] || [];
        return allowed.includes(to);
    },

    /**
     * Validate initiative status transition with context
     * @returns {{ valid: boolean, reason?: string }}
     */
    validateInitiativeTransition: (from, to, context = {}) => {
        // Check basic transition validity
        if (!StatusMachine.canTransitionInitiative(from, to)) {
            return { valid: false, reason: `Cannot transition from ${from} to ${to}` };
        }

        // Transition to BLOCKED requires reason
        if (to === INITIATIVE_STATUSES.BLOCKED && !context.blockedReason) {
            return { valid: false, reason: 'Blocked status requires a reason' };
        }

        // Transition to COMPLETED requires all tasks done
        if (to === INITIATIVE_STATUSES.COMPLETED) {
            if (context.pendingTasks > 0) {
                return { valid: false, reason: `Cannot complete: ${context.pendingTasks} tasks still pending` };
            }
            if (context.hasBlockingDecisions) {
                return { valid: false, reason: 'Cannot complete: Open blocking decisions exist' };
            }
        }

        // Transition from PLANNED to APPROVED may require governance check
        if (from === INITIATIVE_STATUSES.PLANNED && to === INITIATIVE_STATUSES.APPROVED) {
            if (context.requiresApproval && !context.isApproved) {
                return { valid: false, reason: 'Governance approval required for this transition' };
            }
        }

        return { valid: true };
    },

    /**
     * Validate task status transition with context
     */
    validateTaskTransition: (from, to, context = {}) => {
        if (!StatusMachine.canTransitionTask(from, to)) {
            return { valid: false, reason: `Cannot transition from ${from} to ${to}` };
        }

        // Transition to BLOCKED requires reason and type
        if (to === TASK_STATUSES.BLOCKED) {
            if (!context.blockedReason) {
                return { valid: false, reason: 'Blocked status requires a reason' };
            }
            if (!context.blockerType) {
                return { valid: false, reason: 'Blocked status requires a blocker type' };
            }
        }

        return { valid: true };
    },

    /**
     * Get allowed transitions from current status
     */
    getAllowedInitiativeTransitions: (currentStatus) => {
        return INITIATIVE_TRANSITIONS[currentStatus] || [];
    },

    getAllowedTaskTransitions: (currentStatus) => {
        return TASK_TRANSITIONS[currentStatus] || [];
    }
};

module.exports = StatusMachine;
