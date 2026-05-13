/**
 * Feature Gate Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Implements feature gating based on Phase, UserState, and Role.
 * Every feature must declare required Phase, UserState, and Role.
 * If any is missing, feature must not ship.
 */

import { NextFunction, Request, Response } from 'express';

import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

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

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const sendJsonIfHeadersOpen = (
  res: Response,
  statusCode: number,
  payload: Record<string, unknown>
): boolean => {
  let skipReason: 'headersSent' | 'writableEnded' | 'destroyed' | 'finished' | null = null;
  if (safeRead(() => res.headersSent, false)) skipReason = 'headersSent';
  else if (safeRead(() => (res as { writableEnded?: boolean }).writableEnded, false)) {
    skipReason = 'writableEnded';
  } else if (safeRead(() => (res as { destroyed?: boolean }).destroyed, false)) skipReason = 'destroyed';
  else if (safeRead(() => (res as { finished?: boolean }).finished, false)) skipReason = 'finished';
  if (skipReason) {
    logger.warn('[featureGate] Skipped JSON response write (response already finalized)', {
      skipReason,
      statusCode,
      errorCode: typeof payload.error === 'string' ? payload.error : undefined,
    });
    return false;
  }
  try {
    res.status(statusCode).json(payload);
    return true;
  } catch (error) {
    logger.warn('[featureGate] Failed to write JSON response', error);
    return false;
  }
};

const invokeNext = (next: NextFunction): void => {
  if (typeof next !== 'function') {
    logger.error('[featureGate] next is not a function; request chain cannot continue');
    return;
  }
  next();
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const normalizeRole = (value: unknown): string | undefined =>
  normalizeOptionalString(value)?.toUpperCase();
const isRegisteredFeature = (featureId: string): boolean =>
  Object.prototype.hasOwnProperty.call(FEATURE_REQUIREMENTS, featureId);
const hasDisallowedFeatureIdChars = (featureId: string): boolean => /[\u0000-\u001F\u007F]/.test(featureId);
const MAX_FEATURE_ID_PUBLIC = 64;
const MAX_FEATURE_ID_INTERNAL = 256;
const MAX_REQUIRE_ACCESS_RULE_ENTRIES = 64;
const MAX_REQUIRE_ACCESS_TOKEN_LENGTH = 64;
const truncateForPublicSurface = (value: string): string =>
  value.length <= MAX_FEATURE_ID_PUBLIC ? value : `${value.slice(0, MAX_FEATURE_ID_PUBLIC)}...`;

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
  benchmark_access: {
    phase: ['G'],
    state: ['ECOSYSTEM_NODE'],
    role: ['ADMIN', 'CONSULTANT'],
  },
  referral_create: {
    phase: ['G'],
    state: ['ECOSYSTEM_NODE'],
    role: ['ADMIN', 'OWNER'],
  },
  consultant_mode: {
    phase: ['G'],
    state: ['ECOSYSTEM_NODE'],
    role: ['CONSULTANT'],
  },

  // Phase F features
  team_invite: {
    phase: ['F', 'G'],
    state: ['TEAM_COLLAB', 'ECOSYSTEM_NODE'],
    role: ['ADMIN', 'OWNER', 'FACILITATOR'],
  },
  team_comments: {
    phase: ['F', 'G'],
    state: ['TEAM_COLLAB', 'ECOSYSTEM_NODE'],
    role: ['ADMIN', 'OWNER', 'FACILITATOR', 'CONTRIBUTOR', 'VIEWER'],
  },

  // Phase E features
  drd_create: {
    phase: ['E', 'F', 'G'],
    state: ['ORG_MEMBER', 'TEAM_COLLAB', 'ECOSYSTEM_NODE'],
    role: ['ADMIN', 'OWNER', 'FACILITATOR', 'CONTRIBUTOR'],
  },
  initiative_create: {
    phase: ['E', 'F', 'G'],
    state: ['ORG_MEMBER', 'TEAM_COLLAB', 'ECOSYSTEM_NODE'],
    role: ['ADMIN', 'OWNER', 'FACILITATOR'],
  },

  // Phase D features
  org_create: {
    phase: ['D'],
    state: ['ORG_CREATOR'],
    role: [], // No role yet - creating org
  },

  // Phase C features
  trial_chat: {
    phase: ['C', 'D', 'E', 'F', 'G'],
    state: ['TRIAL_TRUSTED', 'ORG_CREATOR', 'ORG_MEMBER', 'TEAM_COLLAB', 'ECOSYSTEM_NODE'],
    role: [],
  },

  // Phase B features
  demo_view: {
    phase: ['B', 'C', 'D', 'E', 'F', 'G'],
    state: [
      'DEMO_SESSION',
      'TRIAL_TRUSTED',
      'ORG_CREATOR',
      'ORG_MEMBER',
      'TEAM_COLLAB',
      'ECOSYSTEM_NODE',
    ],
    role: [],
  },

  // AI features per phase
  ai_recommend: {
    phase: ['E', 'F', 'G'],
    state: ['ORG_MEMBER', 'TEAM_COLLAB', 'ECOSYSTEM_NODE'],
    role: [],
  },
  ai_analyze: {
    phase: ['E', 'F', 'G'],
    state: ['ORG_MEMBER', 'TEAM_COLLAB', 'ECOSYSTEM_NODE'],
    role: [],
  },
  ai_benchmark: {
    phase: ['G'],
    state: ['ECOSYSTEM_NODE'],
    role: ['ADMIN', 'CONSULTANT'],
  },
};

