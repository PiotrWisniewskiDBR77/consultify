// AI Role Guard - Enforces role-based behavior constraints
// AI Roles Model: ADVISOR < MANAGER < OPERATOR
// This is the central service for AI role enforcement in SCMS

// Dependency injection container (for deterministic unit tests)
const deps = {
    db: require('../database')
};

const AI_PROJECT_ROLES = {
    ADVISOR: 'ADVISOR',
    MANAGER: 'MANAGER',
    OPERATOR: 'OPERATOR'
};

const ROLE_HIERARCHY = ['ADVISOR', 'MANAGER', 'OPERATOR'];

// Capability matrix per role - defines what each role can and cannot do
const ROLE_CAPABILITIES = {
    ADVISOR: {
        canExplain: true,
        canSuggest: true,
        canAnalyze: true,
        canCreateDrafts: false,
        canExecuteActions: false,
        canModifyEntities: false,
        requiresApproval: false
    },
    MANAGER: {
        canExplain: true,
        canSuggest: true,
        canAnalyze: true,
        canCreateDrafts: true,
        canExecuteActions: false,
        canModifyEntities: false,
        requiresApproval: true  // ALL actions require explicit approval
    },
    OPERATOR: {
        canExplain: true,
        canSuggest: true,
        canAnalyze: true,
        canCreateDrafts: true,
        canExecuteActions: true,
        canModifyEntities: true,
        requiresApproval: false  // Within governance rules
    }
};

// Map action types to required capabilities
const ACTION_CAPABILITY_REQUIREMENTS = {
    // Read-only actions - allowed for all roles
    EXPLAIN_CONTEXT: 'canExplain',
    ANALYZE_RISKS: 'canAnalyze',
    PREPARE_DECISION_SUMMARY: 'canSuggest',

    // Draft actions - require MANAGER or higher
    CREATE_DRAFT_TASK: 'canCreateDrafts',
    CREATE_DRAFT_INITIATIVE: 'canCreateDrafts',
    CREATE_DRAFT_DECISION: 'canCreateDrafts',
    SUGGEST_ROADMAP_CHANGE: 'canCreateDrafts',
    GENERATE_REPORT: 'canCreateDrafts',

    // Execution actions - require OPERATOR
    EXECUTE_TASK_UPDATE: 'canExecuteActions',
    EXECUTE_STATUS_CHANGE: 'canExecuteActions',
    EXECUTE_ASSIGNMENT: 'canExecuteActions',
    CREATE_ENTITY: 'canModifyEntities',
    UPDATE_ENTITY: 'canModifyEntities',
    DELETE_ENTITY: 'canModifyEntities'
};

const ROLE_DESCRIPTIONS = {
    ADVISOR: 'AI explains, suggests, and warns. Cannot modify any data.',
    MANAGER: 'AI prepares drafts and proposals. All actions require explicit approval.',
    OPERATOR: 'AI executes approved actions within governance rules.'
};

