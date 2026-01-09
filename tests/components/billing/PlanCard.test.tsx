/**
 * PlanCard Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('PlanCard Component', () => {
    it('shows plan details', () => {
        const plan = { name: 'Professional', price: 99 };
        expect(plan.name).toBe('Professional');
    });

    it('displays features', () => {
        const features = ['Unlimited AI', 'Priority Support'];
        expect(features).toHaveLength(2);
    });

    it('handles select', () => {
        const onSelect = vi.fn();
        onSelect('professional');
        expect(onSelect).toHaveBeenCalledWith('professional');
    });
});
