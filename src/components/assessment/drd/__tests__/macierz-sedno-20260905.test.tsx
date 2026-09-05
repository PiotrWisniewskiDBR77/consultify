/**
 * @vitest-environment jsdom
 *
 * MACIERZ WŁAŚCICIELA — trzy rzeczy, o które upomniał się 05.09
 * („koniecznie chcę moją macierz — to jest sedno tej aplikacji").
 *
 * Każdy blok testów celuje w KONKRETNE ZABEZPIECZENIE, nie w mechanizm obok
 * niego. Dowód mutacyjny (co skasować, żeby test spadł) jest wypisany przy
 * każdym bloku — bez tego „zielone" nie znaczy „broni".
 */
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import {
  MIN_CZYTELNA_KOLUMNA_PX,
  etykietaObszaru,
  etykietyPoziomowZMetodyki,
  minimumKolumnyMacierzy,
} from '../drdMatrixCellContent';
import { DRDMatrixReadOnly } from '../DRDMatrixReadOnly';
import { DrdOwnerMatrixPanel, drdOdpowiedziZWierszyMacierzy } from '../DrdOwnerMatrixPanel';

import type { MatrixRow } from '@/components/method-workspace/types';
import { DRD_STRUCTURE } from '@/services/drdStructure';

const OS1 = DRD_STRUCTURE.find((axis) => axis.id === 1)!;

/**
 * DRABINA POZIOMÓW OSI 1 — przepisana z kanonu
 * `docs/program/grafika/MACIERZ_TRESC_KOMOREK.md`, Część 1, tabela „Nazwa
 * poziomu wg książki". Nie z kodu: gdyby ktoś podmienił tytuły w SSOT,
 * ten test ma spaść, a nie przyklepać nową wersję.
 */
const DRABINA_Z_KANONU: Record<number, string> = {
  1: 'Basic Data Registration',
  2: 'Workstation Control',
  3: 'Process Control',
  4: 'Automation',
  5: 'MES',
  6: 'ERP',
  7: 'AI Support',
};

// ---------------------------------------------------------------------------
// A. Nazwy obszarów po polsku — te same, co w drzewie sesji obok
//    Dowód mutacyjny: przywróć w `DRDMatrixGrid` `{area.name}` zamiast
//    `{etykietaObszaru(area)}` → test „pasek obszarów pisze Procesy Sprzedaży"
//    spada na obu asercjach (brak polskiej, obecna angielska), a test D
//    („sesja rysuje macierz właściciela") spada na tej samej nazwie. Test
//    jednostkowy `etykietaObszaru` przechodzi dalej — i to jest właśnie różnica
//    między „funkcja działa" a „ekran jej używa".
// ---------------------------------------------------------------------------
describe('A. Macierz podpisuje obszary tak samo jak drzewo sesji', () => {
  it('SSOT ma polską nazwę dla każdego obszaru osi 1 (przesłanka testu, nie założenie)', () => {
    for (const area of OS1.areas) {
      expect(area.namePL?.trim()).toBeTruthy();
      expect(area.namePL).not.toBe(area.name);
    }
  });

  it('pasek obszarów pisze „Procesy Sprzedaży", nie „Sales Processes"', () => {
    render(<DRDMatrixReadOnly axisNumber={1} value={{ areas: { '1A': { achievedLevel: 4 } } }} />);
    expect(screen.getByText('Procesy Sprzedaży')).toBeInTheDocument();
    expect(screen.queryByText('Sales Processes')).not.toBeInTheDocument();
  });

  it('etykietaObszaru bierze namePL — tak samo, jak robi to drzewo sesji', () => {
    expect(etykietaObszaru(OS1.areas[0])).toBe('Procesy Sprzedaży');
    // Reguła jest ta sama, co w `drdWorkspaceViewModel` i obu ekranach
    // warsztatu: `namePL || name`. Sprawdzone na WSZYSTKICH obszarach osi 1,
    // nie na jednej próbce.
    for (const area of OS1.areas) {
      expect(etykietaObszaru(area)).toBe(area.namePL || area.name);
    }
    // Obszar bez polskiej nazwy nie znika — wraca angielska.
    expect(etykietaObszaru({ name: 'Only English' })).toBe('Only English');
    expect(etykietaObszaru({ name: 'Only English', namePL: '   ' })).toBe('Only English');
  });
});

