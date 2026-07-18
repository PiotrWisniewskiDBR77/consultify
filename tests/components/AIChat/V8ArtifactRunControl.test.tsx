/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { V8ArtifactRunControl } from '../../../src/components/AIChat/V8ArtifactRunControl';

const createRunMutateAsync = vi.fn();
const acceptPlanMutateAsync = vi.fn();
const materializeRunMutateAsync = vi.fn();
const preflightRunMutateAsync = vi.fn();
const retryRunMutateAsync = vi.fn();
const captureSnapshotMutateAsync = vi.fn();
const useV8SnapshotsMock = vi.fn();
const useV8ArtifactRunHistoryMock = vi.fn();
const submitReviewMutateAsync = vi.fn();
const approveExecutionRunMutateAsync = vi.fn();
const rejectExecutionRunMutateAsync = vi.fn();
const useV8ExecutionRunMock = vi.fn();
const useV8ExecutionProposalsMock = vi.fn();
const useV8ExecutionTransitionsMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
  }),
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../../src/hooks/useV8Gate', () => ({
  useV8Gate: () => ({
    showV8Chat: true,
  }),
}));

vi.mock('../../../src/hooks/useV8Chat', () => ({
  useV8Snapshots: (...args: any[]) => useV8SnapshotsMock(...args),
  useV8CaptureSnapshot: () => ({
    mutateAsync: captureSnapshotMutateAsync,
    isPending: false,
  }),
}));

vi.mock('../../../src/hooks/useV8ArtifactRuns', () => ({
  useV8ArtifactRunHistory: (...args: any[]) => useV8ArtifactRunHistoryMock(...args),
  useV8CreateArtifactRunFromChat: () => ({
    mutateAsync: createRunMutateAsync,
    isPending: false,
  }),
  useV8AcceptArtifactRunPlan: () => ({
    mutateAsync: acceptPlanMutateAsync,
    isPending: false,
  }),
  useV8MaterializeArtifactRun: () => ({
    mutateAsync: materializeRunMutateAsync,
    isPending: false,
  }),
  useV8PreflightArtifactRun: () => ({
    mutateAsync: preflightRunMutateAsync,
    isPending: false,
  }),
  useV8RetryArtifactRun: () => ({
    mutateAsync: retryRunMutateAsync,
    isPending: false,
  }),
}));

vi.mock('../../../src/hooks/useV8Execution', () => ({
  useV8ExecutionRun: (...args: any[]) => useV8ExecutionRunMock(...args),
  useV8ExecutionProposals: (...args: any[]) => useV8ExecutionProposalsMock(...args),
  useV8ExecutionTransitions: (...args: any[]) => useV8ExecutionTransitionsMock(...args),
  useV8SubmitExecutionReview: () => ({
    mutateAsync: submitReviewMutateAsync,
    isPending: false,
  }),
  useV8ApproveExecutionRun: () => ({
    mutateAsync: approveExecutionRunMutateAsync,
    isPending: false,
  }),
  useV8RejectExecutionRun: () => ({
    mutateAsync: rejectExecutionRunMutateAsync,
    isPending: false,
  }),
}));

