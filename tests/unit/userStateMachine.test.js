/**
 * UserState Machine Unit Tests
 * 
 * Tests canonical UserState Machine per 01_USER_STATE_MACHINE.md
 */

const UserStateMachine = require('../../server/services/userStateMachine');

describe('UserStateMachine', () => {
    describe('State Constants', () => {
        test('should have all 7 canonical states', () => {
            const expectedStates = [
                'ANON',
                'DEMO_SESSION',
                'TRIAL_TRUSTED',
                'ORG_CREATOR',
                'ORG_MEMBER',
                'TEAM_COLLAB',
                'ECOSYSTEM_NODE'
            ];

            const actualStates = Object.values(UserStateMachine.USER_STATES);
            expect(actualStates).toEqual(expectedStates);
        });

        test('should have all 7 phases (A-G)', () => {
            const expectedPhases = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
            const actualPhases = Object.values(UserStateMachine.PHASES);
            expect(actualPhases).toEqual(expectedPhases);
        });
    });

    describe('State Transitions', () => {
        test('ANON can only transition to DEMO_SESSION', () => {
            expect(UserStateMachine.canTransition('ANON', 'DEMO_SESSION')).toBe(true);
            expect(UserStateMachine.canTransition('ANON', 'TRIAL_TRUSTED')).toBe(false);
            expect(UserStateMachine.canTransition('ANON', 'ORG_MEMBER')).toBe(false);
        });

        test('DEMO_SESSION can transition to TRIAL_TRUSTED or ANON', () => {
            expect(UserStateMachine.canTransition('DEMO_SESSION', 'TRIAL_TRUSTED')).toBe(true);
            expect(UserStateMachine.canTransition('DEMO_SESSION', 'ANON')).toBe(true);
            expect(UserStateMachine.canTransition('DEMO_SESSION', 'ORG_MEMBER')).toBe(false);
        });

        test('TRIAL_TRUSTED can only transition to ORG_CREATOR', () => {
            expect(UserStateMachine.canTransition('TRIAL_TRUSTED', 'ORG_CREATOR')).toBe(true);
            expect(UserStateMachine.canTransition('TRIAL_TRUSTED', 'ORG_MEMBER')).toBe(false);
            expect(UserStateMachine.canTransition('TRIAL_TRUSTED', 'DEMO_SESSION')).toBe(false);
        });

        test('linear progression from ORG_CREATOR to ECOSYSTEM_NODE', () => {
            expect(UserStateMachine.canTransition('ORG_CREATOR', 'ORG_MEMBER')).toBe(true);
            expect(UserStateMachine.canTransition('ORG_MEMBER', 'TEAM_COLLAB')).toBe(true);
            expect(UserStateMachine.canTransition('TEAM_COLLAB', 'ECOSYSTEM_NODE')).toBe(true);
        });

        test('ECOSYSTEM_NODE is terminal (no further transitions)', () => {
            const allowed = UserStateMachine.getAllowedTransitions('ECOSYSTEM_NODE');
            expect(allowed).toEqual([]);
        });

        test('no backward transitions allowed (except DEMO_SESSION to ANON)', () => {
            expect(UserStateMachine.canTransition('ORG_MEMBER', 'DEMO_SESSION')).toBe(false);
            expect(UserStateMachine.canTransition('TEAM_COLLAB', 'ORG_MEMBER')).toBe(false);
            expect(UserStateMachine.canTransition('ORG_CREATOR', 'TRIAL_TRUSTED')).toBe(false);
        });
    });

    describe('Transition Validation', () => {
        test('ANON to DEMO_SESSION requires login', () => {
            const result1 = UserStateMachine.validateTransition('ANON', 'DEMO_SESSION', {});
            expect(result1.valid).toBe(false);
            expect(result1.reason).toContain('login');

            const result2 = UserStateMachine.validateTransition('ANON', 'DEMO_SESSION', { isLoggedIn: true });
            expect(result2.valid).toBe(true);
        });

        test('DEMO_SESSION to TRIAL_TRUSTED requires access code/invite', () => {
            const result1 = UserStateMachine.validateTransition('DEMO_SESSION', 'TRIAL_TRUSTED', {});
            expect(result1.valid).toBe(false);

            const result2 = UserStateMachine.validateTransition('DEMO_SESSION', 'TRIAL_TRUSTED', { hasAccessCode: true });
            expect(result2.valid).toBe(true);

            const result3 = UserStateMachine.validateTransition('DEMO_SESSION', 'TRIAL_TRUSTED', { hasReferral: true });
            expect(result3.valid).toBe(true);

            const result4 = UserStateMachine.validateTransition('DEMO_SESSION', 'TRIAL_TRUSTED', { hasConsultantInvite: true });
            expect(result4.valid).toBe(true);

            const result5 = UserStateMachine.validateTransition('DEMO_SESSION', 'TRIAL_TRUSTED', { hasTeamInvite: true });
            expect(result5.valid).toBe(true);
        });

        test('TRIAL_TRUSTED to ORG_CREATOR requires explicit decision', () => {
            const result1 = UserStateMachine.validateTransition('TRIAL_TRUSTED', 'ORG_CREATOR', {});
            expect(result1.valid).toBe(false);
            expect(result1.reason).toContain('explicit');

            const result2 = UserStateMachine.validateTransition('TRIAL_TRUSTED', 'ORG_CREATOR', { hasExplicitOrgDecision: true });
            expect(result2.valid).toBe(true);
        });

        test('ORG_CREATOR to ORG_MEMBER requires organization to exist', () => {
            const result1 = UserStateMachine.validateTransition('ORG_CREATOR', 'ORG_MEMBER', {});
            expect(result1.valid).toBe(false);

            const result2 = UserStateMachine.validateTransition('ORG_CREATOR', 'ORG_MEMBER', { organizationId: 'org-123' });
            expect(result2.valid).toBe(true);
        });
    });

    describe('Phase Mapping', () => {
        test('each state maps to correct phase', () => {
            expect(UserStateMachine.getPhase('ANON')).toBe('A');
            expect(UserStateMachine.getPhase('DEMO_SESSION')).toBe('B');
            expect(UserStateMachine.getPhase('TRIAL_TRUSTED')).toBe('C');
            expect(UserStateMachine.getPhase('ORG_CREATOR')).toBe('D');
            expect(UserStateMachine.getPhase('ORG_MEMBER')).toBe('E');
            expect(UserStateMachine.getPhase('TEAM_COLLAB')).toBe('F');
            expect(UserStateMachine.getPhase('ECOSYSTEM_NODE')).toBe('G');
        });
    });

    describe('Permissions', () => {
        test('ANON has no AI interaction', () => {
            const perms = UserStateMachine.getPermissions('ANON');
            expect(perms.canUseAI).toBe(false);
            expect(perms.canInputData).toBe(false);
        });

        test('DEMO_SESSION has read-only AI', () => {
            const perms = UserStateMachine.getPermissions('DEMO_SESSION');
            expect(perms.canUseAI).toBe(true);
            expect(perms.canInputData).toBe(false); // read-only
        });

        test('ORG_MEMBER has full working capabilities', () => {
            const perms = UserStateMachine.getPermissions('ORG_MEMBER');
            expect(perms.canUseAI).toBe(true);
            expect(perms.canInputData).toBe(true);
            expect(perms.canWorkOnDRD).toBe(true);
            expect(perms.hasPersistentMemory).toBe(true);
        });

        test('ECOSYSTEM_NODE has all capabilities', () => {
            const perms = UserStateMachine.getPermissions('ECOSYSTEM_NODE');
            expect(perms.canUseBenchmarks).toBe(true);
            expect(perms.canUseReferrals).toBe(true);
            expect(perms.canUseConsultantMode).toBe(true);
        });

        test('hasPermission helper works correctly', () => {
            expect(UserStateMachine.hasPermission('ANON', 'canUseAI')).toBe(false);
            expect(UserStateMachine.hasPermission('ORG_MEMBER', 'canUseAI')).toBe(true);
            expect(UserStateMachine.hasPermission('ECOSYSTEM_NODE', 'canUseBenchmarks')).toBe(true);
        });
    });

    describe('Validation Helpers', () => {
        test('isValidState returns true for valid states', () => {
            expect(UserStateMachine.isValidState('ANON')).toBe(true);
            expect(UserStateMachine.isValidState('ORG_MEMBER')).toBe(true);
            expect(UserStateMachine.isValidState('INVALID')).toBe(false);
        });

        test('isValidPhase returns true for valid phases', () => {
            expect(UserStateMachine.isValidPhase('A')).toBe(true);
            expect(UserStateMachine.isValidPhase('G')).toBe(true);
            expect(UserStateMachine.isValidPhase('X')).toBe(false);
        });
    });
});
