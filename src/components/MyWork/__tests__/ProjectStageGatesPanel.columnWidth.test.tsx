/**
 * Z-43 (14.09) — regresja „bramki etapów ucinają etykiety stanów/przyciski
 * przy 1440 px" (panel podglądu S5 PMO E3).
 *
 * PRZYCZYNA (zmierzona Playwright, `scripts/dev/z41-pmo-projekty-zrzuty.mjs`
 * + `read_page`/`getBoundingClientRect` na dev-render harness 1440×900):
 * kolumny deklarowały 230px („Gate") + 170px („Status") = 400px, a panel
 * podglądu (`clamp(340px, 28%, 480px)` — `CANON_PREVIEW`) daje tabeli w tej
 * karcie ok. 285px. Tabela SZERSZA niż `.overflow-x-auto` viewport nie
 * przewijała się na zrzucie — prawa krawędź kolumny „Status" była OCIĘTA
 * (nie zawinięta): "Passed"→"Pas", "Not ready"→"Not", "Upcoming"→"Upc".
 *
 * jsdom NIE liczy realnego layoutu (`scrollWidth`/`clientWidth` na elementach
 * bez rozmiaru wracają 0), więc dowód WIZUALNY jest w zrzutach Z-41 v2
 * (`~/Developer/cto-codex/zrzuty-s5-pmo-20260914/en/v2/`). Ten test pilnuje
 * KONTRAKTU, który do defektu doprowadził i którego regresja go przywróci:
 *  1) suma zadeklarowanych szerokości kolumn mieści się w zmierzonym budżecie
 *     panelu (270px ⊂ 285px, z zapasem),
 *  2) żadna kolumna nie niesie `primary: true` — ta flaga daje w jądrze
 *     (`FilterableTable.tsx` `getColumnTypeFloor`) TWARDĄ podłogę 200px
 *     egzekwowaną przez CSS `min-width` w `<th>` NIEZALEŻNIE od `columnFit`,
 *     czyli deklarowana szerokość kolumny tytułowej i tak nie miałaby
 *     żadnego efektu (zmierzone: 120px i 150px dawały identyczny render
 *     200px) — powrót `primary: true` cichcem odtwarza defekt,
 *  3) plakietka statusu ma `whitespace-nowrap` (nie może złamać się w
 *     połowie słowa przy wąskiej kolumnie),
 *  4) przycisk „Pass gate" NIE ma `whitespace-nowrap` (najdłuższa etykieta
 *     PL, „Zatwierdź bramkę", ma prawo zawinąć się na dwie linie zamiast
 *     zostać ucięta).
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../../../public/locales/en/translation.json';
import { ProjectStageGatesPanel } from '../ProjectStageGatesPanel';

const api = vi.hoisted(() => ({
  getProjectCurrentStageGate: vi.fn(),
  getProjectStageGateHistory: vi.fn(),
  passProjectStageGate: vi.fn(),
}));

vi.mock('@/services/api', () => ({ Api: api }));
// Ta sama technika co `ProjectStageGatesPanel.i18n.test.tsx` — realne klucze
// EN zamiast atrapy `key`, żeby test na tekst statusu/przycisku miał sens.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      const translated = key
        .split('.')
        .reduce<unknown>(
          (value, part) =>
            value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined,
          en
        );
      if (typeof translated === 'string') return translated;
      return typeof fallback === 'string' ? fallback : fallback?.defaultValue || key;
    },
  }),
}));

/**
 * ── ZMIERZONY BUDŻET PANELU (Z-43, Playwright 1440×900, jasny, EN) ─────────
 * Karta bramek ma własny `p-3` (24px) wewnątrz preview (`p-3`, 24px) wewnątrz
 * `clamp(340px, 28%, 480px)`. Na dolnej granicy klamry (340px) realny
 * `.overflow-x-auto` viewport tabeli wynosi 285.19px — to jest DOLNA granica
 * budżetu w całym zakresie panelu (28%×1440=403px i 28%×1280=358px dają
 * WIĘCEJ miejsca, nie mniej).
 */
const MEASURED_PREVIEW_TABLE_BUDGET_PX = 285;

describe('ProjectStageGatesPanel — szerokość kolumn (Z-43)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getProjectCurrentStageGate.mockResolvedValue({
      currentPhase: 'Assessment',
      nextGate: 'DESIGN_GATE',
      gateType: 'DESIGN_GATE',
      status: 'NOT_READY',
      completionCriteria: [],
      missingElements: [],
    });
    api.getProjectStageGateHistory.mockResolvedValue([]);
  });

  it('deklarowana suma szerokości kolumn (Gate+Status) mieści się w zmierzonym budżecie panelu 285px', async () => {
    render(<ProjectStageGatesPanel projectId="project-1" />);
    const table = await screen.findByRole('table');
    const headers = table.querySelectorAll('th[data-column-id]');
    expect(headers.length).toBe(2);

    // `<th style="width:...">` niesie szerokość ROZWIĄZANĄ przez `columnFit`
    // (patrz `FilterableTable.tsx:2012`), czyli tę samą wartość, którą widzi
    // przeglądarka — to jest dokładnie liczba zmierzona w Playwright.
    let sum = 0;
    for (const th of Array.from(headers)) {
      const style = (th as HTMLElement).style;
      const px = parseFloat(style.width || '0');
      expect(Number.isFinite(px) && px > 0).toBe(true);
      sum += px;
    }
    expect(sum).toBeLessThanOrEqual(MEASURED_PREVIEW_TABLE_BUDGET_PX);
  });

  it('żadna kolumna nie deklaruje `primary: true` (podłoga 200px odtworzyłaby defekt)', async () => {
    render(<ProjectStageGatesPanel projectId="project-1" />);
    const table = await screen.findByRole('table');
    const headers = Array.from(table.querySelectorAll('th[data-column-id]'));
    expect(headers.length).toBe(2);
    for (const th of headers) {
      const minWidth = parseFloat((th as HTMLElement).style.minWidth || '0');
      // Podłoga kolumny głównej w jądrze to 200px (`getColumnTypeFloor`,
      // FilterableTable.tsx) — żadna z dwóch kolumn nie może jej nosić,
      // bo 200 + druga kolumna zawsze przekroczy budżet 285px.
      expect(minWidth).toBeLessThan(200);
    }
  });

  it('plakietka statusu ma whitespace-nowrap; przycisk „Pass gate" go NIE ma (wolno mu zawinąć się na dwie linie)', async () => {
    render(<ProjectStageGatesPanel projectId="project-1" />);
    const badge = await screen.findByText('Not ready');
    expect(badge.className).toContain('whitespace-nowrap');

    const buttons = screen.getAllByRole('button', { name: /Pass gate/i });
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.className).not.toContain('whitespace-nowrap');
    }
  });
});
