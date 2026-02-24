import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ROUTES } from '@/routes/routeConfig';
import { useAppStore } from '@/store/useAppStore';

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
  const userLevel = roleHierarchy[userRole] ?? 0;
  const requiredLevel = roleHierarchy[requiredRole] ?? 0;
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
    // Redirect to auth, but save the attempted location
    return <Navigate to="/auth" state={{ from: location }} replace />;
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
