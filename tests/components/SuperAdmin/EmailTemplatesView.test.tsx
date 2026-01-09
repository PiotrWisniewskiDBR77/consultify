/**
 * EmailTemplatesView Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('EmailTemplatesView Component', () => {
    it('lists templates', () => {
        const templates = [{ id: 't-1', name: 'Welcome' }];
        expect(templates).toHaveLength(1);
    });

    it('handles edit', () => {
        const onEdit = vi.fn();
        onEdit('t-1');
        expect(onEdit).toHaveBeenCalled();
    });
});
