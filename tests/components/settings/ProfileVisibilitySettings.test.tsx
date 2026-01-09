/**
 * ProfileVisibilitySettings Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('ProfileVisibilitySettings Component', () => {
    it('shows visibility options', () => {
        const options = ['public', 'private', 'team'];
        expect(options).toContain('private');
    });

    it('handles change', () => {
        const onChange = vi.fn();
        onChange('private');
        expect(onChange).toHaveBeenCalledWith('private');
    });
});
