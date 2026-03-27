/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it } from 'vitest';

import i18n from '../../../src/i18n';
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
