declare namespace _default {
    export { verifyAdmin };
    export { checkPermission };
    export { setDependencies };
}
export default _default;
/**
 * Admin Middleware - Verifies user is an ADMIN or SUPERADMIN for their organization
 * Use this for organization-scoped admin actions (user management, team creation, etc.)
 */
declare function verifyAdmin(req: any, res: any, next: any): any;
/**
 * Permission Checker - Granular permission checking utility
 * @param {string} requiredPermission - The permission key to check
 * @returns {Function} Middleware function
 */
declare function checkPermission(requiredPermission: string): Function;
/**
 * Inject dependencies for testing
 * @param {Object} newDeps
 */
declare function setDependencies(newDeps: Object): void;
//# sourceMappingURL=adminMiddleware.d.ts.map