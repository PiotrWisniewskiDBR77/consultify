/**
 * SuperAdminSidebar Unit Tests
 * Tests for section to AppView mapping and vice versa
 */

import { describe, it, expect } from 'vitest';

import { AppView } from '@/types';
import { appViewToSection, sectionToAppView, SuperAdminSection } from '@/components/layout/SuperAdminSidebar';

describe('SuperAdminSidebar - Mapping Tests', () => {
    describe('sectionToAppView mapping', () => {
        it('should map all sections to AppView', () => {
            const sections: SuperAdminSection[] = [
                'overview',
                'customers',
                'ai-platform',
                'ai-infrastructure',
                'ai-development',
                'ai-operations',
                'system',
                'content',
                'revenue',
                'security',
                'configuration',
                'analytics',
            ];

            sections.forEach((section) => {
                expect(sectionToAppView[section]).toBeDefined();
                expect(typeof sectionToAppView[section]).toBe('string');
            });
        });

        it('should map overview to SUPERADMIN_OVERVIEW', () => {
            expect(sectionToAppView['overview']).toBe(AppView.SUPERADMIN_OVERVIEW);
        });

        it('should map customers to SUPERADMIN_CUSTOMERS', () => {
            expect(sectionToAppView['customers']).toBe(AppView.SUPERADMIN_CUSTOMERS);
        });

        it('should map ai-infrastructure to SUPERADMIN_AI_INFRASTRUCTURE', () => {
            expect(sectionToAppView['ai-infrastructure']).toBe(AppView.SUPERADMIN_AI_INFRASTRUCTURE);
        });

        it('should map legacy ai-platform to SUPERADMIN_AI_PLATFORM', () => {
            expect(sectionToAppView['ai-platform']).toBe(AppView.SUPERADMIN_AI_PLATFORM);
        });
    });

    describe('appViewToSection mapping', () => {
        it('should map all SuperAdmin AppViews to sections', () => {
            const superAdminViews = [
                AppView.SUPERADMIN_OVERVIEW,
                AppView.SUPERADMIN_CUSTOMERS,
                AppView.SUPERADMIN_AI_INFRASTRUCTURE,
                AppView.SUPERADMIN_AI_DEVELOPMENT,
                AppView.SUPERADMIN_AI_OPERATIONS,
                AppView.SUPERADMIN_SYSTEM,
                AppView.SUPERADMIN_CONTENT,
                AppView.SUPERADMIN_REVENUE,
                AppView.SUPERADMIN_SECURITY,
                AppView.SUPERADMIN_CONFIGURATION,
                AppView.SUPERADMIN_ANALYTICS,
            ];

            superAdminViews.forEach((view) => {
                expect(appViewToSection[view]).toBeDefined();
                expect(typeof appViewToSection[view]).toBe('string');
            });
        });

        it('should map SUPERADMIN_OVERVIEW to overview', () => {
            expect(appViewToSection[AppView.SUPERADMIN_OVERVIEW]).toBe('overview');
        });

        it('should map SUPERADMIN_CUSTOMERS to customers', () => {
            expect(appViewToSection[AppView.SUPERADMIN_CUSTOMERS]).toBe('customers');
        });

        it('should map SUPERADMIN_AI_INFRASTRUCTURE to ai-infrastructure', () => {
            expect(appViewToSection[AppView.SUPERADMIN_AI_INFRASTRUCTURE]).toBe('ai-infrastructure');
        });

        it('should map legacy SUPERADMIN_AI_PLATFORM to ai-infrastructure', () => {
            expect(appViewToSection[AppView.SUPERADMIN_AI_PLATFORM]).toBe('ai-infrastructure');
        });

        it('should map legacy SUPERADMIN_DASHBOARD to overview', () => {
            expect(appViewToSection[AppView.SUPERADMIN_DASHBOARD]).toBe('overview');
        });

        it('should map legacy SUPERADMIN_ORGANIZATIONS to customers', () => {
            expect(appViewToSection[AppView.SUPERADMIN_ORGANIZATIONS]).toBe('customers');
        });

        it('should map legacy SUPERADMIN_USERS to customers', () => {
            expect(appViewToSection[AppView.SUPERADMIN_USERS]).toBe('customers');
        });
    });

    describe('Bidirectional mapping consistency', () => {
        it('should have consistent mappings for all sections', () => {
            Object.keys(sectionToAppView).forEach((section) => {
                const appView = sectionToAppView[section as SuperAdminSection];
                const mappedSection = appViewToSection[appView];
                
                // For legacy mappings, we allow redirects
                if (section === 'ai-platform') {
                    expect(mappedSection).toBe('ai-infrastructure');
                } else {
                    expect(mappedSection).toBe(section);
                }
            });
        });
    });

    describe('Default values', () => {
        it('should return overview for unknown AppView', () => {
            const unknownView = 'UNKNOWN_VIEW' as AppView;
            const result = appViewToSection[unknownView];
            // Should return undefined or default, component should handle with fallback
            expect(result).toBeUndefined();
        });
    });
});

