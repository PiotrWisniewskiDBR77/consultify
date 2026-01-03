import React, { useEffect } from 'react';
import { AppProviders } from './src/providers/AppProviders';
import { AppRoutes } from './src/routes/AppRoutes';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { Api } from './services/api';
import './services/tokenService'; // Initialize token service
import { User } from './types';
import { useTranslation } from 'react-i18next';
import { RouterSync } from './components/RouterSync';

// Lazy load views for public routes that might be outside main app logic if needed
const AcceptInvitationView = React.lazy(() => import('./views/AcceptInvitationView'));
const PublicReportView = React.lazy(() => import('./views/reports/PublicReportView'));

const InviteRouteWrapper = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();

    return (
        <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>}>
            <AcceptInvitationView
                token={token || ''}
                onAccepted={() => navigate('/login')}
                onError={(error) => console.error('Invitation error:', error)}
            />
        </React.Suspense>
    );
};

// Main App Component
function App() {
    return (
        <AppProviders>
            <AppContent />
        </AppProviders>
    );
}

// Separated content to use hooks inside providers
function AppContent() {
    const {
        setCurrentUser,
        setCurrentOrganization,
        logout,
        theme,
        currentUser
    } = useAppStore();

    const { i18n } = useTranslation();

    // Handle RTL
    useEffect(() => {
        document.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    }, [i18n.language]);

    // Handle Dark/Light Theme class
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    // Web Vitals & Metrics Init
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            console.log('[Metrics] App initialized');
        }
    }, []);

    // Listen for token expiry
    useEffect(() => {
        const handleTokenExpired = () => {
            console.log('[Auth] Token expired event received');
            logout();
            // Optional: Redirect handled by state change in AppRoutes
        };

        window.addEventListener('auth:token-expired', handleTokenExpired);
        return () => window.removeEventListener('auth:token-expired', handleTokenExpired);
    }, [logout]);

    // Auth Verification Logic
    useEffect(() => {
        const verifyAuth = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                if (currentUser) setCurrentUser(null);
                return;
            }

            // 1. Immediate restore from localStorage
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser);
                    setCurrentUser({ ...userData, isAuthenticated: true });
                } catch {
                    console.warn('[Auth] Stale user data');
                }
            }

            // 2. Background sync
            try {
                const user = await Api.getMe();
                if (user) {
                    const authenticatedUser: User = { ...user, isAuthenticated: true };
                    setCurrentUser(authenticatedUser);
                    localStorage.setItem('user', JSON.stringify(user));

                    if (user.organizationId) {
                        setCurrentOrganization({
                            id: user.organizationId,
                            name: user.organizationName || 'Organization'
                        });
                    }
                }
            } catch (error) {
                console.error('[Auth] Profile sync failed:', error);
            }
        };

        verifyAuth();
    }, []);

    return (
        <>
            <RouterSync />
            <Routes>
                <Route path="/invite/:token" element={<InviteRouteWrapper />} />
                <Route path="/report/:id" element={
                    <React.Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>}>
                        <PublicReportView />
                    </React.Suspense>
                } />
                <Route path="/*" element={<AppRoutes />} />
            </Routes>
        </>
    );
}

export default App;
