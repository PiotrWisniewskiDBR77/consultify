import React, { useEffect } from 'react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { AppView, SessionMode, AuthStep } from '../types';

/**
 * RouterSync
 * 
 * Bridges React Router (URL) with Global State (Zustand).
 * - Listens for URL changes -> Updates App State
 * - Captures attribution parameters (?ref=, ?invite=)
 */
export const RouterSync: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const {
        setCurrentView,
        setSessionMode,
        setAuthInitialStep,
        currentView,
        currentUser
    } = useAppStore();

    // 1. Attribution Capture
    useEffect(() => {
        const refCode = searchParams.get('ref');
        const inviteCode = searchParams.get('invite');

        if (refCode) {
            sessionStorage.setItem('attribution_ref', refCode);
            console.log('[RouterSync] Captured Referral:', refCode);
        }

        if (inviteCode) {
            sessionStorage.setItem('attribution_invite', inviteCode);
            // Optionally auto-set auth step if invite is present
            if (!currentUser) {
                setAuthInitialStep(AuthStep.REGISTER);
            }
            console.log('[RouterSync] Captured Invite:', inviteCode);
        }
    }, [searchParams, currentUser, setAuthInitialStep]);

    // 2. URL -> State Sync
    // This runs on mount and when location changes
    useEffect(() => {
        const path = location.pathname;

        // Skip sync if we are already in the correct view to avoid loops
        // But for "entry" via deep link, we MUST override.

        // Define Route Map
        if (path === '/demo') {
            // Phase B: Demo Session entry
            if (currentView !== AppView.AUTH) {
                console.log('[RouterSync] Phase B: Navigating to DEMO');
                setSessionMode(SessionMode.DEMO);
                setAuthInitialStep(AuthStep.REGISTER); // Demo requires light auth
                setCurrentView(AppView.AUTH);
            }
        } else if (path === '/trial/start') {
            if (currentView !== AppView.AUTH) {
                console.log('[RouterSync] Navigating to TRIAL START');
                setSessionMode(SessionMode.FULL); // Trial is FULL mode
                setAuthInitialStep(AuthStep.REGISTER);
                setCurrentView(AppView.AUTH);
            }
        } else if (path === '/consulting') {
            console.log('[RouterSync] Navigating to CONSULTING');
            // Maybe scroll to consulting section or show modal?
            // For now, go to Welcome
            if (currentView !== AppView.WELCOME) {
                setCurrentView(AppView.WELCOME);
            }
        } else if (path.startsWith('/share/')) {
            // Public share links - no auth required, handled by App.tsx directly
            // Just log for debugging, the App component will render PublicReportView
            console.log('[RouterSync] Public Share Link accessed');
            // No state change needed - App.tsx will handle this route
        } else if (path === '/login' || path === '/auth') {
            // Login/Auth route - show auth view ONLY if not authenticated
            // If user is already authenticated, redirect to dashboard
            if (currentUser?.isAuthenticated) {
                console.log('[RouterSync] User authenticated, redirecting to chat');
                navigate('/chat', { replace: true });
                return;
            }
            if (currentView !== AppView.AUTH) {
                console.log('[RouterSync] Navigating to AUTH/LOGIN');
                setAuthInitialStep(AuthStep.LOGIN);
                setCurrentView(AppView.AUTH);
            }
        } else if (path === '/studio') {
            // Consultify Studio - Visual AI Workspace
            if (!currentUser?.isAuthenticated) {
                console.log('[RouterSync] Not authenticated, redirecting to login');
                navigate('/login', { replace: true });
                return;
            }
            if (currentView !== AppView.STUDIO) {
                console.log('[RouterSync] Navigating to Studio');
                setCurrentView(AppView.STUDIO);
            }
        } else if (path === '/chat') {
            // AI Chat - primary entry point for authenticated users
            if (!currentUser?.isAuthenticated) {
                console.log('[RouterSync] Not authenticated, redirecting to login');
                navigate('/login', { replace: true });
                return;
            }
            // Don't override Admin/SuperAdmin/Settings views - they share /chat URL
            const preservedViews = [
                'ADMIN_', 'SUPERADMIN_', 'SETTINGS_', 'CONTEXT_BUILDER_',
                'MY_WORK', 'PORTFOLIO_', 'IMPLEMENTATION', 'BENEFITS_', 
                'ECONOMICS', 'ASSESSMENT_', 'AI_ACTION_', 'KPI_OKR_', 'STUDIO'
            ];
            const shouldPreserve = preservedViews.some(prefix => currentView.startsWith(prefix));
            if (!shouldPreserve && currentView !== AppView.AI_CHAT) {
                console.log('[RouterSync] Navigating to AI Chat');
                setCurrentView(AppView.AI_CHAT);
            }
        } else if (path === '/' || path === '') {
            // Phase A: Public Landing Page (ProductEntryPage)
            // If authenticated, redirect to AI Chat
            if (currentUser?.isAuthenticated) {
                console.log('[RouterSync] User authenticated, redirecting to AI Chat');
                navigate('/chat', { replace: true });
                return;
            }
            // Only set to WELCOME if we're not already in AUTH (login dialog might be open)
            console.log('[RouterSync] Phase A: Product Entry Page');
            if (currentView !== AppView.WELCOME && currentView !== AppView.AUTH) {
                setCurrentView(AppView.WELCOME);
            }
        }

    }, [location, setCurrentView, setSessionMode, setAuthInitialStep, currentUser, currentView]);

    // 3. State -> URL Sync (Optional / One-way for now)
    // If we wanted the URL to change when user clicks in-app nav:
    /*
    useEffect(() => {
        if (currentView === AppView.FREE_ASSESSMENT_CHAT && location.pathname !== '/demo') {
            navigate('/demo', { replace: true });
        }
        // ... etc
    }, [currentView, navigate, location]);
    */

    return null; // Logic only component
};
