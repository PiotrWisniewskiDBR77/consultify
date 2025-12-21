// AI Policy Engine - Controls what AI is allowed to do
// AI Core Layer — Enterprise PMO Brain

// Dependency injection container (for deterministic unit tests)
const deps = {
    db: require('../database'),
    AIRoleGuard: require('./aiRoleGuard'),
    RegulatoryModeGuard: require('./regulatoryModeGuard')
};

const POLICY_LEVELS = {
    ADVISORY: 'ADVISORY',       // Suggest only
    ASSISTED: 'ASSISTED',       // Create drafts, requires approval
    PROACTIVE: 'PROACTIVE',     // Execute low-risk actions
    AUTOPILOT: 'AUTOPILOT'      // Execute within governance rules
};

const POLICY_HIERARCHY = ['ADVISORY', 'ASSISTED', 'PROACTIVE', 'AUTOPILOT'];

const AI_ROLES = {
    ADVISOR: 'ADVISOR',
    PMO_MANAGER: 'PMO_MANAGER',
    EXECUTOR: 'EXECUTOR',
    EDUCATOR: 'EDUCATOR'
};

const ACTION_POLICY_REQUIREMENTS = {
    EXPLAIN_CONTEXT: 'ADVISORY',
    ANALYZE_RISKS: 'ADVISORY',
    PREPARE_DECISION_SUMMARY: 'ADVISORY',
    CREATE_DRAFT_TASK: 'ASSISTED',
    CREATE_DRAFT_INITIATIVE: 'ASSISTED',
    SUGGEST_ROADMAP_CHANGE: 'ASSISTED',
    GENERATE_REPORT: 'ASSISTED'
};

