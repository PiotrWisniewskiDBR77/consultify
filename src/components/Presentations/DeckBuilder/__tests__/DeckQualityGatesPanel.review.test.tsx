import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DeckQualityGatesPanel } from '../DeckQualityGatesPanel';

describe('DeckQualityGatesPanel simplified review', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_DECK_REVIEW_SIMPLE', 'true');
    localStorage.setItem('token', 'test-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            deckId: 'deck-1',
            canExport: false,
            canShare: false,
            score: 31,
            result: 'BLOCKED_P1',
            checkedAt: '2026-09-16T00:00:00Z',
            gates: [
              {
                id: 'critical',
                gateType: 'content',
                severity: 'error',
                priority: 'P1',
                message: 'BLOCKED_P1: Add a source to the conclusion',
                cardIndex: 2,
                category: 'content',
              },
              {
                id: 'suggestion',
                gateType: 'export',
                severity: 'warning',
                priority: 'P2',
                message: 'P2 — Add exporter-safe metadata',
                category: 'quality',
              },
            ],
          },
        }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('shows human notes, a slide action and no internal score or blocking vocabulary', async () => {
    const onJumpToCard = vi.fn();
    render(
      <DeckQualityGatesPanel
        deckId="deck-1"
        isOpen
        displayMode="embedded"
        onJumpToCard={onJumpToCard}
      />
    );

    await screen.findByText('Add a source to the conclusion');
    expect(screen.queryByText(/Deck Score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/BLOCKED_P1|\bP[012]\b|Export Blocked/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/exporter-safe metadata/i)).not.toBeInTheDocument();
    expect(screen.getByText(/details needed for a reliable export/i)).toBeInTheDocument();
    expect(screen.getByText(/export or present at any time/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Go to slide' }));
    await waitFor(() => expect(onJumpToCard).toHaveBeenCalledWith(2));
  });
});
