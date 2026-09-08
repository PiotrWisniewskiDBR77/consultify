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
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Partially')).toBeInTheDocument();
    expect(screen.getByText('No', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('I don’t know / I need help')).toBeInTheDocument();
    expect(screen.getByText('I have no evidence')).toBeInTheDocument();
    expect(screen.getByText('Not applicable')).toBeInTheDocument();
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

    fireEvent.click(screen.getByText('I don’t know / I need help'));
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
    expect(screen.getByText(/sets no level and does not count as a zero/i)).toBeInTheDocument();
  });

  it('"Not applicable" requires a justification before confirming', () => {
    const onChange = vi.fn();
    render(
      <AnswerStateControl
        value={null}
        onChange={onChange}
        resolutionData={makeResolutionData()}
        onResolutionAction={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Not applicable'));
    const confirmBtn = screen.getByText(/Confirm .Not applicable./);
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Justify/i), { target: { value: 'Proces nie istnieje w tej organizacji.' } });
    expect(confirmBtn).toBeEnabled();
    fireEvent.click(confirmBtn);
    expect(onChange).toHaveBeenCalledWith('not_applicable', 'Proces nie istnieje w tej organizacji.');
  });

  // ★ 06.09 (DEC-415): mapa kolorów przeniesiona do `answerStateColors.ts`, a
  // właściciel rozstrzygnął, że stany bez rozstrzygnięcia (Nie wiem / Nie mam
  // dowodu / Not applicable) mają być NEUTRALNE — mają być widocznie WYBRANE, ale
  // nie mogą pożyczać koloru wyniku. Gwarancja tego testu jest ta sama co
  // wcześniej: „nie wiem" nigdy nie jest pomyłką, więc nigdy nie jest czerwone.
  it('"Nie wiem" is styled neutral — never danger, and never borrows a result colour (success/warning)', () => {
    render(
      <AnswerStateControl
        value="dont_know"
        onChange={vi.fn()}
        resolutionData={makeResolutionData()}
        onResolutionAction={vi.fn()}
      />
    );
    const option = screen.getByText('I don’t know / I need help').closest('button')!;
    expect(option.getAttribute('data-tone')).toBe('neutral');
    expect(option.className).not.toMatch(/c-danger/);
    expect(option.className).not.toMatch(/c-success/);
    expect(option.className).not.toMatch(/c-warning/);
    // wyraźnie „wybrany", nie zlany z niewybranymi
    expect(option.className).toMatch(/border-c-border-strong/);
    expect(option.getAttribute('aria-checked')).toBe('true');
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
    fireEvent.click(screen.getByText('Ask Teresa'));
    expect(onResolutionAction).toHaveBeenCalledWith('ask_teresa');
  });
});
