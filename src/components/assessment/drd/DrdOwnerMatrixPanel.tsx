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
import { Maximize2, X } from 'lucide-react';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import {
  DRDMatrixFullscreenShell,
  DRDMatrixGrid,
  DRDMatrixHeaderBlock,
  DRDMatrixLegend,
  DRDMatrixSummaryStrip,
  usePodpisUkrytychKolumn,
} from './DRDAssessmentEditor';
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
  const { t } = useTranslation();
  const podpisUkrytychKolumn = usePodpisUkrytychKolumn();
  /**
   * „Przestronny" i „Pełny ekran" żyją TU, a nie w ekranie sesji: to ustawienia
   * oglądania macierzy, nie stan warsztatu. Domyślnie gęsto — zakładka dostaje
   * ~700 px wysokości i przy `spacious` dolny pasek obszarów wypada z kadru.
   */
  const [compact, setCompact] = React.useState(true);
  const [pelnyEkran, setPelnyEkran] = React.useState(false);
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

  const nazwaOsi = axis.namePL ?? axis.name;

  /**
   * Siatka + otoczka. `siatka(fill)` jest jedną definicją używaną w zakładce
   * i w nakładce pełnoekranowej — różnica to szerokość kolumn i to, czy siatka
   * ma wypełniać wysokość (w zakładce tak, bo kafle muszą zostać w kadrze;
   * na pełnym ekranie nie, bo tam przewija się cała nakładka).
   */
  const siatka = (opcje: { readonly kolumnaPx: number; readonly wypelnijWysokosc: boolean }) => (
      <DRDMatrixGrid
        areas={axis.areas}
        levelCount={axis.levelCount}
        value={value}
        compact={compact}
        columnMinPx={opcje.kolumnaPx}
        /* Krótko: ta podpowiedź powtarza się w KAŻDYM wierszu, więc każde
           dodatkowe słowo kosztuje siedem linijek wysokości i wypycha z kadru
           dolny pasek obszarów z chipami AS/TO — czyli dokładnie to, po czym
           właściciel poznaje swoją macierz. */
        rowHint="Kliknij komórkę"
        /* Siatka wypełnia wysokość zakładki i przewija się w środku, dzięki
           czemu `sticky bottom-0` paska obszarów faktycznie działa. */
        fillHeight={opcje.wypelnijWysokosc}
        selectedCell={
          selection ? { areaId: selection.unitId, level: selection.level } : null
        }
        onCellClick={(areaId, level) => onSelect({ unitId: areaId, level })}
        onAreaClick={(areaId) => onSelect({ unitId: areaId, level: 1 })}
        areaStripLabel={t('drd.matrix.areaStrip', 'Area')}
        overflowHint={podpisUkrytychKolumn}
      />
  );

  const legenda = <DRDMatrixLegend compact={compact} onCompactChange={setCompact} />;

  return (
    /* Zakładka przewija się W CAŁOŚCI (kontener `MethodWorkspaceShell` ma
       `overflow-auto`), a NIE tylko siatka w środku. Powód zmierzony na zrzucie
       05.09: przy sztywnej wysokości (`h-full` + `fillHeight`) na otoczkę
       schodziło ~200 px i przyklejony pasek obszarów nachodził na wiersz „2.",
       czyli macierz znów była ucinana — dokładnie zarzut właściciela. Obraz
       zatwierdzony pokazuje macierz W CAŁOŚCI, a kafle pod nią (poniżej
       pierwszego ekranu). */
    <div data-testid="drd-owner-matrix" className={`flex min-h-0 flex-col ${className}`}>
      <DRDMatrixHeaderBlock
        axisId={axis.id}
        axisName={nazwaOsi}
        right={
          <>
            {legenda}
            <button
              type="button"
              onClick={() => setPelnyEkran(true)}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-c-border bg-c-surface-subtle text-c-text text-xs font-semibold hover:bg-c-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              title={t('drd.matrix.openFullscreenTitle', 'Open matrix in full screen')}
            >
              <Maximize2 className="w-4 h-4" />
              {t('drd.matrix.fullscreen', 'Full screen')}
            </button>
          </>
        }
      />

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {siatka({ kolumnaPx: 150, wypelnijWysokosc: false })}
      </div>

      <DRDMatrixSummaryStrip areas={axis.areas} levelCount={axis.levelCount} value={value} />

      {pelnyEkran && (
        <DRDMatrixFullscreenShell onClose={() => setPelnyEkran(false)}>
          <div className="rounded-2xl border border-c-border bg-c-surface p-6">
            <DRDMatrixHeaderBlock axisId={axis.id} axisName={nazwaOsi} large right={legenda} />
            {siatka({ kolumnaPx: 180, wypelnijWysokosc: false })}
            <DRDMatrixSummaryStrip
              areas={axis.areas}
              levelCount={axis.levelCount}
              value={value}
              large
            />
          </div>
        </DRDMatrixFullscreenShell>
      )}

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
