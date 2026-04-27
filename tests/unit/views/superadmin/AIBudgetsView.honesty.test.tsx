import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/services/api';
import AIBudgetsView from '@/views/superadmin/AIBudgetsView';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const emptyPayloads = (path: string) => {
  if (path === '/ai-budgets/stats') {
    return Promise.resolve({ data: { data: { budgets: [], alertCount: 0 } } });
  }
  if (path === '/ai-budgets/model-costs') {
    return Promise.resolve({ data: { data: {} } });
  }
  return Promise.resolve({ data: { data: [] } });
};

const budget = {
  id: 'budget-1',
  organizationId: 'org-1',
  userId: null,
  userEmail: null,
  budgetType: 'cost',
  period: 'monthly',
  budgetLimit: 100,
  currentUsage: 10,
  warningThreshold: 0.8,
  hardLimit: true,
  isActive: true,
  createdAt: '2026-04-26T00:00:00.000Z',
};

const permission = {
  id: 'permission-1',
  scopeType: 'organization',
  scopeId: '',
  modelId: 'gpt-4',
  modelProvider: 'openai',
  isAllowed: true,
  maxTokensPerRequest: null,
  dailyTokenLimit: null,
};

const alert = {
  id: 'alert-1',
  alertType: 'warning',
  title: 'Budget warning',
  message: 'Budget is close to the limit',
  status: 'active',
  currentValue: 80,
  thresholdValue: 100,
  percentage: 80,
  createdAt: 'not-a-date',
};

