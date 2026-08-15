/**
 * @vitest-environment jsdom
 *
 * USPOJNIENIE E1/E2 — panel obserwowalności konsumuje endpointy lineage + funnel
 * i renderuje je (luka „obserwowalność bez UI" domknięta).
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// i18n — t(key, default, opts) zwraca default z interpolacją {{count}}.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, def?: string, opts?: { count?: number }) => {
      let s = def ?? _key;
      if (opts && typeof opts.count === 'number') s = s.replace('{{count}}', String(opts.count));
      return s;
    },
  }),
}));

// EntityStatusChip — uprość do widocznego tekstu statusu.
vi.mock('@/components/ui/primitives/chips/EntityStatusChip', () => ({
  EntityStatusChip: ({ status }: { status: string }) => <span>chip:{status}</span>,
}));

const getFunnelStats = vi.fn();
const getInitiatives = vi.fn();
const getLineage = vi.fn();
vi.mock('@/services/api/initiatives.api', () => ({
  InitiativeApi: {
    getFunnelStats: (...a: unknown[]) => getFunnelStats(...a),
    getInitiatives: (...a: unknown[]) => getInitiatives(...a),
    getLineage: (...a: unknown[]) => getLineage(...a),
  },
}));

import { InitiativeObservabilityPanel } from '../../../src/components/Initiatives/InitiativeObservabilityPanel';

describe('InitiativeObservabilityPanel (E1/E2)', () => {
  beforeEach(() => {
    getFunnelStats.mockReset();
    getInitiatives.mockReset();
    getLineage.mockReset();
  });

  it('E2: renders the funnel — conversion + status/source breakdown', async () => {
    getFunnelStats.mockResolvedValue({
      byStatus: { DRAFT: 8, EXECUTING: 2 },
      bySource: { manual: 6, assessment: 4 },
      conversion: { created: 10, inExecution: 2, tracking: 1, conversionPct: 10 },
    });
    getInitiatives.mockResolvedValue([]);
    getLineage.mockResolvedValue(null);

    render(<InitiativeObservabilityPanel />);

    expect(await screen.findByText('Lejek konwersji portfela')).toBeTruthy();
    // conversion steps
    await waitFor(() => expect(screen.getByText('10%')).toBeTruthy());
    expect(screen.getByText('chip:DRAFT')).toBeTruthy();
    expect(screen.getByText('chip:EXECUTING')).toBeTruthy();
    expect(screen.getByText('assessment')).toBeTruthy();
  });

  it('E1: renders the lineage chain for the selected initiative', async () => {
    getFunnelStats.mockResolvedValue({
      byStatus: {},
      bySource: {},
      conversion: { created: 0, inExecution: 0, tracking: 0, conversionPct: 0 },
    });
    getInitiatives.mockResolvedValue([{ id: 'i-1', title: 'Inicjatywa A', status: 'EXECUTING' }]);
    getLineage.mockResolvedValue({
      source: { type: 'assessment', id: 'a-9' },
      initiative: { id: 'i-1', title: 'Inicjatywa A', status: 'EXECUTING' },
      downstream: { executionStatus: 'executing', benefits: [{ kpi: 'k1' }, { kpi: 'k2' }] },
    });

    render(<InitiativeObservabilityPanel initialInitiativeId="i-1" />);

    expect(await screen.findByText('Initiative lineage chain')).toBeTruthy();
    await waitFor(() => expect(getLineage).toHaveBeenCalledWith('i-1'));
    // chain nodes — 'Inicjatywa A' appears in both the picker <option> and the
    // lineage node, so assert ≥1 match.
    await waitFor(() => expect(screen.getAllByText('Inicjatywa A').length).toBeGreaterThan(0));
    expect(screen.getByText('assessment')).toBeTruthy(); // source type (lineage-only)
    expect(screen.getByText('2 KPI')).toBeTruthy(); // benefits count interpolated
  });

  it('degrades gracefully when funnel endpoint returns empty', async () => {
    getFunnelStats.mockResolvedValue({
      byStatus: {},
      bySource: {},
      conversion: { created: 0, inExecution: 0, tracking: 0, conversionPct: 0 },
    });
    getInitiatives.mockResolvedValue([]);
    getLineage.mockResolvedValue(null);

    render(<InitiativeObservabilityPanel />);
    expect(await screen.findByText('Lejek konwersji portfela')).toBeTruthy();
    // no crash; conversion 0%
    await waitFor(() => expect(screen.getByText('0%')).toBeTruthy());
  });
});