const AIRoleGuard = {
    AI_PROJECT_ROLES,
    ROLE_CAPABILITIES,
    ROLE_HIERARCHY,

    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },

    /**
     * Get the active AI role for a project
     * @param {string} projectId - Project ID
     * @returns {Promise<string>} - AI role (ADVISOR, MANAGER, OPERATOR)
     */
    getProjectRole: async (projectId) => {
        if (!projectId) {
            return 'ADVISOR'; // Default to safest role
        }

        return new Promise((resolve, reject) => {
            deps.db.get(`SELECT ai_role FROM projects WHERE id = ?`, [projectId], (err, row) => {
                if (err) {
                    console.error('[AIRoleGuard] Error fetching project role:', err);
                    return resolve('ADVISOR'); // Fail-safe to ADVISOR
                }
                resolve(row?.ai_role || 'ADVISOR');
            });
        });
    },

    /**
     * Set the AI role for a project (Admin only)
     * @param {string} projectId - Project ID
     * @param {string} role - New AI role
     * @param {string} userId - User making the change
     * @returns {Promise<object>} - Result
     */
    setProjectRole: async (projectId, role, userId) => {
        if (!ROLE_HIERARCHY.includes(role)) {
            throw new Error(`Invalid AI role: ${role}. Must be one of: ${ROLE_HIERARCHY.join(', ')}`);
        }

        return new Promise((resolve, reject) => {
            deps.db.run(
                `UPDATE projects SET ai_role = ? WHERE id = ?`,
                [role, projectId],
                function (err) {
                    if (err) {
                        console.error('[AIRoleGuard] Error setting project role:', err);
                        return reject(err);
                    }
                    console.log(`[AIRoleGuard] Project ${projectId} AI role set to ${role} by user ${userId}`);
                    resolve({ updated: this.changes > 0, projectId, role });
                }
            );
        });
    },

    /**
     * Get capabilities for a role
     * @param {string} role - AI role
     * @returns {object} - Role capabilities
     */
    getRoleCapabilities: (role) => {
        return ROLE_CAPABILITIES[role] || ROLE_CAPABILITIES.ADVISOR;
    },

    /**
     * Get role description
     * @param {string} role - AI role
     * @returns {string} - Human-readable description
     */
    getRoleDescription: (role) => {
        return ROLE_DESCRIPTIONS[role] || ROLE_DESCRIPTIONS.ADVISOR;
    },

    /**
     * Check if an action is allowed for a project's AI role
     * @param {string} projectId - Project ID
     * @param {string} actionType - Action type
     * @returns {Promise<object>} - { allowed, requiresApproval, reason }
     */
    canPerformAction: async (projectId, actionType) => {
        const role = await AIRoleGuard.getProjectRole(projectId);
        const capabilities = ROLE_CAPABILITIES[role];
        const requiredCapability = ACTION_CAPABILITY_REQUIREMENTS[actionType];

        // If action type not mapped, default to allowing explain/analyze
        if (!requiredCapability) {
            return {
                allowed: true,
                requiresApproval: capabilities.requiresApproval,
                role,
                reason: 'Action type not restricted'
            };
        }

        const hasCapability = capabilities[requiredCapability] === true;

        return {
            allowed: hasCapability,
            requiresApproval: role === 'MANAGER' && hasCapability,
            role,
            requiredCapability,
            reason: hasCapability
                ? `Action permitted for ${role} role`
                : `Action requires capability '${requiredCapability}' which is not available in ${role} role`
        };
    },

    /**
     * Check if an action is blocked (returns detailed info)
     * @param {string} projectId - Project ID
     * @param {string} actionType - Action type
     * @returns {Promise<object>} - { blocked, reason, currentRole, roleRequired }
     */
    isActionBlocked: async (projectId, actionType) => {
        const result = await AIRoleGuard.canPerformAction(projectId, actionType);

        if (result.allowed) {
            return {
                blocked: false,
                requiresApproval: result.requiresApproval,
                currentRole: result.role,
                reason: result.reason
            };
        }

        // Determine minimum required role for this action
        const requiredCapability = ACTION_CAPABILITY_REQUIREMENTS[actionType];
        let roleRequired = 'ADVISOR';

        if (requiredCapability === 'canCreateDrafts') {
            roleRequired = 'MANAGER';
        } else if (requiredCapability === 'canExecuteActions' || requiredCapability === 'canModifyEntities') {
            roleRequired = 'OPERATOR';
        }

        return {
            blocked: true,
            currentRole: result.role,
            roleRequired,
            reason: `Action '${actionType}' requires ${roleRequired} role, but project is configured as ${result.role}`,
            suggestion: `To perform this action, an admin must change the project AI role to ${roleRequired} or higher in Project Settings → AI Governance.`
        };
    },

    /**
     * Get full role configuration for a project
     * @param {string} projectId - Project ID
     * @returns {Promise<object>} - Full role config
     */
    getRoleConfig: async (projectId) => {
        const role = await AIRoleGuard.getProjectRole(projectId);
        return {
            activeRole: role,
            capabilities: ROLE_CAPABILITIES[role],
            roleDescription: ROLE_DESCRIPTIONS[role],
            roleHierarchy: ROLE_HIERARCHY,
            roleIndex: ROLE_HIERARCHY.indexOf(role)
        };
    },

    /**
     * Validate if mutation is allowed based on role
     * This is the central guard for all write operations
     * @param {string} projectId - Project ID
     * @param {string} mutationType - Type of mutation (create, update, delete)
     * @returns {Promise<object>} - { allowed, asDraft, reason }
     */
    validateMutation: async (projectId, mutationType) => {
        const role = await AIRoleGuard.getProjectRole(projectId);

        switch (role) {
            case 'ADVISOR':
                // Block ALL mutations in ADVISOR mode
                return {
                    allowed: false,
                    asDraft: false,
                    reason: 'AI is in ADVISOR mode and cannot perform any mutations. Only explanations and suggestions are allowed.'
                };

            case 'MANAGER':
                // Allow mutations ONLY as drafts requiring approval
                return {
                    allowed: true,
                    asDraft: true,
                    requiresApproval: true,
                    reason: 'AI is in MANAGER mode. All changes will be saved as drafts requiring explicit user approval.'
                };

            case 'OPERATOR':
                // Allow mutations within governance rules
                return {
                    allowed: true,
                    asDraft: false,
                    requiresApproval: false,
                    reason: 'AI is in OPERATOR mode. Changes will be executed within project governance rules.'
                };

            default:
                // Fail-safe to ADVISOR behavior
                return {
                    allowed: false,
                    asDraft: false,
                    reason: 'Unknown AI role. Defaulting to ADVISOR mode (no mutations allowed).'
                };
        }
    }
};

module.exports = AIRoleGuard;
