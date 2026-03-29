import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ProductEntryPage } from '@/views/ProductEntryPage';

const annaAssistantWidgetSpy = vi.fn();

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentUser: null,
    setCurrentView: vi.fn(),
    setSessionMode: vi.fn(),
    setCurrentUser: vi.fn(),
    setDemoMode: vi.fn(),
  }),
}));

vi.mock('@/components/Landing/EntryTopBar', () => ({
  EntryTopBar: () => <div>entry-top-bar</div>,
}));

vi.mock('@/components/Landing/EpicHeroSection', () => ({
  EpicHeroSection: () => <div>epic-hero-section</div>,
}));

vi.mock('@/components/Landing/TrustStrip', () => ({
  TrustStrip: () => <div>trust-strip</div>,
}));

vi.mock('@/components/Landing/ProblemPlatformSection', () => ({
  ProblemPlatformSection: () => <div>problem-platform-section</div>,
}));

vi.mock('@/components/Landing/WhereItHappensSection', () => ({
  WhereItHappensSection: () => <div>where-it-happens-section</div>,
}));

vi.mock('@/components/Landing/ValueJourneySection', () => ({
  ValueJourneySection: () => <div>value-journey-section</div>,
}));

vi.mock('@/components/Landing/HowItWorksSection', () => ({
  HowItWorksSection: () => <div>how-it-works-section</div>,
}));

vi.mock('@/components/Landing/ExtendedScopeSection', () => ({
  ExtendedScopeSection: () => <div>extended-scope-section</div>,
}));

vi.mock('@/components/Landing/ForWhomSection', () => ({
  ForWhomSection: () => <div>for-whom-section</div>,
}));

vi.mock('@/components/Landing/LandingNarrativeCtaBand', () => ({
  LandingNarrativeCtaBand: () => <div>landing-narrative-cta-band</div>,
}));

vi.mock('@/components/Landing/DocumentationSection', () => ({
  DocumentationSection: () => <div>documentation-section</div>,
}));

vi.mock('@/components/Landing/KnowledgePreviewSection', () => ({
  KnowledgePreviewSection: () => <div>knowledge-preview-section</div>,
}));

vi.mock('@/components/Landing/InfoSections', () => ({
  InfoSections: () => <div>info-sections</div>,
}));

vi.mock('@/components/Landing/EntryFooter', () => ({
  EntryFooter: () => <div>entry-footer</div>,
}));

vi.mock('@/components/Landing/AnnaAssistantWidget', () => ({
  AnnaAssistantWidget: (props: any) => {
    annaAssistantWidgetSpy(props);
    return <div>anna-assistant-widget</div>;
  },
}));

vi.mock('@/components/Landing/DemoModeModal', () => ({
  DemoModeModal: () => null,
}));

vi.mock('@/components/Landing/LandingFilmModal', () => ({
  LandingFilmModal: () => null,
}));

describe('ProductEntryPage knowledge preview continuity', () => {
  it('renders the landing knowledge preview on the canonical public entry surface', () => {
    annaAssistantWidgetSpy.mockReset();

    render(
      <MemoryRouter>
        <ProductEntryPage
          onStartSession={vi.fn()}
          onLoginClick={vi.fn()}
          onRegisterClick={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('documentation-section')).toBeInTheDocument();
    expect(screen.getByText('knowledge-preview-section')).toBeInTheDocument();
    expect(screen.getByText('info-sections')).toBeInTheDocument();
    expect(annaAssistantWidgetSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        onDemoClick: expect.any(Function),
        onTrialClick: expect.any(Function),
        onContactClick: expect.any(Function),
      }),
    );
  });

  it('keeps the trust strip after the explanatory landing sections on canonical slash', () => {
    annaAssistantWidgetSpy.mockReset();

    render(
      <MemoryRouter>
        <ProductEntryPage
          onStartSession={vi.fn()}
          onLoginClick={vi.fn()}
          onRegisterClick={vi.fn()}
        />
      </MemoryRouter>,
    );

    const hero = screen.getByText('epic-hero-section');
    const problemPlatform = screen.getByText('problem-platform-section');
    const whereItHappens = screen.getByText('where-it-happens-section');
    const valueJourney = screen.getByText('value-journey-section');
    const howItWorks = screen.getByText('how-it-works-section');
    const extendedScope = screen.getByText('extended-scope-section');
    const forWhom = screen.getByText('for-whom-section');
    const landingNarrativeCtaBand = screen.getByText('landing-narrative-cta-band');
    const documentation = screen.getByText('documentation-section');
    const knowledgePreview = screen.getByText('knowledge-preview-section');
    const infoSections = screen.getByText('info-sections');
    const trustStrip = screen.getByText('trust-strip');

    expect(hero.compareDocumentPosition(problemPlatform)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(problemPlatform.compareDocumentPosition(whereItHappens)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(whereItHappens.compareDocumentPosition(valueJourney)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(valueJourney.compareDocumentPosition(howItWorks)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(howItWorks.compareDocumentPosition(extendedScope)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(extendedScope.compareDocumentPosition(forWhom)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(forWhom.compareDocumentPosition(landingNarrativeCtaBand)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(hero.compareDocumentPosition(whereItHappens)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(whereItHappens.compareDocumentPosition(howItWorks)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(howItWorks.compareDocumentPosition(forWhom)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(landingNarrativeCtaBand.compareDocumentPosition(documentation)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(documentation.compareDocumentPosition(knowledgePreview)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(knowledgePreview.compareDocumentPosition(infoSections)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(infoSections.compareDocumentPosition(trustStrip)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
