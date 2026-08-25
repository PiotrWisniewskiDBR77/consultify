/**
 * @vitest-environment jsdom
 *
 * DiscoveryToolsHub — FALA 1 mechanical fixes (2026-08-25), targeted
 * coverage per docs/program/waves/WAVE_03_ACCEPTANCE-adjacent owner review
 * (tools-uwagi-komplet.md). Reuses the same mount/mocking scaffold as
 * `DiscoveryToolsHub.inactiveTools.test.tsx` (RV-028) — StandardTable is
 * stubbed to a thin prop-capturing renderer so these tests exercise
 * DiscoveryToolsHub's own decisions (what it computes and passes down), not
 * StandardTable's internals (covered by its own suite).
 *
 * Covers:
 *  - M6: the Library category filter row drops any chip whose count is 0
 *    (the reported "Other 0" noise), but keeps a populated one.
 *  - M9: the Library/Sessions StandardTable mounts receive no `selection`
 *    prop — the bulk-select checkboxes had no bulk action bar behind them
 *    (TLS-XPR-013) and were removed rather than left inert.
 *  - M14: an APPROVED tool session reaches the Sessions tab data instead of
 *    being dropped by the old DRAFT/PENDING_REVIEW-only filter
 *    (TLS-XPR-009).
 *  - M8: the Outputs/Reports row "Chat" action calls the real
 *    `openChatWithContext` handler instead of silently duplicating Preview
 *    (`onClick: () => setPreviewItemId(id)`).
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getKnownToolsMock = vi.fn();
const listToolSessionsMock = vi.fn();
const getAssessmentReportsMock = vi.fn();

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

const openChatWithContextMock = vi.fn().mockResolvedValue('conv-1');
vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => openChatWithContextMock,
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

// M9: capture every StandardTable mount's props (instead of just rendering
// data) so we can assert on the `selection` prop directly, in addition to
// rendering enough to find rows for other assertions.
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

describe('DiscoveryToolsHub — M6: empty-count filter chips are dropped', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    standardTableMounts.length = 0;
    listToolSessionsMock.mockResolvedValue({ items: [], total: 0, limit: 0, offset: 0 });
  });

  it('does not render the "Other" chip when every known tool has a real category', async () => {
    getKnownToolsMock.mockResolvedValue({ items: [buildKnownTool()] });

    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="library" />
      </MemoryRouter>
    );

    await screen.findByTestId('standard-table-stub-tools.library');
    expect(screen.queryByRole('button', { name: /^Other/ })).not.toBeInTheDocument();
  });

  it('also drops OTHER zero-count category chips (not just "Other") while keeping populated ones', async () => {
    // The one API-sourced fixture tool is 'operational'. `Assessments`
    // (licensed) and `Automation` always carry at least one static template
    // entry regardless of the fixture (see `assessmentTemplateItems` /
    // `automationTemplateItem` above) — those two must stay visible.
    // `Strategy` and `Digital` genuinely have zero members here and must not
    // render a chip at all — proving the fix is the general
    // `count > 0` guard, not a one-off "Other" special case.
    getKnownToolsMock.mockResolvedValue({ items: [buildKnownTool({ libraryCategory: 'operational' })] });

    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="library" />
      </MemoryRouter>
    );

    await screen.findByTestId('standard-table-stub-tools.library');
    expect(screen.getByRole('button', { name: /^All/ })).toBeInTheDocument();
    const operationsChip = screen.getByRole('button', { name: /^Operations/ });
    expect(operationsChip).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /^Assessments/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Automation/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Strategy/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Digital/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Other/ })).not.toBeInTheDocument();
  });
});

describe('DiscoveryToolsHub — M9: no bulk-selection prop without a bulk action bar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    standardTableMounts.length = 0;
    getKnownToolsMock.mockResolvedValue({ items: [buildKnownTool()] });
    listToolSessionsMock.mockResolvedValue({ items: [], total: 0, limit: 0, offset: 0 });
  });

  it('the Library StandardTable mounts without a `selection` prop', async () => {
    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="library" />
      </MemoryRouter>
    );

    await screen.findByTestId('standard-table-stub-tools.library');
    const libraryMount = standardTableMounts.find((p) => p.persistKey === 'tools.library');
    expect(libraryMount).toBeDefined();
    expect(libraryMount.selection).toBeUndefined();
  });

  it('the Sessions StandardTable mounts without a `selection` prop', async () => {
    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="sessions" />
      </MemoryRouter>
    );

    await screen.findByTestId('standard-table-stub-tools.sessions');
    const sessionsMount = standardTableMounts.find((p) => p.persistKey === 'tools.sessions');
    expect(sessionsMount).toBeDefined();
    expect(sessionsMount.selection).toBeUndefined();
  });
});

describe('DiscoveryToolsHub — M14: Sessions tab shows the full session lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    standardTableMounts.length = 0;
    getKnownToolsMock.mockResolvedValue({ items: [buildKnownTool()] });
  });

  it('an APPROVED tool session reaches the Sessions tab instead of being dropped', async () => {
    listToolSessionsMock.mockResolvedValue({
      items: [
        {
          id: 'sess-approved-1',
          name: 'Approved SWOT session',
          toolType: 'dynamic-swot',
          status: 'APPROVED',
          progress: 100,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      total: 1,
      limit: 100,
      offset: 0,
    });

    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="sessions" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('row-sess-approved-1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('row-sess-approved-1')).toHaveTextContent('Approved SWOT session');
  });
});

describe('DiscoveryToolsHub — M8: Outputs "Chat" opens real chat, not a Preview duplicate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    standardTableMounts.length = 0;
    getKnownToolsMock.mockResolvedValue({ items: [buildKnownTool()] });
    listToolSessionsMock.mockResolvedValue({ items: [], total: 0, limit: 0, offset: 0 });
    getAssessmentReportsMock.mockResolvedValue([
      {
        id: 'report-1',
        name: 'Q1 Assessment Report',
        status: 'APPROVED',
        createdAt: new Date().toISOString(),
        assessmentId: 'assessment-1',
      },
    ]);
  });

  it('clicking Chat on an output row calls openChatWithContext with the row as context, not setPreviewItemId', async () => {
    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="outputs" />
      </MemoryRouter>
    );

    const chatButton = await screen.findByTestId('row-report-1-action-chat');
    chatButton.click();

    await waitFor(() => {
      expect(openChatWithContextMock).toHaveBeenCalledTimes(1);
    });
    const [callArgs] = openChatWithContextMock.mock.calls[0];
    expect(callArgs.entityId).toBe('report-1');
    expect(callArgs.entityType).toBe('tool_output');
  });
});
