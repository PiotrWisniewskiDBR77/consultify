/**
 * FilterableTable
 * Table with filterable column headers and row actions
 */

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Columns,
  Copy,
  Edit,
  Eye,
  Maximize2,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ColumnConfig, ColumnSelector } from '@/components/Admin/shared/ColumnSelector';
import { Tooltip } from '@/components/ui/primitives/Tooltip';
import { EntityStatusChip } from '@/components/ui/primitives/chips';

import { type RowAction, type RowActionSection, RowActionsMenu } from '../RowActionsMenu';
import { FilterChip } from './ActiveFilters';
import { TableSettingsPopover } from './TableSettingsPopover';
import { localeListy } from '../../../utils/listDateFormat';

// Column definition
export interface TableColumn {
  id: string;
  label: string;
  width?: string;
  dataType?: 'text' | 'status' | 'date' | 'owner' | 'number';
  /**
   * Opt-in leading selection column. When set to 'select', the HEADER renders a
   * select-all checkbox (driven by the `selection` prop) instead of the plain
   * `label` text, and the filter/resizer affordances are suppressed for it.
   * Existing tables that don't set this are completely unaffected.
   */
  type?: 'select';
  filterable?: boolean;
  filterOptions?: { value: string; label: string; color?: string }[];
  sortable?: boolean;
  /**
   * Optional accessor used for sorting (Triada standard). Defaults to
   * `row[column.id]`. Return a string / number / Date-parsable value.
   */
  sortAccessor?: (row: any) => unknown;
  /**
   * Canon §3.3 cell alignment by role: title/text = left (default),
   * counts/metrics = right, rare centered badges = center. Applied to both
   * the header cell and body cells so header and data never desync.
   */
  align?: 'left' | 'center' | 'right';
  /**
   * Kanon triady: „kolumny domyślnie widoczne + pstryczek". Kolumna z
   * `defaultVisible: false` istnieje w pstryczku, ale nie jest w domyślnym
   * zestawie — użytkownik może ją dołożyć, a domyślny widok trzyma się
   * zatwierdzonego obrazu. Brak pola = widoczna (zachowanie sprzed zmiany).
   * Zapisany układ użytkownika (persistKey) ma pierwszeństwo nad tym domyślnym.
   */
  defaultVisible?: boolean;
  /**
   * ── PRZYPIĘCIE KOLUMNY PRZY PRZEWIJANIU POZIOMYM (opt-in, 2026-09-05) ─────
   *
   * Po co: raport KPI (SSOT `docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md`
   * §6) ma dwanaście kolumn okresów przewijanych poziomo, a kolumna MIERNIK
   * musi zostać widoczna z lewej, YTD i STAN z prawej. Do 2026-09-05 jądro
   * umiało przypiąć WYŁĄCZNIE strukturalną kolumnę akcji (`sticky right-0`),
   * więc każdy ekran, który potrzebował czegoś więcej, robił to sam —
   * prototyp P7K liczył offsety w `useEffect` z `getBoundingClientRect()`
   * i doklejał warianty `[&_td:nth-last-child(2)]:sticky`. To jest dokładnie
   * ten kształt, przed którym ostrzega „naprawa per-wywołanie odrasta":
   * mechanika należy do jądra, nie do wywołania.
   *
   * Offsety liczymy z TYCH SAMYCH szerokości, którymi renderują się komórki
   * (`columnFit.widths` → `columnWidths` → `parsePx(column.width)`), więc
   * nagłówek i wiersz nigdy się nie rozjadą — bez pomiaru DOM po renderze.
   *
   * ADDYTYWNE: bez tego pola tabela zachowuje się co do piksela jak dotąd
   * (`pinnedLayout` jest wtedy pustym obiektem i żadna komórka nie dostaje
   * ani jednej dodatkowej klasy).
   */
  pinned?: 'left' | 'right';
  render?: (row: any) => React.ReactNode;
}

// Canon §3.3 — map column.align to a Tailwind text-align utility (left = default).
const alignToClass = (align?: TableColumn['align']): string =>
  align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

// Row data
export interface TableRow {
  id: string;
  [key: string]: any;
}

interface FilterableTableProps {
  columns: TableColumn[];
  data: TableRow[];
  /** Optional: highlight a selected row (for Table+Preview layouts). */
  selectedRowId?: string | null;
  onRowClick?: (row: TableRow) => void;
  onRowDoubleClick?: (row: TableRow) => void;
  onRowAction?: (action: string, row: TableRow) => void;
  /** Optional: override the row actions menu contents. */
  getRowActions?: (row: TableRow) => RowAction[];
  /**
   * Triada standard: LONG contextual kebab as SECTIONS (status actions on top,
   * Delete at the bottom — wzór: menu Decisions). Takes precedence over
   * `getRowActions` when provided.
   */
  getRowActionSections?: (row: TableRow) => RowActionSection[];
  /** Optional: hide the row actions menu column. */
  hideRowActions?: boolean;
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  /**
   * R04-2C: `ReactNode`, nie `string` — fasada `StandardTable` przekazuje tu
   * bogaty stan pusty (ikona + tytuł + opis + CTA). Wcześniej typ `string`
   * zmuszał ją do renderowania `EmptyState` ZAMIAST tabeli, przez co nagłówek
   * i geometria znikały — wprost wbrew §5 („empty state zachowuje nagłówek
   * i geometrię tabeli"). Zwykły string nadal działa bez zmian.
   */
  emptyMessage?: React.ReactNode;
  /**
   * Komunikat dla stanu „filtry nie dały wyniku" (§5 Stany). Odrębny od
   * `emptyMessage`, który opisuje brak danych w ogóle. Opcjonalny — bez niego
   * używany jest kanoniczny fallback i przycisk resetu filtrów.
   */
  emptyFilteredMessage?: React.ReactNode;
  /** Outer padding of the table canvas (not the surface). */
  canvasClassName?: string;
  /** Controls row/header density. */
  density?: 'comfortable' | 'compact';
  /** Show the table header settings (columns) button. */
  enableColumnSettings?: boolean;
  /**
   * Opt-in localStorage persistence of column widths + visibility/order. When
   * set, resizing / hiding / reordering columns survives reload. Default off,
   * so existing callers are unaffected. (V-B — the canonical fix for the
   * module-wide "resize lost on reload" bug; one place instead of per-table.)
   */
  persistKey?: string;
  /**
   * Opt-in row selection. Drives the leading `type: 'select'` column: the header
   * renders a select-all checkbox (indeterminate when partial) and each row
   * renders a row checkbox. Omit to leave existing tables unaffected (canon §3.5).
   */
  selection?: {
    selectedIds: Set<string> | string[];
    onToggleRow: (id: string) => void;
    onToggleAll: () => void;
    isAllSelected: boolean;
    isIndeterminate: boolean;
    selectRowLabel?: string;
    selectAllLabel?: string;
  };
  /** Initial sort applied when columns declare `sortable` (Triada standard). */
  defaultSort?: { columnId: string; direction: 'asc' | 'desc' } | null;
  /**
   * Triada standard: optional per-row description line rendered under the
   * primary (first data) column, toggled via the canonical Settings2 →
   * TableSettingsPopover ("Show row description"). Providing this prop also
   * switches the column settings trigger from the legacy ColumnSelector to
   * TableSettingsPopover.
   */
  rowDescription?: {
    render: (row: TableRow) => React.ReactNode;
    show: boolean;
    onToggle: (value: boolean) => void;
    label?: string;
    columnsHeading?: string;
    settingsLabel?: string;
  };
  /**
   * Opt-in extra class(es) appended to a row's `<tr>` — e.g. group-header
   * styling for grouped-rows layouts (Inbox). Purely additive: the base
   * selected/hover classes are always applied first, this is appended after.
   * Omit for zero visual change (default undefined → no-op).
   */
  rowClassName?: string | ((row: TableRow) => string);
  /**
   * ── WIERSZ GRUPUJĄCY (opt-in, 2026-09-05) ────────────────────────────────
   *
   * Po co: raport KPI grupuje mierniki po OBSZARZE (SSOT §6, werdykt K6:
   * „wiersz grupy = jedna komórka na całą szerokość (`colSpan`) z nazwą grupy
   * i właścicielem nadrzędnym; zero »—« w wierszu grupy"). Bez tego wiersz
   * grupy przechodził przez normalną ścieżkę komórek i każda kolumna, której
   * grupa nie ma, rysowała „—".
   *
   * `isGroupRow(row)` decyduje, `renderGroupRow(row)` daje treść. Komórka
   * dostaje `colSpan` na wszystkie widoczne kolumny + strukturalną kolumnę
   * akcji, nieprzezroczyste tło (inaczej przewijana treść przebija spod
   * przypiętych kolumn) i sticky-owiniętą treść, żeby nazwa grupy została
   * widoczna także po przewinięciu w prawo.
   *
   * ADDYTYWNE: bez `isGroupRow` żaden wiersz nie wchodzi w tę gałąź.
   */
  isGroupRow?: (row: TableRow) => boolean;
  renderGroupRow?: (row: TableRow) => React.ReactNode;
  /**
   * ── STARTOWE PRZEWINIĘCIE DO KOLUMNY (opt-in, 2026-09-05) ────────────────
   *
   * SSOT raportu KPI §6: „kolumny okresów przewijane, (…) domyślnie
   * przewinięte do bieżącego miesiąca". Bez tego raport otwiera się na
   * STYCZNIU i użytkownik za każdym razem przewija do miesiąca, o który mu
   * chodzi. Offset liczymy z TYCH SAMYCH szerokości, którymi renderują się
   * komórki — bez mierzenia DOM po renderze.
   *
   * Działa RAZ, przy pierwszym pojawieniu się kolumny o tym id; późniejsze
   * przewinięcie użytkownika nie jest nadpisywane. Bez propa — zero zmiany.
   */
  scrollToColumnId?: string | null;
  /**
   * ── Minimalna szerokość elementu `table` (opt-in) ─────────────────────────
   *
   * (W komentarzach tego pliku NIE piszemy znacznika `table` w ostrych
   * nawiasach — `scripts/check-list-canon.sh` szuka go tekstowo i uznałby
   * wzmiankę w prozie za drugą, nieoznaczoną tabelę, przez co znacznik
   * §27-exempt przestałby obejmować `thead`/`tbody` niżej.)
   *
   * Do tej pory element `table` miał ZAHARDKODOWANE `min-width: 980px` bez żadnego
   * wyjścia. Na telefonie (kontener ~244 px przy oknie 320 px) oznaczało to
   * 736 px poziomego przewijania UKRYTEGO wewnątrz `overflow-x-auto` — metryka
   * strony zostawała czysta (`documentElement.scrollWidth === innerWidth`),
   * a treść wiersza i tak była ucięta. Moduł, który świadomie deklaruje na
   * wąskim ekranie JEDNĄ kolumnę, nie miał jak tego wyłączyć.
   *
   * Prop jest ADDYTYWNY. Domyślna wartość odtwarza dotychczasowe 980 px
   * co do piksela, więc ~100 istniejących list (My Work, Audits, Interview,
   * Initiatives, Execution, Results, Finance, Materiały, Meeting, Admin…)
   * zachowuje się identycznie jak przed zmianą.
   *
   *  · `number`    → dokładnie ta wartość w px (domyślnie `DEFAULT_MIN_TABLE_WIDTH`),
   *  · `'auto'`    → BEZ `min-width`; tabela zwęża się do kontenera,
   *  · `'columns'` → wariant wyliczany: gdy widocznych kolumn danych jest
   *                  ≤ `AUTO_MIN_WIDTH_COLUMN_THRESHOLD`, `min-width` znika;
   *                  powyżej — wraca `DEFAULT_MIN_TABLE_WIDTH`. Kolumna
   *                  zaznaczenia (`type: 'select'`) i strukturalna kolumna
   *                  akcji NIE liczą się jako kolumny danych.
   */
  minTableWidth?: number | 'auto' | 'columns';
}

/**
 * Dotychczasowa, zahardkodowana wartość — teraz jawna domyślka propa
 * `minTableWidth`. Zmiana tej stałej zmienia KAŻDĄ listę w produkcie.
 */
export const DEFAULT_MIN_TABLE_WIDTH = 980;

/**
 * Próg dla `minTableWidth="columns"`: przy jednej lub dwóch kolumnach danych
 * wymuszanie 980 px nie daje nic poza ukrytym przewijaniem.
 */
