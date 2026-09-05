import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Grid2X2,
  HelpCircle,
  Link2,
  List,
  Maximize2,
  Menu,
  MessageSquare,
  Paperclip,
  Sparkles,
  Target,
  User,
  X,
} from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AssessmentToolShell } from '@/components/assessment/AssessmentToolShell';
import {
  czyTerminToPlaceholder,
  etykietaObszaru,
  etykietyPoziomowZMetodyki,
  minimumKolumnyMacierzy,
  skrocTerminDoKomorki,
} from '@/components/assessment/drd/drdMatrixCellContent';
import { LevelAttachments } from '@/components/assessment/LevelAttachments';
import { GlossaryPanel } from '@/components/assessment/panels/GlossaryPanel';
import { Tooltip } from '@/components/ui/primitives';
import { getAssessmentGuidanceLive } from '@/services/assessmentKnowledge/assessmentGuidanceRuntime';
import type { AssessmentGuidanceOutput } from '@/services/assessmentKnowledge/assessmentGuidanceService';
import { getDRDKnowledge } from '@/services/assessmentKnowledge/drdKnowledge';
import { getDRDAxisWhyHint } from '@/services/assessmentKnowledge/whyThisMatters';
import {
  DRD_AXIS_KEY_MAP,
  DRD_STRUCTURE,
  DRDArea,
  DRDAxis,
  DRDLevel,
} from '@/services/drdStructure';

type AreaState = {
  achievedLevel: number; // 0..levelCount
  targetLevel?: number;
  levelNotes?: Record<string, string>; // levelNumber -> note
  levelLinks?: Record<string, string[]>; // levelNumber -> list of URLs
  // Enterprise-friendly: explicit decision when left "transparent" on purpose.
  // Missing key => not assessed yet (also transparent).
  levelDecisions?: Record<string, 'skip'>; // levelNumber -> 'skip'
};

