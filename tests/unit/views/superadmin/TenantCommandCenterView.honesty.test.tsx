import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { TenantCommandCenterView } from '@/views/superadmin/TenantCommandCenterView';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    getOrganizationBillingDetails: vi.fn(),
    getOrganizations: vi.fn(),
    getOrgPolicies: vi.fn(),
    getSuperAdminDashboard: vi.fn(),
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

const org = {
  id: 'org-1',
  name: 'Acme',
  status: 'active',
  plan: 'pro',
  user_count: 5,
  monthly_budget_usd: 1000,
  budget_spent_current_period: 100,
};

const dashboard = {
  counts: { active_users_7d: 3, total_users: 5 },
  ai: { total_ai_calls: 42, total_tokens: 1000 },
};

describe('TenantCommandCenterView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getOrganizations).mockResolvedValue([org]);
    vi.mocked(Api.getOrgPolicies).mockResolvedValue({
      policies: [
        {
          organization_id: 'org-1',
          retention_days: 30,
          legal_hold_enabled: 0,
          residency_region: 'eu',
        },
      ],
    });
    vi.mocked(Api.getSuperAdminDashboard).mockResolvedValue(dashboard);
    vi.mocked(Api.getOrganizationBillingDetails).mockResolvedValue({
      subscription: { planName: 'Pro' },
      organization: { userCount: 5 },
    });
    vi.mocked(Api.get).mockResolvedValue({
      budget: {
        monthlyBudgetUsd: 1000,
        remainingBudget: 900,
        spentCurrentPeriod: 100,
        utilizationPercent: 10,
      },
      subscription: {
        maxConcurrentAiJobs: 2,
        memoryLimitMb: 512,
      },
    });
  });

  it('does not render overview load failures as zero tenant metrics', async () => {
    vi.mocked(Api.getOrganizations).mockRejectedValue(new Error('Organizations API down'));

    render(<TenantCommandCenterView />);

    await waitFor(() => {
      expect(screen.getByText('Tenant command center unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Organizations API down')).toBeInTheDocument();
    expect(screen.queryByText('Tenants')).not.toBeInTheDocument();
    expect(screen.queryByText('Tenant focus queue')).not.toBeInTheDocument();
  });

  it('does not render detail telemetry failures as n/a cards', async () => {
    vi.mocked(Api.getOrganizationBillingDetails).mockRejectedValue(
      new Error('Billing detail down')
    );

    render(<TenantCommandCenterView />);

    await waitFor(() => {
      expect(screen.getByText('Tenant detail telemetry unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Billing detail down')).toBeInTheDocument();
    expect(screen.queryByText('Commercial governance')).not.toBeInTheDocument();
    expect(screen.queryByText('Enterprise operator checklist')).not.toBeInTheDocument();
  });

  it('does not render invalid numeric telemetry as NaN', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([
      {
        ...org,
        budget_spent_current_period: Number.NaN,
      },
    ]);
    vi.mocked(Api.get).mockResolvedValue({
      budget: {
        monthlyBudgetUsd: Number.NaN,
        remainingBudget: Number.NaN,
        spentCurrentPeriod: Number.NaN,
        utilizationPercent: Number.NaN,
      },
      subscription: {
        maxConcurrentAiJobs: 2,
        memoryLimitMb: 512,
      },
    });

    const { container } = render(<TenantCommandCenterView />);

    await screen.findByText('Commercial governance');

    expect(container.textContent).not.toContain('NaN');
  });

  it('accepts wrapped overview and tenant detail payloads', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue({
      data: { data: { organizations: [org] } },
    } as unknown as Awaited<ReturnType<typeof Api.getOrganizations>>);
    vi.mocked(Api.getOrgPolicies).mockResolvedValue({
      data: {
        data: {
          policies: [
            {
              organization_id: 'org-1',
              retention_days: 30,
              legal_hold_enabled: 0,
              residency_region: 'eu',
            },
          ],
        },
      },
    });
    vi.mocked(Api.getSuperAdminDashboard).mockResolvedValue({ data: { data: dashboard } });
    vi.mocked(Api.getOrganizationBillingDetails).mockResolvedValue({
      data: {
        data: {
          subscription: { planName: 'Enterprise' },
          organization: { userCount: 5 },
        },
      },
    });
    vi.mocked(Api.get).mockResolvedValue({
      data: {
        data: {
          budget: {
            monthlyBudgetUsd: 1000,
            remainingBudget: 900,
            spentCurrentPeriod: 100,
            utilizationPercent: 10,
          },
          subscription: {
            maxConcurrentAiJobs: 2,
            memoryLimitMb: 512,
          },
        },
      },
    });

    render(<TenantCommandCenterView />);

    expect((await screen.findAllByText('Acme')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Enterprise')).toBeInTheDocument();
    expect(screen.getAllByText('eu').length).toBeGreaterThan(0);
    expect(screen.queryByText('Tenant command center unavailable')).not.toBeInTheDocument();
    expect(screen.queryByText('Tenant detail telemetry unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed organization payloads as zero tenant metrics', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue({
      data: { data: { unexpected: true } },
    } as unknown as Awaited<ReturnType<typeof Api.getOrganizations>>);

    render(<TenantCommandCenterView />);

    await waitFor(() => {
      expect(screen.getByText('Tenant command center unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Organizations response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('Tenants')).not.toBeInTheDocument();
  });
});
