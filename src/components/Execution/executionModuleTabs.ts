/**
 * Zakładki Menu 2 modułu Realizacja + lista wartości `?tab=` wpuszczanych
 * przez deep-link — W JEDNYM MIEJSCU.
 *
 * DLACZEGO OSOBNY PLIK (odbiór na żywo 05.09, `execution-tab-summary`):
 * „Kokpit menedżera" (`ExecutionSummaryOneLook`) był ZBUDOWANY, jego flaga w
 * tym środowisku WŁĄCZONA, a ekran mimo to całkowicie nieosiągalny — bo dwie
 * decyzje, które o tym rozstrzygają, żyły w dwóch odległych miejscach
 * 6100-liniowego `ExecutionHub.tsx` i rozjechały się:
 *   · lista `['list','work','resources','control','reports']` w efekcie
 *     deep-linku (bez `summary` → `?tab=summary` cicho lądował na `tab=list`),
 *   · tablica `tabs` w Menu 2 (bez pozycji „Kokpit" → zero wejścia klikiem).
 * Rozdzielone, żadna nie pilnowała drugiej. Tutaj obie liczą się z JEDNEJ
 * kolejności zakładek, więc rozjazd wymaga świadomej zmiany, nie przeoczenia.
 *
 * Bramka flagi zostaje: przy `summaryOneLook` OFF (domyślnie wszędzie,
 * CLAUDE.md reguła #7) obie funkcje zwracają dokładnie to, co przed 05.09 —
 * zero zmiany dla kogokolwiek bez włączonej flagi.
 */

/** Zakładki Menu 2 w kolejności wyświetlania (bez zakładek pełnoekranowych typu rollout). */
export const EXECUTION_BASE_TAB_IDS = [
  'list',
  'work',
  'resources',
  'control',
  'reports',
] as const;

export type ExecutionBaseTabId = (typeof EXECUTION_BASE_TAB_IDS)[number];

export interface ExecutionTabOptions {
  /** Flaga `summaryOneLook` — kokpit menedżera. */
  summaryOneLookEnabled: boolean;
}

/**
 * Kolejność pozycji Menu 2. Kokpit stoi PIERWSZY — to widok „jednego
 * spojrzenia" na cały moduł, więc czyta się go przed rejestrami.
 */
export function executionModuleTabIds({ summaryOneLookEnabled }: ExecutionTabOptions): string[] {
  return summaryOneLookEnabled
    ? ['summary', ...EXECUTION_BASE_TAB_IDS]
    : [...EXECUTION_BASE_TAB_IDS];
}

/**
 * Wartości `?tab=` wpuszczane przez deep-link. `rollout` obsługiwany jest
 * osobno (konsolidacja `/rollout` → `?tab=rollout`) i celowo nie jest
 * pozycją Menu 2.
 */
export function executionDeepLinkTabs(options: ExecutionTabOptions): string[] {
  return executionModuleTabIds(options);
}

/**
 * 1.12-R1 (C): stare adresy zakładki „Sterowanie" prowadzą do „Decyzji
 * i ryzyk". Identyfikator zakładki nie zmienił się (`control`), więc
 * `?tab=control` działa dalej bez tłumaczenia — a `?tab=sterowanie`
 * (polska nazwa z linków wklejanych ręcznie) i `?tab=decyzje-i-ryzyka`
 * mapują się na ten sam ekran zamiast cicho lądować na liście.
 */
const DEEP_LINK_TAB_ALIASES: Record<string, string> = {
  sterowanie: 'control',
  'decyzje-i-ryzyka': 'control',
  'decisions-risks': 'control',
  decisions: 'control',
};

export function resolveExecutionDeepLinkTab(targetTab: string): string {
  const value = String(targetTab || '')
    .trim()
    .toLowerCase();
  return DEEP_LINK_TAB_ALIASES[value] ?? value;
}

export function isExecutionDeepLinkTabAllowed(
  targetTab: string,
  options: ExecutionTabOptions
): boolean {
  return executionDeepLinkTabs(options).includes(resolveExecutionDeepLinkTab(targetTab));
}
