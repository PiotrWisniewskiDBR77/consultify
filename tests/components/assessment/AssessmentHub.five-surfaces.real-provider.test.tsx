/**
 * @vitest-environment jsdom
 *
 * ASM-001A fix round (FIX_REQUIRED, Codex) — Task 2.
 *
 * `AssessmentHub.five-surfaces.test.tsx` / `AssessmentHub.five-surfaces-off.test.tsx`
 * both mock `useFeatureFlagsContext` directly, so neither one proves the flag's
 * `defaultValue: true` (flipped in src/hooks/useFeatureFlags.tsx, ASM-001A fix
 * round) is actually reached through the real runtime wiring: AppProviders →
 * FeatureFlagsProvider → useFeatureFlags → isEnabled('assessmentFiveSurfacesV1').
 * They also can't prove the kill-switch works, because the "switch" they flip
 * is the mock itself, not any real mechanism.
 *
 * `@/contexts/FeatureFlagsContext` carries a GLOBAL passthrough mock registered
 * in tests/setup.ts (`isEnabled: () => false`) — omitting a local `vi.mock`
 * call is not enough to get the real module; `vi.unmock` at the top level of
 * this file is required to undo it for this file's module graph (same pattern
 * as tests/unit/store.test.ts for `@/store/useAppStore`, adapted to a
 * top-level call since every test in this file wants the real module — no
 * mocked-context test coexists here that a dynamic-import + resetModules
 * dance would need to protect).
 *
 * `../../../src/services/api` is mocked with `importOriginal` (not a bare
 * `{ Api: apiMock }` replacement) specifically so the REAL `API_URL`/`getHeaders`
 * named exports survive — the real `useFeatureFlags` hook's `fetchRemoteFlags`
 * destructures both, and a bare mock (as used in the sibling test files, which
 * mock the hook via the context anyway) throws "No API_URL export is defined".
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.unmock('@/contexts/FeatureFlagsContext');

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    listAssessments: vi.fn(),
    getAssessmentReports: vi.fn(),
    get: vi.fn(),
    listReportImports: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    getUsers: vi.fn(),
  },
}));

vi.mock('../../../src/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/api')>();
  return { ...actual, Api: apiMock };
});

vi.mock('../../../src/components/assessment/library/AssessmentLibraryTab', () => ({
  AssessmentLibraryTab: () => <div data-testid="assessment-library-tab">Library stub</div>,
}));

vi.mock('../../../src/components/Initiatives/InitiativeCompactPanel', () => ({
  InitiativeCompactPanel: () => null,
}));
vi.mock('../../../src/components/Initiatives/InitiativeDocumentView', () => ({
  InitiativeDocumentView: () => null,
}));
vi.mock('../../../src/components/MyWork/DecisionDetailView', () => ({
  DecisionDetailView: () => null,
}));
vi.mock('../../../src/components/MyWork/TaskDetailView', () => ({ TaskDetailView: () => null }));
vi.mock('../../../src/components/assessment/ImportedReportDetailView', () => ({
  ImportedReportDetailView: () => null,
}));
vi.mock('../../../src/components/assessment/InitiativesGenerationWizardModal', () => ({
  InitiativesGenerationWizardModal: () => null,
}));
vi.mock('../../../src/components/assessment/modals/NewAssessmentReportModal', () => ({
  NewAssessmentReportModal: () => null,
}));
vi.mock('../../../src/components/assessment/NewAssessmentModal', () => ({
  NewAssessmentModal: () => null,
}));

import { FeatureFlagsProvider, useFeatureFlagsContext } from '../../../src/contexts/FeatureFlagsContext';
import { AssessmentHub } from '../../../src/components/assessment/AssessmentHub';

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location-probe">
      {location.pathname}
      {location.search}
    </div>
  );
}

const CANONICAL_ASSESSMENT_LIST = {
  items: [
    {
      id: 'asm_1',
      name: 'Canonical DRD',
      type: 'DRD',
      status: 'DRAFT',
      updatedAt: '2026-04-11T08:00:00.000Z',
    },
  ],
};

function renderRealAssessmentHub(initialEntry: string, providerConfig?: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <FeatureFlagsProvider config={providerConfig}>
        <LocationProbe />
        <AssessmentHub />
      </FeatureFlagsProvider>
    </MemoryRouter>
  );
}

describe('AssessmentHub — assessmentFiveSurfacesV1, REAL FeatureFlagsProvider (no isEnabled mock)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    apiMock.listAssessments.mockResolvedValue(CANONICAL_ASSESSMENT_LIST);
    apiMock.getAssessmentReports.mockResolvedValue([]);
    apiMock.get.mockResolvedValue([]);
    apiMock.listReportImports.mockResolvedValue({ data: [] });
    apiMock.getUsers.mockResolvedValue([]);
  });

  it('ON: with zero token / zero remote data / zero local override, the real provider resolves to defaultValue=true — Library tab renders by default', async () => {
    // No `localStorage.token` → useFeatureFlags.fetchRemoteFlags short-circuits
    // before any fetch (`if (!remoteEndpoint && !hasAuthToken) { ...; return; }`),
    // so `remoteFlags` stays `{}` and the ONLY thing deciding the flag value is
    // the flag definition's `defaultValue` in src/hooks/useFeatureFlags.tsx.
    renderRealAssessmentHub('/assessment');

    expect(await screen.findByTestId('assessment-library-tab')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('tab=library');
    });

    const tabs = screen.getAllByRole('tab').map((el) => el.textContent || '');
    expect(tabs.some((t) => /Library/.test(t))).toBe(true);
    expect(tabs.some((t) => /Processes/.test(t))).toBe(true);
    expect(tabs.some((t) => /Outputs/.test(t))).toBe(true);
  });

  describe('OFF via a real local override, mounted through the real provider (no isEnabled mock)', () => {
    const STORAGE_KEY = 'consultify_feature_flags';

    beforeEach(() => {
      // Pre-seed the SAME localStorage key useFeatureFlags.tsx reads
      // synchronously in its `useState(getStoredOverrides)` initializer, so
      // the override is already present on the very first render — no async
      // transition, no flicker from defaultValue=true to false mid-lifecycle.
      // `config.enableLocalOverrides: true` is NOT what AppProviders.tsx wires
      // today (that's the separate, already-documented "local overrides are
      // dormant app-wide" gap this fix round intentionally leaves alone — see
      // report) — this test instance opts a real FeatureFlagsProvider into
      // the local-override tier on purpose, specifically so the assertion
      // below exercises the REAL priority cascade in useFeatureFlags.tsx
      // (`if (enableLocalOverrides && flag.allowLocalOverride && flag.id in
      // localOverrides) { result[flag.id] = localOverrides[flag.id]; ... }`)
      // without mocking useFeatureFlags/useFeatureFlagsContext at all.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ assessmentFiveSurfacesV1: false }));
    });

    it('OFF: a real local override for assessmentFiveSurfacesV1=false beats defaultValue=true from the first render — reproduces the legacy 3-tab Hub', async () => {
      renderRealAssessmentHub('/assessment', { enableLocalOverrides: true });

      await screen.findByText('Canonical DRD');
      const tabs = screen.getAllByRole('tab').map((el) => el.textContent || '');
      expect(tabs.some((t) => /Assessment/.test(t))).toBe(true);
      expect(tabs.some((t) => /Reports/.test(t))).toBe(true);
      expect(tabs.some((t) => /Initiatives/.test(t))).toBe(true);
      expect(tabs.some((t) => /Library/.test(t))).toBe(false);
      expect(tabs.some((t) => /Processes/.test(t))).toBe(false);
      expect(tabs.some((t) => /Outputs/.test(t))).toBe(false);
      expect(screen.queryByTestId('assessment-library-tab')).not.toBeInTheDocument();
      expect(screen.getByTestId('location-probe')).not.toHaveTextContent('tab=');
    });

    it('OFF: clicking a tab still works but never touches ?tab= (identical to the legacy/local-mock regression guard)', async () => {
      renderRealAssessmentHub('/assessment', { enableLocalOverrides: true });

      await screen.findByText('Canonical DRD');
      fireEvent.click(await screen.findByRole('tab', { name: /Reports/i }));

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Reports/i })).toHaveAttribute(
          'aria-selected',
          'true'
        );
      });
      expect(screen.getByTestId('location-probe')).not.toHaveTextContent('tab=');
    });
  });
});

/**
 * Mechanism-level proof of the remote kill-switch (GET {API_URL}/feature-flags/runtime,
 * mounted at /api/feature-flags — server/src/Gateway.ts:640 → server/src/routes/featureFlags.routes.ts).
 *
 * Deliberately NOT routed through AssessmentHub: mounting AssessmentHub while
 * the flag's resolved value flips from true (optimistic first paint —
 * `remoteFlags` is always `{}` until the async fetch below resolves, so the
 * very first render always uses `defaultValue: true`) to false (once the
 * remote payload arrives) hits a SEPARATE, pre-existing AssessmentHub bug:
 * the `?tab=`/activeTab-sync effect (AssessmentHub.tsx ~L371-386) only
 * canonicalizes the URL while `fiveSurfacesEnabled` is true and no-ops the
 * instant it flips false, so `activeTab` stays stuck on the now-nonexistent
 * 'library' id, `currentData`'s `switch (activeTab)` falls through to `[]`,
 * and repeated re-renders around that stale state trip React's "Maximum
 * update depth exceeded" guard. That is a real, reportable gap in
 * AssessmentHub's OWN tab/URL-sync logic, out of scope for this fix round
 * (this round's file allowlist is explicitly "nie ruszaj logiki tabów/URL
 * sync ... poza [completion display]") — flagged in the round report, not
 * patched here. This probe proves the remote-override MECHANISM itself (the
 * part actually in scope for the kill-switch claim) works, without tripping
 * that unrelated bug.
 */
