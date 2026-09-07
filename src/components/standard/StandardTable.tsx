/**
 * StandardTable — JEDYNA fasada tabeli listy encji (Triada standard).
 *
 * SSOT wzorca: żywa tabela My Work Tasks/Decisions + NOTATKA-PRAWO
 * `Harvard/wdrozenie-100/_STANDARD_TRIADA_NOTATKA.md` (+ aneksy #2/#3).
 * Fasada NIE reimplementuje mechaniki — deleguje do kanonicznego
 * FilterableTable (§2 SSOT), który po uzupełnieniach gwarantuje 9 MUSTów:
 *
 *  1. nagłówek uppercase sticky + sort (asc→desc→none, 1:1 MyTasks) + lejki
 *     filtrów per kolumna,
 *  2. hairline separatory wierszy (divide-y slate-200/60 · white/[0.03]),
 *     ZERO zebry i grubych linii,
 *  3. wiersz z opcjonalnym opisem — toggle „Show row description",
 *  4. OBOWIĄZKOWY pstryczek Settings2 → TableSettingsPopover w prawym górnym
 *     rogu (kolumny + LOCKED + reorder ▲▼ + reset + toggle opisu) — moduł NIE
 *     może go podmienić (aneks #3),
 *  5. resize zero-sum z persistencją (persistKey),
 *  6. kebab ⋮ z DŁUGĄ kontekstową listą sekcjami (`rowActions(row)`;
 *     akcje statusowe u góry, Delete na dole — wzór menu Decisions),
 *  7. checkbox po lewej każdego wiersza (prop `selection`); zaznaczenie ≥1 ⇒
 *     Menu 3 przełącza się w tryb bulk (StandardModuleBar `bulk`),
 *  8. bulk akcje = kontekstowy prop per encja (nie hardcode),
 *  9. stany empty/loading/error ze shared/states.
 */

import { Archive, Eye, type LucideIcon, Pencil, Trash2 } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TABLE_SURFACE_REGISTER } from '@/contracts/tableSurface/surfaceRegister';
import type { ContractViolation, TableSurfaceId } from '@/contracts/tableSurface/types';
import { toResult } from '@/contracts/tableSurface/types';
import { assertContractInDev } from '@/contracts/tableSurface/validators';

import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import {
  FilterableTable,
  type TableColumn,
  type TableRow,
} from '../shared/ModuleHub/FilterableTable';
import type { RowAction, RowActionSection } from '../shared/RowActionsMenu';
import { EmptyState, LoadingState } from '../shared/states';

export type { TableColumn, TableRow } from '../shared/ModuleHub/FilterableTable';
export type { RowAction, RowActionSection } from '../shared/RowActionsMenu';

// ── Edycja komórki W WIERSZU (podwójny klik) ───────────────────────────────
//
// PO CO: kanon rynkowy PMO (`AUDYT_RYNKU_PMO_20260907.md` §4.1) — Wrike:
// „Double-click any field to edit its data"; Clarity: „Edit Data in the grid".
// Do 07.09 żaden ekran listowy Consultify nie umiał zmienić wartości bez
// wychodzenia do osobnego widoku, więc każdy moduł, który tego potrzebował,
// musiałby zbudować własną komórkę-edytor — czyli dokładnie ten kształt, który
// `check-list-canon.sh` blokuje („naprawa per-wywołanie odrasta").
//
// Mechanika należy do fasady, deklaracja do modułu: kolumna podaje `editable`,
// fasada trzyma stan „która komórka jest w edycji", zatrzymuje propagację
// (żeby podwójny klik w komórkę nie otwierał wiersza) i rysuje edytor.
// ADDYTYWNE: kolumna bez `editable` renderuje się bajt w bajt jak dotąd.
export interface StandardCellEditor {
  /** `select` — słownik wartości; `date` — kalendarz (natywny `input[type=date]`). */
  kind: 'select' | 'date';
  /** Etykieta dla czytnika ekranu (obowiązkowa — edytor nie ma widocznego labela). */
  ariaLabel: string;
  /** Aktualna wartość w formacie edytora (`select`: klucz opcji, `date`: `RRRR-MM-DD`). */
  value: (row: TableRow) => string;
  /** Opcje dla `kind: 'select'`. */
  options?: (row: TableRow) => Array<{ value: string; label: string }>;
  /** Zapis — wołany TYLKO gdy wartość naprawdę się zmieniła. */
  onCommit: (row: TableRow, value: string) => void | Promise<void>;
  /** Wiersz bez prawa edycji (np. z innego rejestru) — brak `true` = edytowalny. */
  isEditable?: (row: TableRow) => boolean;
  /** Podpowiedź na komórce edytowalnej / nieedytowalnej. */
  hint?: string;
  disabledHint?: string;
}

