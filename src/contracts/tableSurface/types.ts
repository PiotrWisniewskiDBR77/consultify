/**
 * TYPY KONTRAKTU powierzchni tabelowej T01–T45.
 *
 * Źródło normatywne: `docs/ui-standards/MY_WORK_TABLE_SURFACE_CONTRACT_V1.md` §1
 * (deskryptor możliwości), §5 (tabela), §10 (rozstrzygnięcia).
 * Plan: `evidence/table-audit-45-2026-08-05/REPAIR_MASTER_PLAN.md`, Fala 0 / R00.
 *
 * Zasada, którą te typy egzekwują (REPAIR_MASTER_PLAN §Zasady architektoniczne 1):
 * jedna powierzchnia = jeden komponent SSOT. Powierzchnia bez `hasTable: true`
 * NIE JEST tabelą kontraktową i nie liczy się do mianownika 45.
 *
 * @module contracts/tableSurface/types
 */

import type { CanonActionIconKey } from './canon';

// ─── Identyfikacja powierzchni ──────────────────────────────────────────────

/**
 * Dokładnie 45 identyfikatorów objętych audytem
 * (`evidence/table-audit-45-2026-08-05/MATRIX_T01_T45.csv`).
 *
 * Union jest wypisany ręcznie, a nie generowany szablonem `T${number}`, celowo:
 * `Record<TableSurfaceId, …>` w `surfaceRegister.ts` wymusza wtedy KOMPLET wpisów
 * na poziomie kompilacji. Dopisanie T46 bez wpisu do rejestru nie skompiluje się —
 * to ten sam mechanizm, którym `registry.ts` pilnuje siedmiu kart N.
 *
 * UWAGA: `CONSULTIFY_SURFACE_REGISTER_2026-08-04.csv` zawiera także T46–T50
 * (Presentations, Sheets, Template Library, Audit programs, Meetings). Są POZA
 * mianownikiem audytu 45 i celowo nie ma ich w tym unionie.
 */
export type TableSurfaceId =
  | 'T01'
  | 'T02'
  | 'T03'
  | 'T04'
  | 'T05'
  | 'T06'
  | 'T07'
  | 'T08'
  | 'T09'
  | 'T10'
  | 'T11'
  | 'T12'
  | 'T13'
  | 'T14'
  | 'T15'
  | 'T16'
  | 'T17'
  | 'T18'
  | 'T19'
  | 'T20'
  | 'T21'
  | 'T22'
  | 'T23'
  | 'T24'
  | 'T25'
  | 'T26'
  | 'T27'
  | 'T28'
  | 'T29'
  | 'T30'
  | 'T31'
  | 'T32'
  | 'T33'
  | 'T34'
  | 'T35'
  | 'T36'
  | 'T37'
  | 'T38'
  | 'T39'
  | 'T40'
  | 'T41'
  | 'T42'
  | 'T43'
  | 'T44'
  | 'T45';

/** Moduły produktu w mianowniku audytu (kolumna `module` w MATRIX_T01_T45.csv). */
export type TableSurfaceModule =
  | 'My Work'
  | 'Interview'
  | 'Consulting Tools'
  | 'Assessment'
  | 'Initiatives'
  | 'Execution'
  | 'Results'
  | 'Finance'
  | 'Materials';

/** Pięć powierzchni odbiorowych każdej tabeli (AUDIT_CHECKPOINT_MODEL.md §Zakres). */
export const ACCEPTANCE_SURFACES = ['TABLE', 'PREVIEW', 'MENU_1_2_3', 'KEBAB', 'PPM'] as const;

export type AcceptanceSurface = (typeof ACCEPTANCE_SURFACES)[number];

// ─── Deskryptor możliwości ──────────────────────────────────────────────────

/**
 * Deskryptor capability — OBOWIĄZKOWY przed implementacją (kontrakt §1).
 *
 * Rozszerza kształt z §1 o `columns` (§5 „Kompletność informacyjna kolumn"),
 * bo bez zadeklarowanych kolumn wymaganych nie da się testowo odróżnić braku
 * właściwości kluczowej od świadomego pominięcia — a audyt uznaje ten brak za
 * FAIL na równi z brakiem elementu graficznego (T44/T45: brak formatu pliku).
 */
