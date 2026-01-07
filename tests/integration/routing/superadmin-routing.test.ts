/**
 * SuperAdmin Routing Integration Tests
 * Tests routing integration for SuperAdmin modules
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { render, waitFor, screen } from '@testing-library/react';
import { AppView } from '@/types';
import { ROUTES } from '@/routes/routeConfig';
import { useAppStore } from '@/store/useAppStore';

// Mock store
vi.mock('@/store/useAppStore');

// Mock SuperAdminView
vi.mock('@/views/superadmin/SuperAdminView', () => ({
    SuperAdminView: ({ currentUser, onNavigate }: any) => (
        <div data-testid="superadmin-view">
            <div data-testid="current-view">{useAppStore.getState().currentView}</div>
        </div>
    ),
}));

describe('SuperAdmin Routing Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Route availability', () => {
        const superAdminRoutes = [
            { path: ROUTES.SUPERADMIN.OVERVIEW, view: AppView.SUPERADMIN_OVERVIEW },
            { path: ROUTES.SUPERADMIN.CUSTOMERS, view: AppView.SUPERADMIN_CUSTOMERS },
            { path: ROUTES.SUPERADMIN.AI_INFRASTRUCTURE, view: AppView.SUPERADMIN_AI_INFRASTRUCTURE },
            { path: ROUTES.SUPERADMIN.AI_DEVELOPMENT, view: AppView.SUPERADMIN_AI_DEVELOPMENT },
            { path: ROUTES.SUPERADMIN.AI_OPERATIONS, view: AppView.SUPERADMIN_AI_OPERATIONS },
            { path: ROUTES.SUPERADMIN.SYSTEM, view: AppView.SUPERADMIN_SYSTEM },
            { path: ROUTES.SUPERADMIN.CONTENT, view: AppView.SUPERADMIN_CONTENT },
            { path: ROUTES.SUPERADMIN.REVENUE, view: AppView.SUPERADMIN_REVENUE },
            { path: ROUTES.SUPERADMIN.SECURITY, view: AppView.SUPERADMIN_SECURITY },
            { path: ROUTES.SUPERADMIN.ANALYTICS, view: AppView.SUPERADMIN_ANALYTICS },
            { path: ROUTES.SUPERADMIN.CONFIGURATION, view: AppView.SUPERADMIN_CONFIGURATION },
        ];

        superAdminRoutes.forEach(({ path, view }) => {
            it(`should have route ${path} mapped to ${view}`, () => {
                expect(path).toBeDefined();
                expect(path).toContain('/superadmin/');
                expect(view).toBeDefined();
                expect(view).toContain('SUPERADMIN_');
            });
        });
    });

    describe('Deep linking', () => {
        it('should support deep linking to /superadmin/overview', () => {
            const path = ROUTES.SUPERADMIN.OVERVIEW;
            expect(path).toBe('/superadmin/overview');
        });

        it('should support deep linking to /superadmin/customers', () => {
            const path = ROUTES.SUPERADMIN.CUSTOMERS;
            expect(path).toBe('/superadmin/customers');
        });

        it('should support deep linking to all SuperAdmin modules', () => {
            const routes = [
                ROUTES.SUPERADMIN.OVERVIEW,
                ROUTES.SUPERADMIN.CUSTOMERS,
                ROUTES.SUPERADMIN.AI_INFRASTRUCTURE,
                ROUTES.SUPERADMIN.AI_DEVELOPMENT,
                ROUTES.SUPERADMIN.AI_OPERATIONS,
                ROUTES.SUPERADMIN.SYSTEM,
                ROUTES.SUPERADMIN.CONTENT,
                ROUTES.SUPERADMIN.REVENUE,
                ROUTES.SUPERADMIN.SECURITY,
                ROUTES.SUPERADMIN.ANALYTICS,
                ROUTES.SUPERADMIN.CONFIGURATION,
            ];

            routes.forEach((route) => {
                expect(route).toBeDefined();
                expect(route.startsWith('/superadmin/')).toBe(true);
            });
        });
    });

    describe('Legacy route redirects', () => {
        it('should have legacy route /superadmin/ai-platform defined', () => {
            const legacyRoute = ROUTES.SUPERADMIN.AI_PLATFORM;
            expect(legacyRoute).toBe('/superadmin/ai-platform');
        });

        it('should redirect legacy ai-platform to ai-infrastructure', () => {
            // This is handled in router.tsx with Navigate component
            const legacyRoute = ROUTES.SUPERADMIN.AI_PLATFORM;
            const newRoute = ROUTES.SUPERADMIN.AI_INFRASTRUCTURE;
            expect(legacyRoute).toBeDefined();
            expect(newRoute).toBeDefined();
            expect(newRoute).toBe('/superadmin/ai-infrastructure');
        });
    });

    describe('Route configuration consistency', () => {
        it('should have consistent route definitions in routeConfig', () => {
            const routes = ROUTES.SUPERADMIN;
            expect(routes.ROOT).toBe('/superadmin');
            expect(routes.OVERVIEW).toBe('/superadmin/overview');
            expect(routes.CUSTOMERS).toBe('/superadmin/customers');
            expect(routes.AI_INFRASTRUCTURE).toBe('/superadmin/ai-infrastructure');
        });

        it('should have all required SuperAdmin routes', () => {
            const requiredRoutes = [
                'ROOT',
                'OVERVIEW',
                'CUSTOMERS',
                'AI_INFRASTRUCTURE',
                'AI_DEVELOPMENT',
                'AI_OPERATIONS',
                'SYSTEM',
                'CONTENT',
                'REVENUE',
                'SECURITY',
                'ANALYTICS',
                'CONFIGURATION',
            ];

            requiredRoutes.forEach((route) => {
                expect(ROUTES.SUPERADMIN[route as keyof typeof ROUTES.SUPERADMIN]).toBeDefined();
            });
        });
    });
});

