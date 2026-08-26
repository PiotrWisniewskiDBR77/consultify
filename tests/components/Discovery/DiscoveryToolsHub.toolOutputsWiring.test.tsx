/**
 * @vitest-environment jsdom
 *
 * DiscoveryToolsHub — DEC-118 repair #1 (2026-08-26): the Outputs/Insights
 * tab bootstrap never called `Api.listToolOutputs()` (the canonical
 * `tool_outputs` snapshot, migration 946), so an approved tool result never
 * appeared in the module's own aggregate list — only inside that one
 * session's own workspace. Gated behind `ff_toolsInsightsWiring`
 * (default OFF, fail-closed) per CLAUDE.md's "ZAKAZ MASOWEGO WŁĄCZANIA" rule.
 *
 * Reuses the same mount/mocking scaffold as `DiscoveryToolsHub.fala1.test.tsx`
 * (StandardTable stubbed to a thin prop-capturing renderer).
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetToolsInsightsWiringFlagCache } from '@/utils/toolsInsightsWiringFlag';

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
    listAssessmentsLegacy: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 }),
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

describe('DiscoveryToolsHub — DEC-118 repair #1: tool_outputs wiring behind ff_toolsInsightsWiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    standardTableMounts.length = 0;
    window.localStorage.clear();
    resetToolsInsightsWiringFlagCache();
    getKnownToolsMock.mockResolvedValue({ items: [buildKnownTool()] });
    listToolSessionsMock.mockResolvedValue({ items: [], total: 0, limit: 0, offset: 0 });
    getAssessmentReportsMock.mockResolvedValue([]);
    listToolOutputsMock.mockResolvedValue({ outputs: [SAMPLE_TOOL_OUTPUT] });
  });

  afterEach(() => {
    window.localStorage.clear();
    resetToolsInsightsWiringFlagCache();
  });

  it('flag OFF (default): never calls Api.listToolOutputs and the row never appears', async () => {
    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="outputs" />
      </MemoryRouter>
    );

    await screen.findByTestId('standard-table-stub-tools.outputs');
    expect(listToolOutputsMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('row-out-1')).not.toBeInTheDocument();
  });

  it('flag ON: calls Api.listToolOutputs and merges the row into the Outputs tab as kind "tool_output"', async () => {
    window.localStorage.setItem('ff.tools_insights_wiring', 'on');
    resetToolsInsightsWiringFlagCache();

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

  it('flag ON: a superseded revision (isCurrent: false) is excluded from the aggregate list', async () => {
    window.localStorage.setItem('ff.tools_insights_wiring', '1');
    resetToolsInsightsWiringFlagCache();
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
});

describe('DiscoveryToolsHub — DEC-118 repair #6: "Create report" enters Report Builder with a pre-selected TOOL source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    standardTableMounts.length = 0;
    window.localStorage.clear();
    window.localStorage.setItem('ff.tools_insights_wiring', 'on');
    resetToolsInsightsWiringFlagCache();
    getKnownToolsMock.mockResolvedValue({ items: [buildKnownTool()] });
    listToolSessionsMock.mockResolvedValue({ items: [], total: 0, limit: 0, offset: 0 });
    getAssessmentReportsMock.mockResolvedValue([]);
    listToolOutputsMock.mockResolvedValue({ outputs: [SAMPLE_TOOL_OUTPUT] });
  });

  afterEach(() => {
    window.localStorage.clear();
    resetToolsInsightsWiringFlagCache();
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

  it('is disabled for a non-tool_output row (e.g. an assessment report)', async () => {
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
        <DiscoveryToolsHub initialTab="outputs" />
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
    window.localStorage.setItem('ff.tools_insights_wiring', 'on');
    resetToolsInsightsWiringFlagCache();
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
    resetToolsInsightsWiringFlagCache();
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

  it('is disabled for a non-tool_output row (e.g. an assessment report)', async () => {
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
        <DiscoveryToolsHub initialTab="outputs" />
      </MemoryRouter>
    );

    const button = await screen.findByTestId('row-ar-1-action-reopen-output');
    expect(button).toBeDisabled();
  });
});