export interface TableSurfaceCapabilities {
  id: TableSurfaceId;
  /** Nazwa encji w liczbie pojedynczej, np. `idea`, `task`, `statement`. */
  entity: string;
  /** Powierzchnia bez `true` nie jest tabelą kontraktową (§1). */
  hasTable: true;
  /** `none` jest legalne WYŁĄCZNIE z uzasadnieniem w `selectionNoneReason`. */
  selection: 'bulk' | 'none';
  /** Uzasadnienie produktowe dla `selection: 'none'`; wymagane wtedy i tylko wtedy. */
  selectionNoneReason?: string;
  /** Preview jest obowiązkowe dla każdej powierzchni tabelowej (§6). */
  preview: true;
  /** Enter / double-click otwiera pełny obiekt (§5 Interakcja). */
  fullOpen: true;
  edit: 'supported' | 'permission-dependent' | 'not-applicable';
  archive: 'supported' | 'not-applicable';
  delete: 'supported' | 'business-locked';
  /** Steruje obecnością pozycji `Delay` w strefie manage (§7). */
  dueDate: boolean;
  /** Dokąd rekord może przejść kontekstowo (np. `initiative`, `report`). */
  contextTransitions: string[];
  /** Widoki dostępne w segmencie Menu 2; segment renderuje się od dwóch pozycji. */
  viewModes: Array<'list' | 'grid' | 'kanban' | 'calendar' | 'timeline'>;
  /** Nazwy presetów chipów Menu 3 (formuła 1). */
  menu3Presets: string[];
  /** Identyfikatory akcji bulk (formuła 2); puste tylko przy `selection: 'none'`. */
  bulkActions: string[];
  /** Klucz persystencji szerokości, widoczności i kolejności kolumn (§5). */
  persistKey: string;
  /** Kontrakt kolumn — patrz `TableColumnContract`. */
  columns: TableColumnContract;
  /**
   * Powód, dla którego `business-locked` blokuje delete. Zapisany w deskryptorze,
   * NIGDY dopisywany do etykiety w menu (§1, §7 Danger, §10 Disabled).
   */
  deleteLockReason?: string;
}

/**
 * Kontrakt kolumn (§5 „Kompletność informacyjna kolumn").
 *
 * `required` to minimalny zestaw pozwalający zidentyfikować, porównać i obsłużyć
 * rekord BEZ otwierania go. Zestaw ma być możliwie mały, lecz informacyjnie
 * kompletny — brak właściwości kluczowej dla decyzji jest FAIL.
 */
export interface TableColumnContract {
  /**
   * Kolumna identyfikująca rekord. Jest PIERWSZĄ kolumną danych, jest elastyczna
   * i jest Required/locked w popoverze Settings2 (§5 Settings2).
   */
  identifier: string;
  /** Kolumny domenowe bez których lista traci wartość decyzyjną. */
  required: string[];
  /** Kolumny dopuszczalne, domyślnie widoczne lub nie, przełączalne w Settings2. */
  optional?: string[];
  /** Właściwości świadomie zepchnięte do preview zamiast do kolumny. */
  availableInPreview?: string[];
}

// ─── Adapter powierzchni ────────────────────────────────────────────────────

/**
 * Rodzaj adaptera, przez który powierzchnia dochodzi do kanonicznego shella.
 * Wprost mapuje kolumnę `class` z `CONSULTIFY_SURFACE_REGISTER_2026-08-04.csv`
 * na pracę wymaganą w falach R01–R04 i R10–R19.
 */
