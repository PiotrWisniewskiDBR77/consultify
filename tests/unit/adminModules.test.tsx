/**
 * Admin Modules Unit Tests
 * 
 * Tests for the 5-module Admin Panel structure.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';

// Mock the store
vi.mock('../../store/useAppStore', () => ({
    useAppStore: vi.fn(() => ({
        currentView: 'ADMIN_OVERVIEW',
        setCurrentView: vi.fn(),
        isSidebarCollapsed: false,
        toggleSidebarCollapse: vi.fn(),
    })),
}));

// Mock the API
vi.mock('../../services/api', () => ({
    Api: {
        getUsers: vi.fn().mockResolvedValue([]),
        getProjects: vi.fn().mockResolvedValue([]),
        getInvitations: vi.fn().mockResolvedValue([]),
        getFeedback: vi.fn().mockResolvedValue([]),
        getUserPlans: vi.fn().mockResolvedValue([]),
        aiGetSystemPrompts: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue({}),
    },
}));

// Import components
import { AdminSidebar, AdminSection, adminSectionToAppView } from '../../components/AdminSidebar';
import { OverviewModule } from '../../views/admin/OverviewModule';
import { TeamModule } from '../../views/admin/TeamModule';
import { WorkspaceModule } from '../../views/admin/WorkspaceModule';
import { AIModule } from '../../views/admin/AIModule';
import { AdminSettingsModule } from '../../views/admin/AdminSettingsModule';
import { AppView } from '../../types';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <I18nextProvider i18n={i18n}>
        {children}
    </I18nextProvider>
);

describe('AdminSidebar', () => {
    const mockOnSectionChange = vi.fn();
    const mockOnBackToApp = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders all 5 module items', () => {
        render(
            <TestWrapper>
                <AdminSidebar
                    activeSection="overview"
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                    currentUserEmail="admin@example.com"
                />
            </TestWrapper>
        );

        // Check for module labels (may be in different forms due to i18n)
        expect(screen.getByText(/overview/i)).toBeTruthy();
        expect(screen.getByText(/organization/i)).toBeTruthy();
        expect(screen.getByText(/team/i)).toBeTruthy();
        expect(screen.getByText(/workspace/i)).toBeTruthy();
        expect(screen.getByText(/ai/i)).toBeTruthy();
        expect(screen.getByText(/billing/i)).toBeTruthy();
        expect(screen.getByText(/security/i)).toBeTruthy();
        expect(screen.getByText(/feedback/i)).toBeTruthy();
    });

    it('calls onSectionChange when clicking a module', () => {
        render(
            <TestWrapper>
                <AdminSidebar
                    activeSection="overview"
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                    currentUserEmail="admin@example.com"
                />
            </TestWrapper>
        );

        const teamButton = screen.getByText(/team/i);
        fireEvent.click(teamButton);

        expect(mockOnSectionChange).toHaveBeenCalledWith('team');
    });

    it('highlights the active section', () => {
        render(
            <TestWrapper>
                <AdminSidebar
                    activeSection="team"
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                    currentUserEmail="admin@example.com"
                />
            </TestWrapper>
        );

        // The active button should have the active styles (border-l-2, purple color)
        const teamButton = screen.getByText(/team/i).closest('button');
        expect(teamButton?.className).toContain('border-l-2');
    });
});

describe('adminSectionToAppView mapping', () => {
    it('maps all sections to correct AppViews', () => {
        expect(adminSectionToAppView['overview']).toBe(AppView.ADMIN_OVERVIEW);
        expect(adminSectionToAppView['organization']).toBe(AppView.ADMIN_ORGANIZATION);
        expect(adminSectionToAppView['team']).toBe(AppView.ADMIN_TEAM);
        expect(adminSectionToAppView['workspace']).toBe(AppView.ADMIN_WORKSPACE);
        expect(adminSectionToAppView['ai']).toBe(AppView.ADMIN_AI);
        expect(adminSectionToAppView['billing']).toBe(AppView.ADMIN_BILLING);
        expect(adminSectionToAppView['security']).toBe(AppView.ADMIN_SECURITY);
        expect(adminSectionToAppView['feedback']).toBe(AppView.ADMIN_FEEDBACK);
    });
});

describe('OverviewModule', () => {
    it('renders with Dashboard tab by default', async () => {
        render(
            <TestWrapper>
                <OverviewModule users={[]} projects={[]} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getAllByText(/dashboard/i).length).toBeGreaterThan(0);
        });
    });

    it('renders all three tabs', async () => {
        render(
            <TestWrapper>
                <OverviewModule users={[]} projects={[]} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getAllByText(/dashboard/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/metrics/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/analytics/i).length).toBeGreaterThan(0);
        });
    });
});

describe('TeamModule', () => {
    it('renders with Users tab by default', async () => {
        render(
            <TestWrapper>
                <TeamModule />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getAllByText(/users/i).length).toBeGreaterThan(0);
        });
    });

    it('renders all four tabs', async () => {
        render(
            <TestWrapper>
                <TeamModule />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getAllByText(/users/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/invitations/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/work mode/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/consultants/i).length).toBeGreaterThan(0);
        });
    });
});

describe('WorkspaceModule', () => {
    it('renders with Projects tab by default', async () => {
        render(
            <TestWrapper>
                <WorkspaceModule />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getAllByText(/projects/i).length).toBeGreaterThan(0);
        });
    });

    it('renders all four tabs', async () => {
        render(
            <TestWrapper>
                <WorkspaceModule />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getAllByText(/projects/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/knowledge/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/playbook/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/bulk/i).length).toBeGreaterThan(0);
        });
    });
});

describe('AIModule', () => {
    it('renders with LLM Config tab by default', async () => {
        render(
            <TestWrapper>
                <AIModule />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getAllByText(/llm/i).length).toBeGreaterThan(0);
        });
    });

    it('renders all four tabs', async () => {
        render(
            <TestWrapper>
                <AIModule />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getAllByText(/llm/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/health/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/help/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/token/i).length).toBeGreaterThan(0);
        });
    });
});

describe('AdminSettingsModule', () => {
    const mockUser = {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin' as const,
        organizationId: 'org-1',
    };

    it('renders with Organization tab by default', async () => {
        render(
            <TestWrapper>
                <AdminSettingsModule currentUser={mockUser as any} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getAllByText(/organization/i).length).toBeGreaterThan(0);
        });
    });

    it('renders all four tabs', async () => {
        render(
            <TestWrapper>
                <AdminSettingsModule currentUser={mockUser as any} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getAllByText(/organization/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/billing/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/security/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/feedback/i).length).toBeGreaterThan(0);
        });
    });
});










