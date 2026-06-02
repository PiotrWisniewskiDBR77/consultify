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
      screen.getByText('Business intelligence is still inaccessible, generic, and unsafe.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'What Spotify did for music: access, quality, and trust at scale.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Spotify did not create more music. It made great music instantly accessible, reliable, and easy to use. Consultify applies the same shift to business intelligence.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('Access. Quality. Trust. That is the shift.')
    ).toBeInTheDocument();
  });
});
