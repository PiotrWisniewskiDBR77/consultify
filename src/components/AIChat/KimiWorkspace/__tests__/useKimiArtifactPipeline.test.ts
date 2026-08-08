/**
 * useKimiArtifactPipeline — 3-lane regression test.
 *
 * Validation matrix row L2.4 (Sprint 2 / Table Studio Foundation block).
 * Asserts the hook accepts all three KIMI lanes — `excele`,
 * `prezentacje`, `tabele` — and returns a stable `KimiPipelineState`
 * shape for each lane on initial render. Catches regressions in:
 * - the `KimiLane` union exhaustiveness inside the hook,
 * - the `outputType` and `artifactFamily` switch arms,
 * - the title-fallback ternary,
 * - the Sprint 4 Tabele lane download branch staying non-throwing.
 *
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock V8 hooks — the pipeline pulls heavy mutations and queries from them
// but for regression we just need stable, fast-resolving stubs.
// ---------------------------------------------------------------------------
const mockExecutionData = vi.hoisted(() => ({ current: null as any }));
const mockTablePlatform = vi.hoisted(() => ({
  createBase: vi.fn(),
  createTable: vi.fn(),
  createField: vi.fn(),
}));
const mockV8 = vi.hoisted(() => ({
  acceptPlan: vi.fn(),
  approveRun: vi.fn(),
  captureSnapshot: vi.fn(),
  createRun: vi.fn(),
  materializeRun: vi.fn(),
  preflightRun: vi.fn(),
  retryRun: vi.fn(),
  submitReview: vi.fn(),
}));
const mutation = (mutateAsync = vi.fn().mockResolvedValue(null)) => ({
  mutateAsync,
  isPending: false,
});
const query = (data: unknown = null) => ({ data, isPending: false, isLoading: false });

vi.mock('@/hooks/useV8ArtifactRuns', () => ({
  useV8AcceptArtifactRunPlan: () => mutation(mockV8.acceptPlan),
  useV8CreateArtifactRunFromChat: () => mutation(mockV8.createRun),
  useV8MaterializeArtifactRun: () => mutation(mockV8.materializeRun),
  useV8PreflightArtifactRun: () => mutation(mockV8.preflightRun),
  useV8RetryArtifactRun: () => mutation(mockV8.retryRun),
}));

vi.mock('@/hooks/useV8Chat', () => ({
  useV8CaptureSnapshot: () => mutation(mockV8.captureSnapshot),
  useV8Snapshots: () => query([]),
}));

vi.mock('@/hooks/useV8Execution', () => ({
  useV8ApproveExecutionRun: () => mutation(mockV8.approveRun),
  useV8ExecutionRun: () => query(mockExecutionData.current),
  useV8SubmitExecutionReview: () => mutation(mockV8.submitReview),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn().mockResolvedValue({ data: null }),
    post: vi.fn().mockResolvedValue({ data: null }),
    generateWorkbook: vi.fn().mockResolvedValue(null),
    downloadWorkbook: vi.fn(),
  },
}));

vi.mock('@/services/api/tablePlatform.api', () => ({
  createBase: mockTablePlatform.createBase,
  createTable: mockTablePlatform.createTable,
  createField: mockTablePlatform.createField,
  getTable: vi.fn().mockResolvedValue({ name: 'Table', fields: [] }),
  listRecords: vi.fn().mockResolvedValue({ records: [], total: 0 }),
  listSchemaProposals: vi.fn().mockResolvedValue([]),
  proposeSchemaChange: vi.fn().mockResolvedValue({ id: 'p1' }),
  executeSchemaProposal: vi.fn().mockResolvedValue({ executed: true }),
  rejectSchemaProposal: vi.fn().mockResolvedValue(undefined),
  explainRelation: vi.fn().mockResolvedValue({ relations: [], cacheHit: false, computedInMs: 0 }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const conversationStoreState: {
  activeConversationId: string | null;
  createConversation: ReturnType<typeof vi.fn>;
} = {
  activeConversationId: null,
  createConversation: vi.fn().mockResolvedValue({}),
};
vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: Object.assign(
    (selector: any) => (selector ? selector(conversationStoreState) : conversationStoreState),
    { getState: () => conversationStoreState }
  ),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: any) =>
    selector({
      currentOrganization: { id: 'org-1', name: 'Test Org' },
      currentProjectId: null,
      currentUser: { id: 'user-1', role: 'member' },
    }),
}));

vi.mock('@/utils/sheetArtifactOpen', () => ({
  downloadSheetArtifactXlsx: vi.fn().mockResolvedValue(true),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks are registered).
// ---------------------------------------------------------------------------
import type { KimiLane } from '../KimiWorkspaceShell';
import {
  createGovernedSheetMaterializationTarget,
  resolveTabeleMaterializedTableId,
  useKimiArtifactPipeline,
} from '../useKimiArtifactPipeline';

const LANES: KimiLane[] = ['excele', 'prezentacje', 'tabele'];

describe('useKimiArtifactPipeline — 3-lane regression (L2.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecutionData.current = null;
    conversationStoreState.activeConversationId = null;
    conversationStoreState.createConversation.mockResolvedValue({});
    mockV8.captureSnapshot.mockResolvedValue({ snapshotId: 'snapshot-1' });
    mockV8.createRun.mockResolvedValue({
      artifactPlan: { titleHint: 'Board Update' },
      run: {
        runId: 'run-1',
        runStatus: 'planned',
        plan: { titleHint: 'Board Update' },
      },
    });
    mockV8.preflightRun.mockResolvedValue({
      runId: 'run-1',
      runStatus: 'proposal_created',
      plan: { titleHint: 'Board Update' },
    });
    mockV8.acceptPlan.mockResolvedValue({
      runId: 'run-1',
      runStatus: 'approved_for_apply',
      executionRunId: 'exec-1',
      plan: { titleHint: 'Board Update' },
    });
    mockV8.materializeRun.mockResolvedValue({
      runId: 'run-1',
      runStatus: 'completed',
      plan: { titleHint: 'Board Update' },
      materializationOrigin: { originRuntime: 'presentation', originRecordId: 'deck-1' },
    });
    mockTablePlatform.createBase.mockResolvedValue({ id: 'base-1' });
    mockTablePlatform.createTable.mockResolvedValue({ id: 'table-1' });
    mockTablePlatform.createField.mockResolvedValue({ id: 'field-1' });
  });

  it('creates a governed two-field materialization target for a workbook run', async () => {
    await expect(
      createGovernedSheetMaterializationTarget({
        workspaceId: 'org-1',
        title: 'Initiative Budget',
      })
    ).resolves.toBe('table-1');

    expect(mockTablePlatform.createBase).toHaveBeenCalledWith(
      'org-1',
      'Initiative Budget — governed workspace'
    );
    expect(mockTablePlatform.createTable).toHaveBeenCalledWith(
      'base-1',
      'Initiative Budget',
      'Governed materialization target for Teresa workbook generation.'
    );
    expect(mockTablePlatform.createField).toHaveBeenNthCalledWith(
      1,
      'table-1',
      'Input',
      'text'
    );
    expect(mockTablePlatform.createField).toHaveBeenNthCalledWith(
      2,
      'table-1',
      'Value',
      'number'
    );
  });

  for (const lane of LANES) {
    it(`accepts lane="${lane}" and returns a stable initial KimiPipelineState`, () => {
      const { result } = renderHook(() => useKimiArtifactPipeline(lane));
      const state = result.current;

      expect(state).toBeDefined();
      expect(Array.isArray(state.taskSteps)).toBe(true);
      expect(typeof state.totalSteps).toBe('number');
      expect(state.totalSteps).toBeGreaterThan(0);
      expect(typeof state.completedSteps).toBe('number');
      expect(typeof state.isGenerating).toBe('boolean');
      expect(typeof state.isCompleted).toBe('boolean');
      expect(typeof state.isFailed).toBe('boolean');
      expect(state.preview).toBeNull();
      expect(state.currentRun).toBeNull();
      expect(typeof state.startGeneration).toBe('function');
      expect(typeof state.handleReplay).toBe('function');
      expect(typeof state.handleRemix).toBe('function');
      expect(typeof state.handleDownload).toBe('function');
    });
  }

  it('handleDownload on tabele lane returns without throwing when no artifact is available', async () => {
    const { result } = renderHook(() => useKimiArtifactPipeline('tabele'));
    await expect(result.current.handleDownload()).resolves.toBeUndefined();
  });

  it('requires a sheet materialization origin before Tabele treats a run as a table', () => {
    expect(resolveTabeleMaterializedTableId('tabele', null)).toBeNull();
    expect(
      resolveTabeleMaterializedTableId('tabele', {
        originRuntime: 'presentation',
        originRecordId: 'deck-1',
      } as any)
    ).toBeNull();
    expect(
      resolveTabeleMaterializedTableId('tabele', {
        originRuntime: 'sheet',
        originRecordId: 'table-1',
      })
    ).toBe('table-1');
    expect(
      resolveTabeleMaterializedTableId('excele', {
        originRuntime: 'sheet',
        originRecordId: 'table-1',
      })
    ).toBeNull();
  });

  it('stops presentation generation when preflight fails', async () => {
    conversationStoreState.activeConversationId = 'conversation-1';
    mockV8.preflightRun.mockRejectedValueOnce(new Error('missing required source pack'));

    const { result } = renderHook(() => useKimiArtifactPipeline('prezentacje'));

    await act(async () => {
      await result.current.startGeneration('Create a board update deck');
    });

    await waitFor(() => {
      expect(result.current.isFailed).toBe(true);
    });

    expect(result.current.failureReason).toBe('missing required source pack');
    expect(mockV8.acceptPlan).not.toHaveBeenCalled();
    expect(mockV8.materializeRun).not.toHaveBeenCalled();
  });

  it('stops before materialize when approve step fails', async () => {
    conversationStoreState.activeConversationId = 'conversation-1';
    mockV8.approveRun.mockRejectedValueOnce(new Error('approval endpoint unavailable'));

    const { result } = renderHook(() => useKimiArtifactPipeline('prezentacje'));

    await act(async () => {
      await result.current.startGeneration('Create a board update deck');
    });

    await waitFor(() => {
      expect(result.current.isFailed).toBe(true);
    });

    expect(result.current.failureReason).toBe('approval endpoint unavailable');
    expect(mockV8.materializeRun).not.toHaveBeenCalled();
  });
});
