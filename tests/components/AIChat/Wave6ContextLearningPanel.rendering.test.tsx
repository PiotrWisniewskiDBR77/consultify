import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  apiMock: {
    captureWave6ContextSnapshot: vi.fn(),
    captureWave6MemoryCandidate: vi.fn(),
    decideWave6MemoryCandidate: vi.fn(),
    getWave6ContextPanel: vi.fn(),
  },
}));

vi.mock('../../../src/services/api', () => ({
  Api: h.apiMock,
  default: h.apiMock,
}));

import { Wave6ContextLearningPanel } from '../../../src/components/AIChat/Wave6ContextLearningPanel';

describe('Wave6ContextLearningPanel rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.apiMock.getWave6ContextPanel.mockResolvedValue({
      panel: {
        snapshots: [
          {
            snapshotId: 'snapshot-1',
            snapshotType: 'user',
            freshnessAt: '2026-04-27T17:00:00Z',
            facts: {
              conversationId: 'd3808039-20eb-44ae-9e09-863a6c9b1e1a',
              focusMode: 'all',
              hasScreenContext: true,
              userWorkProfilePreferences: 1,
            },
          },
        ],
        memories: [],
      },
    });
  });

  it('renders context snapshot facts as business labels, not raw JSON', async () => {
    const { container } = render(<Wave6ContextLearningPanel />);

    expect(await screen.findByText('Conversation context')).toBeInTheDocument();
    expect(screen.getByText('Linked')).toBeInTheDocument();
    expect(screen.getByText('Focus mode')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Screen context')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('Work profile preferences')).toBeInTheDocument();
    expect(screen.getByText('1 preference')).toBeInTheDocument();

    expect(container).not.toHaveTextContent('"conversationId"');
    expect(container).not.toHaveTextContent('"hasScreenContext"');
    expect(container).not.toHaveTextContent('{');
    expect(container).not.toHaveTextContent('d3808039-20eb-44ae-9e09-863a6c9b1e1a');
  });
});
