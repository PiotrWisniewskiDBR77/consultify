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
            // Login/Auth route - show auth view
            if (currentView !== AppView.AUTH) {
                console.log('[RouterSync] Navigating to AUTH/LOGIN');
                setAuthInitialStep(AuthStep.LOGIN);
                setCurrentView(AppView.AUTH);
            }
        } else if (path === '/' || path === '') {
            // Phase A: Public Landing Page (ProductEntryPage)
            // If already logged in, we stay on landing but TopBar shows "Go to Workspace"
            // Only set to WELCOME if we're not already in AUTH (login dialog might be open)
            console.log('[RouterSync] Phase A: Product Entry Page');
            if (currentView !== AppView.WELCOME && currentView !== AppView.AUTH && !currentUser) {
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