describe('AIBudgetsView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.mocked(api.get).mockRejectedValue(new Error('AI budgets backend down'));
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render AI budget load failures as empty budgets or zero spend', async () => {
    render(<AIBudgetsView />);

    await waitFor(() => {
      expect(screen.getByText('AI budget controls unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('AI budgets backend down')).toBeInTheDocument();
    expect(screen.queryByText('No budgets configured')).not.toBeInTheDocument();
    expect(screen.queryByText('Total AI Spending')).not.toBeInTheDocument();
    expect(screen.queryByText('Create Budget')).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('keeps create budget modal open when budget creation read-back is stale', async () => {
    vi.mocked(api.get).mockImplementation(emptyPayloads);
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'budget-1' } });

    render(<AIBudgetsView />);

    fireEvent.click(await screen.findByRole('button', { name: /Budgets/i }));
    fireEvent.click(screen.getByRole('button', { name: /Create Budget/i }));
    fireEvent.change(screen.getByLabelText('Budget Limit'), {
      target: { value: '250' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'AI budget creation was not confirmed by the server'
      );
    });
    expect(screen.getAllByText('Create Budget').length).toBeGreaterThan(0);
  });

  it('keeps create budget modal open when create response does not include an id', async () => {
    vi.mocked(api.get).mockImplementation(emptyPayloads);
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });

    render(<AIBudgetsView />);

    fireEvent.click(await screen.findByRole('button', { name: /Budgets/i }));
    fireEvent.click(screen.getByRole('button', { name: /Create Budget/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'AI budget creation response was incomplete'
      );
    });
    expect(screen.getAllByText('Create Budget').length).toBeGreaterThan(0);
  });

  it('does not update or delete budgets when read-back remains stale', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/ai-budgets/budgets') {
        return Promise.resolve({ data: { data: [budget] } });
      }
      return emptyPayloads(path);
    });

    render(<AIBudgetsView />);

    fireEvent.click(await screen.findByRole('button', { name: /Budgets/i }));
    await screen.findByRole('button', { name: /Edit budget budget-1/i });
    fireEvent.click(screen.getByRole('button', { name: /Edit budget budget-1/i }));
    fireEvent.change(screen.getByLabelText('Budget Limit'), {
      target: { value: '250' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'AI budget update was not confirmed by the server'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Delete budget budget-1/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'AI budget deletion was not confirmed by the server'
      );
    });
    expect(screen.getByRole('button', { name: /Delete budget budget-1/i })).toBeInTheDocument();
  });

  it('does not report budget deletion success when read-back is unavailable', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/ai-budgets/budgets') {
        return Promise.resolve({ data: { data: [budget] } });
      }
      return emptyPayloads(path);
    });

    render(<AIBudgetsView />);

    fireEvent.click(await screen.findByRole('button', { name: /Budgets/i }));
    await screen.findByRole('button', { name: /Delete budget budget-1/i });
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/ai-budgets/budgets') {
        return Promise.reject(new Error('Read-back down'));
      }
      return emptyPayloads(path);
    });
    fireEvent.click(screen.getByRole('button', { name: /Delete budget budget-1/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'AI budget deletion was not confirmed by the server'
      );
    });
  });

  it('does not create or delete model permissions when read-back remains stale', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/ai-budgets/model-permissions') {
        return Promise.resolve({ data: { data: [permission] } });
      }
      return emptyPayloads(path);
    });
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'permission-2' } });

    render(<AIBudgetsView />);

    fireEvent.click(await screen.findByRole('button', { name: /Model Access/i }));
    await screen.findByText('gpt-4');
    fireEvent.click(screen.getByRole('button', { name: /Add Restriction/i }));
    fireEvent.change(screen.getAllByRole('combobox')[1], {
      target: { value: 'gpt-4' },
    });
    fireEvent.click(screen.getByLabelText(/Allow access to this model/i));
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Model permission creation was not confirmed by the server'
      );
    });
    expect(screen.getByText('Add Model Restriction')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Delete model permission permission-1/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Model permission deletion was not confirmed by the server'
      );
    });
    expect(screen.getByText('gpt-4')).toBeInTheDocument();
  });

  it('keeps model permission modal open when create response does not include an id', async () => {
    vi.mocked(api.get).mockImplementation(emptyPayloads);
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });

    render(<AIBudgetsView />);

    fireEvent.click(await screen.findByRole('button', { name: /Model Access/i }));
    fireEvent.click(screen.getByRole('button', { name: /Add Restriction/i }));
    fireEvent.change(screen.getAllByRole('combobox')[1], {
      target: { value: 'gpt-4' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Model permission creation response was incomplete'
      );
    });
    expect(screen.getByText('Add Model Restriction')).toBeInTheDocument();
  });

  it('does not render malformed usage and pricing payloads as NaN', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/ai-budgets/stats') {
        return Promise.resolve({
          data: {
            data: {
              budgets: [
                {
                  id: 'usage-1',
                  type: 'cost',
                  period: 'monthly',
                  limit: 'bad-limit',
                  current: 'bad-current',
                  remaining: 'bad-remaining',
                  percentUsed: 'bad-percent',
                },
              ],
              alertCount: 'bad-alert-count',
            },
          },
        });
      }
      if (path === '/ai-budgets/model-costs') {
        return Promise.resolve({
          data: { data: { 'gpt-bad': { input: 'bad-input', output: 'bad-output' } } },
        });
      }
      return emptyPayloads(path);
    });

    render(<AIBudgetsView />);

    await screen.findByText('Budget Utilization');

    expect(screen.queryByText(/NaN|bad-/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
  });

  it('does not acknowledge or dismiss alerts when read-back remains stale', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/ai-budgets/alerts?status=active') {
        return Promise.resolve({ data: { data: [alert] } });
      }
      return emptyPayloads(path);
    });

    render(<AIBudgetsView />);

    fireEvent.click(await screen.findByRole('button', { name: /Alerts/i }));
    await screen.findByText('Budget warning');
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Acknowledge alert alert-1/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'AI budget alert acknowledgement was not confirmed by the server'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /Dismiss alert alert-1/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'AI budget alert dismissal was not confirmed by the server'
      );
    });
    expect(screen.getByText('Budget warning')).toBeInTheDocument();
  });

  it('accepts wrapped budget alert payloads and renders malformed percentages safely', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/ai-budgets/alerts?status=active') {
        return Promise.resolve({
          data: {
            data: { alerts: [{ ...alert, percentage: 'bad-percent', createdAt: 'not-a-date' }] },
          },
        });
      }
      return emptyPayloads(path);
    });

    render(<AIBudgetsView />);

    fireEvent.click(await screen.findByRole('button', { name: /Alerts/i }));

    expect(await screen.findByText('Budget warning')).toBeInTheDocument();
    expect(screen.getByText('0.0% of limit')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date|NaN|bad-percent/i)).not.toBeInTheDocument();
  });

  it('does not render malformed budget payloads as empty budgets or zero spend', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/ai-budgets/budgets') {
        return Promise.resolve({ data: { data: { unexpected: true } } });
      }
      return emptyPayloads(path);
    });

    render(<AIBudgetsView />);

    await waitFor(() => {
      expect(screen.getByText('AI budget controls unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('AI budgets response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No budgets configured')).not.toBeInTheDocument();
    expect(screen.queryByText('Total AI Spending')).not.toBeInTheDocument();
  });
});