export const AUTO_MIN_WIDTH_COLUMN_THRESHOLD = 2;

/**
 * Szerokość strukturalnej kolumny akcji (kebab + Settings2) w px — musi być
 * zgodna z klasą `w-20` na jej `th`/`td`. Kolumna jest `sticky right-0`, więc
 * przy przepełnieniu przykrywa ogon ostatniej kolumny danych; dlatego wchodzi
 * do bilansu szerokości w `columnFit`.
 */
export const ROW_ACTIONS_COLUMN_WIDTH = 80;

export const COLUMN_MIN_WIDTH_BY_DATA_TYPE: Record<
  NonNullable<TableColumn['dataType']>,
  number
> = {
  text: 140,
  status: 130,
  date: 110,
  owner: 150,
  number: 90,
};

const getColumnTypeFloor = (column: TableColumn): number => {
  if (column.id === 'title' || column.id === 'name') return 200;
  if (column.type === 'select') return 90;
  return COLUMN_MIN_WIDTH_BY_DATA_TYPE[column.dataType ?? 'text'];
};

export const HEADER_HORIZONTAL_PADDING_PX = 32;
export const HEADER_SORT_BUDGET_PX = 16;
export const HEADER_FILTER_BUDGET_PX = 26;
const HEADER_TRACKING_PX = 0.55;

/**
 * Podłogi używane WYŁĄCZNIE przy dopasowaniu do kontenera (`columnFit`).
 *
 * Świadomie NIŻSZE niż `minWidth` z `ColumnConfig` (90 / 200 px), bo tamte są
 * podłogami RĘCZNEGO resize'u — użytkownik nie ma prawa zwęzić kolumny poniżej.
 * Przy dopasowaniu automatycznym te same wartości blokowały naprawę: tabela
 * o 14 kolumnach ma sumę podłóg 200 + 13×90 = 1370 px, czyli więcej niż typowy
 * obszar 1286 px — dopasowanie by się nie odpaliło i ostatnia kolumna dalej
 * chowałaby się pod przypiętą kolumną akcji. Wartości wyprowadzone z pomiaru, nie z oka: komórka ma
 * `px-4` (2×16 px), a nagłówek dodatkowo ikonę sortowania (~16 px), więc przy
 * 112 px zostaje 80 px na treść (mieści „Nieznane", „15 wrz 2026") i 64 px na
 * słowo nagłówka. Przy 84 px zostawało 39 px i nagłówki łamały się co cztery
 * litery („GOTO WOŚĆ") — sprawdzone zrzutem, odrzucone.
 */
export const FIT_MIN_COLUMN_WIDTH = COLUMN_MIN_WIDTH_BY_DATA_TYPE.number;
export const FIT_MIN_PRIMARY_COLUMN_WIDTH = 200;

export const getColumnFitFloor = (column: TableColumn, configuredFloor?: number): number =>
  Math.max(
    getColumnTypeFloor(column),
    column.id === 'title' || column.id === 'name'
      ? FIT_MIN_PRIMARY_COLUMN_WIDTH
      : FIT_MIN_COLUMN_WIDTH,
    configuredFloor ?? 0
  );

/**
 * ŁAMANIE TEKSTU W KOMÓRCE — granica wyrazu, nigdy środek wyrazu (2026-08-30).
 *
 * Skąd to się wzięło: commit „ostatnia kolumna przestaje być ucinana" dołożył
 * `break-words` do nagłówków i komórek, żeby długie etykiety nie wylewały się
 * poza kolumnę i nie chowały pod przypiętą (`sticky right-0`) kolumną akcji.
 * `break-words` to w Tailwind 3.4 (`corePlugins.js:1605`) DOKŁADNIE
 * `overflow-wrap: break-word` — a ta reguła z definicji rozrywa wyraz, który
 * sam z siebie nie mieści się w linii. Po zwężeniu kolumn odpaliła realnie
 * i produkt zaczął pokazywać „ZAKTUALI ZOWANO", „OGÓLNA INTERPRETAC JA",
 * „engineerin g team", „Ograniczen ie". To NIE było `word-break: break-all`
 * (tej klasy w pliku nigdy nie było) — sprawdzone w źródle Tailwinda.
 *
 * Oba skrajne zachowania są złe: bez łamania tekst ucieka poza komórkę,
 * z `overflow-wrap: break-word` rozrywa się w połowie wyrazu. Trzecia droga,
 * zmierzona w Chromium przed wdrożeniem:
 *   `break-normal`   → `overflow-wrap: normal` — łam TYLKO na spacji,
 *   `overflow-hidden`+`text-ellipsis` → wyraz szerszy niż kolumna dostaje
 *                      wielokropek zamiast rozdarcia.
 * `text-overflow: ellipsis` działa także przy zawijaniu (`white-space: normal`),
 * nie tylko przy `nowrap` — zmierzone: „OGOLNA / INTERPR…", nie „INTERPRETAC / JA".
 *
 * ŚWIADOMIE stosowane na WARSTWIE TEKSTU (span etykiety, span wartości), a NIE
 * na `th`/`td`. Powód: `overflow: hidden` na komórce przycięłoby popovery i menu,
 * które komórki renderują (filtr w nagłówku, kebab, chipy z tooltipem) — dlatego
 * `break-words` zostaje na samej komórce jako ostatnia deska ratunku dla treści
 * renderowanej przez moduł jako ELEMENTY. `overflow-wrap` jest dziedziczone,
 * więc `break-normal` na spanie musi być podane jawnie, żeby zbić to z komórki.
 *
 * Pełna treść nie ginie: element dostaje `title` z całym tekstem.
 */
export const CELL_TEXT_CLAMP_CLASS = 'block break-normal overflow-hidden text-ellipsis';

/**
 * WARSTWA DLA TREŚCI RENDEROWANEJ PRZEZ MODUŁ JAKO ELEMENTY (2026-09-02).
 *
 * Dlaczego istnieje: `CELL_TEXT_CLAMP_CLASS` chroni tylko GOŁY tekst zwrócony
 * z `render` (string/number). Gdy moduł zwraca własne ELEMENTY (`<div>`, `<span>`,
 * chip, dwie linie), tekst siedzi bezpośrednio pod `td`, które nosi `break-words`
 * (`overflow-wrap: break-word`) — i dziedziczy je. To była OSTATNIA nienaprawiona
 * kondygnacja rodziny „ucięć": po naprawie procentów w `parsePx` kolumna nie
 * zapada się już do kilkunastu pikseli, ale przy wąskiej kolumnie NADAL rozrywała
 * wyraz w połowie. Zmierzone 2026-09-02 na zrzutach: `results-zestawienia`
 * („3 wskaźnik / i" — kolumna 90 px, `render` zwraca `<span>`),
 * `chat-signals-feed` („Interpretac / ja AI" — `render` zwraca dwuliniowy `<div>`).
 *
 * Co robi: zbija dziedziczone `overflow-wrap` z powrotem do `normal`, czyli
 * łamanie WYŁĄCZNIE na spacji — dokładnie ta sama reguła, którą kanon
 * (`TRIADA_KANON.md`, komentarz przy `CELL_TEXT_CLAMP_CLASS`) narzuca tekstowi.
 *
 * Czego ŚWIADOMIE nie robi: nie ma `overflow-hidden`. Powód jest ten sam, dla
 * którego `td` go nie ma — komórki renderują popovery i menu bez portalu
 * (`PMO/StatusTransitionDropdown.tsx` w `assessment/InitiativesTable.tsx`),
 * a `overflow: hidden` przyciąłby je do szerokości kolumny. Wielokropek dla
 * treści elementowej jest odpowiedzialnością modułu (`truncate` na własnym
 * spanie), łamanie w połowie wyrazu — nie jest i nie może być.
 */
export const CELL_ELEMENT_WRAP_CLASS = 'min-w-0 break-normal';

const OverflowTooltip: React.FC<{
  content: string;
  className: string;
  children?: React.ReactNode;
}> = ({ content, className, children }) => {
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return undefined;
    const measure = () => setIsOverflowing(element.scrollWidth > element.clientWidth);
    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [content]);

  return (
    <Tooltip content={content} delay={0} disabled={!isOverflowing}>
      <span className={`min-w-0 flex-1 ${className}`} data-overflow-tooltip-trigger>
        <span ref={textRef} className={className} data-overflow-tooltip-text>
          {children ?? content}
        </span>
      </span>
    </Tooltip>
  );
};

// True when a regular cell value should render as an em-dash placeholder
// (null / undefined / empty-or-whitespace string).
const isEmptyCell = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

