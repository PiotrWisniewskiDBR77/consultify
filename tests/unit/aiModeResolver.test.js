/**
 * AI Mode Resolver Unit Tests
 * 
 * Tests AI Mode system per 02_AI_BEHAVIOR_BY_PHASE.md and 30_AI_MODE_SWITCHING.md
 */

const AIModeResolver = require('../../server/services/aiModeResolver');

describe('AIModeResolver', () => {
    describe('Mode Constants', () => {
        test('should have all 6 AI modes', () => {
            const expectedModes = ['OFF', 'NARRATOR', 'GUIDE', 'THINKING_PARTNER', 'FACILITATOR', 'META_ANALYST'];
            const actualModes = Object.values(AIModeResolver.AI_MODES);
            expect(actualModes).toEqual(expectedModes);
        });
    });

    describe('Phase to Mode Mapping', () => {
        test('Phase A maps to OFF (no AI)', () => {
            expect(AIModeResolver.getModeForPhase('A')).toBe('OFF');
        });

        test('Phase B maps to NARRATOR', () => {
            expect(AIModeResolver.getModeForPhase('B')).toBe('NARRATOR');
        });

        test('Phase C maps to GUIDE', () => {
            expect(AIModeResolver.getModeForPhase('C')).toBe('GUIDE');
        });

        test('Phase D maps to GUIDE', () => {
            expect(AIModeResolver.getModeForPhase('D')).toBe('GUIDE');
        });

        test('Phase E maps to THINKING_PARTNER', () => {
            expect(AIModeResolver.getModeForPhase('E')).toBe('THINKING_PARTNER');
        });

        test('Phase F maps to FACILITATOR', () => {
            expect(AIModeResolver.getModeForPhase('F')).toBe('FACILITATOR');
        });

        test('Phase G maps to META_ANALYST', () => {
            expect(AIModeResolver.getModeForPhase('G')).toBe('META_ANALYST');
        });
    });

    describe('Mode Capabilities', () => {
        test('OFF mode cannot respond', () => {
            const caps = AIModeResolver.getCapabilities('OFF');
            expect(caps.canRespond).toBe(false);
            expect(caps.canExplain).toBe(false);
            expect(caps.canRecommend).toBe(false);
        });

        test('NARRATOR can explain but not recommend', () => {
            const caps = AIModeResolver.getCapabilities('NARRATOR');
            expect(caps.canRespond).toBe(true);
            expect(caps.canExplain).toBe(true);
            expect(caps.canRecommend).toBe(false);
            expect(caps.canAnalyze).toBe(false);
        });

        test('GUIDE can explain but not recommend or analyze', () => {
            const caps = AIModeResolver.getCapabilities('GUIDE');
            expect(caps.canRespond).toBe(true);
            expect(caps.canExplain).toBe(true);
            expect(caps.canRecommend).toBe(false);
            expect(caps.canAnalyze).toBe(false);
        });

        test('THINKING_PARTNER can recommend and analyze', () => {
            const caps = AIModeResolver.getCapabilities('THINKING_PARTNER');
            expect(caps.canRespond).toBe(true);
            expect(caps.canRecommend).toBe(true);
            expect(caps.canAnalyze).toBe(true);
            expect(caps.canBenchmark).toBe(false);
        });

        test('FACILITATOR can facilitate but not benchmark', () => {
            const caps = AIModeResolver.getCapabilities('FACILITATOR');
            expect(caps.canFacilitate).toBe(true);
            expect(caps.canBenchmark).toBe(false);
        });

        test('META_ANALYST has all capabilities', () => {
            const caps = AIModeResolver.getCapabilities('META_ANALYST');
            expect(caps.canRecommend).toBe(true);
            expect(caps.canAnalyze).toBe(true);
            expect(caps.canFacilitate).toBe(true);
            expect(caps.canBenchmark).toBe(true);
        });
    });

    describe('canAIRespond', () => {
        test('returns false for OFF mode', () => {
            expect(AIModeResolver.canAIRespond('OFF')).toBe(false);
        });

        test('returns true for all other modes', () => {
            expect(AIModeResolver.canAIRespond('NARRATOR')).toBe(true);
            expect(AIModeResolver.canAIRespond('GUIDE')).toBe(true);
            expect(AIModeResolver.canAIRespond('THINKING_PARTNER')).toBe(true);
            expect(AIModeResolver.canAIRespond('FACILITATOR')).toBe(true);
            expect(AIModeResolver.canAIRespond('META_ANALYST')).toBe(true);
        });
    });

    describe('Request Validation', () => {
        test('OFF mode blocks all requests', () => {
            const result = AIModeResolver.validateRequest('OFF', 'recommend');
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Phase A');
        });

        test('NARRATOR blocks recommendations', () => {
            const result = AIModeResolver.validateRequest('NARRATOR', 'recommendation');
            expect(result.allowed).toBe(false);
        });

        test('GUIDE blocks analysis', () => {
            const result = AIModeResolver.validateRequest('GUIDE', 'analyze');
            expect(result.allowed).toBe(false);
        });

        test('THINKING_PARTNER allows recommendations', () => {
            const result = AIModeResolver.validateRequest('THINKING_PARTNER', 'recommend');
            expect(result.allowed).toBe(true);
        });

        test('THINKING_PARTNER blocks benchmarks', () => {
            const result = AIModeResolver.validateRequest('THINKING_PARTNER', 'benchmark');
            expect(result.allowed).toBe(false);
        });

        test('META_ANALYST allows benchmarks', () => {
            const result = AIModeResolver.validateRequest('META_ANALYST', 'benchmark');
            expect(result.allowed).toBe(true);
        });
    });

    describe('System Instructions', () => {
        test('OFF mode returns null', () => {
            expect(AIModeResolver.getSystemInstruction('OFF')).toBeNull();
        });

        test('NARRATOR instruction contains mode declaration', () => {
            const instruction = AIModeResolver.getSystemInstruction('NARRATOR');
            expect(instruction).toContain('CURRENT_MODE: NARRATOR');
            expect(instruction).toContain('FORBIDDEN');
        });

        test('GUIDE instruction contains forbidden actions', () => {
            const instruction = AIModeResolver.getSystemInstruction('GUIDE');
            expect(instruction).toContain('CURRENT_MODE: GUIDE');
            expect(instruction).toContain('FORBIDDEN');
        });

        test('THINKING_PARTNER instruction contains 5-7 questions rule', () => {
            const instruction = AIModeResolver.getSystemInstruction('THINKING_PARTNER');
            expect(instruction).toContain('5-7 questions');
        });

        test('FACILITATOR instruction forbids taking sides', () => {
            const instruction = AIModeResolver.getSystemInstruction('FACILITATOR');
            expect(instruction).toContain('Taking sides');
        });

        test('META_ANALYST instruction forbids exposing identities', () => {
            const instruction = AIModeResolver.getSystemInstruction('META_ANALYST');
            expect(instruction).toContain('identities');
        });
    });

    describe('Off Mode Response', () => {
        test('returns appropriate message for Phase A users', () => {
            const response = AIModeResolver.getOffModeResponse();
            expect(response).toContain('not available');
        });
    });
});
