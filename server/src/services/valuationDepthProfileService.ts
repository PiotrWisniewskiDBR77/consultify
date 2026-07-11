/**
 * EV — GŁĘBOKOŚĆ WYCENY (D-2, Piotr 2026-07-10 · SSOT _KONCEPT_FINANCE_2026-07-10.md §5)
 * ----------------------------------------------------------------------------
 * Decyzja Piotra (pytanie #2 z §11 koncepcji): EV to JEDEN silnik z przełącznikiem
 * głębokości, nie dwa osobne narzędzia:
 *
 *   managerial (domyślna, MŚP)  — mniej inputów, uproszczony WACC (beta=1, ERP
 *                                  wyższe dla ryzyka małej spółki, bez potrzeby
 *                                  estymacji beta), JEDNA metoda dominująca
 *                                  (M1 DCF gdy jest źródło prognozy, inaczej M4
 *                                  majątkowo-dochodowa), bez pełnego koszyka i
 *                                  bez pełnej wrażliwości — narracja zarządcza
 *                                  „ile firma warta".
 *   banking (na żądanie)        — pełny koszyk M1-M4 (`valuationBasketService`
 *                                  BEZ ZMIAN), pełna wrażliwość WACC×g/exit-multiple,
 *                                  peers, premie za kontrolę (M3), football-field.
 *                                  To jest DOKŁADNIE to, co `valuationBasketService`
 *                                  liczy dzisiaj — banking = istniejące zachowanie.
 *
 * TA WARSTWA NIE LICZY DCF/WACC/mnożników — to konfiguracja/selekcja NAD
 * `valuationService` (DCF/WACC, niezmieniony) i `valuationBasketService`
 * (koszyk M1-M4, niezmieniony). Zero duplikacji silnika.
 *
 * ADDITIVE / WSTECZNA ZGODNOŚĆ:
 *  - Istniejące wywołania `buildBasketFromResults` / `computeValuationBasket`
 *    bez depth = bez zmian (te funkcje w ogóle nie wiedzą o istnieniu depth).
 *  - `buildBasketForDepth(results, config)` bez trzeciego argumentu domyślnie
 *    zwraca depth='managerial' (D-2: to jest NOWY domyślny widok dla wywołań,
 *    które JAWNIE proszą o depth-aware odpowiedź) — ale endpoint istniejący
 *    (`GET /valuations/:id/basket`) wywołuje `buildBasketFromResults` wprost
 *    i NIE zmienia zachowania, dopóki caller nie poda `?depth=`.
 *
 * DETERMINIZM: 100% TS, zero LLM.
 */

import {
  buildBasketFromResults,
  synthesizeBasket,
  type BasketConfig,
  type BasketMethod,
  type BasketMethodKey,
  type BasketResult,
  type MethodRange,
  type ValuationResultsShape,
} from './valuationBasketService.js';
import {
  computeWaccFromBreakdown,
  defaultAssumptions,
  getValuation,
  updateAssumptions,
  type ValuationAssumptions,
  type WaccBreakdown,
} from './valuationService.js';

// ── Typy ────────────────────────────────────────────────────────────────────

export type ValuationDepth = 'managerial' | 'banking';

/** D-2: domyślna głębokość dla NOWYCH wywołań depth-aware (nie dla istniejących
 *  endpointów bez depth — te zostają nietknięte, patrz nagłówek). */
export const DEFAULT_VALUATION_DEPTH: ValuationDepth = 'managerial';

const VALID_DEPTHS: ValuationDepth[] = ['managerial', 'banking'];

export function isValidDepth(raw: any): raw is ValuationDepth {
  return VALID_DEPTHS.includes(raw);
}

/** Normalizuje dowolny wejściowy string do ValuationDepth. Nieznana/pusta wartość
 *  → `fallback` (domyślnie DEFAULT_VALUATION_DEPTH). */
export function normalizeDepth(
  raw: any,
  fallback: ValuationDepth = DEFAULT_VALUATION_DEPTH
): ValuationDepth {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (s === 'banking') return 'banking';
  if (s === 'managerial') return 'managerial';
  return fallback;
}

/** Czyta depth zapisaną na wycenie (assumptions.depth); brak/nierozpoznana → null
 *  (odróżnia „brak wyboru" od „wybrano managerial" — istotne dla wstecznej zgodności). */
