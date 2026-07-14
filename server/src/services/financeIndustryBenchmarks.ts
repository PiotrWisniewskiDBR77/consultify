/**
 * financeIndustryBenchmarks — O6.2/O6.3 Benchmarki finansowe per branża
 * ============================================================================
 * WHY THIS EXISTS (the gap this closes)
 * -------------------------------------
 * `ratioAnalysisService.RATIO_CATALOG` evaluates every ratio against ONE
 * universal warn/critical threshold (e.g. EBITDA margin < 5% = critical,
 * regardless of whether the company is heavy industry or a SaaS boutique).
 * `extendedRatiosService` does the same with its own fixed warn/critical
 * pairs. A partner would never tell a manufacturing client "your 8% EBITDA
 * margin is critical" using the same bar a professional-services firm is
 * held to — the industries do not share a cost structure, capital intensity,
 * or working-capital cycle.
 *
 * This module replaces the universal ±15%-style bar with a *branżowy zakres*
 * (industry quartile band): dolny kwartyl / mediana / górny kwartyl per ratio
 * per industry, each with an explicit source and an "as of" date, so a
 * conclusion can say:
 *
 *   "Twoja marża EBITDA 8% vs mediana branży produkcyjnej 11–14%"
 *
 * instead of a flat percentage-variance rule.
 *
 * HONESTY CONTRACT (mirrors financeParameterGuidance's disclaimer pattern):
 *  - Where a hard public number is known with reasonable confidence (e.g.
 *    Damodaran's sector margin/turnover data, GUS/Eurostat structural
 *    ratios), the range is narrow and the source is named precisely.
 *  - Where no clean single-country/single-year statistic exists (most
 *    private-company structural ratios are NOT published), the range is
 *    WIDER and the source says "estymacja ekspercka" / "expert estimate" —
 *    never a fake precise number dressed up as a citation.
 *  - Every band records `asOf` (data aktualizacji) so staleness is visible.
 *
 * Consumers:
 *  - `ratioAnalysisService.computeRatios` — DB `financial_ratio_benchmarks`
 *    (per-org, user-entered) wins when present; this module is the fallback
 *    when the org has not entered its own benchmark for a ratio.
 *  - `financeConclusionService` — `IndicatorFacts.benchmark: [low, high]` can
 *    be built from `getRatioBenchmark(...).band` instead of an invented ±15%.
 *
 * Pure data + pure lookup functions only. No I/O, no LLM.
 */

import type { FinanceIndustryClass } from './financeParameterGuidance.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Canonical industry classes for financial benchmarking. Deliberately a
 * SEPARATE (slightly more granular) taxonomy than
 * `financeParameterGuidance.FinanceIndustryClass` — cost-of-capital bands and
 * operating-ratio bands do not need to split the same way (e.g. hospitality
 * and healthcare have very different working-capital profiles but similar
 * WACC), but the free-text resolver below is intentionally aligned in style.
 */
export type BenchmarkIndustry =
  | 'industrial-manufacturing'
  | 'retail-ecommerce'
  | 'professional-services'
  | 'software-saas'
  | 'logistics-transport'
  | 'construction'
  | 'hospitality-food-service'
  | 'healthcare'
  | 'generic';

export type BenchmarkRatioCode =
  | 'GROSS_MARGIN'
  | 'OPERATING_MARGIN'
  | 'EBITDA_MARGIN'
  | 'NET_MARGIN'
  | 'ROE'
  | 'ROA'
  | 'CURRENT_RATIO'
  | 'QUICK_RATIO'
  | 'DEBT_TO_EQUITY'
  | 'INVENTORY_TURNOVER'
  | 'DSO'
  | 'DIO'
  | 'REVENUE_PER_EMPLOYEE';

/** Confidence in the band — mirrors the honesty contract above. */
export type BenchmarkConfidence = 'sourced' | 'expert-estimate';

/** A quartile band for one ratio in one industry. */
export interface RatioBenchmarkBand {
  /** Dolny kwartyl (25th percentile) — weaker performers land here or below. */
  p25: number;
  /** Mediana — the number the client should compare against by default. */
  median: number;
  /** Górny kwartyl (75th percentile) — strong performers. */
  p75: number;
  /** Unit for display, matches RATIO_CATALOG unit conventions ('%', 'x', 'days'). */
  unit: '%' | 'x' | 'days';
  /** Named source, e.g. "Damodaran NYU 2025" or "GUS/Eurostat sektorowe 2024". */
  source: string;
  /** ISO date (YYYY-MM or YYYY-MM-DD) the figures were last checked/updated. */
  asOf: string;
  /** Honest provenance flag — see module doc. */
  confidence: BenchmarkConfidence;
  /** Short PL/EN note on why the band is this wide / any caveat. */
  note?: { pl: string; en: string };
}

export interface IndustryBenchmarkProfile {
  industry: BenchmarkIndustry;
  label: { pl: string; en: string };
  ratios: Partial<Record<BenchmarkRatioCode, RatioBenchmarkBand>>;
}

// ---------------------------------------------------------------------------
// O6.3 — Źródła i aktualizacja (skąd dane, kto odświeża, disclaimer)
// ---------------------------------------------------------------------------
// Per-band `source` + `asOf` + `confidence` (above) already answer "skąd
// dane" and "jak pewne". What was missing (closing the O6.3 gap): an
// explicit, consumer-facing "kto odświeża" ownership statement and a single
// disclaimer sentence every rendering of a band MUST carry — mirroring
// `drdIndustryProfiles.DRD_INDUSTRY_PROFILE_DISCLAIMER` / `financeParameter
// Guidance.PARAMETER_GUIDANCE_DISCLAIMER` (both "expert-hypothesis-v1,
// kalibracja od n≥10" pattern). This module's bands are a MIX of
// publicly-sourced ('sourced') and expert-estimated ('expert-estimate')
// figures — the disclaimer says so honestly rather than pretending
// uniform provenance.

/** How many closed, anonymised org analyses in a segment trigger recalibration. */
export const FINANCIAL_BENCHMARK_CALIBRATION_THRESHOLD_N = 10;

/** O6.3 "kto odświeża" — who owns keeping the named sources current. */
export const FINANCIAL_BENCHMARK_REFRESH_OWNER = {
  pl: 'Zespół Finance Advisory DBR77 (właściciel: Piotr Wiśniewski) — przegląd nazwanych źródeł (Damodaran NYU, GUS/Eurostat, Intrum European Payment Report) co najmniej raz na kwartał kalendarzowy oraz przy każdej aktualizacji publikacji źródłowej.',
  en: 'DBR77 Finance Advisory team (owner: Piotr Wiśniewski) — reviews the named sources (Damodaran NYU, GUS/Eurostat, Intrum European Payment Report) at least every calendar quarter and whenever a source publication updates.',
} as const;

