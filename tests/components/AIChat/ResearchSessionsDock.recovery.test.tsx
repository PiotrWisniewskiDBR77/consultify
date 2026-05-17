import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  apiMock: {
    approveResearchSession: vi.fn(),
    cancelResearchSessionV1: vi.fn(),
    createResearchSession: vi.fn(),
    getResearchSession: vi.fn(),
    listResearchSessions: vi.fn(),
    resumeResearchSession: vi.fn(),
    retryResearchSession: vi.fn(),
    startResearchSession: vi.fn(),
  },
}));

vi.mock('../../../src/services/api', () => ({
  Api: h.apiMock,
  default: h.apiMock,
}));

import { ResearchSessionsDock } from '../../../src/components/AIChat/ResearchSessionsDock';

const plannedSession = {
  sessionId: 'research-session-1',
  status: 'planned',
  mission: 'Wave 4 Dock Recovery Regression',
  scope: 'Regression scope',
  allowedSources: ['web', 'org'],
  progress: { stage: 'planned', percent: 0 },
  evidenceGraph: [],
  finalArtifact: null,
};

describe('ResearchSessionsDock recovery', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('keeps cached sessions visible and recovers when manual Refresh hangs', async () => {
    vi.useFakeTimers();
    h.apiMock.listResearchSessions.mockResolvedValueOnce({ sessions: [plannedSession] });

    render(<ResearchSessionsDock />);

    expect((await screen.findAllByText('Wave 4 Dock Recovery Regression')).length).toBeGreaterThan(
      0
    );
    expect(screen.queryByText('Loading research sessions...')).not.toBeInTheDocument();

    h.apiMock.listResearchSessions.mockImplementationOnce(() => new Promise(() => undefined));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(screen.getAllByText('Wave 4 Dock Recovery Regression').length).toBeGreaterThan(0);
    expect(screen.getByText('Refreshing sessions in the background...')).toBeInTheDocument();
    expect(screen.queryByText('Loading research sessions...')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(12000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByText('Research sessions refresh timed out. Please try Refresh again.')
      ).toBeInTheDocument();
    });
    expect(screen.getAllByText('Wave 4 Dock Recovery Regression').length).toBeGreaterThan(0);
    expect(screen.queryByText('Loading research sessions...')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('updates the dock immediately after approve without entering blocking loading state', async () => {
    h.apiMock.listResearchSessions.mockResolvedValueOnce({ sessions: [plannedSession] });
    h.apiMock.approveResearchSession.mockResolvedValueOnce({
      session: {
        ...plannedSession,
        status: 'completed',
        progress: { stage: 'completed', percent: 100 },
      },
    });
    h.apiMock.getResearchSession.mockResolvedValueOnce({
      session: {
        ...plannedSession,
        status: 'completed',
        progress: { stage: 'completed', percent: 100 },
      },
    });
    h.apiMock.listResearchSessions.mockResolvedValueOnce({
      sessions: [
        {
          ...plannedSession,
          status: 'completed',
          progress: { stage: 'completed', percent: 100 },
        },
      ],
    });

    render(<ResearchSessionsDock />);

    expect((await screen.findAllByText('Wave 4 Dock Recovery Regression')).length).toBeGreaterThan(
      0
    );
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(screen.getAllByText('completed').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Loading research sessions...')).not.toBeInTheDocument();
  });
});
