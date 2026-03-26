import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ProductEntryPage } from '@/views/ProductEntryPage';

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

vi.mock('@/components/Landing/WhereItHappensSection', () => ({
  WhereItHappensSection: () => <div>where-it-happens-section</div>,
}));

vi.mock('@/components/Landing/HowItWorksSection', () => ({
  HowItWorksSection: () => <div>how-it-works-section</div>,
}));

vi.mock('@/components/Landing/ForWhomSection', () => ({
  ForWhomSection: () => <div>for-whom-section</div>,
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
  AnnaAssistantWidget: () => <div>anna-assistant-widget</div>,
}));

vi.mock('@/components/Landing/DemoModeModal', () => ({
  DemoModeModal: () => null,
}));

vi.mock('@/components/Landing/LandingFilmModal', () => ({
  LandingFilmModal: () => null,
}));

describe('ProductEntryPage knowledge preview continuity', () => {
  it('renders the landing knowledge preview on the canonical public entry surface', () => {
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
  });
});
