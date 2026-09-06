/**
 * @vitest-environment jsdom
 *
 * DiscoveryToolsHub — DEC-118 repair #1 (2026-08-26): the Outputs/Insights
 * tab bootstrap never called `Api.listToolOutputs()` (the canonical
 * `tool_outputs` snapshot, migration 946), so an approved tool result never
 * appeared in the module's own aggregate list — only inside that one
 * session's own workspace.
 *
 * 1.1-T1 (DEC-412, 2026-09-06): the `ff_toolsInsightsWiring` kill switch is
 * DELETED and the fetch is unconditional. The flag is exactly why the owner
 * saw "Insighty i Raporty to ta sama lista": with zero `tool_output` rows
 * merged in, the Insights tab fell back to the same report rows Reports
 * shows. The 500-resilience the flag was reverted for is kept by the
 * per-request catch (last test below) — the hub stays alive and the tab
 * shows an honest notice.
 *
 * Reuses the same mount/mocking scaffold as `DiscoveryToolsHub.fala1.test.tsx`
 * (StandardTable stubbed to a thin prop-capturing renderer).
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, useNavigate: () => navigateMock };
});

const getKnownToolsMock = vi.fn();
const listToolSessionsMock = vi.fn();
const getAssessmentReportsMock = vi.fn();
const listToolOutputsMock = vi.fn();
const reopenToolOutputMock = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    getKnownTools: (...args: unknown[]) => getKnownToolsMock(...args),
    getKnownTool: vi.fn().mockResolvedValue(null),
    getToolSession: vi.fn().mockResolvedValue(null),
    listToolSessions: (...args: unknown[]) => listToolSessionsMock(...args),
    listAssessments: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 }),
    listAssessmentsLegacy: vi
      .fn()
      .mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 }),
    getAssessmentReports: (...args: unknown[]) => getAssessmentReportsMock(...args),
    get: vi.fn().mockResolvedValue({ reports: [], success: true, data: [] }),
    getUsers: vi.fn().mockResolvedValue([]),
    createToolSession: vi.fn(),
    suggestTools: vi.fn().mockResolvedValue({ suggestions: [] }),
    getInitiativesByStatus: vi.fn().mockResolvedValue([]),
    listToolOutputs: (...args: unknown[]) => listToolOutputsMock(...args),
    reopenToolOutput: (...args: unknown[]) => reopenToolOutputMock(...args),
  },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }), toast: fn };
});

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentProjectId: null,
    currentUser: { id: 'u1', role: 'ADMIN' },
    currentOrganization: { id: 'org-1' },
  }),
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector?: any) => {
    const state = { addMessage: vi.fn() };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn().mockResolvedValue('conv-1'),
}));

vi.mock('@/contexts/HelpContext', () => ({
  useHelpSidePanel: () => ({
    setOpen: vi.fn(),
    setActiveTab: vi.fn(),
    setKnowledgeModuleIdOverride: vi.fn(),
  }),
  useHelp: () => ({ setOpen: vi.fn(), setActiveTab: vi.fn() }),
  HelpProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const standardTableMounts: any[] = [];
vi.mock('@/components/standard', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    StandardTable: (props: any) => {
      standardTableMounts.push(props);
      return (
        <div data-testid={`standard-table-stub-${props.persistKey || 'unknown'}`}>
          {(props.data || []).map((row: any) => (
            <div key={row.id} data-testid={`row-${row.id}`}>
              <span>{row.name}</span>
              <span data-testid={`row-${row.id}-kind`}>{row.outputKind}</span>
              {(props.rowActions?.(row) || []).flatMap((block: any) =>
                (block.actions || []).map((action: any) => (
                  <button
                    key={`${row.id}-${action.id}`}
                    data-testid={`row-${row.id}-action-${action.id}`}
                    disabled={!!action.disabled}
                    onClick={action.onClick}
                  >
                    {action.label}
                  </button>
                ))
              )}
            </div>
          ))}
        </div>
      );
    },
  };
});

import { DiscoveryToolsHub } from '@/components/Discovery/DiscoveryToolsHub';

function buildKnownTool(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'dynamic-swot',
    toolType: 'dynamic-swot',
    name: 'Dynamic SWOT',
    libraryCategory: 'operational',
    description: 'desc',
    whatYouGet: [],
    tags: [],
    icon: null,
    isLicensed: false,
    isActive: true,
    isComingSoon: false,
    sortOrder: 1,
    createdAt: null,
    ...overrides,
  };
}

const SAMPLE_TOOL_OUTPUT = {
  id: 'out-1',
  toolSessionId: 'sess-1',
  toolType: 'dynamic-swot',
  version: 1,
  supersedesId: null,
  title: 'SWOT — Q1 result',
  status: 'approved',
  contentHash: 'abc123',
  createdAt: new Date().toISOString(),
  approvedAt: new Date().toISOString(),
  isCurrent: true,
};

describe('DiscoveryToolsHub — 1.1-T1: tool_outputs wiring is unconditional (flag deleted)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    standardTableMounts.length = 0;
    window.localStorage.clear();
    getKnownToolsMock.mockResolvedValue({ items: [buildKnownTool()] });
    listToolSessionsMock.mockResolvedValue({ items: [], total: 0, limit: 0, offset: 0 });
    getAssessmentReportsMock.mockResolvedValue([]);
    listToolOutputsMock.mockResolvedValue({ outputs: [SAMPLE_TOOL_OUTPUT] });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  // 1.1-T1 (DEC-412): no override of any kind — the default path must fetch.
  it('default path (no override at all): calls Api.listToolOutputs and shows the row in the Insights tab as kind "tool_output"', async () => {
    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="outputs" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(listToolOutputsMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId('row-out-1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('row-out-1')).toHaveTextContent('SWOT — Q1 result');
    expect(screen.getByTestId('row-out-1-kind')).toHaveTextContent('tool_output');
  });

  it('a superseded revision (isCurrent: false) is excluded from the aggregate list', async () => {
    listToolOutputsMock.mockResolvedValue({
      outputs: [
        SAMPLE_TOOL_OUTPUT,
        { ...SAMPLE_TOOL_OUTPUT, id: 'out-0-superseded', isCurrent: false, status: 'superseded' },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="outputs" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('row-out-1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('row-out-0-superseded')).not.toBeInTheDocument();
  });

  it('keeps the hub alive and shows an honest message when only tool outputs return 500', async () => {
    listToolOutputsMock.mockRejectedValue({ status: 500, message: 'tool_outputs missing' });

    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="outputs" />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('standard-table-stub-tools.outputs')).toBeInTheDocument();
    expect(await screen.findByTestId('tool-outputs-unavailable')).toHaveTextContent(
      'Tool outputs are temporarily unavailable'
    );
    expect(screen.queryByText('Data Loading Error')).not.toBeInTheDocument();
  });

  /**
   * 1.1-T1 (DEC-412) — uwaga właściciela 06.09: „W narzędziach Insighty i
   * Raporty jest ta sama lista." Mutacja celowana: gdy `insightsOutputs`
   * przestanie filtrować po `tool_output` (albo zakładka wróci na wspólną
   * tablicę `outputs`), wiersz raportu pojawi się w Insightach i ten test
   * pada. Druga strona pary — Raporty NIE pokazują insightu — jest testem
   * poniżej, żeby żadna z zakładek nie „wygrała" przez wygaszenie drugiej.
   */
  it('Insights shows ONLY tool_output rows — a report row never appears there', async () => {
    getAssessmentReportsMock.mockResolvedValue([
      { id: 'rep-1', name: 'Raport oceny DRD', status: 'GENERATED', updatedAt: new Date().toISOString() },
    ]);

    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="outputs" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('row-out-1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('row-out-1-kind')).toHaveTextContent('tool_output');
    expect(screen.queryByTestId('row-rep-1')).not.toBeInTheDocument();
  });

  it('Reports shows ONLY report rows — the tool_output insight never appears there', async () => {
    getAssessmentReportsMock.mockResolvedValue([
      { id: 'rep-1', name: 'Raport oceny DRD', status: 'GENERATED', updatedAt: new Date().toISOString() },
    ]);

    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="reports" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('row-rep-1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('row-out-1')).not.toBeInTheDocument();
  });

  it('preserves the full-hub error when tool sessions return 500', async () => {
    listToolSessionsMock.mockRejectedValue({ status: 500, message: 'sessions unavailable' });

    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="outputs" />
      </MemoryRouter>
    );

    expect(await screen.findByText('Data Loading Error')).toBeInTheDocument();
    expect(screen.queryByTestId('standard-table-stub-tools.outputs')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tool-outputs-unavailable')).not.toBeInTheDocument();
  });
});

