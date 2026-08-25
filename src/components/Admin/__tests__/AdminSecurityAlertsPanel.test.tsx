import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';
import { getSecurityAlerts, resolveSecurityAlert } from '../../../services/adminSecurityAlertsApi';
import { AdminSecurityAlertsPanel } from '../AdminSecurityAlertsPanel';

// Opt-in to real PL translation resolution (tests/setup.ts's global
// react-i18next mock is key-agnostic by repo convention). This panel's
// own admin day-2 i18n contract (AdminDay2I18n.test.ts) forbids defaultValue
// fallbacks, so its tests assert literal Polish strings resolved from the
// real shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});

vi.mock('../../../services/adminSecurityAlertsApi', () => ({
  getSecurityAlerts: vi.fn(),
  resolveSecurityAlert: vi.fn(),
}));
describe('AdminSecurityAlertsPanel', () => {
  it('renders and resolves with server readback', async () => {
    vi.mocked(getSecurityAlerts).mockResolvedValue([
      {
        id: 'a1',
        event_type: 'login_failed',
        severity: 'critical',
        resolved: 0,
        created_at: '2026-08-24T10:00:00Z',
      },
    ]);
    vi.mocked(resolveSecurityAlert).mockResolvedValue([]);
    render(<AdminSecurityAlertsPanel />);
    expect(await screen.findByText('login_failed')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);
    fireEvent.click(await screen.findByText('Oznacz jako rozwiązane'));
    expect(resolveSecurityAlert).toHaveBeenCalledWith('a1');
  });

  it('renders an honest empty state when there are no alerts', async () => {
    vi.mocked(getSecurityAlerts).mockResolvedValue([]);
    render(<AdminSecurityAlertsPanel />);
    expect(await screen.findByText('Brak alertów')).toBeInTheDocument();
  });

  it('renders an API error', async () => {
    vi.mocked(getSecurityAlerts).mockRejectedValue(new Error('security alerts service down'));
    render(<AdminSecurityAlertsPanel />);
    expect(await screen.findByText('security alerts service down')).toBeInTheDocument();
  });
});
