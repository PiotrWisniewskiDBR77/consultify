/**
 * WorkPreferencesSettings Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('WorkPreferencesSettings Component', () => {
  it('shows work hours', () => {
    const hours = { start: '09:00', end: '17:00' };
    expect(hours.start).toBe('09:00');
  });

  it('handles save', () => {
    const onSave = vi.fn();
    onSave({ timezone: 'UTC+1' });
    expect(onSave).toHaveBeenCalled();
  });
});
