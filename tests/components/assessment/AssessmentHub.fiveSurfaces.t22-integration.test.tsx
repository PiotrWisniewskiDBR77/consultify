/** @vitest-environment jsdom */

/**
 * T22-INTEGRATION-SHELL — QA closeout for the five-surfaces dev-render
 * screen (`dev-render/screens/assessment-five-surfaces.tsx`) registered by
 * this package.
 *
 * REBASE NOTE (2026-08-08 ux-tools recovery): this package's original
 * source (`codex/ui45-dev-render-followup-2026-08-08`, 577 commits behind
 * `origin/demo` at the time of recovery) was drafted against a version of
 * `AssessmentHub.tsx` that predates the real 'library' (`AssessmentLibraryTab`,
 * ASM-001A) and per-assessment 'outputs' evidence review
 * (`AssessmentQualityReviewPanel`, ASM-005/006/007) implementations that
 * have since shipped to `origin/demo`. That source's own assertions (a
 * 'library' stub reading "Library is not built yet") no longer describe the
 * real component and were dropped rather than ported verbatim — porting
 * them would have required reverting real, already-shipped functionality.
 *
 * `AssessmentOutputsTab` (the org-wide Outputs Library, `GET /api/artifacts`
 * filtered to assessment-origin rows) DOES get reconstructed and wired in —
 * as the 'outputs' tab's default view when no assessment is selected yet,
 * alongside (not instead of) `AssessmentQualityReviewPanel`, which still
 * owns the view once an assessment is selected on Processes. Doctryna
 * gęstości §3 requires every new component to have a real caller in the
 * same step; a standalone, never-imported copy is not an option.
 *
 * Tab-id/URL-sync coverage for the flag itself already exists in
 * `AssessmentHub.five-surfaces.test.tsx`,
 * `AssessmentHub.five-surfaces-off.test.tsx` and
 * `AssessmentHub.five-surfaces.real-provider.test.tsx` — this file does not
 * duplicate that; it verifies the specific 5-tab shell the QA screen
 * mounts, and anchors the current source so a future blind rebase of the
 * old branch doesn't silently regress the real Library/per-assessment-
 * Outputs surfaces.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiMock, isEnabledMock, listMethodSessionsMock } = vi.hoisted(() => ({
  apiMock: {
    listAssessments: vi.fn(),
    getAssessmentReports: vi.fn(),
    get: vi.fn(),
    listReportImports: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    getUsers: vi.fn(),
  },
  isEnabledMock: vi.fn((_flagId: string) => false),
  listMethodSessionsMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../../../src/services/api', () => ({ Api: apiMock }));
vi.mock('../../../src/method-core/api/methodCoreApi', () => ({
  listSessions: listMethodSessionsMock,
}));

// AssessmentHub.tsx reads flags via `useFeatureFlagsContext()`
// (@/contexts/FeatureFlagsContext) — this per-file mock shadows the global
// passthrough mock registered in tests/setup.ts so `isEnabledMock`
// (controllable per-test below) is what AssessmentHub actually sees.
vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({
    flags: {},
    flagDefinitions: [],
    isLoading: false,
    isEnabled: isEnabledMock,
    setFlag: vi.fn(),
    clearAllOverrides: vi.fn(),
    refresh: vi.fn(),
  }),
  FeatureFlagsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Library and both Outputs sub-surfaces render their own real components —
// mocked out here (this suite is only about the Hub's tab shell, not their
// internals, which have their own dedicated suites: AssessmentLibraryTab.test.tsx,
// AssessmentQualityReviewPanel.test.tsx, AssessmentOutputsTab.t22.test.tsx).
vi.mock('../../../src/components/assessment/library/AssessmentLibraryTab', () => ({
  AssessmentLibraryTab: () => <div data-testid="assessment-library-tab">Library (real)</div>,
}));
vi.mock('../../../src/components/assessment/AssessmentQualityReviewPanel', () => ({
  AssessmentQualityReviewPanel: ({ assessmentId }: { assessmentId: string }) => (
    <div data-testid="assessment-quality-review-panel">Outputs (real) for {assessmentId}</div>
  ),
}));
vi.mock('../../../src/components/assessment/AssessmentOutputsTab', () => ({
  AssessmentOutputsTab: ({ onCountChange }: { onCountChange?: (n: number | null) => void }) => {
    React.useEffect(() => {
      onCountChange?.(3);
    }, [onCountChange]);
    return <div data-testid="assessment-outputs-tab">Outputs Library (real)</div>;
  },
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

// eslint-disable-next-line import/first -- must follow the vi.mock calls above
import { AssessmentHub } from '../../../src/components/assessment/AssessmentHub';

// Tab labels also appear elsewhere on the page (Menu 3 info chip,
// breadcrumb-style titles) — scope queries to the real, unmocked tab bar
// (`role="tablist"`, ModuleNavBar via StandardModuleBar) to avoid ambiguous
// multi-match errors.
function tabList() {
  return screen.getByRole('tablist', { name: 'Module sections' });
}

describe('T22-INTEGRATION-SHELL AssessmentHub five-surfaces — QA screen shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    isEnabledMock.mockImplementation(() => false);
    apiMock.listAssessments.mockResolvedValue({ items: [] });
    apiMock.getAssessmentReports.mockResolvedValue([]);
    apiMock.get.mockResolvedValue([]);
    apiMock.listReportImports.mockResolvedValue({ data: [] });
    apiMock.getUsers.mockResolvedValue([]);
    listMethodSessionsMock.mockResolvedValue({ sessions: [], total: 0 });
  });

  it('flag OFF: exactly the 3 legacy tabs, no five-surfaces ids', async () => {
    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <AssessmentHub />
      </MemoryRouter>
    );
    await waitFor(() => expect(tabList()).toBeInTheDocument());
    const tabs = within(tabList());
    expect(tabs.getByText('Assessment')).toBeInTheDocument();
    expect(tabs.getByText('Reports')).toBeInTheDocument();
    expect(tabs.getByText('Initiatives')).toBeInTheDocument();
    expect(tabs.queryByText('Library')).not.toBeInTheDocument();
    expect(tabs.queryByText('Outputs')).not.toBeInTheDocument();
    expect(tabs.queryByText('Processes')).not.toBeInTheDocument();
  });

  it('flag ON: exactly the 5 five-surfaces tabs (Library/Processes/Outputs/Reports/Initiatives)', async () => {
    isEnabledMock.mockImplementation((id: string) => id === 'assessmentFiveSurfacesV1');

    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <AssessmentHub />
      </MemoryRouter>
    );
    await waitFor(() => expect(tabList()).toBeInTheDocument());
    const tabs = within(tabList());
    expect(tabs.getByText('Library')).toBeInTheDocument();
    expect(tabs.getByText('Processes')).toBeInTheDocument();
    expect(tabs.getByText('Outputs')).toBeInTheDocument();
    expect(tabs.getByText('Reports')).toBeInTheDocument();
    expect(tabs.getByText('Initiatives')).toBeInTheDocument();
    expect(tabs.queryByText('Assessment')).not.toBeInTheDocument();
  });

  it('flag ON: library tab renders the real AssessmentLibraryTab (not a placeholder stub)', async () => {
    isEnabledMock.mockImplementation((id: string) => id === 'assessmentFiveSurfacesV1');

    render(
      <MemoryRouter initialEntries={['/assessment?tab=library']}>
        <AssessmentHub />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('assessment-library-tab')).toBeInTheDocument();
  });

  it('flag ON: outputs tab with no assessment selected shows the org-wide Outputs Library (AssessmentOutputsTab)', async () => {
    isEnabledMock.mockImplementation((id: string) => id === 'assessmentFiveSurfacesV1');

    render(
      <MemoryRouter initialEntries={['/assessment?tab=outputs']}>
        <AssessmentHub />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('assessment-outputs-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('assessment-quality-review-panel')).not.toBeInTheDocument();
  });

  it('flag ON: outputs tab with an assessment selected (via Processes) renders the real AssessmentQualityReviewPanel', async () => {
    isEnabledMock.mockImplementation((id: string) => id === 'assessmentFiveSurfacesV1');
    listMethodSessionsMock.mockResolvedValue({
      sessions: [{
        id: 'asm-method-1', organizationId: 'org-1', projectId: null,
        module: 'assessment', methodPackId: 'drd', methodPackVersion: '2.0.0-methodpack.1',
        state: 'active', domainStage: null, mode: 'guided_manual', ownerUserId: 'owner-1',
        createdAt: '2026-04-11T08:00:00.000Z', updatedAt: '2026-04-11T08:00:00.000Z',
        version: 1, frozenSnapshotId: null, revisionOfSessionId: null, hasFrozenOutput: false,
      }], total: 1,
    });

    render(
      <MemoryRouter initialEntries={['/assessment?tab=processes']}>
        <AssessmentHub />
      </MemoryRouter>
    );

    const row = await screen.findByText('DRD · asm-meth');
    fireEvent.click(row);

    // `react-i18next`'s real `useTranslation()` is intentionally left
    // unmocked in this file (unlike the sibling suites) so the tab bar
    // labels render for real; its `t` is not referentially stable across
    // renders, which can transiently re-trigger AssessmentHub's load effect
    // after a state change. `findByRole` polls, so it survives that
    // flicker instead of failing on a single synchronous snapshot.
    const outputsTab = await screen.findByRole('tab', { name: /Outputs/i });
    fireEvent.click(outputsTab);

    expect(await screen.findByTestId('assessment-quality-review-panel')).toHaveTextContent(
      'asm-method-1'
    );
  });
});

describe('T22-INTEGRATION-SHELL source anchors — protects the real Library/Outputs surfaces and this package\'s scope boundary', () => {
  const hubSource = readFileSync(
    join(process.cwd(), 'src/components/assessment/AssessmentHub.tsx'),
    'utf8'
  );
  const outputsTabSource = readFileSync(
    join(process.cwd(), 'src/components/assessment/AssessmentOutputsTab.tsx'),
    'utf8'
  );

  it('AssessmentHub still owns the real, shipped Library/per-assessment-Outputs surfaces (ASM-001A/005/006/007) — a future rebase of the old T22 branch must not silently revert these to stubs', () => {
    expect(hubSource).toContain("from './library/AssessmentLibraryTab'");
    expect(hubSource).toContain('<AssessmentLibraryTab');
    expect(hubSource).toContain('AssessmentQualityReviewPanel');
  });

  it('AssessmentHub wires AssessmentOutputsTab as the outputs tab\'s no-selection default, not as a replacement for AssessmentQualityReviewPanel (doctryna gęstości §3 — new component needs a real caller)', () => {
    expect(hubSource).toContain("import { AssessmentOutputsTab } from './AssessmentOutputsTab';");
    expect(hubSource).toContain('<AssessmentOutputsTab onCountChange={setOutputsCount} />');
    expect(hubSource).toContain('<AssessmentQualityReviewPanel assessmentId={selectedAssessmentId} />');
  });

  it('AssessmentOutputsTab stays self-contained — no import from a separate, out-of-scope service module', () => {
    expect(outputsTabSource).not.toContain("from './assessmentOutputs'");
  });
});
