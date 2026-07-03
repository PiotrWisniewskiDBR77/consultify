/**
 * @vitest-environment jsdom
 *
 * M13 flow redesign — DRAFT journey strip in the initiative document.
 * Covers step computation (content → plan → advance) and CTA wiring.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'pl' },
  }),
}));

import {
  computeDraftJourneySteps,
  draftJourneyDismissKey,
  InitiativeDraftJourney,
} from '@/components/Initiatives/InitiativeDraftJourney';

describe('computeDraftJourneySteps', () => {
  it('fresh draft: content is the current step, nothing done', () => {
    const steps = computeDraftJourneySteps({ hasContent: false, taskCount: 0 });
    expect(steps).toEqual([
      { id: 'content', done: false, current: true },
      { id: 'plan', done: false, current: false },
      { id: 'advance', done: false, current: false },
    ]);
  });

  it('content filled: plan becomes the current step', () => {
    const steps = computeDraftJourneySteps({ hasContent: true, taskCount: 0 });
    expect(steps.find((s) => s.id === 'content')?.done).toBe(true);
    expect(steps.find((s) => s.id === 'plan')?.current).toBe(true);
    expect(steps.find((s) => s.id === 'advance')?.current).toBe(false);
  });

  it('content + tasks: advance (gate action) is the current step', () => {
    const steps = computeDraftJourneySteps({ hasContent: true, taskCount: 3 });
    expect(steps.find((s) => s.id === 'plan')?.done).toBe(true);
    expect(steps.find((s) => s.id === 'advance')?.current).toBe(true);
  });

  it('dismiss key is namespaced per initiative', () => {
    expect(draftJourneyDismissKey('abc')).toBe('initiative-draft-journey-dismissed:abc');
  });
});

describe('InitiativeDraftJourney', () => {
  const setup = (overrides: Partial<React.ComponentProps<typeof InitiativeDraftJourney>> = {}) => {
    const props = {
      hasContent: false,
      taskCount: 0,
      advanceActionLabel: 'Wyślij do przeglądu',
      onFillWithAi: vi.fn(),
      onPlanTasks: vi.fn(),
      onAdvance: vi.fn(),
      onDismiss: vi.fn(),
      ...overrides,
    };
    render(<InitiativeDraftJourney {...props} />);
    return props;
  };

  it('renders the three-step journey with the gate action label', () => {
    setup();
    expect(screen.getByTestId('initiative-draft-journey')).toBeTruthy();
    expect(screen.getByTestId('journey-cta-content')).toBeTruthy();
    expect(screen.getByTestId('journey-cta-plan')).toBeTruthy();
    expect(screen.getByTestId('journey-cta-advance').textContent).toContain(
      'Wyślij do przeglądu'
    );
  });

  it('wires CTAs to the AI panel, tasks section, and gate action', () => {
    const props = setup();
    fireEvent.click(screen.getByTestId('journey-cta-content'));
    fireEvent.click(screen.getByTestId('journey-cta-plan'));
    fireEvent.click(screen.getByTestId('journey-cta-advance'));
    expect(props.onFillWithAi).toHaveBeenCalledTimes(1);
    expect(props.onPlanTasks).toHaveBeenCalledTimes(1);
    expect(props.onAdvance).toHaveBeenCalledTimes(1);
  });

  it('marks completed steps and hides their CTAs', () => {
    setup({ hasContent: true, taskCount: 2 });
    expect(screen.getByTestId('journey-done-content')).toBeTruthy();
    expect(screen.getByTestId('journey-done-plan')).toBeTruthy();
    expect(screen.queryByTestId('journey-cta-content')).toBeNull();
    expect(screen.queryByTestId('journey-cta-plan')).toBeNull();
    expect(screen.getByTestId('journey-cta-advance')).toBeTruthy();
  });

  it('omits the advance CTA when no gate transition is available', () => {
    setup({ onAdvance: undefined });
    expect(screen.queryByTestId('journey-cta-advance')).toBeNull();
  });

  it('dismisses via the close button', () => {
    const props = setup();
    fireEvent.click(screen.getByTestId('journey-dismiss'));
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  });
});
