import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSummary, toastSuccess, toastError } = vi.hoisted(() => ({
  getSummary: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/services/api/v8/execution-control', () => ({
  shouldFallbackToLegacyExecutionControl: () => false,
  V8ExecutionControlApi: { getBudgetInitiativeSummary: getSummary },
}));
vi.mock('react-hot-toast', () => ({ default: { success: toastSuccess, error: toastError } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback || _key }),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/utils/betaAccess', () => ({ isBetaClosed: () => true }));
vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));

import { BudgetControlPanel } from '@/components/Execution/BudgetControlPanel';

const summary = {
  initiativeId: 'initiative-1',
  initiativeName: 'One',
  currency: 'PLN',
  planned: { total: 100, capex: 100, opex: 0 },
  actual: { total: 20, capex: 20, opex: 0 },
  variance: { total: 80, percent: 80 },
  burnRate: 20,
  forecast: { total: 20, isOverBudget: false },
  status: 'GREEN' as const,
};
const entry = {
  id: 'entry-1',
  entryType: 'ACTUAL',
  costType: 'CAPEX',
  category: 'Cloud',
  amount: 20,
  currency: 'PLN',
  description: null,
  periodMonth: 8,
  periodYear: 2026,
};

describe('BudgetControlPanel governed delete', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    getSummary.mockResolvedValue({ summary });
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('announces success only after canonical readback no longer contains the entry', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [entry] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [] }) }) as any;
    render(<BudgetControlPanel initiativeId="initiative-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete budget entry' }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Budget entry deleted'));
    expect(screen.queryByText(/Cloud/)).not.toBeInTheDocument();
  });

  it('preserves a governed 409 error and never reports success', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [entry] }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Budget entry changed; refresh first' }),
      }) as any;
    render(<BudgetControlPanel initiativeId="initiative-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete budget entry' }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Budget entry changed; refresh first')
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
