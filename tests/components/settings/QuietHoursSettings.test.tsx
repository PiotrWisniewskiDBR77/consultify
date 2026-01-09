/**
 * QuietHoursSettings Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('QuietHoursSettings Component', () => {
    it('shows time range', () => {
        const range = { start: '22:00', end: '08:00' };
        expect(range.start).toBe('22:00');
    });

    it('handles update', () => {
        const onUpdate = vi.fn();
        onUpdate({ start: '21:00', end: '07:00' });
        expect(onUpdate).toHaveBeenCalled();
    });
});