export type TableAdapterKind =
  /** Czysty rejestr: controls + tabela. Docelowy stan każdej powierzchni. */
  | 'register'
  /**
   * Rejestr + pełne narzędzie/edytor pod tym samym wejściem (TABLE_TOOL).
   * Kontrakt dotyczy WIDOKU LISTY; narzędzie jest szczegółem albo osobną zakładką.
   */
  | 'register-with-tool'
  /**
   * Rejestr dziś ZANIECZYSZCZONY dashboardem/KPI/formularzem między Menu 3
   * a tabelą (§5 — takie treści są osobną zakładką albo view mode).
   * Naprawa: R13–R16.
   */
  | 'contaminated-register'
  /**
   * Rejestr NIE ISTNIEJE — powierzchnię zastępuje dashboard, karty albo pusty
   * bespoke stan. Naprawa: R10–R12 (tabela musi powstać, funkcje przenieść,
   * nie usuwać).
   */
  | 'missing-register'
  /**
   * Rejestr istnieje, ale semantyka kolumn jest niekompletna albo powierzchnia
   * jest narzędziem udającym listę (T04 Calendar). Naprawa: R17–R18.
   */
  | 'semantic-gap';

/**
 * Pakiet naprawczy z `REPAIR_WORK_PACKAGES.csv` odpowiedzialny za doprowadzenie
 * powierzchni do kontraktu. `null` NIE JEST dozwolone — każda z 45 powierzchni
 * ma właściciela, inaczej `ATOMIC_PACKAGE_MAP.csv` miałby sieroty.
 */
export type RepairPackageId =
  | 'R10'
  | 'R11'
  | 'R12'
  | 'R13'
  | 'R14'
  | 'R15'
  | 'R16'
  | 'R17'
  | 'R18'
  | 'R19'
  | 'R20'
  | 'R21'
  | 'R22'
  | 'R23'
  | 'R24'
  | 'R25'
  | 'R26'
  | 'R27'
  | 'R28';

/**
 * Wpis mapy T01–T45 → adapter/konfiguracja.
 *
 * To jest deliverable „mapa T01–T45 → oczekiwany adapter/konfiguracja" z R00.
 * Mapa opisuje stan OCZEKIWANY (docelowy) i pakiet, który ma go dowieźć —
 * nie stan bieżący. Stan bieżący żyje w `MATRIX_T01_T45.csv` i jest tam
 * read-only dla wykonawców.
 */
export interface TableSurfaceContract {
  id: TableSurfaceId;
  module: TableSurfaceModule;
  /** Etykieta zakładki dokładnie jak w `MATRIX_T01_T45.csv`. */
  surface: string;
  /** Oczekiwany adapter po naprawie. */
  adapter: TableAdapterKind;
  /** Pakiet z `REPAIR_WORK_PACKAGES.csv`, który tę powierzchnię domyka. */
  ownerPackage: RepairPackageId;
  capabilities: TableSurfaceCapabilities;
  /**
   * Powierzchnie, których kanoniczna tabela dziś NIE ISTNIEJE i muszą zostać
   * zbudowane wraz z wariantem empty i populated (REPAIR_MASTER_PLAN Fala 2).
   * Trzyma się razem z `adapter`, bo to ono decyduje o wymaganych fixtures.
   */
  requiresNewRegistry: boolean;
  /**
   * Treści, które trzeba PRZENIEŚĆ do szczegółu/osobnej zakładki, a nie usunąć
   * (REPAIR_MASTER_PLAN: „Istniejące dashboardy/narzędzia należy przenieść, nie usuwać").
   * Puste dla czystych rejestrów.
   */
  relocateFromList?: string[];
}

// ─── Preset kanonicznego rejestru ───────────────────────────────────────────

/**
 * Kanoniczny preset rejestru (R00: „TableSurfaceContract / kanoniczny preset rejestru").
 *
 * Wartości domyślne, od których startuje KAŻDA powierzchnia klasy `register`.
 * Odstępstwo musi być jawne w `TableSurfaceContract`, nie wynikać z tego, że ekran
 * czegoś nie zaimplementował. To jest różnica między „wyjątkiem uzgodnionym"
 * a „lokalnym obejściem wspólnego standardu", którego zabrania bramka G1.
 */
