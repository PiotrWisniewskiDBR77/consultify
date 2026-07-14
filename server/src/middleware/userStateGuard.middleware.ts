/**
 * User State Guard Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Enforces UserState Machine per 01_USER_STATE_MACHINE.md
 *
 * Usage:
 *   router.get('/endpoint', userStateGuard.requireState(['ORG_MEMBER', 'TEAM_COLLAB']), handler)
 */

import { NextFunction, Request, Response } from 'express';

import { getDatabase as getDb } from '../database/Database.js';
import UserStateMachine from '../services/userStateMachine.js';
import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

interface Database {
  getAsync: (sql: string, params: unknown[]) => Promise<unknown>;
  run: (sql: string, params: unknown[]) => Promise<{ changes?: number } | undefined | void>;
}

interface UserRow {
  user_journey_state?: string;
  current_phase?: string;
}

interface UserStateRequest extends AuthRequest {
  userState?: string;
  currentPhase?: string;
  statePermissions?: Record<string, unknown>;
}

interface UserStateMachineShape {
  USER_STATES: Record<string, string>;
  PHASES: Record<string, string>;
  getPermissions: (state: string) => Record<string, unknown>;
  hasPermission: (state: string, permission: string) => boolean;
  validateTransition: (
    fromState: string,
    toState: string,
    context?: Record<string, unknown>
  ) => { valid: boolean; reason?: string };
  getPhase: (state: string) => string;
}

interface Dependencies {
  UserStateMachine: UserStateMachineShape;
  db: Database | null;
}

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies = {
  UserStateMachine,
  db: getDb() as unknown as Database,
};

// ==========================================
// HELPERS
// ==========================================

function safeGet<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function trimStr(s: unknown): string {
  if (typeof s !== 'string') return '';
  return s.trim();
}

function getPermissionsSafe(
  usm: UserStateMachineShape,
  state: string
): Record<string, unknown> | null {
  try {
    const perms = usm.getPermissions(state);
    if (perms && typeof perms === 'object' && !Array.isArray(perms)) return perms;
    return null;
  } catch {
    return null;
  }
}

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Attach user state to request
 * Must be called after authentication middleware
 */
export async function attachUserState(
  req: UserStateRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { UserStateMachine: usm, db } = deps;
    const ANON = usm.USER_STATES.ANON;
    const DEFAULT_PHASE = usm.PHASES.A;

    const setAnonAndNext = (): void => {
      req.userState = ANON;
      req.currentPhase = DEFAULT_PHASE;
      const perms = getPermissionsSafe(usm, ANON);
      req.statePermissions = perms ?? (getPermissionsSafe(usm, ANON) || {});
      next();
    };

    const userId = safeGet(() => req.user?.id, undefined);

    if (!userId) {
      setAnonAndNext();
      return;
    }

    if (!db) {
      setAnonAndNext();
      return;
    }

    const row = await db.getAsync(
      'SELECT user_journey_state, current_phase FROM users WHERE id = ?',
      [userId]
    );

    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      setAnonAndNext();
      return;
    }

    const userRow = row as UserRow;

    // Trim and validate state
    const rawState = trimStr(userRow.user_journey_state);
    const knownStates = Object.values(usm.USER_STATES);
    const resolvedState = knownStates.includes(rawState) ? rawState : ANON;

    // Trim and validate phase
    const rawPhase = trimStr(userRow.current_phase);
    const knownPhases = Object.values(usm.PHASES);
    let resolvedPhase: string;
    if (knownPhases.includes(rawPhase)) {
      resolvedPhase = rawPhase;
    } else {
      // Repair: derive from state machine
      resolvedPhase = safeGet(() => usm.getPhase(resolvedState), DEFAULT_PHASE);
    }

    req.userState = resolvedState;
    req.currentPhase = resolvedPhase;

    // Attach permissions
    const perms = getPermissionsSafe(usm, resolvedState);
    if (perms) {
      req.statePermissions = perms;
    } else {
      req.statePermissions = getPermissionsSafe(usm, ANON) || {};
    }

    next();
  } catch (error: unknown) {
    logger.error('attachUserState error:', error);
    const { UserStateMachine: usm } = deps;
    const ANON = usm.USER_STATES.ANON;
    req.userState = ANON;
    req.currentPhase = usm.PHASES.A;
    req.statePermissions = getPermissionsSafe(usm, ANON) || {};
    next();
  }
}

