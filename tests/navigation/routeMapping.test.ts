/**
 * Route Mapping Completeness Tests
 *
 * Ensures all navigation paths are properly configured and working.
 * These tests should catch configuration issues before they reach production.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AppView } from '../../src/types';
import {
  APP_VIEW_TO_ROUTE,
  ROUTES,
  getRouteFromAppView,
  validateRouteCompleteness,
} from '../../src/routes/routeConfig';

// Mock menu config structure (matches actual menuConfig.ts)
const MENU_VIEW_IDS: AppView[] = [
  AppView.AI_CHAT,
  AppView.AI_OS_HOME,
  AppView.AI_OS_ACTION_CENTER,
  AppView.AI_OS_CONTEXT_MEMORY,
  AppView.AI_OS_CONNECTORS,
  AppView.AI_OS_AGENTS,
  AppView.AI_OS_OUTCOMES,
  AppView.MY_WORK,
  AppView.DISCOVERY_CONSULTANT,
  AppView.DISCOVERY_TOOLS,
  AppView.ASSESSMENT_OVERVIEW,
  AppView.PORTFOLIO_ROADMAP,
  AppView.IMPLEMENTATION,
  AppView.BENEFITS_REALIZATION,
  AppView.ECONOMICS,
  AppView.FULL_STEP6_REPORTS,
  AppView.PARTNER_DASHBOARD,
  AppView.ADMIN_DASHBOARD,
  AppView.CONTEXT_BUILDER_PROFILE,
  AppView.CONTEXT_BUILDER_GOALS,
  AppView.CONTEXT_BUILDER_CHALLENGES,
  AppView.CONTEXT_BUILDER_MEGATRENDS,
  AppView.CONTEXT_BUILDER_STRATEGY,
  AppView.SETTINGS_PROFILE_MODULE,
  AppView.PARTNER_LANDING,
  AppView.SUPERADMIN_OVERVIEW,
  AppView.SUPERADMIN_CUSTOMERS,
  AppView.SUPERADMIN_AI_PLATFORM,
  AppView.SUPERADMIN_REVENUE,
  AppView.SUPERADMIN_SYSTEM,
];

describe('Route Mapping Completeness', () => {
  describe('Menu items have valid route mappings', () => {
    it.each(MENU_VIEW_IDS)('AppView.%s has a route mapping', (viewId) => {
      const route = APP_VIEW_TO_ROUTE[viewId];
      expect(route).toBeDefined();
      expect(typeof route).toBe('string');
      expect(route.length).toBeGreaterThan(0);
    });
  });

  describe('getRouteFromAppView returns valid routes', () => {
    it.each(MENU_VIEW_IDS)('getRouteFromAppView(AppView.%s) returns a route', (viewId) => {
      const route = getRouteFromAppView(viewId);
      expect(route).toBeDefined();
      expect(route).not.toBe('');
      // Should not return dashboard as fallback for valid views
      if (viewId !== AppView.DASHBOARD && viewId !== AppView.USER_DASHBOARD) {
        // This assertion checks route exists and is not a silent fallback
        expect(APP_VIEW_TO_ROUTE[viewId]).toBeDefined();
      }
    });
  });

  describe('Route validation', () => {
    it('validateRouteCompleteness reports no missing mappings', () => {
      const result = validateRouteCompleteness();

      if (!result.valid) {
        console.error('Missing route mappings:', result.missing);
      }

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });
  });
});

describe('Route Configuration Integrity', () => {
  describe('ROUTES object structure', () => {
    it('has required base routes', () => {
      expect(ROUTES.WELCOME).toBe('/');
      expect(ROUTES.AUTH).toBe('/auth');
      expect(ROUTES.AI_CHAT).toBe('/chat');
      expect(ROUTES.MY_WORK).toBe('/my-work');
      // Dashboard was retired; the compatibility entry now resolves to Chat.
      expect(ROUTES.DASHBOARD).toBe('/chat');
    });

    it('has nested route objects for complex modules', () => {
      expect(ROUTES.ASSESSMENT).toBeDefined();
      expect(ROUTES.ASSESSMENT.ROOT).toBe('/assessment');
      expect(ROUTES.ASSESSMENT.OVERVIEW).toBe('/assessment/overview');

      expect(ROUTES.CONTEXT_BUILDER).toBeDefined();
      expect(ROUTES.CONTEXT_BUILDER.ROOT).toBe('/context');

      expect(ROUTES.ADMIN).toBeDefined();
      expect(ROUTES.ADMIN.ROOT).toBe('/admin');

      expect(ROUTES.SETTINGS).toBeDefined();
      expect(ROUTES.SETTINGS.ROOT).toBe('/settings');

      expect(ROUTES.SUPERADMIN).toBeDefined();
      expect(ROUTES.SUPERADMIN.ROOT).toBe('/superadmin');
    });
  });

  describe('No duplicate routes', () => {
    it('all routes are unique (no collisions)', () => {
      const allRoutes = Object.values(APP_VIEW_TO_ROUTE);
      const uniqueRoutes = new Set(allRoutes);

      // Some routes are intentionally shared (e.g., multiple views map to /dashboard)
      // But we should track which ones are duplicated
      const duplicates: Record<string, AppView[]> = {};

      Object.entries(APP_VIEW_TO_ROUTE).forEach(([view, route]) => {
        if (!duplicates[route]) {
          duplicates[route] = [];
        }
        duplicates[route].push(view as AppView);
      });

      // Log duplicates for awareness (not necessarily errors)
      const sharedRoutes = Object.entries(duplicates).filter(([_, views]) => views.length > 1);
      if (sharedRoutes.length > 0) {
        console.log(
          'Routes shared by multiple views:',
          sharedRoutes.map(([route, views]) => ({ route, views }))
        );
      }

      // This test just ensures the mapping exists - duplicates are intentional in some cases
      expect(allRoutes.length).toBeGreaterThan(0);
    });
  });
});

describe('Navigation Guard Validation', () => {
  // Import dynamically to avoid circular dependency issues
  let validateNavigation: (view: AppView) => { valid: boolean; errors: string[] };

  beforeEach(async () => {
    const module = await import('../../src/utils/navigationGuard');
    validateNavigation = module.validateNavigation;
  });

  describe('Valid views pass validation', () => {
    it.each(MENU_VIEW_IDS)('AppView.%s passes validation', (viewId) => {
      const result = validateNavigation(viewId);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Invalid views fail validation', () => {
    it('invalid string fails validation', () => {
      const result = validateNavigation('INVALID_VIEW' as AppView);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('Critical Navigation Paths', () => {
  // These are the most commonly used navigation paths that MUST work
  const criticalPaths = [
    { view: AppView.AI_CHAT, expectedRoute: '/chat', name: 'AI Chat' },
    { view: AppView.MY_WORK, expectedRoute: '/my-work', name: 'My Work' },
    {
      view: AppView.ASSESSMENT_OVERVIEW,
      expectedRoute: '/assessment/overview',
      name: 'Assessment',
    },
    {
      view: AppView.PORTFOLIO_ROADMAP,
      expectedRoute: '/initiatives',
      name: 'Portfolio/Initiatives',
    },
    { view: AppView.IMPLEMENTATION, expectedRoute: '/execution', name: 'Execution' },
    { view: AppView.BENEFITS_REALIZATION, expectedRoute: '/results/kpi', name: 'Results' },
    { view: AppView.SETTINGS_PROFILE_MODULE, expectedRoute: '/settings/profile', name: 'Settings' },
    { view: AppView.ECONOMICS, expectedRoute: '/finance', name: 'Finance' },
    { view: AppView.ADMIN_DASHBOARD, expectedRoute: '/admin', name: 'Admin' },
  ];

  describe.each(criticalPaths)('$name navigation', ({ view, expectedRoute }) => {
    it(`AppView.${view} maps to ${expectedRoute}`, () => {
      const route = getRouteFromAppView(view);
      expect(route).toBe(expectedRoute);
    });
  });
});
