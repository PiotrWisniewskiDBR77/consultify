/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// F2 fix: don't import the real i18next singleton in tests — it's a true
// module-level singleton (src/i18n.ts calls i18n.init() at import time) and
// importing it directly across many test files leaks state between them,
// crashing the coverage collection run. react-i18next is globally mocked in
// tests/setup.ts (I18nextProvider is a passthrough), so this stub only needs
// to satisfy the `i18n` prop shape.
const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };
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

  it('uses the canonical category with a clearer who-its-for message and Anna-guided entry', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <EpicHeroSection onOpenDemoNow={vi.fn()} onLaunchTrial={vi.fn()} variant="epicHeroV1" />
      </I18nextProvider>
    );

    expect(screen.getByText('Consulting Intelligence Platform')).toBeInTheDocument();
    expect(screen.getByText('Consultify AI.')).toBeInTheDocument();
    expect(screen.getByText('All the world’s business knowledge.')).toBeInTheDocument();
    expect(screen.getByText('Turned into your profits.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'For consultants, transformation teams, and operators who need diagnosis, planning, execution, and measurable results in one workflow.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask Anna first' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask about fit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask about pricing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask about security' })).toBeInTheDocument();
  });
});
