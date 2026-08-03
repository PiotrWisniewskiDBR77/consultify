/**
 * @vitest-environment jsdom
 *
 * RES-11 mounted-component test — the active KPI-edit surface (visibility
 * write path). CTO correction: the earlier evidence suite proved visibility
 * is FILTERED (kpiVisibility.res11.pg.test.ts) but seeded the value directly
 * in the DB — there was no proof of an active product path that WRITES it.
 * This is that proof, mounting the real React component (not an Express
 * router — see kpiVisibility.res11.pg.test.ts's item 9 for the HTTP-route
 * counterpart), mirroring KPITimeSeriesDrawer.res02.smoke.test.tsx's
 * conventions exactly.
 *
 * Traces: ResultsHub → KPITimeSeriesDrawer → V8ResultsApi.updateKpi →
 * PUT /api/v8/results/kpis/:kpiId → kpiDefinitionService (see
 * kpiDefinitionService.ts / v8/results.routes.ts, previous commit).
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
  shouldFallbackToLegacyResults: (error: any) =>
    [400, 404, 405, 501].includes(Number(error?.status)),
}));

import { KPITimeSeriesDrawer } from '../KPITimeSeriesDrawer';

function kpiFixture(visibility: 'org_visible' | 'initiative_restricted' | 'private_to_owner') {
  return {
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
    currentDefinitionVersion: 3,
    visibility,
  };
}

const mountDrawer = () =>
  render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={() => {}} initialSection="settings" />);

const enterEditMode = async () => {
  const editButton = await screen.findByRole('button', { name: /Edit/i });
  fireEvent.click(editButton);
};

/** Deferred promise — lets a test control exactly when the API "confirms". */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('KPITimeSeriesDrawer — RES-11 visibility write path (mounted)', () => {
  it('a) saves visibility through the active API (V8ResultsApi.updateKpi, the real product path)', async () => {
    getKpiCatalog.mockResolvedValue({ kpis: [kpiFixture('org_visible')], mappings: [] });
    updateKpi.mockResolvedValue({ success: true, currentDefinitionVersion: 4 });

    mountDrawer();
    await waitFor(() => expect(getKpiCatalog).toHaveBeenCalledTimes(1));
    await enterEditMode();

    const visibilitySelect = await screen.findByRole('combobox', { name: /Visibility/i });
    fireEvent.change(visibilitySelect, { target: { value: 'private_to_owner' } });
    fireEvent.click(await screen.findByRole('button', { name: /Save/i }));

    await waitFor(() => expect(updateKpi).toHaveBeenCalledTimes(1));
    expect(updateKpi).toHaveBeenCalledWith(
      'kpi-1',
      expect.objectContaining({ visibility: 'private_to_owner' })
    );
  });

  it('b) never shows success before the write is actually confirmed by the API', async () => {
    getKpiCatalog.mockResolvedValue({ kpis: [kpiFixture('org_visible')], mappings: [] });
    const write = deferred<{ success: boolean; currentDefinitionVersion: number }>();
    updateKpi.mockReturnValue(write.promise);

    mountDrawer();
    await waitFor(() => expect(getKpiCatalog).toHaveBeenCalledTimes(1));
    await enterEditMode();

    const visibilitySelect = await screen.findByRole('combobox', { name: /Visibility/i });
    fireEvent.change(visibilitySelect, { target: { value: 'private_to_owner' } });
    fireEvent.click(await screen.findByRole('button', { name: /Save/i }));

    await waitFor(() => expect(updateKpi).toHaveBeenCalledTimes(1));
    // The request is in flight — the API has not resolved yet. No success
    // signal may appear before confirmation, and edit mode must still be
    // active (a premature "saved" state would exit edit mode too).
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: /Visibility/i })).not.toBeDisabled();

    write.resolve({ success: true, currentDefinitionVersion: 4 });

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('c) after a fresh reopen (re-read from the API), the saved visibility is retained', async () => {
    // First mount: server still has the OLD value.
    getKpiCatalog.mockResolvedValueOnce({ kpis: [kpiFixture('org_visible')], mappings: [] });
    updateKpi.mockResolvedValue({ success: true, currentDefinitionVersion: 4 });

    const firstMount = mountDrawer();
    await waitFor(() => expect(getKpiCatalog).toHaveBeenCalledTimes(1));
    await enterEditMode();

    const visibilitySelect = await screen.findByRole('combobox', { name: /Visibility/i });
    fireEvent.change(visibilitySelect, { target: { value: 'private_to_owner' } });

    // Reopen/refetch after save must read the NEW persisted value, not an
    // echo of what the client just sent — arm the next getKpiCatalog call
    // (the save's own post-write refetch) with the server's real new state.
    getKpiCatalog.mockResolvedValueOnce({
      kpis: [kpiFixture('private_to_owner')],
      mappings: [],
    });
    fireEvent.click(await screen.findByRole('button', { name: /Save/i }));

    await waitFor(() => expect(getKpiCatalog).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    // A THIRD, fully independent "reopen" — unmount and mount fresh, reading
    // from the server again — must still show the persisted value, not
    // whatever local state the first instance happened to hold.
    firstMount.unmount();
    getKpiCatalog.mockResolvedValueOnce({
      kpis: [kpiFixture('private_to_owner')],
      mappings: [],
    });
    mountDrawer();
    await waitFor(() => expect(getKpiCatalog).toHaveBeenCalledTimes(3));
    await enterEditMode();
    const reopenedSelect = await screen.findByRole('combobox', { name: /Visibility/i });
    expect(reopenedSelect).toHaveValue('private_to_owner');
  });
});
