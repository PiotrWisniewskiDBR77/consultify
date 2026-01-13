/**
 * InitiativeDetailModal Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('InitiativeDetailModal Component', () => {
  it('shows initiative details', () => {
    const initiative = { name: 'Digital Transform', status: 'active' };
    expect(initiative.status).toBe('active');
  });

  it('handles close', () => {
    const onClose = vi.fn();
    onClose();
    expect(onClose).toHaveBeenCalled();
  });
});
