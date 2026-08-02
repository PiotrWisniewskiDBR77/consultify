/**
 * @vitest-environment jsdom
 *
 * FIN-005 — sibling of `CreateValuationModal.source-currency.test.tsx`.
 *
 * `CreateAnalysisModal` reads its currency (payload) and its input LABELS
 * (`Initial investment ({{currency}})`, `Annual benefits ({{currency}}/yr)`)
 * from the selected statement pack. Unlike the valuation modal it already
 * derives `selectedStatementPack` / `inputCurrency` in RENDER scope
 * (`useMemo` over the `availableStatements` prop) and keeps
 * `selectedStatementPack` in the submit callback's dependency list, so it has
 * no stale-closure defect today.
 *
 * These tests exist to keep it that way. `availableStatements` is a prop fed by
 * an async parent fetch in `FinanceHub`, so the pack is routinely absent on the
 * first render — the same ordering that broke the valuation modal. Moving the
 * lookup back inside the callback, or dropping `selectedStatementPack` from the
 * dependency list, turns the first case red.
 *
 * Note the stable `t` identity in the i18n mock: a mock that returns a fresh
 * arrow per render invalidates every `useCallback` on every render and makes
 * stale-closure defects structurally untestable.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => {
  const interpolate = (template: string, values?: Record<string, unknown>) =>
    template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
      values && key in values ? String(values[key]) : match
    );
  const t = (_key: string, fallback?: any, options?: Record<string, unknown>) => {
    if (typeof fallback === 'string') return interpolate(fallback, options);
    return fallback?.defaultValue ?? _key;
  };
  const i18n = { language: 'en' };
  return { useTranslation: () => ({ t, i18n }) };
});

vi.mock('@/services/api', () => ({
  Api: {
    post: vi.fn(),
  },
}));

vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: {
    createAnalysis: vi.fn(),
  },
  shouldFallbackToLegacyFinance: (error: any) =>
    [400, 404, 405, 501].includes(Number(error?.status)),
}));

import { CreateAnalysisModal } from '@/components/Economics/modals/CreateAnalysisModal';
import { V8FinanceApi } from '@/services/api/v8/finance';

const EUR_PACK = {
  id: 'pack-atelier-fy2014',
  entityName: 'Atelier Toys',
  title: 'Atelier Toys — FY2014',
  currency: 'EUR',
  periodLabel: 'FY2014',
  completenessLabel: 'P&L / BS / CF',
  statementIds: ['statement-pl', 'statement-bs', 'statement-cf'],
} as any;

describe('CreateAnalysisModal — currency follows the selected statement pack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(V8FinanceApi.createAnalysis).mockResolvedValue({
      analysis: {
        id: 'analysis-1',
        title: 'Atelier investment case',
        status: 'DRAFT',
        analysisType: 'investment_case',
        currency: 'EUR',
        periods: [],
        updated_at: '2026-08-01T00:00:00.000Z',
      },
    } as any);
  });

  it('sends EUR when the pack list arrives after mount and the pack was pre-seeded', async () => {
    const props = {
      onCreated: vi.fn(),
      onClose: vi.fn(),
      defaultAnalysisType: 'investment_case',
      initialStatementPackId: EUR_PACK.id,
      initialTitle: 'Atelier investment case',
    };

    // First render: the parent fetch has not resolved, so the pack the modal was
    // pre-seeded with is not in the list yet.
    const { rerender } = render(<CreateAnalysisModal {...props} availableStatements={[]} />);
    expect(screen.getByText('No statements available')).toBeTruthy();

    // The pack arrives. Nothing the user does changes any other input.
    rerender(<CreateAnalysisModal {...props} availableStatements={[EUR_PACK]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(V8FinanceApi.createAnalysis).toHaveBeenCalled());
    expect(vi.mocked(V8FinanceApi.createAnalysis).mock.calls[0]![0]).toMatchObject({
      currency: 'EUR',
      sourceStatementPackId: EUR_PACK.id,
    });
  });

  it('relabels the investment inputs in the pack currency once the pack arrives', () => {
    const props = {
      onCreated: vi.fn(),
      onClose: vi.fn(),
      defaultAnalysisType: 'investment_case',
      initialStatementPackId: EUR_PACK.id,
      initialTitle: 'Atelier investment case',
    };

    const { rerender } = render(<CreateAnalysisModal {...props} availableStatements={[]} />);
    expect(screen.getByText('Initial investment (PLN)')).toBeTruthy();

    rerender(<CreateAnalysisModal {...props} availableStatements={[EUR_PACK]} />);

    // Label and payload must name the same currency — the whole point of the
    // FIN-005 change to this file.
    expect(screen.getByText('Initial investment (EUR)')).toBeTruthy();
    expect(screen.getByText('Annual benefits (EUR/yr)')).toBeTruthy();
  });

  it('sends EUR when the user picks the pack manually after it arrives', async () => {
    render(
      <CreateAnalysisModal
        onCreated={vi.fn()}
        onClose={vi.fn()}
        availableStatements={[EUR_PACK]}
        initialTitle="Atelier baseline analysis"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Atelier Toys/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(V8FinanceApi.createAnalysis).toHaveBeenCalled());
    expect(vi.mocked(V8FinanceApi.createAnalysis).mock.calls[0]![0]).toMatchObject({
      currency: 'EUR',
      sourceStatementPackId: EUR_PACK.id,
    });
  });

  it('falls back to PLN when the selected pack carries no currency', async () => {
    const pack = { ...EUR_PACK, currency: undefined };

    render(
      <CreateAnalysisModal
        onCreated={vi.fn()}
        onClose={vi.fn()}
        availableStatements={[pack]}
        initialStatementPackId={pack.id}
        initialTitle="Pack without currency"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(V8FinanceApi.createAnalysis).toHaveBeenCalled());
    expect(vi.mocked(V8FinanceApi.createAnalysis).mock.calls[0]![0]).toMatchObject({
      currency: 'PLN',
    });
  });
});
