import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EntryTopBar } from '../components/Landing/EntryTopBar';
import { HeroSection } from '../components/Landing/HeroSection';
import { InfoSections } from '../components/Landing/InfoSections';
import { EntryFooter } from '../components/Landing/EntryFooter';
import { useAppStore } from '../store/useAppStore';
import { SessionMode, AppView, AuthStep } from '../types';

interface ProductEntryPageProps {
    onStartSession: (mode: SessionMode) => void;
    onLoginClick: () => void;
}

export const ProductEntryPage: React.FC<ProductEntryPageProps> = ({
    onStartSession,
    onLoginClick
}) => {
    const { i18n } = useTranslation();
    const { currentUser, setAuthInitialStep, setCurrentView, setSessionMode } = useAppStore();

    // Reset scroll on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const handleTrialRedirect = () => {
        if (!currentUser) {
            setSessionMode(SessionMode.FULL);
            setAuthInitialStep(AuthStep.REGISTER);
            setCurrentView(AppView.AUTH);
            window.history.pushState({}, '', '/auth/register?mode=trial');
        } else {
            // Logged in logic
            // Check if user has workspace (this depends on the store/user structure)
            // For now, following the spec's state machine logic
            if (currentUser.hasWorkspace) {
                setCurrentView(AppView.DASHBOARD); // Or /workspace/home
            } else {
                setCurrentView(AppView.ONBOARDING_WIZARD);
            }
        }
    };

    const handleDemoRedirect = () => {
        // Spec says: /demo route, Demo Workspace
        // We'll use the existing handleStartSession which App.tsx provides
        onStartSession(SessionMode.DEMO);
    };

    const handleExpertRedirect = () => {
        // Spec says: /contact/expert
        window.location.href = '/contact/expert';
    };

    return (
        <div className="min-h-screen bg-white dark:bg-navy-950 transition-colors duration-500 relative overflow-hidden">
            {/* Advanced Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-600/5 dark:bg-purple-600/10 rounded-full blur-[120px]" />
                <div className="absolute top-[20%] -right-[10%] w-[35%] h-[45%] bg-indigo-600/5 dark:bg-indigo-600/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[30%] bg-emerald-600/5 dark:bg-emerald-600/10 rounded-full blur-[80px]" />

                {/* Subtle Radial Gradient Overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(255,255,255,0.05)_100%)] dark:bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.2)_100%)]" />
            </div>

            <EntryTopBar
                onLoginClick={onLoginClick}
                onTrialClick={handleTrialRedirect}
                onDemoClick={handleDemoRedirect}
                onExpertClick={handleExpertRedirect}
                isLoggedIn={!!currentUser}
                hasWorkspace={!!currentUser?.hasWorkspace}
            />

            <main>
                <HeroSection
                    onDemoClick={handleDemoRedirect}
                    onTrialClick={handleTrialRedirect}
                    onLoginClick={onLoginClick}
                    onExpertClick={handleExpertRedirect}
                />

                <InfoSections />
            </main>

            <EntryFooter />
        </div>
    );
};
