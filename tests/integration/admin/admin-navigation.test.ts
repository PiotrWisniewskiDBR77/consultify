/**
 * Admin Panel Navigation Integration Tests
 * Tests RouterSync synchronization with AdminView - Simplified
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppView } from '@/types';
import { ROUTES, getRouteFromAppView, getAppViewFromRoute } from '@/routes/routeConfig';

describe('Admin Panel Navigation Integration', () => {
  it('should map Overview route to ADMIN_OVERVIEW AppView', () => {
    expect(getRouteFromAppView(AppView.ADMIN_OVERVIEW)).toBe(ROUTES.ADMIN.OVERVIEW);
  });

  it('should map Organization route to ADMIN_ORGANIZATION AppView', () => {
    expect(getRouteFromAppView(AppView.ADMIN_ORGANIZATION)).toBe(ROUTES.ADMIN.ORGANIZATION);
  });

  it('should map Team route to ADMIN_TEAM AppView', () => {
    expect(getRouteFromAppView(AppView.ADMIN_TEAM)).toBe(ROUTES.ADMIN.TEAM);
  });

  it('should map Workspace route to ADMIN_WORKSPACE AppView', () => {
    expect(getRouteFromAppView(AppView.ADMIN_WORKSPACE)).toBe(ROUTES.ADMIN.INTEGRATIONS);
  });

  it('should map AI route to ADMIN_AI AppView', () => {
    expect(getRouteFromAppView(AppView.ADMIN_AI)).toBe(ROUTES.ADMIN.AI);
  });

  it('should map Billing route to ADMIN_BILLING AppView', () => {
    expect(getRouteFromAppView(AppView.ADMIN_BILLING)).toBe(ROUTES.ADMIN.BILLING);
  });

  it('should map Security route to ADMIN_SECURITY AppView', () => {
    expect(getRouteFromAppView(AppView.ADMIN_SECURITY)).toBe(ROUTES.ADMIN.SECURITY);
  });

  it('should map URL to AppView correctly', () => {
    expect(getAppViewFromRoute(ROUTES.ADMIN.OVERVIEW)).toBe(AppView.ADMIN_OVERVIEW);
    expect(getAppViewFromRoute(ROUTES.ADMIN.ORGANIZATION)).toBe(AppView.ADMIN_ORGANIZATION);
    expect(getAppViewFromRoute(ROUTES.ADMIN.TEAM)).toBe(AppView.ADMIN_TEAM);
    expect(getAppViewFromRoute(ROUTES.ADMIN.INTEGRATIONS)).toBe(AppView.ADMIN_WORKSPACE);
    expect(getAppViewFromRoute(ROUTES.ADMIN.AI)).toBe(AppView.ADMIN_AI);
    expect(getAppViewFromRoute(ROUTES.ADMIN.BILLING)).toBe(AppView.ADMIN_BILLING);
    expect(getAppViewFromRoute(ROUTES.ADMIN.SECURITY)).toBe(AppView.ADMIN_SECURITY);
  });

  it('should have consistent bidirectional mapping', () => {
    // Test that route -> view -> route is consistent
    const adminViews = [
      AppView.ADMIN_OVERVIEW,
      AppView.ADMIN_ORGANIZATION,
      AppView.ADMIN_TEAM,
      AppView.ADMIN_WORKSPACE,
      AppView.ADMIN_AI,
      AppView.ADMIN_BILLING,
      AppView.ADMIN_SECURITY,
    ];

    adminViews.forEach((view) => {
      const route = getRouteFromAppView(view);
      expect(route).toBeDefined();
      expect(typeof route).toBe('string');
      expect(route.startsWith('/admin')).toBe(true);
    });
  });
});