/**
 * Require specific user state(s)
 * @param allowedStates - State(s) required to access endpoint
 * @returns Express middleware
 */
export function requireState(allowedStates: string | string[]) {
  const rawStates = Array.isArray(allowedStates) ? allowedStates : [allowedStates];
  const trimmedStates = rawStates.map(trimStr).filter(Boolean);

  return (req: UserStateRequest, res: Response, next: NextFunction): void => {
    const { UserStateMachine: usm } = deps;

    // Misconfiguration guard: blank list
    if (trimmedStates.length === 0) {
      res.status(500).json({
        error: 'MISCONFIGURED_USER_STATE_GUARD',
        message: 'requireState was configured with no valid states.',
      });
      return;
    }

    // Misconfiguration guard: unknown states
    const knownStates = Object.values(usm.USER_STATES);
    const invalidStates = trimmedStates.filter((s) => !knownStates.includes(s));
    if (invalidStates.length > 0) {
      res.status(500).json({
        error: 'MISCONFIGURED_USER_STATE_GUARD',
        message: `requireState was configured with unknown states: ${invalidStates.join(', ')}`,
        invalidStates,
      });
      return;
    }

    const currentState = safeGet(() => req.userState, undefined);

    if (!currentState || !trimStr(currentState)) {
      res.status(401).json({
        error: 'USER_STATE_UNKNOWN',
        message: 'User state not determined. Are you logged in?',
      });
      return;
    }

    if (!trimmedStates.includes(currentState)) {
      res.status(403).json({
        error: 'INVALID_USER_STATE',
        message: `This action requires state: ${trimmedStates.join(' or ')}. Current state: ${currentState}`,
        currentState,
        requiredStates: trimmedStates,
        currentPhase: req.currentPhase,
      });
      return;
    }

    next();
  };
}

/**
 * Require specific phase(s)
 * @param allowedPhases - Phase(s) required to access endpoint
 * @returns Express middleware
 */
export function requirePhase(allowedPhases: string | string[]) {
  const rawPhases = Array.isArray(allowedPhases) ? allowedPhases : [allowedPhases];
  const trimmedPhases = rawPhases.map(trimStr).filter(Boolean);

  return (req: UserStateRequest, res: Response, next: NextFunction): void => {
    const { UserStateMachine: usm } = deps;

    // Misconfiguration guard: unknown phases
    const knownPhases = Object.values(usm.PHASES);
    const invalidPhases = trimmedPhases.filter((p) => !knownPhases.includes(p));
    if (invalidPhases.length > 0) {
      res.status(500).json({
        error: 'MISCONFIGURED_USER_STATE_GUARD',
        message: `requirePhase was configured with unknown phases: ${invalidPhases.join(', ')}`,
        invalidPhases,
      });
      return;
    }

    const currentPhase = safeGet(() => req.currentPhase, undefined);

    if (!currentPhase) {
      res.status(401).json({
        error: 'USER_PHASE_UNKNOWN',
        message: 'User phase not determined. Are you logged in?',
      });
      return;
    }

    if (!trimmedPhases.includes(currentPhase)) {
      res.status(403).json({
        error: 'INVALID_PHASE',
        message: `This action requires phase: ${trimmedPhases.join(' or ')}. Current phase: ${currentPhase}`,
        currentPhase,
        requiredPhases: trimmedPhases,
      });
      return;
    }

    next();
  };
}

/**
 * Require specific permission from user state
 * @param permission - Permission key from STATE_PERMISSIONS
 * @returns Express middleware
 */
