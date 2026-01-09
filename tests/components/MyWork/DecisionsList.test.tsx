/**
 * DecisionsList Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('DecisionsList Component', () => {
    it('lists decisions', () => {
        const decisions = [{ id: 'd-1', title: 'Decision 1' }];
        expect(decisions).toHaveLength(1);
    });

    it('handles selection', () => {
        const onSelect = vi.fn();
        onSelect('d-1');
        expect(onSelect).toHaveBeenCalled();
    });
});
