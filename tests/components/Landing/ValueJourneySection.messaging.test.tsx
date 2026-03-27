/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it } from 'vitest';

import i18n from '../../../src/i18n';
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