// Progress bar component
// Per Table+Preview canon §4.0/§4.3: progress is NEVER red/crimson. Generic
// progress uses an info/neutral fill while in-progress and transitions to
// success (HBS green) at 100%. `warning` (amber) is reserved for modules that
// explicitly compute an at-risk state — this shared component does not.
const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 bg-c-border-subtle rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${
          progress === 100 ? 'bg-c-success' : 'bg-c-info'
        }`}
        style={{ width: `${progress}%` }}
      />
    </div>
    {/* slate-600, nie slate-500: ta komórka renderuje się też na podbarwionym
        tle wiersza zaznaczonego — slate-500 dawał tam ~4.0-4.3:1 zamiast 4,5:1
        (axe: color-contrast, zmierzone na kilku ekranach Assessment po
        otwarciu podglądu; ten sam komponent renderuje się szeroko w apce). */}
    <span className="text-xs text-slate-600 dark:text-slate-400 w-8">{progress}%</span>
  </div>
);

// Filter dropdown component
const FilterDropdown: React.FC<{
  column: TableColumn;
  activeValues: string[];
  onApply: (values: string[]) => void;
}> = ({ column, activeValues, onApply }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(activeValues);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleToggle = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleApply = () => {
    onApply(selected);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelected([]);
    onApply([]);
    setIsOpen(false);
  };

  const closeAndReturnFocus = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  // A11y (RV-009/RB decision #4, CODEX pass 2): this is a non-modal
  // disclosure popover, NOT a dialog — it must never trap Tab. Escape closes
  // it and returns focus to the trigger; Tab is left completely alone so it
  // moves focus in the normal document order (which, once it leaves the
  // panel, closes the popover via the blur handler below instead of leaving
  // a stale open panel with focus elsewhere on the page).
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeAndReturnFocus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeAndReturnFocus]);

  // Closing on blur-out (Tab leaving the panel) — focus is left wherever the
  // browser's normal Tab order sends it; only the popover's open state is
  // cleared, so this never fights the trigger's Escape/click focus-return.
  const handlePanelBlur = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    const nextFocusTarget = event.relatedTarget as Node | null;
    if (nextFocusTarget && event.currentTarget.contains(nextFocusTarget)) return;
    setIsOpen(false);
  }, []);

  if (!column.filterable || !column.filterOptions) return null;

  const activeCount = activeValues.length;
  const filterButtonLabel =
    activeCount > 0
      ? t('common.filterColumnActive', 'Filter {{column}} (active: {{count}})', {
          column: column.label,
          count: activeCount,
        })
      : t('common.filterColumnInactive', 'Filter {{column}}, no filter applied', {
          column: column.label,
        });
  const panelHeadingId = `filter-panel-${column.id}`;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={filterButtonLabel}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`p-1 rounded-md hover:bg-state-hover transition-colors ${
          activeValues.length > 0 ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500'
        }`}
      >
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeAndReturnFocus} />
          <div
            ref={panelRef}
            role="group"
            aria-labelledby={panelHeadingId}
            onBlur={handlePanelBlur}
            className="absolute top-full left-0 mt-1 z-50 min-w-[180px] bg-white dark:bg-navy-900 border border-slate-200/70 dark:border-white/[0.08] rounded-xl shadow-xl overflow-hidden"
          >
            <h3 id={panelHeadingId} className="sr-only">
              {t('common.filterByColumn', 'Filter by {{column}}', { column: column.label })}
            </h3>
            <div className="max-h-[200px] overflow-y-auto p-2">
              {column.filterOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-state-hover cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => handleToggle(option.value)}
                    // TRIADA_KANON B.38/B.39 — jw.: lejek filtra kolumny miał
                    // crimsonowy checkbox i crimsonowy ring fokusa.
                    className="rounded border-navy-600 bg-slate-200 dark:bg-navy-700 text-c-info focus:ring-c-focus"
                  />
                  {option.color && <span className={`w-2 h-2 rounded-full ${option.color}`} />}
                  <span className="text-sm text-slate-700 dark:text-slate-200">{option.label}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between p-2 border-t border-slate-200/70 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-medium text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {t('common.clear', 'Clear')}
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-3 py-1 text-xs font-medium bg-c-text text-c-bg rounded-lg hover:bg-c-text-secondary transition-colors"
              >
                {t('common.apply', 'Apply')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ── Accessible column resize handle (R6-P1b a11y fix) ──────────────────────
// The shared `ColumnResizer` (`@/components/ui/ResizableTable/ColumnResizer.tsx`)
// renders a bare `<div onMouseDown>` with no `tabIndex`/keyboard handling —
// mouse users can resize columns, keyboard users cannot reach the handle at
// all. This is a LOCAL replacement scoped to `FilterableTable` (the canon
// list shell every `StandardTable` consumer renders through), not an edit to
// the shared `ColumnResizer` file — so the fix cannot regress the other four
// direct consumers of that file (MyTasksListContent/InboxContent/
// NotificationsContent/IdeasTableContent), which keep using the original,
// unmodified `ColumnResizer`.
//
// Pattern: WAI-ARIA APG "Window Splitter" (role="separator", resizable):
// https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
//   Tab             → focus the handle.
//   ArrowLeft/Right → shrink/grow by RESIZE_STEP px (Shift = large step).
//   Home / End      → jump to minWidth / maxWidth.
//   Escape          → revert to the width the column had when the handle
//                      received focus (keyboard equivalent of releasing a
//                      drag without committing).
//
// Declared at MODULE scope, not inside FilterableTable's render body — an
// inline component definition there would get a NEW type identity on every
// FilterableTable re-render (e.g. the very next render after an ArrowRight
// keypress changes columnWidths), which unmounts/remounts the DOM node and
// silently drops keyboard focus after a single keystroke.
const RESIZE_STEP = 12;
const RESIZE_STEP_LARGE = 48;

const ColumnResizeHandle: React.FC<{
  columnId: string;
  resizeLabel: string;
  currentWidth: number;
  minWidth: number;
  maxWidth: number;
  onResize: (columnId: string, newWidth: number) => void;
}> = ({ columnId, resizeLabel, currentWidth, minWidth, maxWidth, onResize }) => {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const focusStartWidthRef = useRef(currentWidth);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      startXRef.current = e.clientX;
      startWidthRef.current = currentWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [currentWidth]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const delta = e.clientX - startXRef.current;
      const clamped = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + delta));
      onResize(columnId, clamped);
    },
    [isDragging, columnId, minWidth, maxWidth, onResize]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? RESIZE_STEP_LARGE : RESIZE_STEP;
      // stopPropagation on every handled key: proven necessary, not
      // defensive boilerplate — the app shell has a GLOBAL Escape listener
      // (return focus to the main content landmark on Escape, likely meant
      // for closing modals/dropdowns). Without stopPropagation, our
      // Escape correctly reverted the width but the global handler then
      // yanked focus off the handle onto that landmark right after —
      // confirmed via a live Playwright probe (`document.activeElement`
      // became the `<main>`-level wrapper, not the separator) before this
      // line was added. Same guard applied to the arrow/Home/End cases so a
      // future global arrow-key handler (e.g. row navigation) can't do the
      // same thing to those.
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          e.stopPropagation();
          onResize(columnId, Math.max(minWidth, currentWidth - step));
          break;
        case 'ArrowRight':
          e.preventDefault();
          e.stopPropagation();
          onResize(columnId, Math.min(maxWidth, currentWidth + step));
          break;
        case 'Home':
          e.preventDefault();
          e.stopPropagation();
          onResize(columnId, minWidth);
          break;
        case 'End':
          e.preventDefault();
          e.stopPropagation();
          onResize(columnId, maxWidth);
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onResize(columnId, focusStartWidthRef.current);
          break;
        default:
          break;
      }
    },
    [columnId, currentWidth, minWidth, maxWidth, onResize]
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={resizeLabel}
      aria-valuenow={Math.round(currentWidth)}
      aria-valuemin={Math.round(minWidth)}
      aria-valuemax={Math.round(maxWidth)}
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      onFocus={() => {
        focusStartWidthRef.current = currentWidth;
      }}
      className={`
        absolute -right-1.5 top-0 h-full w-3 cursor-col-resize
        touch-none select-none
        group/resizer
        outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-inset rounded-sm
        ${isDragging ? 'z-50' : 'z-10'}
      `}
      title={resizeLabel}
    >
      {/* Excel-like: grip sits exactly on the column boundary. */}
      <div
        className={[
          'absolute left-1/2 top-2 bottom-2 w-[2px] -translate-x-1/2 rounded-full transition-colors duration-150',
          // TRIADA_KANON B.38 — uchwyt resize to STAN UI, nie semantyka
          // krytyczna, więc nie może być crimsonem. Hover/drag/focus na
          // niebieskim `--c-focus-solid` (ten sam sygnał co fokus klawiatury).
          isDragging
            ? 'bg-[color:var(--c-focus-solid)]'
            : 'bg-slate-300/80 dark:bg-white/[0.10] group-hover/resizer:bg-[color:var(--c-focus-solid)] dark:group-hover/resizer:bg-[color:var(--c-focus-solid)] group-focus-visible/resizer:bg-[color:var(--c-focus-solid)]',
        ].join(' ')}
      />
    </div>
  );
};

export const FilterableTable: React.FC<FilterableTableProps> = ({
  columns,
  data,
  selectedRowId,
  onRowClick,
  onRowDoubleClick,
  onRowAction,
  getRowActions,
  getRowActionSections,
  hideRowActions = false,
  activeFilters,
  onFilterChange,
  emptyMessage = 'No items found',
  emptyFilteredMessage,
  canvasClassName = 'p-4',
  density = 'comfortable',
  enableColumnSettings = true,
  persistKey,
  selection,
  defaultSort = null,
  rowDescription,
  rowClassName,
  isGroupRow,
  renderGroupRow,
  scrollToColumnId = null,
  minTableWidth = DEFAULT_MIN_TABLE_WIDTH,
}) => {
  const horizontalViewportRef = useRef<HTMLDivElement>(null);
  const [horizontalViewportWidth, setHorizontalViewportWidth] = useState(0);

  useEffect(() => {
    const viewport = horizontalViewportRef.current;
    if (!viewport) return;

    const updateWidth = () => {
      const visibleWindowWidth = Math.max(
        0,
        window.innerWidth - viewport.getBoundingClientRect().left
      );
      setHorizontalViewportWidth(Math.min(viewport.clientWidth, visibleWindowWidth));
    };
    updateWidth();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewport);
    window.addEventListener('resize', updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const { t } = useTranslation();
  /**
   * ── R04-2A · wysokość rejestru ────────────────────────────────────────────
   *
   * Decyzja kanoniczna (2026-08-06): `CANON_TABLE.headerHeight` i `rowHeight`
   * = 56 px są NADRZĘDNE; padding jest wyłącznie wskazówką i nie wyznacza
   * wysokości końcowej. Do R04-2A wysokość była wypadkową paddingu i fontu
   * (≈44 px w `comfortable`, ≈36 px w `compact`) — czyli różna w dwóch trybach
   * i niemierzalna żadnym testem, bo nie istniała liczba do porównania.
   *
   * `h-14` = 56 px. W tabeli CSS `height` na komórce działa jak MINIMUM, więc
   * wiersz bazowy ma dokładnie 56 px, a wiersz z włączonym opisem może urosnąć —
   * to jest wymagane, bo slot opisu (`min-h-8`, cudza konsolidacja) sam w sobie
   * przekracza pozostałą przestrzeń. Zgodne z §5: wysokość jest STABILNA dla
   * danego trybu, a nie „identyczna niezależnie od treści".
   *
   * `density` zostaje w publicznym API i nadal steruje paddingiem — zmienia się
   * tylko to, że nie steruje już wysokością.
   *
   * Wiązanie `h-14` ↔ `CANON_TABLE.rowHeight` (56 px) egzekwuje test R04-2A,
   * a nie import — klasa jest STATYCZNA (`h-14`), nie budowana z `CANON_TABLE` szablonem —
   * Tailwind skanuje źródło tekstowo i klasy sklejanej w runtime nigdy by nie
   * wygenerował. Powiązanie `h-14` ↔ 56 px pilnuje test R04-2A.
   */
  const cellPadding = density === 'compact' ? 'px-4 py-2' : 'px-4 py-3';
  const ROW_HEIGHT_CLASS = 'h-14';

  // PPM-mirror (ANEKS #3b): right-click on a row opens the SAME
  // RowActionsMenu popover as its kebab, anchored at the cursor instead of
  // the button. One row can have an active context-menu point at a time.
  const [contextMenuRow, setContextMenuRow] = useState<{
    rowId: string;
    point: { x: number; y: number };
  } | null>(null);

  // Opt-in selection (canon §3.5). Normalize selectedIds to a Set for O(1) lookup.
  const selectedIdSet = useMemo(() => {
    if (!selection) return null;
    return selection.selectedIds instanceof Set
      ? selection.selectedIds
      : new Set(selection.selectedIds);
  }, [selection]);

  // V-B — persisted column layout (widths + visibility/order). Read on mount,
  // written on change. Keyed by `persistKey`; no-op when unset.
  const storageKey = persistKey ? `filterableTable.cols.${persistKey}` : null;
  const readPersisted = useCallback((): {
    widths?: Record<string, number>;
    visibility?: Record<string, boolean>;
    order?: Record<string, number>;
  } | null => {
    if (!storageKey || typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const parsePx = useCallback((value?: string, fallback = 140) => {
    if (!value) return fallback;
    const raw = String(value);
    const m = raw.match(/(\d+)\s*px/i);
    if (m?.[1]) return Number(m[1]);
    /**
     * KONTRAKT SZEROKOŚCI: TYLKO `px` (lub goła liczba), NIGDY `%`.
     *
     * Do 2026-09-02 nierozpoznana jednostka (`'26%'`, `'18%'`…) trafiała do
     * `.replace(/[^\d.]/g, '')`, które ucina WSZYSTKO poza cyframi — `'26%'`
     * staje się `26`, więc kolumna dostaje `width: 26px` zamiast 26% realnej
     * szerokości. Efekt: nagłówek/kolumna zapada się do kilkunastu pikseli,
     * a treść ucina się w połowie wyrazu BEZ udziału mechanizmu łamania tekstu
     * (`CELL_TEXT_CLAMP_CLASS`), bo ten dostaje kolumnę już przyciętą do
     * absurdu. Zmierzone na żywo: `ChatSignalsFeed.tsx` (`width: '10%'` →
     * `10px`), sześć kolejek w `MyWork/*DecisionQueue.tsx` (`'26%'`…), cztery
     * ekrany `Results/*.tsx` — rodzina nazwana w dyżurze „rodzina ucięć”.
     *
     * Procent string jest tu NIEROZPOZNAWALNY z zasady: `FilterableTable` ma
     * `table-fixed` i liczy budżet kolumn w PIKSELACH (`columnFit`,
     * `FIT_MIN_COLUMN_WIDTH`) — nie zna szerokości kontenera w momencie
     * definicji kolumny, więc nie ma z czego wyliczyć piksele z procentu.
     * Zamiast cichej degradacji do 1–2 cyfr, NIEROZPOZNANA jednostka (w tym
     * `%`) wraca do bezpiecznego `fallback` — tak samo jak pusty/NaN wpis.
     * W dev/test krzyczy w konsoli, żeby błąd był widoczny przy pierwszym
     * użyciu, nie dopiero na zrzucie ekranu.
     */
    if (raw.includes('%')) {
      if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error(
          `[FilterableTable] Kolumna deklaruje width="${raw}" — procenty nie są obsługiwane ` +
            `(kontrakt: tylko px). Wartość zignorowana, użyto fallbacku ${fallback}px. ` +
            `Zamień na px w definicji kolumny.`
        );
      }
      return fallback;
    }
    const n = Number(raw.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }, []);

  const defaultColumnConfigs = useMemo<ColumnConfig[]>(() => {
    let measureContext: CanvasRenderingContext2D | null = null;
    try {
      if (typeof document !== 'undefined') {
        measureContext = document.createElement('canvas').getContext('2d');
        if (measureContext) measureContext.font = '600 11px Inter, system-ui, sans-serif';
      }
    } catch {
      measureContext = null;
    }

    return columns.map((c, idx) => {
      const measuredLabelWidth = measureContext?.measureText(c.label.toUpperCase()).width;
      const measuredHeaderFloor =
        typeof measuredLabelWidth === 'number' &&
        Number.isFinite(measuredLabelWidth) &&
        measuredLabelWidth > 0
          ? Math.ceil(
              measuredLabelWidth +
                /**
                 * BŁĄD O JEDEN (pomiar 2026-09-05, prototyp P7K KROK 1c).
                 *
                 * Było `label.length - 1` — w założeniu „odstępy tylko MIĘDZY
                 * literami". CSS `letter-spacing` (`tracking-wider` = 0,05em)
                 * dokłada odstęp TAKŻE PO ostatnim znaku, więc naturalna
                 * szerokość nagłówka jest o jeden odstęp większa niż budżet.
                 * Podłoga wychodziła o ~0,5–1 px za mała i nagłówek dostawał
                 * wielokropek mimo „zmieszczonej" kolumny: zmierzone na KPI L2
                 * — „BENCHMARK" (9 znaków) w kolumnie 109 px renderowało się
                 * jako „BENCHMA…", choć formuła liczyła, że się mieści.
                 * Dowód mutacyjny: przywrócenie `- 1` łamie test
                 * „budżet odstępów liter obejmuje znak ostatni".
                 */
                c.label.length * HEADER_TRACKING_PX +
                HEADER_HORIZONTAL_PADDING_PX +
                (c.sortable ? HEADER_SORT_BUDGET_PX : 0) +
                (c.filterable ? HEADER_FILTER_BUDGET_PX : 0)
            )
          : 0;
      const floor = Math.max(getColumnTypeFloor(c), measuredHeaderFloor);
      return {
        id: c.id,
        label: c.label,
        visible: c.defaultVisible !== false,
        order: idx,
        width: Math.max(
          parsePx(c.width, c.id === 'title' || c.id === 'name' ? 260 : 140),
          floor
        ),
        minWidth: floor,
        maxWidth: c.id === 'title' || c.id === 'name' ? 520 : 320,
        required: c.id === 'title' || c.id === 'name',
      };
    });
  }, [columns, parsePx]);

  // Merge persisted layout onto the column defaults (V-B).
  const mergePersisted = useCallback(
    (configs: ColumnConfig[]): { configs: ColumnConfig[]; widths: Record<string, number> } => {
      const persisted = readPersisted();
      const widths: Record<string, number> = {};
      const merged = configs.map((c) => {
        const w = persisted?.widths?.[c.id];
        const vis = persisted?.visibility?.[c.id];
        const ord = persisted?.order?.[c.id];
        const width = Math.max(
          typeof w === 'number' && w > 0 ? w : (c.width ?? 140),
          c.minWidth ?? 90
        );
        widths[c.id] = width;
        return {
          ...c,
          width,
          visible: typeof vis === 'boolean' ? vis : c.visible,
          order: typeof ord === 'number' ? ord : c.order,
        };
      });
      return { configs: merged, widths };
    },
    [readPersisted]
  );

  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>(
    () => mergePersisted(defaultColumnConfigs).configs
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    () => mergePersisted(defaultColumnConfigs).widths
  );

  // Keep column settings in sync when columns change (e.g., tab switch),
  // re-applying any persisted layout.
  useEffect(() => {
    const { configs, widths } = mergePersisted(defaultColumnConfigs);
    setColumnConfigs(configs);
    setColumnWidths(widths);
  }, [defaultColumnConfigs, mergePersisted]);

  // Persist layout whenever it changes (V-B).
  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      const widths: Record<string, number> = {};
      const visibility: Record<string, boolean> = {};
      const order: Record<string, number> = {};
      for (const c of columnConfigs) {
        widths[c.id] = columnWidths[c.id] ?? c.width ?? 140;
        visibility[c.id] = c.visible !== false;
        order[c.id] = c.order ?? 0;
      }
      window.localStorage.setItem(storageKey, JSON.stringify({ widths, visibility, order }));
    } catch {
      /* quota / SSR — non-fatal */
    }
  }, [columnConfigs, columnWidths, storageKey]);

  /**
   * ── KOLEJNOŚĆ KOLUMN: ZAPISANA TYLKO WTEDY, GDY JEST JEDNOZNACZNA ─────────
   *
   * DEFEKT ZMIERZONY 2026-09-05 na raporcie KPI (poziom 2), zrzut
   * `evidence/p7k-a-kpi/L2-raport--light.png` z pierwszego przelotu:
   * kolejność kolumn wyszła „MIERNIK · STY 2026 · YTD · LUT 2026 · STAN ·
   * MAR 2026…", czyli YTD i STAN wylądowały W ŚRODKU miesięcy.
   *
   * Przyczyna: ekran z DYNAMICZNYM zestawem kolumn renderuje się najpierw bez
   * nich (matryca okresów jeszcze leci), więc `persist` zapisuje kolejność dla
   * KRÓTKIEJ listy (…, ytd=7, state=8). Po dojściu danych dochodzi dwanaście
   * kolumn okresów o indeksach 7…18 — i `order` zapisane dla `ytd`/`state`
   * ZDERZA SIĘ z indeksami nowych kolumn. Sort po zderzonych wartościach
   * przeplata jedne z drugimi. To NIE jest problem tego jednego ekranu:
   * dotyczy każdej tabeli, której zestaw kolumn zmienia się w czasie.
   *
   * Reguła: zapisana kolejność jest używana WYŁĄCZNIE gdy jest kompletna
   * i różnowartościowa dla BIEŻĄCEGO zestawu kolumn. Gdy się zderza — znaczy,
   * że pochodzi z innego zestawu i wygrywa kolejność DEKLARACJI modułu.
   * Układ użytkownika nie ginie: gdy tylko zapisze się dla pełnego zestawu,
   * znów jest jednoznaczny i znów obowiązuje.
   */
  const visibleColumns = useMemo(() => {
    const byId = new Map(columnConfigs.map((c) => [c.id, c]));
    const widoczne = columns.filter((c) => byId.get(c.id)?.visible !== false);
    const kolejnosci = widoczne.map((c) => byId.get(c.id)?.order);
    const kompletna = kolejnosci.every((o) => typeof o === 'number');
    const jednoznaczna = new Set(kolejnosci).size === kolejnosci.length;
    if (!kompletna || !jednoznaczna) return widoczne;
    return [...widoczne].sort((a, b) => (byId.get(a.id)!.order ?? 0) - (byId.get(b.id)!.order ?? 0));
  }, [columns, columnConfigs]);

  /**
   * Rozwiązanie `minTableWidth` → konkretna wartość `style.minWidth` albo
   * `undefined` (brak wymuszenia). `undefined` jest tu ZAMIERZONE: React
   * pomija właściwość, więc tabela (`w-full table-fixed`) zwęża się do
   * kontenera i poziome przewijanie wewnątrz `overflow-x-auto` znika.
   */
  const resolvedMinTableWidth = useMemo<number | undefined>(() => {
    if (minTableWidth === 'auto') return undefined;
    if (minTableWidth === 'columns') {
      const dataColumnCount = visibleColumns.filter((c) => c.type !== 'select').length;
      return dataColumnCount <= AUTO_MIN_WIDTH_COLUMN_THRESHOLD
        ? undefined
        : DEFAULT_MIN_TABLE_WIDTH;
    }
    return minTableWidth;
  }, [minTableWidth, visibleColumns]);

  /**
   * ── `min-width` NIE MOŻE być szersze niż realny kontener ───────────────────
   *
   * DRUGA, NIEZALEŻNA przyczyna „uciętej ostatniej kolumny" (pomiar 2026-09-01).
   * `DEFAULT_MIN_TABLE_WIDTH` = 980 px było narzucane BEZWARUNKOWO — także gdy
   * obszar tabeli był węższy (otwarty podgląd zabiera ~410 px z 1398 px).
   * Wtedy `min-width` SAM wytwarzał nadmiar, mimo że kolumny mieściły się bez
   * problemu, a przypięta kolumna akcji zasłaniała ogon ostatniej kolumny.
   *
   * Dowód arytmetyczny z przelotu przez 94 ekrany listowe: na DZIESIĘCIU
   * ekranach nadmiar równał się CO DO PIKSELA `980 − szerokość kontenera`
   * (audyty-drd-report 934→46, execution-tab-control 943→37,
   * partner-settlements-view 954→26, agent-hub 957→23, execution-tab-work
   * 966→14, interview-sessions-status 967→13, assessment-five-surfaces
   * 971→9, report-builder-block-types 974→6 …). Taka zgodność nie jest
   * przypadkiem — to podpis tej jednej przyczyny.
   *
   * `min-width` ma bronić przed ZAPADNIĘCIEM tabeli, a nie rozpychać ją ponad
   * dostępny obszar; przed zapadnięciem broni dziś `columnFit` (podłogi
   * czytelności). Dlatego przycinamy je do realnej szerokości kontenera.
   */
  const effectiveMinTableWidth = useMemo<number | undefined>(() => {
    if (resolvedMinTableWidth === undefined) return undefined;
    if (horizontalViewportWidth <= 0) return resolvedMinTableWidth;
    return Math.min(resolvedMinTableWidth, horizontalViewportWidth);
  }, [resolvedMinTableWidth, horizontalViewportWidth]);

  /**
   * ── Dopasowanie kolumn do kontenera (defekt „ucięta ostatnia kolumna") ────
   *
   * MECHANIZM DEFEKTU. Nagłówek renderował KAŻDĄ kolumnę na jej zadeklarowanej
   * szerokości w pikselach (`width: ${width}px`) i nigdy nie porównywał SUMY
   * tych szerokości z realną szerokością kontenera. Przy `table-fixed` suma
   * wygrywa: element tabeli rozpycha się ponad `overflow-x-auto`, a strukturalna
   * kolumna akcji (`sticky right-0`, 80 px) parkuje NAD ogonem ostatniej
   * widocznej kolumny danych. Efekt na zrzucie: nagłówek i wartości ostatniej
   * kolumny przecięte w pionie w połowie znaku („KOSZT OPÓŹNIENIA" → „KOS
   * OPÓŹN", „Nieznane" → „Niezna"). Zmierzone: plan-scenario-d1 — 14 kolumn
   * danych, tabela 2140 px w obszarze 1366 px (nadmiar 774 px).
   *
   * NAPRAWA JEST TUTAJ, a nie w ekranach. Poprzednia próba łatania szerokości
   * per wywołanie odrosła po ośmiu tygodniach w kilkunastu plikach; `min-width`
   * przy `table-fixed` niczego nie ratuje, bo to on wymusza nadmiar.
   *
   * ZASADA: gdy naturalna szerokość (suma kolumn + kolumna akcji) przekracza
   * dostępny obszar, skalujemy kolumny PROPORCJONALNIE w dół, z podłogą
   * `FIT_MIN_COLUMN_WIDTH` / `FIT_MIN_PRIMARY_COLUMN_WIDTH` per kolumna;
   * kolumna zaznaczenia (44 px) nie kurczy się nigdy.
   * Gdy nawet podłogi się nie mieszczą, zostaje UCZCIWE przewijanie poziome —
   * dokładnie jak dotąd, bez cichego chowania treści.
   *
   * BRAK ZMIANY dla list, które już się mieszczą: `scale === 1`, wartości
   * `width` identyczne co do piksela jak przed zmianą.
   */
  const columnFit = useMemo<{ widths: Record<string, number>; scale: number }>(() => {
    const declared = visibleColumns.map((c) => {
      const width = columnWidths[c.id] ?? parsePx(c.width, 140);
      const isPrimary = c.id === 'title' || c.id === 'name';
      const configuredFloor = columnConfigs.find((config) => config.id === c.id)?.minWidth;
      return {
        id: c.id,
        isSelect: c.type === 'select',
        isPrimary,
        width,
        // Kolumna węższa niż podłoga zostaje na swojej szerokości — podłoga
        // nigdy nie ROZPYCHA, tylko ogranicza kurczenie.
        floor: Math.min(width, getColumnFitFloor(c, configuredFloor)),
      };
    });
    const widths: Record<string, number> = {};
    for (const c of declared) widths[c.id] = c.width;

    const actionsWidth = hideRowActions ? 0 : ROW_ACTIONS_COLUMN_WIDTH;
    const natural = declared.reduce((sum, c) => sum + c.width, 0) + actionsWidth;
    const available = Math.max(horizontalViewportWidth, effectiveMinTableWidth ?? 0);
    if (horizontalViewportWidth <= 0 || available <= 0 || natural <= available) {
      return { widths, scale: 1 };
    }

    const fixedTotal = declared.filter((c) => c.isSelect).reduce((sum, c) => sum + c.width, 0);
    let pool = declared.filter((c) => !c.isSelect);
    let budget = available - actionsWidth - fixedTotal;
    const floorTotal = pool.reduce((sum, c) => sum + Math.min(c.floor, c.width), 0);
    /**
     * NAWET PODŁOGI SIĘ NIE MIESZCZĄ.
     *
     * Do 2026-09-01 ta gałąź zwracała szerokości ZADEKLAROWANE, w założeniu
     * „uczciwe przewijanie poziome, zero udawania". Pomiar pokazał, że to
     * założenie jest FAŁSZYWE, bo kolumna akcji jest `sticky right-0`
     * (kanon TRIADA B.16 / R09-1a — ikona jest OBOWIĄZKOWA na każdym odbiorze,
     * więc odpięcie jej nie wchodzi w grę). Przy przepełnieniu przypięta
     * kolumna nie „zostawia treść do doscrollowania" — ona ją PRZYKRYWA.
     *
     * Zmierzone (`inicjatywy-lista`, podgląd OTWARTY, 1440×900):
     *   kontener 989 px · tabela 1810 px · nadmiar 821 px · sticky od 926 px
     *   → PIĘĆ kolumn danych zasłoniętych; nagłówek „NASTĘPNE DZIAŁANIE"
     *     czytany jako „NAS/DZIA", wartość „Zweryfikuj efekty" jako „Zwer".
     * KLUCZOWE: każdy span miał `scrollWidth === clientWidth`, czyli ŻADEN
     * tekst nie przepełniał własnego boksu. To nie było ucięcie tekstu i
     * wielokropek nie miał tu nic do roboty — to była czysta OKLUZJA.
     *
     * Gałąź zwracała przy tym MAKSYMALNY możliwy nadmiar (821 px zamiast
     * 279 px, jakie dałyby same podłogi), więc była ściśle najgorszym
     * z wariantów: im ciaśniej, tym bardziej się rozpychała.
     *
     * ZMIERZONA GRANICA TEJ POPRAWKI (próba odrzucona, zrzut w
     * `evidence/grafika/193-proba-scisk/`): „dopasuj ZAWSZE", czyli skalowanie
     * podłóg współczynnikiem `budget/floorTotal`, faktycznie zeruje nadmiar
     * i okluzję — ale przy 10 kolumnach schodzi do 86 px na kolumnę i wtedy
     * `nextAction` łamie się W POŁOWIE WYRAZU („Zweryfik/uj efekty",
     * „Monitoru/j/realizacj/ę"), a wiersz puchnie z kanonicznych 56 px do
     * ~130 px. To zamiana okluzji na DWA defekty naraz, w tym złamanie
     * zamrożonej wysokości wiersza. Dlatego podłóg NIE przekraczamy.
     *
     * Zostaje więc poprawka OGRANICZONA, ale ściśle lepsza: gdy podłogi się
     * nie mieszczą, zjeżdżamy DO PODŁÓG (zamiast zostawiać szerokości
     * zadeklarowane). Nadmiar `inicjatywy-lista` spada 821 → 279 px, liczba
     * zasłoniętych kolumn 5 → 3, wysokość wiersza i czytelność bez zmian.
     * Reszty nie da się usunąć szerokościami — trzeba ZMNIEJSZYĆ LICZBĘ
     * kolumn, a to wymaga pojęcia priorytetu, którego produkt nie ma.
     *
     * ŚWIADOMIE NIE CHOWAMY kolumn „o najniższym priorytecie": `TableColumn`
     * nie ma pola priorytetu, a dorobienie go tutaj byłoby przemyceniem
     * nowego mechanizmu produktowego w poprawce szerokości. Produkt ma już
     * RĘCZNE chowanie (`seedDefaultHiddenColumns`, użyte na 2 ekranach) —
     * które kolumny są zbędne, to decyzja właściciela, nie tej funkcji.
     * Patrz raport dyżuru 193.
     */
    if (budget <= 0) return { widths, scale: 1 };
    if (budget < floorTotal) {
      /**
       * KOLUMNA PIERWOTNA (`title`/`name`) NIE SCHODZI DO PODŁOGI.
       *
       * Sprostowanie mojej własnej regresji z dyżuru 193 (zrzut:
       * `evidence/grafika/193-kolumny-z-podgladem/audyty-piec-powierzchni__PO__light.png`):
       * zjazd tytułu z ~350 px do podłogi 180 px rozdarł „Cyberbezpieczeństwo)"
       * na „Cyberbezpieczeństw / o)". Mechanizm: moduły renderują tytuł jako
       * WŁASNY element, więc nie obejmuje go `CELL_TEXT_CLAMP_CLASS` (jądro
       * świadomie nie klamruje elementów — `overflow:hidden` przycięłoby
       * popovery), i zostaje `break-words` z `td`, które łamie w połowie wyrazu.
       * Wymiana defektu nie jest zyskiem.
       *
       * W TEJ gałęzi i tak nie zmieścimy tabeli (dlatego tu jesteśmy), więc
       * ściskanie NAJWAŻNIEJSZEJ kolumny kupuje kilkadziesiąt pikseli nadmiaru
       * kosztem rozdartego tytułu — zły interes. Kolumny wtórne schodzą do
       * podłóg jak dotąd.
       */
      for (const c of pool) {
        if (c.isPrimary) continue;
        widths[c.id] = Math.min(c.floor, c.width);
      }
      const naturalPool = pool.reduce((sum, c) => sum + c.width, 0);
      const flooredPool = pool.reduce(
        (sum, c) => sum + (c.isPrimary ? c.width : Math.min(c.floor, c.width)),
        0
      );
      const floorScale = naturalPool > 0 ? flooredPool / naturalPool : 1;
      return { widths, scale: floorScale > 0 && floorScale < 1 ? floorScale : 1 };
    }

    // Rozdział proporcjonalny z klamrowaniem do podłóg (iteracyjnie, bo
    // przyklamrowanie jednej kolumny zmienia budżet dla pozostałych).
    for (;;) {
      const poolTotal = pool.reduce((sum, c) => sum + c.width, 0);
      if (poolTotal <= 0) break;
      const ratio = budget / poolTotal;
      const clamped = pool.filter((c) => c.width * ratio < Math.min(c.floor, c.width));
      if (clamped.length === 0) {
        for (const c of pool) widths[c.id] = Math.floor(c.width * ratio);
        break;
      }
      for (const c of clamped) {
        const floored = Math.min(c.floor, c.width);
        widths[c.id] = floored;
        budget -= floored;
      }
      pool = pool.filter((c) => !clamped.includes(c));
      if (pool.length === 0) break;
    }

    const naturalData = natural - actionsWidth - fixedTotal;
    const scale = naturalData > 0 ? (available - actionsWidth - fixedTotal) / naturalData : 1;
    return { widths, scale: scale > 0 && scale < 1 ? scale : 1 };
  }, [
    visibleColumns,
    columnWidths,
    columnConfigs,
    parsePx,
    hideRowActions,
    horizontalViewportWidth,
    effectiveMinTableWidth,
  ]);

  /**
   * ── GEOMETRIA PRZYPIĘTYCH KOLUMN (`column.pinned`) ────────────────────────
   *
   * Offset liczymy z tej samej szerokości, którą dostaje `style.width` komórki
   * (`columnFit.widths` → `columnWidths` → `parsePx`), więc nagłówek i wiersz
   * mają IDENTYCZNE `left`/`right` bez pomiaru DOM. Kolumny przypięte z prawej
   * startują za strukturalną kolumną akcji (`sticky right-0`, 80 px), inaczej
   * pierwsza z nich schowałaby się pod kebabem.
   *
   * `edge` oznacza kolumnę na granicy obszaru przewijanego — tylko ona dostaje
   * cień, żeby granica przypięcia była widoczna, a nie sześć cieni na sobie.
   */
  const pinnedLayout = useMemo<
    Record<string, { side: 'left' | 'right'; offset: number; edge: boolean; width: number }>
  >(() => {
    const map: Record<string, { side: 'left' | 'right'; offset: number; edge: boolean; width: number }> = {};
    if (!visibleColumns.some((c) => c.pinned)) return map;
    const widthOf = (column: TableColumn) =>
      columnFit.widths[column.id] ?? columnWidths[column.id] ?? parsePx(column.width, 140);

    let left = 0;
    let lastLeftId: string | null = null;
    for (const column of visibleColumns) {
      if (column.pinned !== 'left') continue;
      const w = widthOf(column);
      map[column.id] = { side: 'left', offset: left, edge: false, width: w };
      left += w;
      lastLeftId = column.id;
    }
    if (lastLeftId && map[lastLeftId]) map[lastLeftId]!.edge = true;

    let right = hideRowActions ? 0 : ROW_ACTIONS_COLUMN_WIDTH;
    let lastRightId: string | null = null;
    for (let i = visibleColumns.length - 1; i >= 0; i -= 1) {
      const column = visibleColumns[i]!;
      if (column.pinned !== 'right') continue;
      const w = widthOf(column);
      map[column.id] = { side: 'right', offset: right, edge: false, width: w };
      right += w;
      lastRightId = column.id;
    }
    if (lastRightId && map[lastRightId]) map[lastRightId]!.edge = true;
    return map;
  }, [visibleColumns, columnFit, columnWidths, parsePx, hideRowActions]);

  /** Klasy komórki NAGŁÓWKA przypiętej kolumny — tło musi być NIEPRZEZROCZYSTE
   *  (`thead` ma `bg-…/80 backdrop-blur`, spod którego przebijałaby przewijana
   *  treść). Te same wartości co strukturalna kolumna akcji, żeby nie było
   *  widocznego szwu koloru między nią a przypiętą kolumną obok. */
  const pinnedHeaderClass = (column: TableColumn): string => {
    const pin = pinnedLayout[column.id];
    if (!pin) return '';
    return [
      'sticky top-0 z-[12] bg-slate-50 dark:bg-navy-900',
      pin.edge
        ? pin.side === 'left'
          ? 'shadow-[6px_0_6px_-6px_rgba(0,0,0,0.12)]'
          : 'shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12)]'
        : '',
    ]
      .filter(Boolean)
      .join(' ');
  };

  /** Klasy komórki DANYCH przypiętej kolumny. Stan wiersza (zaznaczony/hover)
   *  nakładamy jako `box-shadow: inset` — dokładnie tak, jak robi to kolumna
   *  akcji: `background-color` jest tu zajęty przez nieprzezroczyste tło, więc
   *  odcień stanu musi przyjść INNĄ właściwością CSS. */
  const pinnedCellClass = (column: TableColumn, isSelected: boolean): string => {
    const pin = pinnedLayout[column.id];
    if (!pin) return '';
    /* UWAGA: klasy MUSZĄ być zapisane jako pełne, statyczne literały. Tailwind
       skanuje ŹRÓDŁO tekstowo — `shadow-[${zmienna}]` nie wygeneruje reguły
       i cień po prostu nie powstanie. Dlatego sześć kombinacji jest wypisanych,
       a nie sklejanych. */
    const edge: 'left' | 'right' | 'none' = pin.edge ? pin.side : 'none';
    const shadow = isSelected
      ? edge === 'left'
        ? 'shadow-[6px_0_6px_-6px_rgba(0,0,0,0.12),inset_0_0_0_999px_var(--state-selected)]'
        : edge === 'right'
          ? 'shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12),inset_0_0_0_999px_var(--state-selected)]'
          : 'shadow-[inset_0_0_0_999px_var(--state-selected)]'
      : edge === 'left'
        ? 'shadow-[6px_0_6px_-6px_rgba(0,0,0,0.12)] group-hover:shadow-[6px_0_6px_-6px_rgba(0,0,0,0.12),inset_0_0_0_999px_var(--state-hover)]'
        : edge === 'right'
          ? 'shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12)] group-hover:shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12),inset_0_0_0_999px_var(--state-hover)]'
          : 'group-hover:shadow-[inset_0_0_0_999px_var(--state-hover)]';
    return `sticky z-[11] bg-white dark:bg-navy-900 ${shadow}`;
  };

  /**
   * Offset przypięcia MUSI być policzony z DOKŁADNIE tej szerokości, którą
   * komórka naprawdę dostanie — inaczej między kolumnami przypiętymi z prawej
   * zostaje szczelina, przez którą przebija przewijana treść (defekt K10 na
   * prototypie). `table-fixed` zaokrągla i rozdziela resztę, więc kolumnie
   * przypiętej narzucamy jej szerokość ZAMKNIĘTĄ (`width` = `min` = `max`) —
   * geometria staje się wtedy zgodna z konstrukcji, a nie z nadziei.
   */
  const pinnedStyle = (column: TableColumn): React.CSSProperties => {
    const pin = pinnedLayout[column.id];
    if (!pin) return {};
    const fixed = {
      width: `${pin.width}px`,
      minWidth: `${pin.width}px`,
      maxWidth: `${pin.width}px`,
    };
    return pin.side === 'left'
      ? { ...fixed, left: `${pin.offset}px` }
      : { ...fixed, right: `${pin.offset}px` };
  };

  /** Startowe przewinięcie do kolumny (`scrollToColumnId`) — patrz prop. */
  const scrolledToColumnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!scrollToColumnId) return;
    if (scrolledToColumnRef.current === scrollToColumnId) return;
    const scroller = horizontalViewportRef.current;
    if (!scroller) return;
    const index = visibleColumns.findIndex((c) => c.id === scrollToColumnId);
    if (index < 0) return;
    const widthOf = (column: TableColumn) =>
      columnFit.widths[column.id] ?? columnWidths[column.id] ?? parsePx(column.width, 140);
    let offset = 0;
    let pinnedLeftTotal = 0;
    for (let i = 0; i < index; i += 1) {
      const column = visibleColumns[i]!;
      offset += widthOf(column);
      if (column.pinned === 'left') pinnedLeftTotal += widthOf(column);
    }
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const cel = Math.min(Math.max(0, Math.round(offset - pinnedLeftTotal)), maxScroll);
    if (maxScroll <= 0) return;
    scroller.scrollLeft = cel;
    scrolledToColumnRef.current = scrollToColumnId;
  }, [scrollToColumnId, visibleColumns, columnFit, columnWidths, parsePx]);

  // First data (non-select) column hosts the optional row-description line.
  const firstDataColumnId = useMemo(
    () => visibleColumns.find((c) => c.type !== 'select')?.id ?? null,
    [visibleColumns]
  );

  /**
   * Zero-sum resize (Triada standard, wzór MyTasksListContent): powiększenie
   * kolumny zabiera szerokość SĄSIEDNIEJ (następnej widocznej) kolumnie, z
   * klamrami min/max po obu stronach — całkowita szerokość tabeli stała.
   */
  const handleColumnResize = useCallback(
    (columnId: string, newWidth: number) => {
      const byId = new Map(columnConfigs.map((c) => [c.id, c]));
      const cfg = byId.get(columnId);
      const idx = visibleColumns.findIndex((c) => c.id === columnId);
      const nextCol = idx >= 0 ? visibleColumns[idx + 1] : undefined;
      // Last visible column or unknown → plain resize (legacy behaviour).
      if (!cfg || !nextCol || nextCol.type === 'select') {
        setColumnWidths((prev) => ({ ...prev, [columnId]: newWidth }));
        setColumnConfigs((prev) =>
          prev.map((c) => (c.id === columnId ? { ...c, width: newWidth } : c))
        );
        return;
      }

      const nextCfg = byId.get(nextCol.id);
      const min = cfg.minWidth ?? 90;
      const max = cfg.maxWidth ?? 520;
      const nextMin = nextCfg?.minWidth ?? 90;
      const nextMax = nextCfg?.maxWidth ?? 520;

      const currentWidth = columnWidths[columnId] ?? cfg.width ?? 140;
      const nextWidth = columnWidths[nextCol.id] ?? nextCfg?.width ?? 140;
      const clampedWidth = Math.max(min, Math.min(max, newWidth));
      const requestedDelta = clampedWidth - currentWidth;
      const requestedNextWidth = nextWidth - requestedDelta;
      const clampedNextWidth = Math.max(nextMin, Math.min(nextMax, requestedNextWidth));
      const appliedDelta = nextWidth - clampedNextWidth;
      const applied: Record<string, number> = {
        ...columnWidths,
        [columnId]: currentWidth + appliedDelta,
        [nextCol.id]: clampedNextWidth,
      };
      setColumnWidths(applied);
      setColumnConfigs((cfgs) =>
        cfgs.map((c) => (applied[c.id] !== undefined ? { ...c, width: applied[c.id] } : c))
      );
    },
    [columnConfigs, columnWidths, visibleColumns]
  );

  const resetColumns = useCallback(() => {
    setColumnConfigs(defaultColumnConfigs);
    setColumnWidths(() => {
      const widths: Record<string, number> = {};
      for (const c of defaultColumnConfigs) widths[c.id] = c.width ?? 140;
      return widths;
    });
  }, [defaultColumnConfigs]);

  // Get active filter values for a column
  const getActiveFilterValues = useCallback(
    (columnId: string) => {
      return activeFilters.filter((f) => f.column === columnId).map((f) => f.value);
    },
    [activeFilters]
  );

  // Handle filter change for a column
  const handleColumnFilter = useCallback(
    (column: TableColumn, values: string[]) => {
      // Remove existing filters for this column
      const otherFilters = activeFilters.filter((f) => f.column !== column.id);

      // Add new filters
      const newFilters = values.map((value) => {
        const option = column.filterOptions?.find((o) => o.value === value);
        return {
          id: `${column.id}-${value}`,
          column: column.id,
          value,
          label: option?.label || value,
          color: option?.color,
        };
      });

      onFilterChange([...otherFilters, ...newFilters]);
    },
    [activeFilters, onFilterChange]
  );

  // Filter data based on active filters
  const filteredData = useMemo(() => {
    if (activeFilters.length === 0) return data;

    return data.filter((row) => {
      // Group filters by column
      const filtersByColumn = activeFilters.reduce(
        (acc, filter) => {
          if (!acc[filter.column]) acc[filter.column] = [];
          acc[filter.column].push(filter.value);
          return acc;
        },
        {} as Record<string, string[]>
      );

      // Check each column's filters (OR within column, AND between columns)
      return Object.entries(filtersByColumn).every(([column, values]) => {
        const rowValue = row[column];
        // Kolumny wielowartościowe (np. `tags: string[]`) — dopasowanie „którykolwiek
        // z tagów wiersza jest wybrany". Bez tego lejek na takiej kolumnie zawsze
        // zwracał 0 wierszy (`values.includes(tablica)` nigdy nie jest prawdą).
        if (Array.isArray(rowValue)) {
          return rowValue.some((entry) => values.includes(String(entry)));
        }
        return values.includes(rowValue);
      });
    });
  }, [data, activeFilters]);

  // ── Sorting (Triada standard) — click on a `sortable` header toggles asc/desc.
  const [sort, setSort] = useState<{ columnId: string; direction: 'asc' | 'desc' } | null>(
    defaultSort ?? null
  );

  // Mechanika 1:1 z MyWork (MyTasksListContent.handleSort): asc → desc → none.
  const handleSort = useCallback((columnId: string) => {
    setSort((prev) => {
      if (prev?.columnId !== columnId) return { columnId, direction: 'asc' };
      if (prev.direction === 'asc') return { columnId, direction: 'desc' };
      return null;
    });
  }, []);

  const sortedData = useMemo(() => {
    if (!sort) return filteredData;
    const column = columns.find((c) => c.id === sort.columnId);
    if (!column) return filteredData;
    const accessor = column.sortAccessor ?? ((row: TableRow) => row[column.id]);
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...filteredData].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // empty values sink to the bottom
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      const as = String(av);
      const bs = String(bv);
      // Date-like strings sort chronologically.
      const ad = Date.parse(as);
      const bd = Date.parse(bs);
      if (!Number.isNaN(ad) && !Number.isNaN(bd) && /\d{4}-\d{2}/.test(as)) {
        return (ad - bd) * dir;
      }
      return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [filteredData, sort, columns]);

  const SortIcon: React.FC<{ columnId: string }> = ({ columnId }) =>
    sort?.columnId === columnId ? (
      sort.direction === 'asc' ? (
        <ArrowUp size={12} className="shrink-0" />
      ) : (
        <ArrowDown size={12} className="shrink-0" />
      )
    ) : (
      <ArrowUpDown size={12} className="shrink-0 opacity-40" />
    );

  // Format relative time
  const formatRelativeTime = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return t('sharedComponents.filterableTable.justNow');
    if (hours < 24) return t('sharedComponents.filterableTable.hoursAgo', { count: hours });
    if (days < 7) return t('sharedComponents.filterableTable.daysAgo', { count: days });
    // Odbiór grafiki 2026-08-30: gołe `toLocaleDateString()` bierze format z
    // PRZEGLĄDARKI, nie z języka konta — polski użytkownik na angielskim systemie
    // widział „8/21/2026" obok „3 dni temu" w tej samej kolumnie. To domyślny
    // renderer WSPÓLNEJ tabeli, więc dotyczyło każdego modułu z kolumną daty.
    // SSOT formatu: src/utils/listDateFormat.ts.
    return d.toLocaleDateString(localeListy());
  };

  return (
    <div className={canvasClassName}>
      <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200/70 dark:border-white/[0.03] rounded-xl overflow-hidden">
        <div ref={horizontalViewportRef} className="w-full overflow-x-auto">
          <table
            /* §27-exempt: to JEST kanoniczny komponent FilterableTable (§2 SSOT) — surowy <table> tutaj to jego implementacja, nie luka */ className="w-full table-fixed"
            data-min-table-width={effectiveMinTableWidth ?? 'auto'}
            style={{ minWidth: effectiveMinTableWidth }}
          >
            <thead className="sticky top-0 z-10 bg-slate-50/80 dark:bg-navy-900/50 backdrop-blur-hig">
              <tr>
                {visibleColumns.map((column, idx) => {
                  const cfg = columnConfigs.find((c) => c.id === column.id);
                  // `width` = szerokość RENDEROWANA (po dopasowaniu do kontenera,
                  // patrz `columnFit`). Model logiczny (`columnWidths`) zostaje
                  // nietknięty, więc resize i persistencja liczą dalej na
                  // zadeklarowanych wartościach.
                  const width =
                    columnFit.widths[column.id] ?? columnWidths[column.id] ?? parsePx(column.width, 140);
                  const declaredMinWidth =
                    cfg?.minWidth ?? (column.id === 'title' || column.id === 'name' ? 200 : 90);
                  const declaredMaxWidth =
                    cfg?.maxWidth ?? (column.id === 'title' || column.id === 'name' ? 520 : 320);
                  // Przy dopasowaniu `min-width` MUSI zejść razem z `width` —
                  // inaczej to ono odtwarza nadmiar, który właśnie usunęliśmy
                  // (`min-width` przy `table-fixed` nie ratuje, tylko rozpycha).
                  const minWidth = Math.min(declaredMinWidth, width);
                  const maxWidth = Math.max(declaredMaxWidth, width);
                  const isLastDataCol = idx === visibleColumns.length - 1;
                  const isSelectCol = column.type === 'select' && !!selection;
                  return (
                    <th
                      key={column.id}
                      className={`${ROW_HEIGHT_CLASS} ${cellPadding} relative ${alignToClass(column.align)} text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${pinnedHeaderClass(column)}`}
                      style={{
                        width: `${width}px`,
                        minWidth: `${minWidth}px`,
                        maxWidth: `${maxWidth}px`,
                        ...pinnedStyle(column),
                      }}
                    >
                      {isSelectCol ? (
                        // Canon §3.5 — select-all lives in the header column.
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selection!.isAllSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = selection!.isIndeterminate;
                            }}
                            onChange={(e) => {
                              e.stopPropagation();
                              selection!.onToggleAll();
                            }}
                            aria-label={selection!.selectAllLabel ?? t('common.selectAll')}
                            // TRIADA_KANON B.38/B.39 — checkbox „zaznacz wszystko"
                            // był jedynym crimsonowym (`primary-500`) w tabeli, z
                            // crimsonowym ringiem fokusa. Wyrównane do checkboxa
                            // wiersza (niżej): akcent `c-info`, fokus `c-focus`.
                            className="h-4 w-4 rounded border-slate-300 dark:border-navy-600 text-c-info focus:ring-c-focus cursor-pointer"
                          />
                        </div>
                      ) : (
                        // `min-w-0` + `break-words`: bez tego etykieta jest
                        // elementem flex z domyślnym `min-width: auto`, więc
                        // NIE kurczy się poniżej najdłuższego słowa i wylewa
                        // się na sąsiednią kolumnę („SZACUNKOWE ZAPOTRZEBOWANIE"
                        // nachodzące na „STAN MOCY PRZEROBOWEJ"). Przy szerokich
                        // kolumnach bez zmian — łamanie odpala się dopiero, gdy
                        // słowo naprawdę się nie mieści.
                        <div
                          className={`flex items-center gap-1 min-w-0 break-words ${
                            column.align === 'right'
                              ? 'justify-end'
                              : column.align === 'center'
                                ? 'justify-center'
                                : ''
                          }`}
                        >
                          {column.sortable ? (
                            <button
                              type="button"
                              onClick={() => handleSort(column.id)}
                              // Fokus MUSI być niebieski (`c-focus`). Bez tej klasy
                              // przeglądarka rysuje własny outline — na tym motywie
                              // bursztynowy rgb(229,151,0) — i łamie kanon na KAŻDYM
                              // ekranie listowym, bo to wspólny nagłówek sortowania.
                              className="inline-flex items-center gap-1 min-w-0 uppercase tracking-wider transition-colors hover:text-c-text-secondary rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                              aria-label={t('common.sortByColumn', 'Sort by {{column}}', {
                                column: column.label,
                              })}
                            >
                              <OverflowTooltip
                                className={`min-w-0 ${CELL_TEXT_CLAMP_CLASS}`}
                                content={column.label}
                              >
                                {column.label}
                              </OverflowTooltip>
                              <SortIcon columnId={column.id} />
                            </button>
                          ) : (
                            <OverflowTooltip
                              className={`min-w-0 ${CELL_TEXT_CLAMP_CLASS}`}
                              content={column.label}
                            >
                              {column.label}
                            </OverflowTooltip>
                          )}
                          {column.filterable && (
                            <FilterDropdown
                              column={column}
                              activeValues={getActiveFilterValues(column.id)}
                              onApply={(values) => handleColumnFilter(column, values)}
                            />
                          )}
                        </div>
                      )}
                      {!isLastDataCol && !isSelectCol ? (
                        <ColumnResizeHandle
                          columnId={column.id}
                          resizeLabel={t('common.resizeColumn', 'Resize {{column}} column', {
                            column: column.label,
                          })}
                          currentWidth={width}
                          minWidth={minWidth}
                          maxWidth={maxWidth}
                          // Uchwyt operuje w pikselach EKRANU; model logiczny
                          // trzyma szerokości zadeklarowane. Przy dopasowaniu
                          // (`scale < 1`) przeliczamy z powrotem, żeby chwyt
                          // podążał 1:1 za kursorem i nie skakał.
                          onResize={(columnId, newWidth) =>
                            handleColumnResize(
                              columnId,
                              columnFit.scale === 1
                                ? newWidth
                                : Math.round(newWidth / columnFit.scale)
                            )
                          }
                        />
                      ) : null}
                    </th>
                  );
                })}
                {!hideRowActions ? (
                  // R09-1a (2026-08-10): `sticky right-0` — na wąskim obszarze tabeli
                  // (np. otwarty panel podglądu obok, TRIADA §C9) `table-fixed` NIE
                  // kurczy kolumn (szerokości z pierwszego wiersza są sztywne, patrz
                  // ColumnResizer — zmiana tylko ręczna), więc kolumna z Settings2
                  // po prostu wypadała poza widoczny obszar bez paska przewijania w
                  // linii wzroku. Ikona TRIADA B.16 jest OBOWIĄZKOWA na każdym
                  // odbiorze — przypinamy ją do prawej krawędzi widocznego obszaru,
                  // żeby nigdy nie wymagała przewijania. `bg-slate-50 dark:bg-navy-900`
                  // (pełne, nie tłumaczone przez `thead`'s `/80` + blur) zapobiega
                  // przebijaniu przewijanej treści spod przypiętej kolumny. Cień
                  // po lewej krawędzi sygnalizuje, że to przypięty fragment, nie
                  // zwykła kolumna — czytelne domknięcie zamiast twardej krawędzi.
                  <th
                    className={`${ROW_HEIGHT_CLASS} ${cellPadding} text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-20 sticky right-0 z-[11] bg-slate-50 dark:bg-navy-900 shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12)]`}
                  >
                    {enableColumnSettings && rowDescription ? (
                      /* Triada standard: Settings2 → TableSettingsPopover
                       * (kolumny + „Show row description") w prawym górnym rogu. */
                      <div className="flex justify-end normal-case tracking-normal">
                        <TableSettingsPopover
                          columns={[
                            ...columnConfigs
                              .filter((c) => c.id !== '__select')
                              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                              .map((c) => ({
                                id: c.id,
                                label: c.label,
                                required: !!c.required,
                                visible: c.visible !== false,
                              })),
                            // Actions column is structural — shown as LOCKED (wzór My Work).
                            {
                              id: '__actions',
                              label: t('common.actions'),
                              required: true,
                              visible: true,
                            },
                          ]}
                          onToggle={(columnId, visible) =>
                            setColumnConfigs((prev) =>
                              prev.map((c) => (c.id === columnId ? { ...c, visible } : c))
                            )
                          }
                          onMove={(columnId, direction) => {
                            if (columnId === '__actions') return;
                            // Swap kolejności 1:1 z ColumnSelector.moveColumn (My Work).
                            setColumnConfigs((prev) => {
                              const sorted = [...prev].sort(
                                (a, b) => (a.order ?? 0) - (b.order ?? 0)
                              );
                              const idx = sorted.findIndex((c) => c.id === columnId);
                              const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
                              if (idx < 0 || targetIdx < 0 || targetIdx >= sorted.length)
                                return prev;
                              const current = sorted[idx];
                              const target = sorted[targetIdx];
                              return prev.map((c) => {
                                if (c.id === current.id) return { ...c, order: target.order };
                                if (c.id === target.id) return { ...c, order: current.order };
                                return c;
                              });
                            });
                          }}
                          onReset={resetColumns}
                          resetLabel={t('common.resetColumns')}
                          showDescription={rowDescription.show}
                          onToggleDescription={rowDescription.onToggle}
                          label={
                            rowDescription.settingsLabel ??
                            t('common.viewSettings', 'View settings')
                          }
                          columnsHeading={
                            rowDescription.columnsHeading ?? t('common.visibleColumns')
                          }
                          descriptionLabel={rowDescription.label ?? t('common.showRowDescription')}
                        />
                      </div>
                    ) : enableColumnSettings ? (
                      <div className="flex justify-end">
                        <ColumnSelector
                          columns={columnConfigs}
                          onChange={setColumnConfigs}
                          onReset={resetColumns}
                          trigger={
                            <button
                              type="button"
                              className="inline-flex items-center justify-center h-7 w-7 rounded-full text-slate-500 dark:text-slate-400 hover:bg-state-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                              title={t('common.columns')}
                              aria-label={t('common.columns')}
                            >
                              <Columns size={14} />
                            </button>
                          }
                        />
                      </div>
                    ) : null}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.03]">
              {sortedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length + (hideRowActions ? 0 : 1)}
                    className="px-4 py-14 text-center text-slate-500 dark:text-slate-400"
                    data-empty-reason={data.length === 0 ? 'no-data' : 'no-filter-results'}
                  >
                    {/*
                      R04-2A — §5 Stany: „empty rozróżnia brak danych od braku
                      wyniku filtra i ma sensowne CTA/reset". Do tej pory obie
                      sytuacje pokazywały ten sam `emptyMessage`, więc użytkownik
                      po odfiltrowaniu wszystkiego widział „No items found" i nie
                      miał jak się dowiedzieć, że wystarczy zdjąć filtr.
                      Rozróżnienie jest lokalne i pewne: `data` to wejście,
                      `sortedData` to wynik po filtrach.
                    */}
                    <div
                      className="sticky left-4 max-w-2xl rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-slate-50/70 dark:bg-white/[0.03] px-6 py-8 text-sm"
                      style={
                        horizontalViewportWidth > 0
                          ? {
                              width: Math.max(0, Math.min(672, horizontalViewportWidth - 64)),
                              marginLeft: Math.max(
                                0,
                                (horizontalViewportWidth -
                                  Math.min(672, horizontalViewportWidth - 64)) /
                                  2 -
                                  16
                              ),
                            }
                          : undefined
                      }
                    >
                      {data.length === 0 ? (
                        emptyMessage
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <span>
                            {emptyFilteredMessage ??
                              t('common.noFilterResults', 'No items match the active filters')}
                          </span>
                          <button
                            type="button"
                            onClick={() => onFilterChange([])}
                            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-c-border-subtle px-3 text-xs font-medium text-c-text transition-colors hover:bg-state-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          >
                            {t('common.clearFilters', 'Clear filters')}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedData.map((row) =>
                  isGroupRow?.(row) ? (
                    /**
                     * WIERSZ GRUPUJĄCY (K6) — jedna komórka na całą szerokość.
                     * Nie jest klikalny, nie ma kebaba i NIE przechodzi przez
                     * ścieżkę komórek, więc żadna kolumna nie rysuje w nim „—".
                     * Treść owinięta w `sticky left-0`: przy przewijaniu okresów
                     * nazwa obszaru zostaje przy lewej krawędzi, obok przypiętej
                     * kolumny pierwotnej, zamiast wyjeżdżać z kadru.
                     */
                    <tr
                      key={row.id}
                      data-group-row="true"
                      className={[
                        'bg-[color:var(--c-surface-raised)]',
                        typeof rowClassName === 'function' ? rowClassName(row) : rowClassName,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <td
                        colSpan={visibleColumns.length + (hideRowActions ? 0 : 1)}
                        className={`${ROW_HEIGHT_CLASS} ${cellPadding} bg-[color:var(--c-surface-raised)]`}
                      >
                        <div className="sticky left-0 inline-flex max-w-full items-center gap-3">
                          {renderGroupRow ? renderGroupRow(row) : null}
                        </div>
                      </td>
                    </tr>
                  ) : (
                  <tr
                    key={row.id}
                    // DOSTĘPNOŚĆ KLAWIATURY — wiersz jest interaktywny, więc musi
                    // być osiągalny Tabem i obsługiwać Enter/Spację.
                    //
                    // Do tej pory `<tr>` miał wyłącznie `onClick`: otwarcie
                    // podglądu było możliwe TYLKO myszą, w każdym module tej
                    // aplikacji naraz. Kanon TRIADA (część B, punkty 41-43)
                    // wymaga pełnego cyklu Tab przez wszystkie interaktywne
                    // elementy — to nie jest rozszerzenie standardu, tylko
                    // doprowadzenie kodu do niego.
                    //
                    // `tabIndex` dostają wyłącznie wiersze, które faktycznie coś
                    // robią. Wiersz bez handlera zostaje nieinteraktywny, żeby
                    // nie zaśmiecać kolejności fokusa pustymi przystankami.
                    tabIndex={
                      onRowClick ||
                      onRowDoubleClick ||
                      (!hideRowActions && (getRowActionSections || getRowActions))
                        ? 0
                        : undefined
                    }
                    onKeyDown={(event) => {
                      if (
                        (onRowClick || onRowDoubleClick) &&
                        (event.key === 'Enter' || event.key === ' ')
                      ) {
                        // Spacja przewija stronę, jeśli jej nie zatrzymać.
                        // Klawisz na kontrolce wewnątrz wiersza (przycisk,
                        // checkbox, kebab) należy do niej, nie do wiersza.
                        if (event.target !== event.currentTarget) return;
                        event.preventDefault();
                        onRowClick?.(row);
                        return;
                      }

                      if (
                        !(
                          !hideRowActions &&
                          (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))
                        )
                      )
                        return;
                      const sections = getRowActionSections?.(row);
                      const hasMenu = sections
                        ? sections.length > 0
                        : getRowActions
                          ? (getRowActions(row)?.length ?? 0) > 0
                          : true;
                      if (!hasMenu) return;
                      event.preventDefault();
                      event.stopPropagation();
                      const rect = event.currentTarget.getBoundingClientRect();
                      setContextMenuRow({
                        rowId: String(row.id),
                        point: { x: Math.max(rect.left + 24, rect.right - 40), y: rect.top + 28 },
                      });
                    }}
                    // `aria-selected` przyszło z demo — czytnik ekranu musi
                    // wiedzieć, który wiersz jest wybrany, niezależnie od tego,
                    // że wizualnie widać to po tle.
                    aria-selected={row.id === selectedRowId}
                    onClick={() => onRowClick?.(row)}
                    onDoubleClick={() => onRowDoubleClick?.(row)}
                    onContextMenu={
                      hideRowActions
                        ? undefined
                        : (e) => {
                            // ANEKS #3b — PPM-mirror: this row's menu content
                            // mirrors exactly what the kebab column below
                            // would compute. If it's genuinely empty, don't
                            // swallow the native browser menu for nothing.
                            const sections = getRowActionSections?.(row);
                            const hasMenu = sections
                              ? sections.length > 0
                              : getRowActions
                                ? (getRowActions(row)?.length ?? 0) > 0
                                : true; // default hard-coded 5-action fallback
                            if (!hasMenu) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setContextMenuRow({
                              rowId: String(row.id),
                              point: { x: e.clientX, y: e.clientY },
                            });
                          }
                    }
                    className={[
                      'group cursor-pointer transition-colors',
                      // Wiersz jest fokusowalny, więc musi mieć WŁASNY, widoczny
                      // wskaźnik fokusa w kolorze kanonu. Bez tego przeglądarka
                      // rysuje swój domyślny bursztynowy outline — zmierzony
                      // rgb(229,151,0). Demo doszło do tej samej poprawki
                      // niezależnie; treść klas jest identyczna.
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-c-focus',
                      row.id === selectedRowId ? 'bg-state-selected' : 'hover:bg-state-hover',
                      typeof rowClassName === 'function' ? rowClassName(row) : rowClassName,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {visibleColumns.map((column) => {
                      /**
                       * Moduły bardzo często zwracają z `render` GOŁY tekst
                       * (zmierzone: 18 z 22 komórek ekranu „Obciążenie" to
                       * czysty string bez żadnego elementu). Taki tekst ląduje
                       * bezpośrednio w `td` i dziedziczy z niego
                       * `overflow-wrap: break-word` — to on rozrywał
                       * „engineerin g team" i „Ograniczen ie".
                       *
                       * Owijamy go w warstwę tekstu z `CELL_TEXT_CLAMP_CLASS`
                       * (łamanie na spacji + wielokropek + `title`). Treść
                       * renderowana jako ELEMENTY zostaje nietknięta — tam
                       * `overflow-hidden` przycinałby popovery.
                       */
                      const rendered = column.render ? column.render(row) : undefined;
                      const renderedIsPlainText =
                        typeof rendered === 'string' || typeof rendered === 'number';
                      return (
                      <td
                        key={column.id}
                        // `break-words` — treść komórki musi łamać się DO
                        // szerokości kolumny. Bez tego długie słowo wylewa się
                        // poza komórkę i przy wąskiej kolumnie chowa się pod
                        // przypiętą (`sticky right-0`) kolumną akcji — dokładnie
                        // ten sam objaw „ucięcia w połowie znaku", tylko piętro
                        // niżej. Świadomie NIE `overflow-hidden` ani
                        // `overflow-x: clip`: komórki renderują popovery/menu,
                        // które muszą móc wyjść poza obrys wiersza. To NIE jest
                        // teoria — sprawdzone 2026-08-30:
                        // `PMO/StatusTransitionDropdown.tsx:259` rysuje panel
                        // `absolute z-overlay w-48` (192 px) BEZ portalu, prosto
                        // w komórce `assessment/InitiativesTable.tsx:389`.
                        // Przycięcie komórki obcięłoby go do szerokości kolumny.
                        // Dlatego wielokropek zakłada się PIĘTRO NIŻEJ, na
                        // warstwie tekstu (CELL_TEXT_CLAMP_CLASS), a `break-words`
                        // zostaje tu jako ostatnia deska ratunku dla treści,
                        // którą moduł renderuje jako własne ELEMENTY.
                        className={`${ROW_HEIGHT_CLASS} ${cellPadding} break-words ${column.align ? alignToClass(column.align) : ''} ${pinnedCellClass(column, row.id === selectedRowId)}`}
                        style={pinnedStyle(column)}
                      >
                        {column.type === 'select' && selection ? (
                          <input
                            type="checkbox"
                            checked={selectedIdSet?.has(String(row.id)) ?? false}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              selection.onToggleRow(String(row.id));
                            }}
                            aria-label={selection.selectRowLabel ?? t('common.selectRow')}
                            className="h-3.5 w-3.5 rounded border-c-border-subtle text-c-info focus:ring-c-focus cursor-pointer"
                          />
                        ) : column.render ? (
                          renderedIsPlainText ? (
                            <OverflowTooltip
                              className={CELL_TEXT_CLAMP_CLASS}
                              content={String(rendered)}
                            >
                              {rendered}
                            </OverflowTooltip>
                          ) : (
                            <div className={CELL_ELEMENT_WRAP_CLASS}>{rendered}</div>
                          )
                        ) : column.id === 'status' ? (
                          <EntityStatusChip status={row.status} />
                        ) : column.id === 'progress' ? (
                          <ProgressBar progress={row.progress} />
                        ) : column.id === 'updatedAt' ? (
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {formatRelativeTime(row.updatedAt)}
                          </span>
                        ) : isEmptyCell(row[column.id]) ? (
                          <span className="text-sm text-slate-400">—</span>
                        ) : (
                          <div className="min-w-0">
                            <OverflowTooltip
                              className={[
                                'text-sm text-slate-700 dark:text-slate-200',
                                // `title`/`name` mają WŁASNY, ostrzejszy kanon:
                                // jedna linia + wielokropek (`truncate`). Reszta
                                // kolumn zawija na spacji i skraca dopiero wyraz
                                // szerszy niż kolumna (patrz CELL_TEXT_CLAMP_CLASS).
                                column.id === 'title' || column.id === 'name'
                                  ? 'block truncate'
                                  : CELL_TEXT_CLAMP_CLASS,
                              ].join(' ')}
                              content={String(row[column.id])}
                            >
                              {row[column.id]}
                            </OverflowTooltip>
                          </div>
                        )}
                        {rowDescription?.show &&
                        column.type !== 'select' &&
                        column.id === firstDataColumnId
                          ? (() => {
                              const desc = rowDescription.render(row);
                              return (
                                <div
                                  data-row-description-slot
                                  className="mt-0.5 min-h-8 text-xs text-c-text-muted line-clamp-2"
                                >
                                  {desc ?? null}
                                </div>
                              );
                            })()
                          : null}
                      </td>
                      );
                    })}
                    {!hideRowActions ? (
                      // R09-1a — sam mirror nagłówka: kebab przypięty do prawej
                      // krawędzi, żeby nie wypadał poza widoczny obszar razem z
                      // Settings2 (patrz komentarz przy `<th>` powyżej).
                      // sticky-defect1a (2026-08-11): baza `bg-white dark:bg-navy-900`
                      // zostaje (musi być nieprzezroczysta — jedyna ochrona przed
                      // przebijaniem przewiniętej treści spod przypiętej kolumny).
                      // `background-color: inherit` z wiersza NIE działa tutaj: wiersz
                      // w stanie domyślnym nie ma WŁASNEGO tła (przezroczysty, pokazuje
                      // rozmyte tło karty przez `bg-white/70 backdrop-blur`), więc
                      // odziedziczona wartość byłaby `transparent` — zniosłoby to
                      // ochronę przed przewijaniem właśnie w stanie domyślnym.
                      // Zamiast tego: stan wiersza (`--state-selected`/`--state-hover`,
                      // te same tokeny co `bg-state-selected`/`hover:bg-state-hover`
                      // na `<tr>`) nakładamy jako `box-shadow: inset` — to INNA
                      // właściwość CSS niż `background-color`, więc nie ma konfliktu
                      // "dwóch klas Tailwind na jednej właściwości" i tło + cień
                      // przewijania + odcień stanu współistnieją bez wyliczania kolejnych
                      // wariantów. Mirror warunku z `<tr>` (linia ~941) 1:1 — UWAGA:
                      // musi być `group-hover:`, NIE `hover:` — hover trafia myszą
                      // gdziekolwiek w wierszu (tekst tytułu po lewej), rzadko
                      // bezpośrednio nad przypiętą komórką; `<tr>` już niesie klasę
                      // `group` (patrz linia ~940), więc `group-hover:` na tej
                      // komórce reaguje na hover CAŁEGO wiersza, tak jak `hover:` na
                      // `<tr>` reaguje na siebie.
                      <td
                        className={`${ROW_HEIGHT_CLASS} ${cellPadding} text-right sticky right-0 z-[11] bg-white dark:bg-navy-900 ${
                          row.id === selectedRowId
                            ? 'shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12),inset_0_0_0_999px_var(--state-selected)]'
                            : 'shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12)] group-hover:shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12),inset_0_0_0_999px_var(--state-hover)]'
                        }`}
                      >
                        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            // PPM-mirror (ANEKS #3b): this row's context-menu
                            // anchor, if the last right-click landed here.
                            const contextMenuAnchor =
                              contextMenuRow?.rowId === String(row.id)
                                ? contextMenuRow.point
                                : null;
                            const closeContextMenu = () => setContextMenuRow(null);
                            // Triada standard: LONG contextual kebab as sections.
                            const sections = getRowActionSections?.(row);
                            if (sections) {
                              if (!sections.length) return null;
                              return (
                                <RowActionsMenu
                                  iconVariant="vertical"
                                  sections={sections}
                                  contextMenuAnchor={contextMenuAnchor}
                                  onContextMenuClose={closeContextMenu}
                                />
                              );
                            }
                            const actions: RowAction[] =
                              getRowActions?.(row) ??
                              ([
                                {
                                  id: 'open',
                                  label: t('common.open', 'Open'),
                                  icon: Maximize2,
                                  variant: 'primary',
                                  onClick: () => onRowAction?.('edit', row),
                                },
                                {
                                  id: 'preview',
                                  label: t('common.preview', 'Preview'),
                                  icon: Eye,
                                  onClick: () => onRowAction?.('preview', row),
                                },
                                {
                                  id: 'duplicate',
                                  label: t('common.duplicate', 'Duplicate'),
                                  icon: Copy,
                                  onClick: () => onRowAction?.('duplicate', row),
                                },
                                {
                                  id: 'rename',
                                  label: t('common.edit', 'Edit'),
                                  icon: Edit,
                                  onClick: () => onRowAction?.('rename', row),
                                },
                                {
                                  id: 'delete',
                                  label: t('common.delete', 'Delete'),
                                  icon: Trash2,
                                  divider: true,
                                  variant: 'danger',
                                  onClick: () => onRowAction?.('delete', row),
                                },
                              ] as RowAction[]);

                            // #40 — pure-wiring bridge onto the sectional kebab contract
                            // (RowActionsMenu.sections), same contract every other table
                            // uses.
                            //
                            // R01 (wąskie przekazanie ownershipu, 2026-08-06): fallback
                            // NIE odsiewa już realnych pozycji `disabled`. Kanon §1/§7/§10
                            // wymaga odwrotnie — funkcja ograniczona uprawnieniem albo
                            // regułą biznesową ZOSTAJE widoczna, wyraźnie jaśniejsza.
                            // Atrapy („Coming soon"/„Wkrótce") odsiewa niżej sam renderer
                            // (`czyAtrapa` w `normalizeZones`), więc przepuszczenie ich
                            // tutaj niczego użytkownikowi nie obiecuje, a menu złożone
                            // wyłącznie z atrap nadal nie wyrenderuje nawet triggera.
                            const legacySectionActions = actions;

                            if (!legacySectionActions.length) return null;

                            return (
                              <RowActionsMenu
                                iconVariant="vertical"
                                sections={[{ id: 'legacy', actions: legacySectionActions }]}
                                contextMenuAnchor={contextMenuAnchor}
                                onContextMenuClose={closeContextMenu}
                              />
                            );
                          })()}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FilterableTable;