describe('useFeatureFlags remote kill-switch — real FeatureFlagsProvider + real fetch call, mocked network only', () => {
  const ORIGINAL_FETCH = global.fetch;

  function FlagProbe() {
    const { isEnabled } = useFeatureFlagsContext();
    return <div data-testid="flag-probe">{String(isEnabled('assessmentFiveSurfacesV1'))}</div>;
  }

  beforeEach(() => {
    localStorage.setItem('token', 'test-token-for-remote-flag-fetch');
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input);
      if (url.includes('/feature-flags/runtime')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ flags: { assessmentFiveSurfacesV1: false } }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response);
    });
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    localStorage.removeItem('token');
  });

  it('calls the real /feature-flags/runtime endpoint for an authenticated session and lets the response override defaultValue=true → false, with zero hook/context mocking', async () => {
    render(
      <FeatureFlagsProvider>
        <FlagProbe />
      </FeatureFlagsProvider>
    );

    // First paint: no remote data yet → defaultValue (true) wins.
    expect(screen.getByTestId('flag-probe')).toHaveTextContent('true');

    // Once the mocked fetch resolves, the remote value overrides defaultValue.
    await waitFor(() => {
      expect(screen.getByTestId('flag-probe')).toHaveTextContent('false');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/feature-flags/runtime'),
      expect.any(Object)
    );
  });
});
