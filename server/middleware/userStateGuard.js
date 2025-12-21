/**
 * User State Guard Middleware
 * 
 * Enforces UserState Machine per 01_USER_STATE_MACHINE.md
 * 
 * Usage:
 *   router.get('/endpoint', userStateGuard.requireState(['ORG_MEMBER', 'TEAM_COLLAB']), handler)
 */

const UserStateMachine = require('../services/userStateMachine');

// Dependency injection for testability
let db = null;
try {
    db = require('../db/sqliteAsync');
} catch (e) {
    console.warn('userStateGuard: Database not available');
}

/**
 * Attach user state to request
 * Must be called after authentication middleware
 */
async function attachUserState(req, res, next) {
    try {
        // Skip if no user
        if (!req.user?.id) {
            req.userState = UserStateMachine.USER_STATES.ANON;
            req.currentPhase = UserStateMachine.PHASES.A;
            return next();
        }

        // Fetch from database
        const user = await db.get(
            'SELECT user_journey_state, current_phase FROM users WHERE id = ?',
            [req.user.id]
        );

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
    } catch (error) {
        console.error('attachUserState error:', error);
        // Fail closed - treat as ANON
        req.userState = UserStateMachine.USER_STATES.ANON;
        req.currentPhase = UserStateMachine.PHASES.A;
        req.statePermissions = UserStateMachine.getPermissions(UserStateMachine.USER_STATES.ANON);
        next();
    }
}

/**
 * Require specific user state(s)
 * @param {string|string[]} allowedStates - State(s) required to access endpoint
 * @returns {function} Express middleware
 */
function requireState(allowedStates) {
    const states = Array.isArray(allowedStates) ? allowedStates : [allowedStates];

    return (req, res, next) => {
        const currentState = req.userState;

        if (!currentState) {
            return res.status(401).json({
                error: 'USER_STATE_UNKNOWN',
                message: 'User state not determined. Are you logged in?'
            });
        }

        if (!states.includes(currentState)) {
            return res.status(403).json({
                error: 'INVALID_USER_STATE',
                message: `This action requires state: ${states.join(' or ')}. Current state: ${currentState}`,
                currentState,
                requiredStates: states,
                currentPhase: req.currentPhase
            });
        }

        next();
    };
}

/**
 * Require specific phase(s)
 * @param {string|string[]} allowedPhases - Phase(s) required to access endpoint
 * @returns {function} Express middleware
 */
function requirePhase(allowedPhases) {
    const phases = Array.isArray(allowedPhases) ? allowedPhases : [allowedPhases];

    return (req, res, next) => {
        const currentPhase = req.currentPhase;

        if (!phases.includes(currentPhase)) {
            return res.status(403).json({
                error: 'INVALID_PHASE',
                message: `This action requires phase: ${phases.join(' or ')}. Current phase: ${currentPhase}`,
                currentPhase,
                requiredPhases: phases
            });
        }

        next();
    };
}

/**
 * Require specific permission from user state
 * @param {string} permission - Permission key from STATE_PERMISSIONS
 * @returns {function} Express middleware
 */
function requirePermission(permission) {
    return (req, res, next) => {
        const hasPermission = UserStateMachine.hasPermission(req.userState, permission);

        if (!hasPermission) {
            return res.status(403).json({
                error: 'PERMISSION_DENIED',
                message: `Permission '${permission}' not available in state: ${req.userState}`,
                currentState: req.userState,
                requiredPermission: permission
            });
        }

        next();
    };
}

/**
 * Transition user state in database
 * @param {string} userId 
 * @param {string} fromState 
 * @param {string} toState 
 * @param {object} context 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function transitionState(userId, fromState, toState, context = {}) {
    // Validate transition
    const validation = UserStateMachine.validateTransition(fromState, toState, context);
    if (!validation.valid) {
        return { success: false, error: validation.reason };
    }

    // Get new phase
    const newPhase = UserStateMachine.getPhase(toState);

    try {
        await db.run(
            `UPDATE users 
             SET user_journey_state = ?, 
                 current_phase = ?,
                 journey_state_changed_at = datetime('now'),
                 phase_changed_at = datetime('now')
             WHERE id = ?`,
            [toState, newPhase, userId]
        );

        // Log to audit (if auditService available)
        try {
            const AuditService = require('../services/auditService');
            await AuditService.log({
                eventType: 'USER_STATE_TRANSITION',
                userId,
                metadata: {
                    fromState,
                    toState,
                    fromPhase: UserStateMachine.getPhase(fromState),
                    toPhase: newPhase,
                    context: { ...context, timestamp: new Date().toISOString() }
                }
            });
        } catch (auditError) {
            console.warn('Audit log failed for state transition:', auditError.message);
        }

        return { success: true };
    } catch (error) {
        console.error('transitionState error:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    attachUserState,
    requireState,
    requirePhase,
    requirePermission,
    transitionState,
    // Re-export constants for convenience
    USER_STATES: UserStateMachine.USER_STATES,
    PHASES: UserStateMachine.PHASES
};
