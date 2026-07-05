/**
 * @vitest-environment jsdom
 *
 * M27 SuperAdmin — entry reachability guard (Harvard R2 #10, H6.10).
 *
 * Locks the chain that lets a SUPERADMIN user actually reach the console:
 *   1. role detection (isSuperAdminRole) normalizes both backend spellings,
 *   2. the live sidebar exposes a SuperAdmin launcher menu item,
 *   3. that launcher's viewId resolves to a real /superadmin route,
 *   4. the default authenticated route for a superadmin is /superadmin.
 *
 * This prevents a regression where the panel exists but has no reachable entry.
 */
import { describe, expect, it } from 'vitest';
import {
  isSuperAdminRole,
  getDefaultAuthenticatedRoute,
} from '../../../src/utils/roleGuards';
import { getSuperAdminMenuItem } from '../../../src/components/navigation/Sidebar/menuConfig';
import { getRouteFromAppView, ROUTES } from '../../../src/routes/routeConfig';

const t = ((key: string, fallback?: string) => fallback ?? key) as never;

describe('M27 SuperAdmin — role detection', () => {
  it('recognizes both SUPERADMIN and SUPER_ADMIN spellings', () => {
    expect(isSuperAdminRole('SUPERADMIN')).toBe(true);
    expect(isSuperAdminRole('SUPER_ADMIN')).toBe(true);
    expect(isSuperAdminRole('super_admin')).toBe(true);
    expect(isSuperAdminRole('ADMIN')).toBe(false);
    expect(isSuperAdminRole(null)).toBe(false);
  });

  it('routes a superadmin to the console by default', () => {
    expect(getDefaultAuthenticatedRoute('SUPERADMIN')).toBe('/superadmin');
    expect(getDefaultAuthenticatedRoute('ADMIN')).not.toBe('/superadmin');
  });
});

describe('M27 SuperAdmin — sidebar launcher entry is reachable', () => {
  it('exposes a SuperAdmin menu item with a resolvable viewId', () => {
    const item = getSuperAdminMenuItem(t);
    expect(item.id).toBe('SUPERADMIN');
    expect(item.viewId).toBeDefined();
  });

  it('resolves the launcher viewId to a real /superadmin route', () => {
    const item = getSuperAdminMenuItem(t);
    const route = getRouteFromAppView(item.viewId);
    expect(route.startsWith(ROUTES.SUPERADMIN.ROOT)).toBe(true);
    expect(route).toBe(ROUTES.SUPERADMIN.CUSTOMERS);
  });

  it('has a canonical /superadmin root route defined', () => {
    expect(ROUTES.SUPERADMIN.ROOT).toBe('/superadmin');
  });
});
