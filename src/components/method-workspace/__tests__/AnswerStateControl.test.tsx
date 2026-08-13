/**
 * @vitest-environment jsdom
 *
 * HELP §4: "Nie wiem" nie jest błędem i nie daje zera. Selecting it must open
 * the ResolutionCard and must NOT silently commit any other answer state.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AnswerStateControl } from '../AnswerStateControl';
import { makeResolutionData } from './fixtures';

describe('AnswerStateControl', () => {
  it('renders all six honest answer states', () => {
    render(
      <AnswerStateControl
        value={null}
        onChange={vi.fn()}
        resolutionData={makeResolutionData()}
        onResolutionAction={vi.fn()}
      />
    );
    expect(screen.getByText('Potwierdzone')).toBeInTheDocument();
    expect(screen.getByText('Częściowo')).toBeInTheDocument();
    expect(screen.getByText('Nie', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Nie wiem / potrzebuję pomocy')).toBeInTheDocument();
    expect(screen.getByText('Nie mam dowodu')).toBeInTheDocument();
    expect(screen.getByText('Nie dotyczy')).toBeInTheDocument();
  });

  it('"Nie wiem" opens the ResolutionCard and reports dont_know, never a score', () => {
    const onChange = vi.fn();
    render(
      <AnswerStateControl
        value={null}
        onChange={onChange}
        resolutionData={makeResolutionData()}
        onResolutionAction={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Nie wiem / potrzebuję pomocy'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('dont_know');
    // onChange never receives a numeric/level payload — only the answer-state id.
    expect(onChange.mock.calls[0]).toHaveLength(1);
  });

  it('renders the ResolutionCard once value is dont_know, with no auto-zero side effect', () => {
    render(
      <AnswerStateControl
        value="dont_know"
        onChange={vi.fn()}
        resolutionData={makeResolutionData({ whatIsUnknown: 'Czy mamy proces X.' })}
        onResolutionAction={vi.fn()}
      />
    );
    expect(screen.getByTestId('resolution-card')).toBeInTheDocument();
    expect(screen.getByText('Czy mamy proces X.')).toBeInTheDocument();
    expect(screen.getByText(/nie ustawia poziomu i nie liczy się jako zero/i)).toBeInTheDocument();
  });

  it('"Nie dotyczy" requires a justification before confirming', () => {
    const onChange = vi.fn();
    render(
      <AnswerStateControl
        value={null}
        onChange={onChange}
        resolutionData={makeResolutionData()}
        onResolutionAction={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Nie dotyczy'));
    const confirmBtn = screen.getByText('Potwierdź „Nie dotyczy"');
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Uzasadnij/i), { target: { value: 'Proces nie istnieje w tej organizacji.' } });
    expect(confirmBtn).toBeEnabled();
    fireEvent.click(confirmBtn);
    expect(onChange).toHaveBeenCalledWith('not_applicable', 'Proces nie istnieje w tej organizacji.');
  });

  it('the selected answer state is visually distinguished from the rest — not color-via-CSS-attribute alone (regression: `data-[selected=true]:` Tailwind variant does not compile in this repo, so the class must be applied directly in JS)', () => {
    render(
      <AnswerStateControl
        value="dont_know"
        onChange={vi.fn()}
        resolutionData={makeResolutionData()}
        onResolutionAction={vi.fn()}
      />
    );
    const selectedBtn = screen.getByText('Nie wiem / potrzebuję pomocy').closest('button')!;
    const unselectedBtn = screen.getByText('Potwierdzone').closest('button')!;

    expect(selectedBtn).toHaveAttribute('aria-checked', 'true');
    // The visually-selected tone class must be literally present in the
    // rendered class list (not delegated to a `data-[selected=true]:` CSS
    // variant, which this repo's Tailwind build silently drops).
    expect(selectedBtn.className).toMatch(/border-c-info/);
    expect(selectedBtn.className).not.toMatch(/data-\[selected/);

    expect(unselectedBtn).toHaveAttribute('aria-checked', 'false');
    expect(unselectedBtn.className).not.toMatch(/border-c-success/);
  });

  it('ResolutionCard actions forward to onResolutionAction', () => {
    const onResolutionAction = vi.fn();
    render(
      <AnswerStateControl
        value="dont_know"
        onChange={vi.fn()}
        resolutionData={makeResolutionData()}
        onResolutionAction={onResolutionAction}
      />
    );
    fireEvent.click(screen.getByText('Zapytaj Teresę'));
    expect(onResolutionAction).toHaveBeenCalledWith('ask_teresa');
  });
});
