import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { CustomerHealthView } from '@/views/superadmin/support/CustomerHealthView';

vi.mock('@/services/api', () => ({
  Api: {
    getCustomerHealthCheck: vi.fn(),
    getOrganizations: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
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

describe('CustomerHealthView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed health loads as no health data', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getCustomerHealthCheck).mockRejectedValue(new Error('Health API down'));

    render(<CustomerHealthView />);

    await waitFor(() => {
      expect(screen.getByText('Customer health unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Health API down')).toBeInTheDocument();
    expect(screen.queryByText(/No health data available/i)).not.toBeInTheDocument();
  });

  it('renders loaded health data after a valid response', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getCustomerHealthCheck).mockResolvedValue({
      overall_health: 'Good',
      engagement_level: 'High',
      open_tickets_count: 2,
    });

    render(<CustomerHealthView />);

    expect(await screen.findByText('Good')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('accepts wrapped organization and health payloads', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue({
      data: { data: { organizations: [{ id: 'org-1', name: 'Org One' }] } },
    });
    vi.mocked(Api.getCustomerHealthCheck).mockResolvedValue({
      data: {
        data: {
          overallHealth: 'Excellent',
          engagementLevel: 'High',
          openTicketsCount: 0,
          adoption_score: 95,
        },
      },
    });

    render(<CustomerHealthView />);

    expect(await screen.findByText('Excellent')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.queryByText('Customer health unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed numeric health values as NaN', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getCustomerHealthCheck).mockResolvedValue({
      overall_health: 'Good',
      engagement_score: 'bad-score',
      adoption_score: Number.NaN,
      open_tickets_count: Number.NaN,
    });

    const { container } = render(<CustomerHealthView />);

    expect(await screen.findByText('Good')).toBeInTheDocument();
    expect(container.textContent).not.toContain('NaN');
  });

  it('does not render malformed organization payloads as no health data', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue({ unexpected: true });

    render(<CustomerHealthView />);

    await waitFor(() => {
      expect(screen.getByText('Customer health unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Organizations response was not a list')).toBeInTheDocument();
    expect(screen.queryByText(/No health data available/i)).not.toBeInTheDocument();
  });
});
