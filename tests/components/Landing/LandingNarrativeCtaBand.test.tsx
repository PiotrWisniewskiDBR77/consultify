/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';

import { LandingNarrativeCtaBand } from '../../../src/components/Landing/LandingNarrativeCtaBand';
import i18n from '../../../src/i18n';

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
