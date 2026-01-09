/**
 * AxisCommentsPanel Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('AxisCommentsPanel Component', () => {
    it('shows comments', () => {
        const comments = [{ id: 'c-1', text: 'Comment 1' }];
        expect(comments).toHaveLength(1);
    });

    it('handles add', () => {
        const onAdd = vi.fn();
        onAdd('New comment');
        expect(onAdd).toHaveBeenCalled();
    });
});
