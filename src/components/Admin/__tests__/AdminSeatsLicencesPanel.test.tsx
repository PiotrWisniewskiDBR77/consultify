import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';
import {
  getAdminSeatHistory,
  getAdminSeats,
  updateAdminSeatAutoAdd,
} from '../../../services/adminSeatsApi';
import { AdminSeatsLicencesPanel } from '../AdminSeatsLicencesPanel';

// Opt-in to real PL translation resolution (tests/setup.ts's global
// react-i18next mock is key-agnostic by repo convention). This panel's
// own admin day-2 i18n contract (AdminDay2I18n.test.ts) forbids defaultValue
// fallbacks, so its tests assert literal Polish strings resolved from the
// real shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});

vi.mock('../../../services/adminSeatsApi', () => ({
  getAdminSeats: vi.fn(),
  getAdminSeatHistory: vi.fn(),
  updateAdminSeatAutoAdd: vi.fn(),
}));
const seats = vi.mocked(getAdminSeats);
const history = vi.mocked(getAdminSeatHistory);
const update = vi.mocked(updateAdminSeatAutoAdd);
describe('AdminSeatsLicencesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seats.mockResolvedValue({
      total_seats_available: 10,
      seats_used: 3,
      seats_remaining: 7,
      utilization_percent: '30',
      auto_add_seats_on_invite: 0,
      auto_add_seats_threshold: 80,
    });
    history.mockResolvedValue([
      { id: 'tx1', transaction_type: 'invite', seats_count: 1, created_at: '2026-08-24T12:00:00Z' },
    ]);
  });
  it('renders configuration, history and honest purchase boundary', async () => {
    render(<AdminSeatsLicencesPanel />);
    expect(await screen.findByText('invite')).toBeInTheDocument();
    expect(screen.getByText(/Samoobsługowy zakup miejsc niedostępny/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kup miejsca' })).toBeDisabled();
  });
  it('saves auto-add through the readback API', async () => {
    update.mockResolvedValue({ auto_add_seats_on_invite: 1, auto_add_seats_threshold: 75 });
    render(<AdminSeatsLicencesPanel />);
    await screen.findByText('invite');
    fireEvent.change(screen.getByLabelText('Próg procentowy'), { target: { value: '75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(update).toHaveBeenCalledWith(false, 75);
  });

  it('admin-billing-seats-licences defekt 05.09: never shows a contradictory 0-total/0%-used summary when no plan is configured', async () => {
    // Real-world shape: an org with active members but no seat-limited plan
    // wired up yet (e.g. base_seats_included frozen at 0 from init, no
    // organization_billing/subscription_plans row). seats_used is real (8);
    // seats_limit_configured says so honestly instead of implying "0 total".
    seats.mockResolvedValue({
      total_seats_available: 0,
      seats_used: 8,
      seats_limit_configured: false,
      auto_add_seats_on_invite: 0,
      auto_add_seats_threshold: 80,
    });
    history.mockResolvedValue([]);
    render(<AdminSeatsLicencesPanel />);
    // "Zajęte" (used) is the one real number we know — still shown.
    expect(await screen.findByText('8')).toBeInTheDocument();
    // Total / Remaining / Utilization must NOT claim "0" — that reads as a
    // hard limit that's already been breached. They must say honestly that
    // no limit is configured.
    const honestLabels = screen.getAllByText('Brak ustawionego limitu');
    expect(honestLabels).toHaveLength(3); // Łącznie, Wolne, Wykorzystanie
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });
});
