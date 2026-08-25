import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';
import { getAdminGuests } from '../../../services/adminGuestsApi';
import { AdminGuestsPanel } from '../AdminGuestsPanel';

// Opt-in to real PL translation resolution (tests/setup.ts's global
// react-i18next mock is key-agnostic by repo convention). This panel's
// own admin day-2 i18n contract (AdminDay2I18n.test.ts) forbids defaultValue
// fallbacks, so its tests assert literal Polish strings resolved from the
// real shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});

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

  it('renders an honest empty state when there are no guests', async () => {
    vi.mocked(getAdminGuests).mockResolvedValue([]);
    render(<AdminGuestsPanel />);
    expect(await screen.findByText('Brak gości')).toBeInTheDocument();
  });

  it('renders an API error', async () => {
    vi.mocked(getAdminGuests).mockRejectedValue(new Error('guests service down'));
    render(<AdminGuestsPanel />);
    expect(await screen.findByText('guests service down')).toBeInTheDocument();
  });
});
