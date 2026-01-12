export namespace AI_PROJECT_ROLES {
    let ADVISOR: string;
    let MANAGER: string;
    let OPERATOR: string;
}
export const ROLE_HIERARCHY: string[];
export namespace ROLE_CAPABILITIES {
    export namespace ADVISOR_1 {
        let canExplain: boolean;
        let canSuggest: boolean;
        let canAnalyze: boolean;
        let canCreateDrafts: boolean;
        let canExecuteActions: boolean;
        let canModifyEntities: boolean;
        let requiresApproval: boolean;
    }
    export { ADVISOR_1 as ADVISOR };
    export namespace MANAGER_1 {
        let canExplain_1: boolean;
        export { canExplain_1 as canExplain };
        let canSuggest_1: boolean;
        export { canSuggest_1 as canSuggest };
        let canAnalyze_1: boolean;
        export { canAnalyze_1 as canAnalyze };
        let canCreateDrafts_1: boolean;
        export { canCreateDrafts_1 as canCreateDrafts };
        let canExecuteActions_1: boolean;
        export { canExecuteActions_1 as canExecuteActions };
        let canModifyEntities_1: boolean;
        export { canModifyEntities_1 as canModifyEntities };
        let requiresApproval_1: boolean;
        export { requiresApproval_1 as requiresApproval };
    }
    export { MANAGER_1 as MANAGER };
    export namespace OPERATOR_1 {
        let canExplain_2: boolean;
        export { canExplain_2 as canExplain };
        let canSuggest_2: boolean;
        export { canSuggest_2 as canSuggest };
        let canAnalyze_2: boolean;
        export { canAnalyze_2 as canAnalyze };
        let canCreateDrafts_2: boolean;
        export { canCreateDrafts_2 as canCreateDrafts };
        let canExecuteActions_2: boolean;
        export { canExecuteActions_2 as canExecuteActions };
        let canModifyEntities_2: boolean;
        export { canModifyEntities_2 as canModifyEntities };
        let requiresApproval_2: boolean;
        export { requiresApproval_2 as requiresApproval };
    }
    export { OPERATOR_1 as OPERATOR };
}
export namespace ACTION_CAPABILITY_REQUIREMENTS {
    let EXPLAIN_CONTEXT: string;
    let ANALYZE_RISKS: string;
    let PREPARE_DECISION_SUMMARY: string;
    let CREATE_DRAFT_TASK: string;
    let CREATE_DRAFT_INITIATIVE: string;
    let CREATE_DRAFT_DECISION: string;
    let SUGGEST_ROADMAP_CHANGE: string;
    let GENERATE_REPORT: string;
    let EXECUTE_TASK_UPDATE: string;
    let EXECUTE_STATUS_CHANGE: string;
    let EXECUTE_ASSIGNMENT: string;
    let CREATE_ENTITY: string;
    let UPDATE_ENTITY: string;
    let DELETE_ENTITY: string;
}
export namespace ROLE_DESCRIPTIONS {
    let ADVISOR_2: string;
    export { ADVISOR_2 as ADVISOR };
    let MANAGER_2: string;
    export { MANAGER_2 as MANAGER };
    let OPERATOR_2: string;
    export { OPERATOR_2 as OPERATOR };
}
export namespace AIRoleGuard {
    export { AI_PROJECT_ROLES };
    export { ROLE_CAPABILITIES };
    export { ROLE_HIERARCHY };
    export function setDependencies(newDeps?: {}): void;
    export function getProjectRole(projectId: string): Promise<string>;
    export function setProjectRole(projectId: string, role: string, userId: string): Promise<object>;
    export function getRoleCapabilities(role: string): object;
    export function getRoleDescription(role: string): string;
    export function canPerformAction(projectId: string, actionType: string): Promise<object>;
    export function isActionBlocked(projectId: string, actionType: string): Promise<object>;
    export function getRoleConfig(projectId: string): Promise<object>;
    export function validateMutation(projectId: string, mutationType: string): Promise<object>;
}
export default AIRoleGuard;
//# sourceMappingURL=aiRoleGuard.d.ts.map