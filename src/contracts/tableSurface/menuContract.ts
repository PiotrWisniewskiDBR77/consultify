/**
 * Kontrakt MENU 1 / 2 / 3.
 *
 * Źródło normatywne: `MY_WORK_TABLE_SURFACE_CONTRACT_V1.md` §2 (Menu 1),
 * §3 (Menu 2), §4 (Menu 3). Pakiet naprawczy: R02.
 *
 * Co ten kontrakt naprawia (audyt 45 tabel): MENU_1_2_3 oblało 44 z 45 tabel
 * (jedyny PASS: T25 Portfolio). Trzy powtarzające się źródła:
 *  · liczniki w Menu 2 — `INT-MENU-001`: zakładki renderowały „③ Inbox",
 *    „① Templates"; §3 zabrania liczników w Menu 2 wprost;
 *  · Menu 3 bez maszyny stanów — bulk, taby i filtry współistniały albo
 *    wykluczały się przypadkowo, zamiast wg priorytetu `bulk > open tabs > filters`;
 *  · równoległe implementacje `Clear` (REPAIR_WORK_PACKAGES R02: „Must remove
 *    parallel Clear implementations").
 *
 * Menu 3 jest tu zamodelowane jako JEDNA maszyna stanów z rozłączną unią —
 * dwa stany naraz są niereprezentowalne typem. To jest zasada architektoniczna 5
 * z REPAIR_MASTER_PLAN, przeniesiona z prozy do systemu typów.
 *
 * @module contracts/tableSurface/menuContract
 */

import { CANON_MENU2_RIGHT_CLUSTER_ORDER, CANON_MENU3_STATE_PRIORITY } from './canon';
import type { CanonicalIcon } from './types';

// ─── Menu 1 — pasek kontekstu aplikacji (§2) ────────────────────────────────

/**
 * Menu 1 to poziomy pasek nad Menu 2. SIDEBAR NIE JEST MENU 1 (§2, §10).
 * Nie zawiera akcji domenowych tabeli — te należą do Menu 2 i Menu 3.
 */
export interface Menu1Contract {
  /** `Moduł › aktywna zakładka`. Preview NIE zmienia breadcrumb (§2). */
  breadcrumb: Array<{ label: string; href?: string }>;
  /** Prawa strona: Data → Model → ikony systemowe → profil. Stała kolejność. */
  systemCluster: readonly ['data', 'model', 'systemIcons', 'profile'];
  /** Twardy zakaz: żadnych akcji domenowych tabeli w Menu 1. */
  domainActions: never[];
}

// ─── Menu 2 — nawigacja i kontrola widoku (§3) ──────────────────────────────

export interface Menu2Tab {
  id: string;
  /**
   * Etykieta BEZ licznika i bez numerycznego prefiksu. §3: „Menu 2 nigdy nie
   * pokazuje liczników." Walidator odrzuca `③ Inbox` i `Inbox (3)`.
   */
  label: string;
  icon?: CanonicalIcon;
}

/** Element prawego klastra Menu 2 — kolejność wymuszana walidatorem. */
export type Menu2RightClusterSlot = (typeof CANON_MENU2_RIGHT_CLUSTER_ORDER)[number];

export interface Menu2Contract {
  /** Search toggle po lewej — tylko gdy wyszukiwanie jest dostępne (§3). */
  searchToggle: boolean;
  /** Zakładki modułu w stabilnej kolejności. */
  tabs: Menu2Tab[];
  activeTabId: string;
  /**
   * Prawy klaster, deklarowany od LEWEJ do prawej. Walidator sprawdza zgodność
   * z `CANON_MENU2_RIGHT_CLUSTER_ORDER` i limit jednego primary CTA.
   */
  rightCluster: Menu2RightClusterSlot[];
  /**
   * Segment view modes renderuje się dopiero od DWÓCH widoków (§3) i wyłącznie
   * w Menu 2 — nigdy w Menu 3 (§10, wiersz „View modes").
   */
  viewModes: string[];
  /** Maksymalnie JEDEN złożony dropdown Filters — i tylko gdy potrzebny (§3). */
  hasFiltersDropdown: boolean;
}

// ─── Menu 3 — dokładnie jeden dynamiczny command row (§4) ───────────────────

export type Menu3StateKind = (typeof CANON_MENU3_STATE_PRIORITY)[number];