for (const featureId of Object.keys(FEATURE_REQUIREMENTS)) {
  const requirements = FEATURE_REQUIREMENTS[featureId];
  if (!requirements) continue;
  Object.freeze(requirements.phase);
  Object.freeze(requirements.state);
  Object.freeze(requirements.role);
  Object.freeze(requirements);
}
Object.freeze(FEATURE_REQUIREMENTS);

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Create feature gate middleware
 * @param featureId - Feature identifier from FEATURE_REQUIREMENTS
 * @returns Express middleware
 */
export function requireFeature(featureId: string) {
  const normalizedFeatureId = normalizeOptionalString(featureId) || '';
  const publicFeatureId = truncateForPublicSurface(normalizedFeatureId || featureId);
  if (hasDisallowedFeatureIdChars(normalizedFeatureId)) {
    return (_req: Request, res: Response, _next: NextFunction): void => {
      logger.error(`Feature '${publicFeatureId}' rejected: feature id contains disallowed characters`);
      sendJsonIfHeadersOpen(res, 500, {
        error: 'INVALID_FEATURE_ID',
        message: 'Feature identifier is not valid. Contact support.',
      });
    };
  }
  if (normalizedFeatureId.length > MAX_FEATURE_ID_INTERNAL) {
    return (_req: Request, res: Response, _next: NextFunction): void => {
      logger.error(`Feature '${publicFeatureId}' rejected: feature id exceeds max length`);
      sendJsonIfHeadersOpen(res, 500, {
        error: 'FEATURE_NOT_REGISTERED',
        message: `Feature '${publicFeatureId}' is not properly configured. Contact support.`,
      });
    };
  }
  const requirements = isRegisteredFeature(normalizedFeatureId)
    ? FEATURE_REQUIREMENTS[normalizedFeatureId]
    : undefined;

  if (!requirements) {
    // Feature not registered - block by default (fail closed)
    return (_req: Request, res: Response, _next: NextFunction): void => {
      logger.error(`Feature '${publicFeatureId}' not registered in FEATURE_REQUIREMENTS`);
      sendJsonIfHeadersOpen(res, 500, {
        error: 'FEATURE_NOT_REGISTERED',
        message: `Feature '${publicFeatureId}' is not properly configured. Contact support.`,
      });
    };
  }

  return (req: FeatureRequest, res: Response, next: NextFunction): void => {
    try {
      const currentPhase = normalizeOptionalString(safeRead(() => req.currentPhase, undefined));
      const currentState = normalizeOptionalString(safeRead(() => req.userState, undefined));
      const currentRole =
        normalizeRole(safeRead(() => req.userRole, undefined)) ||
        normalizeRole(safeRead(() => req.user?.role, undefined));

      const errors: Array<{ type: string; required: string[]; current: string | null }> = [];

      // Check phase
      if (requirements.phase.length > 0 && !requirements.phase.includes(currentPhase || '')) {
        errors.push({
          type: 'PHASE',
          required: requirements.phase,
          current: currentPhase ?? null,
        });
      }

      // Check state
      if (requirements.state.length > 0 && !requirements.state.includes(currentState || '')) {
        errors.push({
          type: 'STATE',
          required: requirements.state,
          current: currentState ?? null,
        });
      }

      // Check role (only if roles are specified and user has org context)
      if (requirements.role.length > 0 && !requirements.role.includes(currentRole || '')) {
        errors.push({
          type: 'ROLE',
          required: requirements.role,
          current: currentRole ?? null,
        });
      }

      if (errors.length > 0) {
        const deniedFeatureId = truncateForPublicSurface(normalizedFeatureId);
        sendJsonIfHeadersOpen(res, 403, {
          error: 'FEATURE_ACCESS_DENIED',
          feature: deniedFeatureId,
          message: `Access to '${deniedFeatureId}' denied. Requirements not met.`,
          requirements: {
            phase: requirements.phase,
            state: requirements.state,
            role: requirements.role,
          },
          current: {
            phase: currentPhase ?? null,
            state: currentState ?? null,
            role: currentRole ?? null,
          },
          violations: errors,
        });
        return;
      }

      invokeNext(next);
    } catch (error) {
      logger.error('[featureGate] Unexpected error in requireFeature handler', error);
      sendJsonIfHeadersOpen(res, 500, {
        error: 'FEATURE_GATE_INTERNAL',
        message: 'Feature gate encountered an unexpected error. Contact support.',
      });
    }
  };
}

