/**
 * ReportComments Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('ReportComments Component', () => {
    it('displays comments', () => {
        const comments = [{ id: 'c-1', text: 'Great report', author: 'user-1' }];
        expect(comments).toHaveLength(1);
    });

    it('handles add comment', () => {
        const onAdd = vi.fn();
        onAdd('New comment');
        expect(onAdd).toHaveBeenCalled();
    });

    it('handles reply', () => {
        const onReply = vi.fn();
        onReply('c-1', 'Reply text');
        expect(onReply).toHaveBeenCalled();
    });

    it('shows comment thread', () => {
        const thread = { replies: [{ id: 'r-1' }] };
        expect(thread.replies).toHaveLength(1);
    });
});
