/**
 * BillingOverviewPanel Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BillingOverviewPanel } from '../../../components/SuperAdmin/billing/BillingOverviewPanel';
import { Api } from '../../../services/api';

// Mock the Api module
vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
    },
}));

describe('BillingOverviewPanel', () => {
    const mockStats = {
        mrr: 450000, // $4,500.00 in cents
        arr: 5400000, // $54,000.00
        revenue: {
            total: 1250000,
            invoiceCount: 25,
            period: 30,
        },
        subscriptions: {
            byPlan: [
                { plan_name: 'Starter', price_monthly: 2900, subscriber_count: 10 },
                { plan_name: 'Professional', price_monthly: 9900, subscriber_count: 5 },
                { plan_name: 'Enterprise', price_monthly: 29900, subscriber_count: 2 },
            ],
            trends: [
                { date: '2025-12-25', new_subscriptions: 2, churned: 0 },
                { date: '2025-12-26', new_subscriptions: 1, churned: 1 },
                { date: '2025-12-27', new_subscriptions: 3, churned: 0 },
            ],
        },
        unpaidInvoices: {
            count: 3,
            totalAmount: 35000,
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue(mockStats);
    });

    it('renders loading state initially', () => {
        render(<BillingOverviewPanel />);
        expect(document.querySelector('.animate-spin')).toBeTruthy();
    });

    it('fetches billing stats on mount', async () => {
        render(<BillingOverviewPanel />);
        
        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/billing/stats?period=30');
        });
    });

    it('displays MRR stat card', async () => {
        render(<BillingOverviewPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Monthly Recurring Revenue')).toBeTruthy();
        });
    });

    it('displays revenue stat card', async () => {
        render(<BillingOverviewPanel />);
        
        await waitFor(() => {
            expect(screen.getByText(/Revenue/)).toBeTruthy();
        });
    });

    it('displays active subscriptions count', async () => {
        render(<BillingOverviewPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Active Subscriptions')).toBeTruthy();
        });
    });

    it('displays unpaid invoices warning', async () => {
        render(<BillingOverviewPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Unpaid Invoices')).toBeTruthy();
        });
    });

    it('displays plan distribution section', async () => {
        render(<BillingOverviewPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Plan Distribution')).toBeTruthy();
        });
    });

    it('displays subscription trends section', async () => {
        render(<BillingOverviewPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Subscription Trends')).toBeTruthy();
        });
    });

    it('allows changing period filter', async () => {
        render(<BillingOverviewPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('30d')).toBeTruthy();
        });

        // Click on 7d period
        fireEvent.click(screen.getByText('7d'));

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/billing/stats?period=7');
        });
    });

    it('refreshes data when refresh button is clicked', async () => {
        render(<BillingOverviewPanel />);
        
        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledTimes(1);
        });

        // Find and click refresh button (button with RefreshCw icon)
        const buttons = screen.getAllByRole('button');
        const refreshButton = buttons.find(b => b.querySelector('svg'));
        if (refreshButton) {
            fireEvent.click(refreshButton);
        }

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledTimes(2);
        });
    });

    it('displays plans revenue breakdown', async () => {
        render(<BillingOverviewPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Plans Revenue Breakdown')).toBeTruthy();
        });
    });

    it('handles empty stats gracefully', async () => {
        (Api.get as any).mockResolvedValue({
            mrr: 0,
            arr: 0,
            revenue: { total: 0, invoiceCount: 0, period: 30 },
            subscriptions: { byPlan: [], trends: [] },
            unpaidInvoices: { count: 0, totalAmount: 0 },
        });

        render(<BillingOverviewPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Monthly Recurring Revenue')).toBeTruthy();
        });
    });
});






