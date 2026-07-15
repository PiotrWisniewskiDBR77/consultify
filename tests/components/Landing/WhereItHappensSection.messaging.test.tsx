/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it } from 'vitest';

import { WhereItHappensSection } from '../../../src/components/Landing/WhereItHappensSection';
// F2 fix: don't import the real i18next singleton in tests — it's a true
// module-level singleton (src/i18n.ts calls i18n.init() at import time) and
// importing it directly across many test files leaks state between them,
// crashing the coverage collection run. react-i18next is globally mocked in
// tests/setup.ts (I18nextProvider is a passthrough), so this stub only needs
// to satisfy the `i18n` prop shape.
const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };
describe('WhereItHappensSection messaging', () => {
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

  it('states the canonical product surface instead of generic landing language', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <WhereItHappensSection />
      </I18nextProvider>
    );

    expect(screen.getByText('What Consultify does')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Consultify brings consulting knowledge, frameworks, execution, and deliverables into one working environment.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'This is the Consulting Intelligence Platform in practice: not just AI answers, but a structured consulting workflow from diagnosis through results.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'One category promise, one product surface, one path from understanding to measurable results.'
      )
    ).toBeInTheDocument();
  });
});
