/**
 * Feature Gate Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Implements feature gating based on Phase, UserState, and Role.
 * Every feature must declare required Phase, UserState, and Role.
 * If any is missing, feature must not ship.
 */

import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';

// ==========================================
// TYPES
// ==========================================

interface FeatureRequirements {
    phase: string[];
    state: string[];
    role: string[];
}

interface FeatureRequest extends AuthRequest {
    currentPhase?: string;
    userState?: string;
}

interface FeatureContext {
    phase: string;
    state: string;
    role?: string;
}

// ==========================================
// CONSTANTS
// ==========================================

/**
 * Feature gate configuration
 * Key: feature identifier
 * Value: requirements
 */
export const FEATURE_REQUIREMENTS: Record<string, FeatureRequirements> = {
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

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Create feature gate middleware
 * @param featureId - Feature identifier from FEATURE_REQUIREMENTS
 * @returns Express middleware
 */
export function requireFeature(featureId: string) {
    const requirements = FEATURE_REQUIREMENTS[featureId];

    if (!requirements) {
        // Feature not registered - block by default (fail closed)
        return (req: Request, res: Response, next: NextFunction): void => {
            console.error(`Feature '${featureId}' not registered in FEATURE_REQUIREMENTS`);
            res.status(500).json({
                error: 'FEATURE_NOT_REGISTERED',
                message: `Feature '${featureId}' is not properly configured. Contact support.`
            });
        };
    }

    return (req: FeatureRequest, res: Response, next: NextFunction): void => {
        const currentPhase = req.currentPhase;
        const currentState = req.userState;
        const currentRole = req.userRole || req.user?.role;

        const errors: Array<{ type: string; required: string[]; current: string | undefined }> = [];

        // Check phase
        if (requirements.phase.length > 0 && !requirements.phase.includes(currentPhase || '')) {
            errors.push({
                type: 'PHASE',
                required: requirements.phase,
                current: currentPhase
            });
        }

        // Check state
        if (requirements.state.length > 0 && !requirements.state.includes(currentState || '')) {
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
            res.status(403).json({
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
            return;
        }

        next();
    };
}

/**
 * Dynamic feature gate - validates at runtime
 * @param requirements - { phase: [], state: [], role: [] }
 * @returns Express middleware
 */
export function requireAccess(requirements: FeatureRequirements) {
    return (req: FeatureRequest, res: Response, next: NextFunction): void => {
        const currentPhase = req.currentPhase;
        const currentState = req.userState;
        const currentRole = req.userRole || req.user?.role;

        // Phase check
        if (requirements.phase?.length > 0 && !requirements.phase.includes(currentPhase || '')) {
            res.status(403).json({
                error: 'PHASE_REQUIRED',
                required: requirements.phase,
                current: currentPhase
            });
            return;
        }

        // State check
        if (requirements.state?.length > 0 && !requirements.state.includes(currentState || '')) {
            res.status(403).json({
                error: 'STATE_REQUIRED',
                required: requirements.state,
                current: currentState
            });
            return;
        }

        // Role check
        if (requirements.role?.length > 0 && !requirements.role.includes(currentRole || '')) {
            res.status(403).json({
                error: 'ROLE_REQUIRED',
                required: requirements.role,
                current: currentRole
            });
            return;
        }

        next();
    };
}

/**
 * Check if feature is accessible (for UI conditional rendering)
 * @param featureId - Feature identifier
 * @param context - { phase, state, role }
 * @returns boolean
 */
export function isFeatureAccessible(featureId: string, context: FeatureContext): boolean {
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
 * @param context - { phase, state, role }
 * @returns List of accessible feature IDs
 */
export function getAccessibleFeatures(context: FeatureContext): string[] {
    return Object.keys(FEATURE_REQUIREMENTS).filter(featureId =>
        isFeatureAccessible(featureId, context)
    );
}



