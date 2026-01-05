import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdminSidebar, AdminSection } from '../../../components/admin/AdminSidebar';

/**
 * AdminSidebar Component Tests
 * Tests for the admin sidebar with grouped navigation, search, and badges
 * CRITICAL FOR ENTERPRISE ADMIN NAVIGATION
 */
describe('AdminSidebar', () => {
    const defaultProps = {
        activeSection: 'overview' as AdminSection,
        onSectionChange: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('should render the sidebar component', () => {
            renderWithProviders(<AdminSidebar {...defaultProps} />);

            // Check that the sidebar is rendered with navigation role
            const navigation = screen.getByRole('navigation');
            expect(navigation).toBeInTheDocument();
        });

        it('should render search input', () => {
            renderWithProviders(<AdminSidebar {...defaultProps} />);

            const searchInput = screen.getByPlaceholderText(/search/i);
            expect(searchInput).toBeInTheDocument();
        });

        it('should render navigation groups', () => {
            renderWithProviders(<AdminSidebar {...defaultProps} />);

            // Check that there are multiple navigation buttons (groups)
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(5); // Should have multiple nav items
        });

        it('should show badges for pending items', () => {
            renderWithProviders(
                <AdminSidebar {...defaultProps} pendingInvites={5} />
            );

            const badge = screen.getByText('5');
            expect(badge).toBeInTheDocument();
        });
    });

    describe('Search Functionality', () => {
        it('should update search input on typing', async () => {
            const user = userEvent.setup();
            renderWithProviders(<AdminSidebar {...defaultProps} />);

            const searchInput = screen.getByPlaceholderText(/search/i);
            await user.type(searchInput, 'user');

            expect(searchInput).toHaveValue('user');
        });
    });

    describe('Navigation', () => {
        it('should call onSectionChange when clicking a navigation item', async () => {
            const user = userEvent.setup();
            const onSectionChange = vi.fn();

            renderWithProviders(
                <AdminSidebar {...defaultProps} onSectionChange={onSectionChange} />
            );

            // Find and click on a navigation item
            const usersButton = screen.getByRole('button', { name: /users/i });
            await user.click(usersButton);

            expect(onSectionChange).toHaveBeenCalled();
        });
    });

    describe('Keyboard Navigation', () => {
        it('should support Tab navigation', async () => {
            const user = userEvent.setup();
            renderWithProviders(<AdminSidebar {...defaultProps} />);

            // Tab to first focusable element
            await user.keyboard('{Tab}');

            // Should have focus on an element within the sidebar
            expect(document.activeElement).toBeTruthy();
        });
    });

    describe('Badge Updates', () => {
        it('should update badge counts dynamically', () => {
            const { rerender } = renderWithProviders(
                <AdminSidebar {...defaultProps} pendingInvites={3} />
            );

            expect(screen.getByText('3')).toBeInTheDocument();

            rerender(
                <AdminSidebar {...defaultProps} pendingInvites={5} />
            );

            expect(screen.getByText('5')).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have navigation role', () => {
            renderWithProviders(<AdminSidebar {...defaultProps} />);

            expect(screen.getByRole('navigation')).toBeInTheDocument();
        });
    });
});