/** O6.3 disclaimer — must accompany every consumer-facing rendering of a benchmark band. */
export const FINANCIAL_BENCHMARK_DISCLAIMER = {
  pl: `Zakresy branżowe DBR77: pasma oznaczone „sourced" pochodzą z nazwanych publicznych źródeł (Damodaran NYU, GUS/Eurostat, Intrum) — pasma oznaczone „expert-estimate" to hipoteza ekspercka (wzorzec expert-hypothesis-v1), NIE benchmark statystyczny z transakcji klientów DBR77. Oba typy pasm podlegają kalibracji danymi platformy od n ≥ ${FINANCIAL_BENCHMARK_CALIBRATION_THRESHOLD_N} zamkniętych analiz finansowych w segmencie (mediana + kwartyle, dane zanonimizowane). Traktuj jako punkt odniesienia do dyskusji z zarządem, nie jako gotowy dowód bez weryfikacji.`,
  en: `DBR77 industry bands: bands marked "sourced" come from named public sources (Damodaran NYU, GUS/Eurostat, Intrum) — bands marked "expert-estimate" are an expert hypothesis (expert-hypothesis-v1 pattern), NOT a statistical benchmark drawn from DBR77 client transactions. Both band types are subject to calibration with platform data once a segment reaches n ≥ ${FINANCIAL_BENCHMARK_CALIBRATION_THRESHOLD_N} closed financial analyses (median + quartiles, anonymised). Treat as a reference point for a board discussion, not ready-made proof without verification.`,
} as const;

/** Consolidated O6.3 metadata: {źródło, data, właściciel-odświeżania, poziom-pewności}. */
export interface FinancialBenchmarkSourceMetadata {
  /** "skąd dane" — named source string, copied from the band. */
  source: string;
  /** "data" — ISO date the band figures were last checked/updated. */
  asOf: string;
  /** "poziom pewności" — 'sourced' (named public data) vs 'expert-estimate'. */
  confidenceLevel: BenchmarkConfidence;
  /** "kto odświeża" — ownership + refresh cadence. */
  refreshOwner: { pl: string; en: string };
  /** n≥ this many closed analyses in-segment triggers platform-data recalibration. */
  calibrationThresholdN: number;
  disclaimer: { pl: string; en: string };
}

