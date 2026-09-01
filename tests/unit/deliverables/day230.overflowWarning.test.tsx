import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeckOverflowWarning } from '../../../src/components/Presentations/DeckBuilder/DeckOverflowWarning';
import { preflightPresentationExport } from '../../../src/services/presentationExport';

const warning = {
  slideIndex: 7,
  slideTitle: 'Ryzyka',
  powod: 'tresc' as const,
  zmierzone: 400,
  budzet: 240,
  pewnosc: 'wysoka' as const,
};

describe('day230 pre-export overflow warning', () => {
  afterEach(() => vi.restoreAllMocks());

  it('pokazuje numer slajdu i pozwala przejść do niego przed eksportem', () => {
    const onJump = vi.fn();
    const onContinue = vi.fn();
    render(
      <DeckOverflowWarning
        warnings={[warning]}
        onJumpToSlide={onJump}
        onContinueExport={onContinue}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(/1 slajd ma treść, która się nie mieści/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Przejdź do slajdu 7' }));
    expect(onJump).toHaveBeenCalledWith(7);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('zachowuje ciszę dla poprawnego decku', () => {
    const { container } = render(
      <DeckOverflowWarning
        warnings={[]}
        onJumpToSlide={vi.fn()}
        onContinueExport={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('czyta ostrzeżenia z preflightu zamiast uruchamiać pobranie', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { overflowWarnings: [warning] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await preflightPresentationExport({ deckId: 'deck-1', format: 'pptx' });

    expect(result).toEqual([warning]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/presentations/decks/deck-1/download?preflight=overflow',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
