/**
 * SubscriptionsPanel Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SubscriptionsPanel } from '../../../components/SuperAdmin/billing/SubscriptionsPanel';
import { Api } from '../../../services/api';

// Mock the Api module
vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        getOrganizations: vi.fn(),
    },
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('SubscriptionsPanel', () => {
    const mockOrganizations = [
        { id: 'org-1', name: 'Test Organization' },
        { id: 'org-2', name: 'Another Org' },
    ];

    const mockPlans = [
        { id: 'plan-1', name: 'Starter', price_monthly: 2900, features: ['Feature 1'], is_active: 1 },
        { id: 'plan-2', name: 'Pro', price_monthly: 9900, features: ['Feature 1', 'Feature 2'], is_active: 1 },
        { id: 'plan-3', name: 'Enterprise', price_monthly: 29900, features: ['All features'], is_active: 1 },
    ];

    const mockSubscriptions = [
        {
            id: 'sub-1',
            organization_id: 'org-1',
            organization_name: 'Test Organization',
            plan_id: 'plan-2',
            plan_name: 'Pro',
            price_monthly: 9900,
            status: 'active',
            billing_cycle: 'monthly',
            current_period_start: '2025-01-01',
            current_period_end: '2025-02-01',
            cancel_at_period_end: 0,
            created_at: '2024-01-01T10:00:00Z',
        },
        {
            id: 'sub-2',
            organization_id: 'org-2',
            organization_name: 'Another Org',
            plan_id: 'plan-1',
            plan_name: 'Starter',
            price_monthly: 2900,
            status: 'trialing',
            billing_cycle: 'monthly',
            trial_start: '2025-01-01',
            trial_end: '2025-01-15',
            cancel_at_period_end: 0,
            created_at: '2025-01-01T10:00:00Z',
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.getOrganizations as any).mockResolvedValue(mockOrganizations);
        (Api.get as any).mockImplementation((url: string) => {
            if (url.includes('/billing/subscriptions')) {
                return Promise.resolve({ subscriptions: mockSubscriptions });
            }
            if (url.includes('/billing/plans')) {
                return Promise.resolve({ plans: mockPlans });
            }
            return Promise.resolve({});
        });
    });

    it('renders loading state initially', () => {
        render(<SubscriptionsPanel />);
        expect(document.querySelector('.animate-spin')).toBeTruthy();
    });

    it('fetches data on mount', async () => {
        render(<SubscriptionsPanel />);
        
        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/billing/subscriptions');
            expect(Api.get).toHaveBeenCalledWith('/billing/plans');
            expect(Api.getOrganizations).toHaveBeenCalled();
        });
    });

    it('displays subscriptions', async () => {
        render(<SubscriptionsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Test Organization')).toBeTruthy();
            expect(screen.getByText('Another Org')).toBeTruthy();
        });
    });

    it('displays plan names', async () => {
        render(<SubscriptionsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Pro')).toBeTruthy();
            expect(screen.getByText('Starter')).toBeTruthy();
        });
    });

    it('displays subscription prices', async () => {
        render(<SubscriptionsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('$99.00/mo')).toBeTruthy();
            expect(screen.getByText('$29.00/mo')).toBeTruthy();
        });
    });

    it('shows active status badge', async () => {
        render(<SubscriptionsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Active')).toBeTruthy();
        });
    });

    it('shows trialing status badge', async () => {
        render(<SubscriptionsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Trialing')).toBeTruthy();
        });
    });

    it('shows New Subscription button', async () => {
        render(<SubscriptionsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('New Subscription')).toBeTruthy();
        });
    });

    it('opens create modal when New Subscription is clicked', async () => {
        render(<SubscriptionsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('New Subscription')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('New Subscription'));

        await waitFor(() => {
            expect(screen.getByText('Create Subscription')).toBeTruthy();
        });
    });

    it('creates subscription when form is submitted', async () => {
        (Api.post as any).mockResolvedValue({ success: true });
        
        render(<SubscriptionsPanel />);
        
        await waitFor(() => {
            fireEvent.click(screen.getByText('New Subscription'));
        });

        await waitFor(() => {
            expect(screen.getByText('Create Subscription')).toBeTruthy();
        });

        // Select organization
        const orgSelect = screen.getByDisplayValue('Select organization');
        fireEvent.change(orgSelect, { target: { value: 'org-1' } });

        // Select plan
        const planSelect = screen.getByDisplayValue('Select plan');
        fireEvent.change(planSelect, { target: { value: 'plan-1' } });

        // Click Create
        fireEvent.click(screen.getByText('Create'));

        await waitFor(() => {
            expect(Api.post).toHaveBeenCalledWith('/billing/subscriptions', expect.objectContaining({
                organizationId: 'org-1',
                planId: 'plan-1',
            }));
        });
    });

    it('filters subscriptions by status', async () => {
        render(<SubscriptionsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Test Organization')).toBeTruthy();
        });

        const statusSelect = screen.getByDisplayValue('All Status');
        fireEvent.change(statusSelect, { target: { value: 'active' } });

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/billing/subscriptions?status=active');
        });
    });

    it('filters subscriptions by search query', async () => {
        render(<SubscriptionsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Test Organization')).toBeTruthy();
            expect(screen.getByText('Another Org')).toBeTruthy();
        });

        const searchInput = screen.getByPlaceholderText('Search subscriptions...');
        fireEvent.change(searchInput, { target: { value: 'Test' } });

        await waitFor(() => {
            expect(screen.getByText('Test Organization')).toBeTruthy();
            expect(screen.queryByText('Another Org')).toBeFalsy();
        });
    });

    it('shows cancel button for active subscriptions', async () => {
        render(<SubscriptionsPanel />);
        
        await waitFor(() => {
            const cancelButtons = screen.getAllByTitle('Cancel');
            expect(cancelButtons.length).toBeGreaterThan(0);
        });
    });

    it('cancels subscription when cancel button is clicked', async () => {
        (Api.post as any).mockResolvedValue({ success: true });
        
        render(<SubscriptionsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Test Organization')).toBeTruthy();
        });

        const cancelButtons = screen.getAllByTitle('Cancel');
        fireEvent.click(cancelButtons[0]);

        await waitFor(() => {
            expect(Api.post).toHaveBeenCalledWith('/billing/subscriptions/sub-1/cancel', { immediately: false });
        });
    });

    it('opens manage modal when manage button is clicked', async () => {
        render(<SubscriptionsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Test Organization')).toBeTruthy();
        });

        const manageButtons = screen.getAllByTitle('Manage');
        fireEvent.click(manageButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('Manage Subscription')).toBeTruthy();
            expect(screen.getByText('Current Plan')).toBeTruthy();
        });
    });

    it('changes plan from manage modal', async () => {
        (Api.put as any).mockResolvedValue({ success: true });
        
        render(<SubscriptionsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Test Organization')).toBeTruthy();
        });

        // Open manage modal
        const manageButtons = screen.getAllByTitle('Manage');
        fireEvent.click(manageButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('Change Plan')).toBeTruthy();
        });

        // Change plan
        const planSelect = screen.getByDisplayValue(/Pro/);
        fireEvent.change(planSelect, { target: { value: 'plan-3' } });

        await waitFor(() => {
            expect(Api.put).toHaveBeenCalledWith('/billing/subscriptions/sub-1', { planId: 'plan-3' });
        });
    });

    it('shows empty state when no subscriptions', async () => {
        (Api.get as any).mockImplementation((url: string) => {
            if (url.includes('/billing/subscriptions')) {
                return Promise.resolve({ subscriptions: [] });
            }
            if (url.includes('/billing/plans')) {
                return Promise.resolve({ plans: mockPlans });
            }
            return Promise.resolve({});
        });
        
        render(<SubscriptionsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('No subscriptions found')).toBeTruthy();
        });
    });

    it('shows trial end date for trialing subscriptions', async () => {
        render(<SubscriptionsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText(/Trial ends/)).toBeTruthy();
        });
    });

    it('shows renewal date for active subscriptions', async () => {
        render(<SubscriptionsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText(/Renews/)).toBeTruthy();
        });
    });

    it('closes modals when cancel/close is clicked', async () => {
        render(<SubscriptionsPanel />);
        
        await waitFor(() => {
            fireEvent.click(screen.getByText('New Subscription'));
        });

        await waitFor(() => {
            expect(screen.getByText('Create Subscription')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('Cancel'));

        await waitFor(() => {
            expect(screen.queryByText('Create Subscription')).toBeFalsy();
        });
    });
});




