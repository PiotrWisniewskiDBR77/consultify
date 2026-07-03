/**
 * BusinessPlanSpine — wspólny KRĘGOSŁUP biznesplanu (single source of truth).
 *
 * Jeden obiekt konsumowany przez wszystkie 3 generatory (B4 tabela, B3 raport, B1 deck),
 * żeby liczby/założenia/terminologia były IDENTYCZNE wszędzie. Embuduje założenia
 * konsultanckie ze spec: docs/product/BUSINESS_PLAN_GENERATOR_SPEC.md.
 *
 * Warstwy: AssumptionsModel (§A) → FinancialEngine (§B) → BundleOrchestrator (§D).
 * Wszystko za flagą ENABLE_DELIVERABLES_PREMIUM (OFF = ścieżka nieaktywna).
 */

// ════════════════════════════════════════════════════════════════════════
// §A — AssumptionsModel: założenia z obroną (driver-tree, source/range/sensitivity)
// ════════════════════════════════════════════════════════════════════════

/** Klasyfikacja wartości → konsumenci kolorują blue/black/green (FAST color-coding, §B13). */
export type ValueClass = 'input' | 'formula' | 'link';

/** Pochodzenie liczby — obrona przed due-diligence (§A6). */
export interface Provenance {
  /** Źródło + rok, np. "Gartner 2025" / "model wewnętrzny" / "benchmark Bessemer 2025". */
  source: string;
  /** Czy źródło to twardy benchmark/raport (true) vs estymata wewnętrzna (false). */
  benchmarked: boolean;
}

/** Pojedynczy driver/założenie — każda liczba traceable do nazwanego drivera (§A1). */
export interface Assumption {
  /** Stabilny klucz, np. "saas.price_per_seat_eur". */
  key: string;
  label: string;
  /** Wartość bazowa (base case, konserwatywna — §A8/B11). */
  base: number;
  unit: string; // 'EUR' | '%' | 'mies' | 'szt' | 'EUR/seat/mies' …
  /** Plausibilny zakres zamiast fałszywej precyzji (§A6). [low, high] */
  range: [number, number];
  provenance: Provenance;
  /** 0 = nieistotne, wyżej = bardziej rusza wynik (ranga sensitivity, §A6/B12). */
  sensitivityRank: number;
  /** Outside-view base-rate dla anty-optymizmu (§A8), opcjonalnie. */
  referenceClass?: { value: number; note: string };
  /** Nazwa drivera-rodzica w driver-tree (parent = arytmetyka children, §A1). */
  parent?: string;
  valueClass: ValueClass;
}

/** Market sizing — TAM/SAM/SOM jako 3 odrębne liczby, bottom-up podstawą (§A2-A5). */
export interface MarketSizing {
  /** Wynik buildu, nie premisa (§A3). */
  tam: { value: number; unit: string; method: 'top-down'; provenance: Provenance };
  sam: { value: number; unit: string; provenance: Provenance };
  /** Z buildu GTM+capacity, nigdy "X% rynku" (§A5). */
  som: { value: number; unit: string; derivedFromGtm: true; provenance: Provenance };
  /** Niezależny bottom-up (klienci×ARPU) — PODSTAWA (§A3). */
  bottomUp: { value: number; unit: string; formula: string };
  /** Reconcile top-down vs bottom-up; flaga gdy |gap| > 0.15 (§A4). */
  reconciliation: { topDown: number; bottomUp: number; gapPct: number; reconciled: boolean };
}

/** Wynik detektorów anty-wzorców (§A9) — czerwone flagi due-diligence. */
export interface AntiPatternFinding {
  pattern:
    | 'hockey_stick_no_driver'
    | 'tam_unsourced_or_topdown_only'
    | 'hidden_circularity'
    | 'false_precision'
    | 'one_percent_of_market'
    | 'revenue_ramp_without_cac';
  severity: 'flag' | 'reject';
  detail: string;
  /** Klucz dotkniętego założenia/sekcji. */
  ref?: string;
}

// ════════════════════════════════════════════════════════════════════════
// §B — FinancialEngine: model z driverów (3-statement, ARR bridge, unit-econ, KPI)
// ════════════════════════════════════════════════════════════════════════

