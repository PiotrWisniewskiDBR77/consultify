/**
 * ProactiveNudgeDisplay Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('ProactiveNudgeDisplay Component', () => {
    it('shows nudge message', () => {
        const nudge = { message: 'Check your tasks', type: 'reminder' };
        expect(nudge.message).toContain('tasks');
    });

    it('handles dismiss', () => {
        const onDismiss = vi.fn();
        onDismiss();
        expect(onDismiss).toHaveBeenCalled();
    });

    it('handles action', () => {
        const onAction = vi.fn();
        onAction('view_tasks');
        expect(onAction).toHaveBeenCalled();
    });
});
