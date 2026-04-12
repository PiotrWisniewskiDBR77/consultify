/**
 * L1: RouteConfig helpers (honest)
 */

import { describe, expect, it } from 'vitest';

import {
  APP_VIEW_TO_ROUTE,
  getAppViewFromPath,
  ROUTES,
} from '../../../src/routes/routeConfig';
import { AppView } from '../../../src/types';

describe('routeConfig (superadmin)', () => {
  it('ROUTES.SUPERADMIN is consistent', () => {
    expect(ROUTES.SUPERADMIN.ROOT).toBe('/superadmin');
    expect(ROUTES.SUPERADMIN.CUSTOMERS_BILLING).toBe('/superadmin/customers/commercial/billing');
    expect(ROUTES.SUPERADMIN.ANALYTICS).toBe('/superadmin/analytics');
  });

  it('APP_VIEW_TO_ROUTE maps deep-link superadmin views to unique routes', () => {
    expect(APP_VIEW_TO_ROUTE[AppView.SUPERADMIN_DASHBOARD]).toBe(ROUTES.SUPERADMIN.OVERVIEW);
    expect(APP_VIEW_TO_ROUTE[AppView.SUPERADMIN_ORGANIZATIONS]).toBe(
      ROUTES.SUPERADMIN.CUSTOMERS_ORGANIZATIONS
    );
    expect(APP_VIEW_TO_ROUTE[AppView.SUPERADMIN_BILLING]).toBe(
      ROUTES.SUPERADMIN.CUSTOMERS_BILLING
    );
    expect(APP_VIEW_TO_ROUTE[AppView.SUPERADMIN_WHITELABEL]).toBe(
      ROUTES.SUPERADMIN.CONFIGURATION_WHITELABEL
    );
  });

  it('getAppViewFromPath resolves deep-link subroutes back to the right legacy view', () => {
    expect(getAppViewFromPath(ROUTES.SUPERADMIN.CUSTOMERS_USERS)).toBe(
      AppView.SUPERADMIN_USERS
    );
    expect(getAppViewFromPath(ROUTES.SUPERADMIN.AI_PLATFORM_LLM)).toBe(
      AppView.SUPERADMIN_LLM_MANAGEMENT
    );
    expect(getAppViewFromPath(ROUTES.SUPERADMIN.CONFIGURATION_WHITELABEL)).toBe(
      AppView.SUPERADMIN_WHITELABEL
    );
    expect(getAppViewFromPath(ROUTES.SUPERADMIN.SECURITY_POLICIES)).toBe(
      AppView.SUPERADMIN_SECURITY_POLICIES
    );
  });
});
