export interface AssignTaskOptions {
    assignedById?: string;
    slaHours?: number | null;
}

export interface ReassignTaskOptions {
    reassignedById?: string;
    reason?: string;
    resetSla?: boolean;
}

export interface EscalateTaskOptions {
    reason?: string;
    triggerType?: string;
    escalatedById?: string;
}

export interface ResolveEscalationOptions {
    resolutionNote?: string;
    resolvedById?: string;
}

export interface GetOverdueOptions {
    escalationLevel?: number;
    limit?: number;
}

export interface GetWorkloadOptions {
    projectId?: string;
}

export interface Task {
    id: string;
    projectId: string;
    initiativeId?: string;
    workstreamId?: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    assigneeId?: string;
    assigneeName?: string;
    assigneeEmail?: string;
    dueDate?: string | Date;
    slaHours?: number;
    slaDueAt?: string | Date;
    slaStatus: 'OK' | 'BREACHED' | 'AT_RISK';
    escalationLevel: number;
    escalatedToId?: string;
    escalatedToName?: string;
    lastEscalatedAt?: string | Date;
    progress?: number;
    createdAt: string | Date;
    updatedAt: string | Date;
    completedAt?: string | Date;
}

export interface EscalationRow {
    id: string;
    taskId: string;
    fromLevel: number;
    toLevel: number;
    escalatedToId: string;
    escalatedToName?: string;
    reason: string;
    triggerType: string;
    resolvedAt?: string | Date;
    resolutionNote?: string;
    createdAt: string | Date;
}

export interface EscalationResult {
    task: Task;
    escalation: {
        id: string;
        fromLevel: number;
        toLevel: number;
        escalatedTo: any; // User object
        reason: string;
        triggerType: string;
        createdAt: string | Date;
    };
}

export interface ProjectWorkload {
    projectId: string;
    projectName: string;
    count: number;
    overdue: number;
    byStatus: Record<string, number>;
}

export interface WorkloadResult {
    userId: string;
    total: number;
    overdue: number;
    atRisk: number;
    byProject: ProjectWorkload[];
    generatedAt: string;
}

declare class TaskAssignmentService {
    assignTask(taskId: string, assigneeId: string, options?: AssignTaskOptions): Promise<Task>;
    reassignTask(taskId: string, newAssigneeId: string, options?: ReassignTaskOptions): Promise<Task>;
    unassignTask(taskId: string): Promise<Task>;
    escalateTask(taskId: string, options?: EscalateTaskOptions): Promise<EscalationResult>;
    resolveEscalation(escalationId: string, options?: ResolveEscalationOptions): Promise<EscalationRow>;
    getTaskEscalationHistory(taskId: string): Promise<EscalationRow[]>;
    getOverdueTasks(projectId: string, options?: GetOverdueOptions): Promise<Task[]>;
    getTasksApproachingSLA(projectId: string, hoursAhead?: number): Promise<Task[]>;
    getUserWorkload(userId: string, options?: GetWorkloadOptions): Promise<WorkloadResult>;
    checkAndEscalateOverdue(options?: { limit?: number }): Promise<any>;
    getTask(taskId: string): Promise<Task | null>;
}

declare const taskAssignmentServiceInstance: TaskAssignmentService;
export default taskAssignmentServiceInstance;