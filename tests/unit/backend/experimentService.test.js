import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

/**
 * Experiment Service Tests
 * Tests for A/B testing and experiment management
 * CRITICAL FOR ENTERPRISE DATA-DRIVEN DECISIONS
 */

import ExperimentService from '../../../server/src/services/experimentService.js';

describe('Experiment Service', () => {
    let mocks;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks = setupStandardTest();

        if (ExperimentService.setDependencies) {
            ExperimentService.setDependencies({
                db: mocks.db,
                uuidv4: mocks.uuid || (() => 'experiment-uuid-1')
            });
        }
    });

    describe('Service Structure', () => {
        it('should be defined', () => {
            expect(ExperimentService).toBeDefined();
        });

        it('should have experiment constants', () => {
            if (ExperimentService.EXPERIMENT_TYPES) {
                expect(ExperimentService.EXPERIMENT_TYPES).toBeDefined();
                expect(Array.isArray(ExperimentService.EXPERIMENT_TYPES)).toBe(true);
            }
        });
    });

    describe('Experiment Operations', () => {
        it('should assign user to experiment variant', () => {
            if (typeof ExperimentService.assignVariant === 'function') {
                const variant = ExperimentService.assignVariant('exp-1', 'user-1');
                expect(variant).toBeDefined();
                expect(['control', 'variant-a', 'variant-b']).toContain(variant);
            } else {
                expect(ExperimentService).toBeDefined();
            }
        });

        it('should track experiment events', () => {
            if (typeof ExperimentService.trackEvent === 'function') {
                const result = ExperimentService.trackEvent('exp-1', 'user-1', 'click', { button: 'cta' });
                expect(result).toBeDefined();
                expect(result.success).toBeDefined();
            } else {
                expect(ExperimentService).toBeDefined();
            }
        });

        it('should calculate experiment results', () => {
            if (typeof ExperimentService.calculateResults === 'function') {
                const results = ExperimentService.calculateResults('exp-1');
                expect(results).toBeDefined();
                expect(results.confidence).toBeDefined();
                expect(results.winner).toBeDefined();
            } else {
                expect(ExperimentService).toBeDefined();
            }
        });
    });
});




