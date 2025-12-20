import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// For tests that don't need db mocking, we test the core logic directly
describe('PolicyEngine Core Logic', () => {
    describe('Safety Guardrails Constants', () => {
        // Import fresh module for each test
        let PolicyEngine;

        beforeEach(async () => {
            vi.resetModules();
            PolicyEngine = require('../../server/ai/policyEngine');
        });

        it('NEVER_AUTO_APPROVE_RISK_LEVELS should include HIGH', () => {
            expect(PolicyEngine.NEVER_AUTO_APPROVE_RISK_LEVELS).toContain('HIGH');
        });

        it('ALWAYS_MANUAL_ACTION_TYPES should include MEETING_SCHEDULE', () => {
            expect(PolicyEngine.ALWAYS_MANUAL_ACTION_TYPES).toContain('MEETING_SCHEDULE');
        });

        it('should not include LOW in NEVER_AUTO_APPROVE_RISK_LEVELS', () => {
            expect(PolicyEngine.NEVER_AUTO_APPROVE_RISK_LEVELS).not.toContain('LOW');
        });
    });

    describe('CONDITION_HANDLERS (Pure Functions)', () => {
        let PolicyEngine;

        beforeEach(async () => {
            vi.resetModules();
            PolicyEngine = require('../../server/ai/policyEngine');
        });

        describe('risk_level_lte', () => {
            it('should match when proposal risk is lower or equal', async () => {
                const handler = PolicyEngine.CONDITION_HANDLERS.risk_level_lte;

                expect(await handler('LOW', { risk_level: 'LOW' })).toBe(true);
                expect(await handler('MEDIUM', { risk_level: 'LOW' })).toBe(true);
                expect(await handler('HIGH', { risk_level: 'MEDIUM' })).toBe(true);
                expect(await handler('HIGH', { risk_level: 'HIGH' })).toBe(true);
            });

            it('should not match when proposal risk is higher', async () => {
                const handler = PolicyEngine.CONDITION_HANDLERS.risk_level_lte;

                expect(await handler('LOW', { risk_level: 'MEDIUM' })).toBe(false);
                expect(await handler('LOW', { risk_level: 'HIGH' })).toBe(false);
                expect(await handler('MEDIUM', { risk_level: 'HIGH' })).toBe(false);
            });
        });

        describe('action_type_in', () => {
            it('should match when action type is in list', async () => {
                const handler = PolicyEngine.CONDITION_HANDLERS.action_type_in;

                expect(await handler(['TASK_CREATE', 'PLAYBOOK_ASSIGN'], { action_type: 'TASK_CREATE' })).toBe(true);
                expect(await handler(['TASK_CREATE'], { action_type: 'TASK_CREATE' })).toBe(true);
            });

            it('should not match when action type is not in list', async () => {
                const handler = PolicyEngine.CONDITION_HANDLERS.action_type_in;

                expect(await handler(['TASK_CREATE'], { action_type: 'MEETING_SCHEDULE' })).toBe(false);
                expect(await handler([], { action_type: 'TASK_CREATE' })).toBe(false);
            });

            it('should return false for non-array input', async () => {
                const handler = PolicyEngine.CONDITION_HANDLERS.action_type_in;

                expect(await handler('TASK_CREATE', { action_type: 'TASK_CREATE' })).toBe(false);
            });
        });

        describe('scope_eq', () => {
            it('should match when scope equals', async () => {
                const handler = PolicyEngine.CONDITION_HANDLERS.scope_eq;

                expect(await handler('USER', { scope: 'USER' })).toBe(true);
                expect(await handler('ORG', { scope: 'ORG' })).toBe(true);
                expect(await handler('INITIATIVE', { scope: 'INITIATIVE' })).toBe(true);
            });

            it('should not match when scope differs', async () => {
                const handler = PolicyEngine.CONDITION_HANDLERS.scope_eq;

                expect(await handler('ORG', { scope: 'USER' })).toBe(false);
                expect(await handler('USER', { scope: 'ORG' })).toBe(false);
            });
        });

        describe('signal_in', () => {
            it('should match when signal is in list', async () => {
                const handler = PolicyEngine.CONDITION_HANDLERS.signal_in;

                expect(await handler(['USER_AT_RISK', 'BLOCKED_INITIATIVE'], { origin_signal: 'USER_AT_RISK' })).toBe(true);
            });

            it('should not match when signal is not in list', async () => {
                const handler = PolicyEngine.CONDITION_HANDLERS.signal_in;

                expect(await handler(['USER_AT_RISK'], { origin_signal: 'OTHER_SIGNAL' })).toBe(false);
            });

            it('should return false for non-array input', async () => {
                const handler = PolicyEngine.CONDITION_HANDLERS.signal_in;

                expect(await handler('USER_AT_RISK', { origin_signal: 'USER_AT_RISK' })).toBe(false);
            });
        });

        describe('time_window', () => {
            it('should always match for anytime', async () => {
                const handler = PolicyEngine.CONDITION_HANDLERS.time_window;

                expect(await handler('anytime')).toBe(true);
            });

            it('should return false for unrecognized values', async () => {
                const handler = PolicyEngine.CONDITION_HANDLERS.time_window;

                expect(await handler('unknown')).toBe(false);
            });
        });
    });

    describe('evaluateConditions (Logic Tests)', () => {
        let PolicyEngine;

        beforeEach(async () => {
            vi.resetModules();
            PolicyEngine = require('../../server/ai/policyEngine');
        });

        it('should return true when all conditions match', async () => {
            const proposal = {
                risk_level: 'LOW',
                action_type: 'TASK_CREATE',
                scope: 'USER',
                origin_signal: 'USER_AT_RISK'
            };

            const conditions = {
                risk_level_lte: 'LOW',
                scope_eq: 'USER'
            };

            const result = await PolicyEngine.evaluateConditions(conditions, proposal, 'org-123');
            expect(result).toBe(true);
        });

        it('should return false when any condition fails', async () => {
            const proposal = {
                risk_level: 'MEDIUM', // Higher than condition
                action_type: 'TASK_CREATE',
                scope: 'USER'
            };

            const conditions = {
                risk_level_lte: 'LOW', // This should fail
                scope_eq: 'USER'
            };

            const result = await PolicyEngine.evaluateConditions(conditions, proposal, 'org-123');
            expect(result).toBe(false);
        });

        it('should return false for unknown conditions (safety)', async () => {
            const proposal = { risk_level: 'LOW' };
            const conditions = { unknown_condition: 'value' };

            const result = await PolicyEngine.evaluateConditions(conditions, proposal, 'org-123');
            expect(result).toBe(false);
        });

        it('should return true for empty conditions', async () => {
            const proposal = { risk_level: 'LOW' };
            const conditions = {};

            const result = await PolicyEngine.evaluateConditions(conditions, proposal, 'org-123');
            expect(result).toBe(true);
        });
    });
});

describe('PolicyEngine Safety Checks', () => {
    let PolicyEngine;

    beforeEach(async () => {
        vi.resetModules();
        PolicyEngine = require('../../server/ai/policyEngine');
    });

    it('HIGH risk is in NEVER_AUTO_APPROVE list', () => {
        expect(PolicyEngine.NEVER_AUTO_APPROVE_RISK_LEVELS.includes('HIGH')).toBe(true);
    });

    it('MEETING_SCHEDULE is in ALWAYS_MANUAL list', () => {
        expect(PolicyEngine.ALWAYS_MANUAL_ACTION_TYPES.includes('MEETING_SCHEDULE')).toBe(true);
    });
});
