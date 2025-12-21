/**
 * Feature Gate Middleware
 * 
 * Implements 24_FEATURE_GATING_RULES.md:
 * Every feature must declare required Phase, UserState, and Role.
 * If any is missing, feature must not ship.
 */

const UserStateMachine = require('../services/userStateMachine');

/**
 * Feature gate configuration
 * Key: feature identifier
 * Value: requirements
 */
const FEATURE_REQUIREMENTS = {
    // Phase G features
    'benchmark_access': {
        phase: ['G'],
        state: ['ECOSYSTEM_NODE'],
        role: ['ADMIN', 'CONSULTANT']
    },
    'referral_create': {
        phase: ['G'],
        state: ['ECOSYSTEM_NODE'],
        role: ['ADMIN', 'OWNER']
    },
    'consultant_mode': {
        phase: ['G'],
        state: ['ECOSYSTEM_NODE'],
        role: ['CONSULTANT']
    },

    // Phase F features
    'team_invite': {
        phase: ['F', 'G'],
        state: ['TEAM_COLLAB', 'ECOSYSTEM_NODE'],
        role: ['ADMIN', 'OWNER', 'FACILITATOR']
    },
    'team_comments': {
        phase: ['F', 'G'],
        state: ['TEAM_COLLAB', 'ECOSYSTEM_NODE'],
        role: ['ADMIN', 'OWNER', 'FACILITATOR', 'CONTRIBUTOR', 'VIEWER']
    },

    // Phase E features
    'drd_create': {
        phase: ['E', 'F', 'G'],
        state: ['ORG_MEMBER', 'TEAM_COLLAB', 'ECOSYSTEM_NODE'],
        role: ['ADMIN', 'OWNER', 'FACILITATOR', 'CONTRIBUTOR']
    },
    'initiative_create': {
        phase: ['E', 'F', 'G'],
        state: ['ORG_MEMBER', 'TEAM_COLLAB', 'ECOSYSTEM_NODE'],
        role: ['ADMIN', 'OWNER', 'FACILITATOR']
    },

    // Phase D features
    'org_create': {
        phase: ['D'],
        state: ['ORG_CREATOR'],
        role: [] // No role yet - creating org
    },

    // Phase C features
    'trial_chat': {
        phase: ['C', 'D', 'E', 'F', 'G'],
        state: ['TRIAL_TRUSTED', 'ORG_CREATOR', 'ORG_MEMBER', 'TEAM_COLLAB', 'ECOSYSTEM_NODE'],
        role: []
    },

    // Phase B features
    'demo_view': {
        phase: ['B', 'C', 'D', 'E', 'F', 'G'],
        state: ['DEMO_SESSION', 'TRIAL_TRUSTED', 'ORG_CREATOR', 'ORG_MEMBER', 'TEAM_COLLAB', 'ECOSYSTEM_NODE'],
        role: []
    },

    // AI features per phase
    'ai_recommend': {
        phase: ['E', 'F', 'G'],
        state: ['ORG_MEMBER', 'TEAM_COLLAB', 'ECOSYSTEM_NODE'],
        role: []
    },
    'ai_analyze': {
        phase: ['E', 'F', 'G'],
        state: ['ORG_MEMBER', 'TEAM_COLLAB', 'ECOSYSTEM_NODE'],
        role: []
    },
    'ai_benchmark': {
        phase: ['G'],
        state: ['ECOSYSTEM_NODE'],
        role: ['ADMIN', 'CONSULTANT']
    }
};

/**
 * Create feature gate middleware
 * @param {string} featureId - Feature identifier from FEATURE_REQUIREMENTS
 * @returns {function} Express middleware
 */
function requireFeature(featureId) {
    const requirements = FEATURE_REQUIREMENTS[featureId];

    if (!requirements) {
        // Feature not registered - block by default (fail closed)
        return (req, res, next) => {
            console.error(`Feature '${featureId}' not registered in FEATURE_REQUIREMENTS`);
            return res.status(500).json({
                error: 'FEATURE_NOT_REGISTERED',
                message: `Feature '${featureId}' is not properly configured. Contact support.`
            });
        };
    }

    return (req, res, next) => {
        const currentPhase = req.currentPhase;
        const currentState = req.userState;
        const currentRole = req.userRole || req.user?.role;

        const errors = [];

        // Check phase
        if (requirements.phase.length > 0 && !requirements.phase.includes(currentPhase)) {
            errors.push({
                type: 'PHASE',
                required: requirements.phase,
                current: currentPhase
            });
        }

        // Check state
        if (requirements.state.length > 0 && !requirements.state.includes(currentState)) {
            errors.push({
                type: 'STATE',
                required: requirements.state,
                current: currentState
            });
        }

        // Check role (only if roles are specified and user has org context)
        if (requirements.role.length > 0 && currentRole) {
            if (!requirements.role.includes(currentRole)) {
                errors.push({
                    type: 'ROLE',
                    required: requirements.role,
                    current: currentRole
                });
            }
        }

        if (errors.length > 0) {
            return res.status(403).json({
                error: 'FEATURE_ACCESS_DENIED',
                feature: featureId,
                message: `Access to '${featureId}' denied. Requirements not met.`,
                requirements: {
                    phase: requirements.phase,
                    state: requirements.state,
                    role: requirements.role
                },
                current: {
                    phase: currentPhase,
                    state: currentState,
                    role: currentRole
                },
                violations: errors
            });
        }

        next();
    };
}

/**
 * Dynamic feature gate - validates at runtime
 * @param {object} requirements - { phase: [], state: [], role: [] }
 * @returns {function} Express middleware
 */
function requireAccess(requirements) {
    return (req, res, next) => {
        const currentPhase = req.currentPhase;
        const currentState = req.userState;
        const currentRole = req.userRole || req.user?.role;

        // Phase check
        if (requirements.phase?.length > 0 && !requirements.phase.includes(currentPhase)) {
            return res.status(403).json({
                error: 'PHASE_REQUIRED',
                required: requirements.phase,
                current: currentPhase
            });
        }

        // State check
        if (requirements.state?.length > 0 && !requirements.state.includes(currentState)) {
            return res.status(403).json({
                error: 'STATE_REQUIRED',
                required: requirements.state,
                current: currentState
            });
        }

        // Role check
        if (requirements.role?.length > 0 && !requirements.role.includes(currentRole)) {
            return res.status(403).json({
                error: 'ROLE_REQUIRED',
                required: requirements.role,
                current: currentRole
            });
        }

        next();
    };
}

/**
 * Check if feature is accessible (for UI conditional rendering)
 * @param {string} featureId 
 * @param {object} context - { phase, state, role }
 * @returns {boolean}
 */
function isFeatureAccessible(featureId, context) {
    const requirements = FEATURE_REQUIREMENTS[featureId];
    if (!requirements) return false;

    const { phase, state, role } = context;

    if (requirements.phase.length > 0 && !requirements.phase.includes(phase)) {
        return false;
    }

    if (requirements.state.length > 0 && !requirements.state.includes(state)) {
        return false;
    }

    if (requirements.role.length > 0 && role && !requirements.role.includes(role)) {
        return false;
    }

    return true;
}

/**
 * Get all accessible features for a context
 * @param {object} context - { phase, state, role }
 * @returns {string[]} List of accessible feature IDs
 */
function getAccessibleFeatures(context) {
    return Object.keys(FEATURE_REQUIREMENTS).filter(featureId =>
        isFeatureAccessible(featureId, context)
    );
}

module.exports = {
    FEATURE_REQUIREMENTS,
    requireFeature,
    requireAccess,
    isFeatureAccessible,
    getAccessibleFeatures
};
