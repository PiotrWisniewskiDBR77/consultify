/**
 * @vitest-environment jsdom
 *
 * FIN-005 — the valuation must be denominated in the currency of the source it
 * is derived from.
 *
 * `CreateValuationModal` stopped hardcoding `'PLN'` and started reading the
 * currency off the selected source row. The lookup reads `sources`, which is
 * filled by an async fetch AFTER the first render. The submit callback is a
 * `useCallback`; if `sources` is missing from its dependency list the callback
 * that survives from the first render closes over the EMPTY `sources` object,
 * `find()` returns `undefined`, and the payload silently falls back to `'PLN'`
 * — i.e. exactly the bug the change was written to remove, only now invisible
 * because the code READS like it inherits the currency.
 *
 * The decisive case is the one the Finance UI actually produces: `FinanceHub`
 * renders this modal with `initialSourceType` / `initialSourceId` / `initialTitle`
 * already filled in (`FinanceHub.tsx:3611-3616`, "create a valuation from THIS
 * model"). Nothing in the dependency list then ever changes between mount and
 * submit, so the stale first-render callback is the one that runs.
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

/**
 * The `t` identity MUST be stable across renders. Real `react-i18next` keeps
 * one `getFixedT` instance in state and only replaces it when the language or
 * namespace changes, so `t` is a stable `useCallback` dependency in production.
 * A mock that returns a fresh arrow on every render silently invalidates the
 * memo on every render and would make any stale-closure defect untestable.
 */
vi.mock('react-i18next', () => {
  const t = (_key: string, fallback?: any) =>
    typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key);
  const i18n = { language: 'en' };
  return { useTranslation: () => ({ t, i18n }) };
});

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));
vi.mock('@/services/api/financeV2.api', () => ({
  createRegisteredValuation: vi.fn(),
}));

import { CreateValuationModal } from '@/components/Economics/modals/CreateValuationModal';
import { Api } from '@/services/api';
import { createRegisteredValuation } from '@/services/api/financeV2.api';

const EUR_MODEL = {
  id: 'model-atelier-roi',
  name: 'Atelier Toys — Transformation 2015 ROI',
  currency: 'EUR',
};

const EUR_ANALYSIS = {
  id: 'analysis-atelier-fy2014',
  title: 'Atelier Toys — FY2014 Baseline Financial Analysis',
  currency: 'EUR',
};

/**
 * A deferred `Api.get` so the test controls the exact moment the sources land.
 * The modal MUST be rendered while the list is still empty — resolving before
 * render would hide the stale-closure defect entirely.
 */
function deferredSources() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.mocked(Api.get).mockImplementation(async () => {
    await gate;
    return {
      sources: {
        budgets: [],
        financialModels: [EUR_MODEL],
        financialAnalyses: [EUR_ANALYSIS],
      },
    } as any;
  });
  return release;
}

function postedBody(): Record<string, unknown> {
  const call = vi.mocked(createRegisteredValuation).mock.calls[0];
  expect(call, 'canonical valuation registration was never issued').toBeTruthy();
  return call![0] as Record<string, unknown>;
}

describe('CreateValuationModal — currency is inherited from the selected source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createRegisteredValuation).mockResolvedValue({
      id: 'valuation-1',
      artifactId: 'artifact-1',
      businessVersionId: 'version-1',
      workingRevisionId: 'revision-1',
      replay: false,
    } as any);
  });

  it('inherits EUR when the modal is pre-seeded with a source and the fetch resolves after mount', async () => {
    const release = deferredSources();

    // Rendered BEFORE the sources fetch resolves — this is the real ordering:
    // FinanceHub mounts the modal, the fetch is still in flight.
    render(
      <CreateValuationModal
        initialSourceType="financial_model"
        initialSourceId={EUR_MODEL.id}
        initialTitle="Atelier valuation"
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />
    );

    // The source arrives afterwards.
    release();
    await screen.findByRole('option', { name: EUR_MODEL.name });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(createRegisteredValuation).toHaveBeenCalled());
    expect(postedBody()).toMatchObject({
      sourceId: EUR_MODEL.id,
      currency: 'EUR',
    });
  });

  it('inherits EUR when the user picks the source manually after the fetch resolves', async () => {
    const release = deferredSources();

    render(
      <CreateValuationModal
        initialTitle="Atelier valuation"
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />
    );

    release();
    await waitFor(() => expect(Api.get).toHaveBeenCalled());

    const [sourceTypeSelect] = screen.getAllByRole('combobox');
    fireEvent.change(sourceTypeSelect, { target: { value: 'financial_analysis' } });

    const analysisOption = await screen.findByRole('option', { name: EUR_ANALYSIS.title });
    const sourceSelect = analysisOption.closest('select') as HTMLSelectElement;
    fireEvent.change(sourceSelect, { target: { value: EUR_ANALYSIS.id } });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(createRegisteredValuation).toHaveBeenCalled());
    expect(postedBody()).toMatchObject({
      sourceType: 'financial_analysis',
      sourceId: EUR_ANALYSIS.id,
      currency: 'EUR',
    });
  });

  it('keeps PLN for a manual valuation, which has no source to inherit from', async () => {
    const release = deferredSources();

    render(<CreateValuationModal initialTitle="Manual" onCreated={vi.fn()} onClose={vi.fn()} />);

    release();
    await waitFor(() => expect(Api.get).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(createRegisteredValuation).toHaveBeenCalled());
    expect(postedBody()).toMatchObject({
      sourceType: 'manual',
      sourceId: null,
      currency: 'PLN',
    });
  });

  it('falls back to PLN when the source itself carries no currency', async () => {
    vi.mocked(Api.get).mockResolvedValue({
      sources: {
        budgets: [{ id: 'budget-1', title: 'Budget without currency' }],
        financialModels: [],
        financialAnalyses: [],
      },
    } as any);

    render(
      <CreateValuationModal
        initialSourceType="budget"
        initialSourceId="budget-1"
        initialTitle="Budget valuation"
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await screen.findByRole('option', { name: 'Budget without currency' });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(createRegisteredValuation).toHaveBeenCalled());
    expect(postedBody()).toMatchObject({ currency: 'PLN' });
  });
});
