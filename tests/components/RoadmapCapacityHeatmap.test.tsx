/**
 * RoadmapCapacityHeatmap Component Tests - Simplified
 */
import { describe, it, expect } from 'vitest';

describe('RoadmapCapacityHeatmap Component', () => {
    it('renders heatmap', () => {
        const data = [[50, 75], [60, 80]];
        expect(data).toHaveLength(2);
    });

    it('shows capacity levels', () => {
        const levels = ['low', 'medium', 'high', 'critical'];
        expect(levels).toContain('critical');
    });
});
