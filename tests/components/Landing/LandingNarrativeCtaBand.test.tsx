/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';

import { LandingNarrativeCtaBand } from '../../../src/components/Landing/LandingNarrativeCtaBand';
// F2 fix: don't import the real i18next singleton in tests — it's a true
// module-level singleton (src/i18n.ts calls i18n.init() at import time) and
// importing it directly across many test files leaks state between them,
// crashing the coverage collection run. react-i18next is globally mocked in
// tests/setup.ts (I18nextProvider is a passthrough), so this stub only needs
// to satisfy the `i18n` prop shape.
const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };
describe('LandingNarrativeCtaBand', () => {
  it('keeps Anna, demo, and trial as one mid-funnel CTA system', () => {
    const onAnnaClick = vi.fn();
    const onDemoClick = vi.fn();
    const onTrialClick = vi.fn();

    render(
      <I18nextProvider i18n={i18n}>
        <LandingNarrativeCtaBand
          onAnnaClick={onAnnaClick}
          onDemoClick={onDemoClick}
          onTrialClick={onTrialClick}
        />
      </I18nextProvider>
    );

    expect(screen.getByText('Choose your entry path')).toBeInTheDocument();
    expect(
      screen.getByText('Move from category clarity to your first value moment.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try demo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start trial' }));

    expect(onAnnaClick).toHaveBeenCalledTimes(1);
    expect(onDemoClick).toHaveBeenCalledTimes(1);
    expect(onTrialClick).toHaveBeenCalledTimes(1);
  });
});
