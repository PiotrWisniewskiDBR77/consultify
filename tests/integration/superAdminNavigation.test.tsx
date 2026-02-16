/**
 * L1: SuperAdmin route config mapping (honest)
 */

import { describe, expect, it } from 'vitest';

import { APP_VIEW_TO_ROUTE, ROUTES } from '../../src/routes/routeConfig';
import { AppView } from '../../src/types';

describe('SuperAdmin routes', () => {
  it('ROUTES.SUPERADMIN defines the canonical paths', () => {
    expect(ROUTES.SUPERADMIN.ROOT).toBe('/superadmin');
    expect(ROUTES.SUPERADMIN.OVERVIEW).toBe('/superadmin/overview');
    expect(ROUTES.SUPERADMIN.CUSTOMERS).toBe('/superadmin/customers');
    expect(ROUTES.SUPERADMIN.AI_PLATFORM).toBe('/superadmin/ai-platform');
  });

  it('APP_VIEW_TO_ROUTE maps superadmin views to correct paths', () => {
    expect(APP_VIEW_TO_ROUTE[AppView.SUPERADMIN_OVERVIEW]).toBe(ROUTES.SUPERADMIN.OVERVIEW);
    expect(APP_VIEW_TO_ROUTE[AppView.SUPERADMIN_CUSTOMERS]).toBe(ROUTES.SUPERADMIN.CUSTOMERS);
    expect(APP_VIEW_TO_ROUTE[AppView.SUPERADMIN_AI_PLATFORM]).toBe(ROUTES.SUPERADMIN.AI_PLATFORM);
    expect(APP_VIEW_TO_ROUTE[AppView.SUPERADMIN_SYSTEM]).toBe(ROUTES.SUPERADMIN.SYSTEM);
  });
});
