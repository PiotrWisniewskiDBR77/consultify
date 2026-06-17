import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { AIUsageDashboard } from '@/components/settings/AIUsageDashboard';

vi.mock('@/services/api', () => ({
  Api: {
    getAIUsageStats: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
  }),
}));

const currentUser = {
  id: 'user-1',
  email: 'user@example.com',
  role: 'USER',
};

describe('AIUsageDashboard honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed usage loads as zero usage with perfect success rate', async () => {
    vi.mocked(Api.getAIUsageStats).mockRejectedValue(new Error('Usage API down'));

    render(<AIUsageDashboard currentUser={currentUser as never} />);

    await waitFor(() => {
      expect(screen.getByText('AI usage unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Usage API down')).toBeInTheDocument();
    expect(screen.queryByText('Total Requests')).not.toBeInTheDocument();
    expect(screen.queryByText('100.0%')).not.toBeInTheDocument();
  });

  it('renders real zero telemetry without NaN values', async () => {
    vi.mocked(Api.getAIUsageStats).mockResolvedValue({
      stats: {
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        avgResponseTime: 0,
        successRate: 0,
        limit: 0,
        used: 0,
      },
      usageByFeature: [{ feature: 'chat', count: 0, tokens: 0, cost: 0, trend: 0 }],
      dailyUsage: [{ date: '2026-04-26', tokens: 0, requests: 0 }],
    });

    render(<AIUsageDashboard currentUser={currentUser as never} />);

    await waitFor(() => {
      expect(screen.getByText('AI Usage Overview')).toBeInTheDocument();
    });

    expect(document.body.textContent).not.toContain('NaN');
    // Honest behavior: the usage-limit card only renders when the backend
    // reports a real limit (hasLimit = limit > 0). With limit:0 the component
    // intentionally hides it rather than showing a fake "0 / 0 tokens".
    expect(document.body.textContent?.replace(/\s+/g, ' ')).not.toContain('0 / 0 tokens');
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });
});