export interface PnLPeriod {
  period: string; // "Rok 1 (2026)"
  revenue: number;
  cogs: number;
  grossProfit: number;
  opexSM: number; // S&M
  opexRD: number; // R&D
  opexGA: number; // G&A
  ebitda: number;
  da: number; // D&A
  ebit: number;
  netIncome: number;
}

/** ARR bridge: Begin + New + Expansion − Contraction − Churn = End (§B5). */
export interface ArrBridgePeriod {
  period: string;
  beginning: number;
  newLogo: number;
  expansion: number;
  contraction: number;
  churned: number;
  ending: number;
}

/** Uproszczony bilans przez corkscrew (§B4) — Assets = L + E. */
export interface BalanceSheetPeriod {
  period: string;
  cash: number;
  receivables: number;
  ppe: number;
  deferredRevenue: number;
  debt: number;
  equity: number;
}

export interface CashFlowPeriod {
  period: string;
  operating: number;
  investing: number;
  financing: number;
  endingCash: number;
}

export interface UnitEconomics {
  segment: string;
  cac: number;
  ltv: number; // gross-margin-adjusted
  ltvCacRatio: number;
  cacPaybackMonths: number;
}

export interface SaasKpis {
  nrr: number; // %
  ruleOf40: number; // growth% + FCF margin%
  burnMultiple: number;
  magicNumber: number;
  cacPaybackMonths: number;
}

export interface ValuationRange {
  dcf: number;
  comparablesMultiple: number;
  vcMethod: number;
  low: number;
  high: number;
  terminalValuePctOfEv?: number; // flaga gdy > ~0.75-0.9 (§B9)
}

export type ScenarioName = 'base' | 'bull' | 'bear';

/** W12.2 — sensitivity matrix: jak zmienia się wycena gdy ruszamy kluczowy driver ±20%. */
export interface ValuationSensitivityRow {
  driver: string;      // np. "Wzrost przychodów"
  driverKey: string;   // np. "revenueGrowth"
  unit: string;        // "%" | "×" | "EUR"
  pessimistic: ValuationRange; // driver −20%
  base: ValuationRange;        // base case
  optimistic: ValuationRange;  // driver +20%
}

export interface FinancialModel {
  currency: string;
  pnl: PnLPeriod[];
  arrBridge: ArrBridgePeriod[];
  balanceSheet: BalanceSheetPeriod[];
  cashFlow: CashFlowPeriod[];
  unitEconomics: UnitEconomics[];
  kpis: SaasKpis;
  breakEven: { ebitdaPositivePeriod: string | null; runwayMonths: number | null };
  valuation: ValuationRange;
  /** W12.2 — sensitivity matrix per kluczowy driver (3 metody wyceny × ±20%). */
  valuationSensitivity?: ValuationSensitivityRow[];
  /** base/bull/bear z udokumentowanych delt (§B11). */
  scenarios: Record<ScenarioName, { pnl: PnLPeriod[]; note: string }>;
}

/** Pojedynczy check CFO-review (§C) — maszynowy raport walidacji (§B14). */
export interface ValidationCheck {
  id: string; // 'bs_balances' | 'ltv_cac_min' | 'rule_of_40' …
  label: string;
  passed: boolean;
  value?: number;
  benchmark?: string;
}

export interface ValidationReport {
  checks: ValidationCheck[];
  antiPatterns: AntiPatternFinding[];
  passed: boolean; // wszystkie hard-checki zielone + brak 'reject'
}

// ════════════════════════════════════════════════════════════════════════
// §D/E — Narracja: kanon sekcji + glosariusz + hero-numbers (single SoT)
// ════════════════════════════════════════════════════════════════════════

/** Kanoniczne sekcje biznesplanu (§E1), exec summary zawsze pierwszy. */
export type BizPlanSectionId =
  | 'exec_summary' | 'problem' | 'solution' | 'market' | 'business_model'
  | 'gtm' | 'competition' | 'traction' | 'financial_plan' | 'unit_economics'
  | 'team' | 'risks' | 'ask' | 'roadmap';

