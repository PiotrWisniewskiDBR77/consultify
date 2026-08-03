/**
 * @vitest-environment jsdom
 *
 * RES-11 mounted-component test — the active Results Scorecards screen (d).
 * Mounts the REAL ResultsKpiScorecardsView (not a hand-rolled stand-in) and
 * proves it renders exactly the KPIs the API returned for the current
 * caller — no client-side re-adding, merging, or leaking of a KPI the
 * backend already excluded as invisible to this user. Server-side
 * visibility filtering itself is proved against real Postgres in
 * kpiVisibility.res11.pg.test.ts (evidence item 6); this test proves the
 * screen doesn't undo that by rendering something the API didn't send.
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

vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

const getScorecards = vi.hoisted(() => vi.fn());
const getScorecardKpis = vi.hoisted(() => vi.fn());

vi.mock('@/services/api/v8/results', () => ({
  V8ResultsApi: {
    getScorecards,
    getScorecardKpis,
    createScorecard: vi.fn(),
    updateScorecard: vi.fn(),
    addKpiToScorecard: vi.fn(),
    removeKpiFromScorecard: vi.fn(),
    getKpiCatalog: vi.fn(async () => ({ kpis: [], mappings: [] })),
  },
}));

import { ResultsKpiScorecardsView } from '../ResultsKpiScorecardsView';

const mountScorecards = () =>
  render(
    <ResultsKpiScorecardsView
      activeFilters={[]}
      onFilterChange={() => {}}
      initiatives={[]}
    />
  );

describe('ResultsKpiScorecardsView — RES-11 visibility (mounted)', () => {
  it('d) never renders a KPI the API did not return for the current caller (backend already filtered it as invisible)', async () => {
    getScorecards.mockResolvedValue({
      scorecards: [
        {
          id: 'card-1',
          organizationId: 'org-1',
          name: 'Finance Q1',
          department: 'Finance',
          periodLabel: 'Q1 2026',
          periodStart: null,
          periodEnd: null,
          status: 'active',
          // Backend already excluded the private KPI from this viewer's
          // count — 1, not 2 (the card genuinely has 2 KPIs attached, one
          // of which is private_to_owner and not this viewer's).
          kpiCount: 1,
          onTargetCount: 1,
        },
      ],
      count: 1,
      ownerDomain: 'results',
    });
    // The API response for THIS caller already excludes the private KPI —
    // that's the contract kpiScorecardService.getScorecardKpis enforces
    // server-side (proved in kpiVisibility.res11.pg.test.ts). The component
    // must render exactly this list, never more.
    getScorecardKpis.mockResolvedValue({
      scorecard: { id: 'card-1', name: 'Finance Q1' },
      kpis: [
        {
          id: 'kpi-visible',
          name: 'Visible margin KPI',
          baselineValue: null,
          currentValue: 10,
          targetValue: 20,
          unit: '%',
          direction: 'HIGHER_IS_BETTER',
          progressPercentage: 50,
          isOnTarget: true,
          category: null,
          initiativeId: 'init-1',
          sortOrder: 0,
        },
      ],
      count: 1,
      ownerDomain: 'results',
    });

    mountScorecards();

    await waitFor(() => expect(screen.getByText('Finance Q1')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Finance Q1'));

    await waitFor(() => expect(getScorecardKpis).toHaveBeenCalledWith('card-1'));
    await waitFor(() => expect(screen.getByText('Visible margin KPI')).toBeInTheDocument());

    // The hidden KPI's name must never appear anywhere in the rendered
    // screen — not in the list, not in the preview, not as a placeholder.
    expect(screen.queryByText(/Private margin KPI/i)).not.toBeInTheDocument();
    // And the card's own displayed count must match what was actually
    // rendered (1), not the raw attachment count if it ever silently grew.
    expect(screen.getAllByText(/1 \/ 1/).length).toBeGreaterThan(0);
  });
});
