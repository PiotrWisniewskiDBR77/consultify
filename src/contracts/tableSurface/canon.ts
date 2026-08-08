/**
 * KANON LICZBOWY powierzchni tabelowej — jedno źródło wymiarów, limitów i kolejności.
 *
 * Źródło normatywne: `docs/ui-standards/MY_WORK_TABLE_SURFACE_CONTRACT_V1.md`
 * (status CLOSED / NORMATIVE, 2026-08-05) — §4 Menu 3, §5 Tabela, §6 Preview,
 * §7 Kebab, §8 PPM, §9 Focus/kolor, §10 Rozstrzygnięte sprzeczności.
 *
 * Dlaczego osobny plik, a nie liczby wpisane w komponenty: audyt 45 tabel
 * (`evidence/table-audit-45-2026-08-05/ATOMIC_DEFECT_BACKLOG.csv`, 322 defekty)
 * pokazał, że ta sama wartość była w kodzie zapisana w kilku wariantach naraz
 * (kebab min-width 160 px w `RowActionsMenu.tsx` wobec 220 px w kontrakcie).
 * Dopóki liczba żyje w komponencie, „wyjątek lokalny" jest niewykrywalny.
 * Tutaj jest jedna liczba i jeden test.
 *
 * TEN PLIK NICZEGO NIE RENDERUJE. R00 zamraża kontrakt; podłączenie wartości do
 * `StandardTable` / `StandardPreview` / `RowActionsMenu` należy do R01–R04.
 *
 * @module contracts/tableSurface/canon
 */

/** Wysokości kontrolek w px (§10 — tabela rozstrzygniętych sprzeczności). */
export const CANON_HEIGHT = {
  /** Menu 2 pigułka zakładki oraz przycisk akcji preview — `h-9`. */
  menu2Tab: 36,
  /** Pozycja menu kebab/PPM — `h-9` (§7 kontrakt graficzny). */
  menuItem: 36,
  /** Przycisk akcji w karcie Actions preview — `h-9` (§6 Actions). */
  previewActionButton: 36,
  /** Przycisk bulk w Menu 3 — `h-8` (§10: 32 px, nie 36). */
  menu3BulkButton: 32,
  /** Chip filtra w Menu 3 — `h-7` (§10: 28 px, NIE 24 px). */
  menu3FilterChip: 28,
  /** Chip meta w preview — `h-6` (§6 Meta). */
  previewMetaChip: 24,
  /** Pill relacji w preview — `h-7` (§6 Relations). */
  previewRelationPill: 28,
  /** Nagłówek bloku Details / pierwszy rząd Meta (§6). */
  previewBlockHeader: 28,
} as const;

/** Minimalne cele kliknięcia w px — kwadratowe (§10, §7 trigger). */
export const CANON_HIT_TARGET = {
  /** Settings2, kebab wiersza, Pin, × w headerze preview. */
  min: 32,
  /** Lokalny kebab w bloku Details preview (§6 Details). */
  detailsKebab: 28,
} as const;

/** Rozmiary ikon w px (§6, §7). */
export const CANON_ICON = {
  default: 16,
  relationPill: 14,
} as const;

/** Szerokości i odstępy panelu preview w px (§6 kontener + kontrakt graficzny). */
export const CANON_PREVIEW = {
  /** `clamp(340px, 28%, 480px)` — dolna granica. */
  minWidth: 340,
  /** `clamp(340px, 28%, 480px)` — górna granica. */
  maxWidth: 480,
  /** Preferowana szerokość jako ułamek obszaru roboczego. */
  preferredRatio: 0.28,
  /** Odstęp preview ↔ tabela; preview NIE ma własnego border-left. */
  gapFromTable: 6,
  /** Padding wrappera panelu. */
  wrapperPadding: 12,
  /** Odstęp pionowy między kartami bloków. */
  cardGap: 10,
  /** Padding wewnątrz karty bloku. */
  cardPadding: 12,
  /** Radius karty bloku. */
  cardRadius: 12,
} as const;

/**
 * Wysokości bloków preview w px (§6 kontrakt graficzny, tabela „Blok / Wysokość").
 * `details` jest elastyczny — `min` to twarda dolna granica, `preferred*` to zakres
 * zalecany; brak bloku AI oddaje przestrzeń Details, nie zostawia pustego slotu.
 */
export const CANON_PREVIEW_BLOCK_HEIGHT = {
  header: 52,
  meta: 88,
  detailsMin: 200,
  detailsPreferredMin: 220,
  detailsPreferredMax: 280,
  /** Renderowany wyłącznie przy realnych akcjach AI. */
  ai: 76,
  relations: 64,
  /** Actions dla 1 / 2 / 3 rzędów siatki. */
  actionsByRows: [60, 106, 152],
} as const;