export interface CanonicalRegisterPreset {
  /** Settings2 w prawym górnym rogu — moduł NIE może go podmienić (§5). */
  settings2: true;
  /** Checkbox header + row; obecny wtedy i tylko wtedy, gdy `selection: 'bulk'`. */
  selectionCheckboxes: boolean;
  /** Kebab jako OSTATNIA kolumna, wyrównany do prawej (§5). */
  rowMenuColumnLast: true;
  /** PPM na całym wierszu, ten sam rejestr akcji co kebab (§8). */
  contextMenu: true;
  /** Nagłówek sticky, 11 px / 600 / uppercase / muted / hairline (§5). */
  stickyHeader: true;
  /** Brak zebry i brak statusowego tła wiersza (§5). */
  zebraStriping: false;
  /** Single-click → preview bez zmiany URL (§5 Interakcja). */
  rowClickOpensPreview: true;
  /** Enter / double-click → pełne Open (§5 Interakcja). */
  enterOpensFullDetail: true;
  /** Sort klikiem nagłówka (§5). */
  sortable: true;
  /** Resize zero-sum, persystowany przez `persistKey` (§5). */
  resizable: true;
  /** Empty state ZACHOWUJE nagłówek i geometrię tabeli (REPAIR_MASTER_PLAN §6). */
  emptyStatePreservesStructure: true;
}

/**
 * Domyślny preset. `selectionCheckboxes` jest jedynym polem zależnym od encji —
 * wynika z `capabilities.selection` i jest wyliczane, nie deklarowane ręcznie.
 */
export const CANONICAL_REGISTER_PRESET: Omit<CanonicalRegisterPreset, 'selectionCheckboxes'> = {
  settings2: true,
  rowMenuColumnLast: true,
  contextMenu: true,
  stickyHeader: true,
  zebraStriping: false,
  rowClickOpensPreview: true,
  enterOpensFullDetail: true,
  sortable: true,
  resizable: true,
  emptyStatePreservesStructure: true,
};

/** Buduje pełny preset dla konkretnej powierzchni. */
export function canonicalRegisterPreset(
  capabilities: TableSurfaceCapabilities
): CanonicalRegisterPreset {
  return {
    ...CANONICAL_REGISTER_PRESET,
    selectionCheckboxes: capabilities.selection === 'bulk',
  };
}

// ─── Wspólne kształty pomocnicze ────────────────────────────────────────────

/**
 * Wynik walidacji. Walidatory NIE rzucają — zwracają listę naruszeń, bo w trybie
 * dev mają ostrzegać, a w testach agregować wszystkie problemy naraz zamiast
 * zatrzymywać się na pierwszym.
 */
export interface ContractViolation {
  /** Stabilny kod, np. `ROW_ACTION_DUPLICATE_ID`. Testy asertują po kodzie. */
  code: string;
  /** Opis czytelny dla człowieka — trafia do komunikatu testu i dev-warningu. */
  message: string;
  /** Paragraf kontraktu, z którego reguła wynika. */
  clause: string;
  /** Ścieżka do miejsca naruszenia, np. `actions[3].label`. */
  path?: string;
}

export interface ValidationResult {
  valid: boolean;
  /** `readonly`, bo `VALID` jest współdzieloną, zamrożoną instancją. */
  violations: readonly ContractViolation[];
}

/**
 * Sukces walidacji — pojedyncza zamrożona instancja, żeby nie alokować w pętli.
 * Lista naruszeń jest zamrożona razem z obiektem: `VALID` bywa zwracane setki
 * razy w jednym przebiegu testów i mutacja jednej kopii skaziłaby wszystkie.
 */
export const VALID: ValidationResult = Object.freeze({
  valid: true,
  violations: Object.freeze([] as ContractViolation[]),
});

/** Buduje wynik z listy naruszeń. */
export function toResult(violations: ContractViolation[]): ValidationResult {
  return violations.length === 0 ? VALID : { valid: false, violations };
}

/** Ikona akcji: klucz kanonicznego rejestru (§6 „Kanoniczny rejestr ikon"). */
export type CanonicalIcon = CanonActionIconKey;
