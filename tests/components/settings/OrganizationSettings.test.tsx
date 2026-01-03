/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrganizationSettings } from '../../../components/settings/OrganizationSettings';
import { Api } from '../../../services/api';


vi.mock('../../../services/api', () => ({
    Api: {
        getUserOrganizations: vi.fn(),
        getOrganization: vi.fn(),
        getOrganizationMembers: vi.fn(),
        getOrgTokenBalance: vi.fn(),
        getOrgTokenLedger: vi.fn(),
        addOrganizationMember: vi.fn(),
        createOrganization: vi.fn()
    }
}));

vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    organizationId: 'org-1'
};

const mockOrganizations = [
    { id: 'org-1', name: 'Organization 1', isActive: true },
    { id: 'org-2', name: 'Organization 2', isActive: true }
];

const mockOrgDetails = {
    id: 'org-1',
    name: 'Organization 1',
    token_balance: 1000,
    billing_status: 'active'
};

const mockMembers = [
    { id: 'user-1', email: 'user1@example.com', role: 'ADMIN' },
    { id: 'user-2', email: 'user2@example.com', role: 'MEMBER' }
];

describe('OrganizationSettings Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.getUserOrganizations as any).mockResolvedValue(mockOrganizations);
        (Api.getOrganization as any).mockResolvedValue(mockOrgDetails);
        (Api.getOrganizationMembers as any).mockResolvedValue(mockMembers);
        (Api.getOrgTokenBalance as any).mockResolvedValue({ balance: 1000 });
        (Api.getOrgTokenLedger as any).mockResolvedValue([]);
    });

    it('renders Organization Settings heading', async () => {
        render(<OrganizationSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            expect(screen.getByText(/Organization/i)).toBeInTheDocument();
        });
    });

    it('loads organizations on mount', async () => {
        render(<OrganizationSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            expect(Api.getUserOrganizations).toHaveBeenCalled();
        });
    });

    it('displays organization list', async () => {
        render(<OrganizationSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            expect(screen.getByText('Organization 1')).toBeInTheDocument();
        });
    });

    it('loads organization details when selected', async () => {
        render(<OrganizationSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            expect(Api.getOrganization).toHaveBeenCalled();
            expect(Api.getOrganizationMembers).toHaveBeenCalled();
        });
    });

    it('displays organization members', async () => {
        render(<OrganizationSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            expect(screen.getByText(/Members/i)).toBeInTheDocument();
        });
    });

    it('shows create organization button', async () => {
        render(<OrganizationSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            expect(screen.getByText(/Create Organization/i)).toBeInTheDocument();
        });
    });

    it('opens create organization modal', async () => {
        render(<OrganizationSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            const createButton = screen.getByText(/Create Organization/i);
            expect(createButton).toBeInTheDocument();
        });

        const createButton = screen.getByText(/Create Organization/i);
        await user.click(createButton);

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Organization name/i)).toBeInTheDocument();
        });
    });

    it('shows add member button', async () => {
        render(<OrganizationSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            expect(screen.getByText(/Add Member/i)).toBeInTheDocument();
        });
    });

    it('opens add member modal', async () => {
        render(<OrganizationSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            const addButton = screen.getByText(/Add Member/i);
            expect(addButton).toBeInTheDocument();
        });

        const addButton = screen.getByText(/Add Member/i);
        await user.click(addButton);

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Email/i)).toBeInTheDocument();
        });
    });

    it('creates organization when form submitted', async () => {
        (Api.createOrganization as any).mockResolvedValue({ id: 'org-3', name: 'New Org' });

        render(<OrganizationSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            const createButton = screen.getByText(/Create Organization/i);
            expect(createButton).toBeInTheDocument();
        });

        await user.click(createButton);

        await waitFor(() => {
            const nameInput = screen.getByPlaceholderText(/Organization name/i);
            expect(nameInput).toBeInTheDocument();
        });

        const nameInput = screen.getByPlaceholderText(/Organization name/i);
        await user.type(nameInput, 'New Organization');

        const submitButton = screen.getByRole('button', { name: /create/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(Api.createOrganization).toHaveBeenCalled();
        });
    });

    it('shows loading state while fetching', () => {
        (Api.getUserOrganizations as any).mockImplementation(() => new Promise(() => {}));

        render(<OrganizationSettings currentUser={mockUser as any} />);

        expect(screen.getByRole('status')).toBeInTheDocument();
    });
});






