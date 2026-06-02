import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { AdminEnterpriseOverviewPanel } from '@/components/Admin/AdminEnterpriseOverviewPanel';

vi.mock('@/services/api', () => ({
  Api: {
    getAdminOverview: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('AdminEnterpriseOverviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders partial overview sections instead of failing the whole panel', async () => {
    vi.mocked(Api.getAdminOverview).mockResolvedValue({
      organizationId: 'org-1',
      sectionErrors: {
        people: 'People overview requires people:read capability.',
        security: 'Security overview requires security:read capability.',
        audit: 'Audit overview requires audit:read capability.',
      },
      overview: {
        membersByRole: {},
        totalMembers: null,
        pendingOwnershipTransfers: null,
        securityPolicy: null,
        collaboration: null,
        billing: {
          billing: { status: 'active' },
          plan: { name: 'Professional' },
          usage: { tokenBalance: 1200 },
        },
        ai: {
          governanceSummary: { policyLevel: 'ASSISTED', modelCount: 3 },
          llmPolicy: { review_state: 'approved' },
        },
        audit: null,
      },
    });

    render(<AdminEnterpriseOverviewPanel />);

    await waitFor(() => {
      expect(screen.getByText('People & Access')).toBeInTheDocument();
    });

    expect(screen.queryByText('Admin overview is unavailable')).not.toBeInTheDocument();
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Professional')).toBeInTheDocument();
    expect(screen.getByText('ASSISTED')).toBeInTheDocument();
    expect(screen.getByText('People overview requires people:read capability.')).toBeInTheDocument();
  });
});
