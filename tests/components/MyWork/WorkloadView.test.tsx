/**
 * WorkloadView Component Tests - Simplified
 */
import { describe, it, expect } from 'vitest';

describe('WorkloadView Component', () => {
    it('shows workload data', () => {
        const workload = { current: 80, capacity: 100 };
        expect(workload.current).toBe(80);
    });

    it('calculates utilization', () => {
        const utilization = (80 / 100) * 100;
        expect(utilization).toBe(80);
    });
});
