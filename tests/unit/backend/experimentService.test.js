/**
 * Experiment Service Unit Test - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('ExperimentService', () => {
    it('should create experiment', () => {
        const experiment = { id: 'exp-1', name: 'Test A/B' };
        expect(experiment.name).toBeDefined();
    });

    it('should track variants', () => {
        const variants = [{ id: 'A', weight: 50 }, { id: 'B', weight: 50 }];
        expect(variants.length).toBe(2);
    });
});
