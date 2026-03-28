import { describe, expect, it, vi } from 'vitest';

import {
  getAppViewFromPath,
  getAppViewFromRoute,
  getRouteFromAppView,
  ROUTES,
} from '../../../src/routes/routeConfig';
import { AppView } from '../../../src/types';

describe('routeConfig helpers', () => {
  it('getAppViewFromRoute: resolves exact route', () => {
    expect(getAppViewFromRoute('/superadmin/customers')).toBe(AppView.SUPERADMIN_CUSTOMERS);
    expect(getAppViewFromRoute('/superadmin/customers/communication')).toBe(
      AppView.SUPERADMIN_COMMUNICATION,
    );
  });

  it('getAppViewFromPath: resolves chat conversation routes to AI_CHAT', () => {
    expect(getAppViewFromPath('/chat/abc')).toBe(AppView.AI_CHAT);
  });

  it('knowledge routes resolve to the docs-backed knowledge base view', () => {
    expect(getRouteFromAppView(AppView.KNOWLEDGE_BASE)).toBe(ROUTES.DOCS);
    expect(getRouteFromAppView(AppView.KNOWLEDGE_BASE_ARTICLE)).toBe(ROUTES.DOCS);
    expect(getAppViewFromRoute('/docs')).toBe(AppView.KNOWLEDGE_BASE);
    expect(getAppViewFromPath('/docs')).toBe(AppView.KNOWLEDGE_BASE);
    expect(getAppViewFromPath('/docs/security')).toBe(AppView.KNOWLEDGE_BASE);
    expect(getAppViewFromPath('/knowledge')).toBe(AppView.KNOWLEDGE_BASE);
  });

  it('pricing routes keep marketing and in-app authority separate', () => {
    expect(getRouteFromAppView(AppView.APP_PRICING)).toBe(ROUTES.APP_PRICING);
    expect(getAppViewFromRoute('/pricing')).toBeNull();
    expect(getAppViewFromRoute('/app/pricing')).toBe(AppView.APP_PRICING);
    expect(getAppViewFromPath('/pricing')).toBeNull();
    expect(getAppViewFromPath('/app/pricing')).toBe(AppView.APP_PRICING);
  });

  it('keeps partner onboarding authority separate from the global onboarding wizard route', () => {
    expect(ROUTES.PARTNER.ONBOARDING).toBe('/partner/onboarding');
    expect(ROUTES.ONBOARDING).toBe('/setup/onboarding');
  });

  it('keeps legacy partner entry routes mapped to their partner app views', () => {
    expect(getAppViewFromPath('/partner/dashboard')).toBe(AppView.PARTNER_PROVIDER_HOME);
    expect(getAppViewFromPath('/partner/clients')).toBe(AppView.PARTNER_CLIENT_ACCESS);
    expect(getAppViewFromPath('/partner/commission')).toBe(AppView.PARTNER_COMMISSION);
    expect(getAppViewFromPath('/partner/directory')).toBe(AppView.PARTNER_DIRECTORY);
    expect(getAppViewFromPath('/partner/resources')).toBe(AppView.PARTNER_RESOURCES);
  });

  it('getAppViewFromPath: resolves both /finance and /economics to ECONOMICS', () => {
    expect(getAppViewFromPath('/finance')).toBe(AppView.ECONOMICS);
    expect(getAppViewFromPath('/finance/models')).toBe(AppView.ECONOMICS);
    expect(getAppViewFromPath('/economics')).toBe(AppView.ECONOMICS);
  });

  it('getAppViewFromPath: resolves superadmin prefix to SUPERADMIN_OVERVIEW', () => {
    // Root superadmin route maps to the legacy dashboard view for backward compatibility.
    expect(getAppViewFromPath('/superadmin')).toBe(AppView.SUPERADMIN_DASHBOARD);
    expect(getAppViewFromPath('/superadmin/revenue')).toBe(AppView.SUPERADMIN_REVENUE);
    expect(getAppViewFromPath('/superadmin/customers/communication')).toBe(
      AppView.SUPERADMIN_COMMUNICATION,
    );
  });

  it('getAppViewFromPath: keeps nested presentations routes under PRESENTATIONS', () => {
    expect(getAppViewFromPath('/presentations')).toBe(AppView.PRESENTATIONS);
    expect(getAppViewFromPath('/presentations/wizard')).toBe(AppView.PRESENTATIONS);
    expect(getAppViewFromPath('/presentations/builder/deck-1')).toBe(AppView.PRESENTATIONS);
  });

  it('getRouteFromAppView: falls back to chat for unknown view', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(getRouteFromAppView('NOT_A_VIEW' as any)).toBe(ROUTES.AI_CHAT);
    warn.mockRestore();
  });

  it('getRouteFromAppView: uses /finance as the canonical economics route', () => {
    expect(getRouteFromAppView(AppView.ECONOMICS)).toBe(ROUTES.FINANCE);
  });
});
