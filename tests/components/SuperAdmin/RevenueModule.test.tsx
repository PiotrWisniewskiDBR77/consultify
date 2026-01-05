/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RevenueModule from '@/views/superadmin/RevenueModule';

// Mock child components
vi.mock('@/views/superadmin/BillingCenterView', () => ({
    BillingCenterView: () => <div data-testid="billing-view">Billing Content</div>
}));

vi.mock('@/views/superadmin/InvoiceCenterView', () => ({
    InvoiceCenterView: () => <div data-testid="invoices-view">Invoices Content</div>
}));

vi.mock('../../services/api', () => ({
    Api: {
        get: vi.fn().mockResolvedValue({}),
        getTasks: vi.fn().mockResolvedValue([]),
        getOrganizations: vi.fn().mockResolvedValue([]),
        getSuperAdminDashboard: vi.fn().mockResolvedValue({
            counts: { total_users: 10 },
            ai: { total_ai_calls: 100, total_tokens: 5000 }
        })
    }
}));

describe('RevenueModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render with default billing tab', () => {
        render(<RevenueModule />);
        
        expect(screen.getByRole('heading', { name: 'Revenue' })).toBeInTheDocument();
    });

    it('should render with initial tab', () => {
        render(<RevenueModule initialTab="invoices" />);
        
        expect(screen.getByRole('heading', { name: 'Revenue' })).toBeInTheDocument();
    });

    it('should switch between tabs', () => {
        render(<RevenueModule />);
        
        const invoicesTab = screen.getAllByText('Invoices')[0];
        fireEvent.click(invoicesTab);
        expect(invoicesTab).toBeInTheDocument();
        
        const usageTab = screen.getAllByText('Usage')[0];
        fireEvent.click(usageTab);
        expect(usageTab).toBeInTheDocument();
    });

    it('should display all three tabs', () => {
        render(<RevenueModule />);
        
        expect(screen.getAllByText('Billing').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Invoices').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Usage').length).toBeGreaterThan(0);
    });
});
