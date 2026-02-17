/**
 * L1: SuperAdmin navigation state mapping (honest)
 *
 * These assertions validate the real mapping tables used by `SuperAdminView`
 * and the sidebar; they replace prior render-heavy tests that used wrong import paths.
 */

import { describe, expect, it } from 'vitest';

import { appViewToSection, sectionToAppView } from '../../src/components/layout/SuperAdminSidebar';
import { ROUTES } from '../../src/routes/routeConfig';
import { AppView } from '../../src/types';

describe('SuperAdmin navigation mapping', () => {
  it('sectionToAppView: main sections map to AppView', () => {
    expect(sectionToAppView.overview).toBe(AppView.SUPERADMIN_OVERVIEW);
    expect(sectionToAppView.customers).toBe(AppView.SUPERADMIN_CUSTOMERS);
    expect(sectionToAppView['ai-platform']).toBe(AppView.SUPERADMIN_AI_PLATFORM);
    expect(sectionToAppView.system).toBe(AppView.SUPERADMIN_SYSTEM);
    expect(sectionToAppView.revenue).toBe(AppView.SUPERADMIN_REVENUE);
    expect(sectionToAppView.analytics).toBe(AppView.SUPERADMIN_ANALYTICS);
  });

  it('appViewToSection: legacy AppViews redirect to the right section', () => {
    expect(appViewToSection[AppView.SUPERADMIN_DASHBOARD]).toBe('overview');
    expect(appViewToSection[AppView.SUPERADMIN_ORGANIZATIONS]).toBe('customers');
    expect(appViewToSection[AppView.SUPERADMIN_USERS]).toBe('customers');
    expect(appViewToSection[AppView.SUPERADMIN_BILLING]).toBe('revenue');
    expect(appViewToSection[AppView.SUPERADMIN_SECURITY_POLICIES]).toBe('security');
  });

  it('ROUTES.SUPERADMIN: defines canonical URL structure', () => {
    expect(ROUTES.SUPERADMIN.ROOT).toBe('/superadmin');
    expect(ROUTES.SUPERADMIN.OVERVIEW).toBe('/superadmin/overview');
    expect(ROUTES.SUPERADMIN.CUSTOMERS).toBe('/superadmin/customers');
    expect(ROUTES.SUPERADMIN.AI_PLATFORM).toBe('/superadmin/ai-platform');
    expect(ROUTES.SUPERADMIN.SYSTEM).toBe('/superadmin/system');
    expect(ROUTES.SUPERADMIN.REVENUE).toBe('/superadmin/revenue');
    expect(ROUTES.SUPERADMIN.ANALYTICS).toBe('/superadmin/analytics');
  });
});