export interface StandardTableColumn extends TableColumn {
  editable?: StandardCellEditor;
}

const EDITOR_CLASS =
  'h-8 w-full min-w-0 rounded-md border border-c-border-subtle bg-c-surface px-1.5 text-sm ' +
  'text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

const StandardEditableCell: React.FC<{
  row: TableRow;
  editor: StandardCellEditor;
  editing: boolean;
  onStart: () => void;
  onStop: () => void;
  /** Zapamiętuje, że gest zaczął się w TEJ komórce (patrz `handleRowDoubleClick`). */
  onPointerStart: () => void;
  children: React.ReactNode;
}> = ({ row, editor, editing, onStart, onStop, onPointerStart, children }) => {
  const canEdit = editor.isEditable ? editor.isEditable(row) : true;
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  if (!editing) {
    return (
      <div
        data-editable={canEdit ? 'tak' : 'nie'}
        title={canEdit ? editor.hint : editor.disabledHint}
        className={canEdit ? '-mx-1 rounded-sm px-1 hover:bg-c-surface-hover' : undefined}
        /*
         * ★ GEST ZAPAMIĘTANY NA `mousedown`, NIE DOPIERO NA `dblclick`.
         *
         * ZMIERZONE 07.09 (Playwright, 1440, zakładka Praca): podwójny klik
         * w kolumnę Termin albo Status BYŁ GUBIONY, gdy panel podglądu był
         * zamknięty. Pierwszy klik zaznaczał wiersz → podgląd się otwierał →
         * tabela zwężała się o jego szerokość → drugi klik lądował już nad
         * INNĄ komórką. Więc `dblclick` nie padał na tę komórkę, tylko na
         * wiersz, i wyrzucał użytkownika poza moduł. To nie jest artefakt
         * testu: mysz człowieka też stoi w miejscu między dwoma klikami.
         *
         * DWIE WARSTWY, obie zmierzone:
         *  1. komórka edytowalna PRZEJMUJE swój pojedynczy klik — bez tego
         *     otwarcie podglądu przesuwało układ w połowie gestu i edytor
         *     kolumn Termin/Status nie otwierał się ANI RAZU przy zamkniętym
         *     podglądzie (zmierzone: 0/2 prób). Podgląd otwiera się klikiem
         *     w Zadanie / Inicjatywę / Dni po terminie oraz z kebaba
         *     („Otwórz podgląd"), więc żadna droga nie znika;
         *  2. ślad z `mousedown` (PRZED jakimkolwiek przesunięciem układu) —
         *     gdy `dblclick` mimo wszystko trafi w wiersz, `handleRowDoubleClick`
         *     otworzy edytor TEJ komórki zamiast wyrzucać poza moduł.
         */
        onClick={(event) => {
          if (canEdit) event.stopPropagation();
        }}
        onMouseDown={() => {
          if (canEdit) onPointerStart();
        }}
        onDoubleClick={(event) => {
          if (!canEdit) return;
          event.stopPropagation();
          event.preventDefault();
          onStart();
        }}
      >
        {children}
      </div>
    );
  }

  const commit = (next: string) => {
    onStop();
    if (next !== editor.value(row)) void editor.onCommit(row, next);
  };

  if (editor.kind === 'select') {
    return (
      <select
        autoFocus
        aria-label={editor.ariaLabel}
        defaultValue={editor.value(row)}
        className={EDITOR_CLASS}
        onClick={stop}
        onDoubleClick={stop}
        onMouseDown={stop}
        onBlur={onStop}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Escape') onStop();
        }}
        onChange={(event) => {
          event.stopPropagation();
          commit(event.target.value);
        }}
      >
        {(editor.options?.(row) ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      autoFocus
      type="date"
      aria-label={editor.ariaLabel}
      defaultValue={editor.value(row)}
      className={EDITOR_CLASS}
      onClick={stop}
      onDoubleClick={stop}
      onMouseDown={stop}
      onBlur={(event) => commit(event.target.value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') onStop();
        if (event.key === 'Enter') commit((event.target as HTMLInputElement).value);
      }}
    />
  );
};

// ── Kebab wiersza — zamknięty kontrakt 3 stref ─────────────────────────────
// context → manage → danger. Puste strefy znikają. Funkcja bez handlera i bez
// prawdziwego business-lock reason nie jest renderowana jako atrapa.

export interface StandardRowMenuAction {
  id: string;
  label: string;
  icon?: React.ElementType;
  onClick?: () => void;
  disabled?: boolean;
  /** Dopisek pod etykietą (np. powód disabled). */
  note?: string;
  /** Submenu rozwijane strzałką (np. Delay › +1/+3/+7). */
  submenu?: StandardRowMenuAction[];
}

export interface StandardRowMenu {
  /** Blok 1: akcja główna encji (View/Open + Complete/Done/Approve). */
  primary?: StandardRowMenuAction[];
  /** Blok 2: przejścia stanu wg encji (To do / In progress / Blocked…). */
  statusTransitions?: StandardRowMenuAction[];
  /** Blok 3: czas — Delay ›/Snooze-presety (tylko encje z terminami). */
  timeActions?: StandardRowMenuAction[];
  /**
   * Blok CONVERT TO (OPCJONALNY, ANEKS #3a — `_PRZEGLAD_DOMOWY_WYNIKI_2026-07-10`
   * #3/#254): cele konwersji encji (Initiative/Report/Presentation/…, wzór
   * `ConvertToOutputMenu`). Renderowany MIĘDZY blokiem 4 (universal) i blokiem 5
   * (destructive), z nagłówkiem grupy "Convert to" — DOKŁADNIE jak dziś w
   * `ConvertToOutputMenu` (jeden dopisek dla całej grupy, nie per-pozycja).
   * Brak deklaracji ⇒ sekcja całkowicie pominięta, ZERO zmian wizualnych
   * (addytywne — moduły bez `convertActions` renderują się identycznie).
   */
  convertActions?: StandardRowMenuAction[];
  /** Strefa manage: handlery capabilities; nota oznacza realny business lock. */
  universalHandlers?: {
    preview?: () => void;
    previewNote?: string;
    edit?: () => void;
    editNote?: string;
    archive?: () => void;
    archiveNote?: string;
  };
  /** Strefa danger: akcja destrukcyjna. Brak deklaracji = capability N/D. */
  destructive?: {
    label?: string;
    icon?: React.ElementType;
    onClick?: () => void;
    note?: string;
  };
}

const NOOP = () => undefined;

const toRowAction = (action: StandardRowMenuAction): RowAction => ({
  id: action.id,
  label: action.label,
  icon: action.icon,
  onClick: action.onClick ?? NOOP,
  disabled: action.disabled || (!action.onClick && !action.submenu?.length),
  description: action.note,
  submenu: action.submenu?.map(toRowAction),
});

/**
 * Jedyne miejsce, które tłumaczy deklaratywny `StandardRowMenu` (kontrakt 3
 * stref) na renderowalne `RowActionSection[]`. Wyeksportowana, żeby ekrany z
 * WŁASNYM widokiem kart (siatka/grid) mogły zbudować kebab karty z DOKŁADNIE
 * tej samej funkcji `buildXRowMenu(entity)`, której używa `rowMenu` propa
 * tabeli — zamiast ręcznie duplikować sekcje (co historycznie rozjeżdżało
 * kebab tabeli i kebab karty, patrz `INT-MENU-OWN-001`/`REC-INT-005`).
 */
export function rowMenuToSections(
  menu: StandardRowMenu,
  translate: (key: string, fallback: string) => string,
  isPolish: boolean
): RowActionSection[] {
  const sections: RowActionSection[] = [];
  const contextActions = [...(menu.primary ?? []), ...(menu.statusTransitions ?? [])];
  if (contextActions.length) {
    sections.push({ id: 'context', kind: 'context', actions: contextActions.map(toRowAction) });
  }

  const u = menu.universalHandlers ?? {};
  const manageActions: StandardRowMenuAction[] = [];
  if (u.preview) {
    manageActions.push({
      id: 'open-preview',
      label: translate('common.openPreview', isPolish ? 'Otwórz podgląd' : 'Open preview'),
      icon: Eye,
      onClick: u.preview,
    });
  } else if (u.previewNote) {
    manageActions.push({
      id: 'open-preview',
      label: translate('common.openPreview', isPolish ? 'Otwórz podgląd' : 'Open preview'),
      icon: Eye,
      disabled: true,
      note: u.previewNote,
    });
  }
  if (u.edit || u.editNote) {
    manageActions.push({
      id: 'edit',
      label: translate('common.edit', isPolish ? 'Edytuj' : 'Edit'),
      icon: Pencil,
      onClick: u.edit ?? NOOP,
      disabled: !u.edit,
      note: u.edit ? undefined : u.editNote,
    });
  }
  if (u.archive || u.archiveNote) {
    manageActions.push({
      id: 'archive',
      label: translate('common.archive', isPolish ? 'Archiwizuj' : 'Archive'),
      icon: Archive,
      onClick: u.archive ?? NOOP,
      disabled: !u.archive,
      note: u.archive ? undefined : u.archiveNote,
    });
  }
  manageActions.push(...(menu.timeActions ?? []), ...(menu.convertActions ?? []));
  if (manageActions.length) {
    sections.push({
      id: 'manage',
      kind: 'manage',
      actions: manageActions.map(toRowAction),
    });
  }

  const d = menu.destructive;
  if (d) {
    sections.push({
      id: 'danger',
      kind: 'danger',
      actions: [
        {
          id: 'destructive',
          label: d.label ?? translate('common.delete', isPolish ? 'Usuń' : 'Delete'),
          icon: d.icon ?? Trash2,
          variant: 'danger',
          onClick: d.onClick ?? NOOP,
          disabled: !d.onClick,
          description: d.note,
        },
      ],
    });
  }
  return sections;
}

/**
 * Low-level compatibility seam: every legacy section is folded into the same
 * three visual zones as `rowMenu`, without changing action order or handlers.
 */
export function normalizeRowActionSections(sections: RowActionSection[]): RowActionSection[] {
  const zones: Record<'context' | 'manage' | 'danger', RowAction[]> = {
    context: [],
    manage: [],
    danger: [],
  };

  for (const section of sections) {
    const zone =
      section.kind === 'danger' || section.id === 'danger'
        ? 'danger'
        : section.kind === 'context' || section.kind === 'open' || section.id === 'context'
          ? 'context'
          : 'manage';
    zones[zone].push(...section.actions);
  }

  return (['context', 'manage', 'danger'] as const)
    .filter((zone) => zones[zone].length > 0)
    .map((zone) => ({ id: zone, kind: zone, actions: zones[zone] }));
}

/**
 * P16-R6 (D6, Raporty Realizacji): jeden kafel jednego kliknięcia w pustym
 * stanie — np. „Wygeneruj" konkretną definicję raportu zamiast jednego CTA
 * ogólnego. `title`/`description`/`meta` niosą treść karty (co to jest / po
 * co / dla kogo); `actionLabel`+`onAction` — jego jedyny przycisk.
 */
export interface StandardTableEmptyAction {
  id: string;
  title: string;
  description?: string;
  /** Dopisek pod opisem (np. odbiorcy/audytorium) — opcjonalny, ciche tło. */
  meta?: string;
  actionLabel: string;
  onAction: () => void;
}

export interface StandardTableEmpty {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  /**
   * Kafle jednego kliknięcia pod tekstem pustego stanu (ADDYTYWNE — pominięcie
   * propa daje dokładnie dotychczasowe zachowanie: `EmptyState` z co najwyżej
   * jednym `actionLabel`/`onAction`, bez kafli, ZERO zmian dla istniejących
   * ekranów). Nie jest nową tabelą — to karty w `tbody` pustego stanu.
   */
  actions?: StandardTableEmptyAction[];
}

export interface StandardTableSelection {
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
}

export interface StandardTableProps {
  /** `StandardTableColumn` = `TableColumn` + opcjonalne `editable` (edycja w wierszu). */
  columns: StandardTableColumn[];
  data: TableRow[];

  /**
   * ── R04-2B · powiązanie z kontraktem powierzchni ──────────────────────────
   *
   * Identyfikator jednej z 45 powierzchni audytu (`TABLE_SURFACE_REGISTER`,
   * pakiet R00). Gdy podany, fasada bierze z kontraktu to, czego ekran nie musi
   * już powtarzać:
   *
   *  · `persistKey` — 45 kluczy jest w rejestrze i są UNIKALNE (test R00),
   *    więc ekran nie może przypadkiem współdzielić ustawień kolumn z innym;
   *  · `capabilities.selection` — `none` znaczy „bez checkboxów", i fasada
   *    to egzekwuje, zamiast ufać, że ekran nie poda propa `selection`;
   *  · `columns.required` — brak wymaganej kolumny jest raportowany w dev.
   *
   * BRAK `surfaceId` jest w pełni wspierany i NIE jest błędem: 100 istniejących
   * konsumentów nie ma go i mają działać bez zmian. Fasada zachowuje się wtedy
   * dokładnie jak dotąd, a jedyną różnicą jest brak weryfikacji kontraktowej —
   * odnotowany jawnie w trybie dev, żeby „powierzchnia bez kontraktu" była
   * widoczna, a nie cicha.
   */
  surfaceId?: TableSurfaceId;

  /** Stany (MUST #9) — shared/states, nie ad-hoc teksty. */
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: StandardTableEmpty;
  /**
   * R04-2C: treść `tbody` w stanie pustym, gdy ekran nie deklaruje `empty`.
   * `ReactNode` — zwykły tekst nadal działa. Nie zastępuje tabeli: nagłówek
   * i geometria zostają (§5).
   */
  emptyMessage?: React.ReactNode;

  /** Podświetlenie wiersza (layout Table+Preview). */
  selectedRowId?: string | null;
  onRowClick?: (row: TableRow) => void;
  onRowDoubleClick?: (row: TableRow) => void;

  /**
   * MUST #6 — kontrakt kebaba (preferowany): fasada mapuje deklaracje modułu
   * do maksymalnie trzech stref context/manage/danger.
   */
  rowMenu?: (row: TableRow) => StandardRowMenu;
  /**
   * Niskopoziomowa alternatywa (pełne sekcje) — używać tylko, gdy encja nie
   * mieści się w kontrakcie `rowMenu`. Gdy podano oba, wygrywa `rowMenu`.
   */
  rowActions?: (row: TableRow) => RowActionSection[];

  /** MUST #3 — treść opisu wiersza (default: `row.description`). */
  rowDescription?: (row: TableRow) => React.ReactNode;

  /**
   * Opcjonalny dodatkowy CSS-class per wiersz (np. group-header w layoutach
   * grouped-rows jak Inbox). Addytywne — bez propa ZERO zmian wizualnych.
   */
  rowClassName?: string | ((row: TableRow) => string);
  /**
   * Wiersz grupujący (opt-in) — przelot do `FilterableTable`. Raport KPI grupuje
   * mierniki po obszarze (SSOT §6, werdykt K6): wiersz grupy jest JEDNĄ komórką
   * na całą szerokość, więc nie rysuje „—" w kolumnach, których grupa nie ma.
   * Bez tych dwóch propów fasada zachowuje się identycznie jak dotąd.
   */
  isGroupRow?: (row: TableRow) => boolean;
  renderGroupRow?: (row: TableRow) => React.ReactNode;
  /** Startowe przewinięcie do kolumny (SSOT raportu KPI §6) — przelot do jądra. */
  scrollToColumnId?: string | null;

  /** Lejki kolumn — kontrolowane z zewnątrz lub stan wewnętrzny fasady. */
  activeFilters?: FilterChip[];
  onFilterChange?: (filters: FilterChip[]) => void;

  defaultSort?: { columnId: string; direction: 'asc' | 'desc' };
  /** Persistencja układu kolumn + toggle opisu (localStorage). */
  persistKey?: string;

  /** MUST #7 — checkbox po lewej; zaznaczenie steruje trybem bulk Menu 3. */
  selection?: StandardTableSelection;

  density?: 'comfortable' | 'compact';
  canvasClassName?: string;
  /**
   * Minimalna szerokość tabeli — przekazywane 1:1 do `FilterableTable`.
   *
   * ADDYTYWNE: pominięcie propa daje dokładnie dotychczasowe 980 px, więc
   * żaden istniejący ekran listowy nie zmienia geometrii. Ekran, który na
   * wąskim widoku deklaruje jedną/dwie kolumny, może podać `'auto'` (albo
   * `'columns'` — próg liczony z liczby widocznych kolumn danych), żeby
   * zamiast ukrytego przewijania poziomego pokazać komplet treści.
   */
  minTableWidth?: number | 'auto' | 'columns';
}

const readStoredFlag = (key: string | null): boolean => {
  if (!key || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

export const StandardTable: React.FC<StandardTableProps> = ({
  columns,
  data,
  surfaceId,
  loading = false,
  error = null,
  onRetry,
  empty,
  emptyMessage,
  selectedRowId,
  onRowClick,
  onRowDoubleClick,
  rowMenu,
  rowActions,
  rowDescription,
  rowClassName,
  isGroupRow,
  renderGroupRow,
  scrollToColumnId,
  activeFilters,
  onFilterChange,
  defaultSort,
  persistKey,
  selection,
  density = 'comfortable',
  canvasClassName = 'p-4',
  minTableWidth,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  // ── Kebab: deklaracje domeny → maks. 3 strefy wizualne ───────────────────
  // Deleguje do wyeksportowanego `rowMenuToSections` (SSOT), żeby ekrany z
  // własnym widokiem kart budowały kebab karty z TEJ SAMEJ funkcji.
  const buildSections = useCallback(
    (menu: StandardRowMenu): RowActionSection[] => rowMenuToSections(menu, t, isPolish),
    [t, isPolish]
  );

  const getSections = useMemo(() => {
    if (rowMenu) return (row: TableRow) => buildSections(rowMenu(row));
    if (rowActions) return (row: TableRow) => normalizeRowActionSections(rowActions(row));
    return undefined;
  }, [rowMenu, rowActions, buildSections]);

  // ── Edycja w wierszu: która komórka jest otwarta ─────────────────────────
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null);
  /** Ślad gestu z `mousedown` komórki edytowalnej — patrz `handleRowDoubleClick`. */
  const gestKomorki = useRef<{ rowId: string; columnId: string; czas: number } | null>(null);

  /**
   * Podwójny klik na wierszu: gdy gest zaczął się w komórce edytowalnej, otwiera
   * EDYTOR TEJ KOMÓRKI zamiast wiersza (nawet jeśli drugi klik wylądował już
   * gdzie indziej, bo układ przesunął się po otwarciu podglądu).
   */
  const handleRowDoubleClick = useCallback(
    (row: TableRow) => {
      const slad = gestKomorki.current;
      if (slad && slad.rowId === String(row.id) && Date.now() - slad.czas < 1500) {
        gestKomorki.current = null;
        setEditingCell({ rowId: slad.rowId, columnId: slad.columnId });
        return;
      }
      onRowDoubleClick?.(row);
    },
    [onRowDoubleClick]
  );

  // ── Lejki kolumn: controlled ↔ internal ──────────────────────────────────
  const [internalFilters, setInternalFilters] = useState<FilterChip[]>([]);
  const filters = activeFilters ?? internalFilters;
  const handleFilterChange = useCallback(
    (next: FilterChip[]) => {
      setInternalFilters(next);
      onFilterChange?.(next);
    },
    [onFilterChange]
  );

  /**
   * R04-2B — kontrakt powierzchni. `undefined` gdy ekran nie deklaruje
   * `surfaceId`; wtedy fasada działa dokładnie jak dotąd.
   */
  const surfaceContract = surfaceId ? TABLE_SURFACE_REGISTER[surfaceId] : undefined;

  /**
   * `persistKey` z kontraktu, gdy ekran go nie podał. Rejestr gwarantuje 45
   * kluczy UNIKALNYCH (test R00), więc dwie powierzchnie nie mogą nadpisać
   * sobie ustawień kolumn. Jawny prop ekranu ma pierwszeństwo — nie odbieramy
   * nikomu kontroli, tylko dajemy poprawną wartość domyślną.
   */
  const effectivePersistKey = persistKey ?? surfaceContract?.capabilities.persistKey;

  /**
   * §1/§10: `selection: 'none'` znaczy „brak checkboxów", nie „checkboxy,
   * których nikt nie używa". Gdy kontrakt tak mówi, fasada odcina selection
   * niezależnie od tego, co podał ekran — to samo zabezpieczenie, które
   * `useTableSelection` dostał w R04-1, tyle że po stronie renderu.
   */
  const selectionAllowed = surfaceContract
    ? surfaceContract.capabilities.selection === 'bulk'
    : true;
  const effectiveSelection = selectionAllowed ? selection : undefined;

  // ── „Show row description" — persistowane per persistKey ────────────────
  const descKey = effectivePersistKey ? `standardTable.rowDesc.${effectivePersistKey}` : null;
  const [showRowDescription, setShowRowDescription] = useState<boolean>(() =>
    readStoredFlag(descKey)
  );
  const handleToggleDescription = useCallback(
    (value: boolean) => {
      setShowRowDescription(value);
      if (descKey && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(descKey, value ? '1' : '0');
        } catch {
          /* non-fatal */
        }
      }
    },
    [descKey]
  );

  const renderDescription = useCallback(
    (row: TableRow): React.ReactNode =>
      rowDescription ? rowDescription(row) : ((row.description as React.ReactNode) ?? null),
    [rowDescription]
  );

  // ── Selection (MUST #7): auto-prepend kolumny select + driver ───────────
  const visibleIds = useMemo(() => data.map((row) => String(row.id)), [data]);
  const selectedIds = selection?.selectedIds;
  const isAllSelected =
    !!selectedIds && visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const isIndeterminate =
    !!selectedIds && !isAllSelected && visibleIds.some((id) => selectedIds.has(id));

  // Weryfikacja kontraktowa — raportuje, nigdy nie blokuje renderu (bramka G1).
  const contractCheck = useMemo(() => {
    const violations: ContractViolation[] = [];
    if (!surfaceContract) {
      return toResult(violations);
    }

    const declared = new Set(columns.map((column) => column.id));
    for (const required of surfaceContract.capabilities.columns.required) {
      if (!declared.has(required)) {
        violations.push({
          code: 'TABLE_MISSING_REQUIRED_COLUMN',
          message:
            `${surfaceContract.id} (${surfaceContract.surface}) wymaga kolumny "${required}", ` +
            'a ekran jej nie deklaruje. §5: brak właściwości kluczowej dla decyzji jest ' +
            'FAIL tak samo jak brak elementu graficznego.',
          clause: 'contract §5 Kompletność informacyjna kolumn',
          path: `columns[${required}]`,
        });
      }
    }
    if (!declared.has(surfaceContract.capabilities.columns.identifier)) {
      violations.push({
        code: 'TABLE_MISSING_IDENTIFIER_COLUMN',
        message: `${surfaceContract.id}: brak kolumny identyfikującej "${surfaceContract.capabilities.columns.identifier}".`,
        clause: 'contract §5 Obowiązkowa anatomia',
        path: 'columns.identifier',
      });
    }
    if (selection && !selectionAllowed) {
      violations.push({
        code: 'TABLE_SELECTION_NOT_DECLARED',
        message: `${surfaceContract.id} deklaruje selection: 'none', a ekran podał prop selection — checkboxy zostały odcięte.`,
        clause: 'contract §1, §10 Selection',
        path: 'selection',
      });
    }
    return toResult(violations);
  }, [surfaceContract, columns, selection, selectionAllowed]);

  assertContractInDev(`StandardTable(${surfaceId ?? 'bez surfaceId'})`, contractCheck);

  /**
   * Kolumny z `editable` dostają render owinięty w `StandardEditableCell`.
   * Kolumny bez `editable` przechodzą przez tę mapę BEZ ZMIANY (ta sama
   * referencja obiektu), więc żaden istniejący ekran nie zmienia zachowania.
   */
  const editableColumns = useMemo<TableColumn[]>(
    () =>
      columns.map((column) => {
        const editor = column.editable;
        if (!editor) return column;
        const baseRender = column.render;
        return {
          ...column,
          render: (row: TableRow) => (
            <StandardEditableCell
              row={row}
              editor={editor}
              editing={editingCell?.rowId === String(row.id) && editingCell?.columnId === column.id}
              onStart={() => setEditingCell({ rowId: String(row.id), columnId: column.id })}
              onStop={() => setEditingCell(null)}
              onPointerStart={() => {
                gestKomorki.current = {
                  rowId: String(row.id),
                  columnId: column.id,
                  czas: Date.now(),
                };
              }}
            >
              {baseRender ? baseRender(row) : ((row[column.id] as React.ReactNode) ?? '—')}
            </StandardEditableCell>
          ),
        };
      }),
    [columns, editingCell]
  );

  const effectiveColumns = useMemo<TableColumn[]>(
    () =>
      effectiveSelection
        ? [
            { id: '__select', label: '', type: 'select' as const, width: '44px' },
            ...editableColumns,
          ]
        : editableColumns,
    [effectiveSelection, editableColumns]
  );

  const selectionDriver = useMemo(() => {
    if (!effectiveSelection) return undefined;
    return {
      selectedIds: effectiveSelection.selectedIds,
      onToggleRow: (id: string) => {
        const next = new Set(effectiveSelection.selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        effectiveSelection.onChange(next);
      },
      onToggleAll: () => {
        effectiveSelection.onChange(isAllSelected ? new Set<string>() : new Set(visibleIds));
      },
      isAllSelected,
      isIndeterminate,
    };
  }, [effectiveSelection, isAllSelected, isIndeterminate, visibleIds]);

  // ── Stany (MUST #9) ──────────────────────────────────────────────────────
  /**
   * ── R04-2C · empty i loading BEZ utraty nagłówka ──────────────────────────
   *
   * Do R04-2C obie sytuacje robiły wczesny `return` i renderowały `EmptyState`
   * / `LoadingState` ZAMIAST tabeli — nagłówek, szerokości kolumn i geometria
   * znikały całkowicie. To jest wprost sprzeczne z §5: „empty state zachowuje
   * nagłówek i geometrię tabeli" oraz „loading zachowuje liczbę i przybliżone
   * szerokości kolumn".
   *
   * Teraz oba stany jadą tą samą, JEDNĄ ścieżką renderu: tabela powstaje
   * normalnie (nagłówek, kolumny, 56 px), a treść stanu ląduje w `tbody` przez
   * `emptyMessage`. Renderer nie jest dublowany — fasada nadal niczego nie
   * rysuje sama.
   *
   * `data-testid` obu stanów zostają, bo opierają się na nich istniejące testy.
   */
  const stateContent: React.ReactNode = loading ? (
    <div data-testid="standard-table-loading">
      <LoadingState template="list" rows={3} />
    </div>
  ) : data.length === 0 && filters.length === 0 && empty ? (
    <div data-testid="standard-table-empty">
      <EmptyState
        variant="new"
        icon={empty.icon}
        title={empty.title}
        description={empty.description}
        primaryAction={
          empty.actionLabel && empty.onAction
            ? { label: empty.actionLabel, onClick: empty.onAction }
            : undefined
        }
      />
      {empty.actions && empty.actions.length > 0 && (
        <div
          className="mx-auto grid max-w-4xl grid-cols-1 gap-3 px-8 pb-10 sm:grid-cols-2 lg:grid-cols-4"
          data-testid="standard-table-empty-actions"
        >
          {empty.actions.map((action) => (
            <div
              key={action.id}
              data-testid={`standard-table-empty-action-${action.id}`}
              className="flex flex-col gap-2 rounded-token-lg border border-[var(--c-border)] bg-[var(--c-surface)] p-4 text-left"
            >
              <h4 className="text-sm font-semibold text-[var(--c-text)]">{action.title}</h4>
              {action.description && (
                <p className="text-xs text-[var(--c-text-muted)]">{action.description}</p>
              )}
              {action.meta && (
                <p className="text-[11px] uppercase tracking-wide text-[var(--c-text-muted)]">
                  {action.meta}
                </p>
              )}
              <button
                type="button"
                className="btn-secondary mt-auto self-start"
                onClick={action.onAction}
              >
                {action.actionLabel}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  ) : (
    emptyMessage
  );

  // Podczas ładowania `tbody` nie pokazuje starych wierszy — nagłówek zostaje.
  const tableData = loading ? [] : data;

  if (error) {
    return (
      <div className={canvasClassName} data-testid="standard-table-error">
        {/* R09-1 (2026-08-10, defekt P2): `primaryAction={{label:'Retry',...}}`
            wpisywał angielski napis na sztywno niezależnie od języka konta —
            widoczne na polskim ekranie z angielskim przyciskiem. `EmptyState`
            ma gotową furtkę dokładnie po to: `onRetry` samo syntetyzuje
            przetłumaczony CTA (`common.retry`, patrz
            `src/components/shared/states/EmptyState.tsx`) zamiast wymuszać
            etykietę z zewnątrz — więc podajemy handler, nie literał. */}
        <EmptyState variant="error" title={error} onRetry={onRetry} />
      </div>
    );
  }

  return (
    <FilterableTable
      columns={effectiveColumns}
      data={tableData}
      selectedRowId={selectedRowId}
      onRowClick={onRowClick}
      onRowDoubleClick={handleRowDoubleClick}
      getRowActionSections={getSections}
      /* Bez rowMenu/rowActions FilterableTable renderowałby domyślny kebab
         z 5 no-op pozycjami (onRowAction nie jest forwardowany) — martwe
         kliknięcia. Kebab tylko gdy moduł zadeklarował akcje. */
      hideRowActions={!getSections}
      emptyMessage={stateContent}
      activeFilters={filters}
      onFilterChange={handleFilterChange}
      canvasClassName={canvasClassName}
      density={density}
      /* Aneks #3: Settings2 → TableSettingsPopover OBOWIĄZKOWY, nie do podmiany. */
      enableColumnSettings
      rowDescription={{
        render: renderDescription,
        show: showRowDescription,
        onToggle: handleToggleDescription,
      }}
      defaultSort={defaultSort ?? null}
      persistKey={effectivePersistKey}
      selection={selectionDriver}
      rowClassName={rowClassName}
      isGroupRow={isGroupRow}
      renderGroupRow={renderGroupRow}
      scrollToColumnId={scrollToColumnId}
      /* `undefined` → domyślka `FilterableTable` (980 px). Zero zmiany dla
         ekranów, które tego propa nie podają. */
      minTableWidth={minTableWidth}
    />
  );
};

export default StandardTable;
