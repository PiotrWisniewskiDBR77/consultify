export default PermissionService;
declare namespace PermissionService {
    export { ROLES };
    export { CAPABILITIES };
    export { ROLE_CAPABILITIES };
    export function setDependencies(newDeps?: {}): void;
    export function can(user: any, capability: any, context?: {}): boolean;
    export function getCapabilitiesForRole(role: any): string[];
    export function hasPermission(userId: string, orgId: string, permissionKey: string, userRole: string): Promise<boolean>;
    export function getUserPermissions(userId: string, orgId: string, userRole: string): Promise<Object>;
    export function grantPermission(userId: string, orgId: string, permissionKey: string, grantedBy: string): Promise<Object>;
    export function revokePermission(userId: string, orgId: string, permissionKey: string, revokedBy: string): Promise<Object>;
    export function removeOverride(userId: string, orgId: string, permissionKey: string): Promise<Object>;
    export function getAllPermissions(): Promise<any[]>;
    export function getPermissionsByCategory(category: string): Promise<any[]>;
    export function getRolePermissions(role?: string): Promise<any[]>;
    export function _permissionExists(permissionKey: any): Promise<any>;
    export namespace CONTENT_PERMISSIONS {
        let EMAIL_TEMPLATE_VIEW: string;
        let EMAIL_TEMPLATE_CREATE: string;
        let EMAIL_TEMPLATE_EDIT: string;
        let EMAIL_TEMPLATE_DELETE: string;
        let EMAIL_TEMPLATE_PUBLISH: string;
        let EMAIL_TEMPLATE_DEPRECATE: string;
        let EMAIL_TEMPLATE_CLONE: string;
        let EMAIL_TEMPLATE_PREVIEW: string;
        let EMAIL_TEMPLATE_TEST_SEND: string;
        let EMAIL_TEMPLATE_RESTORE: string;
        let EMAIL_TEMPLATE_ANALYTICS: string;
        let PLAYBOOK_TEMPLATE_VIEW: string;
        let PLAYBOOK_TEMPLATE_CREATE: string;
        let PLAYBOOK_TEMPLATE_EDIT: string;
        let PLAYBOOK_TEMPLATE_DELETE: string;
        let PLAYBOOK_TEMPLATE_PUBLISH: string;
        let PLAYBOOK_TEMPLATE_DEPRECATE: string;
        let PLAYBOOK_TEMPLATE_CLONE: string;
        let PLAYBOOK_TEMPLATE_RESTORE: string;
        let PLAYBOOK_TEMPLATE_ANALYTICS: string;
        let CONTENT_CATEGORY_VIEW: string;
        let CONTENT_CATEGORY_CREATE: string;
        let CONTENT_CATEGORY_EDIT: string;
        let CONTENT_CATEGORY_DELETE: string;
        let CONTENT_TAG_VIEW: string;
        let CONTENT_TAG_CREATE: string;
        let CONTENT_TAG_EDIT: string;
        let CONTENT_TAG_DELETE: string;
        let CONTENT_COMMENT_CREATE: string;
        let CONTENT_COMMENT_EDIT: string;
        let CONTENT_COMMENT_DELETE: string;
        let CONTENT_COMMENT_RESOLVE: string;
        let CONTENT_REVIEW_REQUEST: string;
        let CONTENT_REVIEW_APPROVE: string;
        let CONTENT_REVIEW_REJECT: string;
        let CONTENT_FAVORITE_ADD: string;
        let CONTENT_SEARCH: string;
        let CONTENT_BULK_ACTIONS: string;
        let CONTENT_ANALYTICS_VIEW: string;
    }
    export function hasContentPermission(userId: string, orgId: string, contentId: string, contentType: string, permissionKey: string, userRole: string): Promise<boolean>;
    export function grantContentPermission({ contentId, contentType, userId, permissionKey, grantedBy, expiresAt }: Object): Promise<Object>;
    export function revokeContentPermission({ contentId, contentType, userId, permissionKey, revokedBy }: Object): Promise<Object>;
    export function removeContentPermission(contentId: string, contentType: string, userId: string, permissionKey: string): Promise<Object>;
    export function getContentPermissions(contentId: string, contentType: string): Promise<any[]>;
    export function hasPermissions(userId: string, orgId: string, permissionKeys: string[], userRole: string): Promise<Object>;
    export function validateContentAction({ userId, orgId, userRole, contentId, contentType, action }: Object): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
}
declare namespace ROLES {
    let SUPERADMIN: string;
    let ADMIN: string;
    let PROJECT_MANAGER: string;
    let TEAM_MEMBER: string;
    let VIEWER: string;
}
declare namespace CAPABILITIES {
    let MANAGE_USERS: string;
    let MANAGE_ROLES: string;
    let MANAGE_BILLING: string;
    let MANAGE_ORG_SETTINGS: string;
    let MANAGE_AI_POLICY: string;
    let CREATE_PROJECT: string;
    let EDIT_PROJECT_SETTINGS: string;
    let MANAGE_PROJECT_ROLES: string;
    let MANAGE_WORKSTREAMS: string;
    let APPROVE_CHANGES: string;
    let MANAGE_STAGE_GATES: string;
    let VIEW_AUDIT_LOG: string;
    let CREATE_INITIATIVE: string;
    let EDIT_INITIATIVE: string;
    let MANAGE_ROADMAP: string;
    let ASSIGN_TASKS: string;
    let UPDATE_TASK_STATUS: string;
    let MANAGE_RISKS: string;
    let AI_EXECUTE_ACTIONS: string;
    let AI_VIEW_INSIGHTS: string;
}
declare const ROLE_CAPABILITIES: {
    [ROLES.SUPERADMIN]: string[];
    [ROLES.ADMIN]: string[];
    [ROLES.PROJECT_MANAGER]: string[];
    [ROLES.TEAM_MEMBER]: string[];
    [ROLES.VIEWER]: string[];
};
//# sourceMappingURL=permissionService.d.ts.map