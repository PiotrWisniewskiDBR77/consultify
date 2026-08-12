/**
 * @vitest-environment jsdom
 *
 * RN-G6 (2026-08-12) — "RN_G6_KPITAB" fix: `/results/kpi`'s Menu 2 tab
 * (My/Org/Scorecards) was a plain `useState` with no persistence at all,
 * unlike ROI's `ResultsRoiHub.tsx` and OKR's `ResultsOkrHub.tsx` (both fixed
 * under RN-G5). Symptom: switch to "Org", open the full KPI tool, come back
 * — the registry silently resets to "My", discarding the user's status
 * filter and selected row. This test proves the SAME sessionStorage-backed
 * fix (`results-vnext.kpi-registry.ui-state`, one key for the whole
 * surface, D09) now survives a real unmount/remount — the exact transition
 * a route change to `ROUTES.RESULTS_KPI.TOOL` and back produces.
 *
 * Mocking follows `ResultsKpiRegistryPage.kpiCreate.test.tsx`'s established
 * pattern (stateful fake `Api.get`/`Api.post`/`Api.put`, `useAppStore`,
 * `react-i18next`, `react-hot-toast` mocked at the module boundary) — a real
 * component render exercising real fetch/state wiring, not a snapshot of
 * hand-built props.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: any) =>
    selector({ currentUser: { id: 'user-piotr-demo', firstName: 'Piotr', lastName: 'W', role: 'ADMIN' } }),
}));

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
vi.mock('@/services/api', () => ({
  Api: { get: (...a: any[]) => apiGet(...a), post: (...a: any[]) => apiPost(...a), put: (...a: any[]) => apiPut(...a) },
}));

import { ResultsKpiRegistryPage } from '../../../src/components/ResultsVNext/ResultsKpiRegistryPage';

// Two KPIs: one owned by the current test user (visible on "My"), one owned
// by someone else with status 'draft' (only visible on "Org", and only when
// the "draft" status chip is NOT excluding it) — lets the test prove tab AND
// chip AND selection all round-trip, not just one of the three.
const MY_KPI = {
  kpiId: 'kpi-mine',
  organizationId: 'org-1',
  kpiCode: 'MY-KPI-001',
  status: 'active',
  currentDefinitionVersionId: 'ver-mine',
  primaryProcessId: null,
  responsePolicyId: null,
  ownerUserId: 'user-piotr-demo',
  rowVersion: 1,
  createdBy: 'user-piotr-demo',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};
const ORG_DRAFT_KPI = {
  kpiId: 'kpi-org-draft',
  organizationId: 'org-1',
  kpiCode: 'ORG-DRAFT-002',
  status: 'draft',
  currentDefinitionVersionId: 'ver-org-draft',
  primaryProcessId: null,
  responsePolicyId: null,
  ownerUserId: 'user-anna',
  rowVersion: 1,
  createdBy: 'user-anna',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

function makeFakeBackend() {
  const kpis = [{ ...MY_KPI }, { ...ORG_DRAFT_KPI }];

  apiGet.mockImplementation(async (url: string) => {
    if (url.startsWith('/vnext/results/kpi/') && url.includes('/measurements')) {
      return { measurements: [] };
    }
    if (url.startsWith('/vnext/results/kpi/') && url.includes('/version')) {
      return { definitionVersion: null };
    }
    if (url.startsWith('/vnext/results/kpi/scorecards')) {
      return { scorecards: [] };
    }
    if (url.startsWith('/vnext/results/kpi/')) {
      const kpiId = url.split('/vnext/results/kpi/')[1]?.split('?')[0];
      const found = kpis.find((k) => k.kpiId === kpiId);
      if (!found) {
        const err: any = new Error('not found');
        err.status = 404;
        throw err;
      }
      return { kpi: found };
    }
    if (url.startsWith('/vnext/results/kpi')) {
      return { kpis };
    }
    throw new Error(`Unexpected GET ${url}`);
  });

  return { kpis };
}

function renderPage(initialPath = '/results/kpi') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ResultsKpiRegistryPage />
    </MemoryRouter>
  );
}

describe('ResultsKpiRegistryPage — RN-G6 UI state persistence (tab/chip/selection)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    // The component reads `window.location.search` directly (not through
    // the router) for its `?kpiId=` deep-link check. `tests/setup.ts`
    // replaces `window.location` with a plain writable-object SNAPSHOT (to
    // stub `assign`/`replace`/`reload`), so `history.pushState` does not
    // update it here — only a direct field assignment does (see the deep
    // link test below). Reset it between tests so one test's value never
    // leaks into the next.
    (window.location as unknown as { search: string }).search = '';
  });

  it('restores tab, status chip, and selected row after unmount/remount (simulating "open full tool" and back)', async () => {
    makeFakeBackend();
    const first = renderPage();

    // Default mount: tab 'my' — only the current user's own KPI is visible.
    await screen.findByText('MY-KPI-001');
    expect(screen.queryByText('ORG-DRAFT-002')).not.toBeInTheDocument();

    // 1) Switch to "Org".
    fireEvent.click(screen.getByRole('tab', { name: 'Organizacja' }));
    await screen.findByText('ORG-DRAFT-002');

    // 2) Filter to the "Draft" status chip.
    fireEvent.click(screen.getByTestId('standard-chip-draft'));
    await waitFor(() => expect(screen.queryByText('MY-KPI-001')).not.toBeInTheDocument());
    screen.getByText('ORG-DRAFT-002');

    // 3) Select the (only remaining, org-owned) draft row — opens the preview.
    fireEvent.click(screen.getByText('ORG-DRAFT-002'));
    await waitFor(() => expect(screen.getAllByText('ORG-DRAFT-002').length).toBeGreaterThan(1));

    // Sanity: the fix under test writes to this exact sessionStorage key.
    const raw = window.sessionStorage.getItem('results-vnext.kpi-registry.ui-state');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toMatchObject({
      tab: 'org',
      statusFilter: 'draft',
      selectedId: 'kpi-org-draft',
    });

    // Simulate navigating away (unmounts this route) and back (fresh mount)
    // — exactly what `navigate(ROUTES.RESULTS_KPI.TOOL...)` and a browser
    // "back" does to this component.
    first.unmount();
    renderPage();

    // THE FIX: tab restored to "Org" (not reset to "My") — the org-owned
    // draft KPI is reachable at all only if the tab survived. The selection
    // is ALSO restored, so by the time this resolves the row's title
    // already appears twice (table row + preview header) — `findAllByText`
    // (not the singular `findByText`) tolerates that from the first match.
    await screen.findAllByText('ORG-DRAFT-002');
    // The chip restored to "Draft" — MY-KPI-001 (status 'active') stays
    // excluded even though we are now on "Org" (which would otherwise show
    // it).
    expect(screen.queryByText('MY-KPI-001')).not.toBeInTheDocument();
    // The tab button itself reflects the restored selection.
    expect(screen.getByRole('tab', { name: 'Organizacja' })).toHaveAttribute('aria-selected', 'true');
    // The row's own selection (and therefore the preview) survived too —
    // the code appears a second time (table row + preview header).
    await waitFor(() => expect(screen.getAllByText('ORG-DRAFT-002').length).toBeGreaterThan(1));
  });

  it('deep link (?kpiId=) still resolves and selects the record even with a restored tab', async () => {
    makeFakeBackend();
    // Seed a PRIOR session state that would otherwise strand the deep link
    // on a tab whose branch never renders the KPI table/preview at all.
    window.sessionStorage.setItem(
      'results-vnext.kpi-registry.ui-state',
      JSON.stringify({ tab: 'scorecards', statusFilter: null, selectedId: null, selectedScorecardId: null })
    );

    // The component reads `?kpiId=` off `window.location.search` directly,
    // not off `MemoryRouter`'s in-memory history — `renderPage`'s
    // `initialEntries` alone never touches it. `history.pushState` does not
    // work here either: `tests/setup.ts` replaces `window.location` with a
    // plain object snapshot (to stub `assign`/`replace`/`reload`), so only a
    // direct field assignment is visible to the component.
    (window.location as unknown as { search: string }).search = '?kpiId=kpi-mine';
    renderPage('/results/kpi?kpiId=kpi-mine');

    // The deep-linked KPI must become visible — proving the page bumped
    // itself off the restored 'scorecards' tab rather than silently eating
    // the link.
    await waitFor(() => expect(screen.getAllByText('MY-KPI-001').length).toBeGreaterThan(1));
  });

  it('deep link (?kpiId=) still resolves when a restored "My" tab or status chip would otherwise hide the record (caught live during the dowód run)', async () => {
    makeFakeBackend();
    // Seed a PRIOR session that would strand the deep link TWO ways at once:
    // 'my' scopes to the current user's own rows (ORG-DRAFT-002 is owned by
    // 'user-anna', not the logged-in test user), AND the 'active' chip
    // excludes ORG-DRAFT-002's own 'draft' status.
    window.sessionStorage.setItem(
      'results-vnext.kpi-registry.ui-state',
      JSON.stringify({ tab: 'my', statusFilter: 'active', selectedId: null, selectedScorecardId: null })
    );

    (window.location as unknown as { search: string }).search = '?kpiId=kpi-org-draft';
    renderPage('/results/kpi?kpiId=kpi-org-draft');

    // Visible (table row + preview header) only if BOTH the tab bumped to
    // "Org" AND the status chip was cleared.
    await waitFor(() => expect(screen.getAllByText('ORG-DRAFT-002').length).toBeGreaterThan(1));
    expect(screen.getByRole('tab', { name: 'Organizacja' })).toHaveAttribute('aria-selected', 'true');
  });
});
