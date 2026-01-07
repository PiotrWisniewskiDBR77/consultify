/**
 * SuperAdminView Unit Tests
 * Tests for URL synchronization and routing in SuperAdminView
 */

import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

import { SuperAdminView } from '@/views/superadmin/SuperAdminView';
import { useAppStore } from '@/store/useAppStore';
import { AppView } from '@/types';

// Mock store
vi.mock('@/store/useAppStore');
vi.mock('react-hot-toast', () => ({
    default: {
        toast: {
            success: vi.fn(),
            error: vi.fn(),
        },
    },
}));

// Mock lazy-loaded modules
vi.mock('@/views/superadmin/OverviewModule', () => ({
    OverviewModule: () => <div data-testid="overview-module">Overview Module</div>,
}));

vi.mock('@/views/superadmin/CustomersModule', () => ({
    CustomersModule: () => <div data-testid="customers-module">Customers Module</div>,
}));

vi.mock('@/views/superadmin/AIInfrastructureModule', () => ({
    AIInfrastructureModule: () => <div data-testid="ai-infrastructure-module">AI Infrastructure Module</div>,
}));

describe('SuperAdminView - URL Synchronization', () => {
    const mockSetCurrentView = vi.fn();
    const mockCurrentView = AppView.SUPERADMIN_OVERVIEW;

    beforeEach(() => {
        vi.clearAllMocks();
        (useAppStore as unknown as Mock).mockReturnValue({
            isSidebarCollapsed: false,
            currentView: mockCurrentView,
            setCurrentView: mockSetCurrentView,
        });
    });

    it('should sync URL /superadmin/overview to SUPERADMIN_OVERVIEW', async () => {
        render(
            <MemoryRouter initialEntries={['/superadmin/overview']}>
                <SuperAdminView currentUser={null} onNavigate={vi.fn()} />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_OVERVIEW);
        });
    });

    it('should sync URL /superadmin/customers to SUPERADMIN_CUSTOMERS', async () => {
        render(
            <MemoryRouter initialEntries={['/superadmin/customers']}>
                <SuperAdminView currentUser={null} onNavigate={vi.fn()} />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_CUSTOMERS);
        });
    });

    it('should sync URL /superadmin/ai-infrastructure to SUPERADMIN_AI_INFRASTRUCTURE', async () => {
        render(
            <MemoryRouter initialEntries={['/superadmin/ai-infrastructure']}>
                <SuperAdminView currentUser={null} onNavigate={vi.fn()} />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_AI_INFRASTRUCTURE);
        });
    });

    it('should sync URL /superadmin/ai-development to SUPERADMIN_AI_DEVELOPMENT', async () => {
        render(
            <MemoryRouter initialEntries={['/superadmin/ai-development']}>
                <SuperAdminView currentUser={null} onNavigate={vi.fn()} />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_AI_DEVELOPMENT);
        });
    });

    it('should sync URL /superadmin/ai-operations to SUPERADMIN_AI_OPERATIONS', async () => {
        render(
            <MemoryRouter initialEntries={['/superadmin/ai-operations']}>
                <SuperAdminView currentUser={null} onNavigate={vi.fn()} />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_AI_OPERATIONS);
        });
    });

    it('should sync URL /superadmin/system to SUPERADMIN_SYSTEM', async () => {
        render(
            <MemoryRouter initialEntries={['/superadmin/system']}>
                <SuperAdminView currentUser={null} onNavigate={vi.fn()} />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_SYSTEM);
        });
    });

    it('should sync URL /superadmin/content to SUPERADMIN_CONTENT', async () => {
        render(
            <MemoryRouter initialEntries={['/superadmin/content']}>
                <SuperAdminView currentUser={null} onNavigate={vi.fn()} />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_CONTENT);
        });
    });

    it('should sync URL /superadmin/revenue to SUPERADMIN_REVENUE', async () => {
        render(
            <MemoryRouter initialEntries={['/superadmin/revenue']}>
                <SuperAdminView currentUser={null} onNavigate={vi.fn()} />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_REVENUE);
        });
    });

    it('should sync URL /superadmin/security to SUPERADMIN_SECURITY', async () => {
        render(
            <MemoryRouter initialEntries={['/superadmin/security']}>
                <SuperAdminView currentUser={null} onNavigate={vi.fn()} />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_SECURITY);
        });
    });

    it('should sync URL /superadmin/analytics to SUPERADMIN_ANALYTICS', async () => {
        render(
            <MemoryRouter initialEntries={['/superadmin/analytics']}>
                <SuperAdminView currentUser={null} onNavigate={vi.fn()} />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_ANALYTICS);
        });
    });

    it('should sync URL /superadmin/configuration to SUPERADMIN_CONFIGURATION', async () => {
        render(
            <MemoryRouter initialEntries={['/superadmin/configuration']}>
                <SuperAdminView currentUser={null} onNavigate={vi.fn()} />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_CONFIGURATION);
        });
    });

    it('should sync URL /superadmin to SUPERADMIN_OVERVIEW (default)', async () => {
        render(
            <MemoryRouter initialEntries={['/superadmin']}>
                <SuperAdminView currentUser={null} onNavigate={vi.fn()} />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_OVERVIEW);
        });
    });

    it('should sync legacy URL /superadmin/ai-platform to SUPERADMIN_AI_PLATFORM', async () => {
        render(
            <MemoryRouter initialEntries={['/superadmin/ai-platform']}>
                <SuperAdminView currentUser={null} onNavigate={vi.fn()} />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_AI_PLATFORM);
        });
    });

    it('should not cause infinite loops when URL matches currentView', async () => {
        (useAppStore as unknown as Mock).mockReturnValue({
            isSidebarCollapsed: false,
            currentView: AppView.SUPERADMIN_CUSTOMERS,
            setCurrentView: mockSetCurrentView,
        });

        render(
            <MemoryRouter initialEntries={['/superadmin/customers']}>
                <SuperAdminView currentUser={null} onNavigate={vi.fn()} />
            </MemoryRouter>
        );

        // Wait a bit to ensure no infinite loops
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Should only be called once (or not at all if already correct)
        expect(mockSetCurrentView).toHaveBeenCalledTimes(0);
    });
});