export interface BizPlanSection {
  id: BizPlanSectionId;
  /** Action-title = zdanie-"so-what" (§E2). */
  actionTitle: string;
  /** SCQA frame sekcji (§E2). */
  scqa?: { situation: string; complication: string; question: string; answer: string };
  /** Klucze hero-numbers, które ta sekcja powierzchnia (muszą być identyczne wszędzie, §D3). */
  heroNumberKeys: string[];
  /** Mapowanie do decka: czy slajd reużywa tabelę / potrzebuje grafiki produktu (§E4). */
  deck: { slideIntent: string; reusesTable: boolean; needsProductGraphic: boolean };
}

/** Hero-number = jedna liczba renderowana identycznie w 3 artefaktach (§D3). */
export interface HeroNumber {
  key: string; // 'ask_eur' | 'revenue_y3' | 'ltv_cac' …
  label: string;
  value: number;
  unit: string;
  formatted: string; // sformatowana raz, reużyta wszędzie
}

// ════════════════════════════════════════════════════════════════════════
// SPINE — wspólny kręgosłup (to konsumują B4/B3/B1)
// ════════════════════════════════════════════════════════════════════════

export interface BusinessPlanSpine {
  meta: {
    company: string;
    language: 'PL' | 'EN';
    /** Jedna teza nadrzędna — reużyta w exec summary + slajd-purpose + summary (§D6). */
    thesis: string;
    /** Ask / use-of-funds (§E1). */
    ask: string;
  };
  /** Rejestr założeń = jeden log provenance zasilający wszystko (§A7/B1). */
  assumptions: Assumption[];
  market: MarketSizing;
  financials: FinancialModel;
  /** Wspólny glosariusz: jedno pojęcie = jedna nazwa (§D4). */
  glossary: Record<string, string>;
  /** Hero-numbers — identyczność wymuszona przez orchestrator (§D3). */
  heroNumbers: HeroNumber[];
  /** Kanon sekcji z action-titles + mapowaniem na deck (§E1-E4). */
  sections: BizPlanSection[];
  /** CFO-review + anty-wzorce (§C) — bramka przed outputem. */
  validation: ValidationReport;
}

/** Format liczby raz, reużyj wszędzie (gwarancja identyczności hero-numbers, §D3). */
/**
 * Usuń z jednostki kwalifikatory SKALI (thousands/tys/mln/mld/k/m/'000…), które
 * LLM czasem dokleja do waluty — przy pełnoskalowych liczbach daje to absurdy
 * typu „8 200 000 thousands EUR". Zostawiamy czysty token waluty (head-to-head W2.2).
 */
export function normalizeCurrencyUnit(unit: string): string {
  if (!unit) return unit;
  // tnij wiodące słowa skali (z opcjonalnym separatorem), case-insensitive
  const cleaned = unit
    .replace(/\b(thousands?|tys(?:i[ąa]ce|\.)?|tysi[ęe]cy|millions?|mln|mld|miliard(?:y|ów)?|milion(?:y|ów)?|billions?|'?000)\b\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned : unit; // jeśli zostałoby puste, zachowaj oryginał
}

export function formatHero(value: number, unit: string, language: 'PL' | 'EN' = 'PL'): string {
  const u = normalizeCurrencyUnit(unit);
  if (u === '%') return `${value}%`;
  const sep = language === 'PL' ? ' ' : ',';
  const isPl = language === 'PL';
  const abs = Math.abs(value);
  // Skala walutowa/liczbowa — surowe miliardy/miliony szpecą („300 000 000 000 EUR").
  // Skracaj tylko jednostki walutowe/szt (NIE „×", „mies", „pkt"), zachowując < 1e6 grupowane.
  const isScalable = !u || /^(EUR|USD|PLN|GBP|zł|€|\$|szt)$/i.test(u);
  // Skracaj WYŁĄCZNIE miliardy (surowe „300 000 000 000 EUR" szpeci); miliony
  // zostają grupowane („8 200 000 EUR") — celowo (W2.2, czytelność precyzji).
  if (isScalable && abs >= 1e9) {
    const r = Math.round((value / 1e9) * 10) / 10;
    const s = Number.isInteger(r) ? String(r) : String(r).replace('.', isPl ? ',' : '.');
    return `${s} ${isPl ? 'mld' : 'B'}${u ? ' ' + u : ''}`;
  }
  const grouped = abs >= 1000
    ? Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep)
    : value.toString();
  return `${grouped}${u ? ' ' + u : ''}`;
}
