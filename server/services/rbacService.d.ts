export default rBACServiceInstance;
declare const rBACServiceInstance: RBACService;
declare class RBACService {
    /**
     * Create a custom role
     */
    createRole(organizationId: any, roleData: any): Promise<any>;
    /**
     * Get all roles for an organization
     */
    getOrganizationRoles(organizationId: any, includeSystem?: boolean): Promise<any>;
    /**
     * Get a role by ID
     */
    getRole(roleId: any): Promise<any>;
    /**
     * Get a role by name within an organization
     */
    getRoleByName(organizationId: any, name: any): Promise<any>;
    /**
     * Update a role
     */
    updateRole(roleId: any, updates: any): Promise<any>;
    /**
     * Delete a role
     */
    deleteRole(roleId: any): Promise<any>;
    /**
     * Get all permission definitions
     */
    getPermissionDefinitions(category?: null): Promise<any>;
    /**
     * Get permissions for a role
     */
    getRolePermissions(roleId: any): Promise<any>;
    /**
     * Set permissions for a role
     */
    setRolePermissions(roleId: any, permissions: any): Promise<any>;
    /**
     * Add a single permission to a role
     */
    addPermissionToRole(roleId: any, permissionId: any, grantType?: string, conditions?: null): Promise<any>;
    /**
     * Remove a permission from a role
     */
    removePermissionFromRole(roleId: any, permissionId: any): Promise<any>;
    /**
     * Assign a role to a user
     */
    assignRole(userId: any, roleId: any, organizationId: any, options?: {}): Promise<any>;
    /**
     * Revoke a role from a user
     */
    revokeRole(assignmentId: any): Promise<any>;
    /**
     * Get user's role assignments
     */
    getUserRoles(userId: any, organizationId?: null): Promise<any>;
    /**
     * Get all users with a specific role
     */
    getRoleUsers(roleId: any, organizationId: any): Promise<any>;
    /**
     * Check if user has a specific permission
     */
    hasPermission(userId: any, organizationId: any, permission: any, context?: {}): Promise<{
        allowed: boolean;
        source: string;
        role: any;
    } | {
        allowed: boolean;
        source: string;
        role?: undefined;
    }>;
    /**
     * Get user's effective permissions
     */
    getEffectivePermissions(userId: any, organizationId: any): Promise<any[]>;
    /**
     * Get user's system role from users table
     */
    getUserSystemRole(userId: any): Promise<any>;
    /**
     * Match permission against permission patterns
     */
    matchPermission(patterns: any, permission: any): boolean;
    /**
     * Evaluate permission conditions
     */
    evaluateConditions(conditions: any, context: any): boolean;
    /**
     * Get predefined role templates
     */
    getRoleTemplates(): {
        name: string;
        displayName: string;
        description: string;
        color: string;
        icon: string;
        permissions: string[];
    }[];
    /**
     * Create role from template
     */
    createRoleFromTemplate(organizationId: any, templateName: any, createdBy: any): Promise<any>;
}
//# sourceMappingURL=rbacService.d.ts.map