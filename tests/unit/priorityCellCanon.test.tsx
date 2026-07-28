/**
 * Bramka kanonu A4: priorytet w liście to KROPKA + TONOWANY TEKST, nie pigułka.
 *
 * Powód (przegląd 128 zrzutów, 2026-07-27, N-24 / N-29 / N-79): priorytet miał
 * cztery niezależne implementacje i trzy z nich rysowały wypełnioną pigułkę —
 * najostrzej w module Tasks, gdzie tabela robiła kropkę + tekst, a kanban obok
 * pełne `● CRITICAL` UPPERCASE. Do tego ta sama wartość pojawiała się jako
 * `MEDIUM`, `Medium` i `medium` w sąsiednich wierszach.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PriorityCell, priorityTone } from '@/components/standard/PriorityCell';
import { PriorityChip } from '@/components/ui/primitives/chips/PriorityChip';

/** Klasy, które oznaczają „pigułka": tło, ramka, pełne zaokrąglenie kapsułki. */
const ZAKAZANE = /\b(bg-(?!c-)|border(?:-|\b)|rounded-full)/;

const klasyKontenera = (el: HTMLElement) => el.className;

describe('priorytet — kanon A4', () => {
  it('PriorityCell rysuje kropkę i nie ubiera tekstu w pigułkę', () => {
    const { container } = render(<PriorityCell value="critical" label="Critical" />);
    const span = container.firstElementChild as HTMLElement;

    expect(span.textContent).toContain('Critical');
    expect(klasyKontenera(span)).not.toMatch(ZAKAZANE);

    // Kropka istnieje i to ona niesie kolor.
    const kropka = span.querySelector('span');
    expect(kropka?.className).toContain('rounded-full');
    expect(kropka?.className).toContain('bg-danger-500');
  });

  it('PriorityChip (6 tabel) też nie renderuje tła ani ramki', () => {
    const { container } = render(<PriorityChip level="medium" label="MEDIUM" />);
    // <span title> → PriorityCell
    const cell = container.querySelector('span > span') as HTMLElement;
    expect(klasyKontenera(cell)).not.toMatch(ZAKAZANE);
  });

  it('normalizuje zapis etykiety — MEDIUM / medium / Medium dają jeden wynik', () => {
    for (const surowy of ['MEDIUM', 'medium', 'Medium']) {
      const { unmount } = render(<PriorityChip level="medium" label={surowy} />);
      expect(screen.getByText('Medium')).toBeTruthy();
      unmount();
    }
  });

  it('sprowadza warianty zapisu priorytetu do jednego tonu', () => {
    expect(priorityTone('CRITICAL')).toBe('critical');
    expect(priorityTone('urgent')).toBe('critical');
    expect(priorityTone(' High ')).toBe('high');
    expect(priorityTone(undefined)).toBe('normal');
  });

  it('pusty priorytet daje myślnik, nie pustą komórkę (kanon C7)', () => {
    render(<PriorityCell value={null} />);
    expect(screen.getByText('—')).toBeTruthy();
  });
});
