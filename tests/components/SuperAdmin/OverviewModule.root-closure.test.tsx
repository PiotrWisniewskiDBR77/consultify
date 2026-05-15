/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewModule } from '../../../src/views/superadmin/OverviewModule';

vi.mock('react-hot-toast', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('../../../src/components/shared/InfoButton', () => ({
  InfoButton: () => <div>InfoButton</div>,
}));

vi.mock('../../../src/components/SuperAdmin/TabLayout', () => ({
  TabLayout: ({ children, title }: { children: React.ReactNode; title?: string }) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

vi.mock('../../../src/contexts/HelpContext', () => ({
  useHelpSidePanel: () => ({ setHelpDocumentIdOverride: vi.fn() }),
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    getOrganizations: vi.fn().mockResolvedValue([]),
    getSuperAdminDashboard: vi.fn().mockResolvedValue({
      counts: { total_orgs: 0, total_users: 0, active_users_7d: 0 },
      ai: { total_ai_calls: 0, total_tokens: 0 },
      live: { total_active_connections: 0 },
      activity: { total: 0 },
      activities: [],
    }),
  },
}));

vi.mock('../../../src/views/superadmin/FeatureUpdatesAdminView', () => ({
  FeatureUpdatesAdminView: () => <div>FeatureUpdatesAdminView</div>,
}));
vi.mock('../../../src/views/superadmin/SuperAdminDashboard', () => ({
  SuperAdminDashboard: () => <div>SuperAdminDashboard</div>,
}));
vi.mock('../../../src/views/superadmin/SuperAdminMetricsView', () => ({
  SuperAdminMetricsView: () => <div>SuperAdminMetricsView</div>,
}));
vi.mock('../../../src/views/superadmin/SuperAdminSignalsView', () => ({
  SuperAdminSignalsView: () => <div>SuperAdminSignalsView</div>,
}));

describe('OverviewModule superadmin shell content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders overview content without the root closure panel', async () => {
    render(<OverviewModule />);

    expect(screen.queryByText('One visible platform control plane')).not.toBeInTheDocument();
    expect(await screen.findByText('SuperAdminDashboard')).toBeInTheDocument();
  });
});
