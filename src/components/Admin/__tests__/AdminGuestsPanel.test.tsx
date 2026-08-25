import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { getAdminGuests } from '../../../services/adminGuestsApi';
import { AdminGuestsPanel } from '../AdminGuestsPanel';
vi.mock('../../../services/adminGuestsApi', () => ({
  getAdminGuests: vi.fn(),
  revokeAdminGuest: vi.fn(),
}));
describe('AdminGuestsPanel', () => {
  it('renders factual guest state and no placebo switch', async () => {
    vi.mocked(getAdminGuests).mockResolvedValue([
      {
        user_id: 'g1',
        email: 'guest@example.com',
        granted_at: '2026-08-01',
        status: 'ACTIVE',
        scope_type: 'ORG',
      },
    ]);
    render(<AdminGuestsPanel />);
    expect((await screen.findAllByText('guest@example.com')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText(/nie jest jeszcze egzekwowany/)).toBeInTheDocument();
  });
});
