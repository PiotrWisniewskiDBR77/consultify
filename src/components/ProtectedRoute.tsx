import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { ROUTES } from '@/routes/routeConfig';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRole?: 'SUPERADMIN' | 'ADMIN' | 'USER';
    requireAuth?: boolean;
}

/**
 * ProtectedRoute - Route guard component
 * 
 * Protects routes based on authentication and role requirements.
 * Redirects unauthenticated users to auth page.
 * Redirects unauthorized users to dashboard.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    requiredRole,
    requireAuth = true,
}) => {
    const { currentUser } = useAppStore();
    const location = useLocation();

    // Check authentication
    if (requireAuth && !currentUser?.isAuthenticated) {
        // Redirect to auth, but save the attempted location
        return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    // Check role authorization
    if (requiredRole && currentUser?.role !== requiredRole) {
        // User is authenticated but doesn't have required role
        console.warn(`[ProtectedRoute] User role "${currentUser?.role}" insufficient for route requiring "${requiredRole}"`);
        return <Navigate to={ROUTES.DASHBOARD} replace />;
    }

    // All checks passed, render children
    return <>{children}</>;
};
