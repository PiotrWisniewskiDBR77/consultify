export default taskAssignmentServiceInstance;
declare const taskAssignmentServiceInstance: TaskAssignmentService;
declare class TaskAssignmentService {
    _db: any;
    SLA_HOURS_BY_PRIORITY: {
        urgent: number;
        high: number;
        medium: number;
        low: number;
    };
    ESCALATION_LEVELS: {
        NONE: number;
        INITIATIVE_OWNER: number;
        PMO_LEAD: number;
        SPONSOR: number;
    };
    ESCALATION_TRIGGERS: {
        SLA_BREACH: string;
        BLOCKED: string;
        MANUAL: string;
        PRIORITY_CHANGE: string;
    };
    get db(): any;
    /**
     * Initialize service dependencies
     */
    init(): Promise<this>;
    /**
     * Set dependencies manually (for testing)
     */
    setDependencies(customDeps: any): void;
    /**
     * Assign a task to a user
     */
    assignTask(taskId: any, assigneeId: any, options?: {}): Promise<{
        id: any;
        projectId: any;
        initiativeId: any;
        workstreamId: any;
        title: any;
        description: any;
        status: any;
        priority: any;
        assigneeId: any;
        assigneeName: string | null;
        assigneeEmail: any;
        dueDate: any;
        slaHours: any;
        slaDueAt: any;
        slaStatus: string;
        escalationLevel: any;
        escalatedToId: any;
        escalatedToName: string | null;
        lastEscalatedAt: any;
        progress: any;
        createdAt: any;
        updatedAt: any;
        completedAt: any;
    } | null>;
    /**
     * Reassign a task to a different user
     */
    reassignTask(taskId: any, newAssigneeId: any, options?: {}): Promise<{
        id: any;
        projectId: any;
        initiativeId: any;
        workstreamId: any;
        title: any;
        description: any;
        status: any;
        priority: any;
        assigneeId: any;
        assigneeName: string | null;
        assigneeEmail: any;
        dueDate: any;
        slaHours: any;
        slaDueAt: any;
        slaStatus: string;
        escalationLevel: any;
        escalatedToId: any;
        escalatedToName: string | null;
        lastEscalatedAt: any;
        progress: any;
        createdAt: any;
        updatedAt: any;
        completedAt: any;
    } | null>;
    /**
     * Unassign a task
     */
    unassignTask(taskId: any): Promise<{
        id: any;
        projectId: any;
        initiativeId: any;
        workstreamId: any;
        title: any;
        description: any;
        status: any;
        priority: any;
        assigneeId: any;
        assigneeName: string | null;
        assigneeEmail: any;
        dueDate: any;
        slaHours: any;
        slaDueAt: any;
        slaStatus: string;
        escalationLevel: any;
        escalatedToId: any;
        escalatedToName: string | null;
        lastEscalatedAt: any;
        progress: any;
        createdAt: any;
        updatedAt: any;
        completedAt: any;
    } | null>;
    /**
     * Escalate a task
     */
    escalateTask(taskId: any, options?: {}): Promise<{
        task: {
            id: any;
            projectId: any;
            initiativeId: any;
            workstreamId: any;
            title: any;
            description: any;
            status: any;
            priority: any;
            assigneeId: any;
            assigneeName: string | null;
            assigneeEmail: any;
            dueDate: any;
            slaHours: any;
            slaDueAt: any;
            slaStatus: string;
            escalationLevel: any;
            escalatedToId: any;
            escalatedToName: string | null;
            lastEscalatedAt: any;
            progress: any;
            createdAt: any;
            updatedAt: any;
            completedAt: any;
        } | null;
        escalation: {
            id: string;
            fromLevel: any;
            toLevel: any;
            escalatedTo: any;
            reason: any;
            triggerType: any;
            createdAt: string;
        };
    }>;
    /**
     * Resolve an escalation
     */
    resolveEscalation(escalationId: any, options?: {}): Promise<any>;
    /**
     * Check and escalate overdue tasks (for cron job)
     */
    checkAndEscalateOverdue(options?: {}): Promise<{
        processed: number;
        escalated: number;
        failed: number;
        tasks: never[];
    }>;
    /**
     * Get overdue tasks for a project
     */
    getOverdueTasks(projectId: any, options?: {}): Promise<any>;
    /**
     * Get tasks approaching SLA deadline
     */
    getTasksApproachingSLA(projectId: any, hoursAhead?: number): Promise<any>;
    /**
     * Get escalation history for a task
     */
    getTaskEscalationHistory(taskId: any): Promise<any>;
    /**
     * Get task with all PMO fields
     */
    getTask(taskId: any): Promise<{
        id: any;
        projectId: any;
        initiativeId: any;
        workstreamId: any;
        title: any;
        description: any;
        status: any;
        priority: any;
        assigneeId: any;
        assigneeName: string | null;
        assigneeEmail: any;
        dueDate: any;
        slaHours: any;
        slaDueAt: any;
        slaStatus: string;
        escalationLevel: any;
        escalatedToId: any;
        escalatedToName: string | null;
        lastEscalatedAt: any;
        progress: any;
        createdAt: any;
        updatedAt: any;
        completedAt: any;
    } | null>;
    /**
     * Get user workload (assigned tasks and their status)
     */
    getUserWorkload(userId: any, options?: {}): Promise<{
        userId: any;
        total: number;
        overdue: number;
        atRisk: number;
        byProject: any[];
        generatedAt: string;
    }>;
    _formatTask(row: any): {
        id: any;
        projectId: any;
        initiativeId: any;
        workstreamId: any;
        title: any;
        description: any;
        status: any;
        priority: any;
        assigneeId: any;
        assigneeName: string | null;
        assigneeEmail: any;
        dueDate: any;
        slaHours: any;
        slaDueAt: any;
        slaStatus: string;
        escalationLevel: any;
        escalatedToId: any;
        escalatedToName: string | null;
        lastEscalatedAt: any;
        progress: any;
        createdAt: any;
        updatedAt: any;
        completedAt: any;
    };
    _createActivity(projectId: any, taskId: any, type: any, data: any): Promise<void>;
    _notifyEscalation(task: any, recipient: any, level: any, reason: any): Promise<void>;
    _logAudit(projectId: any, action: any, metadata?: {}): Promise<void>;
}
//# sourceMappingURL=taskAssignmentService.d.ts.map