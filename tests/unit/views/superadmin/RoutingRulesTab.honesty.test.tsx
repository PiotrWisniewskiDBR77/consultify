import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoutingRulesTab } from '@/views/superadmin/AIPlatformModule/Configuration/RoutingRulesTab';
import { Api } from '@/services/api';
import { toast } from 'react-hot-toast';

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    getLLMTierAssignments: vi.fn(),
    getLLMProviders: vi.fn(),
    getLLMHealthDetailed: vi.fn(),
    getLLMRoutingRules: vi.fn(),
    createLLMRoutingRule: vi.fn(),
    updateLLMRoutingRule: vi.fn(),
    toggleLLMRoutingRule: vi.fn(),
    deleteLLMRoutingRule: vi.fn(),
  },
}));

const rule = {
  id: 'rule-1',
  name: 'Health Failover',
  description: 'Fallback on unhealthy provider',
  type: 'health',
  priority: 1,
  isActive: true,
  config: {},
};

describe('RoutingRulesTab honest workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getLLMTierAssignments).mockResolvedValue({
      assignments: {
        STANDARD: [
          { model_id: 'openai/gpt-4o', priority: 0 },
          { model_id: 'openai/gpt-4o-mini', priority: 1 },
        ],
      },
    });
    vi.mocked(Api.getLLMProviders).mockResolvedValue([
      {
        id: 'provider-1',
        provider: 'openrouter',
        model_id: 'openai/gpt-4o',
        tier: 'STANDARD',
        cost_per_1k: 0.01,
        is_active: true,
      },
    ]);
    vi.mocked(Api.getLLMHealthDetailed).mockResolvedValue({
      summary: { unhealthy: 0, degraded: 0 },
    });
    vi.mocked(Api.getLLMRoutingRules).mockResolvedValue([rule]);
    vi.mocked(Api.createLLMRoutingRule).mockResolvedValue({ id: 'rule-2' });
    vi.mocked(Api.toggleLLMRoutingRule).mockResolvedValue({ ...rule, isActive: false });
    vi.mocked(Api.deleteLLMRoutingRule).mockResolvedValue({ success: true });
  });

  it('does not render routing source failures as an empty routing-rule list', async () => {
    vi.mocked(Api.getLLMRoutingRules).mockRejectedValue(new Error('Routing rules down'));

    render(<RoutingRulesTab />);

    await waitFor(() => {
      expect(screen.getByText('Routing configuration unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Routing rules down')).toBeInTheDocument();
    expect(screen.queryByText('No routing rules yet. Add one to control routing behavior.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Rule/i })).toBeDisabled();
  });

  it('refetches routing rules after create, toggle, and delete workflows', async () => {
    render(<RoutingRulesTab />);

    await waitFor(() => {
      expect(screen.getByText('Health Failover')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Disable'));

    await waitFor(() => {
      expect(Api.toggleLLMRoutingRule).toHaveBeenCalledWith('rule-1', false);
    });
    expect(vi.mocked(Api.getLLMRoutingRules).mock.calls.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole('button', { name: /Add Rule/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g., EU latency guard'), {
      target: { value: 'Created routing rule' },
    });
    fireEvent.change(screen.getByPlaceholderText('What does this rule do?'), {
      target: { value: 'Created from test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(Api.createLLMRoutingRule).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Created routing rule',
          description: 'Created from test',
          type: 'health',
        })
      );
    });
    expect(vi.mocked(Api.getLLMRoutingRules).mock.calls.length).toBeGreaterThanOrEqual(3);

    vi.stubGlobal('confirm', vi.fn(() => true));
    fireEvent.click(screen.getByTitle('Delete'));

    await waitFor(() => {
      expect(Api.deleteLLMRoutingRule).toHaveBeenCalledWith('rule-1');
    });
    expect(vi.mocked(Api.getLLMRoutingRules).mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('accepts deep wrapped routing payloads', async () => {
    vi.mocked(Api.getLLMTierAssignments).mockResolvedValue({
      data: {
        data: {
          assignments: {
            STANDARD: [{ model_id: 'openai/gpt-4o', priority: 0 }],
          },
        },
      },
    });
    vi.mocked(Api.getLLMProviders).mockResolvedValue({
      data: {
        data: {
          providers: [
            {
              id: 'provider-1',
              provider: 'openrouter',
              model_id: 'openai/gpt-4o',
              tier: 'STANDARD',
              cost_per_1k: 0.01,
              is_active: true,
            },
          ],
        },
      },
    });
    vi.mocked(Api.getLLMRoutingRules).mockResolvedValue({
      data: { data: { rules: [rule] } },
    });

    render(<RoutingRulesTab />);

    expect(await screen.findByText('Health Failover')).toBeInTheDocument();
    expect(screen.queryByText('Routing configuration unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed routing rules as an empty healthy list', async () => {
    vi.mocked(Api.getLLMRoutingRules).mockResolvedValue({
      data: { data: { unexpected: true } },
    });

    render(<RoutingRulesTab />);

    await waitFor(() => {
      expect(screen.getByText('Routing configuration unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Routing rules response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No routing rules yet. Add one to control routing behavior.')).not.toBeInTheDocument();
  });

  it('does not claim toggle success when read-back remains stale', async () => {
    render(<RoutingRulesTab />);

    await waitFor(() => {
      expect(screen.getByText('Health Failover')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('Disable'));

    await waitFor(() => {
      expect(screen.getByText('Routing rule toggle was not confirmed by the server')).toBeInTheDocument();
    });
    expect(toast.success).not.toHaveBeenCalledWith('Rule disabled');
  });
});
