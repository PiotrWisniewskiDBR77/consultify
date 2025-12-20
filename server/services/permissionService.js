// SCMS Permission Service
// Uses definitions from types.ts conceptually, but redeclared here for Runtime JS
// In a JS file we don't have the Enums at runtime unless compiled, so we define constants.

const ROLES = {
    SUPERADMIN: 'SUPERADMIN',
    ADMIN: 'ADMIN',
    PROJECT_MANAGER: 'PROJECT_MANAGER',
    TEAM_MEMBER: 'TEAM_MEMBER',
    VIEWER: 'VIEWER'
};

const CAPABILITIES = {
    MANAGE_USERS: 'manage_users',
    MANAGE_ROLES: 'manage_roles',
    MANAGE_BILLING: 'manage_billing',
    MANAGE_ORG_SETTINGS: 'manage_org_settings',
    MANAGE_AI_POLICY: 'manage_ai_policy',
    CREATE_PROJECT: 'create_project',
    EDIT_PROJECT_SETTINGS: 'edit_project_settings',
    MANAGE_PROJECT_ROLES: 'manage_project_roles',
    MANAGE_WORKSTREAMS: 'manage_workstreams',
    APPROVE_CHANGES: 'approve_changes',
    MANAGE_STAGE_GATES: 'manage_stage_gates',
    VIEW_AUDIT_LOG: 'view_audit_log',
    CREATE_INITIATIVE: 'create_initiative',
    EDIT_INITIATIVE: 'edit_initiative',
    MANAGE_ROADMAP: 'manage_roadmap',
    ASSIGN_TASKS: 'assign_tasks',
    UPDATE_TASK_STATUS: 'update_task_status',
    MANAGE_RISKS: 'manage_risks',
    AI_EXECUTE_ACTIONS: 'ai_execute_actions',
    AI_VIEW_INSIGHTS: 'ai_view_insights'
};

// Default Capability Matrix
const ROLE_CAPABILITIES = {
    [ROLES.SUPERADMIN]: Object.values(CAPABILITIES), // Everything
    [ROLES.ADMIN]: Object.values(CAPABILITIES), // Everything in Tenant Scope
    [ROLES.PROJECT_MANAGER]: [
        CAPABILITIES.EDIT_PROJECT_SETTINGS,
        CAPABILITIES.MANAGE_PROJECT_ROLES,
        CAPABILITIES.MANAGE_WORKSTREAMS,
        CAPABILITIES.APPROVE_CHANGES,
        CAPABILITIES.MANAGE_STAGE_GATES,
        CAPABILITIES.VIEW_AUDIT_LOG,
        CAPABILITIES.CREATE_INITIATIVE,
        CAPABILITIES.EDIT_INITIATIVE,
        CAPABILITIES.MANAGE_ROADMAP,
        CAPABILITIES.ASSIGN_TASKS,
        CAPABILITIES.UPDATE_TASK_STATUS,
        CAPABILITIES.MANAGE_RISKS,
        CAPABILITIES.AI_VIEW_INSIGHTS
    ],
    [ROLES.TEAM_MEMBER]: [
        CAPABILITIES.UPDATE_TASK_STATUS,
        CAPABILITIES.AI_VIEW_INSIGHTS
    ],
    [ROLES.VIEWER]: [
        CAPABILITIES.AI_VIEW_INSIGHTS
    ]
};

const PermissionService = {
    /**
     * Check if a user has a capability in a given scope.
     * @param {Object} user - User object with .role
     * @param {string} capability - Capability string
     * @param {Object} context - { organizationId, projectId, resourceOwnerId }
     * @returns {boolean}
     */
    can: (user, capability, context = {}) => {
        if (!user || !user.role) return false;

        // 1. SuperAdmin overrides everything
        if (user.role === ROLES.SUPERADMIN) return true;

        // 2. Check if Role has the Capability
        const allowedCaps = ROLE_CAPABILITIES[user.role] || [];
        if (!allowedCaps.includes(capability)) return false;

        // 3. Scope Checks (e.g., Tenant Isolation)
        // If capability is Tenant-Level (e.g. MANAGE_USERS), user must be ADMIN
        // and context.organizationId must match user.organizationId
        // This effectively isolates tenants.
        if ([CAPABILITIES.MANAGE_USERS, CAPABILITIES.MANAGE_ORG_SETTINGS].includes(capability)) {
            if (user.role !== ROLES.ADMIN) return false;
            // Tenant Check Logic would also go here if we had multi-tenant query context
        }

        return true;
    },

    /**
     * Get list of capabilities for a role
     */
    getCapabilitiesForRole: (role) => {
        return ROLE_CAPABILITIES[role] || [];
    }
};

module.exports = PermissionService;
