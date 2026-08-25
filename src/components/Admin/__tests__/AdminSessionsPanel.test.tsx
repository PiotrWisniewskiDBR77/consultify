import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';
import { getAdminSessions, revokeAdminSession } from '../../../services/adminSessionsApi';
import { AdminSessionsPanel } from '../AdminSessionsPanel';

// Opt-in to real PL translation resolution (tests/setup.ts's global
// react-i18next mock is key-agnostic by repo convention). This panel's
// own admin day-2 i18n contract (AdminDay2I18n.test.ts) forbids defaultValue
// fallbacks, so its tests assert literal Polish strings resolved from the
// real shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});

vi.mock('../../../services/adminSessionsApi', () => ({
  getAdminSessions: vi.fn(),
  revokeAdminSession: vi.fn(),
}));
describe('AdminSessionsPanel', () => {
  it('confirms revoke and applies readback', async () => {
    vi.mocked(getAdminSessions).mockResolvedValue([
      { id: 's1', user_id: 'u1', user_email: 'owner@example.com', device_info: 'Safari' },
    ]);
    vi.mocked(revokeAdminSession).mockResolvedValue([]);
    render(<AdminSessionsPanel />);
    expect(await screen.findByText('owner@example.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /actions|akcje/i }));
    fireEvent.click(await screen.findByText('Unieważnij sesję'));
    fireEvent.click(screen.getByRole('button', { name: 'Unieważnij sesję' }));
    expect(revokeAdminSession).toHaveBeenCalledWith('s1');
  });

  it('renders an honest empty state when there are no active sessions', async () => {
    vi.mocked(getAdminSessions).mockResolvedValue([]);
    render(<AdminSessionsPanel />);
    expect(await screen.findByText('Brak aktywnych sesji')).toBeInTheDocument();
  });

  it('renders an API error', async () => {
    vi.mocked(getAdminSessions).mockRejectedValue(new Error('sessions service down'));
    render(<AdminSessionsPanel />);
    expect(await screen.findByText('sessions service down')).toBeInTheDocument();
  });
});
