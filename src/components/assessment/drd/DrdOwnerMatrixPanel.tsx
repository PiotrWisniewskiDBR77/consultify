/**
 * DrdOwnerMatrixPanel — zakładka „Macierz" sesji DRD rysowana MACIERZĄ
 * WŁAŚCICIELA, a nie tabelką `LiveMatrix`.
 *
 * ★ PO CO TEN PLIK ISTNIEJE (zgłoszenie 2026-09-05, po raz szósty w tej
 * sprawie): „koniecznie chcę moją macierz — to jest sedno tej aplikacji".
 * Zmierzone na żywo tego samego dnia
 * (`evidence/odbior-zywo-20260905/05-ocena/drd-macierz-oceny.png`): zakładka
 * „Macierz" w sesji DRD pokazywała `LiveMatrix` — wiersze = jednostki,
 * kolumny L1–L7 jako siedem kwadracików z numerem, plus kolumna tekstowa
 * „Current · Target · Gap". Nie ma tam ANI JEDNEJ rzeczy, po której właściciel
 * poznaje swoją macierz: drabiny poziomów po lewej, treści merytorycznej
 * w komórce, dolnego paska obszarów z chipami `AS`/`TO`.
 *
 * ★ TO NIE BYŁA FLAGA. Sprawdzone w kodzie, nie w opisie:
 * `shouldMountDrdMethodWorkspace('drd', false) === true`
 * (`src/views/AssessmentSessionEditorView.tsx`, dowód w
 * `drdMethodWorkspaceGating.test.tsx`) — warsztat metody montuje się dla DRD
 * NIEZALEŻNIE od `drdMethodWorkspaceSliceV1`. Nie było więc przełącznika,
 * którym dałoby się „przywrócić" macierz właściciela; jedyną drogą było
 * narysowanie jej w tej zakładce. Dlatego zmiana nie chowa się za flagą.
 *
 * ★ EKSPORT, NIE KOPIA. Rysuje `DRDMatrixGrid` — dokładnie ten komponent,
 * który stoi w edytorze, w raporcie z oceny i na slajdzie prezentacji.
 * Kopii tej macierzy jest w repo już kilka (`AreaMatrixTable`,
 * `EmbeddedMatrix`, `DRDMatrixSession`) i to one są przyczyną kolejnych pudeł
 * (`DZIENNIK_GRAFIKA.md` Z-12). Siódma kopia byłaby powtórzeniem błędu.
 *
 * ★ CO ZNACZY „TRYB EDYCJI" W TEJ ZAKŁADCE. Klik w komórkę robi to samo, co
 * robił w `LiveMatrix`: wybiera komórkę i otwiera panel szczegółów dostarczony
 * przez ekran sesji (`renderSideSheet`) — czyli miejsce, z którego prowadzi
 * się rozmowę o tym poziomie. Macierz w warsztacie nie ustawia poziomu
 * „na skróty", bo poziom w tym warsztacie wynika z odpowiedzi zapisanych
 * w magazynie zdarzeń, a nie z kliknięcia w kratkę — to celowa różnica wobec
 * starego edytora i jedyna, jaka tu została.
 */
import { X } from 'lucide-react';
import React, { useEffect } from 'react';

import { DRDMatrixGrid } from './DRDAssessmentEditor';
import { drdOdpowiedziZOutputu } from './DRDMatrixReadOnly';

import type { MatrixCellState, MatrixRow, MatrixSelection } from '@/components/method-workspace/types';
import { DRD_STRUCTURE } from '@/services/drdStructure';

export interface DrdOwnerMatrixPanelProps {
  /** Numer osi metodyki (1..7) — ta, którą warsztat ma otwartą. */
  readonly axisNumber: number;
  readonly rows: readonly MatrixRow[];
  readonly selection: MatrixSelection | null;
  readonly onSelect: (selection: MatrixSelection) => void;
  readonly onCloseSideSheet: () => void;
  readonly renderSideSheet: (
    selection: MatrixSelection,
    cell: MatrixCellState | null
  ) => React.ReactNode;
  readonly className?: string;
}

/** Polska odmiana: 1 kolumna · 2-4 kolumny · 5+ kolumn (z wyjątkiem 12-14). */
function polskaOdmianaKolumn(n: number): string {
  if (n === 1) return 'kolumna';
  const dziesiatki = n % 100;
  const jednosci = n % 10;
  if (jednosci >= 2 && jednosci <= 4 && !(dziesiatki >= 12 && dziesiatki <= 14)) return 'kolumny';
  return 'kolumn';
}