describe('DiscoveryToolsHub — DEC-118 repair #6: "Create report" enters Report Builder with a pre-selected TOOL source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    standardTableMounts.length = 0;
    window.localStorage.clear();
    getKnownToolsMock.mockResolvedValue({ items: [buildKnownTool()] });
    listToolSessionsMock.mockResolvedValue({ items: [], total: 0, limit: 0, offset: 0 });
    getAssessmentReportsMock.mockResolvedValue([]);
    listToolOutputsMock.mockResolvedValue({ outputs: [SAMPLE_TOOL_OUTPUT] });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('navigates to /reports/builder with sourceType=TOOL and the originating tool session id', async () => {
    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="outputs" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('row-out-1')).toBeInTheDocument();
    });
    // Query fresh (not `find*`, which could hand back a reference captured
    // before the bootstrap fetch resolved and the row re-rendered) after the
    // row has settled, so `.click()` fires on the node actually in the DOM.
    const button = screen.getByTestId('row-out-1-action-create-report');
    expect(button).not.toBeDisabled();
    button.click();

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledTimes(1);
    });
    const [target] = navigateMock.mock.calls[0];
    expect(String(target)).toContain('/reports/builder?');
    const search = new URLSearchParams(String(target).split('?')[1] || '');
    expect(search.get('new')).toBe('true');
    expect(search.get('sourceType')).toBe('TOOL');
    expect(search.get('sourceId')).toBe(SAMPLE_TOOL_OUTPUT.toolSessionId);
  });

  it('is disabled for a non-approved tool output (in_review)', async () => {
    listToolOutputsMock.mockResolvedValue({
      outputs: [{ ...SAMPLE_TOOL_OUTPUT, status: 'in_review' }],
    });

    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="outputs" />
      </MemoryRouter>
    );

    const button = await screen.findByTestId('row-out-1-action-create-report');
    expect(button).toBeDisabled();
  });

  // 1.1-T1 (DEC-412): wiersz raportu oceny nie pojawia się już w zakładce
  // Insighty (tam są tylko `tool_output`) — jego akcje sprawdzamy tam, gdzie
  // ten wiersz realnie żyje, czyli w zakładce Raporty.
  it('is disabled for a non-tool_output row (e.g. an assessment report, Reports tab)', async () => {
    listToolOutputsMock.mockResolvedValue({ outputs: [] });
    getAssessmentReportsMock.mockResolvedValue([
      {
        id: 'ar-1',
        name: 'Assessment report',
        status: 'APPROVED',
        createdAt: new Date().toISOString(),
        assessmentId: 'assessment-1',
      },
    ]);

    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="reports" />
      </MemoryRouter>
    );

    const button = await screen.findByTestId('row-ar-1-action-create-report');
    expect(button).toBeDisabled();
  });
});

