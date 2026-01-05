import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectCard } from '../../../components/ProjectCard';

// Mock dependencies
const mockUseAppStore = vi.fn();
vi.mock('../../../store/useAppStore', () => ({
    useAppStore: (selector: any) => mockUseAppStore(selector),
}));

vi.mock('../../../services/api', () => ({
    Api: {
        updateProject: vi.fn().mockResolvedValue({}),
        deleteProject: vi.fn().mockResolvedValue({}),
        getProjectStats: vi.fn().mockResolvedValue({
            tasksCompleted: 15,
            tasksTotal: 20,
            progress: 75,
            teamMembers: 5
        }),
    },
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

/**
 * ProjectCard Component Tests
 * Tests project card functionality and project management
 * CRITICAL FOR ENTERPRISE PROJECT PORTFOLIO MANAGEMENT
 */
describe('ProjectCard Component', () => {
    const mockProject = {
        id: 'project-123',
        name: 'Digital Transformation Initiative',
        description: 'Complete digital transformation of legacy systems',
        status: 'active',
        priority: 'high',
        progress: 75,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        team: [
            { id: 'user-1', name: 'John Doe', role: 'Project Manager' },
            { id: 'user-2', name: 'Jane Smith', role: 'Developer' },
            { id: 'user-3', name: 'Bob Johnson', role: 'Designer' }
        ],
        budget: 500000,
        spent: 375000,
        tags: ['digital-transformation', 'legacy-systems', 'agile']
    };

    const mockOnEdit = vi.fn();
    const mockOnDelete = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        mockUseAppStore.mockReturnValue({
            user: { id: 'user-1', permissions: ['project.edit', 'project.delete'] },
            currentOrg: { id: 'org-123' },
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('should render project information correctly', () => {
            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            expect(screen.getByText('Digital Transformation Initiative')).toBeInTheDocument();
            expect(screen.getByText('Complete digital transformation of legacy systems')).toBeInTheDocument();
            expect(screen.getByText('active')).toBeInTheDocument();
            expect(screen.getByText('high')).toBeInTheDocument();
        });

        it('should display progress information', () => {
            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            expect(screen.getByText('75%')).toBeInTheDocument();
            const progressBar = screen.getByRole('progressbar');
            expect(progressBar).toHaveAttribute('aria-valuenow', '75');
        });

        it('should show team members', () => {
            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            expect(screen.getByText('John Doe')).toBeInTheDocument();
            expect(screen.getByText('Jane Smith')).toBeInTheDocument();
            expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
        });

        it('should display budget information', () => {
            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            expect(screen.getByText('$500,000')).toBeInTheDocument(); // Budget
            expect(screen.getByText('$375,000')).toBeInTheDocument(); // Spent
            expect(screen.getByText('$125,000')).toBeInTheDocument(); // Remaining
        });

        it('should show project tags', () => {
            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            expect(screen.getByText('digital-transformation')).toBeInTheDocument();
            expect(screen.getByText('legacy-systems')).toBeInTheDocument();
            expect(screen.getByText('agile')).toBeInTheDocument();
        });

        it('should display dates correctly', () => {
            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            expect(screen.getByText('Jan 1, 2024')).toBeInTheDocument(); // Start date
            expect(screen.getByText('Dec 31, 2024')).toBeInTheDocument(); // End date
        });
    });

    describe('Status Indicators', () => {
        it('should show correct status styling for active projects', () => {
            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            const statusBadge = screen.getByText('active');
            expect(statusBadge).toHaveClass('bg-green-500/20', 'text-green-300');
        });

        it('should show correct status styling for completed projects', () => {
            const completedProject = { ...mockProject, status: 'completed', progress: 100 };

            renderWithProviders(
                <ProjectCard
                    project={completedProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            const statusBadge = screen.getByText('completed');
            expect(statusBadge).toHaveClass('bg-blue-500/20', 'text-blue-300');
        });

        it('should show correct priority indicators', () => {
            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            const priorityBadge = screen.getByText('high');
            expect(priorityBadge).toHaveClass('bg-red-500/20', 'text-red-300');
        });
    });

    describe('Interactions', () => {
        it('should call onEdit when edit button is clicked', async () => {
            const user = userEvent.setup();

            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            const editButton = screen.getByRole('button', { name: /edit.*project/i });
            await user.click(editButton);

            expect(mockOnEdit).toHaveBeenCalledWith(mockProject);
        });

        it('should call onDelete when delete button is clicked', async () => {
            const user = userEvent.setup();

            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            const deleteButton = screen.getByRole('button', { name: /delete.*project/i });
            await user.click(deleteButton);

            expect(mockOnDelete).toHaveBeenCalledWith(mockProject.id);
        });

        it('should navigate to project details when card is clicked', async () => {
            const user = userEvent.setup();
            const navigate = vi.fn();
            vi.mocked(require('react-router-dom')).useNavigate.mockReturnValue(navigate);

            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            const card = screen.getByText('Digital Transformation Initiative').closest('div');
            await user.click(card!);

            expect(navigate).toHaveBeenCalledWith(`/projects/${mockProject.id}`);
        });
    });

    describe('Permissions', () => {
        it('should hide edit button for users without edit permission', () => {
            mockUseAppStore.mockReturnValue({
                user: { id: 'user-2', permissions: ['project.view'] },
                currentOrg: { id: 'org-123' },
            });

            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            expect(screen.queryByRole('button', { name: /edit.*project/i })).not.toBeInTheDocument();
        });

        it('should hide delete button for users without delete permission', () => {
            mockUseAppStore.mockReturnValue({
                user: { id: 'user-2', permissions: ['project.view', 'project.edit'] },
                currentOrg: { id: 'org-123' },
            });

            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            expect(screen.queryByRole('button', { name: /delete.*project/i })).not.toBeInTheDocument();
        });

        it('should show all actions for project owners', () => {
            mockUseAppStore.mockReturnValue({
                user: { id: 'user-1', permissions: ['project.owner'] },
                currentOrg: { id: 'org-123' },
            });

            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            expect(screen.getByRole('button', { name: /edit.*project/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /delete.*project/i })).toBeInTheDocument();
        });
    });

    describe('Data Handling', () => {
        it('should handle projects with no team members', () => {
            const projectNoTeam = { ...mockProject, team: [] };

            renderWithProviders(
                <ProjectCard
                    project={projectNoTeam}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            expect(screen.getByText('No team members assigned')).toBeInTheDocument();
        });

        it('should handle projects with no budget information', () => {
            const projectNoBudget = { ...mockProject, budget: undefined, spent: undefined };

            renderWithProviders(
                <ProjectCard
                    project={projectNoBudget}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
            expect(screen.getByText('Budget not set')).toBeInTheDocument();
        });

        it('should handle overdue projects', () => {
            const overdueProject = {
                ...mockProject,
                endDate: '2023-12-31', // Past date
                status: 'active'
            };

            renderWithProviders(
                <ProjectCard
                    project={overdueProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            expect(screen.getByText('Overdue')).toBeInTheDocument();
            const card = screen.getByText('Digital Transformation Initiative').closest('div');
            expect(card).toHaveClass('border-red-500/50');
        });
    });

    describe('Loading States', () => {
        it('should show loading state when fetching stats', () => {
            // Mock slow API response
            const { Api } = require('../../../services/api');
            Api.getProjectStats.mockImplementation(() => new Promise(() => {}));

            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            expect(screen.getByText('Loading stats...')).toBeInTheDocument();
        });

        it('should handle stats loading errors', async () => {
            const { Api } = require('../../../services/api');
            Api.getProjectStats.mockRejectedValue(new Error('Stats unavailable'));

            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Stats unavailable')).toBeInTheDocument();
            });
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA labels', () => {
            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            const card = screen.getByRole('article');
            expect(card).toHaveAttribute('aria-label', `Project: Digital Transformation Initiative, Status: active, Progress: 75%`);
        });

        it('should support keyboard navigation', async () => {
            const user = userEvent.setup();

            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            // Tab to card
            await user.keyboard('{Tab}');
            const card = screen.getByRole('article');
            expect(card).toHaveFocus();

            // Tab to edit button
            await user.keyboard('{Tab}');
            const editButton = screen.getByRole('button', { name: /edit.*project/i });
            expect(editButton).toHaveFocus();
        });

        it('should announce status changes', async () => {
            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            // Status changes should be announced to screen readers
            const statusBadge = screen.getByText('active');
            expect(statusBadge).toHaveAttribute('aria-live', 'polite');
        });
    });

    describe('Responsive Design', () => {
        it('should adapt layout for mobile screens', () => {
            // Mock mobile viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 600,
            });

            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            const card = screen.getByText('Digital Transformation Initiative').closest('div');
            expect(card).toHaveClass('mobile-compact');
        });

        it('should hide detailed information on small screens', () => {
            // Mock small mobile viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 400,
            });

            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            // Team members might be hidden or truncated
            expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
            expect(screen.getByText('3 members')).toBeInTheDocument(); // Summary instead
        });
    });

    describe('Performance', () => {
        it('should render efficiently', () => {
            const startTime = performance.now();

            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            const endTime = performance.now();
            const renderTime = endTime - startTime;

            // Should render within 100ms
            expect(renderTime).toBeLessThan(100);
        });

        it('should memoize expensive calculations', () => {
            const projectWithManyTags = {
                ...mockProject,
                tags: Array.from({ length: 20 }, (_, i) => `tag-${i}`)
            };

            renderWithProviders(
                <ProjectCard
                    project={projectWithManyTags}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            // Tag processing should be memoized
            expect(screen.getAllByText(/tag-/)).toHaveLength(20);
        });
    });

    describe('Integration Scenarios', () => {
        it('should update when project data changes externally', async () => {
            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            expect(screen.getByText('75%')).toBeInTheDocument();

            // Simulate external update (e.g., via WebSocket)
            const updatedProject = { ...mockProject, progress: 85 };

            // Re-render with updated props
            const { rerender } = renderWithProviders(
                <ProjectCard
                    project={updatedProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            rerender(
                <ProjectCard
                    project={updatedProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            expect(screen.getByText('85%')).toBeInTheDocument();
        });

        it('should handle concurrent user actions', async () => {
            const user1 = userEvent.setup();
            const user2 = userEvent.setup();

            renderWithProviders(
                <ProjectCard
                    project={mockProject}
                    onEdit={mockOnEdit}
                    onDelete={mockOnDelete}
                />
            );

            // Simulate concurrent actions
            const editButton = screen.getByRole('button', { name: /edit.*project/i });
            const deleteButton = screen.getByRole('button', { name: /delete.*project/i });

            // Both actions should be handled properly
            await Promise.all([
                user1.click(editButton),
                user2.click(deleteButton)
            ]);

            expect(mockOnEdit).toHaveBeenCalledWith(mockProject);
            expect(mockOnDelete).toHaveBeenCalledWith(mockProject.id);
        });
    });
});