export function resolveStoredDepth(assumptions: any): ValuationDepth | null {
  const raw = assumptions?.depth;
  return isValidDepth(raw) ? raw : null;
}

export const DEPTH_META: Record<ValuationDepth, { label: string; description: string }> = {
  managerial: {
    label: 'Zarządcza (MŚP)',
    description:
      'Uproszczony WACC, jedna metoda dominująca, bez pełnej wrażliwości — „ile firma warta".',
  },
  banking: {
    label: 'Bankowo-transakcyjna',
    description:
      'Pełny koszyk M1-M4, pełna wrażliwość WACC×g, peers, premie za kontrolę, football-field.',
  },
};

// ── WACC presety per depth ───────────────────────────────────────────────────

/** Uproszczony CAPM dla MŚP: beta=1 (uśredniony rynek — bez potrzeby estymacji
 *  beta dla spółki nienotowanej), wyższe ERP (premia za ryzyko małej spółki). */
export const MANAGERIAL_WACC_BREAKDOWN: WaccBreakdown = {
  riskFreeRate: 4,
  equityRiskPremium: 7,
  beta: 1,
  costOfDebt: 8,
  taxRate: 19,
  debtWeight: 30,
  equityWeight: 70,
};

/** Zwraca breakdown WACC dla danej głębokości. banking = REUSE istniejącego
 *  pełnego CAPM defaultu z valuationService (NIE duplikujemy formuły/wartości). */
export function getWaccBreakdownForDepth(
  depth: ValuationDepth,
  bankingOrgWacc?: number
): WaccBreakdown {
  if (depth === 'managerial') return { ...MANAGERIAL_WACC_BREAKDOWN };
  return defaultAssumptions(5, bankingOrgWacc).waccBreakdown;
}

/** Patch do `valuationService.updateAssumptions` — ustawia depth + (dla managerial)
 *  uproszczony WACC. Dla banking dotyka WYŁĄCZNIE znacznika depth (WACC istniejącej
 *  wyceny pozostaje jak jest — przełącznik "na żądanie" nie nadpisuje edycji użytkownika). */
export function getAssumptionsPatchForDepth(
  depth: ValuationDepth,
  opts: { orgWacc?: number } = {}
): Partial<ValuationAssumptions> {
  const d = normalizeDepth(depth);
  if (d === 'banking') {
    return { depth: 'banking' };
  }
  const waccBreakdown = { ...MANAGERIAL_WACC_BREAKDOWN };
  const waccPercent =
    opts.orgWacc != null && Number.isFinite(Number(opts.orgWacc))
      ? Number(opts.orgWacc)
      : computeWaccFromBreakdown(waccBreakdown);
  return { depth: 'managerial', waccBreakdown, waccPercent };
}

// ── Redukcja koszyka do jednej metody dominującej (managerial) ─────────────

/** Kolejność preferencji metody dominującej dla widoku zarządczego: DCF (gdy jest
 *  źródło prognozy) > majątkowo-dochodowa (fallback MŚP bez peers) > mnożniki rynkowe
 *  (comps — dla MŚP zwykle najmniej wiarygodne z braku porównywalnych spółek
 *  notowanych). M3 (transakcje precedensowe) NIGDY nie jest dominująca w managerial —
 *  jest wyłączona z koszyka źródłowego przed wyborem (patrz buildBasketForDepth). */
const DOMINANT_PRIORITY: BasketMethodKey[] = ['M1', 'M4', 'M2'];

export function pickDominantMethod(methods: BasketMethod[]): BasketMethod | null {
  if (!Array.isArray(methods) || methods.length === 0) return null;
  for (const key of DOMINANT_PRIORITY) {
    const found = methods.find((m) => m.key === key);
    if (found) return found;
  }
  return methods[0];
}

/** Zawęża pełny koszyk do JEDNEJ metody dominującej (waga=1, brak flagi spójności —
 *  jedna metoda nie ma z czym się rozjeżdżać). Pusty koszyk → zwracany bez zmian. */
export function reduceToDominantMethod(full: BasketResult): BasketResult {
  const dominant = pickDominantMethod(full.methods);
  if (!dominant) return full;
  const range: MethodRange = {
    key: dominant.key,
    label: dominant.label,
    low: dominant.low,
    mid: dominant.mid,
    high: dominant.high,
    weight: 1,
    ...(dominant.note ? { note: dominant.note } : {}),
  };
  return synthesizeBasket([range]);
}

