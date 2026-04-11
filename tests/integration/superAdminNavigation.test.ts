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
    expect(sectionToAppView.customers).toBe(AppView.SUPERADMIN_CUSTOMERS);
    expect(sectionToAppView['ai-platform']).toBe(AppView.SUPERADMIN_AI_PLATFORM);
    expect(sectionToAppView.system).toBe(AppView.SUPERADMIN_SYSTEM);
    expect(sectionToAppView.content).toBe(AppView.SUPERADMIN_CONTENT);
    expect(sectionToAppView.security).toBe(AppView.SUPERADMIN_SECURITY);
  });

  it('appViewToSection: legacy AppViews redirect to canonical root branches', () => {
    expect(appViewToSection[AppView.SUPERADMIN_DASHBOARD]).toBe('customers');
    expect(appViewToSection[AppView.SUPERADMIN_ORGANIZATIONS]).toBe('customers');
    expect(appViewToSection[AppView.SUPERADMIN_USERS]).toBe('customers');
    expect(appViewToSection[AppView.SUPERADMIN_COMMUNICATION]).toBe('customers');
    expect(appViewToSection[AppView.SUPERADMIN_REVENUE]).toBe('customers');
    expect(appViewToSection[AppView.SUPERADMIN_BILLING]).toBe('customers');
    expect(appViewToSection[AppView.SUPERADMIN_ANALYTICS]).toBe('system');
    expect(appViewToSection[AppView.SUPERADMIN_COMPLIANCE]).toBe('content');
    expect(appViewToSection[AppView.SUPERADMIN_SECURITY_POLICIES]).toBe('security');
  });

  it('ROUTES.SUPERADMIN: exposes the canonical 5-branch roots', () => {
    expect(ROUTES.SUPERADMIN.ROOT).toBe('/superadmin');
    expect(ROUTES.SUPERADMIN.CUSTOMERS).toBe('/superadmin/customers');
    expect(ROUTES.SUPERADMIN.CUSTOMERS_COMMUNICATION).toBe('/superadmin/customers/communication');
    expect(ROUTES.SUPERADMIN.CUSTOMERS_COMMERCIAL).toBe('/superadmin/customers/commercial');
    expect(ROUTES.SUPERADMIN.AI_PLATFORM).toBe('/superadmin/ai-platform');
    expect(ROUTES.SUPERADMIN.SYSTEM).toBe('/superadmin/system');
    expect(ROUTES.SUPERADMIN.CONTENT).toBe('/superadmin/content');
    expect(ROUTES.SUPERADMIN.SECURITY).toBe('/superadmin/security');
  });
});
