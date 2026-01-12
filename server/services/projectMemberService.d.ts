export default projectMemberServiceInstance;
declare const projectMemberServiceInstance: ProjectMemberService;
declare class ProjectMemberService {
    _db: any;
    PROJECT_ROLES: {
        SPONSOR: string;
        DECISION_OWNER: string;
        PMO_LEAD: string;
        WORKSTREAM_OWNER: string;
        INITIATIVE_OWNER: string;
        TASK_ASSIGNEE: string;
        SME: string;
        REVIEWER: string;
        OBSERVER: string;
        CONSULTANT: string;
        STAKEHOLDER: string;
    };
    DEFAULT_PERMISSIONS: {
        [PROJECT_ROLES.SPONSOR]: {
            canViewProject: boolean;
            canViewTasks: boolean;
            canViewInitiatives: boolean;
            canViewDecisions: boolean;
            canViewFinancials: boolean;
            canCreateTasks: boolean;
            canAssignTasks: boolean;
            canUpdateTasks: boolean;
            canDeleteTasks: boolean;
            canCreateInitiatives: boolean;
            canUpdateInitiatives: boolean;
            canDeleteInitiatives: boolean;
            canRequestDecisions: boolean;
            canApproveDecisions: boolean;
            canSubmitChangeRequests: boolean;
            canApproveChangeRequests: boolean;
            canManageTeam: boolean;
            canManageWorkstreams: boolean;
            canConfigureProject: boolean;
            canEscalate: boolean;
            canReceiveEscalations: boolean;
        };
        [PROJECT_ROLES.DECISION_OWNER]: {
            canViewProject: boolean;
            canViewTasks: boolean;
            canViewInitiatives: boolean;
            canViewDecisions: boolean;
            canViewFinancials: boolean;
            canCreateTasks: boolean;
            canAssignTasks: boolean;
            canUpdateTasks: boolean;
            canDeleteTasks: boolean;
            canCreateInitiatives: boolean;
            canUpdateInitiatives: boolean;
            canDeleteInitiatives: boolean;
            canRequestDecisions: boolean;
            canApproveDecisions: boolean;
            canSubmitChangeRequests: boolean;
            canApproveChangeRequests: boolean;
            canManageTeam: boolean;
            canManageWorkstreams: boolean;
            canConfigureProject: boolean;
            canEscalate: boolean;
            canReceiveEscalations: boolean;
        };
        [PROJECT_ROLES.PMO_LEAD]: {
            canViewProject: boolean;
            canViewTasks: boolean;
            canViewInitiatives: boolean;
            canViewDecisions: boolean;
            canViewFinancials: boolean;
            canCreateTasks: boolean;
            canAssignTasks: boolean;
            canUpdateTasks: boolean;
            canDeleteTasks: boolean;
            canCreateInitiatives: boolean;
            canUpdateInitiatives: boolean;
            canDeleteInitiatives: boolean;
            canRequestDecisions: boolean;
            canApproveDecisions: boolean;
            canSubmitChangeRequests: boolean;
            canApproveChangeRequests: boolean;
            canManageTeam: boolean;
            canManageWorkstreams: boolean;
            canConfigureProject: boolean;
            canEscalate: boolean;
            canReceiveEscalations: boolean;
        };
        [PROJECT_ROLES.WORKSTREAM_OWNER]: {
            canViewProject: boolean;
            canViewTasks: boolean;
            canViewInitiatives: boolean;
            canViewDecisions: boolean;
            canViewFinancials: boolean;
            canCreateTasks: boolean;
            canAssignTasks: boolean;
            canUpdateTasks: boolean;
            canDeleteTasks: boolean;
            canCreateInitiatives: boolean;
            canUpdateInitiatives: boolean;
            canDeleteInitiatives: boolean;
            canRequestDecisions: boolean;
            canApproveDecisions: boolean;
            canSubmitChangeRequests: boolean;
            canApproveChangeRequests: boolean;
            canManageTeam: boolean;
            canManageWorkstreams: boolean;
            canConfigureProject: boolean;
            canEscalate: boolean;
            canReceiveEscalations: boolean;
        };
        [PROJECT_ROLES.INITIATIVE_OWNER]: {
            canViewProject: boolean;
            canViewTasks: boolean;
            canViewInitiatives: boolean;
            canViewDecisions: boolean;
            canViewFinancials: boolean;
            canCreateTasks: boolean;
            canAssignTasks: boolean;
            canUpdateTasks: boolean;
            canDeleteTasks: boolean;
            canCreateInitiatives: boolean;
            canUpdateInitiatives: boolean;
            canDeleteInitiatives: boolean;
            canRequestDecisions: boolean;
            canApproveDecisions: boolean;
            canSubmitChangeRequests: boolean;
            canApproveChangeRequests: boolean;
            canManageTeam: boolean;
            canManageWorkstreams: boolean;
            canConfigureProject: boolean;
            canEscalate: boolean;
            canReceiveEscalations: boolean;
        };
        [PROJECT_ROLES.TASK_ASSIGNEE]: {
            canViewProject: boolean;
            canViewTasks: boolean;
            canViewInitiatives: boolean;
            canViewDecisions: boolean;
            canViewFinancials: boolean;
            canCreateTasks: boolean;
            canAssignTasks: boolean;
            canUpdateTasks: boolean;
            canDeleteTasks: boolean;
            canCreateInitiatives: boolean;
            canUpdateInitiatives: boolean;
            canDeleteInitiatives: boolean;
            canRequestDecisions: boolean;
            canApproveDecisions: boolean;
            canSubmitChangeRequests: boolean;
            canApproveChangeRequests: boolean;
            canManageTeam: boolean;
            canManageWorkstreams: boolean;
            canConfigureProject: boolean;
            canEscalate: boolean;
            canReceiveEscalations: boolean;
        };
        [PROJECT_ROLES.SME]: {
            canViewProject: boolean;
            canViewTasks: boolean;
            canViewInitiatives: boolean;
            canViewDecisions: boolean;
            canViewFinancials: boolean;
            canCreateTasks: boolean;
            canAssignTasks: boolean;
            canUpdateTasks: boolean;
            canDeleteTasks: boolean;
            canCreateInitiatives: boolean;
            canUpdateInitiatives: boolean;
            canDeleteInitiatives: boolean;
            canRequestDecisions: boolean;
            canApproveDecisions: boolean;
            canSubmitChangeRequests: boolean;
            canApproveChangeRequests: boolean;
            canManageTeam: boolean;
            canManageWorkstreams: boolean;
            canConfigureProject: boolean;
            canEscalate: boolean;
            canReceiveEscalations: boolean;
        };
        [PROJECT_ROLES.REVIEWER]: {
            canViewProject: boolean;
            canViewTasks: boolean;
            canViewInitiatives: boolean;
            canViewDecisions: boolean;
            canViewFinancials: boolean;
            canCreateTasks: boolean;
            canAssignTasks: boolean;
            canUpdateTasks: boolean;
            canDeleteTasks: boolean;
            canCreateInitiatives: boolean;
            canUpdateInitiatives: boolean;
            canDeleteInitiatives: boolean;
            canRequestDecisions: boolean;
            canApproveDecisions: boolean;
            canSubmitChangeRequests: boolean;
            canApproveChangeRequests: boolean;
            canManageTeam: boolean;
            canManageWorkstreams: boolean;
            canConfigureProject: boolean;
            canEscalate: boolean;
            canReceiveEscalations: boolean;
        };
        [PROJECT_ROLES.OBSERVER]: {
            canViewProject: boolean;
            canViewTasks: boolean;
            canViewInitiatives: boolean;
            canViewDecisions: boolean;
            canViewFinancials: boolean;
            canCreateTasks: boolean;
            canAssignTasks: boolean;
            canUpdateTasks: boolean;
            canDeleteTasks: boolean;
            canCreateInitiatives: boolean;
            canUpdateInitiatives: boolean;
            canDeleteInitiatives: boolean;
            canRequestDecisions: boolean;
            canApproveDecisions: boolean;
            canSubmitChangeRequests: boolean;
            canApproveChangeRequests: boolean;
            canManageTeam: boolean;
            canManageWorkstreams: boolean;
            canConfigureProject: boolean;
            canEscalate: boolean;
            canReceiveEscalations: boolean;
        };
        [PROJECT_ROLES.CONSULTANT]: {
            canViewProject: boolean;
            canViewTasks: boolean;
            canViewInitiatives: boolean;
            canViewDecisions: boolean;
            canViewFinancials: boolean;
            canCreateTasks: boolean;
            canAssignTasks: boolean;
            canUpdateTasks: boolean;
            canDeleteTasks: boolean;
            canCreateInitiatives: boolean;
            canUpdateInitiatives: boolean;
            canDeleteInitiatives: boolean;
            canRequestDecisions: boolean;
            canApproveDecisions: boolean;
            canSubmitChangeRequests: boolean;
            canApproveChangeRequests: boolean;
            canManageTeam: boolean;
            canManageWorkstreams: boolean;
            canConfigureProject: boolean;
            canEscalate: boolean;
            canReceiveEscalations: boolean;
        };
        [PROJECT_ROLES.STAKEHOLDER]: {
            canViewProject: boolean;
            canViewTasks: boolean;
            canViewInitiatives: boolean;
            canViewDecisions: boolean;
            canViewFinancials: boolean;
            canCreateTasks: boolean;
            canAssignTasks: boolean;
            canUpdateTasks: boolean;
            canDeleteTasks: boolean;
            canCreateInitiatives: boolean;
            canUpdateInitiatives: boolean;
            canDeleteInitiatives: boolean;
            canRequestDecisions: boolean;
            canApproveDecisions: boolean;
            canSubmitChangeRequests: boolean;
            canApproveChangeRequests: boolean;
            canManageTeam: boolean;
            canManageWorkstreams: boolean;
            canConfigureProject: boolean;
            canEscalate: boolean;
            canReceiveEscalations: boolean;
        };
    };
    RACI_MATRIX: {
        PROJECT: {
            [PROJECT_ROLES.PMO_LEAD]: string;
            [PROJECT_ROLES.SPONSOR]: string;
            [PROJECT_ROLES.CONSULTANT]: string;
            [PROJECT_ROLES.STAKEHOLDER]: string;
        };
        INITIATIVE: {
            [PROJECT_ROLES.INITIATIVE_OWNER]: string;
            [PROJECT_ROLES.PMO_LEAD]: string;
            [PROJECT_ROLES.SME]: string;
            [PROJECT_ROLES.TASK_ASSIGNEE]: string;
        };
        TASK: {
            [PROJECT_ROLES.TASK_ASSIGNEE]: string;
            [PROJECT_ROLES.INITIATIVE_OWNER]: string;
            [PROJECT_ROLES.SME]: string;
            [PROJECT_ROLES.PMO_LEAD]: string;
        };
        DECISION: {
            [PROJECT_ROLES.DECISION_OWNER]: string;
            [PROJECT_ROLES.SPONSOR]: string;
            [PROJECT_ROLES.PMO_LEAD]: string;
            [PROJECT_ROLES.STAKEHOLDER]: string;
        };
        CHANGE_REQUEST: {
            [PROJECT_ROLES.PMO_LEAD]: string;
            [PROJECT_ROLES.SPONSOR]: string;
            [PROJECT_ROLES.DECISION_OWNER]: string;
            [PROJECT_ROLES.STAKEHOLDER]: string;
        };
        ASSESSMENT: {
            [PROJECT_ROLES.PMO_LEAD]: string;
            [PROJECT_ROLES.PMO_LEAD]: string;
            [PROJECT_ROLES.REVIEWER]: string;
            [PROJECT_ROLES.SPONSOR]: string;
        };
        ROADMAP: {
            [PROJECT_ROLES.PMO_LEAD]: string;
            [PROJECT_ROLES.SPONSOR]: string;
            [PROJECT_ROLES.INITIATIVE_OWNER]: string;
            [PROJECT_ROLES.STAKEHOLDER]: string;
        };
        STAGE_GATE: {
            [PROJECT_ROLES.PMO_LEAD]: string;
            [PROJECT_ROLES.SPONSOR]: string;
            [PROJECT_ROLES.DECISION_OWNER]: string;
            [PROJECT_ROLES.STAKEHOLDER]: string;
        };
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
     * Add a member to a project
     */
    addMember(projectId: any, userId: any, projectRole: any, options?: {}): Promise<{
        id: any;
        projectId: any;
        userId: any;
        projectRole: any;
        workstreamId: any;
        allocationPercent: any;
        permissions: any;
        startDate: any;
        endDate: any;
        createdAt: any;
        updatedAt: any;
        addedById: any;
        firstName: any;
        lastName: any;
        email: any;
        avatarUrl: any;
    } | null>;
    /**
     * Update a member's role or permissions
     */
    updateMember(projectId: any, userId: any, updates: any): Promise<{
        id: any;
        projectId: any;
        userId: any;
        projectRole: any;
        workstreamId: any;
        allocationPercent: any;
        permissions: any;
        startDate: any;
        endDate: any;
        createdAt: any;
        updatedAt: any;
        addedById: any;
        firstName: any;
        lastName: any;
        email: any;
        avatarUrl: any;
    } | null>;
    /**
     * Remove a member from a project
     */
    removeMember(projectId: any, userId: any): Promise<boolean>;
    /**
     * Get a single member
     */
    getMember(projectId: any, userId: any): Promise<{
        id: any;
        projectId: any;
        userId: any;
        projectRole: any;
        workstreamId: any;
        allocationPercent: any;
        permissions: any;
        startDate: any;
        endDate: any;
        createdAt: any;
        updatedAt: any;
        addedById: any;
        firstName: any;
        lastName: any;
        email: any;
        avatarUrl: any;
    } | null>;
    /**
     * Get all members of a project
     */
    getProjectTeam(projectId: any, options?: {}): Promise<any>;
    /**
     * Check if a user has a specific permission on a project
     */
    checkPermission(projectId: any, userId: any, permission: any): Promise<boolean>;
    /**
     * Get the RACI matrix for a project
     */
    getRACIMatrix(projectId: any): Promise<{
        projectId: any;
        matrix: {};
        generatedAt: string;
    }>;
    /**
     * Get members who can receive escalations
     */
    getEscalationRecipients(projectId: any, escalationLevel: any): Promise<any>;
    /**
     * Get available assignees for a task
     */
    getAvailableAssignees(projectId: any, options?: {}): Promise<any>;
    getMemberByRole(projectId: any, role: any): Promise<{
        id: any;
        projectId: any;
        userId: any;
        projectRole: any;
        workstreamId: any;
        allocationPercent: any;
        permissions: any;
        startDate: any;
        endDate: any;
        createdAt: any;
        updatedAt: any;
        addedById: any;
        firstName: any;
        lastName: any;
        email: any;
        avatarUrl: any;
    } | null>;
    getUserRole(projectId: any, userId: any): Promise<any>;
    getUserProjects(userId: any): Promise<any>;
    _formatMember(row: any): {
        id: any;
        projectId: any;
        userId: any;
        projectRole: any;
        workstreamId: any;
        allocationPercent: any;
        permissions: any;
        startDate: any;
        endDate: any;
        createdAt: any;
        updatedAt: any;
        addedById: any;
        firstName: any;
        lastName: any;
        email: any;
        avatarUrl: any;
    };
    _logAudit(projectId: any, action: any, metadata?: {}): Promise<void>;
}
declare namespace PROJECT_ROLES {
    let SPONSOR: string;
    let DECISION_OWNER: string;
    let PMO_LEAD: string;
    let WORKSTREAM_OWNER: string;
    let INITIATIVE_OWNER: string;
    let TASK_ASSIGNEE: string;
    let SME: string;
    let REVIEWER: string;
    let OBSERVER: string;
    let CONSULTANT: string;
    let STAKEHOLDER: string;
}
//# sourceMappingURL=projectMemberService.d.ts.map