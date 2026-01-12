export namespace POLICY_LEVELS {
    let ADVISORY: string;
    let ASSISTED: string;
    let PROACTIVE: string;
    let AUTOPILOT: string;
}
export const POLICY_HIERARCHY: string[];
export namespace AI_ROLES {
    let ADVISOR: string;
    let PMO_MANAGER: string;
    let EXECUTOR: string;
    let EDUCATOR: string;
}
export namespace ACTION_POLICY_REQUIREMENTS {
    let EXPLAIN_CONTEXT: string;
    let ANALYZE_RISKS: string;
    let PREPARE_DECISION_SUMMARY: string;
    let CREATE_DRAFT_TASK: string;
    let CREATE_DRAFT_INITIATIVE: string;
    let SUGGEST_ROADMAP_CHANGE: string;
    let GENERATE_REPORT: string;
}
export namespace AIPolicyEngine {
    export { POLICY_LEVELS };
    export { AI_ROLES };
    export function setDependencies(newDeps?: {}): void;
    export function getEffectivePolicy(organizationId: any, projectId?: null, userId?: null): Promise<{
        policyLevel: string;
        maxPolicyLevel: string;
        internetEnabled: boolean;
        auditRequired: boolean;
        defaultRole: string;
        activeRoles: string[];
        userTone: string;
        educationMode: boolean;
        projectAIRole: string;
        roleCapabilities: {
            canExplain: boolean;
            canCreateDrafts: boolean;
            canExecute: boolean;
            canModify: boolean;
        };
        roleDescription: string;
        regulatoryModeEnabled: boolean;
        regulatoryModePrompt: any;
    } | {
        policyLevel: any;
        maxPolicyLevel: any;
        internetEnabled: boolean;
        auditRequired: boolean;
        defaultRole: any;
        activeRoles: any;
        userTone: any;
        educationMode: boolean;
        projectAIRole: string;
        roleCapabilities: any;
        roleDescription: any;
        regulatoryModeEnabled?: undefined;
        regulatoryModePrompt?: undefined;
    }>;
    export function canPerformAction(actionType: any, organizationId: any, projectId?: null, userId?: null): Promise<{
        allowed: boolean;
        requiresApproval: any;
        requiredLevel: any;
        currentLevel: any;
        reason: string;
    }>;
    export function getPolicyLevelForAction(actionType: string): string;
    export function isRoleActive(role: any, organizationId: any): Promise<any>;
    export function updatePolicy(organizationId: any, updates: any): Promise<any>;
    export function getPolicySummary(organizationId: any): Promise<{
        currentLevel: any;
        description: any;
        capabilities: {
            canExplain: boolean;
            canAnalyze: boolean;
            canCreateDrafts: boolean;
            canExecuteActions: boolean;
        };
        internetEnabled: boolean;
        auditRequired: boolean;
    }>;
}
export default AIPolicyEngine;
//# sourceMappingURL=aiPolicyEngine.d.ts.map