export type DRDEditorAnswers = {
  areas?: Record<string, AreaState>;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function getAxisKey(axisId: number): string {
  return DRD_AXIS_KEY_MAP[axisId] || 'processes';
}

function getAreaState(
  answers: DRDEditorAnswers | undefined,
  areaId: string,
  levelCount: number
): AreaState {
  const s = answers?.areas?.[areaId];
  if (!s) return { achievedLevel: 0, levelNotes: {} };
  return {
    achievedLevel: clamp(Number(s.achievedLevel || 0), 0, levelCount),
    targetLevel: s.targetLevel ? clamp(Number(s.targetLevel), 1, levelCount) : undefined,
    levelNotes: s.levelNotes || {},
    levelLinks: (s as any).levelLinks || {},
    levelDecisions: (s as any).levelDecisions || {},
  };
}

function setAreaState(
  answers: DRDEditorAnswers | undefined,
  areaId: string,
  next: AreaState
): DRDEditorAnswers {
  return {
    ...(answers || {}),
    areas: {
      ...(answers?.areas || {}),
      [areaId]: next,
    },
  };
}

/* ==========================================================================
 * MACIERZ — JEDNA IMPLEMENTACJA SIATKI (widok zwykły + pełnoekranowy)
 * --------------------------------------------------------------------------
 * Do 2026-08-30 siatka macierzy istniała w tym pliku DWA RAZY: raz w widoku
 * zwykłym, raz w nakładce pełnoekranowej. Kopie zdążyły się rozjechać
 * (minmax(150px) vs minmax(180px), inny podpis wiersza, inne rozmiary kafli
 * liczbowych) — audyt `docs/program/grafika/MACIERZ_DRD_AUDYT.md` §C10.
 * Skutek: każda poprawka wizualna musiała być robiona dwa razy.
 *
 * Teraz jest jedna siatka. RÓŻNICE CELOWE zostały jako PARAMETRY:
 *   - `columnMinPx`   — pełny ekran ma więcej miejsca, więc szersze kolumny,
 *   - `rowHint`       — widok zwykły ma podpowiedź o najeździe, pełny ekran nie
 *                       (w pełnym ekranie nie ma dymka najazdowego),
 *   - `selectedCell` / `dimOthers` — popover żyje tylko w widoku zwykłym,
 *   - `onCellMouseEnter/Leave` — dymek najazdowy tylko w widoku zwykłym.
 * ========================================================================== */

/** Gęstość siatki — przełącznik „Spacious" MUSI być odczuwalny (audyt §B3). */
const MATRIX_DENSITY = {
  compact: {
    gap: 'gap-2',
    cellPadding: 'p-2',
    cellMinHeight: 'min-h-[40px]',
    rowLabelPadding: 'p-3',
  },
  spacious: {
    gap: 'gap-2',
    cellPadding: 'p-3',
    cellMinHeight: 'min-h-[60px]',
    rowLabelPadding: 'p-4',
  },
  /** Slajd raportu — patrz `fillHeight` w `DRDMatrixGridProps`. */
  report: {
    gap: 'gap-2',
    cellPadding: 'p-2',
    cellMinHeight: 'min-h-[34px]',
    rowLabelPadding: 'p-3',
  },
} as const;

/**
 * Kolory komórek — JEDNO źródło dla siatki I dla legendy (audyt §B2: legenda
 * pokazywała kolory, których w komórkach nie ma). Oba motywy: do 2026-08-30
 * siatka miała wymuszone `className="dark"` i była ciemną wyspą w jasnej
 * karcie (audyt §B1).
 */
const MATRIX_FILL_ACHIEVED =
  'border-slate-500 bg-slate-300 dark:border-slate-400/50 dark:bg-slate-500/25';
const MATRIX_FILL_TARGET =
  'border-blue-500 bg-blue-100 dark:border-blue-400/40 dark:bg-blue-500/15';
const MATRIX_FILL_IDLE = 'border-c-border bg-c-surface dark:border-white/10 dark:bg-white/[0.03]';

const MATRIX_TEXT_ACHIEVED = 'text-slate-900 dark:text-white';
const MATRIX_TEXT_TARGET = 'text-blue-900 dark:text-blue-100';
/** Nieoceniona komórka miała 2,42:1 (audyt §A3) — całe kolumny znikały. */
const MATRIX_TEXT_IDLE = 'text-slate-600 dark:text-slate-400';

type MatrixCellRef = { areaId: string; level: number };

/**
 * ★ EKSPORTOWANE od 2026-09-01 (dyżur „macierz DRD w raporcie").
 *
 * Właściciel po raz trzeci zgłosił: „Ciągle nie wiem dlaczego nie używasz
 * mojej macierzy DRD". Prezentacja z oceny rysowała `AreaMatrixTable` —
 * komponent, który właściciel odrzucił wprost (`DZIENNIK_GRAFIKA.md` Z-10:
 * „to nie tak ma wyglądać") i który pokazuje PUSTE komórki z kropką zamiast
 * treści merytorycznej. Ta siatka jest tą, którą właściciel zaakceptował na
 * ekranie `drd-macierz-oceny` (`status.json`: „Macierz oceny DRD — obszary
 * x poziomy" — dokładnie te słowa, którymi wskazał ją 01.09).
 *
 * Eksport, a NIE kopia: kopii tej macierzy w repo jest już kilka
 * (`AreaMatrixTable`, `EmbeddedMatrix`, `DRDMatrixSession`) i to one są
 * przyczyną trzech pudeł w tej sprawie. Jedna siatka, dwa miejsca użycia.
 */
export type DRDMatrixGridProps = {
  areas: DRDArea[];
  levelCount: number;
  value: DRDEditorAnswers | undefined;
  /** false = „Spacious" włączony */
  compact: boolean;
  /** różnica celowa: pełny ekran ma więcej miejsca */
  columnMinPx: number;
  /** różnica celowa: podpowiedź pod etykietą wiersza (pełny ekran nie ma dymka) */
  rowHint: string;
  /** komórka z otwartym popoverem (tylko widok zwykły) */
  selectedCell?: MatrixCellRef | null;
  onCellClick: (areaId: string, level: number, e: React.MouseEvent<HTMLButtonElement>) => void;
  onCellMouseEnter?: (
    areaId: string,
    level: number,
    e: React.MouseEvent<HTMLButtonElement>
  ) => void;
  onCellMouseLeave?: () => void;
  onAreaClick: (areaId: string) => void;
  /** etykiety własne ekranu — zostają po angielsku do decyzji właściciela */
  areaStripLabel: string;
  overflowHint: (ukryte: number) => string;
  /**
   * `true` = siatka wypełnia wysokość rodzica i przewija się PIONOWO w środku,
   * zamiast rosnąć w nieskończoność. Domyślnie `false` — oba widoki edytora
   * zachowują się dokładnie jak dotąd.
   *
   * POWÓD (dyżur 2026-09-01): na slajdzie raportu siatka jest wyższa od kadru,
   * więc dolny pasek „Area" z chipami `AS n` / `TO n` był PRZYCINANY — znikał
   * dokładnie ten element, o który właściciel się upomina („dwa znaczniki
   * naraz"). `sticky bottom-0` paska działa dopiero wtedy, gdy przewijanie
   * pionowe dzieje się WEWNĄTRZ tego kontenera, a nie nad nim.
   */
  fillHeight?: boolean;
};

export const DRDMatrixGrid: React.FC<DRDMatrixGridProps> = ({
  areas,
  levelCount,
  value,
  compact,
  columnMinPx,
  rowHint,
  selectedCell = null,
  onCellClick,
  onCellMouseEnter,
  onCellMouseLeave,
  onAreaClick,
  areaStripLabel,
  overflowHint,
  fillHeight = false,
}) => {
  /**
   * `fillHeight` = slajd raportu: kadr ma stałe 900 px i musi zmieścić WSZYSTKIE
   * wiersze osi razem z dolnym paskiem obszarów. Zmierzone: przy gęstości
   * `compact` (40 px na komórkę) oś siedmiopoziomowa przekracza kadr o ~50 px
   * i pasek „Area" nachodzi na poziom 1. Jedyna różnica to wysokość komórki —
   * padding, odstępy i kolory zostają te same, żeby slajd był tą samą macierzą,
   * którą właściciel zaakceptował, a nie jej wariantem.
   */
  const density =
    fillHeight && compact
      ? MATRIX_DENSITY.report
      : compact
        ? MATRIX_DENSITY.compact
        : MATRIX_DENSITY.spacious;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [hiddenPx, setHiddenPx] = useState(0);
  /** Zmierzona szerokość kadru siatki (0 = jeszcze nie mierzone / brak DOM-u). */
  const [kadrPx, setKadrPx] = useState(0);

  /**
   * SZEROKOŚĆ — dlaczego siatka LICZY, a nie ma zaszytych liczb (2026-09-05).
   *
   * Do dziś kolumny miały stałe minimum (92 px przy 9 obszarach) i stałą
   * kolumnę etykiet 240 px. W edytorze to się mieściło, ale w raporcie z oceny
   * ta sama siatka dostaje kadr ~500 px (macierz siedzi w dokumencie, który
   * dzieli 1440 px z: szyną aplikacji 64 px, drzewem sesji 240 px, szyną
   * rozdziałów raportu ~140 px i prawym panelem artefaktu ~320 px). Zmierzone
   * na żywo 05.09: kadr 503 px, widoczne 2–3 kolumny z 9, pod spodem napis
   * „Jeszcze 7 kolumn po prawej". Właściciel zobaczył ćwiartkę swojej macierzy.
   *
   * Teraz minimum kolumny jest WYLICZANE z faktycznego kadru: jeśli 9 kolumn
   * się nie mieści przy minimum bazowym, kolumny zwężają się aż do progu
   * czytelności `MIN_CZYTELNA_KOLUMNA_PX`. Przewijanie w bok zostaje wyłącznie
   * jako zabezpieczenie dla kadru węższego niż ten próg — nie jest domyślnym
   * sposobem oglądania macierzy.
   *
   * Kolumna etykiet też jest dwustanowa: 240 px czyta się dobrze przy 5
   * obszarach, ale przy 9 zjada jedną trzecią kadru raportu. Etykieta
   * „1. Basic Data Registration" mieści się w 150 px w dwóch wierszach.
   */
  const labelColumnPx = areas.length >= 8 ? 150 : 240;
  const gapPx = areas.length >= 8 ? 4 : 8;
  const gapClass = areas.length >= 8 ? 'gap-1' : density.gap;

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => {
      setHiddenPx(Math.max(0, el.scrollWidth - el.clientWidth));
      setKadrPx(el.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [areas.length, levelCount, compact, columnMinPx]);

  const effectiveColumnMinPx = React.useMemo(
    () =>
      minimumKolumnyMacierzy({
        kadrPx,
        liczbaObszarow: areas.length,
        labelColumnPx,
        gapPx,
        columnMinPx,
      }),
    [kadrPx, areas.length, labelColumnPx, gapPx, columnMinPx]
  );

  const hiddenColumns =
    hiddenPx > 0 ? Math.max(1, Math.ceil(hiddenPx / (effectiveColumnMinPx + gapPx))) : 0;

  /**
   * Kolumna poniżej 80 px: oddajemy treści padding, którego przy 150 px nikt
   * nie zauważa, a przy 74 px decyduje o tym, czy „Management" zmieści się
   * w jednej linii, czy zostanie przełamane na „Managem / ent". Zmierzone
   * w kadrze raportu: 74 px kolumny minus p-2 (16) minus px-1 (8) = 50 px na
   * tekst, czyli o kilka pikseli za mało na najdłuższe terminy z nakładek.
   */
  const waskieKolumny = effectiveColumnMinPx < 80;
  const cellPadding = waskieKolumny ? 'p-1' : density.cellPadding;
  const cellInnerPadding = waskieKolumny ? 'px-0.5' : 'px-1';

  const levelLabels = React.useMemo(
    () => etykietyPoziomowZMetodyki(areas, levelCount),
    [areas, levelCount]
  );

  return (
    <div className={fillHeight ? 'flex min-h-0 flex-1 flex-col' : 'mt-6'}>
      <div className={`relative${fillHeight ? ' flex min-h-0 flex-1 flex-col' : ''}`}>
        <div
          ref={scrollerRef}
          className={`app-table-scrollbar overflow-x-auto pb-2 rounded-xl border border-c-border bg-c-surface-subtle dark:border-white/10 dark:bg-navy-950 p-2${
            fillHeight ? ' min-h-0 flex-1 overflow-y-auto' : ''
          }`}
        >
          <div
            className={`grid ${gapClass}`}
            style={{
              gridTemplateColumns: `${labelColumnPx}px repeat(${areas.length}, minmax(${effectiveColumnMinPx}px, 1fr))`,
            }}
          >
            {/* Wiersze poziomów (najwyższy u góry — logika pracy, nie ruszać) */}
            {Array.from({ length: levelCount }, (_, i) => levelCount - i).map((level) => {
              const label = levelLabels[level] || '';

              return (
                <React.Fragment key={`row-${level}`}>
                  {/* Etykieta wiersza */}
                  <div
                    /* `overflow-hidden` + `break-words`: przy wąskiej kolumnie
                       etykiet długie słowo („Registration") wystawało poza swój
                       tor i podbijało `scrollWidth` całej siatki — czyli
                       włączało pasek przewijania, choć TORY mieściły się co do
                       piksela. Zmierzone: tory 854 px, scrollWidth 874 px. */
                    className={`sticky left-0 z-10 overflow-hidden break-words rounded-xl border border-c-border bg-c-surface dark:border-white/10 dark:bg-gradient-to-r dark:from-navy-800/60 dark:to-navy-950 ${density.rowLabelPadding}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold text-c-text">
                        <span className="text-c-text-secondary">{level}.</span>
                        {label ? ` ${label}` : ''}
                      </div>
                    </div>
                    {/* Pusta podpowiedź NIE rezerwuje wysokości: slajd raportu
                        podaje `rowHint=""` (raport się ogląda, nie klika),
                        a pusty `div` kosztował ~19 px na wiersz i wypychał
                        dolny pasek obszarów z kadru. */}
                    {rowHint ? (
                      <div className="mt-1 text-[11px] text-c-text-muted">{rowHint}</div>
                    ) : null}
                  </div>

                  {/* Komórki */}
                  {areas.map((area) => {
                    const s = getAreaState(value, area.id, levelCount);
                    const achieved = s.achievedLevel || 0;
                    const target = s.targetLevel || 0;

                    const isAchieved = level <= achieved;
                    const isTarget = target > 0 && level <= target && !isAchieved;

                    const areaLevelInfo = area.levels?.find((l) => l.level === level);
                    const knowledge = getDRDKnowledge(area.id, level);
                    const techs = knowledge?.suggestedTechnologies || [];

                    const isSelected =
                      selectedCell?.areaId === area.id && selectedCell?.level === level;
                    const hasActivePopup = selectedCell !== null;

                    const fill = isAchieved
                      ? `${MATRIX_FILL_ACHIEVED} hover:bg-slate-400 dark:hover:bg-slate-500/35`
                      : isTarget
                        ? `${MATRIX_FILL_TARGET} hover:bg-blue-200 dark:hover:bg-blue-500/25`
                        : `${MATRIX_FILL_IDLE} hover:bg-c-surface-hover dark:hover:bg-white/[0.07]`;

                    /**
                     * TREŚĆ KOMÓRKI — docs/program/grafika/MACIERZ_TRESC_KOMOREK.md §4.3.
                     *
                     * Komórka niesie JEDEN termin: wiodącą technologię tego
                     * obszaru na tym poziomie, czyli `suggestedTechnologies[0]`
                     * — pozycję, na którą nakładki wiedzy konsekwentnie wstawiają
                     * termin z książki. Nazwa poziomu NIE może tu stać: wszystkie
                     * obszary osi 1 mają te same 7 nazw, więc dałaby dziewięć
                     * identycznych kolumn (tak wyglądały 1C i 1I do 2026-08-31).
                     * Nazwa poziomu jest teraz etykietą wiersza, reszta listy
                     * technologii i pełny opis zostają w popoverze.
                     *
                     * Dwóch terminów nie łączymy: kropka `·` czytała się jak „i"
                     * i sugerowała parę, której książka nie stawia.
                     */
                    const surowyTech = techs[0]?.trim() || '';
                    const leadTech = czyTerminToPlaceholder(surowyTech) ? '' : surowyTech;
                    const fullTitle = areaLevelInfo?.title || '';
                    // Fallback bez `slice(0, 3)` — urywał tytuł na spójniku
                    // („Centralized Data &", „AI as a" — audyt §B4).
                    const displayContent = leadTech
                      ? skrocTerminDoKomorki(leadTech)
                      : fullTitle || '—';
                    const fullContent = leadTech
                      ? fullTitle
                        ? `${leadTech} — ${fullTitle}`
                        : leadTech
                      : fullTitle;

                    return (
                      <button
                        key={`${area.id}-${level}`}
                        type="button"
                        /* Uchwyty pomiarowe: bez nich test „która komórka"
                           musiałby celować w treść komórki, a treść komórki
                           jest właśnie tym, co ta macierz zmienia. */
                        data-testid="drd-matrix-cell"
                        data-area-id={area.id}
                        data-level={level}
                        aria-pressed={isSelected}
                        /*
                          Natywny dymek TYLKO tam, gdzie NIE ma własnego dymka
                          najazdowego (pełny ekran). W widoku zwykłym własny
                          dymek już pokazuje pełny tytuł — dwa dymki naraz to
                          szum, nie pomoc.
                        */
                        title={onCellMouseEnter ? undefined : fullContent || undefined}
                        className={`group relative overflow-hidden rounded-lg border transition-all duration-200 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                          density.cellPadding
                        } ${
                          isSelected
                            ? 'border-c-border-strong bg-c-surface-raised ring-2 ring-c-focus scale-[1.02] z-10 dark:border-white/60 dark:bg-white/20 dark:ring-white/30'
                            : hasActivePopup
                              ? `opacity-40 ${fill}`
                              : fill
                        }`}
                        onClick={(e) => onCellClick(area.id, level, e)}
                        onMouseEnter={
                          onCellMouseEnter ? (e) => onCellMouseEnter(area.id, level, e) : undefined
                        }
                        onMouseLeave={onCellMouseLeave}
                        aria-label={`${etykietaObszaru(area)}, level ${level}`}
                      >
                        <div
                          className={`h-full ${density.cellMinHeight} flex items-center justify-center text-center ${cellInnerPadding}`}
                        >
                          <span
                            className={`${
                              waskieKolumny ? 'text-[10px]' : 'text-[11px]'
                            } font-medium leading-tight line-clamp-3 break-words ${
                              isAchieved
                                ? MATRIX_TEXT_ACHIEVED
                                : isTarget
                                  ? MATRIX_TEXT_TARGET
                                  : MATRIX_TEXT_IDLE
                            }`}
                          >
                            {displayContent}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </React.Fragment>
              );
            })}

            {/* Dolny pasek osi X (obszary) — logika pracy: nagłówki NA DOLE */}
            <div className="sticky bottom-0 left-0 z-30 rounded-xl border border-c-border bg-c-surface dark:border-white/10 dark:bg-navy-950 p-2">
              <div className="text-[10px] font-semibold text-c-text-muted uppercase tracking-wider">
                {areaStripLabel}
              </div>
            </div>
            {areas.map((area) => {
              const s = getAreaState(value, area.id, levelCount);
              const achieved = s.achievedLevel || 0;
              const target = s.targetLevel || 0;
              return (
                <button
                  key={`x-${area.id}`}
                  type="button"
                  onClick={() => onAreaClick(area.id)}
                  title={etykietaObszaru(area)}
                  className="sticky bottom-0 z-20 overflow-hidden rounded-xl border border-c-border bg-c-surface hover:bg-c-surface-hover dark:border-white/10 dark:bg-gradient-to-b dark:from-white/10 dark:to-white/[0.06] dark:hover:from-white/[0.14] dark:hover:to-white/[0.08] p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[11px] font-bold text-c-text-secondary">{area.id}</span>
                    <div className="flex items-center gap-1">
                      {achieved > 0 && (
                        <span className="px-1.5 py-0.5 rounded whitespace-nowrap bg-slate-300 text-slate-900 dark:bg-slate-500/30 dark:text-white text-[9px] font-bold">
                          AS {achieved}
                        </span>
                      )}
                      {target > 0 && (
                        <span className="px-1.5 py-0.5 rounded whitespace-nowrap bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200 text-[9px] font-bold">
                          TO {target}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] font-medium text-c-text leading-tight line-clamp-2">
                    {etykietaObszaru(area)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cień krawędziowy — sygnał, że po prawej jest jeszcze treść (audyt §A4) */}
        {hiddenPx > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 bottom-2 w-10 rounded-r-xl bg-gradient-to-l from-c-bg to-transparent"
          />
        )}
      </div>

      {hiddenPx > 0 && (
        <div className="mt-1.5 text-[11px] text-c-text-muted">{overflowHint(hiddenColumns)}</div>
      )}
    </div>
  );
};

/** Legenda — kropki DOKŁADNIE w kolorach komórek (audyt §B2). */
export const DRDMatrixLegend: React.FC<{ compact: boolean; onCompactChange: (v: boolean) => void }> = ({
  compact,
  onCompactChange,
}) => {
  const { t } = useTranslation();
  return (
  <div className="flex flex-col gap-2 text-xs text-c-text-secondary">
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        {/*
          Wypełnienie kropki = DOKŁADNIE wypełnienie komórki (audyt §B2: legenda
          pokazywała kolory, których w siatce nie ma). Obwódka jest MOCNIEJSZA od
          obwódki komórki, bo kropka 14 px na karcie musi być widoczna sama z
          siebie — stara kropka `bg-navy-900` na `dark:bg-navy-950` miała 1,07:1.
        */}
        <span className="h-3.5 w-3.5 rounded-full border-2 bg-slate-300 border-slate-600 dark:bg-slate-500/25 dark:border-slate-300" />
        <span>AS-IS</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="h-3.5 w-3.5 rounded-full border-2 bg-blue-100 border-blue-500 dark:bg-blue-500/15 dark:border-blue-300" />
        <span>TO-BE</span>
      </div>
    </div>
    <div className="flex items-center gap-4 text-[11px] text-c-text-secondary">
      <label className="inline-flex items-center gap-2 select-none">
        <input
          type="checkbox"
          checked={!compact}
          onChange={(e) => onCompactChange(!e.target.checked)}
          className="h-4 w-4 rounded border-c-border accent-slate-600 dark:accent-slate-300 focus:ring-c-focus"
        />
        {t('drd.matrix.spacious', 'Spacious')}
      </label>
    </div>
  </div>
  );
};

/* ==========================================================================
 * OTOCZKA MACIERZY — jeden komplet dla edytora, pełnego ekranu i warsztatu
 * --------------------------------------------------------------------------
 * ★ PO CO (odbiór na żywo 2026-09-05, `drd-macierz-oceny`): zakładka „Macierz"
 * warsztatu DRD rysowała samą siatkę — bez nagłówka „Mapa rozwoju cyfrowego",
 * bez przełącznika AS-IS/TO-BE i „Przestronny", bez „Pełny ekran" i bez
 * czterech kafli podsumowania. Właściciel poznaje swoją macierz PO OTOCZCE,
 * nie po samych kratkach.
 *
 * ★ EKSPORT, NIE SIÓDMA KOPIA. Do dziś nagłówek i pasek kafli istniały w tym
 * pliku DWA RAZY (widok zwykły + nakładka pełnoekranowa) i zdążyły się
 * rozjechać (text-2xl vs text-3xl, text-3xl vs text-4xl w kaflach). Teraz są
 * RAZ, jako komponenty z parametrem `large`, a warsztat je importuje.
 * ========================================================================== */

/**
 * Podpis o kolumnach schowanych poza kadrem — z polską odmianą liczebnika.
 * Bez `count` i18nexta: liczba mnoga w polskim ma trzy formy, a zmiana
 * konfiguracji i18n dla jednego napisu jest droższa niż jawny wybór rzeczownika.
 */
export function usePodpisUkrytychKolumn(): (ukryte: number) => string {
  const { t } = useTranslation();
  return React.useCallback(
    (n: number) => {
      const dziesiatki = n % 100;
      const jednosci = n % 10;
      const noun =
        n === 1
          ? t('drd.matrix.columnNounOne', 'column')
          : jednosci >= 2 && jednosci <= 4 && !(dziesiatki >= 12 && dziesiatki <= 14)
            ? t('drd.matrix.columnNounFew', 'columns')
            : t('drd.matrix.columnNounMany', 'columns');
      return t('drd.matrix.overflowHint', '{{count}} more {{noun}} to the right — scroll to see them', {
        count: n,
        noun,
      });
    },
    [t]
  );
}

/** Nagłówek macierzy: nadtytuł metodyki · numer i nazwa osi · podtytuł · slot po prawej. */
export const DRDMatrixHeaderBlock: React.FC<{
  axisId?: number | string;
  axisName?: string;
  /** `true` = nakładka pełnoekranowa (większy tytuł osi) */
  large?: boolean;
  right?: React.ReactNode;
}> = ({ axisId, axisName, large = false, right }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <div className="text-xs font-semibold tracking-widest uppercase text-slate-500 dark:text-slate-400">
          {t('drd.matrix.title', 'Digital Development Map')}
        </div>
        <div
          className={`mt-1 ${large ? 'text-3xl' : 'text-2xl'} font-bold text-slate-900 dark:text-white`}
        >
          {axisId}. {axisName}
        </div>
        <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">
          {t('drd.matrix.subtitle', 'Process Digitalization Assessment Matrix')}
        </div>
      </div>
      {right ? <div className="flex items-center gap-3">{right}</div> : null}
    </div>
  );
};

/**
 * Pasek czterech kafli pod macierzą. Liczy z TYCH SAMYCH danych co siatka
 * (`getAreaState`), więc kafel nie może pokazać czegoś innego niż kratki nad nim.
 * Obszar nietknięty nie wchodzi do średniej — brak pomiaru to „—", nie zero.
 */
export const DRDMatrixSummaryStrip: React.FC<{
  areas: DRDArea[];
  levelCount: number;
  value: DRDEditorAnswers | undefined;
  large?: boolean;
}> = ({ areas, levelCount, value, large = false }) => {
  const { t } = useTranslation();
  const stats = areas.reduce(
    (acc, area) => {
      const s = getAreaState(value, area.id, levelCount);
      const a = s.achievedLevel || 0;
      const tgt = s.targetLevel || 0;
      if (a > 0) {
        acc.countActual++;
        acc.sumActual += a;
      }
      if (tgt > 0) {
        acc.countTarget++;
        acc.sumTarget += tgt;
      }
      if (a > 0 || tgt > 0) acc.assessed++;
      return acc;
    },
    { sumActual: 0, sumTarget: 0, countActual: 0, countTarget: 0, assessed: 0 }
  );

  const avgActual = stats.countActual > 0 ? (stats.sumActual / stats.countActual).toFixed(1) : '—';
  const avgTarget = stats.countTarget > 0 ? (stats.sumTarget / stats.countTarget).toFixed(1) : '—';
  const avgGap =
    stats.countTarget > 0 && stats.countActual > 0
      ? (Number(avgTarget) - Number(avgActual)).toFixed(1)
      : '—';

  const kafle: ReadonlyArray<{ key: string; wartosc: string; podpis: string }> = [
    { key: 'current', wartosc: avgActual, podpis: t('drd.matrix.avgCurrentLevel', 'Avg. Current Level') },
    { key: 'target', wartosc: avgTarget, podpis: t('drd.matrix.avgTargetLevel', 'Avg. Target Level') },
    { key: 'gap', wartosc: avgGap, podpis: t('drd.matrix.avgGap', 'Avg. Gap') },
    {
      key: 'assessed',
      wartosc: `${stats.assessed}/${areas.length}`,
      podpis: t('drd.matrix.areasAssessed', 'Areas Assessed'),
    },
  ];

  return (
    <div data-testid="drd-matrix-summary" className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
      {kafle.map((kafel) => (
        <div
          key={kafel.key}
          className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4"
        >
          <div
            className={`${large ? 'text-4xl' : 'text-3xl'} font-extrabold text-slate-900 dark:text-white tabular-nums`}
          >
            {kafel.wartosc}
          </div>
          <div className="mt-1 text-xs text-slate-700 dark:text-slate-300">{kafel.podpis}</div>
        </div>
      ))}
    </div>
  );
};

/** Nakładka pełnoekranowa: tło, pasek powrotu, podpowiedź o Esc. Treść z zewnątrz. */
export const DRDMatrixFullscreenShell: React.FC<{
  onClose: () => void;
  children: React.ReactNode;
}> = ({ onClose, children }) => {
  const { t } = useTranslation();
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] bg-slate-100/95 dark:bg-navy-950/95 backdrop-blur-sm">
      <div className="absolute inset-0 overflow-auto p-4 md:p-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white text-sm font-semibold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('drd.matrix.fullscreenBack', 'Back')}
            </button>
            <div className="text-xs text-slate-700 dark:text-slate-300">
              {t('drd.matrix.fullscreenEsc', 'Press Esc to close')}
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};

type Props = {
  assessmentId: string;
  readOnly?: boolean;
  value: DRDEditorAnswers | undefined;
  onChange: (next: DRDEditorAnswers) => void;
  /**
   * Optional override for the LEFT workspace content.
   * When provided, the right navigation panel stays visible unchanged.
   */
  leftOverride?: React.ReactNode;
  /**
   * Called when user switches between Survey/Preview in the right panel.
   * Useful to exit Manage/Logs overlays in the parent.
   */
  onViewModeChange?: (mode: 'surveys' | 'matrix') => void;
  onAxisChange?: (axisId: number) => void;
  currentAxisId?: number;
  onAreaChange?: (areaId: string) => void;
  currentAreaId?: string;
  onLevelChange?: (levelNumber: number) => void;
  currentLevel?: number;
  // Enterprise collaboration helpers
  currentUserId?: string;
  assignmentByAreaId?: Record<
    string,
    { area_id?: string; assigned_user_id?: string; status?: string; due_at?: string | null }
  >;
  onAssignToMe?: (areaId: string) => void;
};

export const DRDAssessmentEditor: React.FC<Props> = ({
  assessmentId,
  readOnly = false,
  value,
  onChange,
  leftOverride,
  onViewModeChange,
  onAxisChange,
  currentAxisId,
  onAreaChange,
  currentAreaId,
  onLevelChange,
  currentLevel,
  currentUserId,
  assignmentByAreaId,
  onAssignToMe,
}) => {
  const { t, i18n } = useTranslation();
  const podpisUkrytychKolumn = usePodpisUkrytychKolumn();
  const isPl = (i18n.language || '').toLowerCase().startsWith('pl');
  const [axisId, setAxisId] = useState<number>(currentAxisId ?? 1);
  const [areaId, setAreaId] = useState<string>(
    currentAreaId ?? DRD_STRUCTURE[0]?.areas?.[0]?.id ?? '1A'
  );
  // Default to Matrix: new primary UX for assessment navigation.
  const [viewMode, setViewMode] = useState<'surveys' | 'matrix'>('matrix');
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [isMatrixFullscreen, setIsMatrixFullscreen] = useState(false);
  const [activeLevel, setActiveLevel] = useState<number>(currentLevel ?? 1);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isExplanationExpanded, setIsExplanationExpanded] = useState(false);
  const [matrixCompact, setMatrixCompact] = useState(true);
  const [activeCardPanel, setActiveCardPanel] = useState<
    'questions' | 'comment' | 'attachments' | 'links' | null
  >(null);
  const [linkDraft, setLinkDraft] = useState('');
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  // Per-question AI guidance (canon-grounded; keyed by "areaId#level").
  const [guidance, setGuidance] = useState<
    Record<string, { loading: boolean; data?: AssessmentGuidanceOutput }>
  >({});

  // Matrix cell popup state
  const [popupCell, setPopupCell] = useState<{ areaId: string; level: number } | null>(null);
  const [popupPosition, setPopupPosition] = useState<{
    top: number;
    left: number;
    arrowPosition: 'top' | 'bottom' | 'left' | 'right';
    arrowOffset: number;
  } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Hover tooltip state (lightweight)
  const [hoverCell, setHoverCell] = useState<{ areaId: string; level: number } | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ top: number; left: number } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with external axis control
  React.useEffect(() => {
    if (currentAxisId !== undefined && currentAxisId !== axisId) {
      setAxisId(currentAxisId);
      // Reset to first area of new axis
      const newAxis = DRD_STRUCTURE.find((a) => a.id === currentAxisId);
      if (newAxis?.areas?.[0]) {
        setAreaId(newAxis.areas[0].id);
        onAreaChange?.(newAxis.areas[0].id);
      }
      // Scroll to top when axis changes externally
      setTimeout(() => {
        levelsContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  }, [currentAxisId, axisId]);

  // Sync with external area control
  React.useEffect(() => {
    if (currentAreaId !== undefined && currentAreaId !== areaId) {
      setAreaId(currentAreaId);
      // If external area points to another axis, align axis selection too.
      const ax = DRD_STRUCTURE.find((a) => a.areas.some((ar) => ar.id === currentAreaId));
      if (ax && ax.id !== axisId) {
        setAxisId(ax.id);
        onAxisChange?.(ax.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAreaId]);

  // Sync with external level control
  React.useEffect(() => {
    if (currentLevel !== undefined && currentLevel !== activeLevel) {
      setActiveLevel(currentLevel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLevel]);

  const levelsContainerRef = React.useRef<HTMLDivElement>(null);

  const handleAxisChange = (newAxisId: number) => {
    setAxisId(newAxisId);
    const newAxis = DRD_STRUCTURE.find((a) => a.id === newAxisId);
    if (newAxis?.areas?.[0]) {
      setAreaId(newAxis.areas[0].id);
      onAreaChange?.(newAxis.areas[0].id);
    }
    onAxisChange?.(newAxisId);
    // Scroll to top when axis changes
    setTimeout(() => {
      levelsContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const setLevel = (lvl: number) => {
    setActiveLevel(lvl);
    onLevelChange?.(lvl);
    setIsDetailsOpen(true);
    setActiveCardPanel(null);
    setLinkDraft('');
    setIsExplanationExpanded(false);
    // Keep navigation snappy: bring the active card into view.
    setTimeout(() => {
      const el = document.getElementById(`drd-level-${lvl}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const axis: DRDAxis | undefined = useMemo(
    () => DRD_STRUCTURE.find((a) => a.id === axisId),
    [axisId]
  );
  const axisAreas = axis?.areas || [];

  const filteredAreas = useMemo(() => axisAreas, [axisAreas]);

  // Ensure currently selected area remains valid when axis changes/search filters out
  React.useEffect(() => {
    if (!axisAreas.some((a) => a.id === areaId)) {
      setAreaId(axisAreas[0]?.id || areaId);
      if (axisAreas[0]?.id) onAreaChange?.(axisAreas[0].id);
    }
  }, [axisId]); // intentionally only axis change

  const selectedArea: DRDArea | undefined = useMemo(() => {
    for (const ax of DRD_STRUCTURE) {
      const found = ax.areas.find((a) => a.id === areaId);
      if (found) return found;
    }
    return undefined;
  }, [areaId]);

  const selectedAxis: DRDAxis | undefined = useMemo(() => {
    return DRD_STRUCTURE.find((a) => a.areas.some((ar) => ar.id === areaId));
  }, [areaId]);

  const levelCount = selectedAxis?.levelCount || 5;
  const state = getAreaState(value, areaId, levelCount);
  const axisKey = getAxisKey(selectedAxis?.id || 1);
  const whyThisMattersHint = useMemo(
    () => getDRDAxisWhyHint(selectedAxis?.id || 1),
    [selectedAxis?.id]
  );

  // Fetch canon-grounded AI guidance for one area×level (cached, non-blocking).
  const requestGuidance = React.useCallback((area: DRDArea, level: DRDLevel) => {
    const key = `${area.id}#${level.level}`;
    setGuidance((prev) => {
      if (prev[key]?.loading || prev[key]?.data) return prev;
      return { ...prev, [key]: { loading: true } };
    });
    void getAssessmentGuidanceLive({
      framework: 'DRD',
      dimensionId: area.id,
      dimensionName: area.namePL || area.name,
      levelNumber: level.level,
      levelTitle: level.title,
      levelDescription: level.description,
      language: 'pl',
    })
      .then((data) => setGuidance((prev) => ({ ...prev, [key]: { loading: false, data } })))
      .catch(() => setGuidance((prev) => ({ ...prev, [key]: { loading: false } })));
  }, []);

  // When area changes, default focus to "next likely" level (achieved+1), unless controlled externally.
  React.useEffect(() => {
    setActiveCardPanel(null);
    setLinkDraft('');
    setIsExplanationExpanded(false);
    if (currentLevel === undefined) {
      const s = getAreaState(value, areaId, levelCount);
      const next = clamp((s.achievedLevel || 0) + 1, 1, levelCount);
      setActiveLevel(next);
      onLevelChange?.(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId]);

  // Report internal level changes
  React.useEffect(() => {
    // IMPORTANT:
    // When `currentLevel` prop is provided, the editor is controlled by the parent.
    // In that mode, calling `onLevelChange` here can create an update loop:
    // parent updates -> prop sync setsActiveLevel -> this effect fires -> parent updates -> ...
    if (currentLevel !== undefined) return;
    onLevelChange?.(activeLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLevel, currentLevel]);

  // Close fullscreen matrix on Escape
  React.useEffect(() => {
    if (!isMatrixFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMatrixFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMatrixFullscreen]);

  // Close popup on Escape or click outside
  React.useEffect(() => {
    if (!popupCell) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopupCell(null);
    };
    const onClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopupCell(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    // Delay click listener to avoid immediate close
    setTimeout(() => window.addEventListener('click', onClick), 10);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('click', onClick);
    };
  }, [popupCell]);

  // Cleanup timeouts on unmount to avoid stale callbacks during navigation
  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // Helper to open popup at cell position with smart positioning
  const openCellPopup = (areaId: string, level: number, e: React.MouseEvent<HTMLButtonElement>) => {
    // Clear any hover tooltip
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoverCell(null);

    const rect = e.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Popup dimensions (approximate)
    const popupWidth = 360;
    const popupHeight = 400;
    const gap = 12;

    let top = 0;
    let left = 0;
    let arrowPosition: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
    let arrowOffset = 0;

    // Calculate best position: prefer below, then above, then right, then left
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = viewportWidth - rect.right;

    if (spaceBelow >= popupHeight + gap) {
      // Position below
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - popupWidth / 2;
      arrowPosition = 'top';
      arrowOffset = popupWidth / 2;
    } else if (spaceAbove >= popupHeight + gap) {
      // Position above
      top = rect.top - popupHeight - gap;
      left = rect.left + rect.width / 2 - popupWidth / 2;
      arrowPosition = 'bottom';
      arrowOffset = popupWidth / 2;
    } else if (spaceRight >= popupWidth + gap) {
      // Position to the right
      top = rect.top + rect.height / 2 - popupHeight / 2;
      left = rect.right + gap;
      arrowPosition = 'left';
      arrowOffset = popupHeight / 2;
    } else if (spaceLeft >= popupWidth + gap) {
      // Position to the left
      top = rect.top + rect.height / 2 - popupHeight / 2;
      left = rect.left - popupWidth - gap;
      arrowPosition = 'right';
      arrowOffset = popupHeight / 2;
    } else {
      // Fallback: center in viewport
      top = (viewportHeight - popupHeight) / 2;
      left = (viewportWidth - popupWidth) / 2;
      arrowPosition = 'top';
      arrowOffset = popupWidth / 2;
    }

    // Keep within viewport bounds
    if (left < 16) {
      arrowOffset = arrowOffset - (16 - left);
      left = 16;
    }
    if (left + popupWidth > viewportWidth - 16) {
      const overflow = left + popupWidth - (viewportWidth - 16);
      arrowOffset = arrowOffset + overflow;
      left = viewportWidth - popupWidth - 16;
    }
    if (top < 16) top = 16;
    if (top + popupHeight > viewportHeight - 16) top = viewportHeight - popupHeight - 16;

    // Clamp arrow offset
    arrowOffset = Math.max(
      20,
      Math.min(
        arrowOffset,
        arrowPosition === 'top' || arrowPosition === 'bottom' ? popupWidth - 20 : popupHeight - 20
      )
    );

    setPopupPosition({ top, left, arrowPosition, arrowOffset });
    setPopupCell({ areaId, level });
  };

  // Helper to show hover tooltip
  const showHoverTooltip = (
    areaId: string,
    level: number,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (popupCell) return; // Don't show tooltip if popup is open

    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

    // IMPORTANT:
    // - React synthetic events are invalid after the handler returns.
    // - We must not reference `e` inside setTimeout (it can become null).
    const target = e.currentTarget;

    hoverTimeoutRef.current = setTimeout(() => {
      if (!target || !target.isConnected) return;
      const rect = target.getBoundingClientRect();
      setHoverPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
      setHoverCell({ areaId, level });
    }, 400); // 400ms delay before showing tooltip
  };

  const hideHoverTooltip = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoverCell(null);
  };

  const setAchieved = (lvl: number, checked: boolean) => {
    if (readOnly) return;
    const current = state.achievedLevel;
    const nextAchieved = checked ? Math.max(current, lvl) : Math.min(current, lvl - 1);
    const next = { ...state, achievedLevel: clamp(nextAchieved, 0, levelCount) };
    // If a level is achieved, it cannot be "skipped" anymore. Clean up skip flags <= achievedLevel.
    if (next.levelDecisions && Object.keys(next.levelDecisions).length > 0) {
      const cleaned: Record<string, 'skip'> = { ...next.levelDecisions };
      for (const k of Object.keys(cleaned)) {
        const n = Number(k);
        if (Number.isFinite(n) && n <= (next.achievedLevel || 0)) delete cleaned[k];
      }
      next.levelDecisions = cleaned;
    }
    onChange(setAreaState(value, areaId, next));
  };

  const setLevelDecision = (lvl: number, decision: 'skip' | undefined) => {
    if (readOnly) return;
    const nextDecisions: Record<string, 'skip'> = { ...(state.levelDecisions || {}) };
    if (!decision) {
      delete nextDecisions[String(lvl)];
    } else {
      nextDecisions[String(lvl)] = decision;
    }
    onChange(setAreaState(value, areaId, { ...state, levelDecisions: nextDecisions }));
  };

  const setLevelNote = (lvl: number, note: string) => {
    if (readOnly) return;
    const nextNotes = { ...(state.levelNotes || {}), [String(lvl)]: note };
    onChange(setAreaState(value, areaId, { ...state, levelNotes: nextNotes }));
  };

  const addLevelLink = (lvl: number, url: string) => {
    if (readOnly) return;
    const cleaned = String(url || '').trim();
    if (!cleaned) return;
    const key = String(lvl);
    const current = Array.isArray(state.levelLinks?.[key]) ? state.levelLinks?.[key] : [];
    const nextForLvl = Array.from(new Set([...current, cleaned]));
    const nextLinks = { ...(state.levelLinks || {}), [key]: nextForLvl };
    onChange(setAreaState(value, areaId, { ...state, levelLinks: nextLinks }));
  };

  const removeLevelLink = (lvl: number, url: string) => {
    if (readOnly) return;
    const key = String(lvl);
    const current = Array.isArray(state.levelLinks?.[key]) ? state.levelLinks?.[key] : [];
    const nextForLvl = current.filter((x) => String(x) !== String(url));
    const nextLinks = { ...(state.levelLinks || {}) };
    if (nextForLvl.length > 0) nextLinks[key] = nextForLvl;
    else delete nextLinks[key];
    onChange(setAreaState(value, areaId, { ...state, levelLinks: nextLinks }));
  };

  const setTargetLevel = (lvl: number | undefined) => {
    if (readOnly) return;
    const nextTarget = lvl ? clamp(Number(lvl), 1, levelCount) : undefined;
    onChange(setAreaState(value, areaId, { ...state, targetLevel: nextTarget }));
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const navPanel = (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-200 dark:border-navy-800">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            DRD
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1 text-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setViewMode((m) => {
              const next = m === 'surveys' ? 'matrix' : 'surveys';
              onViewModeChange?.(next);
              return next;
            });
          }}
          className="w-full h-10 px-4 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-navy-900 transition-colors"
        >
          {viewMode === 'surveys' ? (
            <>
              <Grid2X2 className="w-4 h-4" />
              Preview
            </>
          ) : (
            <>
              <List className="w-4 h-4" />
              Survey
            </>
          )}
        </button>

        <div className="space-y-2">
          <label className="text-xs text-slate-500 dark:text-slate-400" htmlFor="drd-axis-select">
            Axis
          </label>
          <div className="relative">
            <select
              id="drd-axis-select"
              value={axisId}
              onChange={(e) => handleAxisChange(Number(e.target.value))}
              className="w-full h-10 px-3 pr-10 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-c-focus"
            >
              {DRD_STRUCTURE.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id}. {etykietaObszaru(a)}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="p-2 overflow-auto flex-1">
        {filteredAreas.map((a) => {
          const isActive = a.id === areaId;
          const assignedTo = assignmentByAreaId?.[a.id]?.assigned_user_id;
          const isMine = !!currentUserId && String(assignedTo || '') === String(currentUserId);
          return (
            <button
              key={a.id}
              onClick={() => {
                setAreaId(a.id);
                onAreaChange?.(a.id);
                setViewMode('surveys');
              }}
              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                isActive
                  ? 'border-slate-300 dark:border-white/15 bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-white'
                  : 'border-transparent hover:border-slate-200 dark:hover:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-950/40 text-slate-700 dark:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="text-xs font-mono text-slate-600 dark:text-slate-400">{a.id}</div>
                    {isMine && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100/70 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/30"
                        title="Assigned to you"
                      >
                        <User className="w-3 h-3" />
                        me
                      </span>
                    )}
                    {(() => {
                      const areaState = getAreaState(value, a.id, axis?.levelCount || 5);
                      const isComplete = areaState.achievedLevel >= (axis?.levelCount || 5);
                      if (isComplete) {
                        return <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />;
                      }
                      return null;
                    })()}
                  </div>
                  <div className="text-sm font-medium truncate">{etykietaObszaru(a)}</div>
                  {/* Progress bar per area */}
                  {(() => {
                    const areaState = getAreaState(value, a.id, axis?.levelCount || 5);
                    const progress = (areaState.achievedLevel / (axis?.levelCount || 5)) * 100;
                    if (progress > 0) {
                      return (
                        <div className="mt-1.5 h-1 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-navy-900 dark:bg-slate-300 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                {/* slate-600, nie slate-500: 4.34:1 zamiast 4,5:1 (axe: color-contrast,
                    zmierzone na drd-macierz-oceny, x6 wierszy). */}
                <div className="text-[10px] px-2 py-1 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 shrink-0">
                  {getAreaState(value, a.id, axis?.levelCount || 5).achievedLevel}/
                  {axis?.levelCount || 5}
                </div>
              </div>
            </button>
          );
        })}
        {filteredAreas.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            No results.
          </div>
        )}
      </div>

      {/* Collapse button at bottom */}
      <div className="p-2 border-t border-slate-200 dark:border-navy-800">
        <button
          onClick={() => setIsNavCollapsed(true)}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded transition-colors"
          title="Collapse panel"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  const contentPanel = (
    <div ref={levelsContainerRef} className="h-full overflow-auto p-4 md:p-6">
      <div className="w-full">
        {/* Mobile: Toggle sidebar button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="md:hidden mb-4 p-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 flex items-center gap-2"
        >
          {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          <span className="text-sm font-medium">Navigation</span>
        </button>

        {/* ===================================================================== */}
        {/* MATRIX VIEW (enterprise / BCG-style)                                  */}
        {/* ===================================================================== */}
        {viewMode === 'matrix' && (
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 shadow-lg dark:shadow-2xl">
            {/* Background glow */}
            <div className="pointer-events-none absolute -top-40 -right-40 h-[420px] w-[420px] rounded-full bg-navy-500/15 blur-3xl hidden dark:block" />
            <div className="pointer-events-none absolute -bottom-48 -left-40 h-[460px] w-[460px] rounded-full bg-blue-500/10 blur-3xl hidden dark:block" />

            <div className="relative p-6">
              <DRDMatrixHeaderBlock
                axisId={axis?.id}
                axisName={axis?.name}
                right={
                  <>
                    <DRDMatrixLegend
                      compact={matrixCompact}
                      onCompactChange={setMatrixCompact}
                    />
                    <button
                      type="button"
                      onClick={() => setIsMatrixFullscreen(true)}
                      className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white text-xs font-semibold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                      title={t('drd.matrix.openFullscreenTitle', 'Open matrix in full screen')}
                    >
                      <Maximize2 className="w-4 h-4" />
                      {t('drd.matrix.fullscreen', 'Full screen')}
                    </button>
                  </>
                }
              />

              <DRDMatrixGrid
                areas={axisAreas}
                levelCount={levelCount}
                value={value}
                compact={matrixCompact}
                columnMinPx={150}
                rowHint={t('drd.matrix.rowHint', 'Hover for preview · Click for details')}
                selectedCell={popupCell}
                onCellClick={(cellAreaId, cellLevel, e) => {
                  if (e.shiftKey && !readOnly) {
                    const cur = getAreaState(value, cellAreaId, levelCount);
                    onChange(
                      setAreaState(value, cellAreaId, {
                        ...cur,
                        targetLevel: clamp(cellLevel, 1, levelCount),
                      })
                    );
                    return;
                  }
                  openCellPopup(cellAreaId, cellLevel, e);
                }}
                onCellMouseEnter={(cellAreaId, cellLevel, e) =>
                  showHoverTooltip(cellAreaId, cellLevel, e)
                }
                onCellMouseLeave={hideHoverTooltip}
                onAreaClick={(clickedAreaId) => {
                  setAreaId(clickedAreaId);
                  onAreaChange?.(clickedAreaId);
                  setViewMode('surveys');
                }}
                areaStripLabel={t('drd.matrix.areaStrip', 'Area')}
                overflowHint={podpisUkrytychKolumn}
              />

              <DRDMatrixSummaryStrip
                areas={axisAreas}
                levelCount={levelCount}
                value={value}
              />
            </div>

            {/* Hover Tooltip (lightweight) */}
            {hoverCell &&
              hoverPosition &&
              !popupCell &&
              (() => {
                const tooltipArea = axisAreas.find((a) => a.id === hoverCell.areaId);
                const tooltipLevelInfo = tooltipArea?.levels?.find(
                  (l) => l.level === hoverCell.level
                );
                const tooltipKnowledge = getDRDKnowledge(hoverCell.areaId, hoverCell.level);
                const tooltipState = getAreaState(value, hoverCell.areaId, levelCount);
                const tooltipAchieved = tooltipState.achievedLevel || 0;
                const tooltipTarget = tooltipState.targetLevel || 0;
                const isTooltipAchieved = hoverCell.level <= tooltipAchieved;
                const isTooltipTarget =
                  tooltipTarget > 0 && hoverCell.level <= tooltipTarget && !isTooltipAchieved;
                const tooltipTechs = (tooltipKnowledge?.suggestedTechnologies || []).slice(0, 3);

                return (
                  <div
                    className="fixed z-[150] pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200"
                    style={{
                      top: hoverPosition.top,
                      left: hoverPosition.left,
                      transform: 'translate(-50%, -100%)',
                    }}
                  >
                    <div className="rounded-xl border border-slate-200 dark:border-white/20 bg-white/95 dark:bg-navy-950/95 backdrop-blur-lg shadow-xl px-3 py-2 max-w-[240px]">
                      {/* Arrow */}
                      <div className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 rotate-45 bg-white/95 dark:bg-navy-950/95 border-r border-b border-slate-200 dark:border-white/20" />

                      <div className="text-xs font-semibold text-slate-900 dark:text-white mb-1">
                        {tooltipLevelInfo?.title || `Level ${hoverCell.level}`}
                      </div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                            isTooltipAchieved
                              ? 'bg-slate-500/25 text-slate-700 dark:text-slate-200'
                              : isTooltipTarget
                                ? 'bg-blue-500/25 text-blue-700 dark:text-blue-200'
                                : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {isTooltipAchieved ? 'AS-IS' : isTooltipTarget ? 'TO-BE' : 'Not assessed'}
                        </span>
                      </div>
                      {tooltipTechs.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tooltipTechs.map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-1.5 text-[9px] text-slate-500">Click for details</div>
                    </div>
                  </div>
                );
              })()}

            {/* Cell Detail Popup Overlay */}
            {popupCell && popupPosition && (
              <div
                ref={popupRef}
                className="fixed z-[200] w-[360px] rounded-2xl border border-slate-200 dark:border-white/20 bg-white/95 dark:bg-navy-950/95 backdrop-blur-xl shadow-[0_25px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200"
                style={{ top: popupPosition.top, left: popupPosition.left }}
              >
                {/* Arrow indicator */}
                {popupPosition.arrowPosition === 'top' && (
                  <div
                    className="absolute -top-2 w-4 h-4 rotate-45 bg-white/95 dark:bg-navy-950/95 border-l border-t border-slate-200 dark:border-white/20"
                    style={{ left: popupPosition.arrowOffset - 8 }}
                  />
                )}
                {popupPosition.arrowPosition === 'bottom' && (
                  <div
                    className="absolute -bottom-2 w-4 h-4 rotate-45 bg-white/95 dark:bg-navy-950/95 border-r border-b border-slate-200 dark:border-white/20"
                    style={{ left: popupPosition.arrowOffset - 8 }}
                  />
                )}
                {popupPosition.arrowPosition === 'left' && (
                  <div
                    className="absolute -left-2 w-4 h-4 rotate-45 bg-white/95 dark:bg-navy-950/95 border-l border-b border-slate-200 dark:border-white/20"
                    style={{ top: popupPosition.arrowOffset - 8 }}
                  />
                )}
                {popupPosition.arrowPosition === 'right' && (
                  <div
                    className="absolute -right-2 w-4 h-4 rotate-45 bg-white/95 dark:bg-navy-950/95 border-r border-t border-slate-200 dark:border-white/20"
                    style={{ top: popupPosition.arrowOffset - 8 }}
                  />
                )}

                {(() => {
                  const popupArea = axisAreas.find((a) => a.id === popupCell.areaId);
                  const popupLevelInfo = popupArea?.levels?.find(
                    (l) => l.level === popupCell.level
                  );
                  const popupKnowledge = getDRDKnowledge(popupCell.areaId, popupCell.level);
                  const popupState = getAreaState(value, popupCell.areaId, levelCount);
                  const popupAchieved = popupState.achievedLevel || 0;
                  const popupTarget = popupState.targetLevel || 0;
                  const isPopupAchieved = popupCell.level <= popupAchieved;
                  const isPopupTarget =
                    popupTarget > 0 && popupCell.level <= popupTarget && !isPopupAchieved;
                  const popupTechs = popupKnowledge?.suggestedTechnologies || [];

                  return (
                    <>
                      {/* Header */}
                      <div className="p-4 border-b border-slate-200 dark:border-white/10">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg font-bold ${
                                isPopupAchieved
                                  ? 'bg-navy-900 text-white'
                                  : isPopupTarget
                                    ? 'bg-blue-500/50 text-blue-100'
                                    : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {popupCell.level}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-900 dark:text-white">
                                {popupLevelInfo?.title || `Level ${popupCell.level}`}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {popupArea ? etykietaObszaru(popupArea) : ''} · {popupCell.areaId}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setAreaId(popupCell.areaId);
                                onAreaChange?.(popupCell.areaId);
                                setLevel(popupCell.level);
                                setViewMode('surveys');
                                setPopupCell(null);
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() => setPopupCell(null)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Status badges */}
                        <div className="mt-3 flex items-center gap-2">
                          <span
                            className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                              isPopupAchieved
                                ? 'bg-slate-500/25 text-slate-700 dark:text-slate-200 ring-1 ring-slate-300 dark:ring-white/15'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-white/10'
                            }`}
                          >
                            {isPopupAchieved ? 'AS-IS (Achieved)' : 'Not achieved'}
                          </span>
                          {isPopupTarget && (
                            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-500/25 text-blue-700 dark:text-blue-200 ring-1 ring-blue-400/30">
                              TO-BE (Target)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-3 max-h-[280px] overflow-y-auto">
                        {/* Description */}
                        {popupLevelInfo?.description && (
                          <div>
                            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                              Description
                            </div>
                            <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                              {popupLevelInfo.description}
                            </div>
                          </div>
                        )}

                        {/* Example */}
                        {popupKnowledge?.example && (
                          <div>
                            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                              Example
                            </div>
                            <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                              {popupKnowledge.example}
                            </div>
                          </div>
                        )}

                        {/* Technologies */}
                        {popupTechs.length > 0 && (
                          <div>
                            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                              Technologies
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {popupTechs.map((t) => {
                                const isKey = [
                                  'AI',
                                  'ML',
                                  'RPA',
                                  'IoT',
                                  'AGV',
                                  'WMS',
                                  'MES',
                                  'ERP',
                                  'CRM',
                                  'BI',
                                  'API',
                                  'EDI',
                                ].includes(t);
                                return (
                                  <span
                                    key={t}
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                      isKey
                                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-200 border border-amber-400/30'
                                        : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10'
                                    }`}
                                  >
                                    {t}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="p-4 border-t border-slate-200 dark:border-white/10">
                        {/* Quick actions row - toggleable buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => {
                              const cur = getAreaState(value, popupCell.areaId, levelCount);
                              const curAchieved = Number(cur.achievedLevel || 0);

                              if (isPopupAchieved) {
                                // Toggle off: clear achieved for this level
                                // Find the highest level below this one that should remain achieved
                                const newAchieved = popupCell.level > 1 ? popupCell.level - 1 : 0;
                                onChange(
                                  setAreaState(value, popupCell.areaId, {
                                    ...cur,
                                    achievedLevel:
                                      curAchieved === popupCell.level ? newAchieved : curAchieved,
                                  })
                                );
                              } else {
                                // Set as achieved - clear target if it was set to this level
                                onChange(
                                  setAreaState(value, popupCell.areaId, {
                                    ...cur,
                                    achievedLevel: popupCell.level,
                                    targetLevel:
                                      cur.targetLevel === popupCell.level
                                        ? undefined
                                        : cur.targetLevel,
                                  })
                                );
                              }
                            }}
                            className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                              isPopupAchieved
                                ? 'bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF]'
                                : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/15'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {isPopupAchieved ? 'Achieved' : 'Set AS-IS'}
                          </button>

                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => {
                              const cur = getAreaState(value, popupCell.areaId, levelCount);
                              const curTarget = Number(cur.targetLevel || 0);

                              if (curTarget === popupCell.level) {
                                // Toggle off: clear target
                                onChange(
                                  setAreaState(value, popupCell.areaId, {
                                    ...cur,
                                    targetLevel: undefined,
                                  })
                                );
                              } else {
                                // Set as target
                                onChange(
                                  setAreaState(value, popupCell.areaId, {
                                    ...cur,
                                    targetLevel: popupCell.level,
                                  })
                                );
                              }
                            }}
                            className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                              isPopupTarget
                                ? 'bg-blue-500 text-white hover:bg-blue-600'
                                : 'bg-blue-500/20 text-blue-700 dark:text-blue-200 hover:bg-blue-500/30'
                            }`}
                          >
                            <Target className="w-3.5 h-3.5" />
                            {isPopupTarget ? 'Target' : 'Set TO-BE'}
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* SURVEYS VIEW (existing)                                               */}
        {/* ===================================================================== */}
        {viewMode === 'surveys' && (
          <>
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs font-mono text-slate-600 dark:text-slate-400">{areaId}</div>
                <div className="flex items-center gap-2">
                  <div className="text-xl md:text-2xl font-semibold text-navy-900 dark:text-white">
                    {selectedArea?.name || 'Area'}
                  </div>
                  <Tooltip
                    content={
                      <div className="max-w-[280px]">
                        <div className="text-xs font-bold mb-1">
                          {t('assessment.drd.whyThisMatters.title', 'Why we ask this')}
                        </div>
                        <div className="text-xs leading-relaxed">
                          {isPl ? whyThisMattersHint.pl : whyThisMattersHint.en}
                        </div>
                      </div>
                    }
                    placement="bottom-start"
                    maxWidth={300}
                  >
                    <button
                      type="button"
                      aria-label={t('assessment.drd.whyThisMatters.ariaLabel', 'Why this question')}
                      className="shrink-0 p-1 rounded-full text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
                <div className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Axis: {selectedAxis?.id}. {selectedAxis?.name} · Answers: Yes/No per level ·
                  Attachments per level
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsGlossaryOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors shrink-0"
              >
                <BookOpen className="w-3.5 h-3.5" />
                {t('assessment.drd.glossary.button', 'Glossary')}
              </button>
            </div>

            {/* Make room for the pinned decision bar */}
            <div className="space-y-4 pb-28">
              {(selectedArea?.levels || []).map((lvl) => {
                const achieved = state.achievedLevel >= lvl.level;
                const isImplicit = achieved && (state.achievedLevel || 0) > lvl.level;
                const isTarget = (state.targetLevel || 0) === lvl.level;
                const isSkipped = (state.levelDecisions || {})[String(lvl.level)] === 'skip';
                const knowledge = getDRDKnowledge(areaId, lvl.level);
                const note = state.levelNotes?.[String(lvl.level)] || '';
                const isSelected = activeLevel === lvl.level;
                const isOpen = isSelected && isDetailsOpen;
                return (
                  <div
                    id={`drd-level-${lvl.level}`}
                    key={lvl.level}
                    onClick={() => {
                      if (!isSelected) setLevel(lvl.level);
                      else setIsDetailsOpen(true);
                    }}
                    className={`bg-white dark:bg-navy-900 border rounded-xl transition-colors ${
                      isOpen ? 'ring-2 ring-blue-500/30 p-5' : 'p-3'
                    } ${
                      achieved
                        ? 'border-green-200 dark:border-green-900/40 bg-green-50/30 dark:bg-green-950/10'
                        : isTarget
                          ? 'border-blue-300/50 dark:border-blue-800/50'
                          : 'border-slate-200 dark:border-navy-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold">
                            {lvl.level}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-navy-900 dark:text-white truncate">
                                {lvl.title}
                              </div>
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full border ${
                                  achieved
                                    ? 'bg-green-100/60 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200/60 dark:border-green-900/30'
                                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-navy-700'
                                }`}
                              >
                                {achieved
                                  ? isImplicit
                                    ? 'Achieved (implicit)'
                                    : 'Achieved'
                                  : 'Not achieved'}
                              </span>
                              {isTarget && !achieved && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full border bg-blue-100/60 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-900/30">
                                  Target
                                </span>
                              )}
                              {isSkipped && !achieved && !isTarget && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full border bg-transparent text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-navy-700">
                                  Skipped
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isSelected) {
                                    setLevel(lvl.level);
                                    return;
                                  }
                                  setIsDetailsOpen((v) => !v);
                                }}
                                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-navy-800"
                                aria-label={isOpen ? 'Collapse level' : 'Expand level'}
                                title={isOpen ? 'Collapse' : 'Expand'}
                              >
                                <ChevronDown
                                  className={`w-4 h-4 text-slate-600 transition-transform ${
                                    isOpen ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {axisKey} · level {lvl.level}/{levelCount}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                          {lvl.description}
                        </div>
                      </div>
                    </div>

                    {/* Details: only for active level */}
                    {isOpen && (
                      <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                        {/* Example (full width, primary reading path) */}
                        <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/40 p-4">
                          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Example + suggested technologies
                          </div>
                          <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                            {knowledge.example}
                          </div>
                          {Array.isArray(knowledge.suggestedTechnologies) &&
                            knowledge.suggestedTechnologies.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {knowledge.suggestedTechnologies.map((t) => (
                                  <span
                                    key={t}
                                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                        </div>

                        {/* Explanation (collapsed by default; expandable) */}
                        <div className="mt-3 rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Explanation
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsExplanationExpanded((v) => !v)}
                              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {isExplanationExpanded ? 'Less' : 'More'}
                            </button>
                          </div>

                          <div className="mt-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                            <div className={isExplanationExpanded ? '' : 'line-clamp-2'}>
                              {lvl.description}{' '}
                              <span className="text-slate-500 dark:text-slate-400">
                                Use evidence (screenshot, report, system log, procedure, KPI) to
                                justify your choice.
                              </span>
                            </div>

                            {isExplanationExpanded && (
                              <div className="mt-3 space-y-2">
                                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                  How to decide
                                </div>
                                <ul className="space-y-1">
                                  <li>
                                    <span className="font-semibold">Achieved</span>: this is in
                                    place and used in practice (not only a pilot).
                                  </li>
                                  <li>
                                    <span className="font-semibold">Target</span>: desired “to‑be”
                                    level (planned / roadmap target).
                                  </li>
                                  <li>
                                    <span className="font-semibold">Skip</span>: explicitly mark
                                    “not planned” for this level.
                                  </li>
                                </ul>
                                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                  Tip
                                </div>
                                <div>
                                  If you’re unsure, add a short comment + attach a quick artifact.
                                  You can always change your mind later.
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Quick actions */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveCardPanel((p) => (p === 'questions' ? null : 'questions'))
                            }
                            className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                              activeCardPanel === 'questions'
                                ? 'bg-white dark:bg-navy-900 border-slate-300 dark:border-navy-600 text-slate-800 dark:text-slate-100 shadow-sm'
                                : 'bg-white/70 dark:bg-white/5 border-slate-300/80 dark:border-white/15 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-white dark:hover:bg-white/8 hover:border-slate-400/80 dark:hover:border-white/25'
                            }`}
                          >
                            <HelpCircle className="w-4 h-4" />
                            Questions
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setActiveCardPanel((p) => (p === 'comment' ? null : 'comment'))
                            }
                            className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                              activeCardPanel === 'comment'
                                ? 'bg-white dark:bg-navy-900 border-slate-300 dark:border-navy-600 text-slate-800 dark:text-slate-100 shadow-sm'
                                : 'bg-white/70 dark:bg-white/5 border-slate-300/80 dark:border-white/15 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-white dark:hover:bg-white/8 hover:border-slate-400/80 dark:hover:border-white/25'
                            }`}
                          >
                            <MessageSquare className="w-4 h-4" />
                            Comment
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setActiveCardPanel((p) =>
                                p === 'attachments' ? null : 'attachments'
                              )
                            }
                            className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                              activeCardPanel === 'attachments'
                                ? 'bg-white dark:bg-navy-900 border-slate-300 dark:border-navy-600 text-slate-800 dark:text-slate-100 shadow-sm'
                                : 'bg-white/70 dark:bg-white/5 border-slate-300/80 dark:border-white/15 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-white dark:hover:bg-white/8 hover:border-slate-400/80 dark:hover:border-white/25'
                            }`}
                          >
                            <Paperclip className="w-4 h-4" />
                            Add attachment
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setActiveCardPanel((p) => (p === 'links' ? null : 'links'))
                            }
                            className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                              activeCardPanel === 'links'
                                ? 'bg-white dark:bg-navy-900 border-slate-300 dark:border-navy-600 text-slate-800 dark:text-slate-100 shadow-sm'
                                : 'bg-white/70 dark:bg-white/5 border-slate-300/80 dark:border-white/15 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-white dark:hover:bg-white/8 hover:border-slate-400/80 dark:hover:border-white/25'
                            }`}
                          >
                            <Link2 className="w-4 h-4" />
                            Add link
                          </button>
                        </div>

                        {/* Panels */}
                        {activeCardPanel === 'questions' && (
                          <div className="mt-3 rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-4">
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <span>Validation questions</span>
                              {achieved && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                  Verified
                                </span>
                              )}
                            </div>
                            <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                              {knowledge.questions.map((q, idx) => (
                                <li key={idx} className="flex gap-2">
                                  <span className="text-slate-400 mt-0.5 shrink-0">•</span>
                                  <span>{q}</span>
                                </li>
                              ))}
                            </ul>

                            {/* Per-question AI guidance (canon-grounded, non-blocking) */}
                            {(() => {
                              const gKey = `${areaId}#${lvl.level}`;
                              const g = guidance[gKey];
                              if (!g) {
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (selectedArea) requestGuidance(selectedArea, lvl);
                                    }}
                                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Podpowiedź AI (dlaczego to ważne + jak oceniać)
                                  </button>
                                );
                              }
                              if (g.loading) {
                                return (
                                  <div className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                                    Generuję podpowiedź…
                                  </div>
                                );
                              }
                              if (!g.data) return null;
                              return (
                                <div className="mt-3 rounded-lg border border-blue-200/60 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 p-3 space-y-2 text-sm">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                    <Sparkles className="w-3 h-3" />
                                    Podpowiedź konsultanta
                                    <span className="ml-auto font-normal normal-case text-slate-400">
                                      {g.data.source === 'llm' ? 'AI' : 'kanon'}
                                    </span>
                                  </div>
                                  <p className="text-slate-800 dark:text-slate-200">
                                    <span className="font-semibold">Dlaczego to ważne: </span>
                                    {g.data.whyItMatters}
                                  </p>
                                  <p className="text-slate-700 dark:text-slate-300">
                                    <span className="font-semibold">Jak oceniać poziom: </span>
                                    {g.data.levelInterpretation}
                                  </p>
                                  <p className="text-slate-600 dark:text-slate-400 text-xs">
                                    <span className="font-semibold">Kanon: </span>
                                    {g.data.canonContext}
                                  </p>
                                  {g.data.pitfalls.length > 0 && (
                                    <p className="text-slate-600 dark:text-slate-400 text-xs">
                                      <span className="font-semibold">Uważaj na: </span>
                                      {g.data.pitfalls.join(' · ')}
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {activeCardPanel === 'comment' && (
                          <div className="mt-3 rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-4">
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                              Comment
                            </div>
                            <textarea
                              value={note}
                              onChange={(e) => setLevelNote(lvl.level, e.target.value)}
                              placeholder="Facts: what exists? Gaps: what's missing? Context: scope/owners/tools?"
                              disabled={readOnly}
                              rows={3}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-c-focus"
                            />
                          </div>
                        )}

                        {activeCardPanel === 'attachments' && (
                          <div className="mt-3 rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-4">
                            <LevelAttachments
                              assessmentId={assessmentId}
                              axisId={axisKey}
                              areaId={areaId}
                              levelNumber={lvl.level}
                              readOnly={readOnly}
                              compact={false}
                            />
                          </div>
                        )}

                        {activeCardPanel === 'links' && (
                          <div className="mt-3 rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-4">
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                              Links
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                value={linkDraft}
                                onChange={(e) => setLinkDraft(e.target.value)}
                                placeholder="https://…"
                                className="flex-1 h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white text-sm"
                              />
                              <button
                                type="button"
                                disabled={readOnly || !String(linkDraft || '').trim()}
                                onClick={() => {
                                  addLevelLink(lvl.level, linkDraft);
                                  setLinkDraft('');
                                }}
                                className="h-10 px-4 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:bg-navy-900/40 dark:disabled:bg-[#F4F7FB]/50 text-white dark:text-navy-950 text-sm font-semibold"
                              >
                                Add
                              </button>
                            </div>
                            {(() => {
                              const links = (state.levelLinks || {})[String(lvl.level)] || [];
                              if (!Array.isArray(links) || links.length === 0) return null;
                              return (
                                <div className="mt-3 space-y-2">
                                  {links.map((u) => (
                                    <div
                                      key={u}
                                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/40"
                                    >
                                      <a
                                        href={u}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {u}
                                      </a>
                                      <button
                                        type="button"
                                        disabled={readOnly}
                                        className="text-xs font-semibold text-slate-500 hover:text-danger-500"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeLevelLink(lvl.level, u);
                                        }}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Card footer: pinned to this card (not the page) */}
                        {(() => {
                          const levels = selectedArea?.levels || [];
                          const idx = levels.findIndex((x) => x.level === lvl.level);
                          const prev = idx > 0 ? levels[idx - 1] : null;
                          const next = idx >= 0 && idx < levels.length - 1 ? levels[idx + 1] : null;
                          return (
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-navy-800">
                              <div className="grid grid-cols-3 items-center gap-3">
                                <div />

                                <div className="flex items-center justify-center gap-2">
                                  {/* Single-choice radio-like buttons: only one can be active at a time */}
                                  <button
                                    type="button"
                                    disabled={readOnly}
                                    onClick={() => {
                                      const cur = getAreaState(value, areaId, levelCount);
                                      const curAchieved = Number(cur.achievedLevel || 0);
                                      const alreadyAchieved = curAchieved >= lvl.level;

                                      if (alreadyAchieved) {
                                        // Toggle off: clear achieved for this level
                                        setAchieved(lvl.level, false);
                                      } else {
                                        // Select Achieved: clear Target and Skip for this level first
                                        if (Number(cur.targetLevel || 0) === lvl.level) {
                                          setTargetLevel(undefined);
                                        }
                                        setLevelDecision(lvl.level, undefined);
                                        setAchieved(lvl.level, true);
                                      }
                                    }}
                                    className={`h-10 w-28 rounded-lg text-sm font-semibold border transition-colors ${
                                      achieved
                                        ? 'bg-green-600 border-green-600 text-white'
                                        : 'bg-green-50 dark:bg-green-900/15 border-green-200 dark:border-green-900/30 text-green-700 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-900/25'
                                    }`}
                                  >
                                    Achieved
                                  </button>

                                  <button
                                    type="button"
                                    disabled={readOnly}
                                    onClick={() => {
                                      const cur = getAreaState(value, areaId, levelCount);
                                      const alreadyTarget =
                                        Number(cur.targetLevel || 0) === lvl.level;

                                      if (alreadyTarget) {
                                        // Toggle off: clear target
                                        setTargetLevel(undefined);
                                      } else {
                                        // Select Target: clear Achieved (if at this level) and Skip first
                                        if (Number(cur.achievedLevel || 0) >= lvl.level) {
                                          setAchieved(lvl.level, false);
                                        }
                                        setLevelDecision(lvl.level, undefined);
                                        setTargetLevel(lvl.level);
                                      }
                                    }}
                                    className={`h-10 w-28 rounded-lg text-sm font-semibold border transition-colors ${
                                      isTarget
                                        ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-blue-50 dark:bg-blue-900/15 border-blue-200 dark:border-blue-900/30 text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/25'
                                    }`}
                                  >
                                    Target
                                  </button>

                                  <button
                                    type="button"
                                    disabled={readOnly}
                                    onClick={() => {
                                      const cur = getAreaState(value, areaId, levelCount);
                                      const alreadySkipped =
                                        (cur.levelDecisions || {})[String(lvl.level)] === 'skip';

                                      if (alreadySkipped) {
                                        // Toggle off: clear skip
                                        setLevelDecision(lvl.level, undefined);
                                      } else {
                                        // Select Skip: clear Achieved (if at this level) and Target first
                                        if (Number(cur.achievedLevel || 0) >= lvl.level) {
                                          setAchieved(lvl.level, false);
                                        }
                                        if (Number(cur.targetLevel || 0) === lvl.level) {
                                          setTargetLevel(undefined);
                                        }
                                        setLevelDecision(lvl.level, 'skip');
                                      }
                                    }}
                                    className={`h-10 w-28 rounded-lg text-sm font-semibold border transition-colors ${
                                      isSkipped
                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-navy-950 border-slate-900 dark:border-white'
                                        : 'bg-transparent border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-900'
                                    }`}
                                  >
                                    Skip
                                  </button>
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                  <div className="inline-flex overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/15 bg-white/80 dark:bg-white/5 shadow-sm">
                                    <button
                                      type="button"
                                      disabled={!prev}
                                      onClick={() => prev && setLevel(prev.level)}
                                      className="h-10 px-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-white/8 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                      title="Previous"
                                    >
                                      <ArrowLeft className="w-4 h-4" />
                                      Previous
                                    </button>
                                    <div className="w-px bg-slate-200/80 dark:bg-white/10" />
                                    <button
                                      type="button"
                                      disabled={!next}
                                      onClick={() => next && setLevel(next.level)}
                                      className="h-10 px-4 inline-flex items-center gap-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300/60 disabled:text-white/90 disabled:cursor-not-allowed transition-colors"
                                      title="Next"
                                    >
                                      Next
                                      <ArrowRight className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Fullscreen Matrix Overlay */}
      {viewMode === 'matrix' && isMatrixFullscreen && (
          <DRDMatrixFullscreenShell onClose={() => setIsMatrixFullscreen(false)}>

              {/* Re-render the same Matrix panel */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 shadow-lg dark:shadow-2xl">
                <div className="pointer-events-none absolute -top-40 -right-40 h-[420px] w-[420px] rounded-full bg-navy-500/15 blur-3xl hidden dark:block" />
                <div className="pointer-events-none absolute -bottom-48 -left-40 h-[460px] w-[460px] rounded-full bg-blue-500/10 blur-3xl hidden dark:block" />

                <div className="relative p-6">
                  <DRDMatrixHeaderBlock
                    axisId={axis?.id}
                    axisName={axis?.name}
                    large
                    right={
                      <DRDMatrixLegend
                        compact={matrixCompact}
                        onCompactChange={setMatrixCompact}
                      />
                    }
                  />

                  <DRDMatrixGrid
                    areas={axisAreas}
                    levelCount={levelCount}
                    value={value}
                    compact={matrixCompact}
                    columnMinPx={180}
                    rowHint={t('drd.matrix.rowHintClick', 'Click for details')}
                    onCellClick={(cellAreaId, cellLevel, e) => {
                      if (e.shiftKey && !readOnly) {
                        const cur = getAreaState(value, cellAreaId, levelCount);
                        onChange(
                          setAreaState(value, cellAreaId, {
                            ...cur,
                            targetLevel: clamp(cellLevel, 1, levelCount),
                          })
                        );
                        return;
                      }
                      setAreaId(cellAreaId);
                      onAreaChange?.(cellAreaId);
                      setLevel(cellLevel);
                      setViewMode('surveys');
                      setIsMatrixFullscreen(false);
                    }}
                    onAreaClick={(clickedAreaId) => {
                      setAreaId(clickedAreaId);
                      onAreaChange?.(clickedAreaId);
                      setViewMode('surveys');
                      setIsMatrixFullscreen(false);
                    }}
                    areaStripLabel={t('drd.matrix.areaStrip', 'Area')}
                    overflowHint={podpisUkrytychKolumn}
                  />

                  <DRDMatrixSummaryStrip
                    areas={axisAreas}
                    levelCount={levelCount}
                    value={value}
                    large
                  />
                </div>
              </div>
          </DRDMatrixFullscreenShell>
      )}
    </div>
  );

  // Wrapper for content panel with expand button when nav is collapsed
  const contentWithExpandButton = (
    <div className="relative h-full">
      {leftOverride ?? contentPanel}
      {/* Expand button - visible only when nav is collapsed */}
      {isNavCollapsed && (
        <button
          onClick={() => setIsNavCollapsed(false)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 border-r-0 rounded-l-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 shadow-sm transition-colors"
          title="Expand navigation"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  return (
    <>
      <AssessmentToolShell
        left={contentWithExpandButton}
        right={navPanel}
        isRightOpen={isSidebarOpen && !isNavCollapsed}
        // ★ 2026-09-01 (dyżur 164): usunięte `rightWidthClass="w-[320px]"`.
        // Ta sama szerokość, ale teraz z tokenu `--ntype-right-panel-width`
        // (domyślna wartość `AssessmentToolShell`) — nie odrasta przy
        // następnej zmianie szerokości prawego pasa.
        rightSide="right"
      />
      <GlossaryPanel isOpen={isGlossaryOpen} onClose={() => setIsGlossaryOpen(false)} />
    </>
  );
};

export default DRDAssessmentEditor;
