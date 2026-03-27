import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { WorkerAnalyticsDashboard } from '../../../src/views/superadmin/VirtualWorkersModule/WorkerAnalyticsDashboard';

const apiGet = vi.fn();

vi.mock('../../../src/services/api', () => ({
  Api: {
    get: (...args: unknown[]) => apiGet(...args),
  },
}));

describe('WorkerAnalyticsDashboard Anna funnel readback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the public Anna funnel section for the anna worker', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === '/api/virtual-workers/worker-anna/analytics') {
        return Promise.resolve({
          data: {
            data: {
              totalConversations: 12,
              totalMessages: 40,
              avgDurationSeconds: 90,
              avgMessagesPerConversation: 3,
              outcomeDistribution: { unknown: 12 },
              channelDistribution: { text_chat: 10, voice: 2 },
              conversationsPerDay: [{ date: '2026-03-27', count: 12 }],
              topKnowledgeSources: [{ source: 'landing-doc', count: 8 }],
            },
          },
        });
      }

      if (url === '/api/superadmin/analytics/anna-funnel') {
        return Promise.resolve({
          data: {
            summary: {
              totalEvents: 9,
              byEvent: {
                landing_anna_widget_opened: 3,
                landing_anna_message_sent: 2,
                landing_anna_handoff_clicked: 3,
                landing_anna_fallback_shown: 1,
              },
              localeDistribution: { en: 6, de: 3 },
              fallbackReasons: { service_unavailable: 1 },
              handoffTargets: { demo: 2, contact: 1 },
            },
            recentEvents: [
              {
                id: 'anna-event-1',
                eventType: 'landing_anna_handoff_clicked',
                source: 'landing_anna',
                metadata: { target: 'demo', locale: 'en' },
                createdAt: '2026-03-27T00:00:00.000Z',
              },
            ],
          },
        });
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    render(<WorkerAnalyticsDashboard workerId="worker-anna" workerSlug="anna" />);

    await waitFor(() => {
      expect(screen.getByText('Public Anna Funnel')).toBeInTheDocument();
    });

    expect(screen.getByText('Widget Opens')).toBeInTheDocument();
    expect(screen.getByText('Messages Sent')).toBeInTheDocument();
    expect(screen.getByText('Handoffs')).toBeInTheDocument();
    expect(screen.getByText('Fallbacks')).toBeInTheDocument();
    expect(screen.getByText('Recent Public Anna Events')).toBeInTheDocument();
    expect(screen.getByText('landing_anna_handoff_clicked')).toBeInTheDocument();
    expect(screen.getByText('target: demo · locale: en')).toBeInTheDocument();
  });

  it('does not load the Anna funnel summary for non-Anna workers', async () => {
    apiGet.mockResolvedValue({
      data: {
        data: {
          totalConversations: 1,
          totalMessages: 2,
          avgDurationSeconds: 15,
          avgMessagesPerConversation: 2,
          outcomeDistribution: { unknown: 1 },
          channelDistribution: { text_chat: 1 },
          conversationsPerDay: [],
          topKnowledgeSources: [],
        },
      },
    });

    render(<WorkerAnalyticsDashboard workerId="worker-other" workerSlug="teresa" />);

    await waitFor(() => {
      expect(screen.getByText('Total Conversations')).toBeInTheDocument();
    });

    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(apiGet).toHaveBeenCalledWith('/api/virtual-workers/worker-other/analytics');
    expect(screen.queryByText('Public Anna Funnel')).not.toBeInTheDocument();
  });
});
