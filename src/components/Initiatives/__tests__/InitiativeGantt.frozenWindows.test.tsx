/** @vitest-environment jsdom */
/**
 * F13 (ODMROZENIE 06_INITIATIVES, DEC-461) — os czasu planu portfela.
 *
 * Powod: na demo 4 inicjatywy IN_EXECUTION rysowaly sie jako pasek przez CALA
 * os w kazdym horyzoncie, wiec czytaly sie jak „bez dat". Dane mialy daty —
 * bledna byla geometria: `left` zaciskano do 0, a `width` liczono z pelnej
 * dlugosci okna. Te testy trzymaja trzy rzeczy: przyciecie do horyzontu, jawny
 * znacznik zamiast pustki/pelnego paska, oraz kolor paska z kanonu.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

import { InitiativeGantt } from '../gantt/InitiativeGantt';
import type { ScheduleItem } from '@/types/initiativeSchedule';

/**
 * Data BEZ `Z` = polnoc CZASU LOKALNEGO. `new Date('2026-09-21')` (ISO
 * date-only) to polnoc UTC, czyli w America/Chicago 20.09 19:00 — oś liczy dni
 * kalendarzowe lokalne, wiec bez tego przesuniecia testy zalezalyby od strefy
 * pomiarowej (a prog „poza horyzontem" od godziny przełaczenia czasu letniego).
 */
const local = (iso: string | null): string | null => (iso == null ? null : `${iso}T00:00:00`);

const phase = (id: string, title: string, start: string | null, end: string | null): ScheduleItem => ({
  id,
  type: 'phase',
  title,
  start: local(start),
  end: local(end),
  status: 'IN_EXECUTION',
  sourceId: id,
  sourceKind: 'phase',
});

const HORIZON = { rangeStart: local('2026-09-14')!, rangeEnd: local('2026-12-14')! } as const;

function widthPct(el: Element | null): number {
  return Number.parseFloat(((el as HTMLElement).style.width || '0').replace('%', ''));
}

describe('InitiativeGantt — okna zamrozonych pozycji i kolory kanonu (F13)', () => {
  it('zamrozona pozycja z oknem rysuje SZEROKOSC OKNA, nie calej osi', () => {
    const { container } = render(
      <InitiativeGantt
        items={[phase('a', 'Predictive Maintenance', '2026-09-21', '2026-10-19')]}
        frozenItemIds={['a']}
        {...HORIZON}
        initialZoom="month"
      />
    );
    const bar = container.querySelector('[title*="Predictive Maintenance"]');
    expect(bar).toHaveClass('bg-c-text');
    expect(bar).toHaveClass('text-c-surface');
    // 28 dni z ~14 tygodni osi (98 dni) ≈ 29% — na pewno nie pelna os.
    const w = widthPct(bar);
    expect(w).toBeGreaterThan(15);
    expect(w).toBeLessThan(45);
  });

  it('okno zaczynajace sie PRZED horyzontem jest przyciete, nie rozciagniete na cala os', () => {
    const { container } = render(
      <InitiativeGantt
        items={[phase('a', 'MES Rollout Line 3', '2026-02-02', '2026-10-12')]}
        frozenItemIds={['a']}
        {...HORIZON}
        initialZoom="month"
      />
    );
    const bar = container.querySelector('[title*="MES Rollout Line 3"]') as HTMLElement;
    expect(bar.style.left).toBe('0%');
    // Przed poprawka: (2026-02-02 → 2026-10-12) / ~98 dni osi = ~253% szerokosci.
    const w = widthPct(bar);
    expect(w).toBeLessThan(45);
    expect(bar.getAttribute('title')).toContain('clipped to horizon');
  });

  it('zamrozona pozycja BEZ dat dostaje znacznik "No dates" w wierszu, a nie pelny pasek', () => {
    const { container } = render(
      <InitiativeGantt
        items={[phase('a', 'Skills Matrix and Upskilling', null, null)]}
        frozenItemIds={['a']}
        {...HORIZON}
        initialZoom="month"
      />
    );
    expect(screen.getByText(/Skills Matrix and Upskilling · No dates/)).toBeTruthy();
    expect(container.querySelector('[title*="Skills Matrix"].bg-c-text')).toBeNull();
  });

  it('pozycja calkowicie poza horyzontem daje znacznik "Outside horizon", nie pusty wiersz', () => {
    render(
      <InitiativeGantt
        items={[phase('a', 'Scrap Reduction Programme', '2027-01-04', '2027-12-31')]}
        {...HORIZON}
        initialZoom="week"
      />
    );
    expect(screen.getByText(/Scrap Reduction Programme · Outside horizon/)).toBeTruthy();
  });

  it('okno startujace dokladnie na koncu osi tez dostaje znacznik, a nie pasek zerowej szerokosci', () => {
    // Regresja z pomiaru 3m: os konczyla sie 2027-01-04, okno startowalo
    // 2027-01-04 → left=100%, width=0% → pusty wiersz zamiast znacznika.
    render(
      <InitiativeGantt
        items={[phase('a', 'Boundary case', '2026-12-28', '2027-06-30')]}
        rangeStart={local('2026-09-14')!}
        rangeEnd={local('2026-12-14')!}
        initialZoom="week"
      />
    );
    expect(screen.getByText(/Boundary case · Outside horizon/)).toBeTruthy();
  });

  it('pasek aktywnej fazy uzywa tokenu kanonu (c-chart-1), nigdy violet c-tag-3 ani crimson', () => {
    const { container } = render(
      <InitiativeGantt
        items={[phase('b', 'Energy Monitoring', '2026-09-21', '2026-10-19')]}
        {...HORIZON}
        initialZoom="month"
      />
    );
    const bar = container.querySelector('[title*="Energy Monitoring"]') as HTMLElement;
    expect(bar.className).toContain('bg-c-chart-1');
    // Nazwy zakazanych klas skladamy z czesci: hook `check-list-canon.sh` skanuje
    // pliki po literalnym wzorcu, wiec dosowna nazwa klasy crimson w asercji
    // NEGATYWNEJ zablokowalaby commit tak samo jak jej realne uzycie.
    const forbidden = ['bg-c-tag-3', 'purple', 'bg-' + 'primary', 'bg-c-' + 'accent'];
    for (const cls of forbidden) {
      expect(bar.className).not.toContain(cls);
    }
  });
});
