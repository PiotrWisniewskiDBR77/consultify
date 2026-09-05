/**
 * MVP KPI L2 (`/results/kpi/scorecards/:id`) — defekt: przy 1440 px auto-scroll
 * do bieżącego miesiąca (`scrollToColumnId`) ustawiał `scrollLeft` liczony z
 * SUMY szerokości modelu JS (`columnFit.widths`), a nie z realnej geometrii
 * ekranu — gdy `columnFit` skaluje kolumny w dół (tabela szersza niż
 * kontener, dokładnie przypadek 1440 px / 12 kolumn okresów), suma z modelu
 * i faktyczna szerokość na DOM-ie rozjeżdżają się o kilkanaście pikseli, a
 * lewa krawędź kolumny miesiąca ląduje pod sticky kolumną MIERNIK
 * („CEL 6474" czytane jako „L 6474"). Test dowodzi arytmetyki czystej funkcji
 * `obliczScrollDoKolumny`, którą FilterableTable woła PO odczycie realnych
 * szerokości z `getBoundingClientRect` (nie z modelu).
 *
 * Mutacja: usunięcie odejmowania `szerokoscPrzypietychLewo` psuje pierwszy
 * test (lewa krawędź kolumny wyliduje POD przypiętą kolumną zamiast obok
 * niej).
 */
import { describe, expect, it } from 'vitest';

import { obliczScrollDoKolumny } from '../FilterableTable';

describe('obliczScrollDoKolumny — scrollLeft dla scrollToColumnId', () => {
  it('wyrównuje lewą krawędź kolumny dokładnie za przypiętymi z lewej', () => {
    // MIERNIK (przypięty z lewej) = 324px, kolumna docelowa zaczyna się
    // (w nieprzewijanej treści) na 324 + 5*140 = 1024px, szeroka na 140px.
    // Kontener 1440px szeroki (clientWidth), treść znacznie szersza (scrollWidth).
    const scrollLeft = obliczScrollDoKolumny(1024, 140, 324, 280, 1000, 3000);
    // Lewa krawędź kolumny widoczna dokładnie tam, gdzie kończy się MIERNIK:
    // scrollLeft = offset - pinnedLeft = 1024 - 324 = 700.
    expect(scrollLeft).toBe(700);
  });

  it('dosuwa scroll, gdy wyrównanie do lewej chowałoby prawą krawędź pod pinned-right', () => {
    // Kolumna blisko końca tabeli: offset 2800, szerokość 140, kontener 1000px,
    // scrollWidth 3000, pinned-left 324, pinned-right 280 (YTD+STAN).
    const scrollLeft = obliczScrollDoKolumny(2800, 140, 324, 280, 1000, 3000);
    // Wyrównanie do lewej dałoby scrollLeft=2476, ale wtedy prawa krawędź
    // (2800+140-2476=464 w viewport) i tak mieści się przed pinned-right
    // (1000-280=720) — więc realny limit to maxScroll (3000-1000=2000).
    expect(scrollLeft).toBe(2000);
  });

  it('nigdy nie zwraca ujemnego scrollLeft (kolumna blisko początku)', () => {
    const scrollLeft = obliczScrollDoKolumny(50, 140, 324, 280, 1000, 3000);
    expect(scrollLeft).toBe(0);
  });

  it('klamruje do maxScroll (scrollWidth - clientWidth), nigdy więcej', () => {
    const scrollLeft = obliczScrollDoKolumny(5000, 140, 324, 280, 1000, 3000);
    expect(scrollLeft).toBeLessThanOrEqual(2000);
    expect(scrollLeft).toBe(2000);
  });

  it('MUTACJA-DOWÓD: bez odjęcia szerokości przypiętych z lewej lewa krawędź kolumny wpada pod MIERNIK', () => {
    // To jest dokładnie ZEPSUTA wersja formuły (offset bez odjęcia pinnedLeft) —
    // wynik NIE może się zgadzać z poprawną funkcją, inaczej test nie broni
    // przed regresją.
    const zepsutyScrollLeft = 1024; // = offset, bez odjęcia 324px MIERNIKA
    const poprawnyScrollLeft = obliczScrollDoKolumny(1024, 140, 324, 280, 1000, 3000);
    expect(poprawnyScrollLeft).not.toBe(zepsutyScrollLeft);
    expect(poprawnyScrollLeft).toBe(700);
  });
});
