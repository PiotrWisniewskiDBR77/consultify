export default AIActionExecutor;
declare namespace AIActionExecutor {
    export { ACTION_TYPES };
    export { ACTION_STATUS };
    export function setDependencies(newDeps?: {}): void;
    export function requestAction(actionType: any, payload: any, userId: any, organizationId: any, projectId?: null): Promise<any>;
    export function createDraft(draftType: any, draftContent: any, userId: any, organizationId: any, projectId: any): Promise<any>;
    export function approveAction(actionId: string, userId: string, options?: object): Promise<any>;
    export function rejectAction(actionId: string, userId: string, reason?: string, options?: object): Promise<any>;
    export function executeAction(actionId: any, userId: any): Promise<{
        success: boolean;
        actionId: any;
        result: {
            taskId: any;
            title: any;
            created: boolean;
        } | {
            initiativeId: any;
            name: any;
            created: boolean;
        } | {
            reportGenerated: boolean;
            content: any;
            executed?: undefined;
            actionType?: undefined;
        } | {
            executed: boolean;
            actionType: any;
            reportGenerated?: undefined;
            content?: undefined;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        actionId?: undefined;
        result?: undefined;
    }>;
    export function getPendingActions(userId?: null, projectId?: null, organizationId?: null): Promise<any>;
    export function getAction(actionId: any): Promise<any>;
    export function listActions(projectId: any, filters?: {}): Promise<any>;
    export function getPatternInfo(userId: string, actionType: string, payload: object): Promise<object>;
    export function getUserPatternStats(userId: any): Promise<any>;
    export function getUserPatterns(userId: any, actionType?: null): Promise<any>;
    export function setPatternAutoApply(patternId: any, enabled: any, userId: any): Promise<any>;
    export function deletePattern(patternId: any, userId: any): Promise<any>;
    export function _executeCreateTask(draftContent: any, action: any): Promise<{
        taskId: any;
        title: any;
        created: boolean;
    }>;
    export function _executeCreateInitiative(draftContent: any, action: any): Promise<{
        initiativeId: any;
        name: any;
        created: boolean;
    }>;
    export function _sendPendingActionNotification(actionId: any, userId: any, organizationId: any, projectId: any, actionType: any, payload: any): Promise<void>;
    export function _sendAutoDecisionNotification(actionId: any, userId: any, organizationId: any, decision: any, patternInfo: any): Promise<void>;
    export function _logAudit(actionId: any, userId: any, decision: any, feedback?: null): Promise<any>;
}
declare namespace ACTION_TYPES {
    let CREATE_DRAFT_TASK: string;
    let CREATE_DRAFT_INITIATIVE: string;
    let SUGGEST_ROADMAP_CHANGE: string;
    let GENERATE_REPORT: string;
    let PREPARE_DECISION_SUMMARY: string;
    let EXPLAIN_CONTEXT: string;
    let ANALYZE_RISKS: string;
}
declare namespace ACTION_STATUS {
    let PENDING: string;
    let APPROVED: string;
    let REJECTED: string;
    let EXECUTED: string;
}
//# sourceMappingURL=aiActionExecutor.d.ts.map