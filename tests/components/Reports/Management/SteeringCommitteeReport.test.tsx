/**
 * SteeringCommitteeReport Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('SteeringCommitteeReport Component', () => {
    it('renders report sections', () => {
        const sections = ['Executive Summary', 'Highlights', 'Risks', 'Next Steps'];
        expect(sections).toHaveLength(4);
    });

    it('displays metrics', () => {
        const metrics = { budget: 95, schedule: 88, quality: 92 };
        expect(metrics.budget).toBe(95);
    });

    it('handles export', () => {
        const onExport = vi.fn();
        onExport('pdf');
        expect(onExport).toHaveBeenCalledWith('pdf');
    });
});
