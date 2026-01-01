/**
 * BillingSettings Component Tests
 * 
 * Tests for the Billing Settings component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { BillingSettings } from '../../../components/settings/BillingSettings';
import { User } from '../../../types';

// Mock hooks
vi.mock('../../../hooks/usePermissions', () => ({
    usePermissions: () => ({
        isAdmin: true,
        canManageOrgBilling: true
    })
}));

// Mock BillingCore component
vi.mock('../../../components/shared/BillingCore', () => ({
    BillingCore: ({ mode, currentUser, showUserLicense, showCurrentPlan, showUsageMeters, showAvailablePlans, showInvoices }: any) => (
        <div data-testid="billing-core">
            <div>Mode: {mode}</div>
            <div>User: {currentUser.email}</div>
            <div>Show User License: {showUserLicense ? 'Yes' : 'No'}</div>
            <div>Show Current Plan: {showCurrentPlan ? 'Yes' : 'No'}</div>
            <div>Show Usage Meters: {showUsageMeters ? 'Yes' : 'No'}</div>
            <div>Show Available Plans: {showAvailablePlans ? 'Yes' : 'No'}</div>
            <div>Show Invoices: {showInvoices ? 'Yes' : 'No'}</div>
        </div>
    )
}));

// Mock InfoButton
vi.mock('../../../components/shared/InfoButton', () => ({
    InfoButton: () => <div data-testid="info-button">Info</div>
}));

describe('BillingSettings', () => {
    const mockUser: User = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'client',
        organization_id: 'org-1'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = (user = mockUser) => {
        return render(
            <BrowserRouter>
                <BillingSettings currentUser={user} />
            </BrowserRouter>
        );
    };

    describe('Rendering', () => {
        it('renders billing settings title', () => {
            renderComponent();

            expect(screen.getByText('Subscription & Billing')).toBeInTheDocument();
        });

        it('renders BillingCore component', () => {
            renderComponent();

            expect(screen.getByTestId('billing-core')).toBeInTheDocument();
        });

        it('renders InfoButton', () => {
            renderComponent();

            expect(screen.getByTestId('info-button')).toBeInTheDocument();
        });

        it('renders legal documents section', () => {
            renderComponent();

            expect(screen.getByText('Billing & Subscription Terms')).toBeInTheDocument();
        });

        it('renders all legal document links', () => {
            renderComponent();

            expect(screen.getByText('Subscription Agreement')).toBeInTheDocument();
            expect(screen.getByText('Service Level Agreement')).toBeInTheDocument();
            expect(screen.getByText('Refund Policy')).toBeInTheDocument();
        });
    });

    describe('BillingCore Props - Admin Mode', () => {
        it('passes org-admin mode when user is admin', () => {
            renderComponent();

            const billingCore = screen.getByTestId('billing-core');
            expect(billingCore).toHaveTextContent('Mode: org-admin');
        });

        it('shows all billing features for admin', () => {
            renderComponent();

            const billingCore = screen.getByTestId('billing-core');
            expect(billingCore).toHaveTextContent('Show User License: Yes');
            expect(billingCore).toHaveTextContent('Show Current Plan: Yes');
            expect(billingCore).toHaveTextContent('Show Usage Meters: Yes');
            expect(billingCore).toHaveTextContent('Show Available Plans: Yes');
            expect(billingCore).toHaveTextContent('Show Invoices: Yes');
        });

        it('passes current user to BillingCore', () => {
            renderComponent();

            const billingCore = screen.getByTestId('billing-core');
            expect(billingCore).toHaveTextContent('User: test@example.com');
        });
    });

    describe('BillingCore Props - User Mode', () => {
        beforeEach(() => {
            vi.mocked(require('../../../hooks/usePermissions').usePermissions).mockReturnValue({
                isAdmin: false,
                canManageOrgBilling: false
            });
        });

        it('passes user mode when user is not admin', () => {
            renderComponent();

            const billingCore = screen.getByTestId('billing-core');
            expect(billingCore).toHaveTextContent('Mode: user');
        });

        it('hides available plans when user cannot manage billing', () => {
            renderComponent();

            const billingCore = screen.getByTestId('billing-core');
            expect(billingCore).toHaveTextContent('Show Available Plans: No');
        });
    });

    describe('Legal Documents Links', () => {
        it('links to subscription agreement', () => {
            renderComponent();

            const link = screen.getByText('Subscription Agreement').closest('a');
            expect(link).toHaveAttribute('href', '/legal/subscription');
        });

        it('links to SLA', () => {
            renderComponent();

            const link = screen.getByText('Service Level Agreement').closest('a');
            expect(link).toHaveAttribute('href', '/legal/sla');
        });

        it('links to refund policy', () => {
            renderComponent();

            const link = screen.getByText('Refund Policy').closest('a');
            expect(link).toHaveAttribute('href', '/legal/refunds');
        });

        it('displays document descriptions', () => {
            renderComponent();

            expect(screen.getByText('Plans, pricing, AI credits')).toBeInTheDocument();
            expect(screen.getByText('Uptime & support guarantees')).toBeInTheDocument();
            expect(screen.getByText('Cancellations & refunds')).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('has proper heading structure', () => {
            renderComponent();

            const heading = screen.getByRole('heading', { level: 2 });
            expect(heading).toHaveTextContent('Subscription & Billing');
        });

        it('has accessible links', () => {
            renderComponent();

            const links = screen.getAllByRole('link');
            expect(links.length).toBeGreaterThan(0);
            
            links.forEach(link => {
                expect(link).toHaveAttribute('href');
            });
        });
    });
});


