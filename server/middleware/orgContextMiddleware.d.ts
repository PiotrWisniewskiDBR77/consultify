export default orgContextMiddleware;
/**
 * Main middleware factory.
 *
 * Options:
 * - allowHeader: Accept org from x-org-id header (default: false — secure)
 * - strictWrite: Require explicit orgId for POST/PUT/PATCH/DELETE (default: true)
 * - headerName: Custom header name (default: 'x-org-id')
 * - paramName: URL param name (default: 'orgId')
 * - required: If true, returns 400 if no valid org context (default: true)
 */
declare function orgContextMiddleware(options?: {}): (req: any, res: any, next: any) => Promise<any>;
declare namespace orgContextMiddleware {
    export { getUserOrganizations };
    export { resolveUserOrgAccess };
    export { setDependencies };
}
/**
 * Get list of all organizations a user has access to.
 */
declare function getUserOrganizations(userId: any): Promise<any>;
/**
 * Resolve organization access for a user.
 * Checks both organization_members table and consultant_org_links.
 * ALWAYS hits DB — no cache (fail-fast on revocation).
 */
declare function resolveUserOrgAccess(userId: any, orgId: any): Promise<any>;
/**
 * Inject dependencies for testing
 * @param {Object} newDeps
 */
declare function setDependencies(newDeps: Object): void;
//# sourceMappingURL=orgContextMiddleware.d.ts.map