const AIPolicyEngine = {
    POLICY_LEVELS,
    AI_ROLES,

    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },

    /**
     * Get effective policy for a context
     */
    getEffectivePolicy: async (organizationId, projectId = null, userId = null) => {
        // 0. REGULATORY MODE CHECK - Highest priority override
        // When enabled, forces ADVISORY-only mode regardless of other settings
        if (projectId) {
            const regulatoryModeEnabled = await deps.RegulatoryModeGuard.isEnabled(projectId);
            if (regulatoryModeEnabled) {
                // Return maximally restricted policy
                return {
                    policyLevel: 'ADVISORY',
                    maxPolicyLevel: 'ADVISORY',
                    internetEnabled: false,
                    auditRequired: true,
                    defaultRole: 'ADVISOR',
                    activeRoles: ['ADVISOR'],
                    userTone: 'EXPERT',
                    educationMode: false,
                    // AI Roles Model - Force ADVISOR
                    projectAIRole: 'ADVISOR',
                    roleCapabilities: {
                        canExplain: true,
                        canCreateDrafts: false,
                        canExecute: false,
                        canModify: false
                    },
                    roleDescription: 'Regulatory Mode: Advisory-only',
                    // Regulatory Mode specific flags
                    regulatoryModeEnabled: true,
                    regulatoryModePrompt: deps.RegulatoryModeGuard.getRegulatoryPrompt()
                };
            }
        }

        // 1. Get organization (tenant) policy
        const orgPolicy = await new Promise((resolve, reject) => {
            deps.db.get(`SELECT * FROM ai_policies WHERE organization_id = ?`, [organizationId], (err, row) => {
                if (err) reject(err);
                else resolve(row || {});
            });
        });

        let effectiveLevel = orgPolicy.policy_level || 'ADVISORY';
        let maxLevel = orgPolicy.max_policy_level || 'ASSISTED';

        // 2. Check project-level override if exists
        if (projectId) {
            const project = await new Promise((resolve, reject) => {
                deps.db.get(`SELECT governance_settings FROM projects WHERE id = ?`, [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || {});
                });
            });

            try {
                const settings = JSON.parse(project.governance_settings || '{}');
                if (settings.aiPolicyOverride) {
                    // Project can only reduce, not increase
                    const overrideIndex = POLICY_HIERARCHY.indexOf(settings.aiPolicyOverride);
                    const currentIndex = POLICY_HIERARCHY.indexOf(effectiveLevel);
                    if (overrideIndex < currentIndex) {
                        effectiveLevel = settings.aiPolicyOverride;
                    }
                }
            } catch { }
        }

        // 3. Check user preferences
        let userPreferences = {};
        if (userId) {
            userPreferences = await new Promise((resolve, reject) => {
                deps.db.get(`SELECT * FROM ai_user_preferences WHERE user_id = ?`, [userId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || {});
                });
            });
        }

        // Ensure we don't exceed max level
        const effectiveIndex = POLICY_HIERARCHY.indexOf(effectiveLevel);
        const maxIndex = POLICY_HIERARCHY.indexOf(maxLevel);
        if (effectiveIndex > maxIndex) {
            effectiveLevel = maxLevel;
        }

        // 4. Get project AI role (AI Roles Model)
        let projectAIRole = 'ADVISOR';
        let roleCapabilities = deps.AIRoleGuard.getRoleCapabilities('ADVISOR');
        if (projectId) {
            projectAIRole = await deps.AIRoleGuard.getProjectRole(projectId);
            roleCapabilities = deps.AIRoleGuard.getRoleCapabilities(projectAIRole);
        }

        return {
            policyLevel: effectiveLevel,
            maxPolicyLevel: maxLevel,
            internetEnabled: orgPolicy.internet_enabled === 1,
            auditRequired: orgPolicy.audit_required !== 0,
            defaultRole: orgPolicy.default_ai_role || 'ADVISOR',
            activeRoles: JSON.parse(orgPolicy.active_roles || '["ADVISOR","PMO_MANAGER","EXECUTOR","EDUCATOR"]'),
            userTone: userPreferences.preferred_tone || 'EXPERT',
            educationMode: userPreferences.education_mode === 1,
            // AI Roles Model
            projectAIRole,
            roleCapabilities,
            roleDescription: deps.AIRoleGuard.getRoleDescription(projectAIRole)
        };
    },

    /**
     * Check if an action is allowed
     */
    canPerformAction: async (actionType, organizationId, projectId = null, userId = null) => {
        const policy = await AIPolicyEngine.getEffectivePolicy(organizationId, projectId, userId);
        const requiredLevel = ACTION_POLICY_REQUIREMENTS[actionType] || 'ADVISORY';

        const requiredIndex = POLICY_HIERARCHY.indexOf(requiredLevel);
        const currentIndex = POLICY_HIERARCHY.indexOf(policy.policyLevel);

        const isAllowed = currentIndex >= requiredIndex;
        const requiresApproval = policy.policyLevel !== 'AUTOPILOT' &&
            (actionType.startsWith('CREATE_') || actionType.startsWith('SUGGEST_'));

        // Check for Regulatory Mode blocking
        if (policy.regulatoryModeEnabled && requiredLevel !== 'ADVISORY') {
            return {
                allowed: false,
                requiresApproval: false,
                requiredLevel,
                currentLevel: policy.policyLevel,
                reason: `Action blocked by Regulatory Mode - only advisory actions allowed`
            };
        }

        return {
            allowed: isAllowed,
            requiresApproval,
            requiredLevel,
            currentLevel: policy.policyLevel,
            reason: isAllowed
                ? `Action permitted at ${policy.policyLevel} level`
                : `Action requires ${requiredLevel} policy level, but current is ${policy.policyLevel}`
        };
    },

    /**
     * Get the required policy level for an action
     * @param {string} actionType - Action type
     * @returns {string} - Required policy level
     */
    getPolicyLevelForAction: (actionType) => {
        return ACTION_POLICY_REQUIREMENTS[actionType] || 'ADVISORY';
    },

    /**
     * Check if a role is active
     */
    isRoleActive: async (role, organizationId) => {
        const policy = await AIPolicyEngine.getEffectivePolicy(organizationId);
        return policy.activeRoles.includes(role);
    },

    /**
     * Update organization policy (Admin only)
     */
    updatePolicy: async (organizationId, updates) => {
        const { policyLevel, internetEnabled, auditRequired, maxPolicyLevel, defaultRole, activeRoles } = updates;

        // Validate policy level
        if (policyLevel && !POLICY_HIERARCHY.includes(policyLevel)) {
            throw new Error(`Invalid policy level: ${policyLevel}`);
        }

        return new Promise((resolve, reject) => {
            // Upsert
            deps.db.run(`INSERT INTO ai_policies (organization_id, policy_level, internet_enabled, audit_required, max_policy_level, default_ai_role, active_roles, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(organization_id) DO UPDATE SET
                    policy_level = COALESCE(?, policy_level),
                    internet_enabled = COALESCE(?, internet_enabled),
                    audit_required = COALESCE(?, audit_required),
                    max_policy_level = COALESCE(?, max_policy_level),
                    default_ai_role = COALESCE(?, default_ai_role),
                    active_roles = COALESCE(?, active_roles),
                    updated_at = CURRENT_TIMESTAMP`,
                [
                    organizationId, policyLevel, internetEnabled ? 1 : 0, auditRequired ? 1 : 0,
                    maxPolicyLevel, defaultRole, JSON.stringify(activeRoles || []),
                    policyLevel, internetEnabled !== undefined ? (internetEnabled ? 1 : 0) : null,
                    auditRequired !== undefined ? (auditRequired ? 1 : 0) : null,
                    maxPolicyLevel, defaultRole, activeRoles ? JSON.stringify(activeRoles) : null
                ], function (err) {
                    if (err) return reject(err);
                    resolve({ updated: true, organizationId });
                });
        });
    },

    /**
     * Get policy summary for display
     */
    getPolicySummary: async (organizationId) => {
        const policy = await AIPolicyEngine.getEffectivePolicy(organizationId);

        const descriptions = {
            ADVISORY: 'AI provides suggestions and explanations only',
            ASSISTED: 'AI can create drafts that require your approval',
            PROACTIVE: 'AI can execute low-risk actions automatically',
            AUTOPILOT: 'AI operates autonomously within governance rules'
        };

        return {
            currentLevel: policy.policyLevel,
            description: descriptions[policy.policyLevel],
            capabilities: {
                canExplain: true,
                canAnalyze: true,
                canCreateDrafts: POLICY_HIERARCHY.indexOf(policy.policyLevel) >= 1,
                canExecuteActions: POLICY_HIERARCHY.indexOf(policy.policyLevel) >= 2
            },
            internetEnabled: policy.internetEnabled,
            auditRequired: policy.auditRequired
        };
    }
};

module.exports = AIPolicyEngine;
