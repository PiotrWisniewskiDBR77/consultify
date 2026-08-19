/**
 * @vitest-environment jsdom
 */
import React from 'react';
import axe from 'axe-core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { V8ContextIndicator } from '../../../src/components/AIChat/V8ContextIndicator';

const useV8SnapshotsMock = vi.fn();
const useV8HandoffsMock = vi.fn();
const createHandoffMutateAsync = vi.fn();
const useV8ConversationRetrievalTracesMock = vi.fn();
const refetchSnapshots = vi.fn();
const refetchHandoffs = vi.fn();
const refetchRetrieval = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string, options?: Record<string, unknown>) => {
      if (fallback?.includes('{{count}}') && typeof options?.count !== 'undefined') {
        return fallback.replace('{{count}}', String(options.count));
      }
      return fallback || _key;
    },
  }),
}));

vi.mock('../../../src/hooks/useV8Gate', () => ({
  useV8Gate: () => ({
    showV8Chat: true,
  }),
}));

vi.mock('../../../src/hooks/useV8Chat', () => ({
  useV8Snapshots: (...args: any[]) => useV8SnapshotsMock(...args),
  useV8Handoffs: (...args: any[]) => useV8HandoffsMock(...args),
  useV8CreateHandoff: () => ({
    mutateAsync: createHandoffMutateAsync,
    isPending: false,
  }),
}));

vi.mock('../../../src/hooks/useV8Retrieval', () => ({
  useV8ConversationRetrievalTraces: (...args: any[]) =>
    useV8ConversationRetrievalTracesMock(...args),
}));

