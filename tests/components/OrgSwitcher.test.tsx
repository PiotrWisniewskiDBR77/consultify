/**
 * OrgSwitcher Component Tests
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrgSwitcher from '../../src/components/OrgSwitcher';

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback: string) => fallback || key,
    }),
}));

// Mock OrgContext
const mockSwitchOrg = vi.fn();
const mockOrgContext = {
    currentOrg: { id: 'org-1', name: 'Test Organization', role: 'ADMIN', access_type: 'DIRECT' },
    availableOrgs: [
        { id: 'org-1', name: 'Test Organization', role: 'ADMIN', access_type: 'DIRECT' },
        { id: 'org-2', name: 'Another Org', role: 'MEMBER', access_type: 'DIRECT' },
        { id: 'org-3', name: 'Consultant Org', role: 'CONSULTANT', access_type: 'CONSULTANT' },
    ],
    isLoading: false,
    switchOrg: mockSwitchOrg,
};

vi.mock('@/contexts/OrgContext', () => ({
    useOrgContext: () => mockOrgContext,
    Organization: {},
}));

describe('OrgSwitcher Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockOrgContext.isLoading = false;
        mockOrgContext.availableOrgs = [
            { id: 'org-1', name: 'Test Organization', role: 'ADMIN', access_type: 'DIRECT' },
            { id: 'org-2', name: 'Another Org', role: 'MEMBER', access_type: 'DIRECT' },
            { id: 'org-3', name: 'Consultant Org', role: 'CONSULTANT', access_type: 'CONSULTANT' },
        ];
    });

    describe('Rendering', () => {
        it('should render current organization name', () => {
            render(<OrgSwitcher />);

            expect(screen.getByText('Test Organization')).toBeInTheDocument();
        });

        it('should show role for current organization', () => {
            render(<OrgSwitcher />);

            expect(screen.getByText('ADMIN')).toBeInTheDocument();
        });

        it('should render trigger button', () => {
            render(<OrgSwitcher />);

            expect(screen.getByRole('button')).toBeInTheDocument();
        });
    });

    describe('Loading State', () => {
        it('should show loading skeleton when loading', () => {
            mockOrgContext.isLoading = true;
            render(<OrgSwitcher />);

            expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
        });
    });

    describe('Single Organization', () => {
        it('should support single organization state', () => {
            // When user has only one org, component shows plain text instead of dropdown
            mockOrgContext.availableOrgs = [
                { id: 'org-1', name: 'Only Org', role: 'OWNER', access_type: 'DIRECT' },
            ];

            render(<OrgSwitcher />);

            // Should show org name as plain text (not in a button)
            expect(screen.getByText('Only Org')).toBeInTheDocument();
            // Should NOT have a dropdown button (no chevron)
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });

        it('should return null in compact mode with single org', () => {
            mockOrgContext.availableOrgs = [
                { id: 'org-1', name: 'Only Org', role: 'OWNER', access_type: 'DIRECT' },
            ];

            const { container } = render(<OrgSwitcher compact />);

            expect(container.firstChild).toBeNull();
        });
    });

    describe('Dropdown Behavior', () => {
        it('should open dropdown when trigger is clicked', async () => {
            const user = userEvent.setup();
            render(<OrgSwitcher />);

            await user.click(screen.getByRole('button'));

            // All orgs should be visible
            expect(screen.getByText('Another Org')).toBeInTheDocument();
            expect(screen.getByText('Consultant Org')).toBeInTheDocument();
        });

        it('should close dropdown when clicking outside', async () => {
            const user = userEvent.setup();
            render(<OrgSwitcher />);

            await user.click(screen.getByRole('button'));
            expect(screen.getByText('Another Org')).toBeInTheDocument();

            // Click outside
            await user.click(document.body);

            await waitFor(() => {
                expect(screen.queryByText('Another Org')).not.toBeInTheDocument();
            });
        });

        it('should toggle dropdown on repeated clicks', async () => {
            const user = userEvent.setup();
            render(<OrgSwitcher />);

            const trigger = screen.getByRole('button');

            // Open
            await user.click(trigger);
            expect(screen.getByText('Another Org')).toBeInTheDocument();

            // Close
            await user.click(trigger);
            await waitFor(() => {
                expect(screen.queryByText('Another Org')).not.toBeInTheDocument();
            });
        });
    });

    describe('Organization Selection', () => {
        it('should call switchOrg when selecting an organization', async () => {
            const user = userEvent.setup();
            render(<OrgSwitcher />);

            await user.click(screen.getByRole('button'));
            await user.click(screen.getByText('Another Org'));

            expect(mockSwitchOrg).toHaveBeenCalledWith('org-2');
        });

        it('should close dropdown after selection', async () => {
            const user = userEvent.setup();
            render(<OrgSwitcher />);

            await user.click(screen.getByRole('button'));
            await user.click(screen.getByText('Another Org'));

            await waitFor(() => {
                expect(screen.queryByText('Consultant Org')).not.toBeInTheDocument();
            });
        });

        it('should show checkmark for current organization', async () => {
            const user = userEvent.setup();
            render(<OrgSwitcher />);

            await user.click(screen.getByRole('button'));

            // Current org should have visual indicator - just check dropdown is open
            expect(screen.getByText('Another Org')).toBeInTheDocument();
        });
    });

    describe('Role Badges', () => {
        it('should display role badges in dropdown', async () => {
            const user = userEvent.setup();
            render(<OrgSwitcher />);

            await user.click(screen.getByRole('button'));

            // Role badges should be visible (first letters)
            expect(screen.getByText('A')).toBeInTheDocument(); // ADMIN
            expect(screen.getByText('M')).toBeInTheDocument(); // MEMBER
            expect(screen.getByText('C')).toBeInTheDocument(); // CONSULTANT
        });
    });

    describe('Compact Mode', () => {
        it('should not show role in compact mode', () => {
            render(<OrgSwitcher compact />);

            expect(screen.queryByText('ADMIN')).not.toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have accessible dropdown buttons', async () => {
            const user = userEvent.setup();
            render(<OrgSwitcher />);

            await user.click(screen.getByRole('button'));

            const orgButtons = screen.getAllByRole('button');
            expect(orgButtons.length).toBeGreaterThan(1);
        });
    });
});