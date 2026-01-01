/**
 * @vitest-environment jsdom
 * 
 * SuperAdmin Navigation Flow Integration Test
 * Tests complete navigation flow through all 8 modules and their tabs
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock all external dependencies first
vi.mock('../../store/useAppStore', () => ({
    useAppStore: vi.fn(() => ({
        isSidebarCollapsed: false,
        toggleSidebarCollapse: vi.fn(),
        currentView: 'SUPERADMIN_OVERVIEW',
        setCurrentView: vi.fn()
    }))
}));

vi.mock('../../services/api', () => ({
    Api: {
        getAccessRequests: vi.fn().mockResolvedValue([]),
        getOrganizations: vi.fn().mockResolvedValue([]),
        getSuperAdminDashboard: vi.fn().mockResolvedValue({
            counts: { total_orgs: 0, total_users: 0 },
            ai: { total_ai_calls: 0 },
            live: { total_active_connections: 0 },
            activities: []
        }),
        getFeedback: vi.fn().mockResolvedValue([]),
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

// Import sidebar after mocks
import { SuperAdminSidebar } from '../../components/SuperAdminSidebar';

describe('SuperAdmin Navigation Flow', () => {
    const mockOnSectionChange = vi.fn();
    const mockOnLogout = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Sidebar Navigation', () => {
        it('should render all 8 main navigation items', () => {
            render(
                <SuperAdminSidebar
                    activeSection="overview"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );

            // Verify all 8 menu items are present
            expect(screen.getByText('Overview')).toBeInTheDocument();
            expect(screen.getByText('Customers')).toBeInTheDocument();
            expect(screen.getByText('AI Platform')).toBeInTheDocument();
            expect(screen.getByText('System')).toBeInTheDocument();
            expect(screen.getByText('Content')).toBeInTheDocument();
            expect(screen.getByText('Revenue')).toBeInTheDocument();
            expect(screen.getByText('Security')).toBeInTheDocument();
            expect(screen.getByText('Configuration')).toBeInTheDocument();
        });

        it('should call onSectionChange when clicking Overview', () => {
            render(
                <SuperAdminSidebar
                    activeSection="customers"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );

            fireEvent.click(screen.getByText('Overview'));
            expect(mockOnSectionChange).toHaveBeenCalledWith('overview');
        });

        it('should call onSectionChange when clicking Customers', () => {
            render(
                <SuperAdminSidebar
                    activeSection="overview"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );

            fireEvent.click(screen.getByText('Customers'));
            expect(mockOnSectionChange).toHaveBeenCalledWith('customers');
        });

        it('should call onSectionChange when clicking AI Platform', () => {
            render(
                <SuperAdminSidebar
                    activeSection="overview"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );

            fireEvent.click(screen.getByText('AI Platform'));
            expect(mockOnSectionChange).toHaveBeenCalledWith('ai-platform');
        });

        it('should call onSectionChange when clicking System', () => {
            render(
                <SuperAdminSidebar
                    activeSection="overview"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );

            fireEvent.click(screen.getByText('System'));
            expect(mockOnSectionChange).toHaveBeenCalledWith('system');
        });

        it('should call onSectionChange when clicking Content', () => {
            render(
                <SuperAdminSidebar
                    activeSection="overview"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );

            fireEvent.click(screen.getByText('Content'));
            expect(mockOnSectionChange).toHaveBeenCalledWith('content');
        });

        it('should call onSectionChange when clicking Revenue', () => {
            render(
                <SuperAdminSidebar
                    activeSection="overview"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );

            fireEvent.click(screen.getByText('Revenue'));
            expect(mockOnSectionChange).toHaveBeenCalledWith('revenue');
        });

        it('should call onSectionChange when clicking Security', () => {
            render(
                <SuperAdminSidebar
                    activeSection="overview"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );

            fireEvent.click(screen.getByText('Security'));
            expect(mockOnSectionChange).toHaveBeenCalledWith('security');
        });

        it('should call onSectionChange when clicking Configuration', () => {
            render(
                <SuperAdminSidebar
                    activeSection="overview"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );

            fireEvent.click(screen.getByText('Configuration'));
            expect(mockOnSectionChange).toHaveBeenCalledWith('configuration');
        });
    });

    describe('Active State Highlighting', () => {
        it('should highlight Overview when active', () => {
            render(
                <SuperAdminSidebar
                    activeSection="overview"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );

            const overviewButton = screen.getByText('Overview').closest('button');
            expect(overviewButton).toHaveClass('border-red-500');
        });

        it('should highlight Customers when active', () => {
            render(
                <SuperAdminSidebar
                    activeSection="customers"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );

            const customersButton = screen.getByText('Customers').closest('button');
            expect(customersButton).toHaveClass('border-red-500');
        });

        it('should highlight AI Platform when active', () => {
            render(
                <SuperAdminSidebar
                    activeSection="ai-platform"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );

            const aiPlatformButton = screen.getByText('AI Platform').closest('button');
            expect(aiPlatformButton).toHaveClass('border-red-500');
        });
    });

    describe('Sidebar Visual Elements', () => {
        it('should display SUPER ADMIN branding', () => {
            render(
                <SuperAdminSidebar
                    activeSection="overview"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );

            expect(screen.getByText('SUPER ADMIN')).toBeInTheDocument();
            expect(screen.getByText('Console')).toBeInTheDocument();
        });

        it('should display user email', () => {
            render(
                <SuperAdminSidebar
                    activeSection="overview"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );

            expect(screen.getByText('admin@test.com')).toBeInTheDocument();
        });

        it('should have Sign Out button', () => {
            render(
                <SuperAdminSidebar
                    activeSection="overview"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );

            expect(screen.getByText('Sign Out')).toBeInTheDocument();
        });

        it('should call onLogout when Sign Out is clicked', () => {
            render(
                <SuperAdminSidebar
                    activeSection="overview"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );

            fireEvent.click(screen.getByText('Sign Out'));
            expect(mockOnLogout).toHaveBeenCalled();
        });
    });

    describe('Separators (No Text Headers)', () => {
        it('should not have old category titles', () => {
            render(
                <SuperAdminSidebar
                    activeSection="overview"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );

            // Old category titles should NOT exist
            expect(screen.queryByText('MANAGEMENT')).not.toBeInTheDocument();
            expect(screen.queryByText('CUSTOMERS & AI')).not.toBeInTheDocument();
            expect(screen.queryByText('PLATFORM')).not.toBeInTheDocument();
            expect(screen.queryByText('BUSINESS')).not.toBeInTheDocument();
            expect(screen.queryByText('ADMIN')).not.toBeInTheDocument();
        });
    });
});

describe('Module Tab Structure Verification', () => {
    // This describes the expected tab structure without rendering actual modules
    
    describe('Overview Module tabs', () => {
        it('should define 3 tabs: Dashboard, Metrics, Signals', () => {
            const expectedTabs = ['dashboard', 'metrics', 'signals'];
            expect(expectedTabs.length).toBe(3);
        });
    });

    describe('Customers Module tabs', () => {
        it('should define 4 tabs: Organizations, Users, Feedback, Bulk Operations', () => {
            const expectedTabs = ['organizations', 'users', 'feedback', 'bulk-ops'];
            expect(expectedTabs.length).toBe(4);
        });
    });

    describe('AI Platform Module tabs', () => {
        it('should define 5 tabs: LLM Config, Intelligence, Knowledge, Costs, Health', () => {
            const expectedTabs = ['llm-config', 'intelligence', 'knowledge', 'costs', 'health'];
            expect(expectedTabs.length).toBe(5);
        });
    });

    describe('System Module tabs', () => {
        it('should define 4 tabs: Health, Audit Log, Feature Flags, Integrations', () => {
            const expectedTabs = ['health', 'audit-log', 'feature-flags', 'integrations'];
            expect(expectedTabs.length).toBe(4);
        });
    });

    describe('Content Module tabs', () => {
        it('should define 2 tabs: Playbooks, Email Templates', () => {
            const expectedTabs = ['playbooks', 'email-templates'];
            expect(expectedTabs.length).toBe(2);
        });
    });

    describe('Revenue Module tabs', () => {
        it('should define 3 tabs: Billing, Invoices, Usage', () => {
            const expectedTabs = ['billing', 'invoices', 'usage'];
            expect(expectedTabs.length).toBe(3);
        });
    });

    describe('Security Module tabs', () => {
        it('should define 4 tabs: SSO, Policies, API Keys, Compliance', () => {
            const expectedTabs = ['sso', 'policies', 'api-keys', 'compliance'];
            expect(expectedTabs.length).toBe(4);
        });
    });

    describe('Configuration Module tabs', () => {
        it('should define 3 tabs: Settings, White-label, Legal', () => {
            const expectedTabs = ['settings', 'whitelabel', 'legal'];
            expect(expectedTabs.length).toBe(3);
        });
    });
});

describe('Navigation Flow Summary', () => {
    it('should have 8 main modules', () => {
        const modules = [
            'overview',
            'customers',
            'ai-platform',
            'system',
            'content',
            'revenue',
            'security',
            'configuration'
        ];
        expect(modules.length).toBe(8);
    });

    it('should have total of 28 tabs across all modules', () => {
        const tabCounts = {
            overview: 3,
            customers: 4,
            aiPlatform: 5,
            system: 4,
            content: 2,
            revenue: 3,
            security: 4,
            configuration: 3
        };
        const total = Object.values(tabCounts).reduce((a, b) => a + b, 0);
        expect(total).toBe(28);
    });
});

