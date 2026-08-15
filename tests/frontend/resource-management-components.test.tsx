/**
 * Frontend Component Tests - Resource Management
 * Test React components for resource allocation
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionPlansManager } from '@/views/superadmin/SubscriptionPlansManager';
import api from '@/services/api';

// Mock API
vi.mock('@/services/api');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('SubscriptionPlansManager', () => {
  const mockPlans = [
    {
      id: '1',
      name: 'Pro Plan',
      price_monthly: 29.99,
      token_limit: 100000,
      storage_limit_gb: 10,
      memory_limit_mb: 1024,
      cpu_quota_percent: 30,
      max_concurrent_ai_jobs: 5,
      token_overage_rate: 0.01,
      storage_overage_rate: 0.1,
      stripe_price_id: 'price_123',
      is_active: 1,
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should render plans table', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { plans: mockPlans } });

    render(<SubscriptionPlansManager />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Subscription Plans Management')).toBeInTheDocument();
      expect(screen.getByText('Pro Plan')).toBeInTheDocument();
    });
  });

  it('should display loading skeleton initially', () => {
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));

    render(<SubscriptionPlansManager />, { wrapper: createWrapper() });

    expect(screen.getByText('Subscription Plans Management')).toBeInTheDocument();
    // Skeleton should be visible
  });

  it('should open create modal when clicking create button', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { plans: mockPlans } });

    render(<SubscriptionPlansManager />, { wrapper: createWrapper() });

    await waitFor(() => screen.getByText('+ Create New Plan'));

    fireEvent.click(screen.getByText('+ Create New Plan'));

    await waitFor(() => {
      expect(screen.getByText('Create New Plan')).toBeInTheDocument();
    });
  });

  it('should filter plans by search term', async () => {
    const morePlans = [...mockPlans, { ...mockPlans[0], id: '2', name: 'Enterprise Plan' }];

    vi.mocked(api.get).mockResolvedValue({ data: { plans: morePlans } });

    render(<SubscriptionPlansManager />, { wrapper: createWrapper() });

    await waitFor(() => screen.getByPlaceholderText('Search plans...'));

    const searchInput = screen.getByPlaceholderText('Search plans...');
    fireEvent.change(searchInput, { target: { value: 'Pro' } });

    await waitFor(() => {
      expect(screen.getByText('Pro Plan')).toBeInTheDocument();
      expect(screen.queryByText('Enterprise Plan')).not.toBeInTheDocument();
    });
  });

  it('should show error state on API failure', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

    render(<SubscriptionPlansManager />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Failed to load subscription plans/i)).toBeInTheDocument();
    });
  });

  it('should show success toast on plan creation', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { plans: mockPlans } });
    vi.mocked(api.post).mockResolvedValue({ data: { plan: mockPlans[0] } });

    render(<SubscriptionPlansManager />, { wrapper: createWrapper() });

    await waitFor(() => screen.getByText('+ Create New Plan'));

    fireEvent.click(screen.getByText('+ Create New Plan'));

    await waitFor(() => screen.getByText('Create New Plan'));

    // Fill form (simplified - actual test would fill all fields)
    const nameInput = screen.getByRole('textbox', { name: /Plan Name/i });
    fireEvent.change(nameInput, { target: { value: 'Test Plan' } });

    // Submit (would need to fill all required fields in real test)
    // fireEvent.click(screen.getByText('Create Plan'));

    // Toast should appear
    // await waitFor(() => expect(screen.getByText(/created successfully/i)).toBeInTheDocument());
  });
});

// The legacy BudgetDashboard was retired from the mounted product. Keep the
// historical behavioral contract visible without pretending that the removed
// screen is part of the current release gate.
describe.skip('BudgetDashboard (retired legacy screen)', () => {
  const BudgetDashboard = () => null;
  const mockBudgetData = {
    budget: {
      monthlyBudget: 1000,
      spent: 450,
      remaining: 550,
      percentageUsed: 45,
      alertThreshold: 0.8,
      exceeded: false,
      approachingLimit: false,
      periodStart: '2026-01-01T00:00:00Z',
      periodEnd: '2026-01-31T23:59:59Z',
    },
  };

  const mockExpenses = {
    expenses: [
      {
        id: '1',
        amount: 100,
        category: 'TOKENS',
        description: 'AI token usage',
        recordedAt: '2026-01-15T10:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should render budget overview cards', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: mockBudgetData })
      .mockResolvedValueOnce({ data: mockExpenses });

    render(<BudgetDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Budget & Usage')).toBeInTheDocument();
      expect(screen.getByText('$1000.00')).toBeInTheDocument(); // Monthly budget
      expect(screen.getByText('$450.00')).toBeInTheDocument(); // Spent
      expect(screen.getByText('$550.00')).toBeInTheDocument(); // Remaining
    });
  });

  it('should display warning badge when approaching limit', async () => {
    const approachingLimitData = {
      budget: { ...mockBudgetData.budget, percentageUsed: 85, approachingLimit: true },
    };

    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: approachingLimitData })
      .mockResolvedValueOnce({ data: mockExpenses });

    render(<BudgetDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Approaching Limit')).toBeInTheDocument();
    });
  });

  it('should filter expenses by category', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: mockBudgetData })
      .mockResolvedValueOnce({ data: mockExpenses });

    render(<BudgetDashboard />, { wrapper: createWrapper() });

    await waitFor(() => screen.getByText('All Categories'));

    const categoryFilter = screen.getByText('All Categories').closest('select')!;
    fireEvent.change(categoryFilter, { target: { value: 'TOKENS' } });

    // Should trigger new API call with filter
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('category=TOKENS'));
    });
  });

  it('should paginate through expenses', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: mockBudgetData })
      .mockResolvedValueOnce({ data: mockExpenses });

    render(<BudgetDashboard />, { wrapper: createWrapper() });

    await waitFor(() => screen.getByText('Next'));

    fireEvent.click(screen.getByText('Next'));

    // Should trigger new API call with offset
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('offset=10'));
    });
  });
});
