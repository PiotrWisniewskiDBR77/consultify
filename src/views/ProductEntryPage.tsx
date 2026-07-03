import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Api } from '@/services/api';

import { AIOsProductMapSection } from '../components/Landing/AIOsProductMapSection';
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
import { LandingNarrativeCtaBand } from '../components/Landing/LandingNarrativeCtaBand';
import { ModelDeploymentSection } from '../components/Landing/ModelDeploymentSection';
import { ProblemPlatformSection } from '../components/Landing/ProblemPlatformSection';
import { ProfitHeroSection } from '../components/Landing/ProfitHeroSection';
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

type HeroVariant = 'epic' | 'profit';

const HERO_VARIANT_QUERY_KEY = 'hero';
const HERO_VARIANT_STORAGE_KEY = 'landing.heroVariant';

function normalizeHeroVariant(rawValue: string | null): HeroVariant | null {
  if (!rawValue) return null;

  const normalized = rawValue.trim().toLowerCase();

  if (['profit', 'classic', 'old'].includes(normalized)) return 'profit';
  if (['epic', 'new'].includes(normalized)) return 'epic';

  return null;
}

function getInitialHeroVariant(): HeroVariant {
  if (typeof window === 'undefined') return 'epic';

  const queryVariant = normalizeHeroVariant(
    new URLSearchParams(window.location.search).get(HERO_VARIANT_QUERY_KEY)
  );
  if (queryVariant) return queryVariant;

  return normalizeHeroVariant(window.localStorage.getItem(HERO_VARIANT_STORAGE_KEY)) ?? 'epic';
}

export const ProductEntryPage: React.FC<ProductEntryPageProps> = ({
  onLoginClick,
  onRegisterClick,
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, setCurrentView, setSessionMode, setCurrentUser, setDemoMode } =
    useAppStore();
  const [heroVariant, setHeroVariant] = useState<HeroVariant>(getInitialHeroVariant);
  const landingVariant = heroVariant === 'profit' ? 'profitHeroV1' : 'epicHeroV1';

  // Demo Modal State (only for Trial now)
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [demoModalMode, setDemoModalMode] = useState<'demo' | 'trial'>('trial');

  // Landing video modal (Film 1)
  const [isFilm1ModalOpen, setIsFilm1ModalOpen] = useState(false);

  useEffect(() => {
    const queryVariant = normalizeHeroVariant(searchParams.get(HERO_VARIANT_QUERY_KEY));
    if (queryVariant) {
      setHeroVariant(queryVariant);
      window.localStorage.setItem(HERO_VARIANT_STORAGE_KEY, queryVariant);
      return;
    }

    const storedVariant = normalizeHeroVariant(
      window.localStorage.getItem(HERO_VARIANT_STORAGE_KEY)
    );

    if (storedVariant) {
      setHeroVariant(storedVariant);
    }
  }, [searchParams]);

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
    setCurrentUser({ ...user, hasWorkspace: true, isAuthenticated: true } as any);
    setIsDemoModalOpen(false);
    setSessionMode(mode === 'demo' ? SessionMode.DEMO : SessionMode.FULL);
    if (mode === 'demo') {
      sessionStorage.setItem('demo_entry_source', 'landing_page');
      setDemoMode(true);
    } else {
      sessionStorage.removeItem('demo_entry_source');
      setDemoMode(false);
    }
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

  const handleAnnaClick = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('anna:open'));
    }
    trackFunnelEvent('landing_anna_guided_prompt_clicked', {
      promptKey: 'midpage_cta',
      variant: landingVariant,
    });
  };

  return (
    <div className="absolute inset-0 overflow-y-auto overflow-x-hidden transition-colors duration-300 bg-c-bg text-c-text">
      <EntryTopBar
        onTrialClick={handleTrialClick}
        onDemoClick={handleDemoClick}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
        isLoggedIn={!!currentUser}
        hasWorkspace={!!currentUser?.hasWorkspace}
      />

      <main>
        {heroVariant === 'profit' ? (
          <ProfitHeroSection
            onOpenDemoNow={handleDemoClick}
            onLaunchTrial={handleTrialClick}
            variant={landingVariant}
          />
        ) : (
          <EpicHeroSection
            onOpenDemoNow={handleDemoClick}
            onLaunchTrial={handleTrialClick}
            variant={landingVariant}
          />
        )}

        <ProblemPlatformSection />

        <AIOsProductMapSection />

        <WhereItHappensSection />

        <ValueJourneySection />

        <HowItWorksSection />

        <ExtendedScopeSection />

        <ForWhomSection />

        <ModelDeploymentSection />

        <LandingNarrativeCtaBand
          onAnnaClick={handleAnnaClick}
          onDemoClick={handleDemoClick}
          onTrialClick={handleTrialClick}
        />

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
