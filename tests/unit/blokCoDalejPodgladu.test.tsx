/**
 * Bramka: blok „Co dalej" renderuje się i pokazuje realne przejścia.
 *
 * `whatsNext` istniał w `StandardPreview` od dawna, ale miał ZERO konsumentów —
 * kanon obiecywał blok, którego nie było na żadnym ekranie. Przegląd 128 zrzutów
 * znalazł go tylko raz, w bespoke postaci (Interview → Insights), i zapisał jako
 * wzorzec do skopiowania.
 *
 * Ten test pilnuje samego kontraktu: zadeklarowane pozycje mają się pokazać,
 * dopisek ma być JEDEN dla całej grupy (a nie powtarzany per pozycja — to był
 * konkretny błąd bespoke wersji), a brak deklaracji ma nie renderować nic.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { StandardPreview } from '@/components/standard/StandardPreview';

describe('podgląd — blok „Co dalej"', () => {
  it('pokazuje zadeklarowane przejścia i JEDEN wspólny dopisek', () => {
    render(
      <StandardPreview
        title="DRD Assessment — Jul 12, 2026"
        onClose={() => undefined}
        whatsNext={{
          items: [
            { id: 'report', label: 'Report', onClick: () => undefined },
            { id: 'pack', label: 'Initiative pack', onClick: () => undefined },
          ],
          note: 'Uses this assessment as the source.',
        }}
      />
    );

    expect(screen.getByText('Report')).toBeTruthy();
    expect(screen.getByText('Initiative pack')).toBeTruthy();
    // Dopisek RAZ dla grupy — bespoke wersja powtarzala go przy kazdej pozycji.
    expect(screen.getAllByText(/Uses this assessment as the source/)).toHaveLength(1);
  });

  it('klik w przejście woła handler modułu', async () => {
    const user = userEvent.setup();
    const naRaport = vi.fn();
    render(
      <StandardPreview
        title="Ocena"
        onClose={() => undefined}
        whatsNext={{ items: [{ id: 'report', label: 'Report', onClick: naRaport }] }}
      />
    );

    await user.click(screen.getByText('Report'));
    expect(naRaport).toHaveBeenCalledTimes(1);
  });

  it('bez deklaracji blok w ogóle się nie renderuje (addytywność)', () => {
    render(<StandardPreview title="Ocena bez przejść" onClose={() => undefined} />);

    expect(screen.queryByText(/Co dalej|What's next/i)).toBeNull();
  });
});