describe('V8ArtifactRunControl', () => {
  beforeEach(() => {
    captureSnapshotMutateAsync.mockReset();
    createRunMutateAsync.mockReset();
    acceptPlanMutateAsync.mockReset();
    materializeRunMutateAsync.mockReset();
    preflightRunMutateAsync.mockReset();
    retryRunMutateAsync.mockReset();
    submitReviewMutateAsync.mockReset();
    approveExecutionRunMutateAsync.mockReset();
    rejectExecutionRunMutateAsync.mockReset();
    useV8SnapshotsMock.mockReset();
    useV8ArtifactRunHistoryMock.mockReset();
    useV8ExecutionRunMock.mockReset();
    useV8ExecutionProposalsMock.mockReset();
    useV8ExecutionTransitionsMock.mockReset();
    preflightRunMutateAsync.mockRejectedValue(new Error('preflight not configured'));
    useV8SnapshotsMock.mockReturnValue({
      data: [{ snapshotId: 'snap-1' }, { snapshotId: 'snap-2' }],
      isLoading: false,
    });
    useV8ExecutionRunMock.mockReturnValue({
      data: null,
      isLoading: false,
    });
    useV8ArtifactRunHistoryMock.mockReturnValue({
      data: [],
      isLoading: false,
    });
    useV8ExecutionProposalsMock.mockReturnValue({
      data: [],
      isLoading: false,
    });
    useV8ExecutionTransitionsMock.mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  it('creates a governed artifact run from the latest snapshot and allows accept/materialize/retry', async () => {
    useV8ExecutionRunMock.mockReturnValue({
      data: {
        runId: 'exec-1',
        organizationId: 'org-1',
        contextSnapshotId: 'snap-2',
        initiatorUserId: 'user-1',
        state: 'approved_for_apply',
        planVersion: 1,
        goal: 'Build board update deck',
        createdAt: '2026-03-24T10:00:00.000Z',
        updatedAt: '2026-03-24T10:01:00.000Z',
        resolvedAt: null,
        expiresAt: null,
        metadata: {},
      },
      isLoading: false,
    });
    useV8ArtifactRunHistoryMock.mockReturnValue({
      data: [
        {
          runId: 'run-1',
          runStatus: 'completed',
          retryOfRunId: null,
        },
        {
          runId: 'run-2',
          runStatus: 'planned',
          retryOfRunId: 'run-1',
        },
      ],
      isLoading: false,
    });
    createRunMutateAsync.mockResolvedValue({
      artifactRunId: 'run-1',
      executionRunId: 'exec-1',
      artifactPlan: {
        artifactFamily: 'document',
        outputType: 'report',
        titleHint: 'Board update report',
        governancePath: 'execution_spine',
        visibilityScope: 'project',
      },
      run: {
        runId: 'run-1',
        artifactId: null,
        organizationId: 'org-1',
        executionRunId: 'exec-1',
        contextSnapshotId: 'snap-2',
        triggerType: 'chat',
        sourceContextType: 'conversation',
        sourceContextId: 'conv-1',
        requestedByUserId: 'user-1',
        plan: {
          artifactFamily: 'document',
          outputType: 'report',
          titleHint: 'Board update report',
          governancePath: 'execution_spine',
          visibilityScope: 'project',
        },
        runStatus: 'planned',
        proposalId: null,
        retryOfRunId: null,
        failureReason: null,
        preflight: null,
        failurePackage: null,
        materializationOrigin: null,
        startedAt: '2026-03-24T10:00:00.000Z',
        completedAt: null,
        createdAt: '2026-03-24T10:00:00.000Z',
        updatedAt: '2026-03-24T10:00:00.000Z',
      },
    });
    preflightRunMutateAsync.mockResolvedValue({
      runId: 'run-1',
      artifactId: null,
      organizationId: 'org-1',
      executionRunId: 'exec-1',
      contextSnapshotId: 'snap-2',
      triggerType: 'chat',
      sourceContextType: 'conversation',
      sourceContextId: 'conv-1',
      requestedByUserId: 'user-1',
      plan: {
        artifactFamily: 'document',
        outputType: 'report',
        titleHint: 'Board update report',
        governancePath: 'execution_spine',
        visibilityScope: 'project',
      },
      runStatus: 'planned',
      proposalId: null,
      retryOfRunId: null,
      failureReason: null,
      preflight: {
        state: 'pending',
        computedAt: '2026-03-24T10:00:01.000Z',
        checks: [
          {
            id: 'execution_run_resolvable',
            status: 'passed',
            message: 'Governed execution run is resolvable',
          },
        ],
      },
      failurePackage: null,
      materializationOrigin: null,
      startedAt: '2026-03-24T10:00:00.000Z',
      completedAt: null,
      createdAt: '2026-03-24T10:00:00.000Z',
      updatedAt: '2026-03-24T10:00:01.000Z',
    });
    acceptPlanMutateAsync.mockResolvedValue({
      runId: 'run-1',
      artifactId: null,
      organizationId: 'org-1',
      executionRunId: 'exec-1',
      contextSnapshotId: 'snap-2',
      triggerType: 'chat',
      sourceContextType: 'conversation',
      sourceContextId: 'conv-1',
      requestedByUserId: 'user-1',
      plan: {
        artifactFamily: 'document',
        outputType: 'report',
        titleHint: 'Board update report',
        governancePath: 'execution_spine',
        visibilityScope: 'project',
      },
      runStatus: 'proposal_created',
      proposalId: 'proposal-7',
      retryOfRunId: null,
      failureReason: null,
      preflight: null,
      failurePackage: null,
      materializationOrigin: null,
      startedAt: '2026-03-24T10:00:00.000Z',
      completedAt: null,
      createdAt: '2026-03-24T10:00:00.000Z',
      updatedAt: '2026-03-24T10:01:00.000Z',
    });
    materializeRunMutateAsync.mockResolvedValue({
      runId: 'run-1',
      artifactId: 'artifact-77',
      organizationId: 'org-1',
      executionRunId: 'exec-1',
      contextSnapshotId: 'snap-2',
      triggerType: 'chat',
      sourceContextType: 'conversation',
      sourceContextId: 'conv-1',
      requestedByUserId: 'user-1',
      plan: {
        artifactFamily: 'document',
        outputType: 'report',
        titleHint: 'Board update report',
        governancePath: 'execution_spine',
        visibilityScope: 'project',
      },
      runStatus: 'completed',
      proposalId: 'proposal-7',
      retryOfRunId: null,
      failureReason: null,
      preflight: null,
      failurePackage: null,
      materializationOrigin: null,
      startedAt: '2026-03-24T10:00:00.000Z',
      completedAt: '2026-03-24T10:02:00.000Z',
      createdAt: '2026-03-24T10:00:00.000Z',
      updatedAt: '2026-03-24T10:02:00.000Z',
    });
    retryRunMutateAsync.mockResolvedValue({
      runId: 'run-2',
      artifactId: null,
      organizationId: 'org-1',
      executionRunId: 'exec-2',
      contextSnapshotId: 'snap-2',
      triggerType: 'chat',
      sourceContextType: 'conversation',
      sourceContextId: 'conv-1',
      requestedByUserId: 'user-1',
      plan: {
        artifactFamily: 'document',
        outputType: 'report',
        titleHint: 'Board update report',
        governancePath: 'execution_spine',
        visibilityScope: 'project',
      },
      runStatus: 'planned',
      proposalId: null,
      retryOfRunId: 'run-1',
      failureReason: null,
      preflight: null,
      failurePackage: null,
      materializationOrigin: null,
      startedAt: '2026-03-24T10:02:00.000Z',
      completedAt: null,
      createdAt: '2026-03-24T10:02:00.000Z',
      updatedAt: '2026-03-24T10:02:00.000Z',
    });

    render(<V8ArtifactRunControl conversationId="conv-1" defaultGoal="Build board update deck" />);

    fireEvent.click(screen.getByTestId('v8-artifact-run-button'));
    fireEvent.change(screen.getByTestId('v8-artifact-run-output-type'), {
      target: { value: 'report' },
    });
    fireEvent.click(screen.getByTestId('v8-artifact-run-plan'));

    await waitFor(() =>
      expect(createRunMutateAsync).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        contextSnapshotId: 'snap-2',
        goal: 'Build board update deck',
        requestedArtifactFamily: 'document',
        requestedOutputType: 'report',
      }),
    );

    await waitFor(() => expect(preflightRunMutateAsync).toHaveBeenCalledWith('run-1'));
    expect(await screen.findByTestId('v8-artifact-run-preflight')).toHaveTextContent(
      'Validation / preflight',
    );

    expect(await screen.findByTestId('v8-artifact-run-summary')).toHaveTextContent(
      'Board update report',
    );

    fireEvent.click(screen.getByTestId('v8-artifact-run-accept'));
    await waitFor(() => expect(acceptPlanMutateAsync).toHaveBeenCalledWith('run-1'));
    expect(await screen.findByText(/Proposal ready/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('v8-artifact-run-materialize'));
    await waitFor(() =>
      expect(materializeRunMutateAsync).toHaveBeenCalledWith({
        runId: 'run-1',
        params: {
          title: 'Board update report',
        },
      }),
    );
    expect(await screen.findByText(/Artifact ready/i)).toBeInTheDocument();
    expect(screen.getByText(/Run history/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('v8-artifact-run-retry'));
    await waitFor(() => expect(retryRunMutateAsync).toHaveBeenCalledWith('run-1'));
  });

  it('keeps the trigger disabled when snapshots are missing', () => {
    useV8SnapshotsMock.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<V8ArtifactRunControl conversationId="conv-1" defaultGoal="Build board update deck" />);

    expect(screen.getByTestId('v8-artifact-run-button')).toBeDisabled();
  });

  it('offers snapshot capture when the chat lane has governance context but no snapshots yet', async () => {
    useV8SnapshotsMock.mockReturnValue({
      data: [],
      isLoading: false,
    });
    captureSnapshotMutateAsync.mockResolvedValue({
      snapshotId: 'snap-new',
    });

    render(
      <V8ArtifactRunControl
        conversationId="conv-1"
        defaultGoal="Build board update deck"
        snapshotContext={{
          workspaceId: '00000000-0000-4000-8000-000000000123',
          projectId: '00000000-0000-4000-8000-000000000456',
          effectiveScopeRef: 'workspace',
          resolvedRoleRef: 'member',
          privacyMode: false,
        }}
      />,
    );

    expect(screen.getByTestId('v8-artifact-run-button')).not.toBeDisabled();
    fireEvent.click(screen.getByTestId('v8-artifact-run-button'));
    fireEvent.click(screen.getByTestId('v8-artifact-run-capture-snapshot'));

    await waitFor(() =>
      expect(captureSnapshotMutateAsync).toHaveBeenCalledWith({
        workspaceId: '00000000-0000-4000-8000-000000000123',
        projectId: '00000000-0000-4000-8000-000000000456',
        conversationId: 'conv-1',
        executionRunId: null,
        artifactRefs: [],
        effectiveScopeRef: 'workspace',
        resolvedRoleRef: 'member',
        consumerClass: 'chat',
        privacyMode: false,
        sourceContextRefs: [],
      }),
    );
  });

  it('offers document, presentation, and sheet outputs in chat control', () => {
    render(<V8ArtifactRunControl conversationId="conv-1" defaultGoal="Build board update deck" />);

    fireEvent.click(screen.getByTestId('v8-artifact-run-button'));

    const select = screen.getByTestId('v8-artifact-run-output-type') as HTMLSelectElement;
    expect(select.options).toHaveLength(3);
    expect(select.options[0]?.value).toBe('report');
    expect(select.options[0]?.textContent).toBe('Document');
    expect(select.options[1]?.value).toBe('presentation');
    expect(select.options[1]?.textContent).toBe('Presentation');
    expect(select.options[2]?.value).toBe('sheet');
    expect(select.options[2]?.textContent).toBe('Sheet');
  });

  it('allows governed sheet planning and materialization into an existing table target', async () => {
    useV8ExecutionRunMock.mockReturnValue({
      data: {
        runId: 'exec-sheet-1',
        organizationId: 'org-1',
        contextSnapshotId: 'snap-2',
        initiatorUserId: 'user-1',
        state: 'approved_for_apply',
        planVersion: 1,
        goal: 'Build governed model sheet',
        createdAt: '2026-03-24T10:00:00.000Z',
        updatedAt: '2026-03-24T10:01:00.000Z',
        resolvedAt: null,
        expiresAt: null,
        metadata: {},
      },
      isLoading: false,
    });
    createRunMutateAsync.mockResolvedValue({
      artifactRunId: 'run-sheet-1',
      executionRunId: 'exec-sheet-1',
      artifactPlan: {
        artifactFamily: 'sheet',
        outputType: 'sheet',
        titleHint: 'Structured sheet draft',
        governancePath: 'execution_spine',
        visibilityScope: 'organization',
      },
      run: {
        runId: 'run-sheet-1',
        artifactId: null,
        organizationId: 'org-1',
        executionRunId: 'exec-sheet-1',
        contextSnapshotId: 'snap-2',
        triggerType: 'chat',
        sourceContextType: 'conversation',
        sourceContextId: 'conv-1',
        requestedByUserId: 'user-1',
        plan: {
          artifactFamily: 'sheet',
          outputType: 'sheet',
          titleHint: 'Structured sheet draft',
          governancePath: 'execution_spine',
          visibilityScope: 'organization',
        },
        runStatus: 'planned',
        proposalId: null,
        retryOfRunId: null,
        failureReason: null,
        preflight: null,
        failurePackage: null,
        materializationOrigin: null,
        startedAt: '2026-03-24T10:00:00.000Z',
        completedAt: null,
        createdAt: '2026-03-24T10:00:00.000Z',
        updatedAt: '2026-03-24T10:00:00.000Z',
      },
    });
    preflightRunMutateAsync.mockResolvedValue({
      runId: 'run-sheet-1',
      artifactId: null,
      organizationId: 'org-1',
      executionRunId: 'exec-sheet-1',
      contextSnapshotId: 'snap-2',
      triggerType: 'chat',
      sourceContextType: 'conversation',
      sourceContextId: 'conv-1',
      requestedByUserId: 'user-1',
      plan: {
        artifactFamily: 'sheet',
        outputType: 'sheet',
        titleHint: 'Structured sheet draft',
        governancePath: 'execution_spine',
        visibilityScope: 'organization',
      },
      runStatus: 'planned',
      proposalId: null,
      retryOfRunId: null,
      failureReason: null,
      preflight: {
        state: 'pending',
        computedAt: '2026-03-24T10:00:01.000Z',
        checks: [
          {
            id: 'materialization_target',
            status: 'pending',
            message: 'Sheet materialization requires a governed table target',
          },
        ],
      },
      failurePackage: null,
      materializationOrigin: null,
      startedAt: '2026-03-24T10:00:00.000Z',
      completedAt: null,
      createdAt: '2026-03-24T10:00:00.000Z',
      updatedAt: '2026-03-24T10:00:01.000Z',
    });
    acceptPlanMutateAsync.mockResolvedValue({
      runId: 'run-sheet-1',
      artifactId: null,
      organizationId: 'org-1',
      executionRunId: 'exec-sheet-1',
      contextSnapshotId: 'snap-2',
      triggerType: 'chat',
      sourceContextType: 'conversation',
      sourceContextId: 'conv-1',
      requestedByUserId: 'user-1',
      plan: {
        artifactFamily: 'sheet',
        outputType: 'sheet',
        titleHint: 'Structured sheet draft',
        governancePath: 'execution_spine',
        visibilityScope: 'organization',
      },
      runStatus: 'proposal_created',
      proposalId: 'proposal-sheet-1',
      retryOfRunId: null,
      failureReason: null,
      preflight: null,
      failurePackage: null,
      materializationOrigin: null,
      startedAt: '2026-03-24T10:00:00.000Z',
      completedAt: null,
      createdAt: '2026-03-24T10:00:00.000Z',
      updatedAt: '2026-03-24T10:01:00.000Z',
    });
    materializeRunMutateAsync.mockResolvedValue({
      runId: 'run-sheet-1',
      artifactId: 'artifact-sheet-1',
      organizationId: 'org-1',
      executionRunId: 'exec-sheet-1',
      contextSnapshotId: 'snap-2',
      triggerType: 'chat',
      sourceContextType: 'conversation',
      sourceContextId: 'conv-1',
      requestedByUserId: 'user-1',
      plan: {
        artifactFamily: 'sheet',
        outputType: 'sheet',
        titleHint: 'Structured sheet draft',
        governancePath: 'execution_spine',
        visibilityScope: 'organization',
      },
      runStatus: 'completed',
      proposalId: 'proposal-sheet-1',
      retryOfRunId: null,
      failureReason: null,
      preflight: null,
      failurePackage: null,
      materializationOrigin: null,
      startedAt: '2026-03-24T10:00:00.000Z',
      completedAt: '2026-03-24T10:02:00.000Z',
      createdAt: '2026-03-24T10:00:00.000Z',
      updatedAt: '2026-03-24T10:02:00.000Z',
    });

    render(<V8ArtifactRunControl conversationId="conv-1" defaultGoal="Build governed model sheet" />);

    fireEvent.click(screen.getByTestId('v8-artifact-run-button'));
    fireEvent.change(screen.getByTestId('v8-artifact-run-output-type'), {
      target: { value: 'sheet' },
    });
    fireEvent.change(screen.getByTestId('v8-artifact-run-sheet-table-id'), {
      target: { value: 'tbl-governed-1' },
    });
    fireEvent.click(screen.getByTestId('v8-artifact-run-plan'));

    await waitFor(() =>
      expect(createRunMutateAsync).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        contextSnapshotId: 'snap-2',
        goal: 'Build governed model sheet',
        requestedArtifactFamily: 'sheet',
        requestedOutputType: 'sheet',
      }),
    );

    fireEvent.click(await screen.findByTestId('v8-artifact-run-accept'));
    await waitFor(() => expect(acceptPlanMutateAsync).toHaveBeenCalledWith('run-sheet-1'));

    fireEvent.click(await screen.findByTestId('v8-artifact-run-materialize'));
    await waitFor(() =>
      expect(materializeRunMutateAsync).toHaveBeenCalledWith({
        runId: 'run-sheet-1',
        params: {
          title: 'Structured sheet draft',
          config: {
            tableId: 'tbl-governed-1',
          },
        },
      }),
    );
  });

  it('allows governed presentation planning and materialization from chat control', async () => {
    useV8ExecutionRunMock.mockReturnValue({
      data: {
        runId: 'exec-p1',
        organizationId: 'org-1',
        contextSnapshotId: 'snap-2',
        initiatorUserId: 'user-1',
        state: 'approved_for_apply',
        planVersion: 1,
        goal: 'Build executive deck',
        createdAt: '2026-03-24T10:00:00.000Z',
        updatedAt: '2026-03-24T10:01:00.000Z',
        resolvedAt: null,
        expiresAt: null,
        metadata: {},
      },
      isLoading: false,
    });
    createRunMutateAsync.mockResolvedValue({
      artifactRunId: 'run-p1',
      executionRunId: 'exec-p1',
      artifactPlan: {
        artifactFamily: 'presentation',
        outputType: 'presentation',
        titleHint: 'Executive board deck',
        governancePath: 'execution_spine',
        visibilityScope: 'private',
      },
      run: {
        runId: 'run-p1',
        artifactId: null,
        organizationId: 'org-1',
        executionRunId: 'exec-p1',
        contextSnapshotId: 'snap-2',
        triggerType: 'chat',
        sourceContextType: 'conversation',
        sourceContextId: 'conv-1',
        requestedByUserId: 'user-1',
        plan: {
          artifactFamily: 'presentation',
          outputType: 'presentation',
          titleHint: 'Executive board deck',
          governancePath: 'execution_spine',
          visibilityScope: 'private',
        },
        runStatus: 'planned',
        proposalId: null,
        retryOfRunId: null,
        failureReason: null,
        preflight: null,
        failurePackage: null,
        materializationOrigin: null,
        startedAt: '2026-03-24T10:00:00.000Z',
        completedAt: null,
        createdAt: '2026-03-24T10:00:00.000Z',
        updatedAt: '2026-03-24T10:00:00.000Z',
      },
    });
    preflightRunMutateAsync.mockResolvedValue({
      runId: 'run-p1',
      artifactId: null,
      organizationId: 'org-1',
      executionRunId: 'exec-p1',
      contextSnapshotId: 'snap-2',
      triggerType: 'chat',
      sourceContextType: 'conversation',
      sourceContextId: 'conv-1',
      requestedByUserId: 'user-1',
      plan: {
        artifactFamily: 'presentation',
        outputType: 'presentation',
        titleHint: 'Executive board deck',
        governancePath: 'execution_spine',
        visibilityScope: 'private',
      },
      runStatus: 'planned',
      proposalId: null,
      retryOfRunId: null,
      failureReason: null,
      preflight: {
        state: 'pending',
        computedAt: '2026-03-24T10:00:01.000Z',
        checks: [
          {
            id: 'materialization_inputs',
            status: 'pending',
            message: 'Presentation materialization may require explicit sourceType/sourceId',
          },
        ],
      },
      failurePackage: null,
      materializationOrigin: null,
      startedAt: '2026-03-24T10:00:00.000Z',
      completedAt: null,
      createdAt: '2026-03-24T10:00:00.000Z',
      updatedAt: '2026-03-24T10:00:01.000Z',
    });
    acceptPlanMutateAsync.mockResolvedValue({
      runId: 'run-p1',
      artifactId: null,
      organizationId: 'org-1',
      executionRunId: 'exec-p1',
      contextSnapshotId: 'snap-2',
      triggerType: 'chat',
      sourceContextType: 'conversation',
      sourceContextId: 'conv-1',
      requestedByUserId: 'user-1',
      plan: {
        artifactFamily: 'presentation',
        outputType: 'presentation',
        titleHint: 'Executive board deck',
        governancePath: 'execution_spine',
        visibilityScope: 'private',
      },
      runStatus: 'proposal_created',
      proposalId: 'proposal-p1',
      retryOfRunId: null,
      failureReason: null,
      preflight: null,
      failurePackage: null,
      materializationOrigin: null,
      startedAt: '2026-03-24T10:00:00.000Z',
      completedAt: null,
      createdAt: '2026-03-24T10:00:00.000Z',
      updatedAt: '2026-03-24T10:01:00.000Z',
    });
    materializeRunMutateAsync.mockResolvedValue({
      runId: 'run-p1',
      artifactId: 'artifact-p1',
      organizationId: 'org-1',
      executionRunId: 'exec-p1',
      contextSnapshotId: 'snap-2',
      triggerType: 'chat',
      sourceContextType: 'conversation',
      sourceContextId: 'conv-1',
      requestedByUserId: 'user-1',
      plan: {
        artifactFamily: 'presentation',
        outputType: 'presentation',
        titleHint: 'Executive board deck',
        governancePath: 'execution_spine',
        visibilityScope: 'private',
      },
      runStatus: 'completed',
      proposalId: 'proposal-p1',
      retryOfRunId: null,
      failureReason: null,
      preflight: null,
      failurePackage: null,
      materializationOrigin: null,
      startedAt: '2026-03-24T10:00:00.000Z',
      completedAt: '2026-03-24T10:02:00.000Z',
      createdAt: '2026-03-24T10:00:00.000Z',
      updatedAt: '2026-03-24T10:02:00.000Z',
    });

    render(<V8ArtifactRunControl conversationId="conv-1" defaultGoal="Build executive deck" />);

    fireEvent.click(screen.getByTestId('v8-artifact-run-button'));
    fireEvent.change(screen.getByTestId('v8-artifact-run-output-type'), {
      target: { value: 'presentation' },
    });
    fireEvent.click(screen.getByTestId('v8-artifact-run-plan'));

    await waitFor(() =>
      expect(createRunMutateAsync).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        contextSnapshotId: 'snap-2',
        goal: 'Build executive deck',
        requestedArtifactFamily: 'presentation',
        requestedOutputType: 'presentation',
      }),
    );

    fireEvent.click(await screen.findByTestId('v8-artifact-run-accept'));
    await waitFor(() => expect(acceptPlanMutateAsync).toHaveBeenCalledWith('run-p1'));

    fireEvent.click(await screen.findByTestId('v8-artifact-run-materialize'));
    await waitFor(() =>
      expect(materializeRunMutateAsync).toHaveBeenCalledWith({
        runId: 'run-p1',
        params: {
          title: 'Executive board deck',
        },
      }),
    );
  });

  it('surfaces governed execution review actions from the artifact run control', async () => {
    createRunMutateAsync.mockResolvedValue({
      artifactRunId: 'run-1',
      executionRunId: 'exec-1',
      artifactPlan: {
        artifactFamily: 'document',
        outputType: 'report',
        titleHint: 'Board update report',
        governancePath: 'execution_spine',
        visibilityScope: 'project',
      },
      run: {
        runId: 'run-1',
        artifactId: null,
        organizationId: 'org-1',
        executionRunId: 'exec-1',
        contextSnapshotId: 'snap-2',
        triggerType: 'chat',
        sourceContextType: 'conversation',
        sourceContextId: 'conv-1',
        requestedByUserId: 'user-1',
        plan: {
          artifactFamily: 'document',
          outputType: 'report',
          titleHint: 'Board update report',
          governancePath: 'execution_spine',
          visibilityScope: 'project',
        },
        runStatus: 'proposal_created',
        proposalId: 'proposal-7',
        retryOfRunId: null,
        failureReason: null,
        preflight: null,
        failurePackage: null,
        materializationOrigin: null,
        startedAt: '2026-03-24T10:00:00.000Z',
        completedAt: null,
        createdAt: '2026-03-24T10:00:00.000Z',
        updatedAt: '2026-03-24T10:00:00.000Z',
      },
    });
    useV8ExecutionRunMock.mockReturnValue({
      data: {
        runId: 'exec-1',
        organizationId: 'org-1',
        contextSnapshotId: 'snap-2',
        initiatorUserId: 'user-1',
        state: 'waiting_for_review',
        planVersion: 1,
        goal: 'Build board update deck',
        createdAt: '2026-03-24T10:00:00.000Z',
        updatedAt: '2026-03-24T10:01:00.000Z',
        resolvedAt: null,
        expiresAt: null,
        metadata: {},
      },
      isLoading: false,
    });
    useV8ExecutionProposalsMock.mockReturnValue({
      data: [
        {
          proposalId: 'proposal-7',
          executionRunId: 'exec-1',
          contextSnapshotRef: 'snap-2',
          proposalType: 'create_artifact',
          summary: 'Create board update report',
          reason: 'Requested from governed chat',
          riskClass: 'safe_additive',
          approvalClass: 'requires_human_approval',
          status: 'pending_review',
          createdAt: '2026-03-24T10:01:00.000Z',
          resolvedAt: null,
          resolvedBy: null,
        },
      ],
      isLoading: false,
    });
    useV8ExecutionTransitionsMock.mockReturnValue({
      data: [
        {
          transitionId: 'tr-1',
          runId: 'exec-1',
          fromState: 'planning',
          toState: 'waiting_for_review',
          triggeredBy: 'user-1',
          reason: 'Submitted for review',
          transitionedAt: '2026-03-24T10:02:00.000Z',
        },
      ],
      isLoading: false,
    });
    approveExecutionRunMutateAsync.mockResolvedValue({
      runId: 'exec-1',
      organizationId: 'org-1',
      contextSnapshotId: 'snap-2',
      initiatorUserId: 'user-1',
      state: 'approved_for_apply',
      planVersion: 1,
      goal: 'Build board update deck',
      createdAt: '2026-03-24T10:00:00.000Z',
      updatedAt: '2026-03-24T10:03:00.000Z',
      resolvedAt: null,
      expiresAt: null,
      metadata: {},
    });
    rejectExecutionRunMutateAsync.mockResolvedValue({
      runId: 'exec-1',
      organizationId: 'org-1',
      contextSnapshotId: 'snap-2',
      initiatorUserId: 'user-1',
      state: 'rejected',
      planVersion: 1,
      goal: 'Build board update deck',
      createdAt: '2026-03-24T10:00:00.000Z',
      updatedAt: '2026-03-24T10:03:00.000Z',
      resolvedAt: null,
      expiresAt: null,
      metadata: {},
    });

    render(<V8ArtifactRunControl conversationId="conv-1" defaultGoal="Build board update deck" />);

    fireEvent.click(screen.getByTestId('v8-artifact-run-button'));
    fireEvent.click(screen.getByTestId('v8-artifact-run-plan'));

    const governancePanel = await screen.findByTestId('v8-artifact-run-governance');
    expect(governancePanel).toHaveTextContent('Governed execution');
    expect(governancePanel).toHaveTextContent('Waiting For Review');
    expect(governancePanel).toHaveTextContent('Proposals');
    expect(await screen.findByText(/Awaiting review/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('v8-artifact-run-approve-review'));
    await waitFor(() =>
      expect(approveExecutionRunMutateAsync).toHaveBeenCalledWith({
        runId: 'exec-1',
        reason: 'Approved from governed artifact run control',
      }),
    );

    fireEvent.click(screen.getByTestId('v8-artifact-run-reject-review'));
    await waitFor(() =>
      expect(rejectExecutionRunMutateAsync).toHaveBeenCalledWith({
        runId: 'exec-1',
        reason: 'Rejected from governed artifact run control',
      }),
    );
  });
});
