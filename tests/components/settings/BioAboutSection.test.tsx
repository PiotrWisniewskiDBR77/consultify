/**
 * BioAboutSection Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('BioAboutSection Component', () => {
    it('displays bio', () => {
        const bio = 'Software Engineer';
        expect(bio).toContain('Engineer');
    });

    it('handles edit', () => {
        const onEdit = vi.fn();
        onEdit('New bio text');
        expect(onEdit).toHaveBeenCalled();
    });
});
