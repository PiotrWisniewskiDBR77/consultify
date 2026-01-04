/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrgSwitcher from '../../components/OrgSwitcher';
import { useOrgContext } from '../../contexts/OrgContext';

vi.mock('../../../contexts/OrgContext', () => ({
    useOrgContext: vi.fn()
}));

// Using global mock from tests/setup.ts

const mockOrgs = [
    { id: 'org-1', name: 'Organization 1', role: 'ADMIN' },
    { id: 'org-2', name: 'Organization 2', role: 'MEMBER' }
];

describe('OrgSwitcher Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders current organization name', () => {
        (useOrgContext as any).mockReturnValue({
            currentOrg: mockOrgs[0],
            availableOrgs: mockOrgs,
            isLoading: false,
            switchOrg: vi.fn()
        });

        render(<OrgSwitcher />);

        expect(screen.getByText('Organization 1')).toBeInTheDocument();
    });

    it('shows loading state', () => {
        (useOrgContext as any).mockReturnValue({
            currentOrg: null,
            availableOrgs: [],
            isLoading: true,
            switchOrg: vi.fn()
        });

        render(<OrgSwitcher />);

        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('does not show switcher when only one org', () => {
        (useOrgContext as any).mockReturnValue({
            currentOrg: mockOrgs[0],
            availableOrgs: [mockOrgs[0]],
            isLoading: false,
            switchOrg: vi.fn()
        });

        const { container } = render(<OrgSwitcher compact />);
        expect(container.firstChild).toBeNull();
    });

    it('opens dropdown when clicked', async () => {
        const switchOrg = vi.fn();
        (useOrgContext as any).mockReturnValue({
            currentOrg: mockOrgs[0],
            availableOrgs: mockOrgs,
            isLoading: false,
            switchOrg
        });

        render(<OrgSwitcher />);

        const button = screen.getByRole('button');
        await user.click(button);

        await waitFor(() => {
            expect(screen.getByText('Organization 2')).toBeInTheDocument();
        });
    });

    it('switches organization when selected', async () => {
        const switchOrg = vi.fn();
        (useOrgContext as any).mockReturnValue({
            currentOrg: mockOrgs[0],
            availableOrgs: mockOrgs,
            isLoading: false,
            switchOrg
        });

        render(<OrgSwitcher />);

        const button = screen.getByRole('button');
        await user.click(button);

        await waitFor(() => {
            expect(screen.getByText('Organization 2')).toBeInTheDocument();
        });

        const org2 = screen.getByText('Organization 2');
        await user.click(org2);

        expect(switchOrg).toHaveBeenCalledWith('org-2');
    });

    it('displays role badges', async () => {
        (useOrgContext as any).mockReturnValue({
            currentOrg: mockOrgs[0],
            availableOrgs: mockOrgs,
            isLoading: false,
            switchOrg: vi.fn()
        });

        render(<OrgSwitcher />);

        const button = screen.getByRole('button');
        await user.click(button);

        await waitFor(() => {
            expect(screen.getByText('ADMIN')).toBeInTheDocument();
            expect(screen.getByText('MEMBER')).toBeInTheDocument();
        });
    });

    it('closes dropdown when clicking outside', async () => {
        (useOrgContext as any).mockReturnValue({
            currentOrg: mockOrgs[0],
            availableOrgs: mockOrgs,
            isLoading: false,
            switchOrg: vi.fn()
        });

        render(
            <div>
                <div>Outside</div>
                <OrgSwitcher />
            </div>
        );

        const button = screen.getByRole('button');
        await user.click(button);

        await waitFor(() => {
            expect(screen.getByText('Organization 2')).toBeInTheDocument();
        });

        const outside = screen.getByText('Outside');
        await user.click(outside);

        await waitFor(() => {
            expect(screen.queryByText('Organization 2')).not.toBeInTheDocument();
        });
    });
});

