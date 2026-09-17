/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: unknown) =>
      typeof fallback === 'string'
        ? fallback
        : String((fallback as { defaultValue?: string } | undefined)?.defaultValue ?? _key),
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: (store: unknown) => unknown) => {
    const store = {
      currentProjectId: null,
      fullSessionData: null,
      currentUser: { id: 'user-1', role: 'MEMBER' },
      currentOrganization: { id: 'org-1' },
      toggleChatCollapse: vi.fn(),
      isChatCollapsed: true,
    };
    return selector ? selector(store) : store;
  },
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector: (store: unknown) => unknown) =>
    selector({ addMessage: vi.fn() }),
}));

vi.mock('@/store/useInitiativeRefreshStore', () => ({
  useInitiativeRefreshStore: (selector: (store: unknown) => unknown) => selector({ version: 0 }),
}));

vi.mock('@/hooks/useOpenChatWithContext', () => ({ useOpenChatWithContext: () => vi.fn() }));
vi.mock('@/hooks/useOrganizationMemberNames', () => ({
  useOrganizationMemberNames: () => () => null,
}));
vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));
vi.mock('../executionFeatureFlags', () => ({ isExecutionFlagEnabled: () => false }));

const { standardTablePropsSpy } = vi.hoisted(() => ({ standardTablePropsSpy: vi.fn() }));

vi.mock('@/components/standard/StandardTable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/standard/StandardTable')>();
  const ReactActual = await import('react');
  const SpyStandardTable = (props: React.ComponentProps<typeof actual.StandardTable>) => {
    standardTablePropsSpy(props);
    return ReactActual.createElement(actual.StandardTable, props);
  };
  return { ...actual, StandardTable: SpyStandardTable, default: SpyStandardTable };
});

vi.mock('@/services/api/organizations.api', () => ({
  OrganizationApi: { getOrganizationMembers: vi.fn().mockResolvedValue([]) },
}));

const { getTasks, getInitiatives, apiGet } = vi.hoisted(() => ({
  getTasks: vi.fn(),
  getInitiatives: vi.fn(),
  apiGet: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    getTasks,
    getInitiatives,
    get: apiGet,
    raidList: vi.fn().mockResolvedValue([]),
    updateTask: vi.fn(),
    post: vi.fn(),
  },
  API_URL: '',
  clearGlobalTransportFailure: vi.fn(),
  getHeaders: () => ({}),
  resetAuthLoopGuard: vi.fn(),
  shouldAllowDemoData: () => false,
}));

const {
  listExecutionCases,
  readExecutionCase,
  readExecutionCaseBundles,
  readExecutionMilestones,
  readExecutionWork,
} = vi.hoisted(() => ({
  listExecutionCases: vi.fn(),
  readExecutionCase: vi.fn(),
  readExecutionCaseBundles: vi.fn(),
  readExecutionMilestones: vi.fn(),
  readExecutionWork: vi.fn(),
}));

vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listExecutionCases,
  readExecutionWork,
  readExecutionCaseBundles,
  readOperationalAllocations: vi.fn(),
  readExecutionCase,
  readExecutionMilestones,
  createExecutionTask: vi.fn(),
  updateExecutionTask: vi.fn(),
  completeExecutionTask: vi.fn(),
  createExecutionDecision: vi.fn(),
  requestExecutionDecision: vi.fn(),
  decideExecutionDecision: vi.fn(),
  createExecutionMilestone: vi.fn(),
}));

import { ExecutionWorkSurface } from '../ExecutionWorkSurface';
import { parseExecutionNavigationState } from '../executionNavigationState';

const CASE_ID = 'execution-case-42';
const WORK_ID = 'runtime-work-42';
const TYPED_WORK_ID = `work:${CASE_ID}:${WORK_ID}`;

describe('Execution mounted initiative truth spine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTasks.mockResolvedValue([
      {
        id: 'task-runtime-1',
        title: 'Prepare runtime evidence',
        status: 'in_progress',
        assigneeId: 'user-1',
        initiativeId: 'initiative-42',
        dueDate: '2026-09-30T00:00:00.000Z',
      },
    ]);
    getInitiatives.mockResolvedValue([{ id: 'initiative-42', name: 'Runtime initiative' }]);
    apiGet.mockResolvedValue({
      data: {
        statuses: ['todo', 'in_progress', 'done'],
        transitions: { in_progress: ['done'] },
      },
    });
    listExecutionCases.mockResolvedValue({
      cases: [
        {
          executionCaseId: CASE_ID,
          initiativeId: 'initiative-42',
          initiativeTitle: 'Runtime initiative',
        },
      ],
    });
    readExecutionCaseBundles.mockResolvedValue(null);
    readExecutionCase.mockResolvedValue({
      version: 1,
      detail: {
        initiativeId: 'initiative-42',
        handoffPackageId: 'handoff-1',
        handoffPackageVersion: 1,
      },
    });
    readExecutionMilestones.mockResolvedValue({ items: [] });
    readExecutionWork.mockResolvedValue({
      tasks: [
        {
          taskId: WORK_ID,
          title: 'Canonical runtime work record',
          status: 'OPEN',
          assigneeId: 'user-1',
          dueAt: '2026-09-30T00:00:00.000Z',
          version: 1,
          evidenceRefs: [],
        },
      ],
      decisions: [],
    });
  });

  it('renders the work register through the canonical StandardTable/FilterableTable DOM', async () => {
    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(ExecutionWorkSurface, { activePreset: 'all' })
      )
    );

    const rowLabel = await screen.findByText('Prepare runtime evidence');
    const table = rowLabel.closest('table');

    expect(table).not.toBeNull();
    expect(
      within(table as HTMLTableElement).getByRole('columnheader', { name: /task/i })
    ).toBeInTheDocument();
    expect(
      within(table as HTMLTableElement).getByRole('row', { name: /prepare runtime evidence/i })
    ).toBeInTheDocument();
    expect(standardTablePropsSpy).toHaveBeenCalled();
    expect(
      standardTablePropsSpy.mock.calls.some(([props]) =>
        props.data.some((row: { title?: string }) => row.title === 'Prepare runtime evidence')
      )
    ).toBe(true);
    await waitFor(() => expect(getTasks).toHaveBeenCalledTimes(1));
  });

  it('opens the requested runtime record from the canonical typed-work deep link', async () => {
    const navigation = parseExecutionNavigationState(
      `?tab=work&documentKind=work&documentId=${encodeURIComponent(TYPED_WORK_ID)}&executionCaseId=${CASE_ID}`,
      { summaryOneLookEnabled: true }
    );
    expect(navigation.documentIdentity).toEqual({ kind: 'work', id: TYPED_WORK_ID });

    // The sibling `ExecutionHub.workDeepLink.source.test.ts` locks the Hub
    // branch that performs this exact split before passing `documentId` to
    // ExecutionWorkSurface. This mounted test continues that production chain
    // and proves the extracted work id opens the real runtime record.
    const [, , ...workIdParts] = navigation.documentIdentity!.id.split(':');
    const documentId = workIdParts.join(':');
    expect(documentId).toBe(WORK_ID);

    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(ExecutionWorkSurface, {
          activePreset: 'all',
          documentId,
        })
      )
    );

    const workspace = await screen.findByRole('region', {
      name: 'Execution Work item workspace',
    });
    expect(
      within(workspace).getByRole('heading', { name: 'Canonical runtime work record' })
    ).toBeInTheDocument();
    await waitFor(() => expect(readExecutionWork).toHaveBeenCalledWith(CASE_ID));
    expect(screen.queryByText('Prepare runtime evidence')).not.toBeInTheDocument();
  });
});
