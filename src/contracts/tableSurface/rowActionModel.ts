/**
 * `RowActionModel` — JEDEN model akcji wiersza dla kebaba I dla PPM.
 *
 * Źródło normatywne: `MY_WORK_TABLE_SURFACE_CONTRACT_V1.md` §7 (Kebab) i §8
 * (Menu kontekstowe). Kluczowe zdanie §8: „Menu kontekstowe jest drugim
 * triggerem dokładnie tego samego `RowActionRegistry`, nie osobną konfiguracją."
 *
 * Co ten model naprawia (audyt 45 tabel):
 *  · `T01-KEBAB-K04` (P0) — kebab renderował ~6 wizualnie oddzielonych grup przy
 *    maksimum trzech dozwolonych strefach. Źródłem był legacy union
 *    `RowActionSectionKind` z siedmioma wartościami ('open'/'ai'/'convert'/'output'
 *    obok trzech kanonicznych), gdzie każda sekcja dostawała własny separator;
 *  · brak PPM na 41 z 45 powierzchni — bo PPM był budowany osobno albo wcale;
 *  · duplikaty View/Open/Open preview o tym samym skutku (§7 Zakazy).
 *
 * Model jest DEKLARATYWNY i wolny od Reacta: `icon` to klucz kanonicznego
 * rejestru, nie komponent. Dzięki temu da się go walidować i testować bez
 * renderu, a `src/contracts` nie zależy od warstwy UI.
 *
 * R00 ZAMRAŻA TEN KSZTAŁT. Podłączenie go do `RowActionsMenu.tsx` należy do R01.
 *
 * @module contracts/tableSurface/rowActionModel
 */

import { CANON_MANAGE_ACTION_ORDER, CANON_ROW_MENU_ZONE_ORDER } from './canon';
import type { CanonicalIcon } from './types';

/**
 * Trzy strefy logiczne — i tylko trzy (§7 „Logiczne strefy").
 *
 * Akcje specjalne (idea/AI/convert/output) NIE tworzą dodatkowych stref: są
 * mapowane do `context` albo `manage` według SKUTKU (§10, wiersz
 * „Idea/AI/Convert/Output").
 */
export type RowActionZone = (typeof CANON_ROW_MENU_ZONE_ORDER)[number];

/**
 * Powód, dla którego akcja jest wyłączona.
 *
 * Rozróżnienie jest tu TWARDE, bo audyt pokazał, że kod je mieszał:
 *  · `permission` / `state` / `business-rule` → pozycja ZOSTAJE, wyszarzona,
 *    BEZ dopisku w etykiecie; powód żyje w tym polu i służy audytowi (§10);
 *  · funkcja niezbudowana → NIE MA jej w menu wcale. Nie ma dla niej wartości
 *    w tym unionie i to jest celowe: „Coming soon" nie jest reprezentowalne.
 */
export type RowActionDisabledReason = 'permission' | 'state' | 'business-rule';

/** Pojedyncza akcja wiersza. */
export interface RowActionModel {
  /**
   * Identyfikator UNIKALNY w obrębie całego menu wiersza, stabilny między
   * kebabem, PPM i preview. §6: „Jeśli ta sama akcja występuje w obu miejscach,
   * musi mieć ten sam `actionId`, label, uprawnienie, confirmation i skutek."
   */
  actionId: string;
  /** Etykieta widoczna. Unikalna w menu — dwie pozycje o tym samym tekście to defekt. */
  label: string;
  /** Klucz z kanonicznego rejestru ikon. Każda pozycja MA ikonę (§7). */
  icon: CanonicalIcon;
  zone: RowActionZone;
  /**
   * Czy akcja jest wyłączona. Wyłączona pozycja jest widoczna, wyraźnie
   * jaśniejsza, nie reaguje na hover/klik i NIE dostaje dopisku (§7).
   */
  disabled?: boolean;
  /** Wymagane, gdy `disabled: true`. Nigdy nie trafia do etykiety. */
  disabledReason?: RowActionDisabledReason;
  /** Treść powodu dla audytu i testów; nie jest renderowana w menu. */
  disabledDetail?: string;
  /** Destructive wymaga potwierdzenia (§9). Wymuszane walidatorem dla strefy danger. */
  confirmation?: boolean;
  /** Skrót klawiszowy pokazany po prawej, 11 px muted (§7 kontrakt graficzny). */
  shortcut?: string;
  /** Submenu presetów, np. `Delay ▸ +1/+3/+7` (§7 Manage). */
  submenu?: RowActionSubmenuItem[];
  /**
   * Capability, od której zależy obecność pozycji. Puste = zawsze obecna.
   * Walidator sprawdza, że pozycja `manage` deklaruje capability zgodną
   * z deskryptorem powierzchni.
   */
  requiresCapability?: 'edit' | 'archive' | 'delete' | 'dueDate';
}

