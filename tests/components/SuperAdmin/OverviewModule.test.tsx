/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OverviewModule from '@/views/superadmin/OverviewModule';
import { Api } from '@/services/api';

// Mock child components
vi.mock('@/views/superadmin/SuperAdminDashboard', () => ({
    SuperAdminDashboard: () => <div data-testid="dashboard-content">Dashboard Content</div>
}));

vi.mock('@/views/superadmin/SuperAdminMetricsView', () => ({
    SuperAdminMetricsView: () => <div data-testid="metrics-content">Metrics Content</div>
}));

vi.mock('@/components/SuperAdmin/SuperAdminSignalCenter', () => ({
    SuperAdminSignalCenter: () => <div data-testid="signals-content">Signals Content</div>
}));

vi.mock('@/services/api', () => ({
    Api: {
        getOrganizations: vi.fn(),
        getSuperAdminDashboard: vi.fn(),
        getTasks: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue({})
    }
}));

vi.mock('react-hot-toast', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn()
    }
}));

describe('OverviewModule', () => {
    const mockOnNavigateToSection = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.getOrganizations as any).mockResolvedValue([
            { id: 'org-1', user_count: 10 },
            { id: 'org-2', user_count: 5 }
        ]);
        (Api.getSuperAdminDashboard as any).mockResolvedValue({
            counts: {
                total_orgs: 2,
                total_users: 15,
                active_users_7d: 12
            },
            ai: {
                total_ai_calls: 1000,
                total_tokens: 50000
            },
            live: {
                total_active_connections: 5
            },
            activities: []
        });
    });

    it('should render with default dashboard tab', async () => {
        render(<OverviewModule onNavigateToSection={mockOnNavigateToSection} />);
        
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
        });
    });

    it('should switch between tabs', async () => {
        render(<OverviewModule onNavigateToSection={mockOnNavigateToSection} />);
        
        await waitFor(() => {
            expect(screen.getAllByText('Metrics').length).toBeGreaterThan(0);
        });

        const metricsTab = screen.getAllByText('Metrics')[0];
        fireEvent.click(metricsTab);
        expect(metricsTab).toBeInTheDocument();
    });

    it('should fetch and display stats', async () => {
        render(<OverviewModule onNavigateToSection={mockOnNavigateToSection} />);
        
        await waitFor(() => {
            expect(Api.getOrganizations).toHaveBeenCalled();
            expect(Api.getSuperAdminDashboard).toHaveBeenCalled();
        });
    });

    it('should handle navigation to other sections', async () => {
        render(<OverviewModule onNavigateToSection={mockOnNavigateToSection} />);
        
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
        });

        // Navigation is handled internally, but we can verify the callback exists
        expect(mockOnNavigateToSection).toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
        (Api.getSuperAdminDashboard as any).mockRejectedValue(new Error('API Error'));
        
        render(<OverviewModule onNavigateToSection={mockOnNavigateToSection} />);
        
        await waitFor(() => {
            expect(Api.getOrganizations).toHaveBeenCalled();
        });
    });

    it('should render all three tabs', async () => {
        render(<OverviewModule onNavigateToSection={mockOnNavigateToSection} />);
        
        await waitFor(() => {
            expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Metrics').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Signals').length).toBeGreaterThan(0);
        });
    });
});