/** Limity treści preview (§6 Details / Meta / Relations / Actions). */
export const CANON_PREVIEW_LIMIT = {
  /** Proza Details — zakres użyteczny. */
  proseWordsMin: 80,
  proseWordsMax: 140,
  /** Miękkie maksimum: powyżej wymagany scroll albo `Show more`. */
  proseWordsSoftMax: 160,
  /** Properties zamiast prozy — liczba wierszy klucz–wartość. */
  propertyRowsMin: 5,
  propertyRowsMax: 8,
  /** File-list bez scrolla. */
  fileListMax: 5,
  /** Rekomendacja w bloku Meta. */
  metaRecommendationWordsMin: 8,
  metaRecommendationWordsMax: 18,
  metaRecommendationWordsHardMax: 24,
  /** Relations — widoczne pille przed `+N`. */
  relationPillsVisibleMax: 4,
  /** Akcje AI pokazane bezpośrednio, reszta w jednym overflow. */
  aiActionsDirectMax: 3,
  /** Siatka Actions: 2 kolumny × maks. 3 rzędy. */
  actionGridColumns: 2,
  actionGridRowsMax: 3,
  actionsDirectMax: 6,
  /** Etykieta przycisku akcji. */
  actionLabelWordsMax: 3,
  actionLabelCharsMax: 22,
} as const;

/** Geometria menu kebab i PPM (§7 kontrakt graficzny; §8 — PPM dziedziczy 1:1). */
export const CANON_ROW_MENU = {
  minWidth: 220,
  maxWidth: 320,
  paddingY: 6,
  radius: 12,
  /** Minimalny odstęp od krawędzi viewportu przed auto-flip. */
  viewportClearance: 12,
  /** Tolerancja wyrównania prawej krawędzi menu do prawej krawędzi triggera. */
  rightAlignTolerance: 5,
  /** Trzy strefy → maksymalnie dwa separatory (§7 Zakazy). */
  separatorsMax: 2,
  separatorMarginY: 4,
} as const;

/** Geometria tabeli (§5 Wymiary i mechanika). */
export const CANON_TABLE = {
  /**
   * Wysokość nagłówka rejestru — DOKŁADNIE 56 px.
   *
   * Decyzja zarządzająca R04-0 (2026-08-06): 56 px z `REPAIR_MASTER_PLAN.md`
   * (R04: „wysokość nagłówka i wiersza 56 px") jest NADRZĘDNE. Zapis
   * `px-3 py-2.5` z kontraktu §5 to wyłącznie WSKAZÓWKA paddingu i nie może
   * zmienić wysokości końcowej.
   *
   * Rozstrzyga realną sprzeczność: do R04-0 kanon podawał tylko paddingi, więc
   * wysokość wiersza była wypadkową fontu i line-heightu — czyli nie dało się
   * jej ani zadeklarować, ani sprawdzić. Preflight R04 pokazał, że w kodzie
   * żyje `px-4 py-3` / `px-4 py-2`, a żaden test nie mógł tego złapać, bo nie
   * istniała liczba do porównania.
   */
  headerHeight: 56,
  /** Wysokość wiersza rejestru — DOKŁADNIE 56 px, stała dla wiersza z opisem i bez. */
  rowHeight: 56,
  /** Odstęp Menu 3 → nagłówek tabeli. */
  gapFromMenu3: 8,
  /**
   * Paddingi komórek. WSKAZÓWKA, nie wyznacznik wysokości — przy konflikcie
   * wygrywa `rowHeight`/`headerHeight`.
   */
  cellPaddingX: 12,
  cellPaddingY: 10,
  /** Tytuł rekordu ma wyższy padding pionowy (`py-3`). Też tylko wskazówka. */
  titleCellPaddingY: 12,
  /** Tytuł: maks. 2 linie, pełna wartość w accessible name/tooltip. */
  titleLinesMax: 2,
  /** Opis wiersza: maks. 2 linie. */
  descriptionLinesMax: 2,
  /** Bazowa siatka odstępów. */
  spacingGrid: 4,
  /** Kanoniczny placeholder pustej komórki. */
  emptyCellPlaceholder: '—',
} as const;

/** Typografia (§5 anatomia, §6 header). */
export const CANON_TYPOGRAPHY = {
  family: 'Inter',
  tableHeaderSizePx: 11,
  tableHeaderWeight: 600,
  tableHeaderTransform: 'uppercase',
  rowTitleSizePx: 14,
  rowTitleWeight: 600,
  rowDescriptionSizePx: 11,
  menuItemSizePx: 13,
  menuShortcutSizePx: 11,
} as const;

/** Viewporty odbioru (§9 Viewport desktopowy i reflow). */
export const CANON_VIEWPORT = {
  /** Referencyjny — proporcje, gęstość, geometria. */
  reference: { width: 1440, height: 900 },
  /** Obowiązkowe minimum desktopu — dozwolony jawny overflow, zakazane obcięcie. */
  minimum: { width: 1280, height: 720 },
} as const;

/** Maksymalny czas animacji w ms; respektuje `prefers-reduced-motion` (§9). */
export const CANON_MOTION_MAX_MS = 220;

