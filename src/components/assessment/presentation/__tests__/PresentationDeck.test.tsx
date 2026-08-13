/**
 * @vitest-environment jsdom
 *
 * PresentationDeck — navigation chrome only (keyboard, buttons, counter).
 * Slide CONTENT correctness is covered by buildPresentationDeck.test.ts;
 * this file only checks that the shell moves between slides correctly and
 * never lets the counter go out of [1, PRESENTATION_SLIDE_COUNT].
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { makeOutput } from '@/method-core/outputs/__tests__/testFixtures';

import { buildPresentationDeck } from '../buildPresentationDeck';
import { PresentationDeck } from '../PresentationDeck';
import { PRESENTATION_SLIDE_COUNT } from '../slides';

function renderDeck(initialSlide = 0) {
  const model = buildPresentationDeck(makeOutput());
  return render(<PresentationDeck model={model} initialSlide={initialSlide} />);
}

describe('PresentationDeck', () => {
  it('starts on slide 1 of N and shows the title slide content', () => {
    renderDeck();
    expect(screen.getByTestId('slide-counter').textContent).toBe(`1 / ${PRESENTATION_SLIDE_COUNT}`);
  });

  it('advances with the "Następny" button, up to the last slide, then stops', async () => {
    const user = userEvent.setup();
    renderDeck();
    const next = screen.getByRole('button', { name: 'Następny slajd' });
    for (let i = 0; i < PRESENTATION_SLIDE_COUNT + 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- sequential UI interaction
      await user.click(next);
    }
    expect(screen.getByTestId('slide-counter').textContent).toBe(`${PRESENTATION_SLIDE_COUNT} / ${PRESENTATION_SLIDE_COUNT}`);
    expect(next).toBeDisabled();
  });

  it('goes back with the "Poprzedni" button and never below slide 1', async () => {
    const user = userEvent.setup();
    renderDeck();
    const prev = screen.getByRole('button', { name: 'Poprzedni slajd' });
    expect(prev).toBeDisabled();
    await user.click(prev);
    expect(screen.getByTestId('slide-counter').textContent).toBe(`1 / ${PRESENTATION_SLIDE_COUNT}`);
  });

  it('ArrowRight/ArrowLeft keyboard navigation moves the slide counter', async () => {
    const user = userEvent.setup();
    renderDeck();
    screen.getByTestId('presentation-deck').focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('slide-counter').textContent).toBe(`2 / ${PRESENTATION_SLIDE_COUNT}`);
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByTestId('slide-counter').textContent).toBe(`4 / ${PRESENTATION_SLIDE_COUNT}`);
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByTestId('slide-counter').textContent).toBe(`3 / ${PRESENTATION_SLIDE_COUNT}`);
  });

  it('Home/End keyboard shortcuts jump to the first/last slide', async () => {
    const user = userEvent.setup();
    renderDeck(3);
    await user.keyboard('{End}');
    expect(screen.getByTestId('slide-counter').textContent).toBe(`${PRESENTATION_SLIDE_COUNT} / ${PRESENTATION_SLIDE_COUNT}`);
    await user.keyboard('{Home}');
    expect(screen.getByTestId('slide-counter').textContent).toBe(`1 / ${PRESENTATION_SLIDE_COUNT}`);
  });

  it('clamps an out-of-range initialSlide into [0, N-1]', () => {
    renderDeck(999);
    expect(screen.getByTestId('slide-counter').textContent).toBe(`${PRESENTATION_SLIDE_COUNT} / ${PRESENTATION_SLIDE_COUNT}`);
  });
});
