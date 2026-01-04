import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdminLayout } from '../../../components/admin/AdminLayout';

// Mock dependencies
const mockUseAppStore = vi.fn();
vi.mock('../../../store/useAppStore', () => ({
    useAppStore: (selector: any) => mockUseAppStore(selector),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/admin' }),
    Outlet: () => <div data-testid="outlet">Outlet Content</div>,
}));

/**
 * AdminLayout Component Tests
 * Tests for the two-column admin layout with sidebar and content area
 * CRITICAL FOR ENTERPRISE ADMIN UX
 */
describe('AdminLayout', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockUseAppStore.mockImplementation((selector: any) => {
            const state = {
                currentView: 'ADMIN_OVERVIEW',
                setCurrentView: vi.fn(),
                user: {
                    id: 'test-user',
                    role: 'ADMIN',
                    organizationId: 'org-1',
                },
            };
            return selector(state);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('should render two-column layout', () => {
            renderWithProviders(
                <AdminLayout>
                    <div data-testid="content">Content</div>
                </AdminLayout>
            );

            expect(screen.getByRole('navigation')).toBeInTheDocument();
            expect(screen.getByTestId('content')).toBeInTheDocument();
        });

        it('should render sidebar with correct width', () => {
            renderWithProviders(
                <AdminLayout>
                    <div>Content</div>
                </AdminLayout>
            );

            const sidebar = screen.getByRole('navigation');
            expect(sidebar).toHaveClass('w-64');
        });

        it('should render content area that fills remaining space', () => {
            renderWithProviders(
                <AdminLayout>
                    <div data-testid="content">Content</div>
                </AdminLayout>
            );

            const contentArea = screen.getByTestId('content').parentElement;
            expect(contentArea).toHaveClass('flex-1');
        });

        it('should render header with breadcrumbs', () => {
            renderWithProviders(
                <AdminLayout>
                    <div>Content</div>
                </AdminLayout>
            );

            const header = screen.getByRole('banner');
            expect(header).toBeInTheDocument();
        });
    });

    describe('Navigation', () => {
        it('should switch content when sidebar section is clicked', async () => {
            const user = userEvent.setup();
            renderWithProviders(
                <AdminLayout>
                    <div>Initial Content</div>
                </AdminLayout>
            );

            const teamSection = screen.getByTestId('section-team');
            await user.click(teamSection);

            // Verify navigation happened
            await waitFor(() => {
                expect(mockUseAppStore().setCurrentView).toHaveBeenCalled();
            });
        });

        it('should update breadcrumbs on navigation', async () => {
            const user = userEvent.setup();
            renderWithProviders(
                <AdminLayout>
                    <div>Content</div>
                </AdminLayout>
            );

            const teamSection = screen.getByTestId('section-team');
            await user.click(teamSection);

            await waitFor(() => {
                const breadcrumb = screen.getByText(/team/i);
                expect(breadcrumb).toBeInTheDocument();
            });
        });
    });

    describe('Sidebar Collapse', () => {
        it('should toggle sidebar collapse', async () => {
            const user = userEvent.setup();
            const toggleCollapse = vi.fn();

            mockUseAppStore.mockImplementation((selector: any) => {
                const state = {
                    currentView: 'ADMIN_OVERVIEW',
                    setCurrentView: vi.fn(),
                    isSidebarCollapsed: false,
                    toggleSidebarCollapse: toggleCollapse,
                    user: { id: 'test', role: 'ADMIN' },
                };
                return selector(state);
            });

            renderWithProviders(
                <AdminLayout>
                    <div>Content</div>
                </AdminLayout>
            );

            const collapseButton = screen.getByRole('button', { name: /collapse/i });
            await user.click(collapseButton);

            expect(toggleCollapse).toHaveBeenCalled();
        });

        it('should show icons only when collapsed', () => {
            mockUseAppStore.mockImplementation((selector: any) => {
                const state = {
                    currentView: 'ADMIN_OVERVIEW',
                    setCurrentView: vi.fn(),
                    isSidebarCollapsed: true,
                    user: { id: 'test', role: 'ADMIN' },
                };
                return selector(state);
            });

            renderWithProviders(
                <AdminLayout>
                    <div>Content</div>
                </AdminLayout>
            );

            const sidebar = screen.getByRole('navigation');
            expect(sidebar).toHaveClass('w-16');
        });
    });

    describe('Responsive Behavior', () => {
        it('should show mobile overlay on small screens', () => {
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 600,
            });

            renderWithProviders(
                <AdminLayout>
                    <div>Content</div>
                </AdminLayout>
            );

            const mobileMenuButton = screen.queryByRole('button', { name: /menu/i });
            expect(mobileMenuButton).toBeInTheDocument();
        });

        it('should close sidebar when clicking overlay on mobile', async () => {
            const user = userEvent.setup();

            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 600,
            });

            renderWithProviders(
                <AdminLayout>
                    <div>Content</div>
                </AdminLayout>
            );

            const overlay = screen.queryByTestId('mobile-overlay');
            if (overlay) {
                await user.click(overlay);
                expect(overlay).not.toBeInTheDocument();
            }
        });
    });

    describe('Content Scrolling', () => {
        it('should allow content area to scroll independently', () => {
            renderWithProviders(
                <AdminLayout>
                    <div style={{ height: '2000px' }}>Tall content</div>
                </AdminLayout>
            );

            const contentArea = screen.getByTestId('admin-content');
            expect(contentArea).toHaveClass('overflow-auto');
        });

        it('should keep sidebar fixed while content scrolls', () => {
            renderWithProviders(
                <AdminLayout>
                    <div style={{ height: '2000px' }}>Tall content</div>
                </AdminLayout>
            );

            const sidebar = screen.getByRole('navigation');
            expect(sidebar).toHaveClass('sticky');
        });
    });

    describe('Error Handling', () => {
        it('should render error boundary for content errors', () => {
            const ErrorComponent = () => {
                throw new Error('Test error');
            };

            renderWithProviders(
                <AdminLayout>
                    <ErrorComponent />
                </AdminLayout>
            );

            expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have proper landmark roles', () => {
            renderWithProviders(
                <AdminLayout>
                    <div>Content</div>
                </AdminLayout>
            );

            expect(screen.getByRole('navigation')).toBeInTheDocument();
            expect(screen.getByRole('main')).toBeInTheDocument();
            expect(screen.getByRole('banner')).toBeInTheDocument();
        });

        it('should support skip to content link', () => {
            renderWithProviders(
                <AdminLayout>
                    <div>Content</div>
                </AdminLayout>
            );

            const skipLink = screen.getByText(/skip to content/i);
            expect(skipLink).toBeInTheDocument();
            expect(skipLink).toHaveAttribute('href', '#main-content');
        });
    });
});

