import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  listCatalog: vi.fn(),
  listSessions: vi.fn(),
  planMission: vi.fn(),
  startMission: vi.fn(),
  emitConnectorsRegistryLoaded: vi.fn(),
  emitResearchMissionPlanned: vi.fn(),
  emitResearchRuntimeStarted: vi.fn(),
  emitResearchRuntimeSucceeded: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'pl' },
  }),
}));

vi.mock('@/models/artifact/ArtifactTypeRegistry', () => ({
  ARTIFACT_TYPES: [],
  EXPORT_FORMATS: [],
}));

vi.mock('@/services/api/v10/artifactRuntime', () => ({
  ArtifactRuntimeApi: {},
}));

vi.mock('@/components/v10/agent/AgentSchedulePanel', () => ({
  AgentSchedulePanel: () => <div data-testid="agent-schedule-panel">Agent schedule panel</div>,
}));

vi.mock('@/services/api/v10/connectorsRuntime', () => ({
  ConnectorsRuntimeApi: {
    listCatalog: mocks.listCatalog,
    listSessions: mocks.listSessions,
    fetch: vi.fn(),
    connectConnector: vi.fn(),
    startAuth: vi.fn(),
    completeAuth: vi.fn(),
    disconnectConnector: vi.fn(),
    search: vi.fn(),
    readSource: vi.fn(),
    refreshTokens: vi.fn(),
  },
}));

vi.mock('@/services/api/v10/researchRuntime', () => ({
  ResearchRuntimeApi: {
    planMission: mocks.planMission,
    startMission: mocks.startMission,
    watchMission: vi.fn(),
    getSummary: vi.fn(),
    delegatePlanFromReasoning: vi.fn(),
  },
}));

vi.mock('@/services/api/v10/onboardingRuntime', () => ({
  OnboardingRuntimeApi: {
    capturePersona: vi.fn(),
    saveSnapshot: vi.fn(),
    resume: vi.fn(),
    recordEvent: vi.fn(),
    getKpiSummary: vi.fn(),
  },
}));

vi.mock('@/services/api/v10/outcomeRuntime', () => ({
  OutcomeRuntimeApi: {
    previewAcceptance: vi.fn(),
    ingestSignal: vi.fn(),
    resolveAcceptance: vi.fn(),
    linkAnalysisToBusinessOutcome: vi.fn(),
  },
}));

vi.mock('@/services/api/baseClient', () => ({
  fetchWithRetry: vi.fn(),
  handleResponse: vi.fn(),
}));

vi.mock('@/utils/v10/pipelinesArtifactMutationPipelineFlag', () => ({
  isPipelinesArtifactMutationPipelineEnabled: () => true,
}));
vi.mock('@/utils/v10/agentScheduleDefinitionFlag', () => ({
  isAgentScheduleDefinitionEnabled: () => true,
}));
vi.mock('@/utils/v10/agentScheduleRegistryFlag', () => ({
  isAgentScheduleRegistryEnabled: () => true,
}));
vi.mock('@/utils/v10/pipelinesAgentSchedulePipelineFlag', () => ({
  isPipelinesAgentSchedulePipelineEnabled: () => true,
}));
vi.mock('@/utils/v10/pipelinesConnectorsIngestPipelineFlag', () => ({
  isPipelinesConnectorsIngestPipelineEnabled: () => true,
}));
vi.mock('@/utils/v10/connectorsRegistryFlag', () => ({
  isConnectorsRegistryEnabled: () => true,
}));
vi.mock('@/utils/v10/connectorsFederatedSearchFlag', () => ({
  isConnectorsFederatedSearchEnabled: () => true,
}));
vi.mock('@/utils/v10/connectorsTokenRefreshRevocationFlag', () => ({
  isConnectorsTokenRefreshRevocationEnabled: () => true,
}));
vi.mock('@/utils/v10/connectorsUserDisconnectFlag', () => ({
  isConnectorsUserDisconnectEnabled: () => true,
}));
vi.mock('@/utils/v10/pipelinesLearningFeedbackPipelineFlag', () => ({
  isPipelinesLearningFeedbackPipelineEnabled: () => true,
}));
vi.mock('@/utils/v10/pipelinesOutcomeRollupPipelineFlag', () => ({
  isPipelinesOutcomeRollupPipelineEnabled: () => true,
}));
vi.mock('@/utils/v10/pipelinesReasoningFastChatPipelineFlag', () => ({
  isPipelinesReasoningFastChatPipelineEnabled: () => true,
}));
vi.mock('@/utils/v10/pipelinesResearchMissionPipelineFlag', () => ({
  isPipelinesResearchMissionPipelineEnabled: () => true,
}));
vi.mock('@/utils/v10/onboardPersonaCaptureFlag', () => ({
  isOnboardPersonaCaptureEnabled: () => true,
}));

