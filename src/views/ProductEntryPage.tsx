import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Api } from '@/services/api';

import { AnnaAssistantWidget } from '../components/Landing/AnnaAssistantWidget';
import { DemoModeModal } from '../components/Landing/DemoModeModal';
import { DocumentationSection } from '../components/Landing/DocumentationSection';
import { EntryFooter } from '../components/Landing/EntryFooter';
import { EntryTopBar } from '../components/Landing/EntryTopBar';
import { EpicHeroSection } from '../components/Landing/EpicHeroSection';
import { ExtendedScopeSection } from '../components/Landing/ExtendedScopeSection';
import { ForWhomSection } from '../components/Landing/ForWhomSection';
import { HowItWorksSection } from '../components/Landing/HowItWorksSection';
import { InfoSections } from '../components/Landing/InfoSections';
import { KnowledgePreviewSection } from '../components/Landing/KnowledgePreviewSection';
import { LandingFilmModal } from '../components/Landing/LandingFilmModal';
import { ProblemPlatformSection } from '../components/Landing/ProblemPlatformSection';
import { TrustStrip } from '../components/Landing/TrustStrip';
import { ValueJourneySection } from '../components/Landing/ValueJourneySection';
import { WhereItHappensSection } from '../components/Landing/WhereItHappensSection';
import { LANDING_FILMS } from '../config/landingFilms';
import { ROUTES } from '../routes/routeConfig';
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
  const navigate = useNavigate();
  const { currentUser, setCurrentView, setSessionMode, setCurrentUser, setDemoMode } =
    useAppStore();
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

  // Handle Demo Modal Start (signup/login → demo)
  const handleModalSuccess = (user: any, mode: 'demo' | 'trial') => {
    setCurrentUser({ ...user, hasWorkspace: true } as any);
    setIsDemoModalOpen(false);
    setSessionMode(mode === 'demo' ? SessionMode.DEMO : SessionMode.FULL);
    if (mode === 'demo') setDemoMode(true);
    else setDemoMode(false);
    setCurrentView(AppView.DASHBOARD);
    navigate(ROUTES.AI_CHAT);
  };

  const handleTrialClick = () => {
    setDemoModalMode('trial');
    setIsDemoModalOpen(true);
  };

  const handleDemoClick = () => {
    setDemoModalMode('demo');
    setIsDemoModalOpen(true);
  };

  const handleContactClick = () => {
    navigate(ROUTES.LEGAL.CONTACT);
  };

  return (
    <div className="dark absolute inset-0 bg-[#0A0A1F] text-white overflow-y-auto overflow-x-hidden">
      <EntryTopBar
        onTrialClick={handleTrialClick}
        onDemoClick={handleDemoClick}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
        isLoggedIn={!!currentUser}
        hasWorkspace={!!currentUser?.hasWorkspace}
        forceDark
      />

      <main>
        <EpicHeroSection
          onOpenDemoNow={handleDemoClick}
          onLaunchTrial={handleTrialClick}
          variant={landingVariant}
        />

        <ProblemPlatformSection />

        <WhereItHappensSection />

        <ValueJourneySection />

        <HowItWorksSection />

        <ExtendedScopeSection />

        <ForWhomSection />

        <DocumentationSection />

        <KnowledgePreviewSection onTrialClick={handleTrialClick} />

        <InfoSections />

        <TrustStrip />
      </main>

      <EntryFooter onDemoClick={handleDemoClick} onTrialClick={handleTrialClick} />

      <AnnaAssistantWidget
        onDemoClick={handleDemoClick}
        onTrialClick={handleTrialClick}
        onContactClick={handleContactClick}
      />

      {/* Demo Mode Modal (for Trial flow) */}
      <DemoModeModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        onSuccess={handleModalSuccess}
        mode={demoModalMode}
      />

      <LandingFilmModal
        film={LANDING_FILMS.film1}
        isOpen={isFilm1ModalOpen}
        onClose={() => setIsFilm1ModalOpen(false)}
        onLaunchTrial={handleTrialClick}
        variant={landingVariant}
      />
    </div>
  );
};
