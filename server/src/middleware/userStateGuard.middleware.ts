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

import UserStateMachine from '../services/userStateMachine.js';
import { getDatabase as getDb } from '../database/Database.js';
import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

interface Database {
  getAsync: (sql: string, params: unknown[]) => Promise<unknown>;
  run: (sql: string, params: unknown[]) => Promise<void | { changes?: number }>;
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

interface UserStateMachine {
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
  UserStateMachine: UserStateMachine;
  db: Database | null;
}

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies = {
  UserStateMachine,
  db: getDb() as unknown as Database,
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const normalizeAllowList = (allowed: string | string[]): string[] => {
  const items = Array.isArray(allowed) ? allowed : [allowed];
  return items
    .map((item) => normalizeOptionalString(item))
    .filter((item): item is string => Boolean(item));
};
const isPlainObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const getAnonPermissions = (machine: UserStateMachine): Record<string, unknown> =>
  safeRead(
    () => machine.getPermissions(machine.USER_STATES.ANON),
    {}
  );

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
    const { UserStateMachine, db } = deps;

    // Skip if no user
    const userId = normalizeOptionalString(safeRead(() => req.user?.id, undefined as unknown));
    if (!userId) {
      req.userState = UserStateMachine.USER_STATES.ANON;
      req.currentPhase = UserStateMachine.PHASES.A;
      req.statePermissions = safeRead(
        () => UserStateMachine.getPermissions(req.userState as string),
        getAnonPermissions(UserStateMachine)
      );
      next();
      return;
    }

    // Fetch from database
    if (!db) {
      req.userState = UserStateMachine.USER_STATES.ANON;
      req.currentPhase = UserStateMachine.PHASES.A;
      req.statePermissions = safeRead(
        () => UserStateMachine.getPermissions(req.userState as string),
        getAnonPermissions(UserStateMachine)
      );
      next();
      return;
    }

    const user = await db.getAsync(
      'SELECT user_journey_state, current_phase FROM users WHERE id = ?',
      [userId]
    );

    if (isPlainObjectRecord(user)) {
      const rawState =
        normalizeOptionalString((user as UserRow).user_journey_state) ??
        UserStateMachine.USER_STATES.ANON;
      const knownStates = Object.values(UserStateMachine.USER_STATES);
      const normalizedState = knownStates.includes(rawState) ? rawState : UserStateMachine.USER_STATES.ANON;
      const rawPhase = normalizeOptionalString((user as UserRow).current_phase) ?? UserStateMachine.PHASES.A;
      const knownPhases = Object.values(UserStateMachine.PHASES);
      const normalizedPhase = knownPhases.includes(rawPhase)
        ? rawPhase
        : safeRead(() => UserStateMachine.getPhase(normalizedState), UserStateMachine.PHASES.A);
      req.userState = normalizedState;
      req.currentPhase = normalizedPhase;
    } else {
      req.userState = UserStateMachine.USER_STATES.ANON;
      req.currentPhase = UserStateMachine.PHASES.A;
    }

    // Attach permissions for convenience
    req.statePermissions = safeRead(
      () => UserStateMachine.getPermissions(req.userState as string),
      getAnonPermissions(UserStateMachine)
    );

    next();
  } catch (error: unknown) {
    logger.error('attachUserState error:', error);
    const { UserStateMachine } = deps;
    // Fail closed - treat as ANON
    req.userState = UserStateMachine.USER_STATES.ANON;
    req.currentPhase = UserStateMachine.PHASES.A;
    req.statePermissions = getAnonPermissions(UserStateMachine);
    next();
  }
}

/**
 * Require specific user state(s)
 * @param allowedStates - State(s) required to access endpoint
 * @returns Express middleware
 */