/** Formuła 1 — filtry. Chip ma licznik ZAWSZE, także 0 (§4 Formuła 1). */
export interface Menu3FiltersState {
  kind: 'filters';
  chips: Array<{
    id: string;
    label: string;
    /** Wymagany. `0` jest wartością poprawną i musi być widoczne. */
    count: number;
    active?: boolean;
  }>;
  /** Najwyżej pięć akcji całego zbioru/AI; reszta w overflow (§4 Formuła 1). */
  rightActions: Array<{ actionId: string; label: string; icon: CanonicalIcon }>;
}

/**
 * Formuła 2 — bulk. Występuje TYLKO dla `selection: 'bulk'` (§4 Formuła 2).
 * Kolejność lewego klastra: `N selected` → `Clear` → akcje wspólne →
 * akcje kontekstowe → danger na końcu.
 */
export interface Menu3BulkState {
  kind: 'bulk';
  /** Liczba zaznaczonych. Pasek renderuje się wyłącznie gdy > 0. */
  selectedCount: number;
  /** Opcjonalne `Select all`. */
  selectAll?: boolean;
  /**
   * `Clear` z ikoną X jest ZAWSZE obecny i ZAWSZE przywraca formułę 1.
   * Typ `true` zamiast `boolean` — nieobecność jest niereprezentowalna.
   */
  clear: true;
  /**
   * Akcje poza Clear. §4: „zawsze istnieje co najmniej jedna realna akcja poza
   * Clear" — pusta tablica jest naruszeniem, wyłapywanym przez walidator.
   */
  actions: Array<{
    actionId: string;
    label: string;
    icon: CanonicalIcon;
    danger?: boolean;
    disabled?: boolean;
  }>;
}

/** Formuła 3 — otwarte taby (§4 Formuła 3). */
export interface Menu3OpenTabsState {
  kind: 'openTabs';
  tabs: Array<{
    id: string;
    /** Realny tytuł obiektu, nie `Item`. */
    title: string;
    icon: CanonicalIcon;
    /** × zamyka tab i przywraca listę bez utraty filtrów, sortu i scrolla. */
    closable: true;
  }>;
}

/**
 * Stan Menu 3 — unia ROZŁĄCZNA. Dwa stany naraz są niereprezentowalne.
 *
 * `resolveMenu3State` rozstrzyga priorytet, a nie komponent — dzięki temu
 * „bulk pojawił się, ale taby zostały narysowane obok" nie może się wydarzyć
 * przez przeoczenie w jednym z 45 ekranów.
 */
export type Menu3State = Menu3FiltersState | Menu3BulkState | Menu3OpenTabsState;

/**
 * Rozstrzyga, który stan Menu 3 jest widoczny: `bulk > open tabs > filters` (§4).
 *
 * Zwraca stan WIDOCZNY; stany przegrywające NIE są kasowane ze store'u —
 * §4 Formuła 3: „bulk ma pierwszeństwo wizualne, ale nie usuwa otwartych tabów
 * ze stanu". Dlatego funkcja przyjmuje wszystkie trzy i tylko wybiera.
 */
export function resolveMenu3State(input: {
  bulk?: Menu3BulkState;
  openTabs?: Menu3OpenTabsState;
  filters: Menu3FiltersState;
}): Menu3State {
  if (input.bulk && input.bulk.selectedCount > 0) return input.bulk;
  if (input.openTabs && input.openTabs.tabs.length > 0) return input.openTabs;
  return input.filters;
}

/** Indeks priorytetu stanu — 0 wygrywa. Do testów kolejności. */
export function menu3StatePriority(kind: Menu3StateKind): number {
  return CANON_MENU3_STATE_PRIORITY.indexOf(kind);
}

// ─── Złożenie ───────────────────────────────────────────────────────────────

/** Pełny kontrakt trzech pasków jednej powierzchni. */
export interface MenuStackContract {
  surfaceId: string;
  menu1: Menu1Contract;
  menu2: Menu2Contract;
  menu3: Menu3State;
}

/**
 * Wzorce zakazane w etykiecie zakładki Menu 2 (§3 Zakazy: „liczniki").
 *
 * Pokrywa oba warianty znalezione w audycie: numeral otoczony (`③ Inbox`,
 * `(1) Inbox`) i licznik doklejony (`Inbox (3)`, `Inbox · 3`).
 */
export const MENU2_COUNTER_PATTERNS: readonly RegExp[] = [
  /[①-⑳⓪❶-❿]/, // ①..⑳, ⓪, ❶..❿
  /^\s*[([]?\d+[)\]]?\s+/, // wiodący licznik: "3 Inbox", "(3) Inbox"
  /[([]\s*\d+\s*[)\]]\s*$/, // domykający licznik: "Inbox (3)"
  /[·•|]\s*\d+\s*$/, // separator + liczba: "Inbox · 3"
];
