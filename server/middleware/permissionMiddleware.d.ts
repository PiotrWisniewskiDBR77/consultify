declare namespace _default {
    export { requirePermission };
    export { requireAnyPermission };
    export { requireAllPermissions };
    export { auditAction };
    export { setDependencies };
}
export default _default;
/**
 * Middleware factory to require a specific permission
 * @param {string} permissionKey - Permission key to check (e.g., 'PLAYBOOK_PUBLISH')
 * @returns {Function} Express middleware
 */
declare function requirePermission(permissionKey: string): Function;
/**
 * Middleware factory to require ANY of the specified permissions
 * @param {Array<string>} permissionKeys - Array of permission keys
 * @returns {Function} Express middleware
 */
declare function requireAnyPermission(permissionKeys: Array<string>): Function;
/**
 * Middleware factory to require ALL of the specified permissions
 * @param {Array<string>} permissionKeys - Array of permission keys
 * @returns {Function} Express middleware
 */
declare function requireAllPermissions(permissionKeys: Array<string>): Function;
/**
 * Middleware to audit-log the action after successful completion
 * Use AFTER requirePermission middleware and the route handler
 * @param {Object} options - Audit options
 * @param {string} options.action - Action type
 * @param {string} options.resourceType - Resource type
 * @param {Function} [options.getResourceId] - Function to extract resource ID from req
 * @param {Function} [options.getBefore] - Function to get before state
 * @param {Function} [options.getAfter] - Function to get after state
 */
declare function auditAction(options: {
    action: string;
    resourceType: string;
    getResourceId?: Function | undefined;
    getBefore?: Function | undefined;
    getAfter?: Function | undefined;
}): (req: any, res: any, next: any) => Promise<void>;
/**
 * Inject dependencies for testing
 * @param {Object} newDeps
 */
declare function setDependencies(newDeps: Object): void;
//# sourceMappingURL=permissionMiddleware.d.ts.map