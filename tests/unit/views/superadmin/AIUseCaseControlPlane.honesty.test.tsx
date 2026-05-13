import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { AIUseCaseControlPlane } from '@/views/superadmin/AIPlatformModule/Executive/AIUseCaseControlPlane';

vi.mock('@/services/api', () => ({
  Api: {
    getLLMUseCaseOverview: vi.fn(),
    getAIOperatorOps: vi.fn(),
  },
}));

const overview = {
  summary: {
    total: 1,
    healthy: 1,
    degraded: 0,
    mtdSpendUsd: 42,
    projectedMonthEndSpendUsd: 84,
    impactedOrganizations: 2,
    readinessReady: 1,
    readinessPartial: 0,
    readinessBlocked: 0,
    topVendor: 'openai',
    vendorConcentrationPct: 70,
  },
  useCases: [
    {
      key: 'chat',
      label: 'Chat',
      description: 'Assistant chat',
      businessOwner: 'AI Ops',
      entrypoint: '/chat',
      status: 'healthy',
      completenessStatus: 'ready',
      completenessScore: 95,
      releaseCoveragePct: 90,
      coveragePct: 100,
      healthyPurposes: 1,
      degradedPurposes: 0,
      criticalPurposes: 0,
      costUsd30d: 42,
      requests30d: 120,
      purposes: [
        {
          purpose: 'assistant.chat',
          assignmentCount: 1,
          status: 'healthy',
          policyAllowed: true,
          enabledForOrg: true,
          primary: {
            provider: 'openai',
            name: 'GPT-4o',
            modelId: 'gpt-4o',
            healthStatus: 'healthy',
          },
          fallbacks: [],
          usage: {
            requests30d: 120,
            costUsd30d: 42,
            avgLatencyMs30d: 450,
          },
        },
      ],
    },
  ],
  riskFeed: [
    {
      severity: 'degraded',
      title: 'Release trace partial',
      blastRadius: 'one use case',
      recommendation: 'Publish trace',
    },
  ],
  vendorScorecards: [
    {
      provider: 'openai',
      costUsd: 42,
      requests: 120,
      avgLatencyMs: 450,
      sharePct: 70,
    },
  ],
};

describe('AIUseCaseControlPlane honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getLLMUseCaseOverview).mockResolvedValue(overview);
    vi.mocked(Api.getAIOperatorOps).mockResolvedValue({
      readinessScore: 80,
      autonomyScore: 60,
      guardrails: {
        releaseCoveragePct: 90,
        promptTracePct: 70,
        policyTracePct: 100,
      },
      workstreams: [{ key: 'execution', label: 'Execution', status: 'ready', coveragePct: 90 }],
    });
  });

  it('does not render overview load failures as zero KPI cards', async () => {
    vi.mocked(Api.getLLMUseCaseOverview).mockRejectedValue(new Error('Overview down'));

    render(<AIUseCaseControlPlane />);

    await waitFor(() => {
      expect(screen.getByText('AI use case control plane unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Overview down')).toBeInTheDocument();
    expect(screen.queryByText('Use cases')).not.toBeInTheDocument();
  });

  it('accepts deep wrapped use case overview payloads', async () => {
    vi.mocked(Api.getLLMUseCaseOverview).mockResolvedValue({ data: { data: overview } });

    render(<AIUseCaseControlPlane />);

    await waitFor(() => {
      expect(screen.getByText('Chat')).toBeInTheDocument();
    });
    expect(screen.getByText('assistant.chat')).toBeInTheDocument();
    expect(screen.getByText('Release trace partial')).toBeInTheDocument();
    expect(screen.getByText('openai 70%')).toBeInTheDocument();
  });

  it('does not render malformed overview payloads as healthy empty control plane', async () => {
    vi.mocked(Api.getLLMUseCaseOverview).mockResolvedValue({ data: { data: { useCases: [] } } });

    render(<AIUseCaseControlPlane />);

    await waitFor(() => {
      expect(screen.getByText('AI use case control plane unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Use case overview response was missing summary')).toBeInTheDocument();
    expect(screen.queryByText('Use cases')).not.toBeInTheDocument();
  });

  it('treats operator ops as a soft source', async () => {
    vi.mocked(Api.getAIOperatorOps).mockRejectedValue(new Error('Operator unavailable'));

    render(<AIUseCaseControlPlane />);

    await waitFor(() => {
      expect(screen.getByText('Chat')).toBeInTheDocument();
    });
    expect(screen.queryByText('AI use case control plane unavailable')).not.toBeInTheDocument();
  });
});