describe('V8ContextIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createHandoffMutateAsync.mockReset();
    refetchSnapshots.mockResolvedValue({});
    refetchHandoffs.mockResolvedValue({});
    refetchRetrieval.mockResolvedValue({});
    useV8SnapshotsMock.mockReturnValue({
      data: [{ snapshotId: 'snap-1' }, { snapshotId: 'snap-2' }],
      isLoading: false,
      isError: false,
      refetch: refetchSnapshots,
    });
    useV8HandoffsMock.mockReturnValue({
      data: [
        {
          handoffId: 'handoff-1',
          conversationId: 'conv-1',
          contextSnapshotId: 'snap-2',
          executionRunId: 'run-9',
          organizationId: 'org-1',
          initiatorUserId: 'user-1',
          intentClassification: {
            intentType: 'governed_work',
            confidence: 0.85,
            suggestedAction: 'initiate_execution',
            reasoning: 'Work-producing request',
            classifiedAt: '2026-03-24T10:00:00.000Z',
          },
          goal: 'Create a board update deck',
          createdAt: '2026-03-24T10:01:00.000Z',
        },
      ],
      isLoading: false,
      isError: false,
      refetch: refetchHandoffs,
    });
    useV8ConversationRetrievalTracesMock.mockReturnValue({
      data: [
        {
          traceId: 'trace-1',
          requestId: 'req-1',
          organizationId: 'org-1',
          snapshotId: 'snap-2',
          conversationId: 'conv-1',
          consumerClass: 'chat',
          presetUsed: 'workspace_broad',
          scopeResolutionSummary: {
            tenantId: 'org-1',
            projectId: null,
            scopeTypes: ['workspace'],
            sensitivityCeiling: 'internal',
            privacyMode: false,
          },
          pipelineStages: [],
          candidatesConsidered: 4,
          resultsReturned: 2,
          results: [],
          deniedEntries: [{ sourceRef: 'doc-2', denialReason: 'STALE_ACL' }],
          freshnessWarnings: ['doc-3 stale'],
          totalLatencyMs: 81,
          createdAt: '2026-03-24T10:00:00.000Z',
        },
      ],
      isLoading: false,
      isError: false,
      refetch: refetchRetrieval,
    });
  });

  it('shows governed retrieval evidence for the active conversation', async () => {
    render(<V8ContextIndicator conversationId="conv-1" defaultGoal="Create a board update deck" />);

    expect(screen.getByTestId('v8-context-indicator')).toHaveTextContent('V8 2');
    expect(screen.getByTestId('v8-context-indicator')).toHaveTextContent('RAG 1');
    expect(screen.getByTestId('v8-context-indicator')).toHaveTextContent('H 1');

    fireEvent.click(screen.getByTestId('v8-context-indicator'));

    const panel = await screen.findByTestId('v8-context-panel');
    expect(panel).toHaveTextContent('Governed V8 context');
    expect(panel).toHaveTextContent('2 snapshot(s) captured for this conversation');
    expect(screen.getByTestId('v8-handoff-summary')).toHaveTextContent('Handoffs');
    expect(screen.getByTestId('v8-handoff-summary')).toHaveTextContent('1');
    expect(screen.getByTestId('v8-handoff-summary')).toHaveTextContent('governed_work');
    expect(screen.getByTestId('v8-handoff-summary')).toHaveTextContent(
      'Create a board update deck'
    );
    expect(screen.getByTestId('v8-handoff-summary')).toHaveTextContent('run-9');
    expect(screen.getByTestId('v8-retrieval-summary')).toHaveTextContent('workspace_broad');
    expect(screen.getByTestId('v8-retrieval-summary')).toHaveTextContent('Results');
    expect(screen.getByTestId('v8-retrieval-summary')).toHaveTextContent('2');
    expect(screen.getByTestId('v8-retrieval-summary')).toHaveTextContent('Denied: 1');
    expect(screen.getByTestId('v8-retrieval-summary')).toHaveTextContent('Warnings: 1');
  });

  it('renders only snapshot context when no retrieval traces exist yet', () => {
    useV8ConversationRetrievalTracesMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: refetchRetrieval,
    });
    useV8HandoffsMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: refetchHandoffs,
    });

    render(<V8ContextIndicator conversationId="conv-1" defaultGoal="Create a board update deck" />);

    expect(screen.getByTestId('v8-context-indicator')).toHaveTextContent('V8 2');
    expect(screen.getByTestId('v8-context-indicator')).not.toHaveTextContent('RAG');
    fireEvent.click(screen.getByTestId('v8-context-indicator'));
    expect(screen.getByTestId('v8-handoff-create')).toBeInTheDocument();
  });

  it('creates a governed handoff from the latest snapshot and active goal', async () => {
    useV8HandoffsMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: refetchHandoffs,
    });
    createHandoffMutateAsync.mockResolvedValue({
      handoffId: 'handoff-new',
      executionRunId: 'run-new',
    });

    render(<V8ContextIndicator conversationId="conv-1" defaultGoal="Create a board update deck" />);

    fireEvent.click(screen.getByTestId('v8-context-indicator'));
    fireEvent.click(screen.getByTestId('v8-handoff-create'));

    expect(createHandoffMutateAsync).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      contextSnapshotId: 'snap-2',
      goal: 'Create a board update deck',
    });
  });

  it('keeps provider failures visible, guarded, and retryable instead of disappearing', async () => {
    useV8SnapshotsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchSnapshots,
    });
    useV8HandoffsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchHandoffs,
    });
    useV8ConversationRetrievalTracesMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchRetrieval,
    });

    render(<V8ContextIndicator conversationId="conv-1" defaultGoal="Create a board update deck" />);

    const trigger = screen.getByTestId('v8-context-indicator');
    expect(trigger).toBeVisible();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(screen.getByTestId('v8-context-degraded')).toHaveTextContent(
      'Some governed context is unavailable'
    );
    expect(screen.queryByText(/stack|sql|provider key/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(refetchSnapshots).toHaveBeenCalledTimes(1);
      expect(refetchHandoffs).toHaveBeenCalledTimes(1);
      expect(refetchRetrieval).toHaveBeenCalledTimes(1);
    });
  });

  it('closes on Escape and returns keyboard focus to its trigger', () => {
    render(<V8ContextIndicator conversationId="conv-1" defaultGoal="Create a board update deck" />);

    const trigger = screen.getByTestId('v8-context-indicator');
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByTestId('v8-context-panel')).toHaveAttribute('role', 'dialog');
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByTestId('v8-context-panel')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('has no critical or serious axe violations in the governed context dialog', async () => {
    const { container } = render(
      <V8ContextIndicator conversationId="conv-1" defaultGoal="Create a board update deck" />
    );

    fireEvent.click(screen.getByTestId('v8-context-indicator'));
    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });

    expect(
      results.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')
    ).toEqual([]);
  });
});
