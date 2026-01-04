declare namespace _default {
    export { requireOrgAccess };
    export { requireRole };
    export { requireOrgMember };
    export { requireOrgRole };
    export { requireOrgRoleOrHigher };
    export { requireConsultantScope };
    export { requireOwnerOrSuperadmin };
    export { ORG_ROLE_HIERARCHY };
}
export default _default;
/**
 * requireOrgAccess - UNIFIED guard for both members and consultants
 *
 * This is the PRIMARY guard to use. It handles:
 * - Members: checks if user has one of the allowed roles
 * - Consultants: checks if consultant has required permissions in scope
 *
 * @param {Object} options
 * @param {Array<string>} options.roles - Allowed org roles for members (e.g., ['OWNER', 'ADMIN'])
 * @param {Array<string>} options.consultantPermissions - Required permissions for consultants
 * @param {boolean} options.allowConsultant - Whether consultants can access (default: true)
 */
declare function requireOrgAccess(options?: {
    roles: Array<string>;
    consultantPermissions: Array<string>;
    allowConsultant: boolean;
}): (req: any, res: any, next: any) => any;
/**
 * requireRole - Check GLOBAL user role (legacy, for non-org routes)
 * @param {string|string[]} roles - Single role or array of allowed roles
 */
declare function requireRole(roles: string | string[]): (req: any, res: any, next: any) => any;
/**
 * requireOrgMember - Simple check that user is a member (not consultant)
 */
declare function requireOrgMember(): (req: any, res: any, next: any) => any;
/**
 * requireOrgRole - Check if user has one of the allowed org roles
 * NOTE: Prefer requireOrgAccess for new code (handles both members and consultants)
 */
declare function requireOrgRole(allowedRoles: any): (req: any, res: any, next: any) => any;
/**
 * requireOrgRoleOrHigher - Check if user has minimum role level
 */
declare function requireOrgRoleOrHigher(minimumRole: any): (req: any, res: any, next: any) => any;
/**
 * requireConsultantScope - Check consultant has specific permissions
 * NOTE: Prefer requireOrgAccess for new code
 */
declare function requireConsultantScope(requiredPermissions: any): (req: any, res: any, next: any) => any;
/**
 * requireOwnerOrSuperadmin - For destructive operations
 */
declare function requireOwnerOrSuperadmin(): (req: any, res: any, next: any) => any;
declare namespace ORG_ROLE_HIERARCHY {
    let OWNER: number;
    let ADMIN: number;
    let MEMBER: number;
    let CONSULTANT: number;
}
//# sourceMappingURL=rbac.d.ts.map