import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AICostDashboard } from '@/views/superadmin/components/AICostDashboard';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    getLLMCosts: vi.fn(),
    getAIFinOpsOverview: vi.fn(),
  },
}));

const costPayload = {
  totalCost: 12.34,
  currency: 'USD',
  period: 'mtd',
  byProvider: {
    openrouter: { tokens: 5000, cost: 12.34 },
  },
};

const finOpsPayload = {
  overview: {
    mtdSpendUsd: 12.34,
    projectedMonthEndSpendUsd: 25,
    budgetUtilizationPct: 12.5,
    vendorConcentrationPct: 100,
    topVendor: 'openrouter',
    anomalies: [],
  },
};

describe('AICostDashboard honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getLLMCosts).mockResolvedValue(costPayload);
    vi.mocked(Api.getAIFinOpsOverview).mockResolvedValue(finOpsPayload);
  });

  it('does not render failed cost loads as zero cost metrics', async () => {
    vi.mocked(Api.getLLMCosts).mockRejectedValue(new Error('Cost API down'));

    render(<AICostDashboard />);

    await waitFor(() => {
      expect(screen.getByText('AI cost analytics unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Cost API down')).toBeInTheDocument();
    expect(screen.queryByText('Total Cost (MTD)')).not.toBeInTheDocument();
    expect(screen.queryByText('No cost data available yet')).not.toBeInTheDocument();
  });

  it('renders cost metrics from live costs and does not fabricate FinOps projection', async () => {
    vi.mocked(Api.getAIFinOpsOverview).mockRejectedValue(new Error('FinOps unavailable'));

    render(<AICostDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Cost (MTD)')).toBeInTheDocument();
    });

    expect(screen.getAllByText('$12.34').length).toBeGreaterThan(0);
    expect(screen.getByText('5,000 tokens')).toBeInTheDocument();
    expect(screen.getByText('n/a')).toBeInTheDocument();
    expect(screen.queryByText('Budget Utilization')).not.toBeInTheDocument();
  });

  it('accepts deep wrapped cost and FinOps payloads', async () => {
    vi.mocked(Api.getLLMCosts).mockResolvedValue({
      data: {
        data: costPayload,
      },
    });
    vi.mocked(Api.getAIFinOpsOverview).mockResolvedValue({
      data: {
        data: finOpsPayload,
      },
    });

    render(<AICostDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Cost (MTD)')).toBeInTheDocument();
    });
    expect(screen.getAllByText('$12.34').length).toBeGreaterThan(0);
    expect(screen.getByText('Budget Utilization')).toBeInTheDocument();
  });

  it('does not render malformed cost payloads as zero cost metrics', async () => {
    vi.mocked(Api.getLLMCosts).mockResolvedValue({
      totalCost: 0,
    });

    render(<AICostDashboard />);

    await waitFor(() => {
      expect(screen.getByText('AI cost analytics unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('AI cost response was incomplete')).toBeInTheDocument();
    expect(screen.queryByText('Total Cost (MTD)')).not.toBeInTheDocument();
  });
});
