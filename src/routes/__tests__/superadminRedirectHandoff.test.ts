import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ROUTES } from '../routeConfig';

/**
 * TRI-MUST-04 (2026-08-24, TRIANGLE_COMPLETENESS_VERDICT) — a SUPERADMIN who
 * follows a legacy /settings/* or /organization/* link (billing, organization,
 * tenant-defaults, members, limits, domains, branding) was silently
 * double-redirected: `RedirectWithTracking` first sent them to the matching
 * `/admin/*` screen, then the P0 guard in ProtectedRoute (ADM-RAW-P0-001,
 * which this test suite must NOT weaken) bounced them again to
 * `/superadmin/customers` with no explanation of what they were trying to
 * reach.
 *
 * The fix intercepts at the first hop: `RedirectWithTracking` now recognizes
 * SUPERADMIN and sends them straight to a sensible `/superadmin/*` screen
 * (via a new `superadminTo` prop), or to `/superadmin?from=<path>` when no
 * dedicated equivalent exists — never through the `/admin/*` screen they can
 * never render.
 *
 * Mirrors the source-slicing pattern of `settingsAdminRedirect.test.ts` /
 * `organizationAdminRedirect.test.ts` / `adminSuperadminRoleGuard.test.ts`:
 * AppRoutes.tsx pulls in a very large lazy-loaded route tree, so asserting on
 * the literal wiring is the established, low-cost way to pin this behavior
 * without mounting the whole router.
 */
describe('SUPERADMIN redirect handoff for legacy Settings/Organization routes (TRI-MUST-04)', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/routes/AppRoutes.tsx'), 'utf8');

  it('RedirectWithTracking resolves a SUPERADMIN-specific target instead of always using `to`', () => {
    const defStart = source.indexOf('const RedirectWithTracking:');
    expect(defStart).toBeGreaterThan(-1);
    const defEnd = source.indexOf('const RedirectPreservingQuery:');
    expect(defEnd).toBeGreaterThan(defStart);
    const componentSource = source.slice(defStart, defEnd);

    // Never bypasses/duplicates the P0 guard — it must consult role state and
    // route away from `/admin/*` entirely for SUPERADMIN, not re-implement
    // the guard's own redirect decision.
    expect(componentSource).toContain('isSuperAdminRole(currentUser?.role)');
    expect(componentSource).toContain('superadminTo');
    // Fallback for routes with no dedicated superadmin screen: /superadmin?from=<path>.
    expect(componentSource).toContain('ROUTES.SUPERADMIN.ROOT');
    expect(componentSource).toContain('encodeURIComponent(from)');
  });

  it.each([
    ['ROUTES.SETTINGS.BILLING', 'ROUTES.SUPERADMIN.CUSTOMERS_BILLING'],
    ['ROUTES.SETTINGS.ORGANIZATION', 'ROUTES.SUPERADMIN.CUSTOMERS_ORGANIZATIONS'],
    ['ROUTES.SETTINGS.TENANT_DEFAULTS', 'ROUTES.SUPERADMIN.CUSTOMERS_ORGANIZATIONS'],
  ])('gives /settings/* redirect for %s a superadminTo landing (%s)', (from, superadminTo) => {
    const fromIndex = source.indexOf(`from={${from}}`);
    expect(fromIndex, `expected to find from={${from}}`).toBeGreaterThan(-1);
    const slice = source.slice(fromIndex, fromIndex + 300);
    expect(slice).toContain(`superadminTo={${superadminTo}}`);
  });

  it.each([
    ['ROUTES.ORGANIZATION.MEMBERS', 'ROUTES.SUPERADMIN.CUSTOMERS_USERS'],
    ['ROUTES.ORGANIZATION.BILLING', 'ROUTES.SUPERADMIN.CUSTOMERS_BILLING'],
    ['ROUTES.ORGANIZATION.LIMITS', 'ROUTES.SUPERADMIN.CUSTOMERS_BILLING'],
    ['ROUTES.ORGANIZATION.BRANDING', 'ROUTES.SUPERADMIN.CONFIGURATION_WHITELABEL'],
  ])('gives /organization/* redirect for %s a superadminTo landing (%s)', (from, superadminTo) => {
    const fromIndex = source.indexOf(`from={${from}}`);
    expect(fromIndex, `expected to find from={${from}}`).toBeGreaterThan(-1);
    const slice = source.slice(fromIndex, fromIndex + 300);
    expect(slice).toContain(`superadminTo={${superadminTo}}`);
  });

  it('organization/domains has no dedicated superadmin screen and relies on the ?from= fallback', () => {
    const fromIndex = source.indexOf('from={ROUTES.ORGANIZATION.DOMAINS}');
    expect(fromIndex).toBeGreaterThan(-1);
    const slice = source.slice(fromIndex, fromIndex + 300);
    expect(slice).not.toContain('superadminTo=');
  });

  it('every superadminTo target referenced actually exists on ROUTES.SUPERADMIN', () => {
    expect(ROUTES.SUPERADMIN.CUSTOMERS_BILLING).toBe('/superadmin/customers/commercial/billing');
    expect(ROUTES.SUPERADMIN.CUSTOMERS_ORGANIZATIONS).toBe('/superadmin/customers/organizations');
    expect(ROUTES.SUPERADMIN.CUSTOMERS_USERS).toBe('/superadmin/customers/users');
    expect(ROUTES.SUPERADMIN.CONFIGURATION_WHITELABEL).toBe('/superadmin/configuration/whitelabel');
    expect(ROUTES.SUPERADMIN.ROOT).toBe('/superadmin');
  });

  it('does not touch the P0 guard in ProtectedRoute (ADM-RAW-P0-001)', () => {
    const protectedRouteSource = readFileSync(
      resolve(process.cwd(), 'src/components/ProtectedRoute.tsx'),
      'utf8'
    );
    expect(protectedRouteSource).toContain('ADM-RAW-P0-001');
    expect(protectedRouteSource).toContain(
      `if (requiredRole === 'ADMIN' && normalizeAppRole(currentUser?.role ?? '') === 'SUPERADMIN') {`
    );
    expect(protectedRouteSource).toContain('return <Navigate to={ROUTES.SUPERADMIN.ROOT} replace />;');
  });
});
