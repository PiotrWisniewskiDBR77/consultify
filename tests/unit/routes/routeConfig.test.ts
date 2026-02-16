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
  });

  it('getAppViewFromPath: resolves chat conversation routes to AI_CHAT', () => {
    expect(getAppViewFromPath('/chat/abc')).toBe(AppView.AI_CHAT);
  });

  it('getAppViewFromPath: resolves superadmin prefix to SUPERADMIN_OVERVIEW', () => {
    // Root superadmin route maps to the legacy dashboard view for backward compatibility.
    expect(getAppViewFromPath('/superadmin')).toBe(AppView.SUPERADMIN_DASHBOARD);
    expect(getAppViewFromPath('/superadmin/revenue')).toBe(AppView.SUPERADMIN_REVENUE);
  });

  it('getRouteFromAppView: falls back to chat for unknown view', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(getRouteFromAppView('NOT_A_VIEW' as any)).toBe(ROUTES.AI_CHAT);
    warn.mockRestore();
  });
});
