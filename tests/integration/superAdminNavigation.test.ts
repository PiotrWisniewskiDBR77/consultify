/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SuperAdminView } from '../../views/superadmin/SuperAdminView';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

// Mock the store
vi.mock('../../store/useAppStore', () => ({
    useAppStore: vi.fn()
}));

// Mock API
vi.mock('../../services/api', () => ({
    Api: {
        getOrganizations: vi.fn().mockResolvedValue([
            { id: '1', name: 'Test Org', plan: 'pro', status: 'active', user_count: 5 }
        ]),
        getSuperAdminDashboard: vi.fn().mockResolvedValue({
            counts: { total_orgs: 1, total_users: 5, active_users_7d: 3 },
            ai: { total_ai_calls: 100, total_tokens: 5000 },
            live: { total_active_connections: 2 },
            activities: []
        }),
        getSuperAdminUsers: vi.fn().mockResolvedValue([]),
        getAccessRequests: vi.fn().mockResolvedValue([]),
        getUserFeedback: vi.fn().mockResolvedValue([]),
        getMetricsFunnels: vi.fn().mockResolvedValue({ funnels: {} }),
        getMetricsWarnings: vi.fn().mockResolvedValue({ warnings: [] }),
        getMetricsAttribution: vi.fn().mockResolvedValue({}),
        getMetricsPartners: vi.fn().mockResolvedValue({ leaderboard: [] }),
        getMetricsHelp: vi.fn().mockResolvedValue({}),
        getLLMProviders: vi.fn().mockResolvedValue([]),
        checkSystemHealth: vi.fn().mockResolvedValue({ status: 'ok', latency: 45 }),
        getActivities: vi.fn().mockResolvedValue([])
    }
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

// Mock i18n
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

describe('SuperAdmin Navigation Integration Tests', () => {
    const mockSetCurrentView = vi.fn();
    const mockNavigate = vi.fn();
    const currentUser = {
        id: 'admin-1',
        email: 'admin@test.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'SUPERADMIN',
        status: 'active'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useAppStore as any).mockReturnValue({
            isSidebarCollapsed: false,
            toggleSidebarCollapse: vi.fn(),
            currentView: AppView.SUPERADMIN_OVERVIEW,
            setCurrentView: mockSetCurrentView
        });
    });

    it('navigates from sidebar to Overview module', async () => {
        render(<SuperAdminView currentUser={currentUser as any} onNavigate={mockNavigate} />);
        
        await waitFor(() => {
            expect(screen.getByText('Overview')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Overview'));
        expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_OVERVIEW);
    });

    it('navigates from sidebar to Customers module', async () => {
        render(<SuperAdminView currentUser={currentUser as any} onNavigate={mockNavigate} />);
        
        await waitFor(() => {
            expect(screen.getByText('Customers')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Customers'));
        expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_CUSTOMERS);
    });

    it('navigates from sidebar to AI Platform module', async () => {
        render(<SuperAdminView currentUser={currentUser as any} onNavigate={mockNavigate} />);
        
        await waitFor(() => {
            expect(screen.getByText('AI Platform')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('AI Platform'));
        expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_AI_PLATFORM);
    });

    it('navigates from sidebar to System module', async () => {
        render(<SuperAdminView currentUser={currentUser as any} onNavigate={mockNavigate} />);
        
        await waitFor(() => {
            // Find System in sidebar (not in content area)
            const systemButtons = screen.getAllByText('System');
            const sidebarSystem = systemButtons.find(btn => 
                btn.closest('aside') !== null
            );
            expect(sidebarSystem).toBeInTheDocument();
        });
    });

    it('navigates from sidebar to Revenue module', async () => {
        render(<SuperAdminView currentUser={currentUser as any} onNavigate={mockNavigate} />);
        
        await waitFor(() => {
            expect(screen.getByText('Revenue')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Revenue'));
        expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_REVENUE);
    });

    it('navigates from sidebar to Security module', async () => {
        render(<SuperAdminView currentUser={currentUser as any} onNavigate={mockNavigate} />);
        
        await waitFor(() => {
            expect(screen.getByText('Security')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Security'));
        expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_SECURITY);
    });

    it('navigates from sidebar to Configuration module', async () => {
        render(<SuperAdminView currentUser={currentUser as any} onNavigate={mockNavigate} />);
        
        await waitFor(() => {
            expect(screen.getByText('Configuration')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Configuration'));
        expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_CONFIGURATION);
    });

    it('displays correct module content based on currentView', async () => {
        (useAppStore as any).mockReturnValue({
            isSidebarCollapsed: false,
            toggleSidebarCollapse: vi.fn(),
            currentView: AppView.SUPERADMIN_CUSTOMERS,
            setCurrentView: mockSetCurrentView
        });

        render(<SuperAdminView currentUser={currentUser as any} onNavigate={mockNavigate} />);
        
        await waitFor(() => {
            // Should show Customers module title
            expect(screen.getByText('Manage organizations, users, and customer feedback')).toBeInTheDocument();
        });
    });

    it('handles legacy view redirects to new modules', async () => {
        // Test that SUPERADMIN_ORGANIZATIONS redirects to Customers module
        (useAppStore as any).mockReturnValue({
            isSidebarCollapsed: false,
            toggleSidebarCollapse: vi.fn(),
            currentView: AppView.SUPERADMIN_ORGANIZATIONS,
            setCurrentView: mockSetCurrentView
        });

        render(<SuperAdminView currentUser={currentUser as any} onNavigate={mockNavigate} />);
        
        await waitFor(() => {
            // Should show Customers module content
            expect(screen.getByText('Organizations')).toBeInTheDocument();
        });
    });

    it('logout navigates to welcome screen', async () => {
        render(<SuperAdminView currentUser={currentUser as any} onNavigate={mockNavigate} />);
        
        await waitFor(() => {
            expect(screen.getByText('Sign Out')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Sign Out'));
        expect(mockNavigate).toHaveBeenCalledWith(AppView.WELCOME);
    });

    it('shows sidebar with 8 main menu items', async () => {
        render(<SuperAdminView currentUser={currentUser as any} onNavigate={mockNavigate} />);
        
        await waitFor(() => {
            const sidebar = screen.getByRole('complementary');
            expect(sidebar).toBeInTheDocument();
            
            // Check all 8 modules are present
            expect(screen.getByText('Overview')).toBeInTheDocument();
            expect(screen.getByText('Customers')).toBeInTheDocument();
            expect(screen.getByText('AI Platform')).toBeInTheDocument();
            expect(screen.getByText('Content')).toBeInTheDocument();
            expect(screen.getByText('Revenue')).toBeInTheDocument();
            expect(screen.getByText('Security')).toBeInTheDocument();
            expect(screen.getByText('Configuration')).toBeInTheDocument();
        });
    });

    it('initializes to Overview if not a superadmin view', async () => {
        (useAppStore as any).mockReturnValue({
            isSidebarCollapsed: false,
            toggleSidebarCollapse: vi.fn(),
            currentView: 'SOME_OTHER_VIEW',
            setCurrentView: mockSetCurrentView
        });

        render(<SuperAdminView currentUser={currentUser as any} onNavigate={mockNavigate} />);
        
        await waitFor(() => {
            expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.SUPERADMIN_OVERVIEW);
        });
    });
});









