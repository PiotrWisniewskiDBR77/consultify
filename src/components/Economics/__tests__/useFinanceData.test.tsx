/**
 * @vitest-environment jsdom
 *
 * Tests for useFinanceData — the Finance module data loader/normalizer.
 *
 * Focus (PLAN_08b P0-A / P1-B):
 *   - Model summary columns are DERIVED from real DB fields, never hardcoded:
 *       * variantLabel  ← model.scenario (base / optimistic / conservative)
 *       * analyticalDepthLabel ← model.event_count (L1 / L2 / L3)
 *       * forecastWindowLabel ← start_date + ceil(horizon_months / 12)
 *   - The legacy fallback path is taken when V8 rejects with a fallback-class error.
 *
 * The global react-i18next mock (tests/setup.ts) returns the fallback string
 * passed as the second arg to t(), so the asserted labels are the EN fallbacks.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FinanceModelRow } from '../financeTypes';
import { useFinanceData } from '../hooks/useFinanceData';

// --- Mock the V8 finance API ------------------------------------------------
const getModels = vi.fn();
const getStatementPacks = vi.fn();
const getAnalyses = vi.fn();
const getDashboard = vi.fn();

vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: {
    getModels: () => getModels(),
    getStatementPacks: () => getStatementPacks(),
    getAnalyses: () => getAnalyses(),
    getDashboard: () => getDashboard(),
  },
  // Only treat our sentinel error as a fallback-class error.
  shouldFallbackToLegacyFinance: (error: any) => error?.__fallback === true,
}));

// --- Mock the legacy Api + demo flag ---------------------------------------
const apiGet = vi.fn();

vi.mock('@/services/api', () => ({
  Api: { get: (url: string) => apiGet(url) },
  shouldAllowDemoData: () => false,
}));

function makeModel(overrides: Record<string, unknown> = {}) {
  return {
    id: 'model-1',
    name: 'Transformation 2015 ROI',
    scenario: 'base',
    currency: 'PLN',
    horizon_months: 36,
    start_date: '2015-01-01',
    event_count: 0,
    status: 'approved',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getStatementPacks.mockResolvedValue({ statementPacks: [] });
  getAnalyses.mockResolvedValue({ analyses: [] });
  getDashboard.mockResolvedValue({ dashboard: {} });
});

afterEach(() => {
  vi.clearAllMocks();
});

async function loadModelRows(model: Record<string, unknown>): Promise<FinanceModelRow[]> {
  getModels.mockResolvedValue({ models: [model] });
  const { result } = renderHook(() => useFinanceData('models', '', []));
  await waitFor(() => {
    expect(result.current.models.length).toBe(1);
  });
  return result.current.rowsForActiveTab as FinanceModelRow[];
}

describe('useFinanceData — derived model labels (un-hardcoded)', () => {
  it('does NOT render the old hardcoded variant/depth placeholder strings', async () => {
    const rows = await loadModelRows(makeModel({ scenario: 'base', event_count: 0 }));
    const row = rows[0];
    expect(row.variantLabel).not.toBe('base / optimistic / conservative');
    expect(row.analyticalDepthLabel).not.toBe('L1-L3');
  });

  it('derives variantLabel from the real model.scenario field', async () => {
    expect((await loadModelRows(makeModel({ scenario: 'base' })))[0].variantLabel).toBe('Base');
    expect((await loadModelRows(makeModel({ scenario: 'optimistic' })))[0].variantLabel).toBe(
      'Optimistic'
    );
    expect((await loadModelRows(makeModel({ scenario: 'conservative' })))[0].variantLabel).toBe(
      'Conservative'
    );
  });

  it('falls back to the raw scenario value for unknown scenarios', async () => {
    const rows = await loadModelRows(makeModel({ scenario: 'stress' }));
    expect(rows[0].variantLabel).toBe('stress');
  });

  it('derives analyticalDepthLabel from the event_count (L1/L2/L3)', async () => {
    expect((await loadModelRows(makeModel({ event_count: 0 })))[0].analyticalDepthLabel).toBe(
      'L1 (light)'
    );
    expect((await loadModelRows(makeModel({ event_count: 5 })))[0].analyticalDepthLabel).toBe(
      'L2 (standard)'
    );
    expect((await loadModelRows(makeModel({ event_count: 12 })))[0].analyticalDepthLabel).toBe(
      'L3 (deep)'
    );
  });

  it('derives forecastWindowLabel from start_date + ceil(horizon_months / 12)', async () => {
    const rows = await loadModelRows(makeModel({ start_date: '2015-03-01', horizon_months: 36 }));
    expect(rows[0].forecastWindowLabel).toBe('2015-2018');
  });

  it('falls back to a 2-year window when horizon_months is 0', async () => {
    const rows = await loadModelRows(makeModel({ start_date: '2015-01-01', horizon_months: 0 }));
    expect(rows[0].forecastWindowLabel).toBe('2015-2017');
  });
});

describe('useFinanceData — V8 / legacy fallback', () => {
  it('falls back to the legacy models endpoint when V8 raises a fallback-class error', async () => {
    getModels.mockRejectedValue({ __fallback: true });
    apiGet.mockImplementation((url: string) =>
      url.includes('/financial-modeling/models')
        ? Promise.resolve([makeModel({ scenario: 'optimistic', event_count: 7 })])
        : Promise.resolve([])
    );

    const { result } = renderHook(() => useFinanceData('models', '', []));
    await waitFor(() => {
      expect(result.current.models.length).toBe(1);
    });

    expect(apiGet).toHaveBeenCalledWith('/api/financial-modeling/models');
    const row = result.current.rowsForActiveTab[0] as FinanceModelRow;
    expect(row.variantLabel).toBe('Optimistic');
    expect(row.analyticalDepthLabel).toBe('L2 (standard)');
  });

  it('does NOT fall back for non-fallback errors (data stays empty)', async () => {
    getModels.mockRejectedValue({ __fallback: false });

    const { result } = renderHook(() => useFinanceData('models', '', []));
    await waitFor(() => {
      expect(result.current.loadingTab).toBeNull();
    });

    // The legacy models endpoint must never be hit for a non-fallback error,
    // and the models list stays empty (the error is surfaced via loadError).
    expect(apiGet).not.toHaveBeenCalledWith('/api/financial-modeling/models');
    expect(result.current.models.length).toBe(0);
  });
});
