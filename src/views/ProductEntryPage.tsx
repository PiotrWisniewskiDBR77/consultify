import React, { useEffect, useState } from 'react';

import { Api } from '@/services/api';

import { DemoModeModal } from '../components/Landing/DemoModeModal';
import { DocumentationSection } from '../components/Landing/DocumentationSection';
import { AnnaAssistantWidget } from '../components/Landing/AnnaAssistantWidget';
import { EpicHeroSection } from '../components/Landing/EpicHeroSection';
import { EntryFooter } from '../components/Landing/EntryFooter';
import { ForWhomSection } from '../components/Landing/ForWhomSection';
import { HowItWorksSection } from '../components/Landing/HowItWorksSection';
import { LandingFilmModal } from '../components/Landing/LandingFilmModal';
import { EntryTopBar } from '../components/Landing/EntryTopBar';
import { InfoSections } from '../components/Landing/InfoSections';
import { TrustStrip } from '../components/Landing/TrustStrip';
import { WhereItHappensSection } from '../components/Landing/WhereItHappensSection';
import { LANDING_FILMS } from '../config/landingFilms';
import { trackFunnelEvent } from '../services/funnelAnalytics';
import { useAppStore } from '../store/useAppStore';
import { AppView, SessionMode } from '../types';

interface ProductEntryPageProps {
  onStartSession: (mode: SessionMode) => void;
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export const ProductEntryPage: React.FC<ProductEntryPageProps> = ({
  onLoginClick,
  onRegisterClick,
}) => {
  const { currentUser, setCurrentView, setSessionMode, setCurrentUser } = useAppStore();
  const landingVariant = 'epicHeroV1';

  // Demo Modal State (only for Trial now)
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [demoModalMode, setDemoModalMode] = useState<'demo' | 'trial'>('trial');

  // Landing video modal (Film 1)
  const [isFilm1ModalOpen, setIsFilm1ModalOpen] = useState(false);

  // Reset scroll on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Track landing view + variant for A/B
  useEffect(() => {
    trackFunnelEvent('landing_viewed', { variant: landingVariant });
  }, [landingVariant]);

  // Keyboard shortcut: Ctrl+D / Cmd+D to open Film 1 modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+D or Cmd+D to open demo video
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        setIsFilm1ModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle Demo Modal Start (for trial flow)
  const handleDemoStart = async () => {
    try {
      const demoUser = await Api.demoLogin();
      setCurrentUser({
        ...demoUser,
        hasWorkspace: true,
      } as any);

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
    // Spec: OPEN DEMO NOW opens Film 1 modal (full 87s)
    setIsFilm1ModalOpen(true);
  };

  return (
    <div className="dark absolute inset-0 bg-[#0A0A1F] text-white overflow-y-auto overflow-x-hidden">
      <EntryTopBar
        onTrialClick={handleTrialRedirect}
        onDemoClick={handleDemoRedirect}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
        isLoggedIn={!!currentUser}
        hasWorkspace={!!currentUser?.hasWorkspace}
        forceDark
      />

      <main>
        <EpicHeroSection
          onOpenDemoNow={handleDemoRedirect}
          onLaunchTrial={handleTrialRedirect}
          variant={landingVariant}
        />

        <TrustStrip />

        <WhereItHappensSection />

        <HowItWorksSection />

        <ForWhomSection />

        <DocumentationSection />

        <InfoSections />
      </main>

      <EntryFooter />

      <AnnaAssistantWidget />

      {/* Demo Mode Modal (for Trial flow) */}
      <DemoModeModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        onStartDemo={handleDemoStart}
        mode={demoModalMode}
      />

      <LandingFilmModal
        film={LANDING_FILMS.film1}
        isOpen={isFilm1ModalOpen}
        onClose={() => setIsFilm1ModalOpen(false)}
        onLaunchTrial={handleTrialRedirect}
        variant={landingVariant}
      />
    </div>
  );
};
