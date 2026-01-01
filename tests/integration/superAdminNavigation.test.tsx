/**
 * @vitest-environment jsdom
 * 
 * Integration tests for SuperAdmin navigation flow
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AppView } from '../../types';
import { SuperAdminSidebar, sectionToAppView, appViewToSection } from '../../components/SuperAdminSidebar';
import { useAppStore } from '../../store/useAppStore';

// Mock the store
vi.mock('../../store/useAppStore', () => ({
    useAppStore: vi.fn()
}));

// Mock API for sidebar
vi.mock('../../services/api', () => ({
    Api: {
        getAccessRequests: vi.fn().mockResolvedValue([])
    }
}));

describe('SuperAdmin Navigation Integration Tests', () => {
    const mockSetCurrentView = vi.fn();
    const mockNavigate = vi.fn();
    const mockOnSectionChange = vi.fn();
    const mockOnLogout = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useAppStore as any).mockReturnValue({
            isSidebarCollapsed: false,
            toggleSidebarCollapse: vi.fn(),
            currentView: AppView.SUPERADMIN_OVERVIEW,
            setCurrentView: mockSetCurrentView
        });
    });

    describe('Section to AppView mapping', () => {
        it('maps overview section to SUPERADMIN_OVERVIEW', () => {
            expect(sectionToAppView['overview']).toBe(AppView.SUPERADMIN_OVERVIEW);
        });

        it('maps customers section to SUPERADMIN_CUSTOMERS', () => {
            expect(sectionToAppView['customers']).toBe(AppView.SUPERADMIN_CUSTOMERS);
        });

        it('maps ai-platform section to SUPERADMIN_AI_PLATFORM', () => {
            expect(sectionToAppView['ai-platform']).toBe(AppView.SUPERADMIN_AI_PLATFORM);
        });

        it('maps system section to SUPERADMIN_SYSTEM', () => {
            expect(sectionToAppView['system']).toBe(AppView.SUPERADMIN_SYSTEM);
        });

        it('maps content section to SUPERADMIN_CONTENT', () => {
            expect(sectionToAppView['content']).toBe(AppView.SUPERADMIN_CONTENT);
        });

        it('maps revenue section to SUPERADMIN_REVENUE', () => {
            expect(sectionToAppView['revenue']).toBe(AppView.SUPERADMIN_REVENUE);
        });

        it('maps security section to SUPERADMIN_SECURITY', () => {
            expect(sectionToAppView['security']).toBe(AppView.SUPERADMIN_SECURITY);
        });

        it('maps configuration section to SUPERADMIN_CONFIGURATION', () => {
            expect(sectionToAppView['configuration']).toBe(AppView.SUPERADMIN_CONFIGURATION);
        });
    });

    describe('AppView to Section mapping', () => {
        it('maps SUPERADMIN_OVERVIEW to overview section', () => {
            expect(appViewToSection[AppView.SUPERADMIN_OVERVIEW]).toBe('overview');
        });

        it('maps legacy SUPERADMIN_DASHBOARD to overview section', () => {
            expect(appViewToSection[AppView.SUPERADMIN_DASHBOARD]).toBe('overview');
        });

        it('maps legacy SUPERADMIN_ORGANIZATIONS to customers section', () => {
            expect(appViewToSection[AppView.SUPERADMIN_ORGANIZATIONS]).toBe('customers');
        });

        it('maps legacy SUPERADMIN_USERS to customers section', () => {
            expect(appViewToSection[AppView.SUPERADMIN_USERS]).toBe('customers');
        });

        it('maps legacy SUPERADMIN_LLM_MANAGEMENT to ai-platform section', () => {
            expect(appViewToSection[AppView.SUPERADMIN_LLM_MANAGEMENT]).toBe('ai-platform');
        });

        it('maps legacy SUPERADMIN_BILLING to revenue section', () => {
            expect(appViewToSection[AppView.SUPERADMIN_BILLING]).toBe('revenue');
        });

        it('maps legacy SUPERADMIN_SSO to security section', () => {
            expect(appViewToSection[AppView.SUPERADMIN_SSO]).toBe('security');
        });

        it('maps legacy SUPERADMIN_SETTINGS to configuration section', () => {
            expect(appViewToSection[AppView.SUPERADMIN_SETTINGS]).toBe('configuration');
        });
    });

    describe('Sidebar Navigation', () => {
        it('shows sidebar with 8 main menu items', async () => {
            render(
                <SuperAdminSidebar
                    activeSection="overview"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );
            
            await waitFor(() => {
                expect(screen.getByText('Overview')).toBeInTheDocument();
                expect(screen.getByText('Customers')).toBeInTheDocument();
                expect(screen.getByText('AI Platform')).toBeInTheDocument();
                expect(screen.getByText('System')).toBeInTheDocument();
                expect(screen.getByText('Content')).toBeInTheDocument();
                expect(screen.getByText('Revenue')).toBeInTheDocument();
                expect(screen.getByText('Security')).toBeInTheDocument();
                expect(screen.getByText('Configuration')).toBeInTheDocument();
            });
        });

        it('calls onSectionChange when clicking menu items', async () => {
            render(
                <SuperAdminSidebar
                    activeSection="overview"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );
            
            await waitFor(() => {
                expect(screen.getByText('Customers')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Customers'));
            expect(mockOnSectionChange).toHaveBeenCalledWith('customers');
        });

        it('calls onLogout when clicking Sign Out', async () => {
            render(
                <SuperAdminSidebar
                    activeSection="overview"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );
            
            await waitFor(() => {
                expect(screen.getByText('Sign Out')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Sign Out'));
            expect(mockOnLogout).toHaveBeenCalled();
        });

        it('highlights active section', async () => {
            render(
                <SuperAdminSidebar
                    activeSection="customers"
                    onSectionChange={mockOnSectionChange}
                    onLogout={mockOnLogout}
                    currentUserEmail="admin@test.com"
                />
            );
            
            await waitFor(() => {
                const customersButton = screen.getByText('Customers').closest('button');
                expect(customersButton).toHaveClass('border-l-2');
                expect(customersButton).toHaveClass('border-red-500');
            });
        });
    });

    describe('Module count verification', () => {
        it('has exactly 8 modules defined', () => {
            const modules = Object.keys(sectionToAppView);
            expect(modules).toHaveLength(8);
        });

        it('all module sections have corresponding AppViews', () => {
            const sections = ['overview', 'customers', 'ai-platform', 'system', 'content', 'revenue', 'security', 'configuration'];
            sections.forEach(section => {
                expect(sectionToAppView[section as keyof typeof sectionToAppView]).toBeDefined();
            });
        });
    });
});
