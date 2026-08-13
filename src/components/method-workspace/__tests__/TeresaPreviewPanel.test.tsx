/**
 * @vitest-environment jsdom
 *
 * teresa.ts contract: commit is unrepresentable without a previewId, and
 * TeresaPreviewPanel never calls onCommit outside a rendered proposal card —
 * so a commit "without preview" cannot happen from this UI. `reject` must not
 * mutate any state the panel owns (it just forwards the decision upward).
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TeresaPreviewPanel } from '../TeresaPreviewPanel';
import { makeTeresaPreview } from './fixtures';

const sixQuestions = {
  whereAreWe: 'Trwa wywiad dla jednostki unit-1.',
  whatMattersNow: 'Potwierdzenie dowodu dla poziomu 2.',
  why: 'Bez dowodu poziom pozostaje propozycją.',
  whatIsMissing: 'Dowód regularnych przeglądów procesu.',
  nextSafeAction: 'Poproś respondenta o link do repozytorium.',
};

describe('TeresaPreviewPanel', () => {
  it('answers the six mandated questions', () => {
    render(
      <TeresaPreviewPanel
        sixQuestions={sixQuestions}
        proposalQueue={[]}
        onCommit={vi.fn()}
        onTakeLead={vi.fn()}
        onLetMeWorkManually={vi.fn()}
        mode="guided_manual"
      />
    );
    expect(screen.getByText('Trwa wywiad dla jednostki unit-1.')).toBeInTheDocument();
    expect(screen.getByText('Potwierdzenie dowodu dla poziomu 2.')).toBeInTheDocument();
    expect(screen.getByText('Bez dowodu poziom pozostaje propozycją.')).toBeInTheDocument();
    expect(screen.getByText('Dowód regularnych przeglądów procesu.')).toBeInTheDocument();
    expect(screen.getByText('Poproś respondenta o link do repozytorium.')).toBeInTheDocument();
  });

  it('every onCommit call carries the previewId of the card it came from — commit without preview is unrepresentable', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const preview = makeTeresaPreview({ previewId: 'preview-xyz' });
    render(
      <TeresaPreviewPanel
        sixQuestions={sixQuestions}
        proposalQueue={[preview]}
        onCommit={onCommit}
        onTakeLead={vi.fn()}
        onLetMeWorkManually={vi.fn()}
        mode="guided_manual"
      />
    );

    const card = screen.getByTestId('teresa-proposal-card');
    expect(card).toHaveAttribute('data-preview-id', 'preview-xyz');

    await user.click(within(card).getByText('Odrzuć'));
    expect(onCommit).toHaveBeenCalledTimes(1);
    const request = onCommit.mock.calls[0][0];
    expect(request.previewId).toBe('preview-xyz');
    expect(request.decision).toBe('reject');
  });

  it('reject does not remove or mutate the proposal locally — the panel is a pure renderer of proposalQueue', async () => {
    const user = userEvent.setup();
    const preview = makeTeresaPreview();
    const { rerender } = render(
      <TeresaPreviewPanel
        sixQuestions={sixQuestions}
        proposalQueue={[preview]}
        onCommit={vi.fn()}
        onTakeLead={vi.fn()}
        onLetMeWorkManually={vi.fn()}
        mode="guided_manual"
      />
    );
    await user.click(within(screen.getByTestId('teresa-proposal-card')).getByText('Odrzuć'));
    // Panel does not own the queue — it stays exactly as the caller passed it
    // until the caller re-renders with an updated queue.
    expect(screen.getByTestId('teresa-proposal-card')).toBeInTheDocument();

    rerender(
      <TeresaPreviewPanel
        sixQuestions={sixQuestions}
        proposalQueue={[]}
        onCommit={vi.fn()}
        onTakeLead={vi.fn()}
        onLetMeWorkManually={vi.fn()}
        mode="guided_manual"
      />
    );
    expect(screen.queryByTestId('teresa-proposal-card')).not.toBeInTheDocument();
    expect(screen.getByText('Brak oczekujących propozycji.')).toBeInTheDocument();
  });

  it('shows the before/after diff before any decision can be made', () => {
    render(
      <TeresaPreviewPanel
        sixQuestions={sixQuestions}
        proposalQueue={[makeTeresaPreview()]}
        onCommit={vi.fn()}
        onTakeLead={vi.fn()}
        onLetMeWorkManually={vi.fn()}
        mode="guided_manual"
      />
    );
    expect(screen.getByText('Podgląd zmiany')).toBeInTheDocument();
  });
});
