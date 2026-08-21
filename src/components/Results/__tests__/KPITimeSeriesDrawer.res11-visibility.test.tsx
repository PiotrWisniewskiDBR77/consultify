/**
 * @vitest-environment jsdom
 *
 * RES-11 canonical-cutover contract for visibility. The archive drawer may
 * display governed visibility, but it must not mutate it.
 */
import { render, screen, waitFor } from '@testing-library/react';
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

const fixture = (visibility: 'org_visible' | 'initiative_restricted' | 'private_to_owner') => ({
  id: 'kpi-1', name: 'Retention rate', description: '', unit: '%', targetValue: 90,
  baselineValue: 50, measurementFrequency: 'MONTHLY', alertDirection: 'BELOW',
  isPrimary: false, sortOrder: 0, isOnTarget: true, createdAt: new Date(0).toISOString(),
  currentDefinitionVersion: 3, visibility,
});

describe('KPITimeSeriesDrawer — RES-11 governed visibility boundary', () => {
  it('renders archive visibility as read-only and never calls a legacy writer', async () => {
    getKpiCatalog.mockResolvedValue({ kpis: [fixture('private_to_owner')], mappings: [] });
    render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={() => {}} initialSection="settings" />);
    await waitFor(() => expect(getKpiCatalog).toHaveBeenCalled());

    const select = screen.getByRole('combobox', { name: /Visibility/i });
    expect(select).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Save$/i })).not.toBeInTheDocument();
    expect(updateKpi).not.toHaveBeenCalled();
    expect(apiPut).not.toHaveBeenCalled();
  });
});