/**
 * Dynamic feature gate - validates at runtime
 * @param requirements - { phase: [], state: [], role: [] }
 * @returns Express middleware
 */
export function requireAccess(requirements: FeatureRequirements) {
  return (req: FeatureRequest, res: Response, next: NextFunction): void => {
    try {
      if (!requirements || typeof requirements !== 'object' || Array.isArray(requirements)) {
        sendJsonIfHeadersOpen(res, 500, {
          error: 'INVALID_FEATURE_REQUIREMENTS',
          message: 'Feature requirements are not properly configured. Contact support.',
        });
        return;
      }

      const hasOwn = (key: 'phase' | 'state' | 'role') =>
        Object.prototype.hasOwnProperty.call(requirements, key);
      if (
        (hasOwn('phase') && !Array.isArray(safeRead(() => requirements.phase, undefined as unknown))) ||
        (hasOwn('state') && !Array.isArray(safeRead(() => requirements.state, undefined as unknown))) ||
        (hasOwn('role') && !Array.isArray(safeRead(() => requirements.role, undefined as unknown)))
      ) {
        sendJsonIfHeadersOpen(res, 500, {
          error: 'INVALID_FEATURE_REQUIREMENTS',
          message:
            'Feature requirements must use array values for phase, state, and role. Contact support.',
        });
        return;
      }

      const requiredPhases =
        hasOwn('phase') && Array.isArray(safeRead(() => requirements.phase, undefined as unknown))
          ? (safeRead(() => requirements.phase, [] as unknown) as unknown[])
          : [];
      const requiredStates =
        hasOwn('state') && Array.isArray(safeRead(() => requirements.state, undefined as unknown))
          ? (safeRead(() => requirements.state, [] as unknown) as unknown[])
          : [];
      const requiredRoles =
        hasOwn('role') && Array.isArray(safeRead(() => requirements.role, undefined as unknown))
          ? (safeRead(() => requirements.role, [] as unknown) as unknown[])
          : [];
      const phaseRules = Array.isArray(requiredPhases)
        ? requiredPhases
            .map((phaseRule) => normalizeOptionalString(phaseRule))
            .filter((phaseRule): phaseRule is string => Boolean(phaseRule))
        : [];
      const stateRules = Array.isArray(requiredStates)
        ? requiredStates
            .map((stateRule) => normalizeOptionalString(stateRule))
            .filter((stateRule): stateRule is string => Boolean(stateRule))
        : [];
      const roleRules = Array.isArray(requiredRoles) ? requiredRoles : [];
      const normalizedRoleRules = roleRules
        .map((roleRule) => normalizeRole(roleRule))
        .filter((roleRule): roleRule is string => Boolean(roleRule));
      if (
        phaseRules.length > MAX_REQUIRE_ACCESS_RULE_ENTRIES ||
        stateRules.length > MAX_REQUIRE_ACCESS_RULE_ENTRIES ||
        normalizedRoleRules.length > MAX_REQUIRE_ACCESS_RULE_ENTRIES
      ) {
        sendJsonIfHeadersOpen(res, 500, {
          error: 'INVALID_FEATURE_REQUIREMENTS',
          message:
            'Feature requirements exceed maximum supported rule count for phase, state, or role. Contact support.',
        });
        return;
      }
      const hasOversizedRuleToken =
        phaseRules.some((phaseRule) => phaseRule.length > MAX_REQUIRE_ACCESS_TOKEN_LENGTH) ||
        stateRules.some((stateRule) => stateRule.length > MAX_REQUIRE_ACCESS_TOKEN_LENGTH) ||
        normalizedRoleRules.some((roleRule) => roleRule.length > MAX_REQUIRE_ACCESS_TOKEN_LENGTH);
      if (hasOversizedRuleToken) {
        sendJsonIfHeadersOpen(res, 500, {
          error: 'INVALID_FEATURE_REQUIREMENTS',
          message:
            'Feature requirements contain oversized phase, state, or role values. Contact support.',
        });
        return;
      }
      if (phaseRules.length === 0 && stateRules.length === 0 && normalizedRoleRules.length === 0) {
        sendJsonIfHeadersOpen(res, 500, {
          error: 'INVALID_FEATURE_REQUIREMENTS',
          message: 'Feature requirements must specify at least one of phase, state, or role. Contact support.',
        });
        return;
      }

      const currentPhase = normalizeOptionalString(safeRead(() => req.currentPhase, undefined));
      const currentState = normalizeOptionalString(safeRead(() => req.userState, undefined));
      const currentRole =
        normalizeRole(safeRead(() => req.userRole, undefined)) ||
        normalizeRole(safeRead(() => req.user?.role, undefined));

      // Phase check
      if (phaseRules.length > 0 && !phaseRules.includes(currentPhase || '')) {
        sendJsonIfHeadersOpen(res, 403, {
          error: 'PHASE_REQUIRED',
          required: phaseRules,
          current: currentPhase ?? null,
        });
        return;
      }

      // State check
      if (stateRules.length > 0 && !stateRules.includes(currentState || '')) {
        sendJsonIfHeadersOpen(res, 403, {
          error: 'STATE_REQUIRED',
          required: stateRules,
          current: currentState ?? null,
        });
        return;
      }

      // Role check
      if (normalizedRoleRules.length > 0 && !normalizedRoleRules.includes(currentRole || '')) {
        sendJsonIfHeadersOpen(res, 403, {
          error: 'ROLE_REQUIRED',
          required: normalizedRoleRules,
          current: currentRole ?? null,
        });
        return;
      }

      invokeNext(next);
    } catch (error) {
      logger.error('[featureGate] Unexpected error in requireAccess handler', error);
      sendJsonIfHeadersOpen(res, 500, {
        error: 'FEATURE_GATE_INTERNAL',
        message: 'Feature gate encountered an unexpected error. Contact support.',
      });
    }
  };
}