// ---------------------------------------------------------------------------
// B. Etykiety wierszy = drabina poziomów z książki
//    Dowód mutacyjny: podmień w `etykietyPoziomowZMetodyki` warunek większości
//    (`bestCount * 2 > areas.length`) na `false` → wiersze zostają samymi
//    numerami i oba testy spadają.
// ---------------------------------------------------------------------------
describe('B. Wiersze niosą drabinę poziomów z kanonu, nie zmyśloną skalę', () => {
  it('etykietyPoziomowZMetodyki(oś 1) zwraca dokładnie siedem nazw z książki', () => {
    expect(etykietyPoziomowZMetodyki(OS1.areas, OS1.levelCount)).toEqual(DRABINA_Z_KANONU);
  });

  it('siatka rysuje te nazwy w wierszach, od 7 u góry do 1 na dole', () => {
    render(<DRDMatrixReadOnly axisNumber={1} value={{ areas: { '1A': { achievedLevel: 4 } } }} />);
    // Etykieta wiersza to `<div>` z `<span>N.</span>` + nazwa poziomu.
    // Celujemy w NIĄ, a nie w dowolne wystąpienie napisu — `MES` i `ERP` stoją
    // też w komórkach (to treść merytoryczna), więc `getByText` po samym
    // napisie mierzyłby co innego, niż nazwa testu obiecuje.
    const etykietyWierszy = screen
      .getAllByText(/^[1-7]\.$/)
      .map((span) => span.parentElement?.textContent?.trim() ?? '');
    expect(etykietyWierszy).toEqual(
      [7, 6, 5, 4, 3, 2, 1].map((poziom) => `${poziom}. ${DRABINA_Z_KANONU[poziom]}`)
    );
    // Zmyślona skala z audytu (`Basic / Manual`, `Digitized`, `AI-Driven`,
    // `Autonomous`) nie może wrócić żadną drogą.
    for (const zmyslone of ['Basic / Manual', 'Digitized', 'Integrated', 'AI-Driven', 'Autonomous']) {
      expect(screen.queryByText(zmyslone)).not.toBeInTheDocument();
    }
  });
});

// ---------------------------------------------------------------------------
// C. Szerokość — dziewięć obszarów mieści się w kadrze raportu
//    Dowód mutacyjny: w `minimumKolumnyMacierzy` zwróć zawsze `bazowy`
//    (czyli stan sprzed 05.09) → test „mieści się" spada, bo 9 × 92 px
//    nie wchodzi w żaden z mierzonych kadrów.
// ---------------------------------------------------------------------------
describe('C. Siatka dobiera szerokość kolumn do kadru, zamiast wypychać się w przewijanie', () => {
  const KADR_ETYKIET = 150;
  const PRZERWA = 4;

  function sumaMinimow(kadrPx: number, liczbaObszarow: number, columnMinPx = 150): number {
    const min = minimumKolumnyMacierzy({
      kadrPx,
      liczbaObszarow,
      labelColumnPx: KADR_ETYKIET,
      gapPx: PRZERWA,
      columnMinPx,
    });
    return KADR_ETYKIET + liczbaObszarow * min + liczbaObszarow * PRZERWA + 16;
  }

  it('kadr raportu PRZED naprawą (503 px): 9 kolumn schodzi do progu czytelności, nie niżej', () => {
    const min = minimumKolumnyMacierzy({
      kadrPx: 503,
      liczbaObszarow: 9,
      labelColumnPx: KADR_ETYKIET,
      gapPx: PRZERWA,
      columnMinPx: 150,
    });
    expect(min).toBe(MIN_CZYTELNA_KOLUMNA_PX);
  });

  it('kadr raportu PO naprawie (drzewo sesji schowane, macierz bez sufitu ≈ 780 px): 9 kolumn mieści się bez przewijania', () => {
    expect(sumaMinimow(780, 9)).toBeLessThanOrEqual(780);
  });

  it('szeroki kadr edytora (1400 px) NIE chudnie — minimum zostaje bazowe', () => {
    expect(
      minimumKolumnyMacierzy({
        kadrPx: 1400,
        liczbaObszarow: 9,
        labelColumnPx: KADR_ETYKIET,
        gapPx: PRZERWA,
        columnMinPx: 150,
      })
    ).toBe(92);
  });

  it('kadr niezmierzony (jsdom, pierwsza klatka) zachowuje się jak przed zmianą', () => {
    expect(
      minimumKolumnyMacierzy({
        kadrPx: 0,
        liczbaObszarow: 9,
        labelColumnPx: KADR_ETYKIET,
        gapPx: PRZERWA,
        columnMinPx: 150,
      })
    ).toBe(92);
  });
});

