/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it } from 'vitest';

import { WhereItHappensSection } from '../../../src/components/Landing/WhereItHappensSection';
import i18n from '../../../src/i18n';

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
