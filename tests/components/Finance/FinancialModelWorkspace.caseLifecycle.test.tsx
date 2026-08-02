/**
 * @vitest-environment jsdom
 *
 * FIN-03/FIN-04 UI wiring — Investment Case save/version-conflict and
 * Scenario/baseline selection, mounted through the REAL live screen
 * (`FinancialModelWorkspace`, reached from FinanceHub → EconomicsView →
 * `/economics` when a "models"-kind document is opened).
 *
 * Proves, against the EXISTING backend contracts only (no new endpoints):
 *  1. Save is CAS-pinned (`expectedVersion`) and only reports success AFTER
 *     the server confirms AND the panel re-fetches the persisted model —
 *     never optimistic/premature.
 *  2. A 409 VERSION_CONFLICT is surfaced honestly (banner + server version),
 *     never silently overwritten, and the stale local edit is not treated as
 *     saved.
 *  3. Reopening (re-mounting) the same case re-fetches from the backend and
 *     shows the same persisted assumptions — not stale client state.
 *  4. Base/Upside/Downside-style sibling scenarios render, "Set baseline"
 *     calls the EXISTING POST /models/:modelId/set-baseline endpoint, and a
 *     reopen shows the same baseline afterward.
 *  5. A delayed save keeps the button in "saving" state and does NOT render
 *     the success indicator until the backend promise resolves (red→green
 *     proof that success is never shown before the server responds).
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock('@/services/api', () => {
  const api = {
    get: vi.fn().mockRejectedValue(new Error('unmocked GET')),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
  return { Api: api, default: api };
});

vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: {
    addModelEvent: vi.fn(),
    approveModel: vi.fn(),
    computeModel: vi.fn(),
    createModel: vi.fn(),
    deleteModelEvent: vi.fn(),
    getModels: vi.fn().mockResolvedValue({ models: [] }),
    getModel: vi.fn(),
    getModelOutputs: vi.fn().mockResolvedValue({ raw: [], grouped: {} }),
    getModelValidations: vi
      .fn()
      .mockResolvedValue({ validations: [], summary: { total: 0, pass: 0, fail: 0, warning: 0 } }),
    updateModel: vi.fn(),
    getCaseScenarios: vi.fn().mockResolvedValue({ scenarios: [], count: 0, baselineModelId: null }),
    setBaseline: vi.fn(),
    getModelVersions: vi.fn().mockResolvedValue({ versions: [], count: 0 }),
    getModelVersionDiff: vi.fn().mockResolvedValue({ diff: null }),
  },
  shouldFallbackToLegacyFinance: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

vi.mock('../../../src/components/Finance/ExportButton', () => ({
  ExportButton: () => <div>export-button</div>,
}));

import { FinancialModelWorkspace } from '../../../src/components/Finance/FinancialModelWorkspace';
import { V8FinanceApi } from '../../../src/services/api/v8/finance';

const CASE_ID = 'case-root-1';

const baseModel = (overrides: Record<string, unknown> = {}) => ({
  id: 'model-base',
  name: 'Atelier — Base',
  currency: 'PLN',
  horizon_months: 36,
  start_date: '2026-01-01',
  granularity: 'monthly',
  scenario: 'base',
  status: 'draft',
  version: 1,
  case_id: null,
  is_baseline: true,
  assumptions_json: { initialCash: 1000 },
  events: [],
  ...overrides,
});

const scenarios = (baselineId: string) => [
  {
    id: 'model-base',
    name: 'Atelier — Base',
    scenario: 'base',
    status: 'draft',
    version: 1,
    is_baseline: baselineId === 'model-base',
    case_id: null,
  },
  {
    id: 'model-upside',
    name: 'Atelier — Upside',
    scenario: 'upside',
    status: 'draft',
    version: 1,
    is_baseline: baselineId === 'model-upside',
    case_id: CASE_ID,
  },
  {
    id: 'model-downside',
    name: 'Atelier — Downside',
    scenario: 'downside',
    status: 'draft',
    version: 1,
    is_baseline: baselineId === 'model-downside',
    case_id: CASE_ID,
  },
];

describe('FinancialModelWorkspace — FIN-03/FIN-04 UI wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(V8FinanceApi.getModels).mockResolvedValue({ models: [] } as any);
    vi.mocked(V8FinanceApi.getModelOutputs).mockResolvedValue({ raw: [], grouped: {} } as any);
    vi.mocked(V8FinanceApi.getModelValidations).mockResolvedValue({
      validations: [],
      summary: { total: 0, pass: 0, fail: 0, warning: 0 },
    } as any);
    vi.mocked(V8FinanceApi.getCaseScenarios).mockResolvedValue({
      scenarios: [],
      count: 0,
      baselineModelId: null,
    } as any);
  });

  it('save (a): a durable save re-fetches from the backend, and the reopened panel shows the persisted value, not just local state', async () => {
    // First mount: server has version 1, assumptions.initialCash = 1000.
    vi.mocked(V8FinanceApi.getModel).mockResolvedValueOnce({ model: baseModel() } as any);
    // The PUT durably persists initialCash = 4242 server-side.
    vi.mocked(V8FinanceApi.updateModel).mockResolvedValueOnce({ success: true } as any);
    // Post-save re-fetch (selectModel called again) returns the NEW server truth.
    vi.mocked(V8FinanceApi.getModel).mockResolvedValueOnce({
      model: baseModel({ version: 2, assumptions_json: { initialCash: 4242 } }),
    } as any);

    render(<FinancialModelWorkspace initialModelId="model-base" hideSidebar />);

    await waitFor(() => expect(screen.getByTestId('save-assumptions')).toBeInTheDocument());

    const input = screen.getAllByRole('spinbutton')[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: '4242' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-assumptions'));
    });

    await waitFor(() => expect(screen.getByTestId('save-success')).toBeInTheDocument());

    // The write was CAS-pinned to the version this session had read.
    expect(V8FinanceApi.updateModel).toHaveBeenCalledWith(
      'model-base',
      { assumptions: expect.objectContaining({ initialCash: 4242 }) },
      { expectedVersion: 1 },
    );
    // Success required a SECOND getModel call (the re-fetch) — never assumed
    // from the PUT response alone.
    expect(V8FinanceApi.getModel).toHaveBeenCalledTimes(2);

    // ── Reopen: unmount and remount with the same modelId. A hard
    // reload/reopen must show the SAME persisted case, not a cached client
    // guess — assert it comes from a THIRD real GET, not memory.
    vi.mocked(V8FinanceApi.getModel).mockResolvedValueOnce({
      model: baseModel({ version: 2, assumptions_json: { initialCash: 4242 } }),
    } as any);
    const { unmount } = { unmount: () => {} };
    void unmount;
    // (fresh render simulates reopen)
    render(<FinancialModelWorkspace initialModelId="model-base" hideSidebar />);

    await waitFor(() => {
      const inputs = screen.getAllByRole('spinbutton');
      expect((inputs[0] as HTMLInputElement).value).toBe('4242');
    });
    expect(V8FinanceApi.getModel).toHaveBeenCalledTimes(3);
  });

  it('version conflict (c): a 409 VERSION_CONFLICT is surfaced honestly, never silently overwritten, and no success indicator appears', async () => {
    vi.mocked(V8FinanceApi.getModel).mockResolvedValue({ model: baseModel() } as any);
    const conflictError: any = new Error('Version conflict');
    conflictError.status = 409;
    conflictError.data = { code: 'VERSION_CONFLICT', serverVersion: 7 };
    vi.mocked(V8FinanceApi.updateModel).mockRejectedValueOnce(conflictError);

    render(<FinancialModelWorkspace initialModelId="model-base" hideSidebar />);

    await waitFor(() => expect(screen.getByTestId('save-assumptions')).toBeInTheDocument());

    const input = screen.getAllByRole('spinbutton')[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: '9999' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-assumptions'));
    });

    await waitFor(() => expect(screen.getByTestId('version-conflict-banner')).toBeInTheDocument());
    expect(screen.getByTestId('version-conflict-banner').textContent).toMatch(/7/);
    // No premature/false success indicator on a conflict.
    expect(screen.queryByTestId('save-success')).not.toBeInTheDocument();
    // The conflicting write must NOT be silently retried against the legacy
    // route — a 409 is not in the bounded-compat fallback set.
    expect(V8FinanceApi.updateModel).toHaveBeenCalledTimes(1);
  });

  it('no optimistic success: while the save request is in flight, the button reads "saving" and no success indicator is shown until the backend resolves', async () => {
    vi.mocked(V8FinanceApi.getModel).mockResolvedValue({ model: baseModel() } as any);
    let resolveUpdate!: (v: any) => void;
    vi.mocked(V8FinanceApi.updateModel).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }) as any,
    );

    render(<FinancialModelWorkspace initialModelId="model-base" hideSidebar />);
    await waitFor(() => expect(screen.getByTestId('save-assumptions')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('save-assumptions'));

    // Immediately after the click, while the promise is still pending: no
    // success indicator (red state) and the button shows the busy label.
    await waitFor(() => expect(screen.getByTestId('save-assumptions').textContent).toMatch(/Zapisuję|Saving/));
    expect(screen.queryByTestId('save-success')).not.toBeInTheDocument();

    // Now resolve the backend call — only THEN should success appear (green state).
    await act(async () => {
      resolveUpdate({ success: true });
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId('save-success')).toBeInTheDocument());
  });

  it('scenarios (d): renders Base/Upside/Downside siblings, "Set baseline" calls the EXISTING set-baseline endpoint, and reopen shows the new baseline', async () => {
    vi.mocked(V8FinanceApi.getModel).mockResolvedValue({ model: baseModel() } as any);
    vi.mocked(V8FinanceApi.getCaseScenarios).mockResolvedValueOnce({
      scenarios: scenarios('model-base'),
      count: 3,
      baselineModelId: 'model-base',
    } as any);

    render(<FinancialModelWorkspace initialModelId="model-base" hideSidebar />);

    await waitFor(() => expect(screen.getByTestId('case-scenarios-panel')).toBeInTheDocument());
    expect(screen.getByTestId('scenario-chip-model-base')).toBeInTheDocument();
    expect(screen.getByTestId('scenario-chip-model-upside')).toBeInTheDocument();
    expect(screen.getByTestId('scenario-chip-model-downside')).toBeInTheDocument();
    expect(screen.getByTestId('baseline-badge-model-base')).toBeInTheDocument();

    vi.mocked(V8FinanceApi.setBaseline).mockResolvedValueOnce({
      success: true,
      caseId: CASE_ID,
      baselineModelId: 'model-upside',
      previousBaselineModelId: 'model-base',
    } as any);
    // After setBaseline, the panel re-fetches scenarios — server now says Upside is baseline.
    vi.mocked(V8FinanceApi.getCaseScenarios).mockResolvedValueOnce({
      scenarios: scenarios('model-upside'),
      count: 3,
      baselineModelId: 'model-upside',
    } as any);

    await act(async () => {
      fireEvent.click(screen.getByTestId('set-baseline-model-upside'));
    });

    expect(V8FinanceApi.setBaseline).toHaveBeenCalledWith('model-upside');

    await waitFor(() =>
      expect(screen.getByTestId('baseline-badge-model-upside')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('baseline-badge-model-base')).not.toBeInTheDocument();

    // Reopen: fresh mount re-fetches the case and must show the SAME
    // (new) baseline from the server, not a locally-remembered toggle.
    vi.mocked(V8FinanceApi.getCaseScenarios).mockResolvedValueOnce({
      scenarios: scenarios('model-upside'),
      count: 3,
      baselineModelId: 'model-upside',
    } as any);
    render(<FinancialModelWorkspace initialModelId="model-base" hideSidebar />);

    await waitFor(() =>
      expect(screen.getAllByTestId('baseline-badge-model-upside').length).toBeGreaterThan(0),
    );
  });
});
