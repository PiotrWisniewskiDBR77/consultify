/**
 * @vitest-environment jsdom
 *
 * RES-02 final-fix mounted-component test — the active KPI-edit surface.
 *
 * Traces the real, menu-reachable path: ResultsHub → KPITimeSeriesDrawer →
 * V8ResultsApi.updateKpi → /api/v8/results/kpis/:kpiId → kpiDefinitionService.
 * Confirms two things that were NOT true before this fix round:
 *  1. a save round-trips the version the drawer last read (`expectedVersion`),
 *     so the backend enforces real optimistic concurrency instead of quietly
 *     re-deriving its own version right before writing;
 *  2. a 409 version conflict is never shown as success and reloads the
 *     current server state instead of leaving a stale, silently-lossy form.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, optsOrDefault?: any) =>
      typeof optsOrDefault === 'string' ? optsOrDefault : (optsOrDefault?.defaultValue ?? k),
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), toast),
}));

vi.mock('@/hooks/discovery/useOrganizationContext', () => ({
  useOrganizationContext: () => ({ formatForPrompt: () => '' }),
}));
vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

const apiGet = vi.hoisted(() => vi.fn(async () => ({ data: [] })));
const apiPut = vi.hoisted(() => vi.fn(async () => ({ data: { success: true } })));
vi.mock('@/services/api', () => ({
  Api: { get: apiGet, put: apiPut, delete: vi.fn(async () => ({ data: { success: true } })) },
}));

const getKpiCatalog = vi.hoisted(() => vi.fn());
const getKpiDrawerDetail = vi.hoisted(() =>
  vi.fn(async () => ({ measurements: [], openCase: null, auditLog: [] }))
);
const updateKpi = vi.hoisted(() => vi.fn());

vi.mock('@/services/api/v8/results', () => ({
  V8ResultsApi: {
    getKpiCatalog,
    getKpiDrawerDetail,
    updateKpi,
    deleteKpi: vi.fn(),
  },
  // Real behavior: 409 is never a fallback-worthy status — a version conflict
  // must surface, not be silently retried against the legacy router.
  shouldFallbackToLegacyResults: (error: any) =>
    [400, 404, 405, 501].includes(Number(error?.status)),
}));

import { KPITimeSeriesDrawer } from '../KPITimeSeriesDrawer';

const KPI_FIXTURE = {
  id: 'kpi-1',
  name: 'Retention rate',
  description: '',
  unit: '%',
  targetValue: 90,
  baselineValue: 50,
  measurementFrequency: 'MONTHLY',
  alertDirection: 'BELOW',
  isPrimary: false,
  sortOrder: 0,
  isOnTarget: true,
  createdAt: new Date(0).toISOString(),
  // The version this render last saw — must be the exact value round-tripped
  // back as `expectedVersion` on save.
  currentDefinitionVersion: 3,
};

const mountDrawer = () =>
  render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={() => {}} initialSection="settings" />);

const enterEditModeAndSave = async () => {
  const editButton = await screen.findByRole('button', { name: /Edit/i });
  fireEvent.click(editButton);
  const saveButton = await screen.findByRole('button', { name: /Save/i });
  fireEvent.click(saveButton);
};

describe('KPITimeSeriesDrawer — RES-02 active edit path (mounted)', () => {
  it('sends the client-held currentDefinitionVersion as expectedVersion on save, then reloads the catalog', async () => {
    getKpiCatalog.mockResolvedValue({ kpis: [KPI_FIXTURE], mappings: [] });
    updateKpi.mockResolvedValue({ success: true, currentDefinitionVersion: 4 });

    mountDrawer();
    await waitFor(() => expect(getKpiCatalog).toHaveBeenCalledTimes(1));
    await enterEditModeAndSave();

    await waitFor(() => expect(updateKpi).toHaveBeenCalledTimes(1));
    expect(updateKpi).toHaveBeenCalledWith(
      'kpi-1',
      expect.objectContaining({ expectedVersion: 3 })
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
    // A successful save is followed by a fresh read, not a locally-patched
    // stale object — the drawer's next render reflects what the server has.
    await waitFor(() => expect(getKpiCatalog).toHaveBeenCalledTimes(2));
  });

  it('never shows success on a 409 version conflict, and reloads the current definition', async () => {
    getKpiCatalog.mockResolvedValue({ kpis: [KPI_FIXTURE], mappings: [] });
    const conflictError: any = new Error('KPI definition changed concurrently; reload and retry');
    conflictError.status = 409;
    conflictError.data = { code: 'RESULTS_KPI_VERSION_CONFLICT' };
    updateKpi.mockRejectedValueOnce(conflictError);

    mountDrawer();
    await waitFor(() => expect(getKpiCatalog).toHaveBeenCalledTimes(1));
    await enterEditModeAndSave();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    // No false success: the "saved" toast must never fire for a rejected write.
    expect(toast.success).not.toHaveBeenCalled();
    // A stale client must not silently overwrite — and it must not silently
    // fall back to the legacy router either (409 is not a fallback status).
    expect(apiPut).not.toHaveBeenCalled();
    // Reload: the drawer re-reads the current server state after a conflict.
    await waitFor(() => expect(getKpiCatalog).toHaveBeenCalledTimes(2));
    // Edit mode is exited rather than left pointed at stale, about-to-conflict-again data.
    await screen.findByRole('button', { name: /Edit/i });
  });
});
