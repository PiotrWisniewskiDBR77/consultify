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
    expect(getAppViewFromRoute('/superadmin/overview')).toBe(AppView.SUPERADMIN_OVERVIEW);
    expect(getAppViewFromRoute('/superadmin/customers')).toBe(AppView.SUPERADMIN_CUSTOMERS);
    expect(getAppViewFromRoute('/superadmin/customers/communication')).toBe(
      AppView.SUPERADMIN_COMMUNICATION,
    );
    expect(getAppViewFromRoute('/superadmin/customers/commercial')).toBe(
      AppView.SUPERADMIN_REVENUE,
    );
    expect(getAppViewFromRoute('/superadmin/customers/commercial/invoices')).toBe(
      AppView.SUPERADMIN_INVOICES,
    );
  });

  it('getAppViewFromPath: resolves chat conversation routes to AI_CHAT', () => {
    expect(getAppViewFromPath('/chat/abc')).toBe(AppView.AI_CHAT);
  });

  it('keeps the dedicated V10 runtime route internal-only', () => {
    expect(ROUTES.AI_CHAT_V10_RUNTIME).toBe('/internal/v10-runtime');
    expect(getAppViewFromPath('/internal/v10-runtime')).toBe(AppView.AI_CHAT_V10_RUNTIME);
    expect(getAppViewFromPath('/chat/v10-runtime')).toBe(AppView.AI_CHAT);
    expect(getRouteFromAppView(AppView.AI_CHAT_V10_RUNTIME)).toBe('/internal/v10-runtime');
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

  it('maps pack-02 guarded nested module routes to stable AppViews', () => {
    expect(getAppViewFromPath('/roi/plan-1')).toBe(AppView.FULL_STEP4_ROI);
    expect(getAppViewFromPath('/project-intelligence/session-77')).toBe(AppView.PROJECT_INTELLIGENCE);
    expect(getAppViewFromPath('/ai-actions/queue')).toBe(AppView.AI_ACTION_PROPOSALS);
    expect(getAppViewFromPath('/consultant/panel/team')).toBe(AppView.CONSULTANT_PANEL);
    expect(getAppViewFromPath('/consultant/invites')).toBe(AppView.CONSULTANT_INVITES);
    expect(getAppViewFromPath('/affiliate/overview')).toBe(AppView.AFFILIATE_DASHBOARD);
    expect(getAppViewFromPath('/setup/organization')).toBe(AppView.ORG_SETUP_WIZARD);
    expect(getAppViewFromPath('/setup/onboarding/admin')).toBe(AppView.ONBOARDING_WIZARD);
    expect(getAppViewFromPath('/setup/onboarding/seed/persona-a')).toBe(AppView.ONBOARDING_WIZARD);
    expect(getAppViewFromPath('/partner/onboarding')).toBe(AppView.PARTNER_LANDING);
  });

  it('getAppViewFromPath: resolves both /finance and /economics to ECONOMICS', () => {
    expect(getAppViewFromPath('/finance')).toBe(AppView.ECONOMICS);
    expect(getAppViewFromPath('/finance/models')).toBe(AppView.ECONOMICS);
    expect(getAppViewFromPath('/economics')).toBe(AppView.ECONOMICS);
  });

  it('getAppViewFromPath: normalizes superadmin aliases to canonical branches', () => {
    expect(getAppViewFromPath('/superadmin')).toBe(AppView.SUPERADMIN_CUSTOMERS);
    expect(getAppViewFromPath('/superadmin/revenue')).toBe(AppView.SUPERADMIN_REVENUE);
    expect(getAppViewFromPath('/superadmin/overview')).toBe(AppView.SUPERADMIN_OVERVIEW);
    expect(getAppViewFromPath('/superadmin/analytics')).toBe(AppView.SUPERADMIN_ANALYTICS);
    expect(getAppViewFromPath('/superadmin/configuration')).toBe(AppView.SUPERADMIN_CONFIGURATION);
    expect(getAppViewFromPath('/superadmin/customers/communication')).toBe(
      AppView.SUPERADMIN_COMMUNICATION,
    );
    expect(getAppViewFromPath('/superadmin/customers/commercial/billing')).toBe(
      AppView.SUPERADMIN_BILLING,
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

  it('getRouteFromAppView: maps settings entrypoints to mounted settings sections', () => {
    expect(getRouteFromAppView(AppView.SETTINGS_AI)).toBe('/settings/ai-behavior');
    expect(getRouteFromAppView(AppView.SETTINGS_NOTIFICATIONS)).toBe(
      '/settings/notifications-overview',
    );
    expect(getRouteFromAppView(AppView.SETTINGS_SECURITY)).toBe('/settings/security-dashboard');
    expect(getRouteFromAppView(AppView.SETTINGS_API_KEYS)).toBe('/settings/api-keys');
    expect(getRouteFromAppView(AppView.SETTINGS_PRIVACY)).toBe('/settings/privacy');
    expect(getRouteFromAppView(AppView.SETTINGS_AI_MEMORY)).toBe('/settings/ai-memory');
    expect(getRouteFromAppView(AppView.SETTINGS_AI_CHAT_HISTORY)).toBe('/settings/ai-chat-history');
  });
});
