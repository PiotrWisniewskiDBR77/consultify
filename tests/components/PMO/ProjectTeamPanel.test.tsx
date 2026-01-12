/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectTeamPanel } from '../../components/PMO/ProjectTeamPanel';
import { PMOProjectRole } from '../../../types';

// Mock API
vi.mock('../../../services/api', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn()
    }
}));

// Mock i18n

const mockTeamMembers = [
    {
        id: 'member-1',
        userId: 'user-1',
        user: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        role: PMOProjectRole.PMO_LEAD,
        assignedAt: '2024-01-01',
        workstreams: ['ws-1']
    },
    {
        id: 'member-2',
        userId: 'user-2',
        user: { firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
        role: PMOProjectRole.SPONSOR,
        assignedAt: '2024-01-01',
        workstreams: []
    }
];

const mockAvailableUsers = [
    { id: 'user-3', firstName: 'Bob', lastName: 'Wilson', email: 'bob@example.com' },
    { id: 'user-4', firstName: 'Alice', lastName: 'Brown', email: 'alice@example.com' }
];

describe('ProjectTeamPanel Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
        global.localStorage = {
            getItem: vi.fn(() => 'mock-token'),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
            length: 0,
            key: vi.fn()
        } as any;

        // Mock API responses
        vi.mocked(api.get).mockImplementation((url: string) => {
            if (url.includes('/team')) {
                return Promise.resolve({ data: mockTeamMembers });
            }
            if (url.includes('/available-users')) {
                return Promise.resolve({ data: mockAvailableUsers });
            }
            if (url.includes('/workstreams')) {
                return Promise.resolve({ data: [] });
            }
            return Promise.resolve({ data: [] });
        });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Initial Rendering', () => {
        it('renders team panel with title', () => {
            render(<ProjectTeamPanel projectId="proj-1" />);

            expect(screen.getByText('Project Team')).toBeInTheDocument();
        });

        it('fetches team members on mount', async () => {
            render(<ProjectTeamPanel projectId="proj-1" />);

            await waitFor(() => {
                expect(api.get).toHaveBeenCalledWith('/projects/proj-1/team');
            });
        });

        it('displays team members', async () => {
            render(<ProjectTeamPanel projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
                expect(screen.getByText('Jane Smith')).toBeInTheDocument();
            });
        });

        it('shows role badges', async () => {
            render(<ProjectTeamPanel projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('PMO Lead')).toBeInTheDocument();
                expect(screen.getByText('Sponsor')).toBeInTheDocument();
            });
        });
    });

    describe('Team Management', () => {
        it('shows add member button when canManageTeam is true', async () => {
            render(<ProjectTeamPanel projectId="proj-1" canManageTeam={true} />);

            await waitFor(() => {
                expect(screen.getByText('Add Member')).toBeInTheDocument();
            });
        });

        it('hides add member button when canManageTeam is false', () => {
            render(<ProjectTeamPanel projectId="proj-1" canManageTeam={false} />);

            expect(screen.queryByText('Add Member')).not.toBeInTheDocument();
        });

        it('opens add member modal when add button is clicked', async () => {
            render(<ProjectTeamPanel projectId="proj-1" canManageTeam={true} />);

            await waitFor(() => {
                expect(screen.getByText('Add Member')).toBeInTheDocument();
            });

            const addButton = screen.getByText('Add Member');
            await user.click(addButton);

            expect(screen.getByText('Add Team Member')).toBeInTheDocument();
        });

        it('adds member with selected role', async () => {
            vi.mocked(api.post).mockResolvedValue({ data: { success: true } });

            render(<ProjectTeamPanel projectId="proj-1" canManageTeam={true} />);

            await waitFor(() => {
                expect(screen.getByText('Add Member')).toBeInTheDocument();
            });

            // Open add modal
            const addButton = screen.getByText('Add Member');
            await user.click(addButton);

            // Select user
            const userSelect = screen.getByRole('combobox');
            await user.click(userSelect);
            const bobOption = screen.getByText('Bob Wilson');
            await user.click(bobOption);

            // Select role
            const roleSelect = screen.getAllByRole('combobox')[1];
            await user.click(roleSelect);
            const sponsorOption = screen.getByText('Sponsor');
            await user.click(sponsorOption);

            // Submit
            const submitButton = screen.getByRole('button', { name: /add member/i });
            await user.click(submitButton);

            expect(api.post).toHaveBeenCalledWith('/projects/proj-1/team', {
                userId: 'user-3',
                role: PMOProjectRole.SPONSOR
            });
        });
    });

    describe('Role Changes', () => {
        it('allows role change when canManageTeam is true', async () => {
            vi.mocked(api.post).mockResolvedValue({ data: { success: true } });

            render(<ProjectTeamPanel projectId="proj-1" canManageTeam={true} />);

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
            });

            // Find role dropdown for John Doe
            const roleDropdowns = screen.getAllByRole('button', { name: /change role/i });
            expect(roleDropdowns.length).toBeGreaterThan(0);

            await user.click(roleDropdowns[0]);

            const newRoleOption = screen.getByText('Decision Owner');
            await user.click(newRoleOption);

            expect(api.post).toHaveBeenCalledWith('/projects/proj-1/team/member-1/role', {
                role: PMOProjectRole.DECISION_OWNER
            });
        });
    });

    describe('Member Removal', () => {
        it('allows member removal when canManageTeam is true', async () => {
            vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });

            render(<ProjectTeamPanel projectId="proj-1" canManageTeam={true} />);

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
            });

            // Find remove buttons
            const removeButtons = screen.getAllByRole('button', { name: /remove/i });
            expect(removeButtons.length).toBeGreaterThan(0);

            await user.click(removeButtons[0]);

            // Confirm removal
            const confirmButton = screen.getByRole('button', { name: /confirm/i });
            await user.click(confirmButton);

            expect(api.delete).toHaveBeenCalledWith('/projects/proj-1/team/member-1');
        });
    });

    describe('Workstream Display', () => {
        it('shows workstream assignments', async () => {
            render(<ProjectTeamPanel projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
            });

            expect(screen.getByText('Workstreams:')).toBeInTheDocument();
        });

        it('shows workstream count', async () => {
            render(<ProjectTeamPanel projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
            });

            expect(screen.getByText('1 workstream')).toBeInTheDocument();
        });
    });

    describe('Role Distribution', () => {
        it('shows role distribution chart', async () => {
            render(<ProjectTeamPanel projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('Team Composition')).toBeInTheDocument();
            });
        });

        it('displays correct role counts', async () => {
            render(<ProjectTeamPanel projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('PMO Lead: 1')).toBeInTheDocument();
                expect(screen.getByText('Sponsor: 1')).toBeInTheDocument();
            });
        });
    });

    describe('Empty State', () => {
        it('shows empty state when no team members', async () => {
            vi.mocked(api.get).mockResolvedValue({ data: [] });

            render(<ProjectTeamPanel projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('No team members assigned yet')).toBeInTheDocument();
            });
        });
    });

    describe('Error Handling', () => {
        it('handles API error gracefully', async () => {
            vi.mocked(api.get).mockRejectedValue(new Error('API Error'));

            render(<ProjectTeamPanel projectId="proj-1" />);

            // Component should still render
            expect(screen.getByText('Project Team')).toBeInTheDocument();
        });
    });

    describe('Loading States', () => {
        it('shows loading indicator while fetching data', () => {
            vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));

            render(<ProjectTeamPanel projectId="proj-1" />);

            expect(screen.getByText('Loading team...')).toBeInTheDocument();
        });
    });
});









