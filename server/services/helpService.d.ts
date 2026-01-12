export default HelpService;
declare namespace HelpService {
    export { EVENT_TYPES };
    export { TARGET_ROLES };
    export { TARGET_ORG_TYPES };
    export function getAvailablePlaybooks({ orgType, role, userId, organizationId }: {
        orgType: string;
        role: string;
        userId: string;
        organizationId: string;
    }): Promise<any[]>;
    export function getPlaybook(key: string): Promise<Object | null>;
    export function getPlaybookById(id: string): Promise<Object | null>;
    export function markEvent(userId: string, organizationId: string, playbookKey: string, eventType: string, context?: Object): Promise<Object>;
    export function getUserProgress(userId: string, organizationId: string, playbookKey: string): Promise<Object>;
    export function getPlaybookStats(playbookKey?: string, options?: Object): Promise<any[]>;
    export function createPlaybook({ key, title, description, targetRole, targetOrgType, priority }: Object): Promise<Object>;
    export function updatePlaybook(id: string, updates: Object): Promise<Object>;
    export function createStep({ playbookId, stepOrder, title, contentMd, uiTarget, actionType, actionPayload }: Object): Promise<Object>;
    export function listAllPlaybooks(): Promise<any[]>;
}
declare namespace EVENT_TYPES {
    let VIEWED: string;
    let STARTED: string;
    let DONE: string;
    let DISMISSED: string;
}
/**
 * Valid roles for targeting playbooks
 */
declare const TARGET_ROLES: string[];
/**
 * Valid org types for targeting playbooks
 */
declare const TARGET_ORG_TYPES: string[];
//# sourceMappingURL=helpService.d.ts.map