export function requirePermission(permission: string) {
  const trimmedPermission = trimStr(permission);

  return (req: UserStateRequest, res: Response, next: NextFunction): void => {
    // Misconfiguration guard
    if (!trimmedPermission) {
      res.status(500).json({
        error: 'MISCONFIGURED_USER_STATE_GUARD',
        message: 'requirePermission was configured with no valid permission key.',
      });
      return;
    }

    const { UserStateMachine: usm } = deps;

    const currentState = safeGet(() => req.userState, undefined);

    if (!currentState) {
      res.status(401).json({
        error: 'USER_STATE_UNKNOWN',
        message: 'User state not determined. Are you logged in?',
      });
      return;
    }

    let hasPermission: boolean;
    try {
      hasPermission = usm.hasPermission(currentState, trimmedPermission);
    } catch {
      hasPermission = false;
    }

    if (!hasPermission) {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: `Permission '${trimmedPermission}' not available in state: ${currentState}`,
        currentState,
        requiredPermission: trimmedPermission,
      });
      return;
    }

    next();
  };
}

/**
 * Transition user state in database
 */
export async function transitionState(
  userId: string,
  fromState: string,
  toState: string,
  context: Record<string, unknown> = {}
): Promise<{ success: boolean; error?: string }> {
  const { UserStateMachine: usm, db } = deps;

  // Validate and trim userId
  const trimmedUserId = trimStr(userId);
  if (!trimmedUserId) {
    return { success: false, error: 'Invalid user id' };
  }

  // Validate states before calling machine
  const knownStates = Object.values(usm.USER_STATES);
  const trimmedFrom = trimStr(fromState);
  const trimmedTo = trimStr(toState);

  if (!trimmedFrom) {
    return { success: false, error: 'Invalid state: fromState is blank' };
  }
  if (!trimmedTo) {
    return { success: false, error: 'Invalid state: toState is blank' };
  }
  if (!knownStates.includes(trimmedFrom)) {
    return { success: false, error: `Unknown user state: ${trimmedFrom}` };
  }
  if (!knownStates.includes(trimmedTo)) {
    return { success: false, error: `Unknown user state: ${trimmedTo}` };
  }

  // Resolve new phase for target state before DB (may throw)
  let newPhase: string;
  try {
    newPhase = usm.getPhase(trimmedTo);
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  // Validate transition
  let validation: { valid: boolean; reason?: string };
  try {
    validation = usm.validateTransition(trimmedFrom, trimmedTo, context ?? {});
  } catch (e) {
    return { success: false, error: `validation failed: ${(e as Error).message}` };
  }

  if (!validation.valid) {
    return { success: false, error: validation.reason };
  }

  if (!db) {
    return { success: false, error: 'Database not available' };
  }

  try {
    const result = await db.run(
      `UPDATE users
             SET user_journey_state = ?,
                 current_phase = ?,
                 journey_state_changed_at = datetime('now'),
                 phase_changed_at = datetime('now')
             WHERE id = ?`,
      [trimmedTo, newPhase, trimmedUserId]
    );

    if (result && typeof result === 'object' && 'changes' in result && result.changes === 0) {
      return { success: false, error: 'User not updated: user not found' };
    }

    // Log to audit (if auditService available) — swallow all errors
    try {
      const AuditService = await import('../services/auditService.js').then((m) => m.default || m);
      const fromPhase = safeGet(() => usm.getPhase(trimmedFrom), '');
      await (AuditService as any).log({
        eventType: 'USER_STATE_TRANSITION',
        userId: trimmedUserId,
        metadata: {
          fromState: trimmedFrom,
          toState: trimmedTo,
          fromPhase,
          toPhase: newPhase,
          context: { ...(context ?? {}), timestamp: new Date().toISOString() },
        },
      });
    } catch (auditError) {
      logger.warn('Audit log failed for state transition:', (auditError as Error).message);
    }

    return { success: true };
  } catch (error: unknown) {
    logger.error('transitionState error:', error);
    return { success: false, error: (error as Error).message };
  }
}

// ==========================================
// EXPORTS
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
  deps = { ...deps, ...newDeps };
};
