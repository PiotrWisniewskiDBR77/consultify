/**
 * L1: RouteConfig helpers (honest)
 */

import { describe, expect, it } from 'vitest';

import { APP_VIEW_TO_ROUTE, ROUTES } from '../../../src/routes/routeConfig';
import { AppView } from '../../../src/types';

describe('routeConfig (superadmin)', () => {
  it('ROUTES.SUPERADMIN is consistent', () => {
    expect(ROUTES.SUPERADMIN.ROOT).toBe('/superadmin');
    expect(ROUTES.SUPERADMIN.REVENUE).toBe('/superadmin/revenue');
    expect(ROUTES.SUPERADMIN.ANALYTICS).toBe('/superadmin/analytics');
  });

  it('APP_VIEW_TO_ROUTE maps legacy superadmin views', () => {
    expect(APP_VIEW_TO_ROUTE[AppView.SUPERADMIN_DASHBOARD]).toBe(ROUTES.SUPERADMIN.ROOT);
    expect(APP_VIEW_TO_ROUTE[AppView.SUPERADMIN_ORGANIZATIONS]).toBe(ROUTES.SUPERADMIN.CUSTOMERS);
    expect(APP_VIEW_TO_ROUTE[AppView.SUPERADMIN_BILLING]).toBe(ROUTES.SUPERADMIN.REVENUE);
  });
});
