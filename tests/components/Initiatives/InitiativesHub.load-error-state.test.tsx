/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetPortfolio = vi.fn();
const mockGetInitiatives = vi.fn();
const mockListRegisteredInitiatives = vi.fn();
const mockCurrentUser = { id: 'u-1', role: 'ADMIN', firstName: 'A', lastName: 'B' };

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({
    currentProjectId: null,
    currentUser: mockCurrentUser,
  }),
}));

vi.mock('../../../src/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('../../../src/store/useConversationStore', () => ({
  useConversationStore: (selector: any) => selector({ addMessage: vi.fn() }),
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    getInitiatives: (...args: unknown[]) => mockGetInitiatives(...args),
    getUsers: vi.fn().mockResolvedValue([]),
  },
  shouldAllowDemoData: () => false,
}));

vi.mock('../../../src/services/api/v8/planning', () => ({
  V8PlanningApi: {
    getPortfolio: (...args: unknown[]) => mockGetPortfolio(...args),
    getPendingDecisions: vi.fn().mockResolvedValue({ pendingDecisionChains: [] }),
    getInitiativeSnapshot: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  listRegisteredInitiatives: (...args: unknown[]) => mockListRegisteredInitiatives(...args),
}));

vi.mock('../../../src/services/initiativeLifecycle', () => ({
  getStatusesForModule: () => [],
  STATUS_METADATA: {},
}));

vi.mock('../../../src/services/initiativeWriteTruth', () => ({
  createInitiativeWriteTruth: vi.fn(),
  getInitiativeStatusPreflightTruth: vi.fn(),
  quickUpdateInitiativeWriteTruth: vi.fn(),
  updateInitiativeStatusWriteTruth: vi.fn(),
}));

vi.mock('../../../src/utils/initiativeDuplicateDetection', () => ({
  checkDuplicateInitiative: vi.fn().mockReturnValue(null),
}));

vi.mock('../../../src/utils/initiativeHelpers', () => ({
  ACTIVE_STATUSES: [],
  ALL_STATUSES: [],
}));

vi.mock('../../../src/utils/pilotAccess', () => ({
  dispatchPilotAccessBlocked: vi.fn(),
  isPilotParticipantRole: () => false,
}));

vi.mock('../../../src/components/shared/ModuleHub', () => ({
  ModuleHub: ({ children }: any) => <div>{children}</div>,
  HubWorkAreaLoading: () => <div>loading</div>,
  HubWorkAreaLoadError: ({ error, onDismiss }: any) => (
    <div role="alert" data-error-code={error?.code}>
      {error?.code}
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  ),
}));

vi.mock('../../../src/components/shared/ModuleHub/useModuleOpenDocuments', () => ({
  useModuleOpenDocuments: () => ({
    openDocuments: [],
    setOpenDocuments: vi.fn(),
    activeDocumentId: null,
    setActiveDocumentId: vi.fn(),
  }),
}));

vi.mock('../../../src/components/Portfolio/PortfolioKanbanView', () => ({
  PortfolioKanbanView: () => <div>kanban-view</div>,
}));
vi.mock('../../../src/components/Portfolio/PortfolioListView', () => ({
  PortfolioListView: () => <div>list-view</div>,
}));
vi.mock('../../../src/components/Portfolio/InitiativeGridCard', () => ({
  InitiativeGridCard: () => <div>grid-card</div>,
}));
vi.mock('../../../src/components/Initiatives/InitiativesTimelineView', () => ({
  InitiativesTimelineView: () => <div>timeline-view</div>,
}));
vi.mock('../../../src/components/shared/TableWithPreviewLayout', () => ({
  TableWithPreviewLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('../../../src/components/Initiatives/initiativeCreateFlow', () => ({
  getCreatedInitiativeRevealState: () => null,
  normalizeInitiativeForPortfolio: (i: any) => i,
  upsertPortfolioInitiative: vi.fn(),
}));
vi.mock('../../../src/components/Initiatives/InitiativePreviewV3', () => ({
  InitiativePreviewV3Body: () => <div>preview-body</div>,
  InitiativePreviewV3Footer: () => <div>preview-footer</div>,
}));
vi.mock('../../../src/components/Initiatives/initiativesDemoData', () => ({
  createInitiativesDemoDataset: () => ({ initiatives: [] }),
  isShowcaseInitiativeId: () => false,
}));
vi.mock('../../../src/components/Initiatives/Analysis', () => ({
  PortfolioAnalysisView: () => <div>analysis-view</div>,
}));
vi.mock('../../../src/components/MyWork/DecisionDetailView', () => ({
  DecisionDetailView: () => <div>decision-detail</div>,
}));
vi.mock('../../../src/components/MyWork/TaskDetailView', () => ({
  TaskDetailView: () => <div>task-detail</div>,
}));

import { InitiativesHub } from '../../../src/components/Initiatives/InitiativesHub';

describe('InitiativesHub load error quality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error code on load failure and clears on dismiss', async () => {
    mockListRegisteredInitiatives.mockRejectedValue({
      status: 500,
      message: 'canonical runtime failed',
      data: { error: 'Forbidden', code: 'INITIATIVE_NOT_FOUND' },
    });
    mockGetPortfolio.mockRejectedValue({
      status: 500,
      message: 'v8 failed',
      data: { error: 'Forbidden', code: 'INITIATIVE_NOT_FOUND' },
    });
    mockGetInitiatives.mockRejectedValue({
      status: 500,
      message: 'legacy failed',
      data: { error: 'Forbidden', code: 'INITIATIVE_NOT_FOUND' },
    });

    render(
      <MemoryRouter>
        <InitiativesHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('initiatives.hub.failedToLoad')).toBeInTheDocument();
      expect(
        screen.getByText('Failed to load initiatives from the active data source.')
      ).toBeInTheDocument();
      expect(screen.getByText('code: INITIATIVE_NOT_FOUND')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: 'initiatives.hub.retry' });
    const dismissButton = screen.getByRole('button', { name: 'initiatives.hub.dismiss' });
    expect(retryButton.className).toContain('h-9');
    expect(dismissButton.className).toContain('h-9');

    fireEvent.click(dismissButton);
    expect(screen.queryByText('code: INITIATIVE_NOT_FOUND')).not.toBeInTheDocument();
  });
});
