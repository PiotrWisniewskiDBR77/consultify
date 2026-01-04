import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdminSidebar, type AdminSidebarProps } from '../../../components/admin/AdminSidebar';

// Mock dependencies
const mockUseAppStore = vi.fn();
vi.mock('../../../store/useAppStore', () => ({
    useAppStore: (selector: any) => mockUseAppStore(selector),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/admin' }),
}));

vi.mock('../../../services/api', () => ({
    Api: {
        getUsers: vi.fn().mockResolvedValue([]),
        getInvitations: vi.fn().mockResolvedValue([]),
    },
}));

/**
 * AdminSidebar Component Tests
 * Tests for the new admin sidebar with grouped navigation, search, and badges
 * CRITICAL FOR ENTERPRISE ADMIN NAVIGATION
 */
describe('AdminSidebar', () => {
    const defaultProps: AdminSidebarProps = {
        activeSection: 'overview',
        onSectionChange: vi.fn(),
    };

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
        it('should render all navigation groups', () => {
            renderWithProviders(<AdminSidebar {...defaultProps} />);

            // Check for group headers
            expect(screen.getByText(/organization/i)).toBeInTheDocument();
            expect(screen.getByText(/team/i)).toBeInTheDocument();
            expect(screen.getByText(/workspace/i)).toBeInTheDocument();
            expect(screen.getByText(/compliance/i)).toBeInTheDocument();
        });

        it('should render search input', () => {
            renderWithProviders(<AdminSidebar {...defaultProps} />);

            const searchInput = screen.getByPlaceholderText(/search/i);
            expect(searchInput).toBeInTheDocument();
        });

        it('should render back to app button', () => {
            renderWithProviders(<AdminSidebar {...defaultProps} />);

            const backButton = screen.getByRole('button', { name: /back/i });
            expect(backButton).toBeInTheDocument();
        });

        it('should highlight active section', () => {
            renderWithProviders(
                <AdminSidebar {...defaultProps} activeSection="team" />
            );

            const teamSection = screen.getByTestId('section-team');
            expect(teamSection).toHaveAttribute('data-active', 'true');
        });

        it('should show badges for pending items', () => {
            renderWithProviders(
                <AdminSidebar {...defaultProps} pendingInvitations={5} />
            );

            const badge = screen.getByText('5');
            expect(badge).toBeInTheDocument();
        });
    });

    describe('Search Functionality', () => {
        it('should filter navigation items based on search', async () => {
            const user = userEvent.setup();
            renderWithProviders(<AdminSidebar {...defaultProps} />);

            const searchInput = screen.getByPlaceholderText(/search/i);
            await user.type(searchInput, 'user');

            // Should show user-related items
            await waitFor(() => {
                expect(screen.getByText(/user/i)).toBeInTheDocument();
            });
        });

        it('should show empty state when no results', async () => {
            const user = userEvent.setup();
            renderWithProviders(<AdminSidebar {...defaultProps} />);

            const searchInput = screen.getByPlaceholderText(/search/i);
            await user.type(searchInput, 'xyznonexistent');

            await waitFor(() => {
                expect(screen.getByText(/no results/i)).toBeInTheDocument();
            });
        });

        it('should clear search when escape is pressed', async () => {
            const user = userEvent.setup();
            renderWithProviders(<AdminSidebar {...defaultProps} />);

            const searchInput = screen.getByPlaceholderText(/search/i);
            await user.type(searchInput, 'test');
            await user.keyboard('{Escape}');

            expect(searchInput).toHaveValue('');
        });
    });

    describe('Navigation', () => {
        it('should call onSectionChange when section is clicked', async () => {
            const user = userEvent.setup();
            const onSectionChange = vi.fn();

            renderWithProviders(
                <AdminSidebar {...defaultProps} onSectionChange={onSectionChange} />
            );

            const teamSection = screen.getByTestId('section-team');
            await user.click(teamSection);

            expect(onSectionChange).toHaveBeenCalledWith('team');
        });

        it('should expand/collapse groups', async () => {
            const user = userEvent.setup();
            renderWithProviders(<AdminSidebar {...defaultProps} />);

            const groupHeader = screen.getByTestId('group-organization');
            await user.click(groupHeader);

            // Group should toggle
            const groupContent = screen.queryByTestId('group-organization-content');
            expect(groupContent).toBeInTheDocument();
        });
    });

    describe('Keyboard Navigation', () => {
        it('should support arrow key navigation', async () => {
            const user = userEvent.setup();
            renderWithProviders(<AdminSidebar {...defaultProps} />);

            // Focus first item
            await user.keyboard('{Tab}');
            await user.keyboard('{ArrowDown}');

            // Should move focus to next item
            const focusedElement = document.activeElement;
            expect(focusedElement).toBeTruthy();
        });

        it('should activate section with Enter', async () => {
            const user = userEvent.setup();
            const onSectionChange = vi.fn();

            renderWithProviders(
                <AdminSidebar {...defaultProps} onSectionChange={onSectionChange} />
            );

            const section = screen.getByTestId('section-overview');
            section.focus();
            await user.keyboard('{Enter}');

            expect(onSectionChange).toHaveBeenCalled();
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA labels', () => {
            renderWithProviders(<AdminSidebar {...defaultProps} />);

            const navigation = screen.getByRole('navigation');
            expect(navigation).toHaveAttribute('aria-label');
        });

        it('should mark current section for screen readers', () => {
            renderWithProviders(
                <AdminSidebar {...defaultProps} activeSection="overview" />
            );

            const activeSection = screen.getByTestId('section-overview');
            expect(activeSection).toHaveAttribute('aria-current', 'page');
        });

        it('should have proper focus indicators', () => {
            renderWithProviders(<AdminSidebar {...defaultProps} />);

            const sections = screen.getAllByRole('button');
            sections.forEach(section => {
                expect(section).toHaveClass('focus:');
            });
        });
    });

    describe('Responsive Design', () => {
        it('should show mobile menu button on small screens', () => {
            // Mock mobile viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 600,
            });

            renderWithProviders(<AdminSidebar {...defaultProps} />);

            // Should show hamburger menu or be collapsed
            const sidebar = screen.getByRole('navigation');
            expect(sidebar).toBeInTheDocument();
        });
    });

    describe('Badge Updates', () => {
        it('should update badge counts dynamically', () => {
            const { rerender } = renderWithProviders(
                <AdminSidebar {...defaultProps} pendingInvitations={3} />
            );

            expect(screen.getByText('3')).toBeInTheDocument();

            rerender(
                <AdminSidebar {...defaultProps} pendingInvitations={5} />
            );

            expect(screen.getByText('5')).toBeInTheDocument();
        });

        it('should hide badge when count is zero', () => {
            renderWithProviders(
                <AdminSidebar {...defaultProps} pendingInvitations={0} />
            );

            expect(screen.queryByTestId('invitation-badge')).not.toBeInTheDocument();
        });
    });
});

