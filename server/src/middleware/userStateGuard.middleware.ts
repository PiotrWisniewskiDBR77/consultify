/**
 * User State Guard Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Enforces UserState Machine per 01_USER_STATE_MACHINE.md
 *
 * Usage:
 *   router.get('/endpoint', userStateGuard.requireState(['ORG_MEMBER', 'TEAM_COLLAB']), handler)
 */

import { _Request, NextFunction, Response } from 'express';

import db from '../../db/sqliteAsync.js';
import UserStateMachine from '../../services/userStateMachine.js';
import logger from '../utils/Logger.ts';
import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

interface Database {
    getAsync: (sql: string, params: unknown[]) => Promise<unknown>;
    run: (sql: string, params: unknown[]) => Promise<void>;
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
        context?: Record<string, unknown>,
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
    db: db as unknown as Database,
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Attach user state to request
 * Must be called after authentication middleware
 */
export async function attachUserState(req: UserStateRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const { UserStateMachine, db } = deps;

        // Skip if no user
        if (!req.user?.id) {
            req.userState = UserStateMachine.USER_STATES.ANON;
            req.currentPhase = UserStateMachine.PHASES.A;
            next();
            return;
        }

        // Fetch from database
        if (!db) {
            req.userState = UserStateMachine.USER_STATES.ANON;
            req.currentPhase = UserStateMachine.PHASES.A;
            next();
            return;
        }

        const user = (await db.getAsync('SELECT user_journey_state, current_phase FROM users WHERE id = ?', [
            req.user.id,
        ])) as UserRow | null;

        if (user) {
            req.userState = user.user_journey_state || UserStateMachine.USER_STATES.ANON;
            req.currentPhase = user.current_phase || UserStateMachine.PHASES.A;
        } else {
            req.userState = UserStateMachine.USER_STATES.ANON;
            req.currentPhase = UserStateMachine.PHASES.A;
        }

        // Attach permissions for convenience
        req.statePermissions = UserStateMachine.getPermissions(req.userState);

        next();
    } catch (error: unknown) {
        logger.error('attachUserState error:', error);
        const { UserStateMachine } = deps;
        // Fail closed - treat as ANON
        req.userState = UserStateMachine.USER_STATES.ANON;
        req.currentPhase = UserStateMachine.PHASES.A;
        req.statePermissions = UserStateMachine.getPermissions(UserStateMachine.USER_STATES.ANON);
        next();
    }
}

/**
 * Require specific user state(s)
 * @param allowedStates - State(s) required to access endpoint
 * @returns Express middleware
 */
export function requireState(allowedStates: string | string[]) {
    const states = Array.isArray(allowedStates) ? allowedStates : [allowedStates];

    return (req: UserStateRequest, res: Response, next: NextFunction): void => {
        const currentState = req.userState;

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
    const phases = Array.isArray(allowedPhases) ? allowedPhases : [allowedPhases];

    return (req: UserStateRequest, res: Response, next: NextFunction): void => {
        const currentPhase = req.currentPhase;

        if (!phases.includes(currentPhase || '')) {
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
    return (req: UserStateRequest, res: Response, next: NextFunction): void => {
        const { UserStateMachine } = deps;

        const hasPermission = UserStateMachine.hasPermission(req.userState || '', permission);

        if (!hasPermission) {
            res.status(403).json({
                error: 'PERMISSION_DENIED',
                message: `Permission '${permission}' not available in state: ${req.userState}`,
                currentState: req.userState,
                requiredPermission: permission,
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
    context: Record<string, unknown> = {},
): Promise<{ success: boolean; error?: string }> {
    const { UserStateMachine, db } = deps;

    // Validate transition
    const validation = UserStateMachine.validateTransition(fromState, toState, context);
    if (!validation.valid) {
        return { success: false, error: validation.reason };
    }

    // Get new phase
    const newPhase = UserStateMachine.getPhase(toState);

    if (!db) {
        return { success: false, error: 'Database not available' };
    }

    try {
        await db.run(
            `UPDATE users 
             SET user_journey_state = ?, 
                 current_phase = ?,
                 journey_state_changed_at = datetime('now'),
                 phase_changed_at = datetime('now')
             WHERE id = ?`,
            [toState, newPhase, userId],
        );

        // Log to audit (if auditService available)
        try {
            const AuditService = await import('../../services/auditService.js').then((m) => m.default || m);
            await (AuditService as any).log({
                eventType: 'USER_STATE_TRANSITION',
                userId,
                metadata: {
                    fromState,
                    toState,
                    fromPhase: UserStateMachine.getPhase(fromState),
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





