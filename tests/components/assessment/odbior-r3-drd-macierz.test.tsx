/**
 * @vitest-environment jsdom
 *
 * ODBIÓR NA ŻYWO 05.09, pakiet 05-ocena, RUNDA 3 — `drd-macierz-oceny`.
 *
 * Zmierzone na żywo (`evidence/odbior-zywo-20260905/05-ocena/drd-macierz-oceny.png`):
 * zakładka „Macierz" warsztatu DRD rysowała już macierz właściciela, ale BEZ
 * OTOCZKI z obrazu zatwierdzonego
 * (`evidence/grafika/132-noc-wywiad-ocena/drd-macierz-oceny__PRZED__light.png`):
 * bez nagłówka „Mapa rozwoju cyfrowego / <oś> / Macierz oceny digitalizacji
 * procesów", bez przełącznika AS-IS/TO-BE i pola „Przestronny", bez przycisku
 * „Pełny ekran" i bez paska czterech kafli (Śr. poziom obecny / Śr. poziom
 * docelowy / Śr. luka / Ocenione obszary).
 *
 * Test celuje w OTOCZKĘ, nie w siatkę (siatkę pilnuje `macierz-sedno-20260905`).
 * Usunięcie któregokolwiek z tych elementów wywraca ten plik.
 */
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { DrdOwnerMatrixPanel } from '../../../src/components/assessment/drd/DrdOwnerMatrixPanel';
import type { MatrixCellState, MatrixRow } from '../../../src/components/method-workspace/types';

function komorka(unitId: string, level: number, osiagniety: boolean, cel: boolean): MatrixCellState {
  return {
    unitId,
    level,
    achieved: osiagniety,
    proposed: false,
    target: cel,
    answerState: 'unresolved',
    evidenceState: 'none',
    aiProposalPending: false,
    reviewRequired: false,
    blocker: false,
  } as MatrixCellState;
}

/** Jeden obszar osi 1 oceniony (AS 2, TO 5) — reszta osi nietknięta. */
const WIERSZE: readonly MatrixRow[] = [
  {
    unitId: '1A',
    unitName: 'Procesy Sprzedaży',
    levels: Array.from({ length: 7 }, (_, i) => komorka('1A', i + 1, i + 1 <= 2, i + 1 === 5)),
  },
];

describe('05-ocena · drd-macierz-oceny — macierz dostaje otoczkę z obrazu', () => {
  it('rysuje nagłówek, AS-IS/TO-BE, „Przestronny", „Pełny ekran" i cztery kafle', () => {
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

    // nagłówek: nadtytuł metodyki + numer i POLSKA nazwa osi + podtytuł
    // W jsdom i18next nie ma wczytanych tłumaczeń, więc `t()` zwraca wartość
    // domyślną (angielską) — sprawdzamy OBIE formy tego samego napisu, bo
    // przedmiotem testu jest OBECNOŚĆ bloku, nie język runtime'u.
    expect(screen.getByText(/Mapa rozwoju cyfrowego|Digital Development Map/i)).toBeInTheDocument();
    expect(screen.getByText(/1\.\s*Procesy Cyfrowe/)).toBeInTheDocument();
    expect(
      screen.getByText(/Macierz oceny digitalizacji procesów|Process Digitalization Assessment Matrix/i)
    ).toBeInTheDocument();

    // legenda + gęstość + pełny ekran
    expect(screen.getByText('AS-IS')).toBeInTheDocument();
    expect(screen.getByText('TO-BE')).toBeInTheDocument();
    expect(screen.getByText(/^(Przestronny|Spacious)$/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Pełny ekran|Full screen/i })
    ).toBeInTheDocument();

    // pasek czterech kafli — z podpisami, nie z samymi liczbami
    const kafle = screen.getByTestId('drd-matrix-summary');
    expect(within(kafle).getByText(/^(Śr. poziom obecny|Avg\. Current Level)$/)).toBeInTheDocument();
    expect(within(kafle).getByText(/^(Śr. poziom docelowy|Avg\. Target Level)$/)).toBeInTheDocument();
    expect(within(kafle).getByText(/^(Śr. luka|Avg\. Gap)$/)).toBeInTheDocument();
    expect(within(kafle).getByText(/^(Ocenione obszary|Areas Assessed)$/)).toBeInTheDocument();
    // liczone z tych samych danych co siatka: 1 obszar oceniony z 9 w osi 1,
    // AS 2 / TO 5 -> luka 3.0. Nietknięte obszary NIE wchodzą do średniej.
    expect(within(kafle).getByText('1/9')).toBeInTheDocument();
    expect(within(kafle).getByText('2.0')).toBeInTheDocument();
    expect(within(kafle).getByText('5.0')).toBeInTheDocument();
    expect(within(kafle).getByText('3.0')).toBeInTheDocument();
  });
});
