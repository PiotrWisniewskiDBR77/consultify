import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ROUTES } from '../routeConfig';

/**
 * DEC-2026-08-24-10 — Admin/Ustawienia/Organizacja boundary review requires
 * verifying (in code, not at runtime) that `/admin/*` is gated by the ADMIN
 * role and `/superadmin/*` is gated by the SUPERADMIN role, and that the two
 * guards are never accidentally merged or dropped. This mirrors the
 * source-slicing pattern of `organizationAdminRedirect.test.ts` /
 * `settingsAdminRedirect.test.ts`: read the real AppRoutes.tsx and assert on
 * the literal route wiring rather than rendering the whole router tree.
 *
 * `tests/components/Admin/admin-rbac.test.tsx` already proves the runtime
 * *behavior* of `ProtectedRoute requiredRole="ADMIN"` (redirects, admits).
 * This test proves that behavior is actually wired to the real `/admin` and
 * `/superadmin` route paths in AppRoutes.tsx, not just to a hand-built test
 * route.
 */
describe('Admin/SuperAdmin route role guards (DEC-2026-08-24-10)', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/routes/AppRoutes.tsx'), 'utf8');

  function blockForRoute(pathExpr: string, label: string): string {
    const routeMarker = `path={\`${'$'}{${pathExpr}}/*\`}`;
    const start = source.indexOf(routeMarker);
    expect(start, `expected to find the ${label} route (${routeMarker}) in AppRoutes.tsx`).toBeGreaterThan(
      -1
    );
    // Slice up to the next sibling <Route (or end of file) so the block
    // captures exactly this one route element — independent of exact line
    // numbers, which drift as unrelated routes are added/removed elsewhere.
    // `<Route\s` (not just `<Route`) avoids false-matching `<RouteErrorBoundary>`.
    const nextRouteMatch = /<Route\s/.exec(source.slice(start + routeMarker.length));
    const end =
      nextRouteMatch === null
        ? source.length
        : start + routeMarker.length + nextRouteMatch.index;
    return source.slice(start, end);
  }

  it('mounts /admin/* behind ProtectedRoute requiredRole="ADMIN" (not SUPERADMIN)', () => {
    const adminBlock = blockForRoute('ROUTES.ADMIN.ROOT', '/admin');
    expect(adminBlock).toContain('<ProtectedRoute requiredRole="ADMIN">');
    expect(adminBlock).toContain('<AdminView');
    // Everything up to and including this route's closing `/>` must not
    // itself declare a SUPERADMIN guard — the trailing sibling-route comment
    // captured by the slice legitimately mentions SUPERADMIN, so this checks
    // the ProtectedRoute prop specifically, not the whole slice.
    expect(adminBlock).not.toContain('requiredRole="SUPERADMIN"');
  });

  it('mounts /superadmin/* behind ProtectedRoute requiredRole="SUPERADMIN"', () => {
    const superAdminBlock = blockForRoute('ROUTES.SUPERADMIN.ROOT', '/superadmin');
    expect(superAdminBlock).toContain('<ProtectedRoute requiredRole="SUPERADMIN">');
    expect(superAdminBlock).toContain('<SuperAdminView');
  });

  it('the /admin and /superadmin roots resolve to distinct, non-overlapping paths', () => {
    expect(ROUTES.ADMIN.ROOT).toBe('/admin');
    expect(ROUTES.SUPERADMIN.ROOT).toBe('/superadmin');
    expect(ROUTES.SUPERADMIN.ROOT.startsWith(ROUTES.ADMIN.ROOT)).toBe(false);
    expect(ROUTES.ADMIN.ROOT.startsWith(ROUTES.SUPERADMIN.ROOT)).toBe(false);
  });
});
