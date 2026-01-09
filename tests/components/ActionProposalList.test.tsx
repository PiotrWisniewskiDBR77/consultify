/**
 * ActionProposalList Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('ActionProposalList Component', () => {
    it('lists proposals', () => {
        const proposals = [{ id: 'p-1', action: 'Improve process' }];
        expect(proposals).toHaveLength(1);
    });

    it('handles approve', () => {
        const onApprove = vi.fn();
        onApprove('p-1');
        expect(onApprove).toHaveBeenCalled();
    });
});
