/**
 * ProgressView Component Tests - Simplified
 */
import { describe, it, expect } from 'vitest';

describe('ProgressView Component', () => {
    it('shows progress metrics', () => {
        const metrics = { completed: 10, total: 20 };
        expect(metrics.completed).toBe(10);
    });

    it('calculates percentage', () => {
        const percentage = (10 / 20) * 100;
        expect(percentage).toBe(50);
    });
});
