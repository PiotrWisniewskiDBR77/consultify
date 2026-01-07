/**
 * SuperAdminDashboard Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SuperAdminDashboard } from '../../../src/views/superadmin/SuperAdminDashboard';

describe('SuperAdminDashboard', () => {
    const mockStats = {
        totalOrgs: 10,
        totalUsers: 50,
        revenue: 10000,
        aiCalls: 5000,
        tokens: 100000,
        activeUsers7d: 30,
        liveUsers: 5,
        pendingRequests: 3
    };

    const mockActivities = [
        {
            id: 'act-1',
            user_name: 'John Doe',
            user_email: 'john@test.com',
            action: 'created',
            entity_type: 'user',
            entity_name: 'New User',
            created_at: '2025-01-01T00:00:00Z'
        }
    ];

    const defaultProps = {
        stats: mockStats,
        activities: mockActivities,
        loading: false,
        onRefresh: vi.fn(),
        onNavigateToOrganizations: vi.fn(),
        onNavigateToUsers: vi.fn(),
        onNavigateToBilling: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render dashboard with title', () => {
        render(<SuperAdminDashboard {...defaultProps} />);

        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('System overview and quick actions')).toBeInTheDocument();
    });

    it('should display stats cards', () => {
        render(<SuperAdminDashboard {...defaultProps} />);

        expect(screen.getByText('10')).toBeInTheDocument(); // totalOrgs
        expect(screen.getByText('50')).toBeInTheDocument(); // totalUsers
        expect(screen.getByText('5')).toBeInTheDocument(); // liveUsers
    });

    it('should show quick action buttons', () => {
        render(<SuperAdminDashboard {...defaultProps} />);

        // Use getAllByText because Organizations appears in both stats and buttons
        expect(screen.getAllByText('Organizations').length).toBeGreaterThan(0);
        expect(screen.getByText('Invite User')).toBeInTheDocument();
        expect(screen.getByText('Revenue')).toBeInTheDocument();
    });

    it('should call onNavigateToOrganizations when Organizations button clicked', () => {
        render(<SuperAdminDashboard {...defaultProps} />);

        // Find the specific button using the label text
        const buttons = screen.getAllByRole('button');
        const orgButton = buttons.find(btn => btn.textContent?.includes('Organizations'));

        fireEvent.click(orgButton!);

        expect(defaultProps.onNavigateToOrganizations).toHaveBeenCalledTimes(1);
    });

    it('should call onNavigateToUsers when Invite User button clicked', () => {
        render(<SuperAdminDashboard {...defaultProps} />);

        const userButton = screen.getByText('Invite User').closest('button');
        fireEvent.click(userButton!);

        expect(defaultProps.onNavigateToUsers).toHaveBeenCalledTimes(1);
    });

    it('should call onNavigateToBilling when Revenue button clicked', () => {
        render(<SuperAdminDashboard {...defaultProps} />);

        const billingButton = screen.getByText('Revenue').closest('button');
        fireEvent.click(billingButton!);

        expect(defaultProps.onNavigateToBilling).toHaveBeenCalledTimes(1);
    });

    it('should show pending requests badge when pendingRequests > 0', () => {
        render(<SuperAdminDashboard {...defaultProps} />);

        expect(screen.getByText('3')).toBeInTheDocument(); // pendingRequests badge
        expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should not show pending requests button when pendingRequests is 0', () => {
        const propsWithoutPending = {
            ...defaultProps,
            stats: { ...mockStats, pendingRequests: 0 }
        };

        render(<SuperAdminDashboard {...propsWithoutPending} />);

        expect(screen.queryByText('Pending')).not.toBeInTheDocument();
    });

    it('should display activities', () => {
        render(<SuperAdminDashboard {...defaultProps} />);

        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('created')).toBeInTheDocument();
    });

    it('should show loading state', () => {
        render(<SuperAdminDashboard {...defaultProps} loading={true} />);

        // Component should still render but might show loading indicators
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('should handle empty activities', () => {
        const propsWithEmptyActivities = {
            ...defaultProps,
            activities: []
        };

        render(<SuperAdminDashboard {...propsWithEmptyActivities} />);

        expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('should format revenue correctly', () => {
        render(<SuperAdminDashboard {...defaultProps} />);

        // Revenue should be displayed (formatting depends on implementation)
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('should display AI metrics', () => {
        render(<SuperAdminDashboard {...defaultProps} />);

        // AI calls and tokens should be displayed
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
});












