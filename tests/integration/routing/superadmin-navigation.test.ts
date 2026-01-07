/**
 * Integration Test: SuperAdmin Navigation
 * 
 * Tests navigation between SuperAdmin sections and URL synchronization
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { AppView } from '@/types';
import { SuperAdminView } from '@/views/superadmin/SuperAdminView';
import { ROUTES } from '@/routes/routeConfig';

// Mock dependencies
vi.mock('@/services/api', () => ({
    Api: {
        getOrganizations: vi.fn().mockResolvedValue([]),
        getUsers: vi.fn().mockResolvedValue([]),
    },
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('SuperAdmin Navigation Integration Tests', () => {
    const mockUser = {
        id: 'test-user',
        email: 'test@example.com',
        role: 'SUPERADMIN',
        isAuthenticated: true,
    };

    beforeEach(() => {
        // Reset store
        const { setCurrentView, setCurrentUser } = useAppStore.getState();
        setCurrentView(AppView.SUPERADMIN_OVERVIEW);
        setCurrentUser(mockUser as any);
    });

    it('should navigate to Customers section and update URL', async () => {
        const { container } = render(
            <BrowserRouter>
                <SuperAdminView currentUser={mockUser as any} onNavigate={vi.fn()} />
            </BrowserRouter>
        );

        // Wait for component to mount
        await waitFor(() => {
            expect(screen.getByText(/Overview/i)).toBeInTheDocument();
        });

        // Check initial URL
        expect(window.location.pathname).toBe(ROUTES.SUPERADMIN.OVERVIEW);

        // Simulate clicking Customers button
        const customersButton = screen.getByText(/Customers/i);
        customersButton.click();

        // Wait for navigation
        await waitFor(() => {
            expect(window.location.pathname).toBe(ROUTES.SUPERADMIN.CUSTOMERS);
        });

        // Check that currentView is updated
        const { currentView } = useAppStore.getState();
        expect(currentView).toBe(AppView.SUPERADMIN_CUSTOMERS);
    });

    it('should navigate to AI Infrastructure section and update URL', async () => {
        const { container } = render(
            <BrowserRouter>
                <SuperAdminView currentUser={mockUser as any} onNavigate={vi.fn()} />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Overview/i)).toBeInTheDocument();
        });

        // Simulate clicking AI Infrastructure button
        const aiInfraButton = screen.getByText(/AI Infrastructure/i);
        aiInfraButton.click();

        await waitFor(() => {
            expect(window.location.pathname).toBe(ROUTES.SUPERADMIN.AI_INFRASTRUCTURE);
        });

        const { currentView } = useAppStore.getState();
        expect(currentView).toBe(AppView.SUPERADMIN_AI_INFRASTRUCTURE);
    });

    it('should navigate to Revenue section and update URL', async () => {
        const { container } = render(
            <BrowserRouter>
                <SuperAdminView currentUser={mockUser as any} onNavigate={vi.fn()} />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Overview/i)).toBeInTheDocument();
        });

        // Simulate clicking Revenue button
        const revenueButton = screen.getByText(/Revenue/i);
        revenueButton.click();

        await waitFor(() => {
            expect(window.location.pathname).toBe(ROUTES.SUPERADMIN.REVENUE);
        });

        const { currentView } = useAppStore.getState();
        expect(currentView).toBe(AppView.SUPERADMIN_REVENUE);
    });

    it('should sync URL changes to currentView', async () => {
        const { container } = render(
            <BrowserRouter>
                <SuperAdminView currentUser={mockUser as any} onNavigate={vi.fn()} />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Overview/i)).toBeInTheDocument();
        });

        // Simulate URL change (browser back/forward)
        window.history.pushState({}, '', ROUTES.SUPERADMIN.SYSTEM);
        window.dispatchEvent(new PopStateEvent('popstate'));

        await waitFor(() => {
            const { currentView } = useAppStore.getState();
            expect(currentView).toBe(AppView.SUPERADMIN_SYSTEM);
        });
    });
});