// ---------------------------------------------------------------------------
// D. Zakładka „Macierz" sesji rysuje siatkę właściciela
//    Dowód mutacyjny: w `MethodWorkspaceShell` przywróć bezwarunkowe
//    `<LiveMatrix .../>` (usuń `matrixContent ??`) → test „sesja rysuje
//    DRDMatrixGrid" spada; a test w `DrdMethodWorkspaceScreen.matrix.test.tsx`
//    o skalach per oś zaczyna nie znajdować `drd-matrix-cell`.
// ---------------------------------------------------------------------------
describe('D. Sesja DRD: zakładka „Macierz" to macierz właściciela', () => {
  const WIERSZE: MatrixRow[] = OS1.areas.map((area, index) => ({
    unitId: area.id,
    unitName: area.namePL || area.name,
    levels: Array.from({ length: 7 }, (_, i) => ({
      unitId: area.id,
      level: i + 1,
      achieved: index === 0 ? i + 1 <= 4 : false,
      proposed: false,
      target: index === 0 && i + 1 === 6,
      answerState: 'unresolved' as const,
      evidenceState: 'missing' as const,
      aiProposalPending: false,
      reviewRequired: false,
      blocker: false,
    })),
  }));

  it('rysuje siatkę obszary × poziomy z drabiną i polskimi nazwami obszarów', () => {
    render(
      <DrdOwnerMatrixPanel
        axisNumber={1}
        rows={WIERSZE}
        selection={null}
        onSelect={() => {}}
        onCloseSideSheet={() => {}}
        renderSideSheet={() => null}
      />
    );
    const siatka = screen.getByTestId('drd-owner-matrix');
    expect(within(siatka).getByText('Procesy Sprzedaży')).toBeInTheDocument();
    expect(within(siatka).getByText('7.').parentElement?.textContent?.trim()).toBe(
      '7. AI Support'
    );
    // 9 obszarów × 7 poziomów = 63 komórki merytoryczne.
    expect(within(siatka).getAllByTestId('drd-matrix-cell')).toHaveLength(63);
    // Chipy AS/TO dolnego paska — to po nich właściciel poznaje swoją macierz.
    expect(within(siatka).getByText('AS 4')).toBeInTheDocument();
    expect(within(siatka).getByText('TO 6')).toBeInTheDocument();
    // Uboga tabelka „Macierz na żywo" nie może współistnieć z siatką.
    expect(screen.queryByTestId('live-matrix')).not.toBeInTheDocument();
    expect(screen.queryByText('Macierz na żywo')).not.toBeInTheDocument();
  });

  it('przelicza stan warsztatu na stan siatki bez wymyślania zer', () => {
    const wynik = drdOdpowiedziZWierszyMacierzy(WIERSZE);
    expect(wynik.areas?.['1A']).toEqual({ achievedLevel: 4, targetLevel: 6 });
    // Jednostka, której nikt nie dotknął, NIE dostaje wpisu — inaczej siatka
    // pokazałaby „zmierzone zero" tam, gdzie nie było pomiaru.
    expect(wynik.areas?.['1B']).toBeUndefined();
  });
});
