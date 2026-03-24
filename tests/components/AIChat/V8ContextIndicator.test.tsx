/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { V8ContextIndicator } from '../../../src/components/AIChat/V8ContextIndicator';

const useV8SnapshotsMock = vi.fn();
const useV8ConversationRetrievalTracesMock = vi.fn();

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
}));

vi.mock('../../../src/hooks/useV8Retrieval', () => ({
  useV8ConversationRetrievalTraces: (...args: any[]) => useV8ConversationRetrievalTracesMock(...args),
}));

describe('V8ContextIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useV8SnapshotsMock.mockReturnValue({
      data: [{ snapshotId: 'snap-1' }, { snapshotId: 'snap-2' }],
      isLoading: false,
      isError: false,
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
    });
  });

  it('shows governed retrieval evidence for the active conversation', async () => {
    render(<V8ContextIndicator conversationId="conv-1" />);

    expect(screen.getByTestId('v8-context-indicator')).toHaveTextContent('V8 2');
    expect(screen.getByTestId('v8-context-indicator')).toHaveTextContent('RAG 1');

    fireEvent.click(screen.getByTestId('v8-context-indicator'));

    const panel = await screen.findByTestId('v8-context-panel');
    expect(panel).toHaveTextContent('Governed V8 context');
    expect(panel).toHaveTextContent('2 snapshot(s) captured for this conversation');
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
    });

    render(<V8ContextIndicator conversationId="conv-1" />);

    expect(screen.getByTestId('v8-context-indicator')).toHaveTextContent('V8 2');
    expect(screen.getByTestId('v8-context-indicator')).not.toHaveTextContent('RAG');
  });
});
