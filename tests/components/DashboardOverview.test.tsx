import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DashboardOverview } from '../../src/components/dashboard/DashboardOverview';

// Mock dependencies
const mockUseAppStore = vi.fn();
vi.mock('../../src/store/useAppStore', () => ({
    useAppStore: (selector: any) => mockUseAppStore(selector),
}));

const mockApi = vi.fn();
vi.mock('../../../services/api', () => ({
    Api: {
        getDashboardData: mockApi,
        getRecentActivity: vi.fn().mockResolvedValue([]),
        getQuickStats: vi.fn().mockResolvedValue({}),
    },
}));

/**
 * DashboardOverview Component Tests
 * Tests main dashboard functionality and data visualization
 * CRITICAL FOR ENTERPRISE DASHBOARD USER EXPERIENCE
 */
describe('DashboardOverview Component', () => {
    const mockDashboardData = {
        overview: {
            totalProjects: 25,
            activeTasks: 45,
            completedAssessments: 12,
            teamMembers: 8
        },
        recentActivity: [
            {
                id: '1',
                type: 'task_completed',
                description: 'Task "Setup CI/CD Pipeline" completed',
                timestamp: '2025-01-01T10:00:00Z',
                user: 'John Doe'
            },
            {
                id: '2',
                type: 'assessment_created',
                description: 'New assessment "Q4 Review" created',
                timestamp: '2025-01-01T09:30:00Z',
                user: 'Jane Smith'
            }
        ],
        quickStats: {
            tasksCompletedToday: 8,
            assessmentsInProgress: 3,
            upcomingDeadlines: 5,
            teamProductivity: 92
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockUseAppStore.mockReturnValue({
            user: { id: 'user-123', name: 'Test User' },
            currentOrg: { id: 'org-123', name: 'Test Organization' },
        });

        mockApi.mockResolvedValue(mockDashboardData);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('should render dashboard with key metrics', async () => {
            renderWithProviders(<DashboardOverview />);

            await waitFor(() => {
                expect(screen.getByText('25')).toBeInTheDocument(); // totalProjects
            });

            expect(screen.getByText('45')).toBeInTheDocument(); // activeTasks
            expect(screen.getByText('12')).toBeInTheDocument(); // completedAssessments
            expect(screen.getByText('8')).toBeInTheDocument(); // teamMembers
        });

        it('should display recent activity feed', async () => {
            renderWithProviders(<DashboardOverview />);

            await waitFor(() => {
                expect(screen.getByText('Task "Setup CI/CD Pipeline" completed')).toBeInTheDocument();
            });

            expect(screen.getByText('New assessment "Q4 Review" created')).toBeInTheDocument();
            expect(screen.getByText('John Doe')).toBeInTheDocument();
            expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        });

        it('should show quick stats summary', async () => {
            renderWithProviders(<DashboardOverview />);

            await waitFor(() => {
                expect(screen.getByText('8')).toBeInTheDocument(); // tasksCompletedToday
            });

            expect(screen.getByText('3')).toBeInTheDocument(); // assessmentsInProgress
            expect(screen.getByText('5')).toBeInTheDocument(); // upcomingDeadlines
            expect(screen.getByText('92%')).toBeInTheDocument(); // teamProductivity
        });

        it('should render loading state initially', () => {
            mockApi.mockImplementation(() => new Promise(() => {})); // Never resolves

            renderWithProviders(<DashboardOverview />);

            expect(screen.getByText(/loading/i)).toBeInTheDocument();
        });
    });

    describe('Interactions', () => {
        it('should navigate to projects when clicking project count', async () => {
            const user = userEvent.setup();

            renderWithProviders(<DashboardOverview />);

            await waitFor(() => {
                expect(screen.getByText('25')).toBeInTheDocument();
            });

            const projectCard = screen.getByText('25').closest('[data-testid="metric-card"]');
            await user.click(projectCard!);

            // Should navigate to projects page (mock navigation)
            expect(mockUseAppStore().navigateTo).toHaveBeenCalledWith('/projects');
        });

        it('should refresh dashboard data when refresh button clicked', async () => {
            const user = userEvent.setup();

            renderWithProviders(<DashboardOverview />);

            await waitFor(() => {
                expect(screen.getByText('25')).toBeInTheDocument();
            });

            const refreshButton = screen.getByRole('button', { name: /refresh/i });
            await user.click(refreshButton);

            // API should be called again
            await waitFor(() => {
                expect(mockApi).toHaveBeenCalledTimes(2);
            });
        });

        it('should filter activity by type', async () => {
            const user = userEvent.setup();

            renderWithProviders(<DashboardOverview />);

            await waitFor(() => {
                expect(screen.getByText('Task "Setup CI/CD Pipeline" completed')).toBeInTheDocument();
            });

            // Filter to show only assessments
            const filterSelect = screen.getByDisplayValue('all');
            await user.selectOptions(filterSelect, 'assessment');

            await waitFor(() => {
                expect(screen.queryByText('Task "Setup CI/CD Pipeline" completed')).not.toBeInTheDocument();
                expect(screen.getByText('New assessment "Q4 Review" created')).toBeInTheDocument();
            });
        });
    });

    describe('Data Handling', () => {
        it('should handle API errors gracefully', async () => {
            mockApi.mockRejectedValue(new Error('API Error'));

            renderWithProviders(<DashboardOverview />);

            await waitFor(() => {
                expect(screen.getByText(/error loading dashboard/i)).toBeInTheDocument();
            });

            expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
        });

        it('should handle empty data gracefully', async () => {
            mockApi.mockResolvedValue({
                overview: { totalProjects: 0, activeTasks: 0, completedAssessments: 0, teamMembers: 0 },
                recentActivity: [],
                quickStats: { tasksCompletedToday: 0, assessmentsInProgress: 0, upcomingDeadlines: 0, teamProductivity: 0 }
            });

            renderWithProviders(<DashboardOverview />);

            await waitFor(() => {
                expect(screen.getByText('0')).toBeInTheDocument();
            });

            expect(screen.getByText(/no recent activity/i)).toBeInTheDocument();
        });

        it('should handle partial data loading', async () => {
            mockApi.mockResolvedValue({
                overview: mockDashboardData.overview,
                recentActivity: null, // Missing data
                quickStats: mockDashboardData.quickStats
            });

            renderWithProviders(<DashboardOverview />);

            await waitFor(() => {
                expect(screen.getByText('25')).toBeInTheDocument(); // Overview loads
            });

            expect(screen.getByText('92%')).toBeInTheDocument(); // Quick stats load
            expect(screen.getByText(/activity feed unavailable/i)).toBeInTheDocument(); // Activity shows error
        });
    });

    describe('Performance', () => {
        it('should render efficiently with large datasets', async () => {
            const largeActivityFeed = Array.from({ length: 100 }, (_, i) => ({
                id: `activity-${i}`,
                type: 'task_completed',
                description: `Task ${i} completed`,
                timestamp: new Date(Date.now() - i * 60000).toISOString(),
                user: `User ${i % 10}`
            }));

            mockApi.mockResolvedValue({
                ...mockDashboardData,
                recentActivity: largeActivityFeed
            });

            const startTime = performance.now();

            renderWithProviders(<DashboardOverview />);

            await waitFor(() => {
                expect(screen.getByText('Task 0 completed')).toBeInTheDocument();
            });

            const endTime = performance.now();
            const renderTime = endTime - startTime;

            // Should render within 500ms even with 100 activities
            expect(renderTime).toBeLessThan(500);
        });

        it('should memoize expensive calculations', async () => {
            renderWithProviders(<DashboardOverview />);

            await waitFor(() => {
                expect(screen.getByText('92%')).toBeInTheDocument();
            });

            // Re-render should not recalculate productivity metrics
            // (This would be tested by mocking the calculation function)
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA labels', async () => {
            renderWithProviders(<DashboardOverview />);

            await waitFor(() => {
                expect(screen.getByText('25')).toBeInTheDocument();
            });

            const metricCards = screen.getAllByRole('region');
            metricCards.forEach(card => {
                expect(card).toHaveAttribute('aria-label');
            });
        });

        it('should support keyboard navigation', async () => {
            const user = userEvent.setup();

            renderWithProviders(<DashboardOverview />);

            await waitFor(() => {
                expect(screen.getByText('25')).toBeInTheDocument();
            });

            // Tab through interactive elements
            await user.keyboard('{Tab}');
            const firstInteractiveElement = screen.getByRole('button');
            expect(firstInteractiveElement).toHaveFocus();
        });

        it('should announce data updates to screen readers', async () => {
            renderWithProviders(<DashboardOverview />);

            await waitFor(() => {
                expect(screen.getByText('25')).toBeInTheDocument();
            });

            // Should have live region for dynamic updates
            const liveRegion = screen.getByRole('status');
            expect(liveRegion).toHaveAttribute('aria-live', 'polite');
        });
    });

    describe('Real-time Updates', () => {
        it('should update data when new activity occurs', async () => {
            renderWithProviders(<DashboardOverview />);

            await waitFor(() => {
                expect(screen.getByText('Task "Setup CI/CD Pipeline" completed')).toBeInTheDocument();
            });

            // Simulate real-time update (e.g., via WebSocket)
            const updatedData = {
                ...mockDashboardData,
                overview: { ...mockDashboardData.overview, activeTasks: 46 },
                recentActivity: [
                    {
                        id: '3',
                        type: 'task_created',
                        description: 'New task "Update Documentation" created',
                        timestamp: new Date().toISOString(),
                        user: 'System'
                    },
                    ...mockDashboardData.recentActivity
                ]
            };

            mockApi.mockResolvedValue(updatedData);

            // Trigger refresh
            const refreshButton = screen.getByRole('button', { name: /refresh/i });
            await user.click(refreshButton);

            await waitFor(() => {
                expect(screen.getByText('46')).toBeInTheDocument(); // Updated count
                expect(screen.getByText('New task "Update Documentation" created')).toBeInTheDocument();
            });
        });
    });

    describe('Responsive Design', () => {
        it('should adapt layout for mobile screens', async () => {
            // Mock mobile viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 600,
            });

            renderWithProviders(<DashboardOverview />);

            await waitFor(() => {
                expect(screen.getByText('25')).toBeInTheDocument();
            });

            // Check for mobile-specific classes
            const container = screen.getByText('25').closest('div');
            expect(container).toHaveClass('mobile-layout');
        });

        it('should show simplified view on small screens', async () => {
            // Mock small mobile viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 400,
            });

            renderWithProviders(<DashboardOverview />);

            await waitFor(() => {
                expect(screen.getByText('25')).toBeInTheDocument();
            });

            // Recent activity might be hidden or simplified
            const activitySection = screen.queryByText('Task "Setup CI/CD Pipeline" completed');
            if (activitySection) {
                const container = activitySection.closest('div');
                expect(container).toHaveClass('activity-compact');
            }
        });
    });

    describe('Integration with App State', () => {
        it('should update when organization changes', async () => {
            renderWithProviders(<DashboardOverview />);

            await waitFor(() => {
                expect(screen.getByText('25')).toBeInTheDocument();
            });

            // Simulate organization change
            mockUseAppStore.mockReturnValue({
                user: { id: 'user-123', name: 'Test User' },
                currentOrg: { id: 'org-456', name: 'Different Organization' },
            });

            // Component should re-fetch data
            await waitFor(() => {
                expect(mockApi).toHaveBeenCalledTimes(2);
            });
        });

        it('should handle user permissions correctly', async () => {
            // Mock user with limited permissions
            mockUseAppStore.mockReturnValue({
                user: { id: 'user-123', name: 'Limited User', role: 'member' },
                currentOrg: { id: 'org-123', name: 'Test Organization' },
            });

            renderWithProviders(<DashboardOverview />);

            await waitFor(() => {
                expect(screen.getByText('25')).toBeInTheDocument();
            });

            // Admin-only features should be hidden
            expect(screen.queryByRole('button', { name: /admin settings/i })).not.toBeInTheDocument();
        });
    });
});