import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import React, { Suspense } from 'react';

import { LoadingScreen } from '../../components/LoadingScreen';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { AppView, AuthStep, SessionMode, User } from '../../types';
import { ViewRenderer } from '../../ViewRenderer';
import { AuthView } from '../../views/AuthView';
import { ProductEntryPage } from '../../views/ProductEntryPage';
import { useBreadcrumbs } from '../hooks/useBreadcrumbs';
import { AuthLayout } from '../layouts/AuthLayout';
import { MainLayout } from '../layouts/MainLayout';

export const AppRoutes: React.FC = () => {
    const {
        currentView,
        currentUser,
        setCurrentView,
        setCurrentUser,
        setCurrentOrganization,
        setSessionMode,
        setAuthInitialStep,
        authInitialStep,
        sessionMode,
        logout,
        fullSessionData,
        setFullSessionData,
        theme,
        toggleTheme,
    } = useAppStore();

    const breadcrumbs = useBreadcrumbs();

    const isSuperAdmin = currentUser?.role === 'SUPERADMIN';

    // --- HANDLERS (Moved from App.tsx) ---

    const handleStartSession = (mode: SessionMode) => {
        setSessionMode(mode);

        if (currentUser?.isAuthenticated) {
            setCurrentView(AppView.AI_CHAT);
            window.history.pushState({}, '', '/chat');
            return;
        }

        if (mode === SessionMode.FREE || mode === SessionMode.DEMO) {
            window.history.pushState({}, '', '/demo');
            setAuthInitialStep(AuthStep.REGISTER);
            setCurrentView(AppView.AUTH);
        } else {
            window.history.pushState({}, '', '/trial/start');
            setAuthInitialStep(AuthStep.CODE_ENTRY);
            setCurrentView(AppView.AUTH);
        }
    };

    const handleLoginRequest = () => {
        setSessionMode(SessionMode.FREE);
        setAuthInitialStep(AuthStep.LOGIN);
        setCurrentView(AppView.AUTH);
        window.history.pushState({}, '', '/login');
    };

    const handleRegisterRequest = () => {
        setSessionMode(SessionMode.FREE);
        setAuthInitialStep(AuthStep.REGISTER);
        setCurrentView(AppView.AUTH);
        window.history.pushState({}, '', '/register');
    };

    const handleAuthSuccess = (user: User | { status?: string; message?: string }) => {
        if ('status' in user && user.status !== 'success' && 'message' in user) {
            console.error('Auth error:', user.message);
            return;
        }

        if (!('id' in user) || !('email' in user)) {
            console.error('Invalid user object received');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Authentication succeeded but token was not stored');
            Api.getUsers().catch(() => {
                console.error('Failed to verify authentication - redirecting to login');
                setCurrentView(AppView.AUTH);
                setAuthInitialStep(AuthStep.LOGIN);
            });
            return;
        }

        const validUser = user as User;
        const authenticatedUser: User = {
            ...validUser,
            isAuthenticated: true,
        };
        setCurrentUser(authenticatedUser);

        if (validUser.organizationId) {
            setCurrentOrganization({
                id: validUser.organizationId,
                name: validUser.organizationName || 'Organization',
            });
        }

        setCurrentView(AppView.AI_CHAT);
        window.history.pushState({}, '', '/chat');
    };

    // --- RENDER ---

    if (isSuperAdmin) {
        return (
            <Suspense fallback={<LoadingScreen />}>
                <ViewRenderer
                    currentView={currentView}
                    currentUser={currentUser}
                    setCurrentView={setCurrentView}
                    setCurrentUser={setCurrentUser}
                    logout={logout}
                    fullSessionData={fullSessionData}
                    setFullSessionData={setFullSessionData}
                    theme={theme}
                    toggleTheme={toggleTheme}
                />
            </Suspense>
        );
    }

    if (currentView === AppView.WELCOME) {
        return (
            <AuthLayout>
                <ProductEntryPage
                    onStartSession={handleStartSession}
                    onLoginClick={handleLoginRequest}
                    onRegisterClick={handleRegisterRequest}
                />
            </AuthLayout>
        );
    }

    if (currentView === AppView.AUTH) {
        return (
            <AuthLayout>
                <AuthView
                    initialStep={authInitialStep}
                    targetMode={sessionMode || SessionMode.FREE}
                    onAuthSuccess={handleAuthSuccess}
                    onBack={() => setCurrentView(AppView.WELCOME)}
                />
            </AuthLayout>
        );
    }

    return (
        <MainLayout breadcrumbs={breadcrumbs || ['Dashboard', 'Home']}>
            <Suspense
                fallback={
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    </div>
                }
            >
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentView}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className="h-full w-full"
                    >
                        <ViewRenderer
                            currentView={currentView}
                            currentUser={currentUser}
                            setCurrentView={setCurrentView}
                            setCurrentUser={setCurrentUser}
                            logout={logout}
                            fullSessionData={fullSessionData}
                            setFullSessionData={setFullSessionData}
                            theme={theme}
                            toggleTheme={toggleTheme}
                        />
                    </motion.div>
                </AnimatePresence>
            </Suspense>
        </MainLayout>
    );
};
