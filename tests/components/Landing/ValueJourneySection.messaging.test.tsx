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
import { ValueJourneySection } from '../../../src/components/Landing/ValueJourneySection';

describe('ValueJourneySection messaging', () => {
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

  it('renders the canonical value layers and consulting journey on landing', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ValueJourneySection />
      </I18nextProvider>
    );

    expect(
      screen.getByText(
        'Consultify turns consulting intelligence into a structured journey from insight to results.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Five layers of value: Inspiration -> Knowledge -> Frameworks -> Guidance -> Execution.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'One platform for the full consulting journey: understanding -> diagnosis -> design -> execution -> results.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Inspiration')).toBeInTheDocument();
    expect(screen.getByText('Designing initiatives')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();
  });
});
