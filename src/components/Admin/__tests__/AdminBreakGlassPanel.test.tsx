import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';
import {
  createBreakGlass,
  getBreakGlass,
  revokeBreakGlass,
} from '../../../services/adminBreakGlassApi';
import { AdminBreakGlassPanel } from '../AdminBreakGlassPanel';

// Opt-in to real PL translation resolution (tests/setup.ts's global
// react-i18next mock is key-agnostic by repo convention). This panel's
// own admin day-2 i18n contract (AdminDay2I18n.test.ts) forbids defaultValue
// fallbacks, so its tests assert literal Polish strings resolved from the
// real shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});

vi.mock('../../../services/adminBreakGlassApi', () => ({
  getBreakGlass: vi.fn(),
  createBreakGlass: vi.fn(),
  revokeBreakGlass: vi.fn(),
}));
describe('AdminBreakGlassPanel', () => {
  it('requires typed target, reason and approver before confirmation', async () => {
    vi.mocked(getBreakGlass).mockResolvedValue({
      sessions: [],
      policy: { breakGlassEnabled: true, breakGlassApprovers: ['u2'] },
      approvers: [{ id: 'u2', email: 'approver@example.com' }],
    });
    vi.mocked(createBreakGlass).mockResolvedValue({
      sessions: [],
      policy: { breakGlassEnabled: true, breakGlassApprovers: ['u2'] },
      approvers: [],
    });
    render(<AdminBreakGlassPanel />);
    const activate = await screen.findByRole('button', { name: 'Aktywuj na 1h' });
    expect(activate).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Powód break-glass'), {
      target: { value: 'Emergency access needed' },
    });
    fireEvent.change(screen.getByLabelText('Zatwierdzający'), { target: { value: 'u2' } });
    fireEvent.change(screen.getByLabelText('Potwierdzenie celu'), {
      target: { value: 'BREAK-GLASS' },
    });
    expect(activate).toBeEnabled();
    fireEvent.click(activate);
    expect(await screen.findByText(/Zakres: awaryjne uprawnienia/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aktywuj break-glass' }));
    expect(createBreakGlass).toHaveBeenCalledWith('Emergency access needed', 'u2');
  });

  it('renders an honest empty state when there are no active sessions', async () => {
    vi.mocked(getBreakGlass).mockResolvedValue({
      sessions: [],
      policy: { breakGlassEnabled: true, breakGlassApprovers: [] },
      approvers: [],
    });
    render(<AdminBreakGlassPanel />);
    expect(await screen.findByText('Brak aktywnych sesji break-glass')).toBeInTheDocument();
  });

  it('renders an API error', async () => {
    vi.mocked(getBreakGlass).mockRejectedValue(new Error('break-glass service down'));
    render(<AdminBreakGlassPanel />);
    expect(await screen.findByText('break-glass service down')).toBeInTheDocument();
  });
});
