/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it } from 'vitest';

import i18n from '../../../src/i18n';
import { ProblemPlatformSection } from '../../../src/components/Landing/ProblemPlatformSection';

describe('ProblemPlatformSection messaging', () => {
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

  it('renders the canonical problem and platform-pattern narrative on landing', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ProblemPlatformSection />
      </I18nextProvider>
    );

    expect(
      screen.getByText(
        'Consulting intelligence should be accessible, not locked behind elite access.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('Business knowledge is valuable, but access is still limited.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Great platforms win by transforming access, not only by adding software.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Spotify simplified access to music.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Consultify is the Consulting Intelligence Platform: Spotify for consulting knowledge, delivered as a structured consulting workflow.'
      )
    ).toBeInTheDocument();
  });
});
