import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { PolicyEnforcementTab } from '@/views/superadmin/AIPlatformModule/Policy/PolicyEnforcementTab';

vi.mock('@/services/api', () => ({
  Api: {
    getSuperAdminPolicyEnforcement: vi.fn(),
  },
}));

const enforcementPayload = {
  health: { status: 'degraded' },
  summary: {
    total: 2,
    drift: 2,
    providers: 1,
    connectors: 1,
    workers: 0,
  },
  rows: [
    {
      id: 'provider:p1',
      domain: 'Model provider: DeepSeek',
      desiredState: 'enabled',
      appliedState: 'unknown',
      drift: true,
      note: 'Provider runtime health should match intended platform availability.',
      updatedAt: '2026-04-11T10:00:00Z',
    },
    {
      id: 'connector:slack',
      domain: 'Connector: slack',
      desiredState: 'enabled',
      appliedState: 'partial',
      drift: true,
      note: 'Mixed connector states indicate incomplete propagation across tenants.',
      updatedAt: null,
    },
  ],
};

describe('PolicyEnforcementTab honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getSuperAdminPolicyEnforcement).mockResolvedValue(enforcementPayload);
  });

  it('does not render enforcement telemetry failures as unknown state or zero drift', async () => {
    vi.mocked(Api.getSuperAdminPolicyEnforcement).mockRejectedValue(
      new Error('Policy telemetry down')
    );

    render(<PolicyEnforcementTab />);

    await waitFor(() => {
      expect(screen.getByText('Policy enforcement unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Policy telemetry down')).toBeInTheDocument();
    expect(screen.queryByText('Enforcement state')).not.toBeInTheDocument();
    expect(screen.queryByText('No enforcement data available.')).not.toBeInTheDocument();
  });

  it('shows drift severity, detected date, repair paths, and rollout blocking from live payload', async () => {
    render(<PolicyEnforcementTab />);

    expect(await screen.findByText('Model provider: DeepSeek')).toBeInTheDocument();
    expect(screen.getByText('Connector: slack')).toBeInTheDocument();
    expect(screen.getByText('High-risk rollout blocked: 1 enabled provider has unresolved runtime drift.')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open LLM Providers/i })).toHaveAttribute(
      'href',
      '/superadmin/ai-platform?tab=configuration&subTab=llm-providers'
    );
    expect(screen.getByRole('link', { name: /Open Connector Ops/i })).toHaveAttribute(
      'href',
      '/superadmin/system?tab=integrations'
    );
  });

  it('accepts deep wrapped enforcement payloads and normalizes string drift values', async () => {
    vi.mocked(Api.getSuperAdminPolicyEnforcement).mockResolvedValue({
      data: {
        data: {
          health: { status: 'healthy' },
          summary: { total: 1, drift: 0, providers: 1, connectors: 0, workers: 0 },
          rows: [
            {
              id: 'provider:p1',
              domain: 'Model provider: DeepSeek',
              desiredState: 'enabled',
              appliedState: 'enabled',
              drift: 'false',
              note: 'Aligned',
              updatedAt: 'not-a-date',
            },
          ],
        },
      },
    });

    render(<PolicyEnforcementTab />);

    expect(await screen.findByText('Model provider: DeepSeek')).toBeInTheDocument();
    expect(screen.getAllByText('Aligned').length).toBeGreaterThan(0);
    expect(screen.getByText('n/a')).toBeInTheDocument();
    expect(screen.queryByText(/High-risk rollout blocked/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Policy enforcement unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed enforcement payloads as no enforcement data', async () => {
    vi.mocked(Api.getSuperAdminPolicyEnforcement).mockResolvedValue({
      data: { data: { unexpected: true } },
    });

    render(<PolicyEnforcementTab />);

    await waitFor(() => {
      expect(screen.getByText('Policy enforcement unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Policy enforcement rows response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No enforcement data available.')).not.toBeInTheDocument();
  });
});
