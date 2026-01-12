// PMO Status State Machine - Validates status transitions
// Step 3: PMO Objects, Statuses & Stage Gates
// Updated 2024-12-26: New Initiative Lifecycle with module transitions

export const INITIATIVE_STATUSES = {
    DRAFT: 'DRAFT',
    PLANNING: 'PLANNING',
    REVIEW: 'REVIEW',
    APPROVED: 'APPROVED',
    EXECUTING: 'EXECUTING',
    BLOCKED: 'BLOCKED',
    DONE: 'DONE',
    CANCELLED: 'CANCELLED',
    ARCHIVED: 'ARCHIVED',
} as const;

export const TASK_STATUSES = {
    TODO: 'TODO',
    IN_PROGRESS: 'IN_PROGRESS',
    BLOCKED: 'BLOCKED',
    DONE: 'DONE',
} as const;

export const DECISION_STATUSES = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
} as const;

export const EXECUTION_STAGES = {
    KICKOFF: 'KICKOFF',
    IN_PROGRESS: 'IN_PROGRESS',
    REVIEW: 'REVIEW',
    DELIVERY: 'DELIVERY',
} as const;

type InitiativeStatus = (typeof INITIATIVE_STATUSES)[keyof typeof INITIATIVE_STATUSES];
type TaskStatus = (typeof TASK_STATUSES)[keyof typeof TASK_STATUSES];
type ExecutionStage = (typeof EXECUTION_STAGES)[keyof typeof EXECUTION_STAGES];

type InitiativeContext = {
    blockedReason?: string;
    pendingTasks?: number;
    hasBlockingDecisions?: boolean;
    charterCompleteness?: number;
    requiresApproval?: boolean;
    isApproved?: boolean;
    pendingReviews?: number;
    requiresScheduling?: boolean;
    isScheduled?: boolean;
};

type TaskContext = {
    blockedReason?: string;
    blockerType?: string;
};

type StageContext = {
    pendingReviews?: number;
};

const EXECUTION_STAGE_TRANSITIONS: Record<ExecutionStage, ExecutionStage[]> = {
    [EXECUTION_STAGES.KICKOFF]: [EXECUTION_STAGES.IN_PROGRESS],
    [EXECUTION_STAGES.IN_PROGRESS]: [EXECUTION_STAGES.REVIEW, EXECUTION_STAGES.KICKOFF],
    [EXECUTION_STAGES.REVIEW]: [EXECUTION_STAGES.IN_PROGRESS, EXECUTION_STAGES.DELIVERY],
    [EXECUTION_STAGES.DELIVERY]: [EXECUTION_STAGES.REVIEW],
};

const INITIATIVE_TRANSITIONS: Record<InitiativeStatus, InitiativeStatus[]> = {
    [INITIATIVE_STATUSES.DRAFT]: [INITIATIVE_STATUSES.PLANNING, INITIATIVE_STATUSES.CANCELLED],
    [INITIATIVE_STATUSES.PLANNING]: [
        INITIATIVE_STATUSES.REVIEW,
        INITIATIVE_STATUSES.DRAFT,
        INITIATIVE_STATUSES.CANCELLED,
    ],
    [INITIATIVE_STATUSES.REVIEW]: [
        INITIATIVE_STATUSES.APPROVED,
        INITIATIVE_STATUSES.PLANNING,
        INITIATIVE_STATUSES.CANCELLED,
    ],
    [INITIATIVE_STATUSES.APPROVED]: [
        INITIATIVE_STATUSES.EXECUTING,
        INITIATIVE_STATUSES.PLANNING,
        INITIATIVE_STATUSES.CANCELLED,
    ],
    [INITIATIVE_STATUSES.EXECUTING]: [
        INITIATIVE_STATUSES.BLOCKED,
        INITIATIVE_STATUSES.DONE,
        INITIATIVE_STATUSES.CANCELLED,
    ],
    [INITIATIVE_STATUSES.BLOCKED]: [INITIATIVE_STATUSES.EXECUTING, INITIATIVE_STATUSES.CANCELLED],
    [INITIATIVE_STATUSES.DONE]: [INITIATIVE_STATUSES.ARCHIVED],
    [INITIATIVE_STATUSES.CANCELLED]: [INITIATIVE_STATUSES.ARCHIVED],
    [INITIATIVE_STATUSES.ARCHIVED]: [],
};

const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
    [TASK_STATUSES.TODO]: [TASK_STATUSES.IN_PROGRESS, TASK_STATUSES.BLOCKED],
    [TASK_STATUSES.IN_PROGRESS]: [TASK_STATUSES.BLOCKED, TASK_STATUSES.DONE, TASK_STATUSES.TODO],
    [TASK_STATUSES.BLOCKED]: [TASK_STATUSES.TODO, TASK_STATUSES.IN_PROGRESS],
    [TASK_STATUSES.DONE]: [TASK_STATUSES.IN_PROGRESS],
};