/**
 * Check if feature is accessible (for UI conditional rendering)
 * @param featureId - Feature identifier
 * @param context - { phase, state, role }
 * @returns boolean
 */
export function isFeatureAccessible(featureId: string, context: FeatureContext): boolean {
  const normalizedFeatureId = normalizeOptionalString(featureId) || '';
  if (hasDisallowedFeatureIdChars(normalizedFeatureId)) return false;
  if (normalizedFeatureId.length > MAX_FEATURE_ID_INTERNAL) return false;
  const requirements = isRegisteredFeature(normalizedFeatureId)
    ? FEATURE_REQUIREMENTS[normalizedFeatureId]
    : undefined;
  if (!requirements) return false;

  const phase = normalizeOptionalString(safeRead(() => context.phase, undefined)) || '';
  const state = normalizeOptionalString(safeRead(() => context.state, undefined)) || '';
  const role = normalizeRole(safeRead(() => context.role, undefined));

  if (requirements.phase.length > 0 && !requirements.phase.includes(phase)) {
    return false;
  }

  if (requirements.state.length > 0 && !requirements.state.includes(state)) {
    return false;
  }

  if (requirements.role.length > 0) {
    if (!role) return false;
    if (!requirements.role.includes(role)) return false;
  }

  return true;
}

/**
 * Get all accessible features for a context
 * @param context - { phase, state, role }
 * @returns List of accessible feature IDs
 */
export function getAccessibleFeatures(context: FeatureContext): string[] {
  return Object.keys(FEATURE_REQUIREMENTS).filter((featureId) =>
    isFeatureAccessible(featureId, context)
  );
}
