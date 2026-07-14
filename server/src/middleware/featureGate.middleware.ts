/**
 * Feature Gate Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Implements feature gating based on Phase, UserState, and Role.
 * Every feature must declare required Phase, UserState, and Role.
 * If any is missing, feature must not ship.
 *
 * Hardened (recovered weekly module work): the gate config is deeply frozen,
 * feature ids and dynamic requirements are validated (length / control chars /
 * rule count / prototype keys), the role check FAILS CLOSED when a role is
 * required but absent, and every response write is guarded against already-
 * finalized streams and incomplete response objects. The full contract lives in
 * tests/unit/backend/middleware/featureGate.middleware.test.ts.
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

// ==========================================
// LIMITS / GUARDS
// ==========================================

const MAX_FEATURE_ID_LENGTH = 200;
const MAX_RULE_TOKENS = 64;
const MAX_TOKEN_LENGTH = 64;
// C0 controls + DEL — never legitimate in a feature id or a requirement token.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]');

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** A response we can actually write a JSON error to. */
function isResponseUsable(res: unknown): res is Response {
  return (
    !!res && typeof (res as any).status === 'function' && typeof (res as any).json === 'function'
  );
}

/** Why a response can no longer be written to, or null when it still can. */
function responseFinalized(res: any): string | null {
  if (res?.headersSent) return 'headersSent';
  if (res?.writableEnded) return 'writableEnded';
  if (res?.destroyed) return 'destroyed';
  if (res?.finished) return 'finished';
  return null;
}

/** Write a JSON response, skipping (with a log) when the stream is finalized. */
function respond(
  res: Response,
  status: number,
  body: { error: string; [k: string]: unknown }
): void {
  const skipReason = responseFinalized(res);
  if (skipReason) {
    logger.warn('[featureGate] Skipped JSON response write (response already finalized)', {
      skipReason,
      statusCode: status,
      errorCode: body?.error,
    });
    return;
  }
  res.status(status).json(body);
}

/** Resolve the caller's role without letting a throwing getter crash the gate. */
function safeGetRole(req: FeatureRequest): string | null {
  try {
    const role = req.userRole ?? req.user?.role;
    return role == null ? null : String(role);
  } catch {
    return null;
  }
}

/** Run the allow path: validate next, skip on finalized stream, contain throws. */
function proceed(res: Response, next: unknown, featureId: string): void {
  if (responseFinalized(res)) {
    logger.warn('[featureGate] Skipped next() (response already finalized)', { featureId });
    return;
  }
  if (typeof next !== 'function') return;
  try {
    (next as NextFunction)();
  } catch (err) {
    logger.error('[featureGate] downstream next() threw synchronously', err);
    respond(res, 500, { error: 'FEATURE_GATE_INTERNAL', message: 'Feature gate internal error.' });
  }
}

// ==========================================
// CONSTANTS
// ==========================================

function deepFreeze<T>(value: T): T {
  if (value && (typeof value === 'object' || typeof value === 'function')) {
    Object.getOwnPropertyNames(value).forEach((key) => deepFreeze((value as any)[key]));
    Object.freeze(value);
  }
  return value;
}

/**
 * Feature gate configuration
 * Key: feature identifier
 * Value: requirements
 *
 * Deeply frozen so a compromised request handler cannot mutate the gate config
 * at runtime (privilege escalation guard).
 */
export const FEATURE_REQUIREMENTS: Record<string, FeatureRequirements> = deepFreeze({
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
});

/** Own-property lookup (never resolves `toString`, `constructor`, … from the prototype). */
function lookupRequirements(featureId: string): FeatureRequirements | undefined {
  if (!Object.prototype.hasOwnProperty.call(FEATURE_REQUIREMENTS, featureId)) return undefined;
  return FEATURE_REQUIREMENTS[featureId];
}

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Create feature gate middleware.
 * @param featureId - Feature identifier from FEATURE_REQUIREMENTS
 */
export function requireFeature(featureId: string) {
  return (req: FeatureRequest, res: Response, next: NextFunction): void => {
    if (!isResponseUsable(res)) {
      logger.error('[featureGate] Invalid or incomplete response object');
      return;
    }

    // ── Feature-id validation (fail closed) ──────────────────────────────────
    if (typeof featureId !== 'string' || CONTROL_CHARS.test(featureId)) {
      logger.error('[featureGate] feature id contains disallowed characters');
      respond(res, 500, {
        error: 'INVALID_FEATURE_ID',
        message: 'Feature is not properly configured. Contact support.',
      });
      return;
    }
    if (featureId.length > MAX_FEATURE_ID_LENGTH) {
      logger.error('[featureGate] feature id exceeds max length');
      respond(res, 500, {
        error: 'FEATURE_NOT_REGISTERED',
        message: 'Feature is not properly configured. Contact support.',
      });
      return;
    }

    const requirements = lookupRequirements(featureId);
    if (!requirements) {
      const shortId = truncate(featureId, 120);
      logger.error(`Feature '${shortId}' not registered in FEATURE_REQUIREMENTS`);
      respond(res, 500, {
        error: 'FEATURE_NOT_REGISTERED',
        message: `Feature '${shortId}' is not properly configured. Contact support.`,
      });
      return;
    }

    // ── Access evaluation ────────────────────────────────────────────────────
    const currentPhase = req.currentPhase ?? null;
    const currentState = req.userState ?? null;
    const currentRole = safeGetRole(req);

    const errors: Array<{ type: string; required: string[]; current: string | null }> = [];

    if (requirements.phase.length > 0 && !requirements.phase.includes(currentPhase ?? '')) {
      errors.push({ type: 'PHASE', required: requirements.phase, current: currentPhase });
    }
    if (requirements.state.length > 0 && !requirements.state.includes(currentState ?? '')) {
      errors.push({ type: 'STATE', required: requirements.state, current: currentState });
    }
    // Fail closed: a role-gated feature denies when no role is present.
    if (
      requirements.role.length > 0 &&
      (!currentRole || !requirements.role.includes(currentRole))
    ) {
      errors.push({ type: 'ROLE', required: requirements.role, current: currentRole });
    }

    if (errors.length > 0) {
      respond(res, 403, {
        error: 'FEATURE_ACCESS_DENIED',
        feature: featureId,
        message: `Access to '${featureId}' denied. Requirements not met.`,
        requirements: {
          phase: requirements.phase,
          state: requirements.state,
          role: requirements.role,
        },
        current: { phase: currentPhase, state: currentState, role: currentRole },
        violations: errors,
      });
      return;
    }

    proceed(res, next, featureId);
  };
}

