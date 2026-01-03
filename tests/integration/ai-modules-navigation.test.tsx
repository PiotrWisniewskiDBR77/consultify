/**
 * @vitest-environment jsdom
 * 
 * AI Modules Navigation Integration Tests (Variant A - 3 Modules)
 * 
 * Tests for navigation between AI modules in SuperAdmin panel
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppView } from '../../types';
import { SuperAdminSection, sectionToAppView, appViewToSection } from '../../components/SuperAdminSidebar';

// Test section to AppView mapping
describe('AI Modules Section Mapping', () => {
    describe('sectionToAppView', () => {
        it('maps ai-infrastructure section to SUPERADMIN_AI_INFRASTRUCTURE', () => {
            expect(sectionToAppView['ai-infrastructure']).toBe(AppView.SUPERADMIN_AI_INFRASTRUCTURE);
        });

        it('maps ai-development section to SUPERADMIN_AI_DEVELOPMENT', () => {
            expect(sectionToAppView['ai-development']).toBe(AppView.SUPERADMIN_AI_DEVELOPMENT);
        });

        it('maps ai-operations section to SUPERADMIN_AI_OPERATIONS', () => {
            expect(sectionToAppView['ai-operations']).toBe(AppView.SUPERADMIN_AI_OPERATIONS);
        });

        it('keeps legacy ai-platform mapping for backward compatibility', () => {
            expect(sectionToAppView['ai-platform']).toBe(AppView.SUPERADMIN_AI_PLATFORM);
        });
    });

    describe('appViewToSection', () => {
        it('maps SUPERADMIN_AI_INFRASTRUCTURE to ai-infrastructure section', () => {
            expect(appViewToSection[AppView.SUPERADMIN_AI_INFRASTRUCTURE]).toBe('ai-infrastructure');
        });

        it('maps SUPERADMIN_AI_DEVELOPMENT to ai-development section', () => {
            expect(appViewToSection[AppView.SUPERADMIN_AI_DEVELOPMENT]).toBe('ai-development');
        });

        it('maps SUPERADMIN_AI_OPERATIONS to ai-operations section', () => {
            expect(appViewToSection[AppView.SUPERADMIN_AI_OPERATIONS]).toBe('ai-operations');
        });

        it('redirects legacy SUPERADMIN_AI_PLATFORM to ai-infrastructure', () => {
            expect(appViewToSection[AppView.SUPERADMIN_AI_PLATFORM]).toBe('ai-infrastructure');
        });

        it('redirects legacy SUPERADMIN_LLM_MANAGEMENT to ai-infrastructure', () => {
            expect(appViewToSection[AppView.SUPERADMIN_LLM_MANAGEMENT]).toBe('ai-infrastructure');
        });

        it('redirects legacy SUPERADMIN_AI_INTELLIGENCE to ai-development', () => {
            expect(appViewToSection[AppView.SUPERADMIN_AI_INTELLIGENCE]).toBe('ai-development');
        });

        it('redirects legacy SUPERADMIN_KNOWLEDGE to ai-development', () => {
            expect(appViewToSection[AppView.SUPERADMIN_KNOWLEDGE]).toBe('ai-development');
        });
    });
});

describe('AI Modules Type Definitions', () => {
    it('SuperAdminSection should include all AI module sections', () => {
        const aiSections: SuperAdminSection[] = [
            'ai-platform',
            'ai-infrastructure',
            'ai-development',
            'ai-operations'
        ];
        
        aiSections.forEach(section => {
            expect(sectionToAppView[section]).toBeDefined();
        });
    });

    it('AppView should include all AI module views', () => {
        expect(AppView.SUPERADMIN_AI_INFRASTRUCTURE).toBeDefined();
        expect(AppView.SUPERADMIN_AI_DEVELOPMENT).toBeDefined();
        expect(AppView.SUPERADMIN_AI_OPERATIONS).toBeDefined();
    });
});

describe('AI Modules Legacy Compatibility', () => {
    it('should maintain backward compatibility for existing URLs/bookmarks', () => {
        // Legacy views should map to appropriate new modules
        const legacyMappings = [
            { legacy: AppView.SUPERADMIN_AI_PLATFORM, expectedSection: 'ai-infrastructure' },
            { legacy: AppView.SUPERADMIN_LLM_MANAGEMENT, expectedSection: 'ai-infrastructure' },
            { legacy: AppView.SUPERADMIN_AI_INTELLIGENCE, expectedSection: 'ai-development' },
            { legacy: AppView.SUPERADMIN_KNOWLEDGE, expectedSection: 'ai-development' }
        ];
        
        legacyMappings.forEach(({ legacy, expectedSection }) => {
            expect(appViewToSection[legacy]).toBe(expectedSection);
        });
    });
});

describe('AI Modules Separation of Concerns', () => {
    it('Infrastructure module should focus on infrastructure concerns', () => {
        const infrastructureView = AppView.SUPERADMIN_AI_INFRASTRUCTURE;
        
        // Should map to infrastructure section
        expect(appViewToSection[infrastructureView]).toBe('ai-infrastructure');
        
        // Related legacy views should also map here
        expect(appViewToSection[AppView.SUPERADMIN_LLM_MANAGEMENT]).toBe('ai-infrastructure');
    });

    it('Development module should focus on development concerns', () => {
        const developmentView = AppView.SUPERADMIN_AI_DEVELOPMENT;
        
        // Should map to development section
        expect(appViewToSection[developmentView]).toBe('ai-development');
        
        // Related legacy views should also map here
        expect(appViewToSection[AppView.SUPERADMIN_AI_INTELLIGENCE]).toBe('ai-development');
        expect(appViewToSection[AppView.SUPERADMIN_KNOWLEDGE]).toBe('ai-development');
    });

    it('Operations module should focus on operations concerns', () => {
        const operationsView = AppView.SUPERADMIN_AI_OPERATIONS;
        
        // Should map to operations section
        expect(appViewToSection[operationsView]).toBe('ai-operations');
    });
});




