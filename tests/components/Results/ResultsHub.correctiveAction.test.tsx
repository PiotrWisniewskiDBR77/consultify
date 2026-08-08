/**
 * @vitest-environment jsdom
 *
 * RB-031 / RV-021 — the four canonical Results entries (Scorecards,
 * Corrective Action, Results Review, Reports) must each mount their own
 * real, distinct surface — not the generic KPI table, and not the
 * `ResultsThreePairsView` cockpit landing page.
 *
 * Root cause (RV-021): with the `threePairs` feature flag default-ON on
 * demo/stage/dev (resultsFeatureFlags.ts "D-D default-on" set), ResultsHub
 * short-circuited to `<ResultsThreePairsView>` — a single monolithic
 * KPI-centric view that ignores `tab`/`mode`/`rmode` entirely — for EVERY
 * request, so all four canonical URLs kept their query string but rendered
 * the same generic KPI view. The fix adds an `isCanonicalResultsDeepLink`
 * bypass so a URL that explicitly asks for one of these surfaces falls
 * through to the tab/mode-driven rendering that mounts the real component.
 *
 * `src/components/Execution/CorrectiveActions.tsx` additionally had zero
 * import/call sites anywhere in `src` before this fix (see
 * CODEX_SOURCE_MOUNT_AND_ABSENCE_PROOF.md#A043).
 *
 * Codex review pass 2: Corrective Action must live at the AUDITED canonical
 * entry `?tab=results_kpi&mode=queue` (CODEX_SOURCE_MOUNT_AND_ABSENCE_PROOF.md
 * #A043 names this exact combination), not an invented `mode=corrective`.
 * The former `mode=queue` tool (`KpiQueueView`, "Data / Signals") relocated to
 * `mode=signals` so it isn't lost.
 *
 * Codex re-review (blocker 3): `ResultsHub` never fabricates a `projectId`
 * (no `organization.id`, no `'all'`) — and, per the re-review, `?initiativeId=`
 * is ALSO not a confirmed project identity (nothing here verifies it is the
 * kind of id the PMO service expects), so this canonical entry now supplies
 * NO `projectId` at all, even when `?initiativeId=` is present in the URL.
 * `CorrectiveActions` shows its own honest "no project context" state and
 * makes no request (see CorrectiveActions.states.test.tsx for the component-
 * level no-request and confirmed-context tests).
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, optsOrDefault?: any) =>
      typeof optsOrDefault === 'string' ? optsOrDefault : (optsOrDefault?.defaultValue ?? k),
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: any) =>
    selector({
      currentUser: { id: 'u1', firstName: 'T', lastName: 'U', role: 'ADMIN' },
      currentOrganization: { id: 'org-1', name: 'Org' },
    }),
}));

vi.mock('@/services/api', () => ({
  Api: { get: vi.fn(async () => ({})), post: vi.fn(async () => ({})) },
}));

vi.mock('@/services/initiativeWriteTruth', () => ({
  updateInitiativeStatusWriteTruth: vi.fn(async () => ({})),
}));

const { loadResultsKpis } = vi.hoisted(() => ({ loadResultsKpis: vi.fn() }));
vi.mock('../../../src/components/Results/kpiRuntime', () => ({ loadResultsKpis }));

vi.mock('@/components/Execution/CorrectiveActions', () => ({
  CorrectiveActions: ({ projectId }: { projectId?: string }) => (
    <div data-testid="corrective-actions-workspace" data-project-id={projectId ?? ''}>
      Corrective Actions workspace
    </div>
  ),
}));
vi.mock('../../../src/components/Results/KpiQueueView', () => ({
  KpiQueueView: () => <div data-testid="kpi-queue-view">Data / Signals</div>,
}));

vi.mock('../../../src/components/Results/ResultsThreePairsView', () => ({
  ResultsThreePairsView: () => <div data-testid="three-pairs-cockpit">Three-pairs cockpit</div>,
}));
vi.mock('../../../src/components/Results/ResultsKpiScorecardsView', () => ({
  ResultsKpiScorecardsView: () => <div data-testid="scorecards-view">Scorecards</div>,
}));
vi.mock('../../../src/components/Results/ResultsInitiativesView', () => ({
  ResultsInitiativesView: () => <div data-testid="results-review-view">Results Review</div>,
}));
vi.mock('../../../src/components/Results/ResultsKpiReportsView', () => ({
  ResultsKpiReportsView: () => <div data-testid="reports-view">Reports</div>,
}));
// Unrelated to this suite's assertions — ValueDriverTree renders inside the
// results_initiatives branch when its own flag is on and throws on the
// minimal Api mock's empty data shape. Stub it out to keep this suite
// focused on canonical-entry routing.
vi.mock('../../../src/components/Results/ValueDriverTree', () => ({
  ValueDriverTree: () => <div data-testid="value-driver-tree-stub" />,
  default: () => <div data-testid="value-driver-tree-stub" />,
}));

import { ResultsHub } from '../../../src/components/Results/ResultsHub';

describe('ResultsHub — RB-031/RV-021 canonical Results entries bypass the three-pairs cockpit', () => {
  beforeEach(() => {
    loadResultsKpis.mockResolvedValue({ kpis: [], initiatives: [], mappings: [] });
  });

  it('with no deep-link query, the default three-pairs cockpit still renders (no regression)', async () => {
    render(
      <MemoryRouter initialEntries={['/results']}>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('three-pairs-cockpit')).toBeInTheDocument();
    });
  });

  it('mode=queue (the audited canonical entry) mounts the real CorrectiveActions workspace, not the cockpit or generic KPI table', async () => {
    render(
      <MemoryRouter initialEntries={['/results?tab=results_kpi&mode=queue']}>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('corrective-actions-workspace')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('three-pairs-cockpit')).not.toBeInTheDocument();
    expect(screen.queryByText(/KPI — target/i)).not.toBeInTheDocument();
  });

  it('mode=queue never receives a guessed projectId (no organization.id, no "all")', async () => {
    render(
      <MemoryRouter initialEntries={['/results?tab=results_kpi&mode=queue']}>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('corrective-actions-workspace')).toHaveAttribute(
        'data-project-id',
        ''
      );
    });
  });

  it('mode=queue never passes ?initiativeId= as projectId either — it is not a confirmed project identity', async () => {
    render(
      <MemoryRouter initialEntries={['/results?tab=results_kpi&mode=queue&initiativeId=init-42']}>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('corrective-actions-workspace')).toHaveAttribute(
        'data-project-id',
        ''
      );
    });
  });

  it('mode=signals mounts the relocated Data/Signals tool (KpiQueueView), not Corrective Action', async () => {
    render(
      <MemoryRouter initialEntries={['/results?tab=results_kpi&mode=signals']}>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('kpi-queue-view')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('corrective-actions-workspace')).not.toBeInTheDocument();
    expect(screen.queryByTestId('three-pairs-cockpit')).not.toBeInTheDocument();
  });

  it('mode=scorecards mounts the real Scorecards view, not the cockpit', async () => {
    render(
      <MemoryRouter initialEntries={['/results?tab=results_kpi&mode=scorecards']}>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('scorecards-view')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('three-pairs-cockpit')).not.toBeInTheDocument();
  });

  it('tab=results_initiatives mounts the real Results Review view, not the cockpit', async () => {
    render(
      <MemoryRouter initialEntries={['/results?tab=results_initiatives']}>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('results-review-view')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('three-pairs-cockpit')).not.toBeInTheDocument();
  });

  it('tab=results_reports&rmode=reports mounts the real Reports view, not the cockpit', async () => {
    render(
      <MemoryRouter initialEntries={['/results?tab=results_reports&rmode=reports']}>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('reports-view')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('three-pairs-cockpit')).not.toBeInTheDocument();
  });
});
