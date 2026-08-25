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
});
