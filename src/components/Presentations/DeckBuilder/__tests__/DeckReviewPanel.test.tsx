/**
 * DeckReviewPanel — U-43 / DEC-543 contract.
 * Guards the four things the owner rejected in the old "choinka": engineer
 * codes on screen, a bare numeric score, an export verdict, and a wall of
 * semantic colour. Plus the two things a consultant needs: a human sentence
 * and a way to reach the slide.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DeckReviewPanel } from '../DeckReviewPanel';

const report = {
  deckId: 'deck-1',
  canExport: false,
  canShare: false,
  score: 65,
  result: 'BLOCKED_P1',
  scorecard: { p0: 0, p1: 1, p2: 4, passVocabulary: 'BLOCKED_P1' },
  checkedAt: '2026-09-16T00:00:00.000Z',
  gates: [
    {
      id: 'qg-low-info',
      gateType: 'LOW_INFORMATION_SLIDES',
      severity: 'error',
      priority: 'P1',
      message: '6 slide(s) contain only a heading or a single low-information statement.',
      cardIndex: 2,
      category: 'content',
    },
    {
      id: 'qg-missing-header-footer',
      gateType: 'MISSING_HEADER_FOOTER',
      severity: 'warning',
      priority: 'P2',
      message: 'Most slides are missing exporter-safe header/footer metadata.',
      category: 'brand',
    },
  ],
};

describe('DeckReviewPanel', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ data: report }) })) as never
    );
  });

  it('shows human copy, slide number and readiness — never codes, score or an export verdict', async () => {
    render(<DeckReviewPanel deckId="deck-1" isOpen totalSlides={6} onJumpToCard={vi.fn()} />);

    await screen.findByText('This slide has only a heading — add evidence or a visual.');
    expect(
      screen.getByText('Most slides have no header or footer, so exports look unbranded.')
    ).toBeInTheDocument();

    expect(screen.getByText('Slide 3')).toBeInTheDocument();
    expect(screen.getByText('5 of 6 slides ready')).toBeInTheDocument();
    expect(screen.getByText('Needs attention (1)')).toBeInTheDocument();
    expect(screen.getByText('Suggestions (1)')).toBeInTheDocument();

    const body = document.body.textContent || '';
    for (const forbidden of [
      'BLOCKED_P1',
      'Deck Score',
      'Export Blocked',
      'Share Warning',
      'P0',
      'P1',
      'P2',
      '65',
    ]) {
      expect(body).not.toContain(forbidden);
    }
    expect(screen.queryByText(/exporter-safe/i)).not.toBeInTheDocument();
  });

  it('jumps to the slide a finding is about', async () => {
    const onJumpToCard = vi.fn();
    render(<DeckReviewPanel deckId="deck-1" isOpen totalSlides={6} onJumpToCard={onJumpToCard} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Go to slide' }));
    expect(onJumpToCard).toHaveBeenCalledWith(2);
  });

  it('re-runs the review from "Run review"', async () => {
    render(<DeckReviewPanel deckId="deck-1" isOpen totalSlides={6} />);
    await screen.findByText('Slide 3');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Run review' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  it('offers "Fix with AI" only when a repair action exists', async () => {
    const onFixWithAi = vi.fn();
    const { rerender } = render(<DeckReviewPanel deckId="deck-1" isOpen totalSlides={6} />);
    await screen.findByText('Slide 3');
    expect(screen.queryByRole('button', { name: 'Fix with AI' })).not.toBeInTheDocument();

    rerender(
      <DeckReviewPanel deckId="deck-1" isOpen totalSlides={6} onFixWithAi={onFixWithAi} />
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Fix with AI' }));
    expect(onFixWithAi).toHaveBeenCalledWith(2);
  });
});