vi.mock('@/utils/v10/v10RuntimeTelemetry', () => ({
  bucketHttpStatus: () => '2xx',
  bucketLatencyMs: () => '<1s',
  emitConnectorAuthCompleted: vi.fn(),
  emitConnectorAuthStarted: vi.fn(),
  emitConnectorSessionConnected: vi.fn(),
  emitConnectorSessionDisconnected: vi.fn(),
  emitConnectorsRegistryLoaded: mocks.emitConnectorsRegistryLoaded,
  emitConnectorSourceRead: vi.fn(),
  emitConnectorSourceSearched: vi.fn(),
  emitConnectorTokenRefreshed: vi.fn(),
  emitConnectorsRuntimeFailed: vi.fn(),
  emitConnectorsRuntimeStarted: vi.fn(),
  emitConnectorsRuntimeSucceeded: vi.fn(),
  emitLearningRuntimeFailed: vi.fn(),
  emitLearningRuntimeStarted: vi.fn(),
  emitLearningRuntimeSucceeded: vi.fn(),
  emitOnboardRuntimeFailed: vi.fn(),
  emitOnboardRuntimeStarted: vi.fn(),
  emitOnboardRuntimeSucceeded: vi.fn(),
  emitOutcomeRuntimeFailed: vi.fn(),
  emitOutcomeRuntimeStarted: vi.fn(),
  emitOutcomeRuntimeSucceeded: vi.fn(),
  emitOnboardTelemetryEvent: vi.fn(),
  emitReasoningRuntimeFailed: vi.fn(),
  emitReasoningRuntimeStarted: vi.fn(),
  emitReasoningRuntimeSucceeded: vi.fn(),
  emitResearchRuntimeFailed: vi.fn(),
  emitResearchRuntimeStarted: mocks.emitResearchRuntimeStarted,
  emitResearchRuntimeSucceeded: mocks.emitResearchRuntimeSucceeded,
  inferFailReason: () => 'backend_error',
}));

vi.mock('@/utils/v10/learningLoopTelemetry', () => ({
  bucketItemsCount: () => '0',
  emitLearningLoopDashboardLoaded: vi.fn(),
  emitLearningLoopFeedbackSubmitted: vi.fn(),
  emitLearningLoopIncidentReported: vi.fn(),
  emitLearningLoopRetentionPreviewed: vi.fn(),
  emitLearningLoopStewardshipLoaded: vi.fn(),
  emitLearningLoopStewardshipResolved: vi.fn(),
}));

vi.mock('@/utils/v10/researchFlowTelemetry', () => ({
  bucketEventsCount: () => '0',
  bucketMaxSources: () => '1-10',
  emitReasoningDelegatedResearchPlan: vi.fn(),
  emitResearchMissionPlanned: mocks.emitResearchMissionPlanned,
  emitResearchMissionSummaryLoaded: vi.fn(),
  emitResearchMissionWatchedDelta: vi.fn(),
}));