// ── Widok koszyka per depth (rdzeń, czysta funkcja) ─────────────────────────

export interface DepthBasketView {
  depth: ValuationDepth;
  basket: BasketResult;
  /** Metoda dominująca wybrana dla managerial; undefined dla banking. */
  dominantMethodKey?: BasketMethodKey;
}

/**
 * RDZEŃ przełącznika. Buduje widok koszyka dla danej głębokości z JUŻ policzonych
 * `results` (valuationService.computeValuation) — nie liczy DCF/WACC/mnożników.
 *
 *  - banking: DOKŁADNIE `buildBasketFromResults(results, config)` — istniejące
 *    zachowanie `valuationBasketService`, bez modyfikacji (pełny koszyk M1-M4,
 *    pełne peers/premie/przecięcie/flaga spójności).
 *  - managerial: ten sam silnik koszyka, ale (a) M3 wyłączona z wejścia
 *    (`includePrecedent: false` — transakcje precedensowe to bankowa optyka),
 *    (b) wynik zredukowany do jednej metody dominującej.
 */
export function buildBasketForDepth(
  results: ValuationResultsShape | null | undefined,
  config: BasketConfig = {},
  depth: ValuationDepth = DEFAULT_VALUATION_DEPTH
): DepthBasketView {
  const d = normalizeDepth(depth);
  if (d === 'banking') {
    return { depth: d, basket: buildBasketFromResults(results, config) };
  }
  const full = buildBasketFromResults(results, { ...config, includePrecedent: false });
  const dominant = pickDominantMethod(full.methods);
  const reduced = reduceToDominantMethod(full);
  return { depth: d, basket: reduced, dominantMethodKey: dominant?.key ?? undefined };
}

/** Narracja zarządcza / bankowa nad widokiem koszyka. Czysta funkcja formatowania —
 *  nie liczy nic, tylko ubiera już policzone liczby w język (kontrakt grounded §3.2
 *  KONCEPT_FINANCE: silnik liczy, warstwa tekstowa tylko referuje istniejące liczby). */
export function depthNarrative(view: DepthBasketView, currency: string = 'PLN'): string {
  const { basket, depth } = view;
  if (!basket.methods.length) {
    return 'Brak wystarczających danych do oszacowania wartości firmy.';
  }
  const fmt = (n: number) => Math.round(n).toLocaleString('pl-PL');
  if (depth === 'managerial') {
    const m = basket.methods[0];
    return `Szacowana wartość firmy: ${fmt(m.low)}–${fmt(m.high)} ${currency} (środek pasma ${fmt(m.mid)} ${currency}), metoda: ${m.label}.`;
  }
  const r = basket.recommended;
  const flag = basket.consistencyFlag.triggered ? ` ${basket.consistencyFlag.message}` : '';
  return `Rekomendowany przedział wartości (koszyk ${basket.methods.length} metod): ${fmt(r.low)}–${fmt(r.high)} ${currency}, środek ${fmt(r.mid)} ${currency}.${flag}`;
}

// ── Orkiestracja DB (thin, additive) ────────────────────────────────────────

/** Zapisuje wybór głębokości na wycenie (assumptions.depth [+ WACC dla managerial]).
 *  Woła istniejący `valuationService.updateAssumptions` — nie pisze do DB bezpośrednio. */
export async function setValuationDepth(
  orgId: string,
  valuationId: string,
  depth: ValuationDepth,
  opts: {
    orgWacc?: number;
    actor?: { userId?: string; userEmail?: string; ip?: string; userAgent?: string };
  } = {}
): Promise<void> {
  const d = normalizeDepth(depth);
  const patch = getAssumptionsPatchForDepth(d, { orgWacc: opts.orgWacc });
  await updateAssumptions(orgId, valuationId, patch, opts.actor);
}

/** Czyta zapisaną głębokość wyceny (null = nigdy nie ustawiona → caller powinien
 *  traktować to jak "brak wyboru", NIE jak "managerial", żeby nie zmieniać
 *  zachowania istniejących endpointów dla wycen sprzed tej funkcji). */
export async function getValuationDepth(
  orgId: string,
  valuationId: string
): Promise<ValuationDepth | null> {
  const val = await getValuation(orgId, valuationId);
  if (!val) return null;
  return resolveStoredDepth(val.assumptions || {});
}
