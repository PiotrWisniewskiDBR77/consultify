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
const retryRunMutateAsync = vi.fn();
const useV8SnapshotsMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../src/hooks/useV8Gate', () => ({
  useV8Gate: () => ({
    showV8Chat: true,
  }),
}));

vi.mock('../../../src/hooks/useV8Chat', () => ({
  useV8Snapshots: (...args: any[]) => useV8SnapshotsMock(...args),
}));

vi.mock('../../../src/hooks/useV8ArtifactRuns', () => ({
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
  useV8RetryArtifactRun: () => ({
    mutateAsync: retryRunMutateAsync,
    isPending: false,
  }),
}));

describe('V8ArtifactRunControl', () => {
  beforeEach(() => {
    createRunMutateAsync.mockReset();
    acceptPlanMutateAsync.mockReset();
    materializeRunMutateAsync.mockReset();
    retryRunMutateAsync.mockReset();
    useV8SnapshotsMock.mockReset();
    useV8SnapshotsMock.mockReturnValue({
      data: [{ snapshotId: 'snap-1' }, { snapshotId: 'snap-2' }],
      isLoading: false,
    });
  });

  it('creates a governed artifact run from the latest snapshot and allows accept/materialize/retry', async () => {
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
        startedAt: '2026-03-24T10:00:00.000Z',
        completedAt: null,
        createdAt: '2026-03-24T10:00:00.000Z',
        updatedAt: '2026-03-24T10:00:00.000Z',
      },
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
});