export interface RowActionSubmenuItem {
  actionId: string;
  label: string;
  disabled?: boolean;
}

/**
 * Pełny model menu wiersza. Jedna instancja obsługuje OBA triggery.
 *
 * Nie ma tu pola „trigger" ani osobnych list dla kebaba i PPM — i to jest cała
 * pointa. §8: różnice są WYŁĄCZNIE trzy (anchor, ustawienie active record,
 * cel focus return) i wszystkie trzy są sprawą renderera, nie modelu.
 */
export interface RowActionMenuModel {
  /** Powierzchnia, do której model należy — do komunikatów walidatora. */
  surfaceId: string;
  /** Rekord, dla którego model zbudowano — do komunikatów walidatora. */
  recordId: string;
  actions: RowActionModel[];
}

/**
 * Zwraca akcje pogrupowane w strefy, w kanonicznej kolejności, z pominięciem
 * stref pustych.
 *
 * §7: „Puste strefy nie są renderowane. Separator występuje wyłącznie między
 * dwiema sąsiednimi WYRENDEROWANYMI strefami." Liczba separatorów wynika więc
 * z liczby niepustych stref minus jeden — renderer nie ma tu żadnej swobody.
 */
export function groupRowActionsByZone(
  model: RowActionMenuModel
): Array<{ zone: RowActionZone; actions: RowActionModel[] }> {
  return CANON_ROW_MENU_ZONE_ORDER.map((zone) => ({
    zone,
    actions: model.actions.filter((action) => action.zone === zone),
  })).filter((group) => group.actions.length > 0);
}

/** Liczba separatorów, którą renderer MUSI narysować. Nigdy więcej niż 2 (§7). */
export function rowActionSeparatorCount(model: RowActionMenuModel): number {
  return Math.max(0, groupRowActionsByZone(model).length - 1);
}

/**
 * Kanoniczna kolejność w strefie `manage`: Open preview → Edit → Archive/Restore
 * → Delay (§7 Manage). Zwraca indeks porządkowy albo `-1` dla pozycji spoza
 * zestawu — walidator traktuje `-1` jako akcję kontekstową wstawioną do złej strefy.
 */
export function manageActionOrderIndex(actionId: string): number {
  return CANON_MANAGE_ACTION_ORDER.indexOf(actionId as (typeof CANON_MANAGE_ACTION_ORDER)[number]);
}

/**
 * Czy dwa modele są tym samym menu z punktu widzenia kontraktu kebab ↔ PPM.
 *
 * Porównuje actionId, label, ikonę, strefę, disabled, powód i confirmation —
 * czyli dokładnie tę listę, którą §8 nazywa „identyczną". Kolejność też, bo §8
 * wymienia ją wprost („actionId, label, ikona, KOLEJNOŚĆ, visible/disabled…").
 */
export function rowActionMenusAreIdentical(
  kebab: RowActionMenuModel,
  contextMenu: RowActionMenuModel
): boolean {
  if (kebab.actions.length !== contextMenu.actions.length) return false;
  return kebab.actions.every((action, index) => {
    const other = contextMenu.actions[index];
    return (
      action.actionId === other.actionId &&
      action.label === other.label &&
      action.icon === other.icon &&
      action.zone === other.zone &&
      !!action.disabled === !!other.disabled &&
      action.disabledReason === other.disabledReason &&
      !!action.confirmation === !!other.confirmation
    );
  });
}

/**
 * Kanoniczne `actionId` akcji zarządczych. Wyodrębnione, bo powtarzają się
 * w każdej powierzchni i literówka w jednym module rozjeżdża parity z preview.
 */
export const MANAGE_ACTION_ID = {
  openPreview: 'open-preview',
  edit: 'edit',
  archive: 'archive',
  delay: 'delay',
} as const;

/** Kanoniczne `actionId` strefy danger (§7 Danger — zawsze ostatnie i czerwone). */
export const DANGER_ACTION_ID = {
  delete: 'delete',
  reject: 'reject',
  moveToTrash: 'move-to-trash',
} as const;

export const DANGER_ACTION_IDS: readonly string[] = Object.values(DANGER_ACTION_ID);
