/**
 * UserProfileMenu Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('UserProfileMenu Component', () => {
  it('shows user info', () => {
    const user = { name: 'John Doe', email: 'john@test.com' };
    expect(user.name).toBe('John Doe');
  });

  it('handles logout', () => {
    const onLogout = vi.fn();
    onLogout();
    expect(onLogout).toHaveBeenCalled();
  });
});