const StatusMachine = {
    INITIATIVE_STATUSES,
    TASK_STATUSES,
    DECISION_STATUSES,
    EXECUTION_STAGES,

    canTransitionInitiative: (from: string, to: string): boolean => {
        const allowed = INITIATIVE_TRANSITIONS[from as InitiativeStatus] || [];
        return allowed.includes(to as InitiativeStatus);
    },

    canTransitionTask: (from: string, to: string): boolean => {
        const allowed = TASK_TRANSITIONS[from as TaskStatus] || [];
        return allowed.includes(to as TaskStatus);
    },

    validateInitiativeTransition: (
        from: string,
        to: string,
        context: InitiativeContext = {},
    ): { valid: boolean; reason?: string } => {
        if (!StatusMachine.canTransitionInitiative(from, to)) {
            return { valid: false, reason: `Cannot transition from ${from} to ${to}` };
        }

        if (to === INITIATIVE_STATUSES.BLOCKED && !context.blockedReason) {
            return { valid: false, reason: 'Blocked status requires a reason' };
        }

        if (to === INITIATIVE_STATUSES.DONE) {
            if (context.pendingTasks && context.pendingTasks > 0) {
                return { valid: false, reason: `Cannot complete: ${context.pendingTasks} tasks still pending` };
            }
            if (context.hasBlockingDecisions) {
                return { valid: false, reason: 'Cannot complete: Open blocking decisions exist' };
            }
        }

        if (from === INITIATIVE_STATUSES.PLANNING && to === INITIATIVE_STATUSES.REVIEW) {
            if (context.charterCompleteness !== undefined && context.charterCompleteness < 60) {
                return {
                    valid: false,
                    reason: `Charter completeness too low (${context.charterCompleteness}%). Minimum 60% required.`,
                };
            }
        }

        if (from === INITIATIVE_STATUSES.REVIEW && to === INITIATIVE_STATUSES.APPROVED) {
            if (context.requiresApproval && !context.isApproved) {
                return { valid: false, reason: 'Governance approval required for this transition' };
            }
            if (context.pendingReviews && context.pendingReviews > 0) {
                return { valid: false, reason: `Cannot approve: ${context.pendingReviews} reviews still pending` };
            }
        }

        if (from === INITIATIVE_STATUSES.APPROVED && to === INITIATIVE_STATUSES.EXECUTING) {
            if (context.requiresScheduling && !context.isScheduled) {
                return { valid: false, reason: 'Initiative must be scheduled in roadmap before execution' };
            }
        }

        return { valid: true };
    },

    validateTaskTransition: (
        from: string,
        to: string,
        context: TaskContext = {},
    ): { valid: boolean; reason?: string } => {
        if (!StatusMachine.canTransitionTask(from, to)) {
            return { valid: false, reason: `Cannot transition from ${from} to ${to}` };
        }

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

    getAllowedInitiativeTransitions: (currentStatus: string): InitiativeStatus[] => {
        return INITIATIVE_TRANSITIONS[currentStatus as InitiativeStatus] || [];
    },

    getAllowedTaskTransitions: (currentStatus: string): TaskStatus[] => {
        return TASK_TRANSITIONS[currentStatus as TaskStatus] || [];
    },

    canTransitionExecutionStage: (from: string, to: string): boolean => {
        const allowed = EXECUTION_STAGE_TRANSITIONS[from as ExecutionStage] || [];
        return allowed.includes(to as ExecutionStage);
    },

    getAllowedStageTransitions: (currentStage: string): ExecutionStage[] => {
        return EXECUTION_STAGE_TRANSITIONS[currentStage as ExecutionStage] || [];
    },

    validateStageTransition: (
        from: string,
        to: string,
        context: StageContext = {},
    ): { valid: boolean; reason?: string } => {
        if (!StatusMachine.canTransitionExecutionStage(from, to)) {
            return { valid: false, reason: `Cannot transition stage from ${from} to ${to}` };
        }

        if (to === EXECUTION_STAGES.DELIVERY) {
            if (context.pendingReviews && context.pendingReviews > 0) {
                return { valid: false, reason: `Cannot deliver: ${context.pendingReviews} reviews still pending` };
            }
        }

        return { valid: true };
    },

    getStageLabel: (stage: string): string => {
        const labels: Record<ExecutionStage, string> = {
            [EXECUTION_STAGES.KICKOFF]: 'Kickoff',
            [EXECUTION_STAGES.IN_PROGRESS]: 'In Progress',
            [EXECUTION_STAGES.REVIEW]: 'Review',
            [EXECUTION_STAGES.DELIVERY]: 'Delivery',
        };
        return labels[stage as ExecutionStage] || stage;
    },

    getInitiativeModule: (
        status: string,
    ): 'ASSESSMENT' | 'INITIATIVE_MANAGEMENT' | 'EXECUTION' | 'TERMINAL' | 'UNKNOWN' => {
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

    isModuleTransition: (
        from: string,
        to: string,
    ): { crossesModule: boolean; fromModule: string; toModule: string } => {
        const fromModule = StatusMachine.getInitiativeModule(from);
        const toModule = StatusMachine.getInitiativeModule(to);
        return {
            crossesModule: fromModule !== toModule,
            fromModule,
            toModule,
        };
    },

    getStatusLabel: (status: string): string => {
        const labels: Record<InitiativeStatus, string> = {
            [INITIATIVE_STATUSES.DRAFT]: 'Draft',
            [INITIATIVE_STATUSES.PLANNING]: 'Planning',
            [INITIATIVE_STATUSES.REVIEW]: 'In Review',
            [INITIATIVE_STATUSES.APPROVED]: 'Approved',
            [INITIATIVE_STATUSES.EXECUTING]: 'Executing',
            [INITIATIVE_STATUSES.BLOCKED]: 'Blocked',
            [INITIATIVE_STATUSES.DONE]: 'Done',
            [INITIATIVE_STATUSES.CANCELLED]: 'Cancelled',
            [INITIATIVE_STATUSES.ARCHIVED]: 'Archived',
        };
        return labels[status as InitiativeStatus] || status;
    },
};

export default StatusMachine;
