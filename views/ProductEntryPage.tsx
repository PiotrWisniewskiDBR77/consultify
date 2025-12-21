import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EntryTopBar } from '../components/Landing/EntryTopBar';
import { HeroSection } from '../components/Landing/HeroSection';
import { InfoSections } from '../components/Landing/InfoSections';
import { EntryFooter } from '../components/Landing/EntryFooter';
import { useAppStore } from '../store/useAppStore';
import { SessionMode, AppView, AuthStep } from '../types';
import { Api } from '../services/api';

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

    const handleDemoRedirect = async () => {
        // Pass current UI language to demo API
        const currentLanguage = i18n.language;
        try {
            await Api.startDemo(currentLanguage);
            onStartSession(SessionMode.DEMO);
        } catch (error) {
            console.error('[ProductEntryPage] Failed to start demo:', error);
            // Fallback to basic demo mode
            onStartSession(SessionMode.DEMO);
        }
    };

    const handleExpertRedirect = () => {
        // Spec says: /contact/expert
        window.location.href = '/contact/expert';
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-navy-950 transition-colors duration-500 relative overflow-hidden">
            {/* Advanced Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-600/5 dark:bg-purple-600/15 rounded-full blur-[120px]" />
                <div className="absolute top-[20%] -right-[10%] w-[35%] h-[45%] bg-indigo-600/5 dark:bg-indigo-600/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[30%] bg-emerald-600/5 dark:bg-emerald-600/15 rounded-full blur-[80px]" />

                {/* Subtle Grid / Texture for Light Mode */}
                <div className="absolute inset-0 opacity-[0.03] dark:opacity-0 bg-[url('https://www.transparenttextures.com/patterns/clean-gray-paper.png')]" />

                {/* Subtle Radial Gradient Overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(255,255,255,0.4)_100%)] dark:bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.6)_100%)]" />
            </div>

            <EntryTopBar
                onTrialClick={handleTrialRedirect}
                onDemoClick={handleDemoRedirect}
                onLoginClick={onLoginClick}
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

            {/* Tagline Badge - Bottom Right */}
            <div className="fixed bottom-12 right-12 z-40 animate-fade-in">
                <div className="relative group">
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-600/30 to-indigo-600/30 rounded-2xl blur-2xl opacity-50 group-hover:opacity-80 transition-opacity duration-500"></div>

                    {/* Content */}
                    <div className="relative px-8 py-6 rounded-2xl border border-white/20 backdrop-blur-xl bg-black/60 shadow-2xl">
                        <div className="text-right space-y-1">
                            <p className="text-2xl font-black text-white tracking-tight leading-tight">
                                AI consulting.
                            </p>
                            <p className="text-2xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent tracking-tight leading-tight">
                                No slides.
                            </p>
                            <p className="text-2xl font-black text-white tracking-tight leading-tight">
                                Just decisions.
                            </p>
                        </div>

                        {/* Accent line */}
                        <div className="mt-3 h-1 w-16 ml-auto bg-gradient-to-r from-purple-600 to-pink-600 rounded-full"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
