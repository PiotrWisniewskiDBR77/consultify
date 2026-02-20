import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import { DemoLoadingOverlay } from '../components/demo/DemoLoadingOverlay';
import { DocumentationSection } from '../components/Landing/DocumentationSection';
import { DemoModeModal } from '../components/Landing/DemoModeModal';
import { EntryFooter } from '../components/Landing/EntryFooter';
import { EntryTopBar } from '../components/Landing/EntryTopBar';
import { HeroSection } from '../components/Landing/HeroSection';
import { InfoSections } from '../components/Landing/InfoSections';
import { TrustStrip } from '../components/Landing/TrustStrip';
import { useAppStore } from '../store/useAppStore';
import { AppView, AuthStep, SessionMode } from '../types';

interface ProductEntryPageProps {
  onStartSession: (mode: SessionMode) => void;
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export const ProductEntryPage: React.FC<ProductEntryPageProps> = ({
  onStartSession,
  onLoginClick,
  onRegisterClick,
}) => {
  const { i18n } = useTranslation();
  const { currentUser, setAuthInitialStep, setCurrentView, setSessionMode, setCurrentUser } =
    useAppStore();

  // Demo Modal State (only for Trial now)
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [demoModalMode, setDemoModalMode] = useState<'demo' | 'trial'>('trial');

  // Instant Demo Loading State
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [demoReady, setDemoReady] = useState(false);

  // Reset scroll on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Handle instant demo start (no modal) - defined before keyboard shortcut effect
  const startInstantDemo = useCallback(async () => {
    if (isLoadingDemo) return;

    setIsLoadingDemo(true);

    try {
      console.log('[ProductEntryPage] Starting instant demo...');
      const demoUser = await Api.demoLogin();
      console.log('[ProductEntryPage] Demo login successful:', demoUser);

      // Set user in store with demo flag
      setCurrentUser({
        ...demoUser,
        hasWorkspace: true,
      } as any);

      // Mark demo as ready - loading overlay will transition
      setDemoReady(true);
    } catch (error) {
      console.error('[ProductEntryPage] Demo login failed:', error);
      setIsLoadingDemo(false);
      // Fallback to modal on error
      setDemoModalMode('demo');
      setIsDemoModalOpen(true);
    }
  }, [isLoadingDemo, setCurrentUser]);

  // Keyboard shortcut: Ctrl+D / Cmd+D for instant demo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+D or Cmd+D for instant demo
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (!isLoadingDemo) {
          console.log('[ProductEntryPage] Ctrl+D pressed - starting instant demo');
          startInstantDemo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoadingDemo, startInstantDemo]);

  // Handle loading overlay completion
  const handleLoadingComplete = useCallback(() => {
    if (demoReady) {
      setIsLoadingDemo(false);
      setSessionMode(SessionMode.DEMO);
      setCurrentView(AppView.DASHBOARD);
    }
  }, [demoReady, setSessionMode, setCurrentView]);

  // Handle Demo Modal Start (for trial flow)
  const handleDemoStart = async () => {
    try {
      console.log('[ProductEntryPage] Starting demo from modal...');
      const demoUser = await Api.demoLogin();
      console.log('[ProductEntryPage] Demo login successful:', demoUser);

      // Set user in store with demo flag
      setCurrentUser({
        ...demoUser,
        hasWorkspace: true,
      } as any);

      // Close modal and navigate to dashboard
      setIsDemoModalOpen(false);
      setSessionMode(SessionMode.DEMO);
      setCurrentView(AppView.DASHBOARD);
    } catch (error) {
      console.error('[ProductEntryPage] Demo login failed:', error);
      throw error;
    }
  };

  const handleTrialRedirect = () => {
    // Show demo modal for trial (explains non-DBR77 users go to demo)
    setDemoModalMode('trial');
    setIsDemoModalOpen(true);
  };

  const handleDemoRedirect = () => {
    // INSTANT DEMO - no modal, direct loading experience
    startInstantDemo();
  };

  const handleExpertRedirect = () => {
    // Spec says: /contact/expert
    window.location.href = '/contact/expert';
  };

  return (
    <div className="absolute inset-0 bg-[#F8FAFC] dark:bg-navy-950 transition-colors duration-500 overflow-y-auto overflow-x-hidden">
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
        onRegisterClick={onRegisterClick}
        isLoggedIn={!!currentUser}
        hasWorkspace={!!currentUser?.hasWorkspace}
      />

      <main>
        <HeroSection
          onDemoClick={handleDemoRedirect}
          onTrialClick={handleTrialRedirect}
          onLoginClick={onRegisterClick}
          onExpertClick={handleExpertRedirect}
        />

        <TrustStrip />

        <DocumentationSection />

        <InfoSections />
      </main>

      <EntryFooter />

      {/* Demo Mode Modal (for Trial flow) */}
      <DemoModeModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        onStartDemo={handleDemoStart}
        mode={demoModalMode}
      />

      {/* Instant Demo Loading Overlay */}
      <DemoLoadingOverlay isVisible={isLoadingDemo} onComplete={handleLoadingComplete} />

      {/* Keyboard Shortcut Hint */}
      <div className="fixed bottom-6 right-6 z-40 hidden lg:flex items-center gap-2 px-3 py-2 bg-white/80 dark:bg-navy-900/80 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-navy-700 shadow-lg opacity-60 hover:opacity-100 transition-opacity">
        <span className="text-xs text-slate-500 dark:text-slate-400">Quick demo:</span>
        <kbd className="px-2 py-0.5 text-xs font-mono bg-slate-100 dark:bg-navy-800 rounded border border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-300">
          {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+D
        </kbd>
      </div>
    </div>
  );
};
