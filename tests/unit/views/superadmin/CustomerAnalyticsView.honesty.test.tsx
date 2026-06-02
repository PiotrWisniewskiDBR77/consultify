import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Api from '@/services/api';
import CustomerAnalyticsView from '@/views/superadmin/customers/CustomerAnalyticsView';

vi.mock('@/services/api', () => ({
  default: {
    getUsageByOrganization: vi.fn(),
  },
}));

vi.mock('@/components/Admin/AdminState', () => ({
  DegradedState: ({ title, description }: { title: string; description: string }) => (
    <div role="alert">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => <span data-testid="info-button" />,
}));

describe('CustomerAnalyticsView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed analytics loads as empty analytics data', async () => {
    vi.mocked(Api.getUsageByOrganization).mockRejectedValue(new Error('Analytics API down'));

    render(<CustomerAnalyticsView />);

    await waitFor(() => {
      expect(screen.getByText('Customer analytics unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Analytics API down')).toBeInTheDocument();
    expect(screen.queryByText('No analytics data available yet.')).not.toBeInTheDocument();
  });

  it('accepts deeply wrapped analytics payloads and renders safe telemetry', async () => {
    vi.mocked(Api.getUsageByOrganization).mockResolvedValue({
      data: {
        data: {
          items: [
            {
              id: 'org-1',
              name: 'Acme',
              user_count: '5',
              ai_calls_30d: '10',
              health_score: '75.4',
            },
            {
              id: 'org-2',
              name: 'Globex',
              user_count: 'bad-users',
              ai_calls: 'bad-calls',
              health_score: Number.NaN,
            },
          ],
        },
      },
    });

    const { container } = render(<CustomerAnalyticsView />);

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Globex')).toBeInTheDocument();
    expect(screen.getAllByText('75%').length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('NaN');
    expect(container.textContent).not.toContain('bad-');
  });

  it('does not render malformed analytics payloads as empty analytics data', async () => {
    vi.mocked(Api.getUsageByOrganization).mockResolvedValue({ unexpected: true });

    render(<CustomerAnalyticsView />);

    await waitFor(() => {
      expect(screen.getByText('Customer analytics unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Customer analytics response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No analytics data available yet.')).not.toBeInTheDocument();
  });
});