describe('DiscoveryToolsHub — DEC-118 repair #5 (partial): "Reopen" for an approved tool output', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    standardTableMounts.length = 0;
    window.localStorage.clear();
    getKnownToolsMock.mockResolvedValue({ items: [buildKnownTool()] });
    listToolSessionsMock.mockResolvedValue({ items: [], total: 0, limit: 0, offset: 0 });
    getAssessmentReportsMock.mockResolvedValue([]);
    listToolOutputsMock.mockResolvedValue({ outputs: [SAMPLE_TOOL_OUTPUT] });
    reopenToolOutputMock.mockResolvedValue({
      superseded: { id: SAMPLE_TOOL_OUTPUT.id, status: 'superseded' },
      revision: { id: 'out-1-rev2', version: 2 },
    });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('calls Api.reopenToolOutput(outputId) and refetches on click', async () => {
    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="outputs" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('row-out-1')).toBeInTheDocument();
    });
    const button = screen.getByTestId('row-out-1-action-reopen-output');
    expect(button).not.toBeDisabled();
    button.click();

    await waitFor(() => {
      expect(reopenToolOutputMock).toHaveBeenCalledWith(SAMPLE_TOOL_OUTPUT.id);
    });
    // Refetch after a successful reopen (fetchData(true)).
    await waitFor(() => {
      expect(listToolOutputsMock).toHaveBeenCalledTimes(2);
    });
  });

  it('is disabled for a non-approved tool output (in_review)', async () => {
    listToolOutputsMock.mockResolvedValue({
      outputs: [{ ...SAMPLE_TOOL_OUTPUT, status: 'in_review' }],
    });

    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="outputs" />
      </MemoryRouter>
    );

    const button = await screen.findByTestId('row-out-1-action-reopen-output');
    expect(button).toBeDisabled();
  });

  // 1.1-T1 (DEC-412): wiersz raportu oceny nie pojawia się już w zakładce
  // Insighty (tam są tylko `tool_output`) — jego akcje sprawdzamy tam, gdzie
  // ten wiersz realnie żyje, czyli w zakładce Raporty.
  it('is disabled for a non-tool_output row (e.g. an assessment report, Reports tab)', async () => {
    listToolOutputsMock.mockResolvedValue({ outputs: [] });
    getAssessmentReportsMock.mockResolvedValue([
      {
        id: 'ar-1',
        name: 'Assessment report',
        status: 'APPROVED',
        createdAt: new Date().toISOString(),
        assessmentId: 'assessment-1',
      },
    ]);

    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="reports" />
      </MemoryRouter>
    );

    const button = await screen.findByTestId('row-ar-1-action-reopen-output');
    expect(button).toBeDisabled();
  });
});
