/**
 * @vitest-environment jsdom
 *
 * RES-02 canonical-cutover contract. The legacy KPI drawer is an archive
 * reader. Governed definition writes belong to the canonical KPI registry;
 * the drawer must neither expose a Save action nor call the retired writer.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, value?: any) => typeof value === 'string' ? value : (value?.defaultValue ?? k),
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/hooks/discovery/useOrganizationContext', () => ({ useOrganizationContext: () => ({ formatForPrompt: () => '' }) }));
vi.mock('@/hooks/useOpenChatWithContext', () => ({ useOpenChatWithContext: () => vi.fn() }));

const apiPut = vi.hoisted(() => vi.fn());
vi.mock('@/services/api', () => ({ Api: { get: vi.fn(async () => ({ data: [] })), put: apiPut, delete: vi.fn() } }));
const getKpiCatalog = vi.hoisted(() => vi.fn());
const updateKpi = vi.hoisted(() => vi.fn());
vi.mock('@/services/api/v8/results', () => ({
  V8ResultsApi: {
    getKpiCatalog,
    getKpiDrawerDetail: vi.fn(async () => ({ measurements: [], openCase: null, auditLog: [] })),
    updateKpi,
    deleteKpi: vi.fn(),
  },
  shouldFallbackToLegacyResults: () => false,
}));

import { KPITimeSeriesDrawer } from '../KPITimeSeriesDrawer';

const KPI_FIXTURE = {
  id: 'kpi-1', name: 'Retention rate', description: '', unit: '%', targetValue: 90,
  baselineValue: 50, measurementFrequency: 'MONTHLY', alertDirection: 'BELOW',
  isPrimary: false, sortOrder: 0, isOnTarget: true, createdAt: new Date(0).toISOString(),
  currentDefinitionVersion: 3,
};

describe('KPITimeSeriesDrawer — RES-02 canonical cutover', () => {
  it('keeps the archive definition read-only and exposes only the governed-registry handoff', async () => {
    getKpiCatalog.mockResolvedValue({ kpis: [KPI_FIXTURE], mappings: [] });
    render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={() => {}} initialSection="settings" />);
    await waitFor(() => expect(getKpiCatalog).toHaveBeenCalledTimes(1));

    expect(screen.getAllByRole('textbox').every((field) => field.hasAttribute('disabled'))).toBe(true);
    expect(screen.getByRole('button', { name: /Edit governed definition/i })).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Save$/i })).not.toBeInTheDocument();
    expect(updateKpi).not.toHaveBeenCalled();
    expect(apiPut).not.toHaveBeenCalled();
  });

  it('hands definition editing to the canonical KPI registry without a legacy mutation', async () => {
    getKpiCatalog.mockResolvedValue({ kpis: [KPI_FIXTURE], mappings: [] });
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={() => {}} initialSection="settings" />);
    fireEvent.click(await screen.findByRole('button', { name: /Edit governed definition/i }));

    expect(assign).toHaveBeenCalledWith('/results/kpi');
    expect(updateKpi).not.toHaveBeenCalled();
    expect(apiPut).not.toHaveBeenCalled();
    assign.mockRestore();
  });
});