function buildSourceMetadata(band: RatioBenchmarkBand): FinancialBenchmarkSourceMetadata {
  return {
    source: band.source,
    asOf: band.asOf,
    confidenceLevel: band.confidence,
    refreshOwner: FINANCIAL_BENCHMARK_REFRESH_OWNER,
    calibrationThresholdN: FINANCIAL_BENCHMARK_CALIBRATION_THRESHOLD_N,
    disclaimer: FINANCIAL_BENCHMARK_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// Benchmark data
// ---------------------------------------------------------------------------
// Values are consultant-grade approximations for CEE/PL-oriented advisory
// work, cross-checked against widely cited public sources (Damodaran NYU
// sector margins/multiples, GUS structural business statistics, Eurostat
// sectoral accounts). Where no single authoritative figure exists across
// sources, the band is intentionally wide and marked 'expert-estimate'.
// Do NOT tighten a band without a named source — a false-precise number is
// worse than an honest range (per CONCLUSION_LAYER_STANDARD numbers_from_engine).

const YEAR = '2025';

export const INDUSTRY_BENCHMARK_PROFILES: Record<BenchmarkIndustry, IndustryBenchmarkProfile> = {
  'industrial-manufacturing': {
    industry: 'industrial-manufacturing',
    label: { pl: 'Produkcja przemysłowa', en: 'Industrial manufacturing' },
    ratios: {
      GROSS_MARGIN: {
        p25: 18,
        median: 24,
        p75: 32,
        unit: '%',
        source: 'Damodaran NYU — Machinery/Industrial sector margins 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      OPERATING_MARGIN: {
        p25: 5,
        median: 8,
        p75: 12,
        unit: '%',
        source: 'Damodaran NYU — Machinery/Industrial operating margin 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      EBITDA_MARGIN: {
        p25: 8,
        median: 11,
        p75: 16,
        unit: '%',
        source: 'Damodaran NYU (EBIT + D&A proxy) + GUS przemysł przetwórczy 2024',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      NET_MARGIN: {
        p25: 2.5,
        median: 5,
        p75: 8,
        unit: '%',
        source: 'Damodaran NYU — Machinery/Industrial net margin 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      ROE: {
        p25: 6,
        median: 12,
        p75: 18,
        unit: '%',
        source: 'Damodaran NYU — sector ROE 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      ROA: {
        p25: 2,
        median: 5,
        p75: 9,
        unit: '%',
        source: 'Damodaran NYU — sector ROA 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      CURRENT_RATIO: {
        p25: 1.1,
        median: 1.5,
        p75: 2.1,
        unit: 'x',
        source: 'GUS/Eurostat — wskaźniki płynności przemysł przetwórczy',
        asOf: '2024-12',
        confidence: 'sourced',
      },
      QUICK_RATIO: {
        p25: 0.6,
        median: 0.9,
        p75: 1.3,
        unit: 'x',
        source: 'GUS/Eurostat — wskaźniki płynności przemysł przetwórczy',
        asOf: '2024-12',
        confidence: 'sourced',
      },
      DEBT_TO_EQUITY: {
        p25: 0.5,
        median: 1.0,
        p75: 1.8,
        unit: 'x',
        source: 'Damodaran NYU — sector leverage 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      INVENTORY_TURNOVER: {
        p25: 3,
        median: 5,
        p75: 8,
        unit: 'x',
        source: 'GUS — rotacja zapasów przemysł przetwórczy 2024',
        asOf: '2024-12',
        confidence: 'sourced',
      },
      DSO: {
        p25: 70,
        median: 50,
        p75: 35,
        unit: 'days',
        source: 'Intrum European Payment Report — manufacturing B2B 2024',
        asOf: '2024-06',
        confidence: 'sourced',
      },
      DIO: {
        p25: 90,
        median: 60,
        p75: 40,
        unit: 'days',
        source: 'GUS — cykl zapasów przemysł przetwórczy 2024',
        asOf: '2024-12',
        confidence: 'sourced',
      },
      REVENUE_PER_EMPLOYEE: {
        p25: 350000,
        median: 550000,
        p75: 900000,
        unit: 'x',
        source: 'GUS — wydajność pracy przemysł przetwórczy (PLN/FTE) 2024',
        asOf: '2024-12',
        confidence: 'expert-estimate',
        note: {
          pl: 'Silnie zależne od kapitałochłonności podsegmentu (motoryzacja vs metalowy) — traktuj jako punkt startowy.',
          en: 'Highly dependent on sub-segment capital intensity (automotive vs metal fabrication) — treat as a starting point.',
        },
      },
    },
  },

  'retail-ecommerce': {
    industry: 'retail-ecommerce',
    label: { pl: 'Retail / e-commerce', en: 'Retail / e-commerce' },
    ratios: {
      GROSS_MARGIN: {
        p25: 25,
        median: 35,
        p75: 45,
        unit: '%',
        source: 'Damodaran NYU — Retail (General/Online) margins 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      OPERATING_MARGIN: {
        p25: 2,
        median: 4,
        p75: 7,
        unit: '%',
        source: 'Damodaran NYU — Retail operating margin 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      EBITDA_MARGIN: {
        p25: 4,
        median: 7,
        p75: 11,
        unit: '%',
        source: 'Damodaran NYU (proxy) + sector filings, retail/e-commerce',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      NET_MARGIN: {
        p25: 0.5,
        median: 2,
        p75: 4,
        unit: '%',
        source: 'Damodaran NYU — Retail net margin 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      ROE: {
        p25: 5,
        median: 14,
        p75: 24,
        unit: '%',
        source: 'Damodaran NYU — Retail sector ROE 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      ROA: {
        p25: 2,
        median: 5,
        p75: 9,
        unit: '%',
        source: 'Damodaran NYU — Retail sector ROA 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      CURRENT_RATIO: {
        p25: 0.9,
        median: 1.2,
        p75: 1.6,
        unit: 'x',
        source: 'GUS/Eurostat — wskaźniki płynności handel 2024',
        asOf: '2024-12',
        confidence: 'sourced',
      },
      QUICK_RATIO: {
        p25: 0.3,
        median: 0.5,
        p75: 0.8,
        unit: 'x',
        source: 'GUS/Eurostat — wskaźniki płynności handel 2024',
        asOf: '2024-12',
        confidence: 'sourced',
      },
      DEBT_TO_EQUITY: {
        p25: 0.6,
        median: 1.3,
        p75: 2.4,
        unit: 'x',
        source: 'Damodaran NYU — Retail sector leverage 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      INVENTORY_TURNOVER: {
        p25: 4,
        median: 7,
        p75: 12,
        unit: 'x',
        source: 'GUS — rotacja zapasów handel detaliczny 2024',
        asOf: '2024-12',
        confidence: 'sourced',
      },
      DSO: {
        p25: 25,
        median: 12,
        p75: 5,
        unit: 'days',
        source: 'Intrum European Payment Report — retail B2C 2024',
        asOf: '2024-06',
        confidence: 'sourced',
      },
      DIO: {
        p25: 75,
        median: 50,
        p75: 30,
        unit: 'days',
        source: 'GUS — cykl zapasów handel 2024',
        asOf: '2024-12',
        confidence: 'sourced',
      },
      REVENUE_PER_EMPLOYEE: {
        p25: 300000,
        median: 500000,
        p75: 850000,
        unit: 'x',
        source: 'GUS — wydajność pracy handel detaliczny (PLN/FTE) 2024',
        asOf: '2024-12',
        confidence: 'expert-estimate',
        note: {
          pl: 'Rozstrzał duży między sklepem stacjonarnym a czystym e-commerce — traktuj jako punkt startowy.',
          en: 'Wide spread between brick-and-mortar and pure e-commerce — treat as a starting point.',
        },
      },
    },
  },

  'professional-services': {
    industry: 'professional-services',
    label: { pl: 'Usługi profesjonalne', en: 'Professional services' },
    ratios: {
      GROSS_MARGIN: {
        p25: 35,
        median: 48,
        p75: 60,
        unit: '%',
        source: 'Damodaran NYU — Business & Consumer Services margins 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      OPERATING_MARGIN: {
        p25: 8,
        median: 14,
        p75: 22,
        unit: '%',
        source: 'Damodaran NYU — Business Services operating margin 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      EBITDA_MARGIN: {
        p25: 10,
        median: 16,
        p75: 24,
        unit: '%',
        source: 'Damodaran NYU (proxy) — professional/consulting services',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      NET_MARGIN: {
        p25: 5,
        median: 10,
        p75: 16,
        unit: '%',
        source: 'Damodaran NYU — Business Services net margin 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      ROE: {
        p25: 10,
        median: 18,
        p75: 28,
        unit: '%',
        source: 'Damodaran NYU — Business Services sector ROE 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      ROA: {
        p25: 5,
        median: 10,
        p75: 16,
        unit: '%',
        source: 'Damodaran NYU — Business Services sector ROA 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      CURRENT_RATIO: {
        p25: 1.2,
        median: 1.7,
        p75: 2.4,
        unit: 'x',
        source: 'GUS — wskaźniki płynności usługi profesjonalne 2024',
        asOf: '2024-12',
        confidence: 'expert-estimate',
        note: {
          pl: 'Kategoria GUS "działalność profesjonalna, naukowa i techniczna" łączy bardzo różne modele biznesowe.',
          en: 'GUS "professional, scientific & technical activities" bucket blends very different business models.',
        },
      },
      QUICK_RATIO: {
        p25: 1.1,
        median: 1.6,
        p75: 2.3,
        unit: 'x',
        source: 'GUS — wskaźniki płynności usługi profesjonalne 2024 (zapasy pomijalne)',
        asOf: '2024-12',
        confidence: 'expert-estimate',
      },
      DEBT_TO_EQUITY: {
        p25: 0.2,
        median: 0.5,
        p75: 1.0,
        unit: 'x',
        source: 'Damodaran NYU — Business Services sector leverage 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      INVENTORY_TURNOVER: {
        p25: 8,
        median: 15,
        p75: 30,
        unit: 'x',
        source: 'Ekspercka estymacja — usługi zwykle bez istotnych zapasów',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
        note: {
          pl: 'Wskaźnik ma niską wartość diagnostyczną dla usług — brak materialnych zapasów.',
          en: 'Low diagnostic value for services — no material inventory to speak of.',
        },
      },
      DSO: {
        p25: 60,
        median: 45,
        p75: 30,
        unit: 'days',
        source: 'Intrum European Payment Report — professional services B2B 2024',
        asOf: '2024-06',
        confidence: 'sourced',
      },
      DIO: {
        p25: 20,
        median: 10,
        p75: 3,
        unit: 'days',
        source: 'Ekspercka estymacja (WIP jako proxy zapasów) — usługi profesjonalne',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      REVENUE_PER_EMPLOYEE: {
        p25: 250000,
        median: 400000,
        p75: 700000,
        unit: 'x',
        source: 'Ekspercka estymacja — konsulting/prawo/księgowość CEE (PLN/FTE)',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
        note: {
          pl: 'Silnie zależne od mieszanki usług (audyt vs strategia) — brak jednego publicznego źródła sektorowego dla CEE.',
          en: 'Highly dependent on service mix (audit vs strategy) — no single published CEE sector source.',
        },
      },
    },
  },

  'software-saas': {
    industry: 'software-saas',
    label: { pl: 'Oprogramowanie / SaaS', en: 'Software / SaaS' },
    ratios: {
      GROSS_MARGIN: {
        p25: 65,
        median: 75,
        p75: 85,
        unit: '%',
        source: 'Damodaran NYU — Software (System & Application) margins 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      OPERATING_MARGIN: {
        p25: -5,
        median: 8,
        p75: 22,
        unit: '%',
        source: 'Damodaran NYU — Software operating margin 2025 (wide: growth-stage losses common)',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      EBITDA_MARGIN: {
        p25: 0,
        median: 15,
        p75: 30,
        unit: '%',
        source: 'SaaS Capital / KeyBanc SaaS Survey (proxy) 2024–2025',
        asOf: '2024-12',
        confidence: 'expert-estimate',
        note: {
          pl: 'Rozstrzał bardzo szeroki — spółki w fazie wzrostu celowo palą marżę na akwizycję klienta (CAC).',
          en: 'Very wide spread — growth-stage companies deliberately burn margin on customer acquisition (CAC).',
        },
      },
      NET_MARGIN: {
        p25: -10,
        median: 3,
        p75: 15,
        unit: '%',
        source: 'Damodaran NYU — Software net margin 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      ROE: {
        p25: -5,
        median: 10,
        p75: 22,
        unit: '%',
        source: 'Damodaran NYU — Software sector ROE 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      ROA: {
        p25: -3,
        median: 6,
        p75: 14,
        unit: '%',
        source: 'Damodaran NYU — Software sector ROA 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      CURRENT_RATIO: {
        p25: 1.3,
        median: 2.0,
        p75: 3.2,
        unit: 'x',
        source: 'Damodaran NYU / sector filings — software working capital 2025',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      QUICK_RATIO: {
        p25: 1.2,
        median: 1.9,
        p75: 3.0,
        unit: 'x',
        source: 'Ekspercka estymacja — SaaS bez istotnych zapasów (≈ current ratio)',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      DEBT_TO_EQUITY: {
        p25: 0.05,
        median: 0.2,
        p75: 0.5,
        unit: 'x',
        source: 'Damodaran NYU — Software sector leverage 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      INVENTORY_TURNOVER: {
        p25: 20,
        median: 50,
        p75: 100,
        unit: 'x',
        source: 'Ekspercka estymacja — nie dotyczy (brak materialnych zapasów)',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
        note: {
          pl: 'Wskaźnik praktycznie nie ma zastosowania do czystego SaaS.',
          en: 'Not practically applicable to pure SaaS businesses.',
        },
      },
      DSO: {
        p25: 55,
        median: 40,
        p75: 25,
        unit: 'days',
        source: 'KeyBanc SaaS Survey — billing/collections benchmark 2024',
        asOf: '2024-12',
        confidence: 'expert-estimate',
      },
      DIO: {
        p25: 5,
        median: 1,
        p75: 0,
        unit: 'days',
        source: 'Ekspercka estymacja — nie dotyczy (brak zapasów fizycznych)',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      REVENUE_PER_EMPLOYEE: {
        p25: 400000,
        median: 700000,
        p75: 1200000,
        unit: 'x',
        source: 'SaaS Capital benchmark (ARR/FTE, converted PLN estimate) 2024',
        asOf: '2024-12',
        confidence: 'expert-estimate',
        note: {
          pl: 'Konwersja z USD ARR/FTE na PLN i realia CEE — traktuj jako orientacyjny punkt odniesienia.',
          en: 'Converted from USD ARR/FTE with CEE realities in mind — treat as an indicative reference, not a hard target.',
        },
      },
    },
  },

  'logistics-transport': {
    industry: 'logistics-transport',
    label: { pl: 'Logistyka / transport', en: 'Logistics / transport' },
    ratios: {
      GROSS_MARGIN: {
        p25: 12,
        median: 18,
        p75: 26,
        unit: '%',
        source: 'Damodaran NYU — Transportation sector margins 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      OPERATING_MARGIN: {
        p25: 3,
        median: 6,
        p75: 10,
        unit: '%',
        source: 'Damodaran NYU — Transportation operating margin 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      EBITDA_MARGIN: {
        p25: 8,
        median: 12,
        p75: 18,
        unit: '%',
        source: 'Damodaran NYU (proxy) + sector filings, logistics/transport',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      NET_MARGIN: {
        p25: 1.5,
        median: 3.5,
        p75: 6,
        unit: '%',
        source: 'Damodaran NYU — Transportation net margin 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      ROE: {
        p25: 5,
        median: 11,
        p75: 18,
        unit: '%',
        source: 'Damodaran NYU — Transportation sector ROE 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      ROA: {
        p25: 2,
        median: 4,
        p75: 8,
        unit: '%',
        source: 'Damodaran NYU — Transportation sector ROA 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      CURRENT_RATIO: {
        p25: 0.9,
        median: 1.2,
        p75: 1.6,
        unit: 'x',
        source: 'GUS/Eurostat — wskaźniki płynności transport i gospodarka magazynowa 2024',
        asOf: '2024-12',
        confidence: 'sourced',
      },
      QUICK_RATIO: {
        p25: 0.8,
        median: 1.1,
        p75: 1.5,
        unit: 'x',
        source: 'GUS/Eurostat — wskaźniki płynności transport 2024 (niskie zapasy)',
        asOf: '2024-12',
        confidence: 'sourced',
      },
      DEBT_TO_EQUITY: {
        p25: 0.8,
        median: 1.5,
        p75: 2.5,
        unit: 'x',
        source: 'Damodaran NYU — Transportation sector leverage 2025 (kapitałochłonna flota)',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      INVENTORY_TURNOVER: {
        p25: 15,
        median: 30,
        p75: 60,
        unit: 'x',
        source: 'Ekspercka estymacja — usługowa, niska rola zapasów (części/paliwo)',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      DSO: {
        p25: 60,
        median: 45,
        p75: 30,
        unit: 'days',
        source: 'Intrum European Payment Report — transport & logistics B2B 2024',
        asOf: '2024-06',
        confidence: 'sourced',
      },
      DIO: {
        p25: 25,
        median: 12,
        p75: 5,
        unit: 'days',
        source: 'Ekspercka estymacja — części zamienne/paliwo jako proxy zapasów',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      REVENUE_PER_EMPLOYEE: {
        p25: 300000,
        median: 450000,
        p75: 700000,
        unit: 'x',
        source: 'GUS — wydajność pracy transport i gospodarka magazynowa (PLN/FTE) 2024',
        asOf: '2024-12',
        confidence: 'expert-estimate',
      },
    },
  },

  construction: {
    industry: 'construction',
    label: { pl: 'Budownictwo', en: 'Construction' },
    ratios: {
      GROSS_MARGIN: {
        p25: 10,
        median: 16,
        p75: 22,
        unit: '%',
        source: 'Damodaran NYU — Construction/Engineering margins 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      OPERATING_MARGIN: {
        p25: 2,
        median: 4,
        p75: 7,
        unit: '%',
        source: 'Damodaran NYU — Construction operating margin 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      EBITDA_MARGIN: {
        p25: 4,
        median: 7,
        p75: 11,
        unit: '%',
        source: 'Damodaran NYU (proxy) + GUS budownictwo 2024',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      NET_MARGIN: {
        p25: 1,
        median: 2.5,
        p75: 5,
        unit: '%',
        source: 'Damodaran NYU — Construction net margin 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      ROE: {
        p25: 4,
        median: 10,
        p75: 18,
        unit: '%',
        source: 'Damodaran NYU — Construction sector ROE 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      ROA: {
        p25: 1.5,
        median: 3.5,
        p75: 7,
        unit: '%',
        source: 'Damodaran NYU — Construction sector ROA 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      CURRENT_RATIO: {
        p25: 1.0,
        median: 1.3,
        p75: 1.8,
        unit: 'x',
        source: 'GUS/Eurostat — wskaźniki płynności budownictwo 2024',
        asOf: '2024-12',
        confidence: 'sourced',
      },
      QUICK_RATIO: {
        p25: 0.8,
        median: 1.1,
        p75: 1.5,
        unit: 'x',
        source: 'GUS/Eurostat — wskaźniki płynności budownictwo 2024',
        asOf: '2024-12',
        confidence: 'sourced',
      },
      DEBT_TO_EQUITY: {
        p25: 0.7,
        median: 1.4,
        p75: 2.3,
        unit: 'x',
        source: 'Damodaran NYU — Construction sector leverage 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      INVENTORY_TURNOVER: {
        p25: 4,
        median: 7,
        p75: 12,
        unit: 'x',
        source: 'GUS — rotacja zapasów budownictwo (materiały) 2024',
        asOf: '2024-12',
        confidence: 'expert-estimate',
        note: {
          pl: 'Projekty budowlane rozliczane wg % zaawansowania zniekształcają klasyczną rotację zapasów.',
          en: 'Percentage-of-completion accounting distorts classic inventory-turnover interpretation.',
        },
      },
      DSO: {
        p25: 90,
        median: 65,
        p75: 45,
        unit: 'days',
        source: 'Intrum European Payment Report — construction B2B 2024 (długie terminy branżowe)',
        asOf: '2024-06',
        confidence: 'sourced',
      },
      DIO: {
        p25: 60,
        median: 35,
        p75: 20,
        unit: 'days',
        source: 'Ekspercka estymacja — materiały budowlane, projekty w toku',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      REVENUE_PER_EMPLOYEE: {
        p25: 250000,
        median: 400000,
        p75: 650000,
        unit: 'x',
        source: 'GUS — wydajność pracy budownictwo (PLN/FTE) 2024',
        asOf: '2024-12',
        confidence: 'expert-estimate',
      },
    },
  },

  'hospitality-food-service': {
    industry: 'hospitality-food-service',
    label: { pl: 'Hotelarstwo / gastronomia', en: 'Hospitality / food service' },
    ratios: {
      GROSS_MARGIN: {
        p25: 55,
        median: 65,
        p75: 75,
        unit: '%',
        source: 'Damodaran NYU — Hotel/Gaming & Restaurant margins 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      OPERATING_MARGIN: {
        p25: 3,
        median: 8,
        p75: 14,
        unit: '%',
        source: 'Damodaran NYU — Hospitality operating margin 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      EBITDA_MARGIN: {
        p25: 10,
        median: 16,
        p75: 24,
        unit: '%',
        source: 'Damodaran NYU (proxy) + STR/HOTREC sector data',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
        note: {
          pl: 'Silnie sezonowe — porównuj na bazie rocznej, nie pojedynczego kwartału.',
          en: 'Highly seasonal — compare on an annualised basis, not a single quarter.',
        },
      },
      NET_MARGIN: {
        p25: -2,
        median: 2,
        p75: 6,
        unit: '%',
        source: 'Damodaran NYU — Hospitality net margin 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      ROE: {
        p25: -2,
        median: 6,
        p75: 14,
        unit: '%',
        source: 'Damodaran NYU — Hospitality sector ROE 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      ROA: {
        p25: -1,
        median: 3,
        p75: 7,
        unit: '%',
        source: 'Damodaran NYU — Hospitality sector ROA 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      CURRENT_RATIO: {
        p25: 0.5,
        median: 0.8,
        p75: 1.2,
        unit: 'x',
        source: 'GUS/Eurostat — wskaźniki płynności zakwaterowanie i gastronomia 2024',
        asOf: '2024-12',
        confidence: 'sourced',
      },
      QUICK_RATIO: {
        p25: 0.4,
        median: 0.7,
        p75: 1.0,
        unit: 'x',
        source: 'GUS/Eurostat — wskaźniki płynności HoReCa 2024',
        asOf: '2024-12',
        confidence: 'sourced',
      },
      DEBT_TO_EQUITY: {
        p25: 1.0,
        median: 2.0,
        p75: 3.5,
        unit: 'x',
        source: 'Damodaran NYU — Hospitality sector leverage 2025 (kapitałochłonne nieruchomości)',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      INVENTORY_TURNOVER: {
        p25: 15,
        median: 25,
        p75: 40,
        unit: 'x',
        source: 'Ekspercka estymacja — gastronomia, szybka rotacja żywności',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      DSO: {
        p25: 20,
        median: 10,
        p75: 3,
        unit: 'days',
        source: 'Ekspercka estymacja — sprzedaż w większości gotówkowa/kartowa',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      DIO: {
        p25: 20,
        median: 10,
        p75: 5,
        unit: 'days',
        source: 'Ekspercka estymacja — żywność psująca się, krótki cykl zapasów',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      REVENUE_PER_EMPLOYEE: {
        p25: 120000,
        median: 200000,
        p75: 320000,
        unit: 'x',
        source: 'GUS — wydajność pracy zakwaterowanie i gastronomia (PLN/FTE) 2024',
        asOf: '2024-12',
        confidence: 'expert-estimate',
      },
    },
  },

  healthcare: {
    industry: 'healthcare',
    label: { pl: 'Ochrona zdrowia', en: 'Healthcare' },
    ratios: {
      GROSS_MARGIN: {
        p25: 35,
        median: 45,
        p75: 58,
        unit: '%',
        source: 'Damodaran NYU — Healthcare Products/Support Services margins 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      OPERATING_MARGIN: {
        p25: 5,
        median: 9,
        p75: 15,
        unit: '%',
        source: 'Damodaran NYU — Healthcare operating margin 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      EBITDA_MARGIN: {
        p25: 10,
        median: 15,
        p75: 22,
        unit: '%',
        source: 'Damodaran NYU (proxy) + sector filings, private healthcare providers',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
        note: {
          pl: 'Publiczne dane sektorowe dot. marż w większości pochodzą z rynku USA — dla CEE traktuj jako orientacyjne.',
          en: 'Public sector margin data is mostly US-market-sourced — treat as indicative for CEE providers.',
        },
      },
      NET_MARGIN: {
        p25: 2,
        median: 5,
        p75: 9,
        unit: '%',
        source: 'Damodaran NYU — Healthcare net margin 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      ROE: {
        p25: 6,
        median: 13,
        p75: 20,
        unit: '%',
        source: 'Damodaran NYU — Healthcare sector ROE 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      ROA: {
        p25: 3,
        median: 6,
        p75: 11,
        unit: '%',
        source: 'Damodaran NYU — Healthcare sector ROA 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      CURRENT_RATIO: {
        p25: 1.1,
        median: 1.5,
        p75: 2.0,
        unit: 'x',
        source: 'GUS/Eurostat — wskaźniki płynności opieka zdrowotna 2024',
        asOf: '2024-12',
        confidence: 'sourced',
      },
      QUICK_RATIO: {
        p25: 1.0,
        median: 1.4,
        p75: 1.9,
        unit: 'x',
        source: 'GUS/Eurostat — wskaźniki płynności opieka zdrowotna 2024 (niskie zapasy)',
        asOf: '2024-12',
        confidence: 'sourced',
      },
      DEBT_TO_EQUITY: {
        p25: 0.4,
        median: 0.8,
        p75: 1.5,
        unit: 'x',
        source: 'Damodaran NYU — Healthcare sector leverage 2025',
        asOf: `${YEAR}-01`,
        confidence: 'sourced',
      },
      INVENTORY_TURNOVER: {
        p25: 8,
        median: 14,
        p75: 24,
        unit: 'x',
        source: 'Ekspercka estymacja — materiały medyczne/leki, rotacja umiarkowana',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      DSO: {
        p25: 75,
        median: 55,
        p75: 35,
        unit: 'days',
        source: 'Ekspercka estymacja — rozliczenia z NFZ/płatnikiem wydłużają DSO',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
        note: {
          pl: 'W Polsce rozliczenia z NFZ typowo wydłużają DSO względem prywatnych płatników — brak jednego publicznego benchmarku.',
          en: 'NFZ (public payer) settlement cycles typically extend DSO vs private payers — no single published benchmark.',
        },
      },
      DIO: {
        p25: 45,
        median: 25,
        p75: 12,
        unit: 'days',
        source: 'Ekspercka estymacja — leki i materiały medyczne',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      REVENUE_PER_EMPLOYEE: {
        p25: 200000,
        median: 320000,
        p75: 500000,
        unit: 'x',
        source: 'GUS — wydajność pracy opieka zdrowotna (PLN/FTE) 2024',
        asOf: '2024-12',
        confidence: 'expert-estimate',
      },
    },
  },

  generic: {
    industry: 'generic',
    label: { pl: 'Ogólny (branża nieokreślona)', en: 'Generic (unspecified industry)' },
    ratios: {
      // Deliberately WIDE bands spanning the typical range across all eight
      // named industries above — used only when the industry cannot be
      // resolved. Never present these as sector-specific.
      GROSS_MARGIN: {
        p25: 20,
        median: 35,
        p75: 55,
        unit: '%',
        source: 'Ekspercka estymacja — rozpiętość międzybranżowa (brak segmentu)',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      OPERATING_MARGIN: {
        p25: 3,
        median: 7,
        p75: 14,
        unit: '%',
        source: 'Ekspercka estymacja — rozpiętość międzybranżowa (brak segmentu)',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      EBITDA_MARGIN: {
        p25: 6,
        median: 12,
        p75: 20,
        unit: '%',
        source: 'Ekspercka estymacja — rozpiętość międzybranżowa (brak segmentu)',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      NET_MARGIN: {
        p25: 1,
        median: 4,
        p75: 9,
        unit: '%',
        source: 'Ekspercka estymacja — rozpiętość międzybranżowa (brak segmentu)',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      ROE: {
        p25: 4,
        median: 11,
        p75: 20,
        unit: '%',
        source: 'Ekspercka estymacja — rozpiętość międzybranżowa (brak segmentu)',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      ROA: {
        p25: 1.5,
        median: 5,
        p75: 10,
        unit: '%',
        source: 'Ekspercka estymacja — rozpiętość międzybranżowa (brak segmentu)',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      CURRENT_RATIO: {
        p25: 0.9,
        median: 1.4,
        p75: 2.0,
        unit: 'x',
        source: 'Ekspercka estymacja — rozpiętość międzybranżowa (brak segmentu)',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      QUICK_RATIO: {
        p25: 0.6,
        median: 1.1,
        p75: 1.7,
        unit: 'x',
        source: 'Ekspercka estymacja — rozpiętość międzybranżowa (brak segmentu)',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      DEBT_TO_EQUITY: {
        p25: 0.5,
        median: 1.2,
        p75: 2.2,
        unit: 'x',
        source: 'Ekspercka estymacja — rozpiętość międzybranżowa (brak segmentu)',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      INVENTORY_TURNOVER: {
        p25: 4,
        median: 10,
        p75: 25,
        unit: 'x',
        source: 'Ekspercka estymacja — rozpiętość międzybranżowa (brak segmentu)',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      DSO: {
        p25: 75,
        median: 45,
        p75: 20,
        unit: 'days',
        source: 'Ekspercka estymacja — rozpiętość międzybranżowa (brak segmentu)',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      DIO: {
        p25: 70,
        median: 35,
        p75: 10,
        unit: 'days',
        source: 'Ekspercka estymacja — rozpiętość międzybranżowa (brak segmentu)',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
      REVENUE_PER_EMPLOYEE: {
        p25: 250000,
        median: 450000,
        p75: 750000,
        unit: 'x',
        source: 'Ekspercka estymacja — rozpiętość międzybranżowa (brak segmentu)',
        asOf: `${YEAR}-01`,
        confidence: 'expert-estimate',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Industry resolver — free text → canonical class. Never throws.
// ---------------------------------------------------------------------------

/**
 * Resolve a free-text industry/segment string (PL or EN, any casing/phrasing)
 * to a canonical `BenchmarkIndustry`. Falls back to 'generic' when unknown —
 * mirrors `financeParameterGuidance.resolveIndustryClass` in spirit, kept as
 * a separate function because the two taxonomies are not 1:1.
 */
export function resolveBenchmarkIndustry(segment?: string | null): BenchmarkIndustry {
  const key = String(segment ?? '')
    .trim()
    .toLowerCase();
  if (!key) return 'generic';
  const has = (...needles: string[]): boolean => needles.some((n) => key.includes(n));

  if (has('saas', 'software', 'oprogram', 'aplikac', 'it ', 'tech startup', 'startup', 'platform'))
    return 'software-saas';
  if (
    has(
      'logistyk',
      'logistic',
      'transport',
      'spedycj',
      'spedyc',
      'shipping',
      'freight',
      'kurier',
      'courier',
      'magazyn',
      'warehous',
      'fleet',
      'flota'
    )
  )
    return 'logistics-transport';
  if (
    has(
      'budow',
      'construction',
      'deweloper',
      'developer',
      'general contractor',
      'wykonawstwo',
      'inżynier lądow',
      'civil engineering'
    )
  )
    return 'construction';
  if (
    has(
      'hotel',
      'hospitality',
      'gastronom',
      'restaurant',
      'restauracj',
      'catering',
      'horeca',
      'food service',
      'turystyk',
      'tourism'
    )
  )
    return 'hospitality-food-service';
  if (
    has(
      'health',
      'zdrowi',
      'medical',
      'medyczn',
      'clinic',
      'klinik',
      'szpital',
      'hospital',
      'pharma',
      'farmac',
      'ochrona zdrowia'
    )
  )
    return 'healthcare';
  if (
    has(
      'retail',
      'detal',
      'e-commerce',
      'ecommerce',
      'sklep',
      'shop',
      'handel',
      'wholesale',
      'hurt',
      'marketplace'
    )
  )
    return 'retail-ecommerce';
  if (
    has(
      'consult',
      'doradz',
      'services',
      'usług',
      'uslug',
      'law',
      'kancelar',
      'account',
      'księg',
      'ksieg',
      'agency',
      'agenc',
      'advisor',
      'professional'
    )
  )
    return 'professional-services';
  if (
    has(
      'manufactur',
      'produkc',
      'przemysł',
      'przemysl',
      'industrial',
      'machinery',
      'maszyn',
      'automotive',
      'component',
      'komponent',
      'factory',
      'fabryk',
      'chem',
      'pharma-mfg'
    )
  )
    return 'industrial-manufacturing';
  return 'generic';
}

/** Human label for a benchmark industry, PL/EN. */
export function getBenchmarkIndustryLabel(industry: BenchmarkIndustry): { pl: string; en: string } {
  return INDUSTRY_BENCHMARK_PROFILES[industry].label;
}

export function getAvailableBenchmarkIndustries(): BenchmarkIndustry[] {
  return Object.keys(INDUSTRY_BENCHMARK_PROFILES) as BenchmarkIndustry[];
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

export interface RatioBenchmarkResult {
  industry: BenchmarkIndustry;
  industryLabel: { pl: string; en: string };
  ratioCode: BenchmarkRatioCode;
  band: RatioBenchmarkBand;
  /** true when the resolved industry had no band for this ratio and the
   *  'generic' cross-industry band was used instead. */
  usedGenericFallback: boolean;
  /** O6.3 — {źródło, data, właściciel-odświeżania, poziom-pewności} for this dataset. */
  sourceMetadata: FinancialBenchmarkSourceMetadata;
}

/**
 * Look up the benchmark band for one ratio in one (free-text) industry.
 * Never throws: unknown industry or missing ratio band → 'generic' profile;
 * if 'generic' itself lacks the ratio, returns null (caller keeps its own
 * fallback, e.g. the universal warn/critical threshold).
 */
export function getRatioBenchmark(
  industrySegment: string | null | undefined,
  ratioCode: BenchmarkRatioCode
): RatioBenchmarkResult | null {
  const industry = resolveBenchmarkIndustry(industrySegment);
  const profile = INDUSTRY_BENCHMARK_PROFILES[industry];
  const direct = profile.ratios[ratioCode];
  if (direct) {
    return {
      industry,
      industryLabel: profile.label,
      ratioCode,
      band: direct,
      usedGenericFallback: false,
      sourceMetadata: buildSourceMetadata(direct),
    };
  }

  if (industry !== 'generic') {
    const genericBand = INDUSTRY_BENCHMARK_PROFILES.generic.ratios[ratioCode];
    if (genericBand) {
      return {
        industry: 'generic',
        industryLabel: INDUSTRY_BENCHMARK_PROFILES.generic.label,
        ratioCode,
        band: genericBand,
        usedGenericFallback: true,
        sourceMetadata: buildSourceMetadata(genericBand),
      };
    }
  }

  return null;
}

/** All benchmark bands available for one (free-text) industry. */
export function getIndustryBenchmarkBands(
  industrySegment?: string | null
): IndustryBenchmarkProfile {
  const industry = resolveBenchmarkIndustry(industrySegment);
  return INDUSTRY_BENCHMARK_PROFILES[industry];
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Position a value against the industry band and produce a bilingual
 * citation sentence, e.g.:
 *   "Twoja marża EBITDA 8% vs mediana branży produkcyjnej 11–14%."
 * This REPLACES the universal ±15%-style variance rule with a named,
 * sourced industry range (O6.2/O6.3).
 */
export function describeRatioAgainstBenchmark(params: {
  industrySegment?: string | null;
  ratioCode: BenchmarkRatioCode;
  ratioLabel: { pl: string; en: string };
  value: number;
  higherIsBetter?: boolean;
}): {
  position: 'below_p25' | 'p25_to_median' | 'median_to_p75' | 'above_p75';
  benchmark: RatioBenchmarkResult | null;
  sentence: { pl: string; en: string };
} {
  const { industrySegment, ratioCode, ratioLabel, value, higherIsBetter = true } = params;
  const benchmark = getRatioBenchmark(industrySegment, ratioCode);

  if (!benchmark) {
    return {
      position: 'median_to_p75',
      benchmark: null,
      sentence: {
        pl: `Brak zakresu branżowego dla „${ratioLabel.pl}" — brak dopasowanej branży lub wskaźnika w katalogu benchmarków.`,
        en: `No industry band available for "${ratioLabel.en}" — no matching industry or ratio in the benchmark catalog.`,
      },
    };
  }

  const { band, industryLabel, usedGenericFallback } = benchmark;
  const v = round1(value);
  const p25 = round1(band.p25);
  const median = round1(band.median);
  const p75 = round1(band.p75);
  const unitTxt = band.unit === 'x' ? 'x' : band.unit === 'days' ? ' dni' : '%';
  const unitTxtEn = band.unit === 'x' ? 'x' : band.unit === 'days' ? ' days' : '%';

  // Orientation: for "lower is better" ratios (e.g. DSO, DIO) p25 is the
  // WORSE (higher) tail conventionally listed first in the data above, so
  // "below p25" for those means "better than p25", not worse. We express
  // position purely numerically to stay correct regardless of direction.
  const lowBound = Math.min(p25, p75);
  const highBound = Math.max(p25, p75);

  let position: 'below_p25' | 'p25_to_median' | 'median_to_p75' | 'above_p75';
  if (v < lowBound) position = higherIsBetter ? 'below_p25' : 'above_p75';
  else if (v > highBound) position = higherIsBetter ? 'above_p75' : 'below_p25';
  else if (v < median) position = 'p25_to_median';
  else position = 'median_to_p75';

  const sourceNote = usedGenericFallback
    ? {
        pl: ' (branża niedopasowana — zakres ogólny międzybranżowy)',
        en: ' (industry not matched — generic cross-industry range)',
      }
    : { pl: '', en: '' };

  const estimateNote =
    band.confidence === 'expert-estimate'
      ? { pl: ' [estymacja ekspercka]', en: ' [expert estimate]' }
      : { pl: '', en: '' };

  const sentence = {
    pl: `Twoja ${ratioLabel.pl.toLowerCase()} ${v}${unitTxt} vs mediana branży ${industryLabel.pl.toLowerCase()} ${Math.min(p25, p75)}–${Math.max(p25, p75)}${unitTxt} (mediana ${median}${unitTxt}). Źródło: ${band.source}, aktualizacja ${band.asOf}${sourceNote.pl}${estimateNote.pl}.`,
    en: `Your ${ratioLabel.en.toLowerCase()} is ${v}${unitTxtEn} vs the ${industryLabel.en.toLowerCase()} industry median ${Math.min(p25, p75)}–${Math.max(p25, p75)}${unitTxtEn} (median ${median}${unitTxtEn}). Source: ${band.source}, updated ${band.asOf}${sourceNote.en}${estimateNote.en}.`,
  };

  return { position, benchmark, sentence };
}

/**
 * Build an `IndicatorFacts.benchmark` tuple ([low, high] = p25..p75, oriented
 * so low < high regardless of ratio direction) for `financeConclusionService`.
 * Returns null when no band is found — caller keeps its existing fallback.
 */
export function buildIndicatorBenchmarkRange(
  industrySegment: string | null | undefined,
  ratioCode: BenchmarkRatioCode
): [number, number] | null {
  const result = getRatioBenchmark(industrySegment, ratioCode);
  if (!result) return null;
  const { p25, p75 } = result.band;
  return p25 <= p75 ? [p25, p75] : [p75, p25];
}

// ---------------------------------------------------------------------------
// benchmarkFinancial(industry, ratio, value) — O6.2/O6.3 primary entry point
// ---------------------------------------------------------------------------

/** Where a value sits vs the industry band. 'not-available' when no band is found. */
export type FinancialBenchmarkVerdict = 'below-p25' | 'in-range' | 'above-p75' | 'not-available';

export interface FinancialBenchmarkPositionResult {
  industry: BenchmarkIndustry;
  industryLabel: { pl: string; en: string };
  ratioCode: BenchmarkRatioCode;
  value: number;
  band: RatioBenchmarkBand | null;
  verdict: FinancialBenchmarkVerdict;
  usedGenericFallback: boolean;
  interpretation: { pl: string; en: string };
  sourceMetadata: FinancialBenchmarkSourceMetadata | null;
}

/**
 * benchmarkFinancial(branża, wskaźnik, wartość) → pozycja + interpretacja.
 *
 * Thin, explicitly-named wrapper around `getRatioBenchmark` — does NOT
 * duplicate the benchmark data (single source of truth stays
 * `INDUSTRY_BENCHMARK_PROFILES`). Adds exactly the 3-way verdict vocabulary
 * (below-p25 / in-range / above-p75) plus a ready interpretation sentence
 * and the consolidated O6.3 source metadata, so callers do not need to
 * re-derive position logic themselves.
 */
export function benchmarkFinancial(params: {
  industrySegment?: string | null;
  ratioCode: BenchmarkRatioCode;
  value: number;
  /** Ratio direction. Most ratios are higher-is-better; DSO/DIO/leverage are not. Defaults true. */
  higherIsBetter?: boolean;
}): FinancialBenchmarkPositionResult {
  const { industrySegment, ratioCode, value, higherIsBetter = true } = params;
  const result = getRatioBenchmark(industrySegment, ratioCode);

  if (!result) {
    const industry = resolveBenchmarkIndustry(industrySegment);
    return {
      industry,
      industryLabel: getBenchmarkIndustryLabel(industry),
      ratioCode,
      value,
      band: null,
      verdict: 'not-available',
      usedGenericFallback: false,
      interpretation: {
        pl: 'Brak zakresu branżowego dla tego wskaźnika w katalogu benchmarków — brak dopasowanej branży lub wskaźnika.',
        en: 'No industry band available for this ratio in the benchmark catalog — no matching industry or ratio.',
      },
      sourceMetadata: null,
    };
  }

  const { band, industry, industryLabel, usedGenericFallback, sourceMetadata } = result;
  const lowBound = Math.min(band.p25, band.p75);
  const highBound = Math.max(band.p25, band.p75);

  // Pure NUMERIC position first — "below-p25" always means the value sits
  // under the numeric lower bound, "above-p75" always means it sits over the
  // numeric upper bound, regardless of ratio direction. Whether that numeric
  // position is good or bad news is a SEPARATE question, answered only in
  // the interpretation text below via `higherIsBetter`. (An earlier draft
  // flipped the verdict itself for lower-is-better ratios, which produced a
  // mislabelled "below-p25" for a numerically-above-bound value — fixed.)
  let verdict: FinancialBenchmarkVerdict;
  if (value < lowBound) verdict = 'below-p25';
  else if (value > highBound) verdict = 'above-p75';
  else verdict = 'in-range';

  const unitPl = band.unit === 'x' ? 'x' : band.unit === 'days' ? ' dni' : '%';
  const unitEn = band.unit === 'x' ? 'x' : band.unit === 'days' ? ' days' : '%';
  const v = round1(value);
  const rangeLow = round1(lowBound);
  const rangeHigh = round1(highBound);
  const median = round1(band.median);

  // isGood: below-p25 is good news only for a lower-is-better ratio;
  // above-p75 is good news only for a higher-is-better ratio; in-range is
  // always neutral/fine.
  const isGood =
    verdict === 'in-range' ? null : verdict === 'below-p25' ? !higherIsBetter : higherIsBetter;

  const verdictNotePl =
    verdict === 'in-range'
      ? 'w typowym zakresie branży (między dolnym a górnym kwartylem).'
      : verdict === 'below-p25'
        ? isGood
          ? 'poniżej dolnego kwartyla branży (dla tego wskaźnika niżej = lepiej) — sygnał mocnej pozycji.'
          : 'poniżej dolnego kwartyla branży — sygnał słabości względem porównywalnych firm.'
        : isGood
          ? 'powyżej górnego kwartyla branży — sygnał mocnej pozycji względem porównywalnych firm.'
          : 'powyżej górnego kwartyla branży (dla tego wskaźnika niżej = lepiej) — sygnał słabości, warto wyjaśnić przyczynę.';

  const verdictNoteEn =
    verdict === 'in-range'
      ? 'within the typical industry range (between the lower and upper quartile).'
      : verdict === 'below-p25'
        ? isGood
          ? 'below the industry lower quartile (lower is better for this ratio) — a strength signal.'
          : 'below the industry lower quartile — a weakness signal vs comparable companies.'
        : isGood
          ? 'above the industry upper quartile — a strength signal vs comparable companies.'
          : 'above the industry upper quartile (lower is better for this ratio) — a weakness signal worth explaining.';

  const fallbackNotePl = usedGenericFallback
    ? ' (branża niedopasowana — użyto zakresu ogólnego międzybranżowego)'
    : '';
  const fallbackNoteEn = usedGenericFallback
    ? ' (industry not matched — used the generic cross-industry range)'
    : '';

  return {
    industry,
    industryLabel,
    ratioCode,
    value,
    band,
    verdict,
    usedGenericFallback,
    interpretation: {
      pl: `${v}${unitPl} vs branża ${industryLabel.pl.toLowerCase()} ${rangeLow}–${rangeHigh}${unitPl} (mediana ${median}${unitPl})${fallbackNotePl}: ${verdictNotePl}`,
      en: `${v}${unitEn} vs ${industryLabel.en.toLowerCase()} industry ${rangeLow}–${rangeHigh}${unitEn} (median ${median}${unitEn})${fallbackNoteEn}: ${verdictNoteEn}`,
    },
    sourceMetadata,
  };
}

// ---------------------------------------------------------------------------
// O4 ↔ O6 taxonomy bridge
// ---------------------------------------------------------------------------

/**
 * Bridges O4's 7-class WACC/cost-of-capital taxonomy
 * (`financeParameterGuidance.FinanceIndustryClass`) onto this module's
 * 9-class ratio-benchmark taxonomy (`BenchmarkIndustry`), for a caller that
 * already resolved a `FinanceIndustryClass` (e.g. via `waccGuidance`) and
 * wants a matching ratio benchmark without re-resolving free text through a
 * second resolver. Static lookup table — does not re-implement either
 * resolver, and the two taxonomies deliberately stay separate (see module
 * doc): cost-of-capital bands and operating-ratio bands do not split
 * industries the same way (e.g. `infrastructure-utilities` has no direct
 * counterpart here — regulated utilities were not modelled separately in
 * the O6.2 ratio catalog, so it maps to `generic` rather than a false match).
 */
export function financeIndustryClassToBenchmarkIndustry(
  cls: FinanceIndustryClass
): BenchmarkIndustry {
  const map: Record<FinanceIndustryClass, BenchmarkIndustry> = {
    'discrete-manufacturing': 'industrial-manufacturing',
    'process-manufacturing': 'industrial-manufacturing',
    'professional-services': 'professional-services',
    'retail-trade': 'retail-ecommerce',
    'software-saas': 'software-saas',
    'infrastructure-utilities': 'generic',
    generic: 'generic',
  };
  return map[cls];
}
