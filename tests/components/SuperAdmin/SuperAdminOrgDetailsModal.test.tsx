/**
 * SuperAdminOrgDetailsModal Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SuperAdminOrgDetailsModal } from '../../../views/superadmin/SuperAdminOrgDetailsModal';
import { Api } from '../../../services/api';

// Mock API
vi.mock('../../../services/api', () => ({
    Api: {
        getOrganizationBillingDetails: vi.fn(),
        updateOrganization: vi.fn()
    }
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

describe('SuperAdminOrgDetailsModal', () => {
    const mockOrg = {
        id: 'org-1',
        name: 'Test Organization',
        plan: 'pro' as const,
        status: 'active' as const,
        created_at: '2025-01-01T00:00:00Z',
        user_count: 10,
        discount_percent: 0
    };

    const defaultProps = {
        org: mockOrg,
        onClose: vi.fn(),
        onUpdate: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render modal with organization details', () => {
        render(<SuperAdminOrgDetailsModal {...defaultProps} />);
        
        expect(screen.getByText('Test Organization')).toBeInTheDocument();
        expect(screen.getByText('org-1')).toBeInTheDocument();
    });

    it('should display general tab by default', () => {
        render(<SuperAdminOrgDetailsModal {...defaultProps} />);
        
        expect(screen.getByText(/Organization Name/i)).toBeInTheDocument();
        expect(screen.getByText(/Plan/i)).toBeInTheDocument();
    });

    it('should switch to billing tab', async () => {
        const mockBilling = {
            billing: { status: 'active' },
            usage: { users: 10 },
            invoices: []
        };

        vi.mocked(Api.getOrganizationBillingDetails).mockResolvedValue(mockBilling);

        render(<SuperAdminOrgDetailsModal {...defaultProps} />);
        
        const billingTab = screen.getByText(/Billing/i);
        fireEvent.click(billingTab);

        await waitFor(() => {
            expect(Api.getOrganizationBillingDetails).toHaveBeenCalledWith('org-1');
        });
    });

    it('should switch to users tab', () => {
        render(<SuperAdminOrgDetailsModal {...defaultProps} />);
        
        const usersTab = screen.getByText(/Users/i);
        fireEvent.click(usersTab);

        expect(screen.getByText(/Users/i)).toBeInTheDocument();
    });

    it('should call onClose when close button clicked', () => {
        render(<SuperAdminOrgDetailsModal {...defaultProps} />);
        
        const closeButton = screen.getByRole('button', { name: /close/i });
        fireEvent.click(closeButton);

        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should update organization plan', async () => {
        vi.mocked(Api.updateOrganization).mockResolvedValue({});

        render(<SuperAdminOrgDetailsModal {...defaultProps} />);
        
        const planSelect = screen.getByLabelText(/Plan/i);
        fireEvent.change(planSelect, { target: { value: 'enterprise' } });

        const saveButton = screen.getByRole('button', { name: /Save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(Api.updateOrganization).toHaveBeenCalledWith('org-1', expect.objectContaining({
                plan: 'enterprise'
            }));
        });
    });

    it('should update organization status', async () => {
        vi.mocked(Api.updateOrganization).mockResolvedValue({});

        render(<SuperAdminOrgDetailsModal {...defaultProps} />);
        
        const statusSelect = screen.getByLabelText(/Status/i);
        fireEvent.change(statusSelect, { target: { value: 'blocked' } });

        const saveButton = screen.getByRole('button', { name: /Save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(Api.updateOrganization).toHaveBeenCalledWith('org-1', expect.objectContaining({
                status: 'blocked'
            }));
        });
    });

    it('should handle API errors', async () => {
        vi.mocked(Api.updateOrganization).mockRejectedValue(new Error('API Error'));

        render(<SuperAdminOrgDetailsModal {...defaultProps} />);
        
        const saveButton = screen.getByRole('button', { name: /Save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(Api.updateOrganization).toHaveBeenCalled();
        });
    });

    it('should display billing details when billing tab is active', async () => {
        const mockBilling = {
            billing: { status: 'active', plan: 'pro' },
            usage: { users: 10, storage: 1000 },
            invoices: [{ id: 'inv-1', amount: 100 }]
        };

        vi.mocked(Api.getOrganizationBillingDetails).mockResolvedValue(mockBilling);

        render(<SuperAdminOrgDetailsModal {...defaultProps} />);
        
        const billingTab = screen.getByText(/Billing/i);
        fireEvent.click(billingTab);

        await waitFor(() => {
            expect(screen.getByText(/Billing/i)).toBeInTheDocument();
        });
    });
});








