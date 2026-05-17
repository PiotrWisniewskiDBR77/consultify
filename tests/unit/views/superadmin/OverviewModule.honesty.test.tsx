import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { OverviewModule } from '@/views/superadmin/OverviewModule';

vi.mock('@/services/api', () => ({
  Api: {
    getOrganizations: vi.fn(),
    getSuperAdminDashboard: vi.fn(),
    getSuperAdminSignals: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => <span data-testid="info-button" />,
}));

vi.mock('@/components/SuperAdmin/TabLayout', () => ({
  TabLayout: ({ children, title }: { children: React.ReactNode; title?: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock('@/contexts/HelpContext', () => ({
  useHelpSidePanel: () => ({ setHelpDocumentIdOverride: vi.fn() }),
}));

vi.mock('@/components/Admin/AdminState', () => ({
  DegradedState: ({
    title,
    description,
    action,
  }: {
    title: string;
    description: string;
    action?: React.ReactNode;
  }) => (
    <div role="alert">
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  ),
}));

vi.mock('@/views/superadmin/SuperAdminMetricsView', () => ({
  SuperAdminMetricsView: () => <div>Metrics</div>,
}));

vi.mock('@/views/superadmin/SuperAdminSignalsView', () => ({
  SuperAdminSignalsView: () => <div>Signals tab</div>,
}));

vi.mock('@/views/superadmin/FeatureUpdatesAdminView', () => ({
  FeatureUpdatesAdminView: () => <div>Updates</div>,
}));

const dashboardData = {
  counts: { active_users_7d: 3, total_orgs: 2, total_users: 7 },
  ai: { total_ai_calls: 12, total_tokens: 3456 },
  live: { total_active_connections: 1 },
  activity: { total: 0 },
  activities: [],
};

describe('OverviewModule honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getOrganizations).mockResolvedValue([
      { id: 'org-1', name: 'Org 1', user_count: 4 },
      { id: 'org-2', name: 'Org 2', user_count: 3 },
    ]);
    vi.mocked(Api.getSuperAdminDashboard).mockResolvedValue(dashboardData);
    vi.mocked(Api.getSuperAdminSignals).mockResolvedValue([]);
  });

  it('does not render dashboard load failures as zero metrics', async () => {
    vi.mocked(Api.getSuperAdminDashboard).mockRejectedValue(new Error('Dashboard API down'));

    render(<OverviewModule />);

    await waitFor(() => {
      expect(screen.getByText('Superadmin overview unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Dashboard API down')).toBeInTheDocument();
    expect(screen.queryByText('Live Now')).not.toBeInTheDocument();
    expect(screen.queryByText('Recent Activity')).not.toBeInTheDocument();
  });

  it('does not render failed signals as no active signals', async () => {
    vi.mocked(Api.getSuperAdminSignals).mockRejectedValue(new Error('Signals API down'));

    render(<OverviewModule />);

    await waitFor(() => {
      expect(screen.getByText('Signals unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Signals API down')).toBeInTheDocument();
    expect(screen.queryByText('No active signals')).not.toBeInTheDocument();
  });

  it('does not render invalid dashboard metrics as NaN', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org 1', user_count: 'bad' }]);
    vi.mocked(Api.getSuperAdminDashboard).mockResolvedValue({
      counts: { active_users_7d: 'bad', total_orgs: 'bad', total_users: 'bad' },
      ai: { total_ai_calls: 'bad', total_tokens: 'bad' },
      live: { total_active_connections: 'bad' },
      activity: { total: 'bad' },
      activities: [],
    });

    render(<OverviewModule />);

    await waitFor(() => {
      expect(screen.getAllByText('Organizations').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
    expect(screen.queryByText('NaNk')).not.toBeInTheDocument();
    expect(screen.queryByText('$NaN')).not.toBeInTheDocument();
  });

  it('renders invalid activity timestamps as Unknown time', async () => {
    vi.mocked(Api.getSuperAdminDashboard).mockResolvedValue({
      ...dashboardData,
      activities: [
        {
          id: 'activity-1',
          action: 'updated',
          created_at: 'not-a-date',
          entity_name: 'Broken timestamp',
          entity_type: 'organization',
          user_name: 'System',
        },
      ],
    });

    render(<OverviewModule />);

    expect(await screen.findByText('Unknown time')).toBeInTheDocument();
  });

  it('accepts deep wrapped organization and dashboard payloads', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue({
      data: {
        data: {
          organizations: [
            { id: 'org-1', name: 'Org 1', user_count: 4 },
            { id: 'org-2', name: 'Org 2', user_count: 3 },
          ],
        },
      },
    } as unknown as Awaited<ReturnType<typeof Api.getOrganizations>>);
    vi.mocked(Api.getSuperAdminDashboard).mockResolvedValue({
      data: { data: dashboardData },
    });

    render(<OverviewModule />);

    await waitFor(() => {
      expect(screen.getAllByText('Organizations').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Superadmin overview unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed organization payloads as zero overview metrics', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue({
      data: { data: { unexpected: true } },
    } as unknown as Awaited<ReturnType<typeof Api.getOrganizations>>);

    render(<OverviewModule />);

    await waitFor(() => {
      expect(screen.getByText('Superadmin overview unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Organizations response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('Live Now')).not.toBeInTheDocument();
  });
});
