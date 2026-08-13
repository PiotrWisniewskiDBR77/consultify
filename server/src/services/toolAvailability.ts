/**
 * Trzy ROZŁĄCZNE pojęcia dostępności narzędzia.
 *
 * Wcześniej istniało jedno `isActive`, które mieszało widoczność w Library
 * z możliwością uruchomienia sesji. Skutek: 12 narzędzi „coming soon" znikało
 * z API szczegółu (`getKnownTool()` zwracał `null`), więc nie dało się ich
 * ani opisać, ani uczciwie pokazać.
 *
 * Decyzja właściciela 2026-08-13: rozdzielić na trzy niezależne predykaty.
 */

/**
 * 19 narzędzi z realnym silnikiem metody w `src/config/<tool>/`.
 * Lista jest wyłącznie o RUNTIME — nie decyduje o widoczności w Library.
 */
export const RUNTIME_ELIGIBLE_TOOL_TYPES = new Set<string>([
  'dynamic-swot',
  'market-forces',
  'value-chain',
  'capability-mapper',
  'ambition-decomposer',
  'focus-tradeoff',
  'narrative-engine',
  'growth-paths',
  'portfolio-priority',
  'risk-uncertainty',
  'process-automation',
  'sop-builder',
  'a3-problem-solving',
  'smed-planner',
  'dms-builder',
  'inventory-autopilot',
  'ai-discovery',
  'pain-explorer',
  'rpa-scanner',
]);

function normalize(toolType: string | null | undefined): string {
  return String(toolType || '')
    .trim()
    .toLowerCase();
}

/**
 * 1. WIDOCZNOŚĆ W LIBRARY — wszystkie 31 kanonicznych narzędzi.
 *
 * Library jest arkuszem informacyjno-edukacyjno-sprzedażowym: narzędzie
 * „coming soon" MUSI być widoczne i opisane. Niewidoczność nie jest uczciwa,
 * tylko myląca — klient nie wie, co powstaje.
 */
export function isLibraryVisible(toolType: string | null | undefined): boolean {
  return normalize(toolType).length > 0;
}

/**
 * 2. MOŻLIWOŚĆ URUCHOMIENIA SESJI — wyłącznie narzędzia spełniające
 *    runtime eligibility i nieoznaczone jako „coming soon".
 *
 * To jest predykat, który steruje przyciskiem „Startuj sesję".
 * 12 narzędzi coming-soon jest widocznych i opisanych, ale NIE startuje.
 */
export function canStartToolSession(
  toolType: string | null | undefined,
  row?: { is_active?: number | null; is_coming_soon?: number | null }
): boolean {
  const t = normalize(toolType);
  if (!t) return false;
  if (!RUNTIME_ELIGIBLE_TOOL_TYPES.has(t)) return false;
  // Wiersz może wyłączyć narzędzie, ale nie może włączyć takiego,
  // które nie ma silnika.
  if (row && row.is_active !== undefined && row.is_active !== null && !row.is_active) return false;
  if (row?.is_coming_soon) return false;
  return true;
}

/** Werdykt gotowości runtime dostarczany przez rejestr packów. */
export interface RuntimeActiveInput {
  /** Czy manifest gotowości ma wszystkie bramki PASS. */
  manifestAllGatesPass: boolean;
  /** SHA, na którym powstały dowody. */
  verifiedAgainstSha: string | null | undefined;
  /** Bieżący candidate SHA. */
  candidateSha: string | null | undefined;
}

/**
 * 3. RUNTIME ACTIVE — stan końcowy. Wyłącznie pełny RuntimeReadinessManifest
 *    z bramkami PASS, odniesiony do BIEŻĄCEGO SHA.
 *
 * Świadomie nie przyjmuje samej flagi z bazy: `is_active=1` jest deklaracją,
 * a nie dowodem. Dowód zestarzały (inny SHA) też nie jest dowodem.
 */
export function isRuntimeActive(
  toolType: string | null | undefined,
  input: RuntimeActiveInput
): boolean {
  if (!canStartToolSession(toolType)) return false;
  if (!input.manifestAllGatesPass) return false;
  if (!input.verifiedAgainstSha || !input.candidateSha) return false;
  return input.verifiedAgainstSha === input.candidateSha;
}