/**
 * Stan macierzy warsztatu → stan, którego oczekuje siatka właściciela.
 *
 * Żadnej nowej liczby: `current` = szczyt potwierdzonej rampy (najwyższy
 * poziom z `achieved`), `target` = poziom oznaczony flagą `target`. Jednostka,
 * której nikt jeszcze nie dotknął, NIE dostaje wpisu — siatka pokaże ją jako
 * kolumnę nieocenioną, a nie jako zmierzone zero. Przeliczenie idzie przez
 * `drdOdpowiedziZOutputu`, czyli tę samą funkcję, której używa raport
 * i prezentacja — jedno miejsce, w którym „poziom" zamienia się w „wypełnienie".
 */
export function drdOdpowiedziZWierszyMacierzy(rows: readonly MatrixRow[]) {
  const obecne: Record<string, number | null> = {};
  const docelowe: Record<string, number | null> = {};
  for (const row of rows) {
    const osiagniete = row.levels.filter((c) => c.achieved).map((c) => c.level);
    obecne[row.unitId] = osiagniete.length > 0 ? Math.max(...osiagniete) : null;
    docelowe[row.unitId] = row.levels.find((c) => c.target)?.level ?? null;
  }
  return drdOdpowiedziZOutputu(
    rows.map((r) => r.unitId),
    obecne,
    docelowe
  );
}

export const DrdOwnerMatrixPanel: React.FC<DrdOwnerMatrixPanelProps> = ({
  axisNumber,
  rows,
  selection,
  onSelect,
  onCloseSideSheet,
  renderSideSheet,
  className = '',
}) => {
  const axis = DRD_STRUCTURE.find((a) => a.id === axisNumber);
  const value = React.useMemo(() => drdOdpowiedziZWierszyMacierzy(rows), [rows]);
  const selectedCell =
    selection != null
      ? (rows.find((r) => r.unitId === selection.unitId)?.levels.find(
          (c) => c.level === selection.level
        ) ?? null)
      : null;

  // Esc zamyka panel szczegółów — zachowanie 1:1 z `LiveMatrix`, żeby zmiana
  // rysunku nie zabrała nikomu skrótu, którego się nauczył.
  useEffect(() => {
    if (!selection) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseSideSheet();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selection, onCloseSideSheet]);

  if (!axis) {
    // Bez zgadywania: nie rysujemy siatki udającej macierz osi, której
    // w metodyce nie ma.
    return (
      <p className="text-sm text-c-text-secondary">
        Macierzy tej osi nie da się narysować: struktura osi {axisNumber} nie występuje w metodyce
        tej sesji.
      </p>
    );
  }

  return (
    <div data-testid="drd-owner-matrix" className={`flex min-h-0 flex-col ${className}`}>
      <DRDMatrixGrid
        areas={axis.areas}
        levelCount={axis.levelCount}
        value={value}
        compact
        columnMinPx={150}
        rowHint="Kliknij komórkę, by otworzyć szczegóły poziomu"
        selectedCell={
          selection ? { areaId: selection.unitId, level: selection.level } : null
        }
        onCellClick={(areaId, level) => onSelect({ unitId: areaId, level })}
        onAreaClick={(areaId) => onSelect({ unitId: areaId, level: 1 })}
        areaStripLabel="Area"
        overflowHint={(n) => `Jeszcze ${n} ${polskaOdmianaKolumn(n)} po prawej — przewiń w bok.`}
      />

      {selection && (
        <div
          role="dialog"
          aria-label={`Szczegóły komórki: ${selection.unitId}, poziom ${selection.level}`}
          data-testid="matrix-side-sheet"
          className="mt-2 rounded-xl border border-c-border bg-c-surface p-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-c-text">
              {selection.unitId} · Poziom {selection.level}
            </p>
            <button
              type="button"
              onClick={onCloseSideSheet}
              aria-label="Zamknij szczegóły komórki"
              className="rounded p-1 text-c-text-muted hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              <X size={14} />
            </button>
          </div>
          {renderSideSheet(selection, selectedCell)}
        </div>
      )}
    </div>
  );
};

export default DrdOwnerMatrixPanel;
