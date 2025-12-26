// PMO Status State Machine - Validates status transitions
// Step 3: PMO Objects, Statuses & Stage Gates
// Updated 2024-12-26: New Initiative Lifecycle with module transitions

/**
 * Initiative Lifecycle States
 * 
 * Module Flow:
 * - DRAFT: Created in Assessment Module (Module 2)
 * - PLANNING: Transferred to Initiative Management Module (Module 3)
 * - REVIEW: Pending approval reviews
 * - APPROVED: Ready for execution, transfers to Execution Module (Module 4/5)
 * - EXECUTING: Active work in progress
 * - BLOCKED: Temporarily blocked (requires reason)
 * - DONE: Successfully completed
 * - CANCELLED: Terminated before completion
 * - ARCHIVED: Historical record (post-completion or post-cancellation)
 */
const INITIATIVE_STATUSES = {
    // Assessment Module (Module 2)
    DRAFT: 'DRAFT',
    
    // Initiative Management Module (Module 3)
    PLANNING: 'PLANNING',
    REVIEW: 'REVIEW',
    APPROVED: 'APPROVED',
    
    // Execution Module (Module 4/5)
    EXECUTING: 'EXECUTING',
    BLOCKED: 'BLOCKED',
    DONE: 'DONE',
    
    // Terminal States
    CANCELLED: 'CANCELLED',
    ARCHIVED: 'ARCHIVED'
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

/**
 * Valid Initiative Transitions
 * 
 * Key Module Boundaries:
 * - DRAFT → PLANNING: Transfers from Assessment to Initiative Management
 * - APPROVED → EXECUTING: Transfers from Initiative Management to Execution
 * - DONE/CANCELLED → ARCHIVED: Historical archival
 */
const INITIATIVE_TRANSITIONS = {
    // Assessment Module (Module 2)
    [INITIATIVE_STATUSES.DRAFT]: [
        INITIATIVE_STATUSES.PLANNING,    // Transfer to Initiative Management (Module 3)
        INITIATIVE_STATUSES.CANCELLED    // Cancel before planning
    ],
    
    // Initiative Management Module (Module 3)
    [INITIATIVE_STATUSES.PLANNING]: [
        INITIATIVE_STATUSES.REVIEW,      // Submit for approval
        INITIATIVE_STATUSES.DRAFT,       // Return to draft
        INITIATIVE_STATUSES.CANCELLED    // Cancel during planning
    ],
    [INITIATIVE_STATUSES.REVIEW]: [
        INITIATIVE_STATUSES.APPROVED,    // Approved - ready for execution
        INITIATIVE_STATUSES.PLANNING,    // Revision required - back to planning
        INITIATIVE_STATUSES.CANCELLED    // Cancel during review
    ],
    [INITIATIVE_STATUSES.APPROVED]: [
        INITIATIVE_STATUSES.EXECUTING,   // Transfer to Execution Module (Module 4/5)
        INITIATIVE_STATUSES.PLANNING,    // Reopen for changes
        INITIATIVE_STATUSES.CANCELLED    // Cancel before execution
    ],
    
    // Execution Module (Module 4/5)
    [INITIATIVE_STATUSES.EXECUTING]: [
        INITIATIVE_STATUSES.BLOCKED,     // Blocked by issue
        INITIATIVE_STATUSES.DONE,        // Successfully completed
        INITIATIVE_STATUSES.CANCELLED    // Cancel during execution
    ],
    [INITIATIVE_STATUSES.BLOCKED]: [
        INITIATIVE_STATUSES.EXECUTING,   // Unblocked - resume execution
        INITIATIVE_STATUSES.CANCELLED    // Cancel while blocked
    ],
    
    // Terminal States
    [INITIATIVE_STATUSES.DONE]: [
        INITIATIVE_STATUSES.ARCHIVED     // Archive completed initiative
    ],
    [INITIATIVE_STATUSES.CANCELLED]: [
        INITIATIVE_STATUSES.ARCHIVED     // Archive cancelled initiative
    ],
    [INITIATIVE_STATUSES.ARCHIVED]: []   // Final state - no transitions
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

        // Transition to DONE requires all tasks done
        if (to === INITIATIVE_STATUSES.DONE) {
            if (context.pendingTasks > 0) {
                return { valid: false, reason: `Cannot complete: ${context.pendingTasks} tasks still pending` };
            }
            if (context.hasBlockingDecisions) {
                return { valid: false, reason: 'Cannot complete: Open blocking decisions exist' };
            }
        }

        // Transition PLANNING → REVIEW: Submit for approval
        if (from === INITIATIVE_STATUSES.PLANNING && to === INITIATIVE_STATUSES.REVIEW) {
            // Check minimum charter completeness
            if (context.charterCompleteness !== undefined && context.charterCompleteness < 60) {
                return { valid: false, reason: `Charter completeness too low (${context.charterCompleteness}%). Minimum 60% required.` };
            }
        }

        // Transition REVIEW → APPROVED: Requires all reviews completed
        if (from === INITIATIVE_STATUSES.REVIEW && to === INITIATIVE_STATUSES.APPROVED) {
            if (context.requiresApproval && !context.isApproved) {
                return { valid: false, reason: 'Governance approval required for this transition' };
            }
            if (context.pendingReviews > 0) {
                return { valid: false, reason: `Cannot approve: ${context.pendingReviews} reviews still pending` };
            }
        }

        // Transition APPROVED → EXECUTING: Entering execution module
        if (from === INITIATIVE_STATUSES.APPROVED && to === INITIATIVE_STATUSES.EXECUTING) {
            // Optionally check if scheduled in roadmap
            if (context.requiresScheduling && !context.isScheduled) {
                return { valid: false, reason: 'Initiative must be scheduled in roadmap before execution' };
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
    },

    /**
     * Get the module an initiative belongs to based on status
     * @param {string} status - Current initiative status
     * @returns {'ASSESSMENT' | 'INITIATIVE_MANAGEMENT' | 'EXECUTION' | 'TERMINAL'}
     */
    getInitiativeModule: (status) => {
        switch (status) {
            case INITIATIVE_STATUSES.DRAFT:
                return 'ASSESSMENT';
            case INITIATIVE_STATUSES.PLANNING:
            case INITIATIVE_STATUSES.REVIEW:
            case INITIATIVE_STATUSES.APPROVED:
                return 'INITIATIVE_MANAGEMENT';
            case INITIATIVE_STATUSES.EXECUTING:
            case INITIATIVE_STATUSES.BLOCKED:
                return 'EXECUTION';
            case INITIATIVE_STATUSES.DONE:
            case INITIATIVE_STATUSES.CANCELLED:
            case INITIATIVE_STATUSES.ARCHIVED:
                return 'TERMINAL';
            default:
                return 'UNKNOWN';
        }
    },

    /**
     * Check if transition crosses module boundary
     * @param {string} from - Current status
     * @param {string} to - Target status
     * @returns {{ crossesModule: boolean, fromModule: string, toModule: string }}
     */
    isModuleTransition: (from, to) => {
        const fromModule = StatusMachine.getInitiativeModule(from);
        const toModule = StatusMachine.getInitiativeModule(to);
        return {
            crossesModule: fromModule !== toModule,
            fromModule,
            toModule
        };
    },

    /**
     * Get display label for status
     * @param {string} status - Initiative status
     * @returns {string}
     */
    getStatusLabel: (status) => {
        const labels = {
            [INITIATIVE_STATUSES.DRAFT]: 'Draft',
            [INITIATIVE_STATUSES.PLANNING]: 'Planning',
            [INITIATIVE_STATUSES.REVIEW]: 'In Review',
            [INITIATIVE_STATUSES.APPROVED]: 'Approved',
            [INITIATIVE_STATUSES.EXECUTING]: 'Executing',
            [INITIATIVE_STATUSES.BLOCKED]: 'Blocked',
            [INITIATIVE_STATUSES.DONE]: 'Done',
            [INITIATIVE_STATUSES.CANCELLED]: 'Cancelled',
            [INITIATIVE_STATUSES.ARCHIVED]: 'Archived'
        };
        return labels[status] || status;
    }
};

module.exports = StatusMachine;
