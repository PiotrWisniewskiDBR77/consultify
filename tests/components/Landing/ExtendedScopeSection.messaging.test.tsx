/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it } from 'vitest';

// F2 fix: don't import the real i18next singleton in tests — it's a true
// module-level singleton (src/i18n.ts calls i18n.init() at import time) and
// importing it directly across many test files leaks state between them,
// crashing the coverage collection run. react-i18next is globally mocked in
// tests/setup.ts (I18nextProvider is a passthrough), so this stub only needs
// to satisfy the `i18n` prop shape.
const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };
import { ExtendedScopeSection } from '../../../src/components/Landing/ExtendedScopeSection';

describe('ExtendedScopeSection messaging', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
  });

  it('renders the canonical extended platform scope on landing', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ExtendedScopeSection />
      </I18nextProvider>
    );

    expect(
      screen.getByText(
        'Consultify extends consulting into finance, deliverables, and daily execution.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Financial Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Reports & Presentations')).toBeInTheDocument();
    expect(screen.getByText('My Work')).toBeInTheDocument();
    expect(screen.getByText('Company valuation')).toBeInTheDocument();
    expect(screen.getByText('Executive presentations')).toBeInTheDocument();
    expect(screen.getByText('Decisions')).toBeInTheDocument();
  });
});
