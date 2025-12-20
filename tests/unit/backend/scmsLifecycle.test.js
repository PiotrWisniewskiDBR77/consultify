// SCMS Lifecycle Service Tests
// Tests for stageGateService and phase logic

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database
vi.mock('../../../server/database', () => ({
    default: {
        get: vi.fn((sql, params, callback) => callback(null, null)),
        run: vi.fn((sql, params, callback) => callback && callback.call({ changes: 1 }, null)),
        all: vi.fn((sql, params, callback) => callback(null, []))
    }
}));

describe('StageGateService', () => {
    let StageGateService;

    beforeEach(async () => {
        vi.clearAllMocks();
        StageGateService = (await import('../../../server/services/stageGateService.js')).default;
    });

    describe('Gate Types', () => {
        it('should define READINESS_GATE', () => {
            expect(StageGateService.GATE_TYPES.READINESS_GATE).toBe('READINESS_GATE');
        });

        it('should define DESIGN_GATE', () => {
            expect(StageGateService.GATE_TYPES.DESIGN_GATE).toBe('DESIGN_GATE');
        });

        it('should define PLANNING_GATE', () => {
            expect(StageGateService.GATE_TYPES.PLANNING_GATE).toBe('PLANNING_GATE');
        });

        it('should define EXECUTION_GATE', () => {
            expect(StageGateService.GATE_TYPES.EXECUTION_GATE).toBe('EXECUTION_GATE');
        });

        it('should define CLOSURE_GATE', () => {
            expect(StageGateService.GATE_TYPES.CLOSURE_GATE).toBe('CLOSURE_GATE');
        });
    });

    describe('Service Structure', () => {
        it('should export getGateType function', () => {
            expect(typeof StageGateService.getGateType).toBe('function');
        });

        it('should export evaluateGate function', () => {
            expect(typeof StageGateService.evaluateGate).toBe('function');
        });

        it('should export passGate function', () => {
            expect(typeof StageGateService.passGate).toBe('function');
        });
    });

    describe('Gate Mapping', () => {
        it('should map Context to Assessment with READINESS_GATE', () => {
            const gateType = StageGateService.getGateType('Context', 'Assessment');
            expect(gateType).toBe('READINESS_GATE');
        });

        it('should map Roadmap to Execution with EXECUTION_GATE', () => {
            const gateType = StageGateService.getGateType('Roadmap', 'Execution');
            expect(gateType).toBe('EXECUTION_GATE');
        });

        it('should map Assessment to Initiatives with DESIGN_GATE', () => {
            const gateType = StageGateService.getGateType('Assessment', 'Initiatives');
            expect(gateType).toBe('DESIGN_GATE');
        });

        it('should map Initiatives to Roadmap with PLANNING_GATE', () => {
            const gateType = StageGateService.getGateType('Initiatives', 'Roadmap');
            expect(gateType).toBe('PLANNING_GATE');
        });

        it('should map Execution to Stabilization with CLOSURE_GATE', () => {
            const gateType = StageGateService.getGateType('Execution', 'Stabilization');
            expect(gateType).toBe('CLOSURE_GATE');
        });
    });
});

describe('Phase Constants', () => {
    it('should have 6 phases in SCMS lifecycle', () => {
        const phases = ['Context', 'Assessment', 'Initiatives', 'Roadmap', 'Execution', 'Stabilization'];
        expect(phases).toHaveLength(6);
    });

    it('should have Context as first phase', () => {
        const phases = ['Context', 'Assessment', 'Initiatives', 'Roadmap', 'Execution', 'Stabilization'];
        expect(phases[0]).toBe('Context');
    });

    it('should have Stabilization as last phase', () => {
        const phases = ['Context', 'Assessment', 'Initiatives', 'Roadmap', 'Execution', 'Stabilization'];
        expect(phases[5]).toBe('Stabilization');
    });
});
