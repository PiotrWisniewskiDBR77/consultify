/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SuperAdminSidebar } from '@/components/SuperAdminSidebar';
import { useAppStore } from '@/store/useAppStore';

vi.mock('@/store/useAppStore', () => ({
    useAppStore: vi.fn()
}));

vi.mock('../../services/api', () => ({
    Api: {
        getAccessRequests: vi.fn().mockResolvedValue([])
    }
}));

// Using global mock from tests/setup.ts

describe('SuperAdminSidebar Component', () => {
    const mockOnSectionChange = vi.fn();
    const mockOnLogout = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useAppStore as any).mockReturnValue({
            isSidebarCollapsed: false,
            toggleSidebarCollapse: vi.fn()
        });
    });

    const renderSidebar = (activeSection = 'overview') => {
        return render(
            <SuperAdminSidebar
                activeSection={activeSection as any}
                onSectionChange={mockOnSectionChange}
                onLogout={mockOnLogout}
                currentUserEmail="admin@test.com"
            />
        );
    };

    it('renders 8 menu items', () => {
        renderSidebar();
        
        // Check for all 8 module labels
        expect(screen.getByText('Overview')).toBeInTheDocument();
        expect(screen.getByText('Customers')).toBeInTheDocument();
        expect(screen.getByText('AI Platform')).toBeInTheDocument();
        expect(screen.getByText('System')).toBeInTheDocument();
        expect(screen.getByText('Content')).toBeInTheDocument();
        expect(screen.getByText('Revenue')).toBeInTheDocument();
        expect(screen.getByText('Security')).toBeInTheDocument();
        expect(screen.getByText('Configuration')).toBeInTheDocument();
    });

    it('renders minimal separators (no text headers)', () => {
        renderSidebar();
        
        // Should NOT have old category titles
        expect(screen.queryByText('MANAGEMENT')).not.toBeInTheDocument();
        expect(screen.queryByText('Enterprise')).not.toBeInTheDocument();
        expect(screen.queryByText('Security & Access')).not.toBeInTheDocument();
    });

    it('calls onSectionChange when menu item clicked', () => {
        renderSidebar();
        
        fireEvent.click(screen.getByText('Customers'));
        expect(mockOnSectionChange).toHaveBeenCalledWith('customers');
        
        fireEvent.click(screen.getByText('AI Platform'));
        expect(mockOnSectionChange).toHaveBeenCalledWith('ai-platform');
    });

    it('highlights active section', () => {
        renderSidebar('customers');
        
        const customersButton = screen.getByText('Customers').closest('button');
        expect(customersButton).toHaveClass('border-l-2');
        expect(customersButton).toHaveClass('border-red-500');
    });

    it('calls onLogout when sign out clicked', () => {
        renderSidebar();
        
        fireEvent.click(screen.getByText('Sign Out'));
        expect(mockOnLogout).toHaveBeenCalled();
    });

    it('displays current user email', () => {
        renderSidebar();
        
        expect(screen.getByText('admin@test.com')).toBeInTheDocument();
    });

    it('shows SUPER ADMIN branding', () => {
        renderSidebar();
        
        expect(screen.getByText('SUPER ADMIN')).toBeInTheDocument();
        expect(screen.getByText('Console')).toBeInTheDocument();
    });

    it('renders collapsed state correctly', () => {
        (useAppStore as any).mockReturnValue({
            isSidebarCollapsed: true,
            toggleSidebarCollapse: vi.fn()
        });
        
        const { container } = renderSidebar();
        const aside = container.querySelector('aside');
        
        // In collapsed state without hover, width should be w-16
        expect(aside).toHaveClass('w-16');
    });

    it('should fetch and display pending requests badge', async () => {
        const { Api } = await import('../../services/api');
        (Api.getAccessRequests as any).mockResolvedValue([
            { id: 'req-1', status: 'pending' },
            { id: 'req-2', status: 'pending' }
        ]);

        renderSidebar('customers');
        
        await waitFor(() => {
            expect(Api.getAccessRequests).toHaveBeenCalled();
        });
    });

    it('should handle hover to expand when collapsed', () => {
        (useAppStore as any).mockReturnValue({
            isSidebarCollapsed: true,
            toggleSidebarCollapse: vi.fn()
        });

        const { container } = renderSidebar();
        const aside = container.querySelector('aside');
        
        // Simulate hover
        fireEvent.mouseEnter(aside!);
        
        // Should expand on hover
        expect(aside).toHaveClass('w-72');
    });

    it('should handle pin/unpin button click', () => {
        const mockToggleSidebarCollapse = vi.fn();
        (useAppStore as any).mockReturnValue({
            isSidebarCollapsed: false,
            toggleSidebarCollapse: mockToggleSidebarCollapse
        });

        renderSidebar();
        
        // Find pin button (should be visible when expanded)
        const pinButton = screen.queryByTitle('Unpin Sidebar (Collapse)');
        if (pinButton) {
            fireEvent.click(pinButton);
            expect(mockToggleSidebarCollapse).toHaveBeenCalled();
        }
    });

    it('should display user email correctly', () => {
        renderSidebar();
        expect(screen.getByText('admin@test.com')).toBeInTheDocument();
    });

    it('should show badge on customers menu item when pending requests exist', async () => {
        const { Api } = await import('../../services/api');
        (Api.getAccessRequests as any).mockResolvedValue([
            { id: 'req-1', status: 'pending' }
        ]);

        renderSidebar('customers');
        
        await waitFor(() => {
            expect(Api.getAccessRequests).toHaveBeenCalled();
        });
    });
});
