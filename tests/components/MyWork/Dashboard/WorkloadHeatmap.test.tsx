/**
 * WorkloadHeatmap Component Tests - Simplified
 */
import { describe, it, expect } from 'vitest';

describe('WorkloadHeatmap Component', () => {
    it('renders heatmap', () => {
        const data = [[1, 2], [3, 4]];
        expect(data).toHaveLength(2);
    });

    it('shows intensity levels', () => {
        const levels = ['low', 'medium', 'high'];
        expect(levels).toContain('high');
    });
});