/**
 * Kanoniczny rejestr ikon wspólnych akcji (§6, tabela „Działanie / Ikona").
 *
 * Reguła: ta sama akcja używa tej samej ikony w KAŻDYM module. Zmiana wymaga
 * aktualizacji tego rejestru, nie lokalnej decyzji ekranu. Nazwy są nazwami
 * eksportów `lucide-react` — trzymamy je jako stringi, żeby `src/contracts`
 * pozostało wolne od importów warstwy UI (ten sam powód, dla którego
 * `src/types/tablePlatform.ts` nie importuje komponentów).
 */
export const CANON_ACTION_ICON = {
  open: 'ArrowUpRight',
  openPreview: 'PanelRightOpen',
  complete: 'CheckCircle2',
  approve: 'BadgeCheck',
  reject: 'XCircle',
  delete: 'Trash2',
  edit: 'Pencil',
  archive: 'Archive',
  restore: 'ArchiveRestore',
  assign: 'UserPlus',
  addNote: 'StickyNote',
  remind: 'Bell',
  delay: 'Clock3',
  changeDueDate: 'CalendarClock',
  escalate: 'TriangleAlert',
  copy: 'Copy',
  export: 'FileDown',
  download: 'Download',
  relation: 'Link2',
  ai: 'Sparkles',
  report: 'FileText',
  presentation: 'Presentation',
  table: 'Table',
  /** Trigger kebaba (§7 Trigger — glyph `MoreVertical`, nie `MoreHorizontal`). */
  rowMenuTrigger: 'MoreVertical',
} as const;

export type CanonActionIconKey = keyof typeof CANON_ACTION_ICON;

/**
 * Wzorzec ATRAPY (§1 i §10): „Coming soon" / „Wkrótce" są w produkcyjnym menu
 * NIEDOZWOLONE. Funkcja niezaimplementowana jest POMIJANA i raportowana jako
 * capability gap — nie renderowana jako wyszarzona pozycja z dopiskiem.
 *
 * Świadomie zduplikowane wobec `ATRAPA_WZORZEC` w `RowActionsMenu.tsx`: ten plik
 * nie może importować z warstwy komponentów (kierunek zależności), a
 * `RowActionsMenu.tsx` jest w tej fali cudzą własnością (READ_ONLY dla R00).
 * Test `legacyBaseline.test.ts` pilnuje, żeby oba wzorce pozostały równoważne.
 */
export const CANON_PLACEHOLDER_LABEL_PATTERN = /coming soon|wkrótce|wkrotce/i;

/**
 * Warianty przycisku akcji preview (§6 Actions i przyciski — „Dozwolonych jest
 * pięć wariantów"). Wariant wynika ze SKUTKU, nie z modułu.
 */
export const CANON_ACTION_VARIANTS = [
  'primary',
  'positive',
  'warning',
  'destructive',
  'neutral',
] as const;

/** Maksymalna liczba akcji `primary` w jednym panelu preview (§6). */
export const CANON_PRIMARY_ACTIONS_MAX = 1;

/**
 * Kolejność stref menu wiersza (§7 Logiczne strefy). Niezmienna: puste strefy
 * znikają razem ze swoim separatorem, ale kolejność pozostałych nie zmienia się
 * nigdy.
 */
export const CANON_ROW_MENU_ZONE_ORDER = ['context', 'manage', 'danger'] as const;

/**
 * Kolejność pozycji w strefie `manage` (§7 Manage — „stała kolejność w ramach
 * capabilities"). Stałość oznacza tę samą POZYCJĘ dla zadeklarowanego zestawu
 * capabilities, nie obowiązek pokazywania funkcji nieistniejącej w domenie.
 */
export const CANON_MANAGE_ACTION_ORDER = ['open-preview', 'edit', 'archive', 'delay'] as const;

/** Kolejność sześciu bloków preview (§6 — „Sześć bloków w stałej kolejności"). */
export const CANON_PREVIEW_BLOCK_ORDER = [
  'header',
  'meta',
  'details',
  'ai',
  'relations',
  'actions',
] as const;

/**
 * Priorytet stanów Menu 3 (§4 — „Priorytet stanów: `bulk > open tabs > filters`").
 * Indeks 0 wygrywa. `bulk` ma pierwszeństwo WIZUALNE, ale nie usuwa otwartych
 * tabów ze stanu (§4 Formuła 3).
 */
export const CANON_MENU3_STATE_PRIORITY = ['bulk', 'openTabs', 'filters'] as const;

/** Maksymalna liczba akcji zbioru/AI po prawej stronie Menu 3 (§4 Formuła 1). */
export const CANON_MENU3_RIGHT_ACTIONS_MAX = 5;

/**
 * Kolejność prawego klastra Menu 2 od LEWEJ do prawej (§3 — „Prawa strona").
 * Z perspektywy prawej krawędzi kolejność jest odwrotna:
 * Area → CTA → Tool → Views → Filters.
 */
export const CANON_MENU2_RIGHT_CLUSTER_ORDER = [
  'filters',
  'viewModes',
  'domainTool',
  'primaryCta',
  'areaToggle',
] as const;

/** Dokładnie jeden neutralny primary CTA w Menu 2 (§3 Zakazy). */
export const CANON_MENU2_PRIMARY_CTA_MAX = 1;
