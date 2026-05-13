import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { ComplianceTab } from '@/views/superadmin/AIPlatformModule/Security/ComplianceTab';

vi.mock('@/services/api', () => ({
  Api: {
    getAIGovernanceHealth: vi.fn(),
    getLLMProviders: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const healthPayload = {
  timestamp: '2026-04-26T10:00:00.000Z',
  healthChecks: [
    { name: 'service:governance', status: 'ok', detail: 'Governance service available' },
    { name: 'db:policies', status: 'warn', detail: 'Policy cache lagging' },
  ],
  duplicateMounts: [{ path: '/api/ai', count: 2 }],
};

const providersPayload = [
  { name: 'OpenRouter', provider: 'openrouter' },
  { name: 'Anthropic', provider: 'anthropic' },
];

describe('ComplianceTab honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getAIGovernanceHealth).mockResolvedValue({ data: healthPayload });
    vi.mocked(Api.getLLMProviders).mockResolvedValue(providersPayload);
  });

  it('does not render compliance load failures as zero compliance metrics', async () => {
    vi.mocked(Api.getAIGovernanceHealth).mockRejectedValue(new Error('Compliance API down'));

    render(<ComplianceTab />);

    await waitFor(() => {
      expect(screen.getByText('AI compliance unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Compliance API down')).toBeInTheDocument();
    expect(screen.queryByText('Compliance Score')).not.toBeInTheDocument();
    expect(screen.queryByText('Data Residency Configuration')).not.toBeInTheDocument();
  });

  it('renders compliance data from live governance and provider payloads', async () => {
    render(<ComplianceTab />);

    await waitFor(() => {
      expect(screen.getByText('Compliance Score')).toBeInTheDocument();
    });
    expect(screen.getByText('service:governance')).toBeInTheDocument();
    expect(screen.getByText('Route mounts duplication')).toBeInTheDocument();
    expect(screen.getByText('OpenRouter')).toBeInTheDocument();
    expect(screen.getByText('Anthropic')).toBeInTheDocument();
  });

  it('accepts deep wrapped compliance payloads', async () => {
    vi.mocked(Api.getAIGovernanceHealth).mockResolvedValue({
      data: {
        data: healthPayload,
      },
    });
    vi.mocked(Api.getLLMProviders).mockResolvedValue({
      data: {
        data: providersPayload,
      },
    });

    render(<ComplianceTab />);

    await waitFor(() => {
      expect(screen.getByText('Compliance Score')).toBeInTheDocument();
    });
    expect(screen.getByText('OpenRouter')).toBeInTheDocument();
    expect(screen.queryByText('AI compliance unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed compliance payloads as an empty healthy dashboard', async () => {
    vi.mocked(Api.getAIGovernanceHealth).mockResolvedValue({
      data: {
        data: { unexpected: true },
      },
    });

    render(<ComplianceTab />);

    await waitFor(() => {
      expect(screen.getByText('AI compliance unavailable')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Compliance governance health response was incomplete')
    ).toBeInTheDocument();
    expect(screen.queryByText('Compliance Score')).not.toBeInTheDocument();
  });
});
