/**
 * @vitest-environment jsdom
 *
 * H2.5 regression: the Finance reconciliation panel must respect each KPI's
 * `unit`. A percentage KPI (e.g. OEE, target 85%) must NOT be formatted as EUR,
 * and — because the realized side sums monetary ROI entries — must not display a
 * fabricated monetary variance. A monetary KPI (€) still formats as currency and
 * shows its variance.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any, opts?: any) => {
      if (typeof fallback === 'string') {
        // crude interpolation for {{count}} used by the mismatch label
        if (opts && typeof opts.count === 'number') {
          return fallback.replace('{{count}}', String(opts.count));
        }
        return fallback;
      }
      return _key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../src/services/api/v8/results', () => ({
  V8ResultsApi: {
    getReconciliationOverview: vi.fn(),
  },
  shouldFallbackToLegacyResults: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { ReconciliationPanel } from '../../../src/components/Results/ReconciliationPanel';
import { V8ResultsApi } from '../../../src/services/api/v8/results';

const overviewWith = (item: any) => ({
  organizationId: 'org-1',
  initiativeId: null,
  items: [item],
  summary: { total: 1, byStatus: {}, mismatchCount: item.hasMismatch ? 1 : 0, unresolvedCount: 0 },
});

describe('ReconciliationPanel unit-aware formatting (H2.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formats a percentage KPI as a percent and shows no fabricated EUR variance', async () => {
    vi.mocked(V8ResultsApi.getReconciliationOverview).mockResolvedValue(
      overviewWith({
        reconciliationId: 'rec-oee',
        kpiId: 'kpi-oee',
        kpiName: 'OEE',
        unit: '%',
        initiativeId: 'init-1',
        financeRef: 'finance:GL-OEE',
        reconciliationStatus: 'pending',
        initiatedBy: 'finance',
        projectedValue: 85,
        realizedValue: null, // backend suppresses non-comparable €-sum
        varianceAbsolute: null,
        variancePercent: null,
        hasMismatch: false,
        createdAt: '2026-03-31T00:00:00.000Z',
        updatedAt: '2026-03-31T00:00:00.000Z',
      }) as any
    );

    render(<ReconciliationPanel />);

    // Projected renders as "85%" (not "€85").
    expect(await screen.findByText('85%')).toBeTruthy();
    expect(screen.queryByText(/€\s*85\b/)).toBeNull();
    // No +162252% style variance and no mismatch badge.
    expect(screen.queryByText(/162252/)).toBeNull();
    expect(screen.queryByText(/mismatch/i)).toBeNull();
  });

  it('formats a monetary KPI as currency and shows its variance', async () => {
    vi.mocked(V8ResultsApi.getReconciliationOverview).mockResolvedValue(
      overviewWith({
        reconciliationId: 'rec-eur',
        kpiId: 'kpi-eur',
        kpiName: 'Annual Savings',
        unit: '€',
        initiativeId: 'init-2',
        financeRef: 'finance:GL-EUR',
        reconciliationStatus: 'disputed',
        initiatedBy: 'finance',
        projectedValue: 100000,
        realizedValue: 80000,
        varianceAbsolute: -20000,
        variancePercent: -20,
        hasMismatch: true,
        createdAt: '2026-03-31T00:00:00.000Z',
        updatedAt: '2026-03-31T00:00:00.000Z',
      }) as any
    );

    render(<ReconciliationPanel />);

    // Currency-formatted values are present (EUR symbol appears).
    await waitFor(() => expect(screen.getByText('Annual Savings')).toBeTruthy());
    expect(screen.getAllByText(/€/).length).toBeGreaterThan(0);
    // Variance percent is surfaced.
    expect(screen.getByText(/-20\.0%/)).toBeTruthy();
  });

  it('formats a days-unit KPI variance as "-4 days", not "-€4" (Variance column unit bug)', async () => {
    vi.mocked(V8ResultsApi.getReconciliationOverview).mockResolvedValue(
      overviewWith({
        reconciliationId: 'rec-days',
        kpiId: 'kpi-days',
        kpiName: 'Cycle time',
        unit: 'days',
        initiativeId: 'init-3',
        financeRef: 'finance:GL-DAYS',
        reconciliationStatus: 'disputed',
        initiatedBy: 'finance',
        projectedValue: 12,
        realizedValue: 8,
        varianceAbsolute: -4,
        variancePercent: -33.3,
        hasMismatch: true,
        createdAt: '2026-03-31T00:00:00.000Z',
        updatedAt: '2026-03-31T00:00:00.000Z',
      }) as any
    );

    render(<ReconciliationPanel />);

    await waitFor(() => expect(screen.getByText('Cycle time')).toBeTruthy());
    // Variance column must render "-4 days", not a EUR-formatted "-€4".
    expect(await screen.findByText('-4 days')).toBeTruthy();
    expect(screen.queryByText(/€/)).toBeNull();
  });
});
