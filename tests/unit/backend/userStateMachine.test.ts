/**
 * UserStateMachine Tests
 * 
 * Tests for user state machine transitions and permissions.
 */

import UserStateMachine from '../../../server/src/services/userStateMachine.js';

describe('UserStateMachine', () => {
    describe('Constants', () => {
        it('should export USER_STATES', () => {
            expect(UserStateMachine.USER_STATES).toBeDefined();
            expect(UserStateMachine.USER_STATES.ANON).toBe('ANON');
            expect(UserStateMachine.USER_STATES.DEMO_SESSION).toBe('DEMO_SESSION');
        });

        it('should export PHASES', () => {
            expect(UserStateMachine.PHASES).toBeDefined();
            expect(UserStateMachine.PHASES.A).toBe('A');
        });

        it('should export VALID_TRANSITIONS', () => {
            expect(UserStateMachine.VALID_TRANSITIONS).toBeDefined();
        });
    });

    describe('canTransition', () => {
        it('should allow ANON to DEMO_SESSION', () => {
            const canTransition = UserStateMachine.canTransition(
                UserStateMachine.USER_STATES.ANON,
                UserStateMachine.USER_STATES.DEMO_SESSION
            );

            expect(canTransition).toBe(true);
        });

        it('should allow DEMO_SESSION to TRIAL_TRUSTED', () => {
            const canTransition = UserStateMachine.canTransition(
                UserStateMachine.USER_STATES.DEMO_SESSION,
                UserStateMachine.USER_STATES.TRIAL_TRUSTED
            );

            expect(canTransition).toBe(true);
        });

        it('should reject invalid transitions', () => {
            const canTransition = UserStateMachine.canTransition(
                UserStateMachine.USER_STATES.ANON,
                UserStateMachine.USER_STATES.ORG_CREATOR
            );

            expect(canTransition).toBe(false);
        });

        it('should reject transition to same state', () => {
            const canTransition = UserStateMachine.canTransition(
                UserStateMachine.USER_STATES.ANON,
                UserStateMachine.USER_STATES.ANON
            );

            expect(canTransition).toBe(false);
        });
    });

    describe('getPhase', () => {
        it('should return correct phase for state', () => {
            expect(UserStateMachine.getPhase(UserStateMachine.USER_STATES.ANON)).toBe('A');
            expect(UserStateMachine.getPhase(UserStateMachine.USER_STATES.DEMO_SESSION)).toBe('B');
            expect(UserStateMachine.getPhase(UserStateMachine.USER_STATES.TRIAL_TRUSTED)).toBe('C');
        });
    });

    describe('getPermissions', () => {
        it('should return permissions for ANON state', () => {
            const perms = UserStateMachine.getPermissions(UserStateMachine.USER_STATES.ANON);

            expect(perms.canViewPublicNarrative).toBe(true);
            expect(perms.canInteract).toBe(false);
            expect(perms.canInputData).toBe(false);
            expect(perms.canUseAI).toBe(false);
        });

        it('should return permissions for DEMO_SESSION state', () => {
            const perms = UserStateMachine.getPermissions(UserStateMachine.USER_STATES.DEMO_SESSION);

            expect(perms.canInteract).toBe(true);
            expect(perms.canInputData).toBe(false); // read-only
            expect(perms.canUseAI).toBe(true);
            expect(perms.hasSessionContext).toBe(true);
        });

        it('should return permissions for ORG_CREATOR state', () => {
            const perms = UserStateMachine.getPermissions(UserStateMachine.USER_STATES.ORG_CREATOR);

            expect(perms.canCreateOrg).toBe(true);
            expect(perms.canDefineRole).toBe(true);
            expect(perms.canDelegate).toBe(false);
        });

        it('should return permissions for ECOSYSTEM_NODE state', () => {
            const perms = UserStateMachine.getPermissions(UserStateMachine.USER_STATES.ECOSYSTEM_NODE);

            expect(perms.canInteract).toBe(true);
            expect(perms.canUseAI).toBe(true);
            expect(perms.canWorkOnDRD).toBe(true);
        });
    });

    describe('getNextStates', () => {
        it('should return valid next states', () => {
            const nextStates = UserStateMachine.getNextStates(UserStateMachine.USER_STATES.ANON);

            expect(Array.isArray(nextStates)).toBe(true);
            expect(nextStates).toContain(UserStateMachine.USER_STATES.DEMO_SESSION);
        });

        it('should return empty array for terminal state', () => {
            const nextStates = UserStateMachine.getNextStates(
                UserStateMachine.USER_STATES.ECOSYSTEM_NODE
            );

            expect(nextStates).toEqual([]);
        });
    });

    describe('isTerminalState', () => {
        it('should return true for ECOSYSTEM_NODE', () => {
            const isTerminal = UserStateMachine.isTerminalState(
                UserStateMachine.USER_STATES.ECOSYSTEM_NODE
            );

            expect(isTerminal).toBe(true);
        });

        it('should return false for non-terminal states', () => {
            const isTerminal = UserStateMachine.isTerminalState(
                UserStateMachine.USER_STATES.ANON
            );

            expect(isTerminal).toBe(false);
        });
    });
});















