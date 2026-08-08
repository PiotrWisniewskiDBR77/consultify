/** @vitest-environment jsdom */

/**
 * T22-INTEGRATION-SHELL — proves:
 *  1. flag OFF (default) is byte-identical to today's 3-tab Hub;
 *  2. flag ON exposes exactly the 5 five-surfaces tab ids/labels, with
 *     `?tab=` as the URL source of truth;
 *  3. 'outputs' renders the real, accepted, unmodified AssessmentOutputsTab;
 *  4. 'library' renders an honest EmptyState placeholder — no fabricated
 *     rows, no claim that T20 (Assessment/Library, 45-table audit) is
 *     closed;
 *  5. the exact source anchors T20/T21/T23/T24's own source-slice suites
 *     depend on survive verbatim.
 *
 * Unlike T20-T24 (component not mounted — "heavy data-fetching hub"), this
 * suite DOES mount AssessmentHub for the tab/URL-sync assertions, because a
 * source-slice check cannot honestly prove runtime tab-switching or `?tab=`
 * behavior. Mock scaffold (Api, feature flags, react-router, sibling
 * detail-view stubs) is adapted from AssessmentHub.rate-limit-resilience.
 * test.tsx's pattern — that file's own `ModuleHub` wrapper mock turned out
 * to be stale (AssessmentHub.tsx's real top-level shell is
 * `StandardModuleBar`, not a `ModuleHub` component; verified by running that
 * suite unmodified: pre-existing red, 0/5, before this package touched
 * anything). Tab-bar queries here are scoped to the real, unmocked
 * `role="tablist"` instead.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiMock, tMock, isEnabledMock } = vi.hoisted(() => ({
  apiMock: {
    listAssessments: vi.fn(),
    getAssessmentReports: vi.fn(),
    get: vi.fn(),
    listReportImports: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    getUsers: vi.fn(),
  },
  tMock: (_key: string, fallback?: string | Record<string, unknown>) => {
    if (typeof fallback === 'string') return fallback;
    if (fallback && typeof fallback === 'object') {
      const value = (fallback as { defaultValue?: unknown }).defaultValue;
      if (typeof value === 'string') return value;
    }
    return _key;
  },
  isEnabledMock: vi.fn((_flagId: string) => false),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: tMock, i18n: { language: 'en' } }),
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
}));

vi.mock('../../../src/services/api', () => ({ Api: apiMock }));

// AssessmentHub.tsx reads flags via `useFeatureFlagsContext()`
// (@/contexts/FeatureFlagsContext), not the leaf `hooks/useFeatureFlags`
// hook directly. tests/setup.ts already globally mocks that context module
// with a fixed `isEnabled: vi.fn(() => false)` — this per-file mock shadows
// it so `isEnabledMock` (controllable per-test below) is what AssessmentHub
// actually sees.
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

// NOTE: AssessmentHub.tsx does not import/render a `ModuleHub` component at
// all — its real top-level shell is `StandardModuleBar` (../standard), left
// unmocked so the actual tab bar (and therefore the tab labels this suite
// asserts on) renders for real. This mock only supplies the OTHER named
// exports AssessmentHub.tsx pulls from '../shared/ModuleHub' (types,
// GridView/StatusDropdown/getStatusesForModule/*_STATUSES).
vi.mock('../../../src/components/shared/ModuleHub', () => ({
  FilterableTable: ({
    data,
    emptyMessage,
  }: {
    data: Array<{ id: string; name: string }>;
    emptyMessage: string;
  }) => (
    <div>
      {data.length > 0 ? (
        data.map((row) => <div key={row.id}>{row.name}</div>)
      ) : (
        <div>{emptyMessage}</div>
      )}
    </div>
  ),
  GridView: ({ items }: { items: Array<{ id: string; name: string }> }) => (
    <div>{items.map((item) => item.name).join(', ')}</div>
  ),
  StatusDropdown: () => null,
  ASSESSMENT_STATUSES: {},
  REPORT_STATUSES: {},
  getStatusesForModule: () => [],
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

function TabParamProbe() {
  const [params] = useSearchParams();
  return <div data-testid="tab-param">{params.get('tab') ?? ''}</div>;
}

// Tab labels ("Assessment", "Reports", …) also appear elsewhere on the page
// (Menu 3 info chip, breadcrumb-style titles) — scope queries to the real,
// unmocked tab bar (`role="tablist"`, StandardModuleBar) to avoid ambiguous
// multi-match errors.
function tabList() {
  return screen.getByRole('tablist', { name: 'Module sections' });
}

function mockEmptyArtifacts() {
  apiMock.get.mockImplementation((url: string) => {
    if (String(url).startsWith('/artifacts')) {
      return Promise.resolve({ data: { data: [], total: 0, canonicalHome: 'outputs_library' } });
    }
    return Promise.resolve([]);
  });
}

describe('T22-INTEGRATION-SHELL AssessmentHub five-surfaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    isEnabledMock.mockImplementation(() => false);
    apiMock.listAssessments.mockResolvedValue({ items: [] });
    apiMock.getAssessmentReports.mockResolvedValue([]);
    apiMock.get.mockResolvedValue([]);
    apiMock.listReportImports.mockResolvedValue({ data: [] });
    apiMock.getUsers.mockResolvedValue([]);
  });

  it('flag OFF: exactly the 3 legacy tabs, no five-surfaces ids, no ?tab= written', async () => {
    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <AssessmentHub />
        <TabParamProbe />
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
    // Byte-identical behavior: the flag-OFF path never reads/writes `?tab=`.
    expect(screen.getByTestId('tab-param').textContent).toBe('');
  });

  it('flag ON: exactly the 5 five-surfaces tabs (Library/Processes/Outputs/Reports/Initiatives)', async () => {
    isEnabledMock.mockImplementation((id: string) => id === 'assessmentFiveSurfacesV1');
    mockEmptyArtifacts();

    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <AssessmentHub />
        <TabParamProbe />
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
    // Library is the default tab and canonicalizes the URL on mount.
    await waitFor(() => expect(screen.getByTestId('tab-param').textContent).toBe('library'));
  });

  it('flag ON: clicking a tab writes ?tab= (URL is the source of truth)', async () => {
    isEnabledMock.mockImplementation((id: string) => id === 'assessmentFiveSurfacesV1');
    mockEmptyArtifacts();

    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <AssessmentHub />
        <TabParamProbe />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByTestId('tab-param').textContent).toBe('library'));

    fireEvent.click(within(tabList()).getByText('Outputs'));
    await waitFor(() => expect(screen.getByTestId('tab-param').textContent).toBe('outputs'));

    fireEvent.click(within(tabList()).getByText('Processes'));
    await waitFor(() => expect(screen.getByTestId('tab-param').textContent).toBe('processes'));
  });

  it('flag ON + ?tab=list (legacy bookmark) resolves to the processes tab', async () => {
    isEnabledMock.mockImplementation((id: string) => id === 'assessmentFiveSurfacesV1');
    mockEmptyArtifacts();

    render(
      <MemoryRouter initialEntries={['/assessment?tab=list']}>
        <AssessmentHub />
        <TabParamProbe />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByTestId('tab-param').textContent).toBe('processes'));
  });

  it('flag ON: outputs tab renders the real, unmodified AssessmentOutputsTab (org-scoped, real row)', async () => {
    isEnabledMock.mockImplementation(
      (id: string) =>
        id === 'assessmentFiveSurfacesV1' || id === 'assessmentMenu3StatusChips'
    );
    apiMock.get.mockImplementation((url: string) => {
      if (String(url).startsWith('/artifacts')) {
        return Promise.resolve({
          data: {
            data: [
              {
                artifactId: 'art-1',
                resolvedTitle: 'Real Output From Registry',
                outputType: 'report',
                artifactFamily: 'document',
                deliveryState: 'draft',
                visibilityScope: 'organization',
                isDraft: true,
                ownerName: 'Jane Doe',
                createdBy: 'user-1',
                createdAt: '2026-07-01T00:00:00.000Z',
                lastTransitionAt: '2026-07-20T00:00:00.000Z',
                originRuntime: 'assessment_report',
                originRecordId: 'asmt-1',
                openPath: '/assessment?assessmentId=asmt-1',
                exportPath: null,
                deletePath: null,
                authority: 'assessment_workbench',
              },
            ],
            total: 1,
          },
        });
      }
      return Promise.resolve([]);
    });

    render(
      <MemoryRouter initialEntries={['/assessment?tab=outputs']}>
        <AssessmentHub />
      </MemoryRouter>
    );

    expect(await screen.findByText('Real Output From Registry')).toBeInTheDocument();
    expect(screen.getByTitle('Outputs in the current list.')).toHaveTextContent('All1');
    expect(screen.queryByRole('button', { name: /^Draft/ })).not.toBeInTheDocument();
  });

  it('flag ON: library tab shows an honest EmptyState placeholder — no rows, no fabricated data, no StandardTable', async () => {
    isEnabledMock.mockImplementation((id: string) => id === 'assessmentFiveSurfacesV1');

    render(
      <MemoryRouter initialEntries={['/assessment?tab=library']}>
        <AssessmentHub />
      </MemoryRouter>
    );

    expect(await screen.findByText('Library is not built yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('row')).not.toBeInTheDocument();
  });
});

describe('T22-INTEGRATION-SHELL source anchors (protects T20/T21/T23/T24 source-slice suites)', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/components/Assessment/AssessmentHub.tsx'),
    'utf8'
  );

  it('preserves every exact substring the existing guard suites depend on', () => {
    expect(source).toContain("// 'list' tab → StandardTable + StandardPreview");
    expect(source).toContain('const bulkCommandRowContent =');
    expect(source).toContain("activeTab === 'list' && selectedListIds.size > 0");
    expect(source).toContain('rowMenu={(row): StandardRowMenu => ({');
  });

  it('does not import/render AssessmentQualityReviewPanel or AssessmentLibraryTab (out of this package scope)', () => {
    expect(source).not.toContain('AssessmentQualityReviewPanel');
    expect(source).not.toContain("from './library/AssessmentLibraryTab'");
    expect(source).not.toContain('<AssessmentLibraryTab');
  });

  it('wires the real AssessmentOutputsTab count callback without changing its data ownership', () => {
    expect(source).toContain("import { AssessmentOutputsTab } from './AssessmentOutputsTab';");
    expect(source).toContain('<AssessmentOutputsTab onCountChange={setOutputsCount} />');
  });
});

/*
 * ── Negative control (run manually against the real file, not committed as
 *    an additional in-suite assertion — same convention as prior T20-T24/T22
 *    packages):
 *
 *   Temporarily changed the `tabs` useMemo's guard from
 *   `if (!fiveSurfacesEnabled) {` to `if (false) {` (forcing the 5-tab
 *   branch even when the flag is OFF) → "flag OFF: exactly the 3 legacy
 *   tabs..." failed (found 'Library'/'Outputs'/'Processes' when it expected
 *   them absent). Restored identically (diff against the pre-edit copy was
 *   empty) and re-verified the full suite green before this report.
 */
