export namespace PMO_ROLE_LEVELS {
    let EXECUTIVE: number;
    let MANAGER: number;
    let LEAD: number;
    let MEMBER: number;
    let STAKEHOLDER: number;
}
export default pmoRoleServiceInstance;
declare const pmoRoleServiceInstance: PMORoleService;
declare class PMORoleService {
    _db: any;
    PMO_ROLE_LEVELS: {
        EXECUTIVE: number;
        MANAGER: number;
        LEAD: number;
        MEMBER: number;
        STAKEHOLDER: number;
    };
    get db(): any;
    /**
     * Initialize service dependencies
     */
    init(): Promise<this>;
    /**
     * Set dependencies manually (for testing)
     */
    setDependencies(customDeps: any): void;
    /**
     * Get all PMO role definitions
     */
    getAllRoles(options?: {}): Promise<any>;
    /**
     * Get a single role by ID or code
     */
    getRole(identifier: any): Promise<{
        capabilities: any;
        id: any;
        code: any;
        name: any;
        namePl: any;
        level: any;
        levelName: string | undefined;
        standards: {
            prince2: any;
            pmbok: any;
            iso21500: any;
        };
        reportsTo: any;
        isRequired: boolean;
        maxPerProject: any;
        canBeExternal: boolean;
        description: any;
        descriptionPl: any;
        isSystem: boolean;
        defaultCapabilities: any;
    } | null>;
    /**
     * Get roles grouped by level
     */
    getRolesByLevel(): Promise<{
        executive: any;
        manager: any;
        lead: any;
        member: any;
        stakeholder: any;
    }>;
    /**
     * Assign user to project with PMO role
     */
    assignProjectRole(userId: any, projectId: any, pmoRoleId: any, options?: {}): Promise<{
        userId: any;
        userName: string;
        userEmail: any;
        userAvatar: any;
        userRole: any;
        projectId: any;
        projectName: any;
        pmoRole: {
            id: any;
            code: any;
            name: any;
            namePl: any;
            level: any;
            prince2Role: any;
            pmbokRole: any;
            description: any;
        } | null;
        legacyRole: any;
        workstreamId: any;
        allocationPercent: any;
        startDate: any;
        endDate: any;
        responsibilities: any;
        notes: any;
        permissions: any;
        createdAt: any;
        updatedAt: any;
    } | null>;
    /**
     * Remove user from project
     */
    removeFromProject(userId: any, projectId: any, removedBy?: null): Promise<boolean>;
    /**
     * Get project member details
     */
    getProjectMember(projectId: any, userId: any): Promise<{
        userId: any;
        userName: string;
        userEmail: any;
        userAvatar: any;
        userRole: any;
        projectId: any;
        projectName: any;
        pmoRole: {
            id: any;
            code: any;
            name: any;
            namePl: any;
            level: any;
            prince2Role: any;
            pmbokRole: any;
            description: any;
        } | null;
        legacyRole: any;
        workstreamId: any;
        allocationPercent: any;
        startDate: any;
        endDate: any;
        responsibilities: any;
        notes: any;
        permissions: any;
        createdAt: any;
        updatedAt: any;
    } | null>;
    /**
     * Get project team
     */
    getProjectTeam(projectId: any, options?: {}): Promise<any>;
    /**
     * Get project team grouped by role level
     */
    getProjectTeamByLevel(projectId: any): Promise<{
        executive: any;
        manager: any;
        lead: any;
        member: any;
        stakeholder: any;
        unassigned: any;
    }>;
    /**
     * Get all project assignments for a user
     */
    getUserProjectRoles(userId: any): Promise<any>;
    /**
     * Get capabilities for a PMO role
     */
    getRoleCapabilities(roleId: any): Promise<any>;
    /**
     * Create a custom PMO role
     */
    createCustomRole(roleData: any): Promise<{
        capabilities: any;
        id: any;
        code: any;
        name: any;
        namePl: any;
        level: any;
        levelName: string | undefined;
        standards: {
            prince2: any;
            pmbok: any;
            iso21500: any;
        };
        reportsTo: any;
        isRequired: boolean;
        maxPerProject: any;
        canBeExternal: boolean;
        description: any;
        descriptionPl: any;
        isSystem: boolean;
        defaultCapabilities: any;
    } | null>;
    /**
     * Update user's allocation percentage
     */
    updateAllocation(userId: any, projectId: any, allocationPercent: any): Promise<{
        userId: any;
        userName: string;
        userEmail: any;
        userAvatar: any;
        userRole: any;
        projectId: any;
        projectName: any;
        pmoRole: {
            id: any;
            code: any;
            name: any;
            namePl: any;
            level: any;
            prince2Role: any;
            pmbokRole: any;
            description: any;
        } | null;
        legacyRole: any;
        workstreamId: any;
        allocationPercent: any;
        startDate: any;
        endDate: any;
        responsibilities: any;
        notes: any;
        permissions: any;
        createdAt: any;
        updatedAt: any;
    } | null>;
    /**
     * Get project team statistics
     */
    getProjectTeamStats(projectId: any): Promise<{
        projectId: any;
        totalMembers: any;
        totalAllocation: any;
        averageAllocation: number;
        byLevel: {
            executive: any;
            manager: any;
            lead: any;
            member: any;
            stakeholder: any;
        };
        requiredRoles: {
            total: any;
            filled: any;
            missing: any;
        };
    }>;
    _formatRole(row: any): {
        id: any;
        code: any;
        name: any;
        namePl: any;
        level: any;
        levelName: string | undefined;
        standards: {
            prince2: any;
            pmbok: any;
            iso21500: any;
        };
        reportsTo: any;
        isRequired: boolean;
        maxPerProject: any;
        canBeExternal: boolean;
        description: any;
        descriptionPl: any;
        isSystem: boolean;
        defaultCapabilities: any;
    };
    _formatProjectMember(row: any): {
        userId: any;
        userName: string;
        userEmail: any;
        userAvatar: any;
        userRole: any;
        projectId: any;
        projectName: any;
        pmoRole: {
            id: any;
            code: any;
            name: any;
            namePl: any;
            level: any;
            prince2Role: any;
            pmbokRole: any;
            description: any;
        } | null;
        legacyRole: any;
        workstreamId: any;
        allocationPercent: any;
        startDate: any;
        endDate: any;
        responsibilities: any;
        notes: any;
        permissions: any;
        createdAt: any;
        updatedAt: any;
    };
    _parseJSON(str: any, defaultValue: any): any;
    _logAssignment(orgId: any, eventType: any, metadata: any): Promise<void>;
}
//# sourceMappingURL=pmoRoleService.d.ts.map