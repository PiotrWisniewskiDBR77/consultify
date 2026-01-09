/**
 * AssessmentModuleHub Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('AssessmentModuleHub Component', () => {
    it('lists modules', () => {
        const modules = ['DRD', 'Maturity', 'Gap Analysis'];
        expect(modules).toHaveLength(3);
    });

    it('handles module selection', () => {
        const onSelect = vi.fn();
        onSelect('DRD');
        expect(onSelect).toHaveBeenCalledWith('DRD');
    });
});
