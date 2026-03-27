/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '../../../src/i18n';
import { EpicHeroSection } from '../../../src/components/Landing/EpicHeroSection';

vi.mock('../../../src/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

describe('EpicHeroSection messaging authority', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('uses the V8 canonical category and analogy on the active landing hero', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <EpicHeroSection
          onOpenDemoNow={vi.fn()}
          onLaunchTrial={vi.fn()}
          variant="epicHeroV1"
        />
      </I18nextProvider>
    );

    expect(screen.getByText('Consulting Intelligence Platform')).toBeInTheDocument();
    expect(screen.getByText('Consultify is the')).toBeInTheDocument();
    expect(screen.getByText('Spotify for')).toBeInTheDocument();
    expect(screen.getByText('consulting knowledge.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Structured consulting workflow for diagnosis, planning, execution, and impact.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('AI-Powered Consulting Platform')).not.toBeInTheDocument();
  });
});
