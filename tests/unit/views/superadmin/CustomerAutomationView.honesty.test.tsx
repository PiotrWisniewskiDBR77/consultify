import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Api from '@/services/api';
import CustomerAutomationView from '@/views/superadmin/customers/CustomerAutomationView';

vi.mock('@/services/api', () => ({
  default: {
    createAutomationRule: vi.fn(),
    deleteAutomationRule: vi.fn(),
    getAutomationRules: vi.fn(),
    getRuleExecutions: vi.fn(),
    toggleAutomationRule: vi.fn(),
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

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => <span data-testid="info-button" />,
}));

describe('CustomerAutomationView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed rule loads as empty automation', async () => {
    vi.mocked(Api.getAutomationRules).mockRejectedValue(new Error('Automation API down'));

    render(<CustomerAutomationView />);

    await waitFor(() => {
      expect(screen.getByText('Automation rules unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Automation API down')).toBeInTheDocument();
    expect(screen.queryByText('No automation rules configured')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Rules')).not.toBeInTheDocument();
  });

  it('does not claim rule creation success when read-back is stale', async () => {
    vi.mocked(Api.getAutomationRules).mockResolvedValue([]);
    vi.mocked(Api.createAutomationRule).mockResolvedValue({ success: true });

    render(<CustomerAutomationView />);

    await screen.findByText('No automation rules configured');
    fireEvent.click(screen.getByRole('button', { name: /New Rule/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Trial ending reminder'), {
      target: { value: 'Trial reminder' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create rule/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Automation rule creation was not confirmed by the server')
      ).toBeInTheDocument();
    });
  });

  it('does not claim toggle success when read-back fails', async () => {
    vi.mocked(Api.getAutomationRules)
      .mockResolvedValueOnce([
        {
          id: 'rule-1',
          name: 'Trial reminder',
          trigger_type: 'trial_ending',
          trigger_config: '{}',
          action_type: 'send_email',
          action_config: '{}',
          is_active: false,
          executions_count: 0,
          created_at: '2026-01-01',
        },
      ])
      .mockRejectedValueOnce(new Error('Automation refresh down'));
    vi.mocked(Api.toggleAutomationRule).mockResolvedValue({ success: true });

    render(<CustomerAutomationView />);

    await screen.findByText('Trial reminder');
    fireEvent.click(screen.getByRole('button', { name: /Activate automation rule/i }));

    await waitFor(() => {
      expect(screen.getByText('Automation refresh down')).toBeInTheDocument();
    });
  });

  it('renders invalid execution dates as Unknown date', async () => {
    vi.mocked(Api.getAutomationRules).mockResolvedValue([
      {
        id: 'rule-1',
        name: 'Trial reminder',
        trigger_type: 'trial_ending',
        trigger_config: '{}',
        action_type: 'send_email',
        action_config: '{}',
        is_active: true,
        executions_count: 1,
        last_executed_at: 'not-a-date',
        created_at: '2026-01-01',
      },
    ]);

    render(<CustomerAutomationView />);

    expect(await screen.findByText('Last: Unknown date')).toBeInTheDocument();
  });

  it('accepts wrapped rules, executions, and nested create responses', async () => {
    const initialRule = {
      id: 'rule-1',
      name: 'Trial reminder',
      trigger_type: 'trial_ending',
      trigger_config: '{}',
      action_type: 'send_email',
      action_config: '{}',
      is_active: 'true',
      executions_count: 'bad-count',
      created_at: '2026-01-01',
    };
    const createdRule = {
      ...initialRule,
      id: 'rule-2',
      name: 'Health reminder',
      is_active: false,
      executions_count: 0,
    };
    vi.mocked(Api.getAutomationRules)
      .mockResolvedValueOnce({ data: { data: { rules: [initialRule] } } })
      .mockResolvedValueOnce({ data: { data: { rules: [initialRule, createdRule] } } });
    vi.mocked(Api.getRuleExecutions).mockResolvedValue({
      data: {
        data: {
          executions: [
            {
              id: 'execution-1',
              organization_name: 'Acme',
              status: 'completed',
              executed_at: 'not-a-date',
            },
          ],
        },
      },
    });
    vi.mocked(Api.createAutomationRule).mockResolvedValue({
      data: { data: { rule: { id: 'rule-2' } } },
    });

    const { container } = render(<CustomerAutomationView />);

    expect(await screen.findByText('Trial reminder')).toBeInTheDocument();
    expect(container.textContent).not.toContain('bad-count');

    fireEvent.click(screen.getByRole('button', { name: /View automation rule details rule-1/i }));
    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Unknown date')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
    fireEvent.click(screen.getByRole('button', { name: /New Rule/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Trial ending reminder'), {
      target: { value: 'Health reminder' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create rule/i }));

    await waitFor(() => {
      expect(screen.queryByText('Create automation rule')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Health reminder')).toBeInTheDocument();
  });

  it('does not render malformed automation payloads as empty automation', async () => {
    vi.mocked(Api.getAutomationRules).mockResolvedValue({ unexpected: true });

    render(<CustomerAutomationView />);

    await waitFor(() => {
      expect(screen.getByText('Automation rules unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Automation rules response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No automation rules configured')).not.toBeInTheDocument();
  });
});
