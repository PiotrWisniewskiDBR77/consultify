import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ROUTES } from '@/routes/routeConfig';
import { useAppStore } from '@/store/useAppStore';
import { dispatchBetaAccessBlocked, isBetaClosed, isBetaLockedForRole } from '@/utils/betaAccess';
import { normalizeAppRole } from '@/utils/roleGuards';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'SUPERADMIN' | 'ADMIN' | 'USER';
  requireAuth?: boolean;
}

/**
 * Role hierarchy - higher roles include permissions of lower roles
 * SUPERADMIN > ADMIN, OWNER > USER
 * OWNER has at least ADMIN permissions (billing, ownership, deletion per UserRole docs)
 */
const roleHierarchy: Record<string, number> = {
  USER: 1,
  ADMIN: 2,
  OWNER: 2, // Same level as ADMIN for route access; has billing/ownership/deletion
  SUPERADMIN: 3,
};

/**
 * Check if the user's role meets or exceeds the required role
 */
const hasRequiredRole = (userRole: string | undefined, requiredRole: string): boolean => {
  if (!userRole) return false;
  const userLevel = roleHierarchy[normalizeAppRole(userRole)] ?? 0;
  const requiredLevel = roleHierarchy[normalizeAppRole(requiredRole)] ?? 0;
  return userLevel >= requiredLevel;
};

/**
 * ProtectedRoute - Route guard component
 *
 * Protects routes based on authentication and role requirements.
 * Redirects unauthenticated users to auth page.
 * Redirects unauthorized users to dashboard.
 *
 * Role hierarchy: SUPERADMIN > ADMIN > USER
 * Higher roles can access routes requiring lower roles.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requireAuth = true,
}) => {
  const { currentUser, isAuthInitializing } = useAppStore();
  const location = useLocation();

  // While auth is initializing (token being verified), show nothing instead of
  // redirecting away. This prevents a flash-redirect on page refresh where the
  // user would briefly lose their intended route.
  if (isAuthInitializing) {
    return <LoadingScreen message="Initializing session..." />;
  }

  // Check authentication
  if (requireAuth && !currentUser?.isAuthenticated) {
    // Redirect to canonical login route and preserve attempted location.
    // 2026-07-28 fix: `state.from` was set here but never read by anything
    // after login (grepped the whole app — zero consumers), so a deep link's
    // query (e.g. `/excele?artifactId=...&ff_excele_edit=1`) was silently
    // dropped whenever THIS guard (rather than RouterSync's own check) won
    // the race to redirect. Use the same `?redirect=` convention RouterSync
    // writes/reads so either guard produces a login link that returns the
    // user to where they meant to go. `state.from` is kept for compatibility
    // in case something starts reading it later.
    const attemptedTarget = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(attemptedTarget)}`}
        state={{ from: location }}
        replace
      />
    );
  }

  // Security P0 (audit ADM-RAW-P0-001): SUPERADMIN must NOT silently inherit
  // tenant ADMIN access via the role hierarchy. A superadmin is not an admin of
  // any single tenant; redirect them to their dedicated control plane instead of
  // letting `3 >= 2` quietly grant /admin/* access without an explicit grant.
  if (requiredRole === 'ADMIN' && normalizeAppRole(currentUser?.role ?? '') === 'SUPERADMIN') {
    return <Navigate to={ROUTES.SUPERADMIN.ROOT} replace />;
  }

  // Check role authorization with hierarchy
  if (requiredRole && !hasRequiredRole(currentUser?.role, requiredRole)) {
    // User is authenticated but doesn't have required role level
    console.warn(
      `[ProtectedRoute] User role "${currentUser?.role}" insufficient for route requiring "${requiredRole}"`
    );
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  // All checks passed, render children
  return <>{children}</>;
};

interface BetaGateProps {
  moduleId: string;
  children: React.ReactNode;
}

/**
 * Route-level guard for closed-beta modules. Mirrors the sidebar lock from
 * betaAccess.ts so direct URL access is blocked the same way as sidebar nav.
 * On block: fires the access:blocked event (shows the modal) and redirects to chat.
 */
export const BetaGate: React.FC<BetaGateProps> = ({ moduleId, children }) => {
  const { currentUser } = useAppStore();
  const isAuthenticated = currentUser?.isAuthenticated === true;
  // Honor BETA_ADMINS_EXEMPT like the sidebar's lockClosedBetaModules: a closed
  // beta only blocks the route when it is also locked for this role. While
  // BETA_ADMINS_EXEMPT is false this is identical to before (locked for all);
  // when flipped true, ADMIN/OWNER/SUPERADMIN keep route access too — matching
  // the betaAccess.ts contract ("administrators always keep full access").
  const isLocked =
    isAuthenticated && isBetaClosed(moduleId) && isBetaLockedForRole(currentUser?.role);

  React.useEffect(() => {
    if (isLocked) dispatchBetaAccessBlocked();
  }, [isLocked]);

  if (isLocked) {
    return <Navigate to={ROUTES.AI_CHAT} replace />;
  }

  // Authentication routing owns unauthenticated deep links. A closed-beta
  // gate must not rewrite `/finance?...` to `/chat` before RouterSync can
  // preserve the original target in the login redirect.
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};