export function requireState(allowedStates: string | string[]) {
  const states = normalizeAllowList(allowedStates);
  if (states.length === 0) {
    return (_req: UserStateRequest, res: Response, _next: NextFunction): void => {
      res.status(500).json({
        error: 'MISCONFIGURED_USER_STATE_GUARD',
        message: 'requireState was configured with no valid allowed states.',
      });
    };
  }

  return (req: UserStateRequest, res: Response, next: NextFunction): void => {
    const currentState = normalizeOptionalString(req.userState);

    if (!currentState) {
      res.status(401).json({
        error: 'USER_STATE_UNKNOWN',
        message: 'User state not determined. Are you logged in?',
      });
      return;
    }

    if (!states.includes(currentState)) {
      res.status(403).json({
        error: 'INVALID_USER_STATE',
        message: `This action requires state: ${states.join(' or ')}. Current state: ${currentState}`,
        currentState,
        requiredStates: states,
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
  const phases = normalizeAllowList(allowedPhases);
  if (phases.length === 0) {
    return (_req: UserStateRequest, res: Response, _next: NextFunction): void => {
      res.status(500).json({
        error: 'MISCONFIGURED_USER_STATE_GUARD',
        message: 'requirePhase was configured with no valid allowed phases.',
      });
    };
  }

  return (req: UserStateRequest, res: Response, next: NextFunction): void => {
    const currentPhase = normalizeOptionalString(req.currentPhase);

    if (!currentPhase) {
      res.status(401).json({
        error: 'USER_PHASE_UNKNOWN',
        message: 'User phase not determined. Are you logged in?',
      });
      return;
    }

    if (!phases.includes(currentPhase)) {
      res.status(403).json({
        error: 'INVALID_PHASE',
        message: `This action requires phase: ${phases.join(' or ')}. Current phase: ${currentPhase}`,
        currentPhase,
        requiredPhases: phases,
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
  const normalizedPermission = normalizeOptionalString(permission);
  if (!normalizedPermission) {
    return (_req: UserStateRequest, res: Response, _next: NextFunction): void => {
      res.status(500).json({
        error: 'MISCONFIGURED_USER_STATE_GUARD',
        message: 'requirePermission was configured with no valid permission key.',
      });
    };
  }

  return (req: UserStateRequest, res: Response, next: NextFunction): void => {
    const { UserStateMachine } = deps;
    const currentState = normalizeOptionalString(req.userState);

    if (!currentState) {
      res.status(401).json({
        error: 'USER_STATE_UNKNOWN',
        message: 'User state not determined. Are you logged in?',
      });
      return;
    }

    let hasPermission = false;
    try {
      hasPermission = UserStateMachine.hasPermission(currentState, normalizedPermission);
    } catch (error: unknown) {
      logger.warn('requirePermission hasPermission error:', error);
      hasPermission = false;
    }

    if (!hasPermission) {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: `Permission '${normalizedPermission}' not available in state: ${currentState}`,
        currentState,
        requiredPermission: normalizedPermission,
      });
      return;
    }

    next();
  };
}

/**
 * Transition user state in database
 * @param userId - User ID
 * @param fromState - Current state
 * @param toState - Target state
 * @param context - Transition context
 * @returns Promise with success status
 */
export async function transitionState(
  userId: string,
  fromState: string,
  toState: string,
  context: Record<string, unknown> = {}
): Promise<{ success: boolean; error?: string }> {
  const { UserStateMachine, db } = deps;
  const normalizedUserId = normalizeOptionalString(userId);
  const normalizedFromState = normalizeOptionalString(fromState);
  const normalizedToState = normalizeOptionalString(toState);
  if (!normalizedUserId) {
    return { success: false, error: 'Invalid user id' };
  }
  if (!normalizedFromState || !normalizedToState) {
    return { success: false, error: 'Invalid state' };
  }
  const knownStates = new Set(Object.values(UserStateMachine.USER_STATES));
  if (!knownStates.has(normalizedFromState) || !knownStates.has(normalizedToState)) {
    return { success: false, error: 'Unknown user state' };
  }

  // Validate transition
  let validation: { valid: boolean; reason?: string };
  try {
    validation = UserStateMachine.validateTransition(normalizedFromState, normalizedToState, context);
  } catch (error: unknown) {
    logger.error('transitionState validateTransition error:', error);
    return { success: false, error: 'State transition validation failed' };
  }
  if (!validation.valid) {
    return { success: false, error: validation.reason };
  }

  // Get new phase
  let newPhase: string;
  try {
    newPhase = UserStateMachine.getPhase(normalizedToState);
  } catch (error: unknown) {
    logger.error('transitionState getPhase error:', error);
    return { success: false, error: 'State transition phase resolution failed' };
  }

  if (!db) {
    return { success: false, error: 'Database not available' };
  }

  try {
    const runResult = await db.run(
      `UPDATE users 
             SET user_journey_state = ?, 
                 current_phase = ?,
                 journey_state_changed_at = datetime('now'),
                 phase_changed_at = datetime('now')
             WHERE id = ?`,
      [normalizedToState, newPhase, normalizedUserId]
    );
    if (
      runResult &&
      typeof runResult === 'object' &&
      typeof (runResult as { changes?: unknown }).changes === 'number' &&
      (runResult as { changes: number }).changes === 0
    ) {
      return { success: false, error: 'User not found or state not updated' };
    }

    // Log to audit (if auditService available)
    try {
      const AuditService = await import('../services/auditService.js').then(
        (m) => m.default || m
      );
      await (AuditService as any).log({
        eventType: 'USER_STATE_TRANSITION',
        userId: normalizedUserId,
        metadata: {
          fromState: normalizedFromState,
          toState: normalizedToState,
          fromPhase: safeRead(() => UserStateMachine.getPhase(normalizedFromState), newPhase),
          toPhase: newPhase,
          context: { ...context, timestamp: new Date().toISOString() },
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

export const USER_STATES = UserStateMachine.USER_STATES;
export const PHASES = UserStateMachine.PHASES;

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
  deps = { ...deps, ...newDeps };
};
