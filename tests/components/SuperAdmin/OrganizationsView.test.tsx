/**
 * OrganizationsView Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { OrganizationsView } from '../../../views/superadmin/OrganizationsView';
import { Api } from '../../../services/api';

// Mock API
vi.mock('../../../services/api', () => ({
    Api: {
        getOrganizations: vi.fn(),
        getAccessRequests: vi.fn(),
        getAccessCodes: vi.fn(),
        updateOrganization: vi.fn(),
        deleteOrganization: vi.fn(),
        approveAccessRequest: vi.fn(),
        rejectAccessRequest: vi.fn(),
        createAccessCode: vi.fn()
    }
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

// Mock SuperAdminOrgDetailsModal
vi.mock('../../../views/superadmin/SuperAdminOrgDetailsModal', () => ({
    SuperAdminOrgDetailsModal: ({ org, onClose }: any) => (
        <div data-testid="org-details-modal">
            <div>Modal for: {org.name}</div>
            <button onClick={onClose}>Close</button>
        </div>
    )
}));

describe('OrganizationsView', () => {
    const mockOrganizations = [
        {
            id: 'org-1',
            name: 'Test Org 1',
            plan: 'pro',
            status: 'active',
            created_at: '2025-01-01T00:00:00Z',
            user_count: 10
        },
        {
            id: 'org-2',
            name: 'Test Org 2',
            plan: 'free',
            status: 'trial',
            created_at: '2025-01-02T00:00:00Z',
            user_count: 5
        }
    ];

    const mockRequests = [
        {
            id: 'req-1',
            organization_name: 'New Org',
            first_name: 'John',
            last_name: 'Doe',
            email: 'john@test.com',
            status: 'pending',
            requested_at: '2025-01-01T00:00:00Z'
        }
    ];

    const mockCodes = [
        {
            id: 'code-1',
            code: 'ABC123',
            role: 'USER',
            max_uses: 10,
            current_uses: 5,
            expires_at: null
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(Api.getOrganizations).mockResolvedValue(mockOrganizations);
        vi.mocked(Api.getAccessRequests).mockResolvedValue(mockRequests);
        vi.mocked(Api.getAccessCodes).mockResolvedValue(mockCodes);
    });

    it('should render organizations view', async () => {
        render(<OrganizationsView />);

        await waitFor(() => {
            expect(screen.getByText('Organizations')).toBeInTheDocument();
        });
    });

    it('should fetch and display organizations', async () => {
        render(<OrganizationsView />);

        await waitFor(() => {
            expect(Api.getOrganizations).toHaveBeenCalled();
            expect(screen.getByText('Test Org 1')).toBeInTheDocument();
            expect(screen.getByText('Test Org 2')).toBeInTheDocument();
        });
    });

    it('should switch to pending requests tab', async () => {
        render(<OrganizationsView />);

        await waitFor(() => {
            expect(screen.getByText('Test Org 1')).toBeInTheDocument();
        });

        const pendingTab = screen.getByText(/Pending Requests/i);
        fireEvent.click(pendingTab);

        await waitFor(() => {
            expect(Api.getAccessRequests).toHaveBeenCalled();
        });
    });

    it('should switch to access codes tab', async () => {
        render(<OrganizationsView />);

        await waitFor(() => {
            expect(screen.getByText('Test Org 1')).toBeInTheDocument();
        });

        const codesTab = screen.getByText(/Access Codes/i);
        fireEvent.click(codesTab);

        await waitFor(() => {
            expect(Api.getAccessCodes).toHaveBeenCalled();
        });
    });

    it('should open org details modal when org clicked', async () => {
        render(<OrganizationsView />);

        await waitFor(() => {
            expect(screen.getByText('Test Org 1')).toBeInTheDocument();
        });

        const orgRow = screen.getByText('Test Org 1').closest('tr');
        if (orgRow) {
            fireEvent.click(orgRow);
        }

        await waitFor(() => {
            expect(screen.getByTestId('org-details-modal')).toBeInTheDocument();
        });
    });

    it('should filter organizations by search term', async () => {
        render(<OrganizationsView />);

        await waitFor(() => {
            expect(screen.getByText('Test Org 1')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search organizations/i);
        fireEvent.change(searchInput, { target: { value: 'Org 1' } });

        await waitFor(() => {
            expect(screen.getByText('Test Org 1')).toBeInTheDocument();
            expect(screen.queryByText('Test Org 2')).not.toBeInTheDocument();
        });
    });

    it('should approve access request', async () => {
        vi.mocked(Api.approveAccessRequest).mockResolvedValue({ message: 'Approved' });

        render(<OrganizationsView />);

        await waitFor(() => {
            expect(screen.getByText('Test Org 1')).toBeInTheDocument();
        });

        const pendingTab = screen.getByText(/Pending Requests/i);
        fireEvent.click(pendingTab);

        await waitFor(() => {
            expect(screen.getByText('New Org')).toBeInTheDocument();
        });

        const approveButton = screen.getByText(/Approve/i);
        fireEvent.click(approveButton);

        await waitFor(() => {
            expect(Api.approveAccessRequest).toHaveBeenCalled();
        });
    });

    it('should reject access request', async () => {
        vi.mocked(Api.rejectAccessRequest).mockResolvedValue({ message: 'Rejected' });

        render(<OrganizationsView />);

        await waitFor(() => {
            expect(screen.getByText('Test Org 1')).toBeInTheDocument();
        });

        const pendingTab = screen.getByText(/Pending Requests/i);
        fireEvent.click(pendingTab);

        await waitFor(() => {
            expect(screen.getByText('New Org')).toBeInTheDocument();
        });

        const rejectButton = screen.getByText(/Reject/i);
        fireEvent.click(rejectButton);

        await waitFor(() => {
            expect(Api.rejectAccessRequest).toHaveBeenCalled();
        });
    });
});









