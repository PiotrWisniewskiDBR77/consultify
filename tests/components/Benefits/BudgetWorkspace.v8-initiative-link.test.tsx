import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { linkBudgetInitiative, unlinkBudgetInitiative } = vi.hoisted(() => ({
  linkBudgetInitiative: vi.fn(),
  unlinkBudgetInitiative: vi.fn(),
}));
vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: { linkBudgetInitiative, unlinkBudgetInitiative },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: any) =>
      typeof fallback === 'string' ? fallback : fallback?.defaultValue || key,
    i18n: { language: 'en' },
  }),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../src/services/api', () => ({
  API_URL: '/api',
  getHeaders: () => ({ Authorization: 'test' }),
}));
vi.mock('../../../src/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));
import { BudgetWorkspace } from '../../../src/components/Benefits/BudgetWorkspace';
const json = (body: unknown) => Promise.resolve({ ok: true, json: async () => body }) as any;

describe('BudgetWorkspace canonical initiative link handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let id = 0;
    vi.stubGlobal('crypto', { randomUUID: () => `intent-${++id}` });
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/economics/budgets'))
          return json({
            budgets: [
              {
                id: 'budget-1',
                title: 'FY27',
                status: 'DRAFT',
                periodStart: '2027-01',
                periodEnd: '2027-12',
                granularity: 'monthly',
                currency: 'PLN',
                version: 1,
                createdAt: '',
              },
            ],
          });
        if (url.endsWith('/economics/budgets/budget-1'))
          return json({ version: 2, status: 'DRAFT', lines: [], scenarios: [] });
        if (url.endsWith('/economics/budgets/budget-1/initiatives'))
          return json({ initiatives: [] });
        if (url.endsWith('/initiatives'))
          return json({
            initiatives: [
              { id: 'initiative-1', title: 'Growth A', status: 'DRAFT', priority: 'HIGH' },
              { id: 'initiative-2', title: 'Growth B', status: 'DRAFT', priority: 'HIGH' },
            ],
          });
        return json({});
      })
    );
  });
  async function openLink() {
    render(<BudgetWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: /FY27/ }));
    fireEvent.click(await screen.findByRole('tab', { name: /Initiatives/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Link Initiative' }));
    return screen.findByRole('button', { name: /Growth A/ });
  }
  it('applies returned version after a rendered successful link', async () => {
    linkBudgetInitiative.mockResolvedValue({ budgetVersion: 3, replay: false });
    fireEvent.click(await openLink());
    await waitFor(() =>
      expect(linkBudgetInitiative).toHaveBeenCalledWith(
        'budget-1',
        'initiative-1',
        2,
        expect.stringMatching(/^intent-/)
      )
    );
    await screen.findByText(/PLN · v3/);
  });
  it('retries response loss with the exact original key and expectedVersion', async () => {
    linkBudgetInitiative
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce({ budgetVersion: 3, replay: true });
    fireEvent.click(await openLink());
    await waitFor(() => expect(linkBudgetInitiative).toHaveBeenCalledTimes(1));
    const first = [...linkBudgetInitiative.mock.calls[0]];
    fireEvent.click(screen.getByRole('button', { name: /Growth A/ }));
    await waitFor(() => expect(linkBudgetInitiative).toHaveBeenCalledTimes(2));
    expect(linkBudgetInitiative.mock.calls[1]).toEqual(first);
  });
  it('mints a different key for B after ambiguous A while a later A retry keeps A tuple', async () => {
    linkBudgetInitiative
      .mockRejectedValueOnce(new Error('A response lost'))
      .mockRejectedValueOnce(new Error('B response lost'))
      .mockResolvedValueOnce({ budgetVersion: 3, replay: true });
    fireEvent.click(await openLink());
    await waitFor(() => expect(linkBudgetInitiative).toHaveBeenCalledTimes(1));
    const firstA = [...linkBudgetInitiative.mock.calls[0]];
    fireEvent.click(screen.getByRole('button', { name: /Growth B/ }));
    await waitFor(() => expect(linkBudgetInitiative).toHaveBeenCalledTimes(2));
    const callB = linkBudgetInitiative.mock.calls[1];
    expect(callB[1]).toBe('initiative-2');
    expect(callB[3]).not.toBe(firstA[3]);
    fireEvent.click(screen.getByRole('button', { name: /Growth A/ }));
    await waitFor(() => expect(linkBudgetInitiative).toHaveBeenCalledTimes(3));
    expect(linkBudgetInitiative.mock.calls[2]).toEqual(firstA);
  });
  it('retries unlink response loss with the exact original key and expectedVersion', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/economics/budgets'))
          return json({
            budgets: [
              {
                id: 'budget-1',
                title: 'FY27',
                status: 'DRAFT',
                periodStart: '2027-01',
                periodEnd: '2027-12',
                granularity: 'monthly',
                currency: 'PLN',
                version: 1,
                createdAt: '',
              },
            ],
          });
        if (url.endsWith('/economics/budgets/budget-1'))
          return json({ version: 2, status: 'DRAFT', lines: [], scenarios: [] });
        if (url.endsWith('/economics/budgets/budget-1/initiatives'))
          return json({
            initiatives: [
              {
                id: 'initiative-1',
                title: 'Growth linked',
                status: 'DRAFT',
                revenueUplift: 0,
                costSavings: 0,
                capexRequired: 0,
              },
            ],
          });
        return json({});
      })
    );
    unlinkBudgetInitiative
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce({ budgetVersion: 3, replay: true });
    render(<BudgetWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: /FY27/ }));
    fireEvent.click(await screen.findByRole('tab', { name: /Initiatives/ }));
    fireEvent.click(await screen.findByTitle('Unlink'));
    await waitFor(() => expect(unlinkBudgetInitiative).toHaveBeenCalledTimes(1));
    const first = [...unlinkBudgetInitiative.mock.calls[0]];
    fireEvent.click(await screen.findByTitle('Unlink'));
    await waitFor(() => expect(unlinkBudgetInitiative).toHaveBeenCalledTimes(2));
    expect(unlinkBudgetInitiative.mock.calls[1]).toEqual(first);
    expect(first.slice(0, 3)).toEqual(['budget-1', 'initiative-1', 2]);
    await screen.findByText(/PLN · v3/);
  });
});
