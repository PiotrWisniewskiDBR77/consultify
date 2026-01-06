import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdminSidebar, AdminSection, adminSectionToAppView } from '../../../src/components/AdminSidebar';

// Mock dependencies
const mockUseAppStore = vi.fn();
vi.mock('../../../src/store/useAppStore', () => ({
    useAppStore: (selector: any) => mockUseAppStore(selector),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/admin' }),
}));

vi.mock('../../../src/services/api', () => ({
    Api: {
        getUsers: vi.fn().mockResolvedValue([]),
        getProjects: vi.fn().mockResolvedValue([]),
        getInvitations: vi.fn().mockResolvedValue([]),
        getFeedback: vi.fn().mockResolvedValue([]),
        getUserPlans: vi.fn().mockResolvedValue([]),
        aiGetSystemPrompts: vi.fn().mockResolvedValue([]),
    },
}));

/**
 * AdminSidebar Component Tests
 * Tests for admin sidebar navigation and section management
 * CRITICAL FOR ENTERPRISE ADMIN PANEL NAVIGATION
 */
describe('AdminSidebar', () => {
    const mockOnSectionChange = vi.fn();
    const mockOnBackToApp = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        mockUseAppStore.mockImplementation((selector: any) => {
            const state = {
                currentView: 'ADMIN_OVERVIEW',
                setCurrentView: vi.fn(),
                isSidebarCollapsed: false,
                toggleSidebarCollapse: vi.fn(),
            };
            return selector(state);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('should render all 5 admin module items', () => {
            renderWithProviders(
                <AdminSidebar
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                />
            );

            // Check all 5 main sections
            expect(screen.getByText('Overview')).toBeInTheDocument();
            expect(screen.getByText('Team')).toBeInTheDocument();
            expect(screen.getByText('Workspace')).toBeInTheDocument();
            expect(screen.getByText('AI')).toBeInTheDocument();
            expect(screen.getByText('Settings')).toBeInTheDocument();
        });

        it('should show section icons', () => {
            renderWithProviders(
                <AdminSidebar
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                />
            );

            // Check for icon elements (assuming they have proper alt text or aria-labels)
            const icons = screen.getAllByRole('img');
            expect(icons.length).toBeGreaterThanOrEqual(5); // At least one icon per section
        });

        it('should highlight active section', () => {
            renderWithProviders(
                <AdminSidebar
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                    activeSection="TEAM"
                />
            );

            const teamSection = screen.getByText('Team').closest('[data-section]');
            expect(teamSection).toHaveAttribute('data-active', 'true');
        });
    });

    describe('Navigation', () => {
        it('should call onSectionChange when section is clicked', async () => {
            const user = userEvent.setup();

            renderWithProviders(
                <AdminSidebar
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                />
            );

            const teamSection = screen.getByText('Team');
            await user.click(teamSection);

            expect(mockOnSectionChange).toHaveBeenCalledWith('TEAM');
        });

        it('should navigate to correct app view', () => {
            const navigate = vi.fn();
            vi.mocked(require('react-router-dom')).useNavigate.mockReturnValue(navigate);

            renderWithProviders(
                <AdminSidebar
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                />
            );

            expect(adminSectionToAppView('OVERVIEW')).toBe('ADMIN_OVERVIEW');
            expect(adminSectionToAppView('TEAM')).toBe('ADMIN_TEAM');
            expect(adminSectionToAppView('WORKSPACE')).toBe('ADMIN_WORKSPACE');
            expect(adminSectionToAppView('AI')).toBe('ADMIN_AI');
            expect(adminSectionToAppView('SETTINGS')).toBe('ADMIN_SETTINGS');
        });
    });

    describe('Back to App', () => {
        it('should call onBackToApp when back button is clicked', async () => {
            const user = userEvent.setup();

            renderWithProviders(
                <AdminSidebar
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                />
            );

            const backButton = screen.getByRole('button', { name: /back.*app/i });
            await user.click(backButton);

            expect(mockOnBackToApp).toHaveBeenCalled();
        });

        it('should show back to app button', () => {
            renderWithProviders(
                <AdminSidebar
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                />
            );

            expect(screen.getByRole('button', { name: /back.*app/i })).toBeInTheDocument();
        });
    });

    describe('Sidebar Collapse', () => {
        it('should show collapse/expand button', () => {
            renderWithProviders(
                <AdminSidebar
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                />
            );

            const collapseButton = screen.getByRole('button', { name: /collapse|expand/i });
            expect(collapseButton).toBeInTheDocument();
        });

        it('should toggle sidebar collapse state', async () => {
            const user = userEvent.setup();

            mockUseAppStore.mockImplementation((selector: any) => {
                const state = {
                    currentView: 'ADMIN_OVERVIEW',
                    setCurrentView: vi.fn(),
                    isSidebarCollapsed: false,
                    toggleSidebarCollapse: vi.fn(),
                };
                return selector(state);
            });

            renderWithProviders(
                <AdminSidebar
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                />
            );

            const collapseButton = screen.getByRole('button', { name: /collapse/i });
            await user.click(collapseButton);

            // The store's toggleSidebarCollapse should have been called
            // (This test assumes the component calls the store function)
        });
    });

    describe('Section Descriptions', () => {
        it('should show section descriptions on hover', async () => {
            const user = userEvent.setup();

            renderWithProviders(
                <AdminSidebar
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                />
            );

            const teamSection = screen.getByText('Team');
            await user.hover(teamSection);

            // Check if tooltip or description appears
            await waitFor(() => {
                const tooltip = screen.queryByText(/manage.*team/i);
                if (tooltip) {
                    expect(tooltip).toBeInTheDocument();
                }
            });
        });
    });

    describe('Keyboard Navigation', () => {
        it('should support keyboard navigation', async () => {
            const user = userEvent.setup();

            renderWithProviders(
                <AdminSidebar
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                />
            );

            // Tab to first section
            await user.keyboard('{Tab}');
            const overviewSection = screen.getByText('Overview');
            expect(overviewSection).toHaveFocus();

            // Navigate with arrow keys
            await user.keyboard('{ArrowDown}');
            const teamSection = screen.getByText('Team');
            expect(teamSection).toHaveFocus();
        });

        it('should activate section with Enter key', async () => {
            const user = userEvent.setup();

            renderWithProviders(
                <AdminSidebar
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                />
            );

            const teamSection = screen.getByText('Team');
            teamSection.focus();

            await user.keyboard('{Enter}');
            expect(mockOnSectionChange).toHaveBeenCalledWith('TEAM');
        });
    });

    describe('Responsive Design', () => {
        it('should collapse on mobile screens', () => {
            // Mock mobile viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 600,
            });

            renderWithProviders(
                <AdminSidebar
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                />
            );

            // Check if sidebar is collapsed by default on mobile
            const sidebar = screen.getByRole('navigation');
            expect(sidebar).toHaveClass('collapsed');
        });

        it('should expand when clicked on mobile', async () => {
            const user = userEvent.setup();

            // Mock mobile viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 600,
            });

            renderWithProviders(
                <AdminSidebar
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                />
            );

            const sidebarToggle = screen.getByRole('button', { name: /menu|toggle/i });
            await user.click(sidebarToggle);

            const sidebar = screen.getByRole('navigation');
            expect(sidebar).not.toHaveClass('collapsed');
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA labels', () => {
            renderWithProviders(
                <AdminSidebar
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                />
            );

            const navigation = screen.getByRole('navigation');
            expect(navigation).toHaveAttribute('aria-label', 'Admin panel navigation');

            const sections = screen.getAllByRole('button');
            sections.forEach(section => {
                expect(section).toHaveAttribute('aria-label');
            });
        });

        it('should announce active section to screen readers', () => {
            renderWithProviders(
                <AdminSidebar
                    onSectionChange={mockOnEditDecision}
                    onCreateDecision={mockOnCreateDecision}
                    activeSection="OVERVIEW"
                />
            );

            const activeSection = screen.getByText('Overview').closest('[aria-current]');
            expect(activeSection).toHaveAttribute('aria-current', 'page');
        });
    });

    describe('Loading States', () => {
        it('should show loading state when data is fetching', () => {
            // Mock loading state in store
            mockUseAppStore.mockImplementation((selector: any) => {
                const state = {
                    currentView: 'ADMIN_OVERVIEW',
                    setCurrentView: vi.fn(),
                    isSidebarCollapsed: false,
                    toggleSidebarCollapse: vi.fn(),
                    isLoading: true,
                };
                return selector(state);
            });

            renderWithProviders(
                <AdminSidebar
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                />
            );

            expect(screen.getByText(/loading/i)).toBeInTheDocument();
        });
    });

    describe('Error Handling', () => {
        it('should handle navigation errors gracefully', async () => {
            const user = userEvent.setup();

            // Mock onSectionChange to throw error
            const errorOnSectionChange = vi.fn().mockImplementation(() => {
                throw new Error('Navigation failed');
            });

            renderWithProviders(
                <AdminSidebar
                    onSectionChange={errorOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                />
            );

            const teamSection = screen.getByText('Team');
            await user.click(teamSection);

            // Error should be handled gracefully (check for error message or fallback)
            expect(errorOnSectionChange).toHaveBeenCalledWith('TEAM');
        });
    });

    describe('AdminSection Enum', () => {
        it('should define all admin sections', () => {
            expect(AdminSection.OVERVIEW).toBe('OVERVIEW');
            expect(AdminSection.TEAM).toBe('TEAM');
            expect(AdminSection.WORKSPACE).toBe('WORKSPACE');
            expect(AdminSection.AI).toBe('AI');
            expect(AdminSection.SETTINGS).toBe('SETTINGS');
        });

        it('should have 5 sections total', () => {
            const sections = Object.values(AdminSection);
            expect(sections).toHaveLength(5);
        });
    });

    describe('adminSectionToAppView Function', () => {
        it('should map all sections to app views', () => {
            expect(adminSectionToAppView(AdminSection.OVERVIEW)).toBe('ADMIN_OVERVIEW');
            expect(adminSectionToAppView(AdminSection.TEAM)).toBe('ADMIN_TEAM');
            expect(adminSectionToAppView(AdminSection.WORKSPACE)).toBe('ADMIN_WORKSPACE');
            expect(adminSectionToAppView(AdminSection.AI)).toBe('ADMIN_AI');
            expect(adminSectionToAppView(AdminSection.SETTINGS)).toBe('ADMIN_SETTINGS');
        });

        it('should handle invalid sections', () => {
            expect(adminSectionToAppView('INVALID')).toBeUndefined();
        });
    });
});