/**
 * Dynamic feature gate - validates requirements at creation, enforces at runtime.
 * @param requirements - { phase: [], state: [], role: [] }
 */
export function requireAccess(requirements: FeatureRequirements) {
  // Validate + normalise + SNAPSHOT once at creation; later mutation is ignored.
  let invalid: false | 'control' | 'other' = 'other';
  const effective: FeatureRequirements = { phase: [], state: [], role: [] };

  try {
    if (requirements && typeof requirements === 'object') {
      const fields: Array<keyof FeatureRequirements> = ['phase', 'state', 'role'];
      const own: Record<string, string[]> = {};
      let shapeOk = true;

      for (const f of fields) {
        if (
          !Object.prototype.hasOwnProperty.call(requirements, f) ||
          !Array.isArray((requirements as any)[f])
        ) {
          shapeOk = false;
          break;
        }
        own[f] = ((requirements as any)[f] as unknown[]).slice() as string[];
      }

      if (shapeOk) {
        if (fields.some((f) => own[f].length > MAX_RULE_TOKENS)) {
          invalid = 'other'; // too many rules → DoS guard
        } else {
          let control = false;
          let tokenInvalid = false;

          for (const f of fields) {
            for (const tok of own[f]) {
              if (typeof tok !== 'string') {
                tokenInvalid = true;
                break;
              }
              if (CONTROL_CHARS.test(tok)) {
                control = true;
                break;
              }
              const trimmed = tok.trim();
              if (trimmed.length > MAX_TOKEN_LENGTH) {
                tokenInvalid = true;
                break;
              }
              if (trimmed.length === 0) continue;
              effective[f].push(f === 'role' ? trimmed.toUpperCase() : trimmed);
            }
            if (control || tokenInvalid) break;
          }

          if (control) invalid = 'control';
          else if (tokenInvalid) invalid = 'other';
          else if (effective.phase.length + effective.state.length + effective.role.length === 0) {
            invalid = 'other'; // no enforceable rule survived normalisation
          } else {
            invalid = false;
          }
        }
      }
    }
  } catch {
    invalid = 'other';
  }

  return (req: FeatureRequest, res: Response, next: NextFunction): void => {
    if (!isResponseUsable(res)) {
      logger.error('[featureGate] Invalid or incomplete response object');
      return;
    }

    if (invalid) {
      if (invalid === 'control') {
        logger.error(
          '[featureGate] requireAccess rejected requirements with disallowed control characters'
        );
      }
      respond(res, 500, {
        error: 'INVALID_FEATURE_REQUIREMENTS',
        message: 'Feature requirements are not valid.',
      });
      return;
    }

    const currentPhase = req.currentPhase ?? null;
    const currentState = req.userState ?? null;
    const currentRole = safeGetRole(req);

    if (effective.phase.length > 0 && !effective.phase.includes(currentPhase ?? '')) {
      respond(res, 403, {
        error: 'PHASE_REQUIRED',
        required: effective.phase,
        current: currentPhase,
      });
      return;
    }
    if (effective.state.length > 0 && !effective.state.includes(currentState ?? '')) {
      respond(res, 403, {
        error: 'STATE_REQUIRED',
        required: effective.state,
        current: currentState,
      });
      return;
    }
    if (effective.role.length > 0 && !effective.role.includes((currentRole ?? '').toUpperCase())) {
      respond(res, 403, { error: 'ROLE_REQUIRED', required: effective.role, current: currentRole });
      return;
    }

    proceed(res, next, 'requireAccess');
  };
}

/**
 * Check if feature is accessible (for UI conditional rendering).
 * @param featureId - Feature identifier
 * @param context - { phase, state, role }
 */
export function isFeatureAccessible(featureId: string, context: FeatureContext): boolean {
  if (typeof featureId !== 'string') return false;
  if (CONTROL_CHARS.test(featureId)) return false;
  if (featureId.length > MAX_FEATURE_ID_LENGTH) return false;

  const requirements = lookupRequirements(featureId);
  if (!requirements) return false;

  const { phase, state, role } = context;

  if (requirements.phase.length > 0 && !requirements.phase.includes(phase)) return false;
  if (requirements.state.length > 0 && !requirements.state.includes(state)) return false;
  // Fail closed: role-gated feature is not accessible without a matching role.
  if (requirements.role.length > 0 && (!role || !requirements.role.includes(role))) return false;

  return true;
}

/**
 * Get all accessible features for a context.
 * @param context - { phase, state, role }
 */
export function getAccessibleFeatures(context: FeatureContext): string[] {
  return Object.keys(FEATURE_REQUIREMENTS).filter((featureId) =>
    isFeatureAccessible(featureId, context)
  );
}