vi.mock('@/utils/v10/outcomeFlowTelemetry', () => ({
  bucketAcceptedCount: () => '0',
  bucketMetricsCount: () => '1',
  emitOutcomeAcceptanceResolved: vi.fn(),
  emitOutcomeBusinessLinked: vi.fn(),
  emitOutcomeKpiAcceptancePreviewed: vi.fn(),
  emitOutcomeSignalIngested: vi.fn(),
}));

import { ChatV10RuntimesPanel } from '@/components/Admin/ChatV10RuntimesPanel';

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ChatV10RuntimesPanel />
    </QueryClientProvider>
  );
}

describe('ChatV10RuntimesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCatalog.mockResolvedValue({
      generatedAt: '2026-04-23T10:00:00.000Z',
      persona: 'CFO',
      connectors: [
        {
          id: 'google_drive',
          kind: 'external',
          availability: 'available',
          wave: 'wave_a',
          name: 'Google Drive',
          description: 'Docs',
          category: 'storage',
          authStrategy: 'oauth2_pkce',
          capabilities: ['search'],
          readScopes: ['drive.readonly'],
          writeScopes: [],
          aliases: ['drive'],
          recommendedPersonas: ['CFO'],
          entrySurfaces: ['artifact_seed'],
          enabledByDefault: true,
          recommended: true,
        },
      ],
      summary: {
        total: 1,
        available: 1,
        planned: 0,
        external: 1,
        manual: 0,
        virtual: 0,
      },
    });
    mocks.listSessions.mockResolvedValue({
      generatedAt: '2026-04-23T10:00:00.000Z',
      sessions: [],
      summary: { total: 0, connected: 0, pending: 0, needsReauth: 0, disconnected: 0 },
    });
    mocks.planMission.mockResolvedValue({
      missionId: 'mission-123',
      now: '2026-04-23T10:00:00.000Z',
      plan: [{ kind: 'scope', label: 'Scope' }],
      missionSummary: 'planned',
    });
    mocks.startMission.mockResolvedValue({
      missionId: 'mission-123',
      now: '2026-04-23T10:00:01.000Z',
      summary: 'started',
    });
  });

  it('renders the 8-slice host and loads connector registry data', async () => {
    renderPanel();

    expect(screen.getAllByText('Artifact Pipeline').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Agent Runtime').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Onboarding Runtime').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Reasoning Runtime').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Learning Loop').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Research Runtime').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Connectors Runtime').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Outcome Runtime').length).toBeGreaterThan(0);

    await waitFor(() => expect(screen.getByText('Google Drive')).toBeInTheDocument());
    expect(mocks.listCatalog).toHaveBeenCalledWith({ persona: 'CFO', includePlanned: true });
    expect(mocks.listSessions).toHaveBeenCalled();
    expect(mocks.emitConnectorsRegistryLoaded).toHaveBeenCalledWith({
      source: 'admin_panel',
      total: 1,
      available: 1,
      planned: 0,
    });
  });

  it('chains research plan into run using the planned mission id', async () => {
    renderPanel();

    const researchSection = screen.getByRole('button', { name: 'Delegate plan (Reasoning→Research)' }).closest(
      'section'
    );
    if (!researchSection) throw new Error('Research section not found');

    fireEvent.click(within(researchSection).getByRole('button', { name: 'Plan' }));

    await waitFor(() => expect(mocks.planMission).toHaveBeenCalled());
    expect(mocks.emitResearchMissionPlanned).toHaveBeenCalled();
    expect(within(researchSection).getByText(/missionId: mission-123/i)).toBeInTheDocument();

    fireEvent.click(within(researchSection).getByRole('button', { name: 'Run' }));

    await waitFor(() =>
      expect(mocks.startMission).toHaveBeenCalledWith({
        missionId: 'mission-123',
        query: 'Market overview for AI copilots in 2026.',
      })
    );
    expect(mocks.emitResearchRuntimeStarted).toHaveBeenCalledWith({ source: 'admin_panel' });
    expect(mocks.emitResearchRuntimeSucceeded).toHaveBeenCalled();
  });
});
