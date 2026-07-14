/**
 * financeParameterGuidance — O4.5 Guidance parametrów (WACC / stopy per branża)
 * ============================================================================
 * WHY THIS EXISTS (the gap this closes)
 * -------------------------------------
 * Every finance primitive that discounts (businessCaseGeneratorService,
 * economicsFinancials, capitalDecisionService.hurdleRate, contextPackBuilder
 * DCF) takes a WACC / discount rate as a *caller-supplied* number and, when
 * the caller has none, silently falls back to a HARDCODED default (10%). A
 * flat 10% is wrong for almost every real company: a stable process-industry
 * balance sheet does not carry the same cost of capital as an early-stage
 * professional-services boutique. A partner would never sign an NPV whose
 * discount rate was a magic constant.
 *
 * This layer replaces the sztywny default with a *branżowy zakres* (band):
 * given an industry segment (free-text, aliased) and a size band it returns a
 * WACC range (low / mid / high, in percentage POINTS to match
 * capitalDecisionService conventions), the reasoning behind the band, and an
 * honest confidence + disclaimer. It NEVER pretends the band is a statistical
 * benchmark — the values are an expert hypothesis (PL/CEE market, 2026),
 * calibratable later, exactly like `drdIndustryProfiles`.
 *
 * It also grades a caller-supplied rate against the band (in-band / below /
 * above) so a reviewer can flag "12% WACC assumed for a boutique agency —
 * below the 14–20% expected band, NPV likely overstated".
 *
 * Pure functions only. No I/O, no LLM. Numbers are the SoT here (K1 inputs);
 * the narrative wrapper (financeConclusionService) interprets them (K2+).
 */

export type FinanceLanguage = 'pl' | 'en';

/**
 * Canonical finance-industry classes. Deliberately aligned in spirit with
 * `src/services/assessmentKnowledge/drdIndustryProfiles.ts` (discrete /
 * process manufacturing, professional services) and extended with the classes
 * the cost of capital most differs across.
 */
export type FinanceIndustryClass =
  | 'discrete-manufacturing'
  | 'process-manufacturing'
  | 'professional-services'
  | 'retail-trade'
  | 'software-saas'
  | 'infrastructure-utilities'
  | 'generic';

/** Size band — smaller/earlier companies carry a higher cost of capital. */
export type SizeBand = 'micro' | 'small' | 'medium' | 'large';

/** A rate band in percentage POINTS (e.g. 12 = 12%). low ≤ mid ≤ high. */
export interface RateBand {
  low: number;
  mid: number;
  high: number;
}

export const PARAMETER_GUIDANCE_SOURCE = 'expert-hypothesis-v1' as const;

export interface IndustryParameterProfile {
  industry: FinanceIndustryClass;
  label: { pl: string; en: string };
  /** WACC band for a MEDIUM-sized company (the anchor); pp. */
  waccBand: RateBand;
  /** Terminal / perpetuity growth band used in DCF; pp. */
  terminalGrowthBand: RateBand;
  /** 2–3 sentences: WHY this industry's cost of capital sits where it does. */
  rationale: { pl: string; en: string };
}

/** Shared disclaimer — mirrors drdIndustryProfiles §8.1/§8.2. */
export const PARAMETER_GUIDANCE_DISCLAIMER = {
  pl: 'Zakresy eksperckie DBR77 (hipoteza, wersja v1) — nie są benchmarkiem statystycznym. Wartości podlegają kalibracji danymi rynku/transakcji. Traktuj jako punkt startowy do dyskusji z zarządem, nie jako gotowy input do modelu bez weryfikacji.',
  en: 'DBR77 expert bands (hypothesis, version v1) — not a statistical benchmark. Values are subject to calibration with market/transaction data. Treat as a starting point for a board discussion, not a ready model input without verification.',
} as const;

/**
 * Canonical library. Bands are anchored on a MEDIUM company; size adjustment
 * (below) shifts the whole band. Chosen to reflect the CEE/PL 2026 reality:
 * process industry & utilities = low cost of capital (stable, asset-backed);
 * SaaS & professional-services boutiques = high (intangible, key-person risk).
 */
export const INDUSTRY_PARAMETER_PROFILES: IndustryParameterProfile[] = [
  {
    industry: 'discrete-manufacturing',
    label: { pl: 'Produkcja dyskretna', en: 'Discrete manufacturing' },
    waccBand: { low: 9, mid: 11, high: 14 },
    terminalGrowthBand: { low: 1, mid: 2, high: 3 },
    rationale: {
      pl: 'Tangible aktywa (maszyny, zapasy) dają zabezpieczenie długu i obniżają koszt kapitału, ale cykliczność popytu OEM i ekspozycja na koszty surowców podnoszą premię za ryzyko względem przemysłu procesowego.',
      en: 'Tangible assets (machinery, inventory) collateralise debt and lower the cost of capital, but OEM demand cyclicality and raw-material cost exposure lift the risk premium above process industry.',
    },
  },
  {
    industry: 'process-manufacturing',
    label: { pl: 'Produkcja procesowa', en: 'Process manufacturing' },
    waccBand: { low: 8, mid: 10, high: 12 },
    terminalGrowthBand: { low: 1, mid: 2, high: 3 },
    rationale: {
      pl: 'Instalacje ciągłe, kontrakty wolumenowe i stabilne przepływy pozwalają na wyższy udział taniego długu — najniższy koszt kapitału wśród segmentów przemysłowych; ryzyko regulacyjne (Seveso, ETS) trzyma górną granicę.',
      en: 'Continuous installations, volume contracts and stable cash flows allow a higher share of cheap debt — the lowest cost of capital among industrial segments; regulatory risk (Seveso, ETS) holds the upper bound.',
    },
  },
  {
    industry: 'professional-services',
    label: { pl: 'Usługi profesjonalne', en: 'Professional services' },
    waccBand: { low: 12, mid: 15, high: 19 },
    terminalGrowthBand: { low: 2, mid: 3, high: 4 },
    rationale: {
      pl: 'Aktywa niematerialne i ryzyko kluczowych osób ograniczają zdolność do taniego długu; wartość firmy „wychodzi wieczorem drzwiami", stąd wysoki koszt kapitału mimo lekkiej struktury bilansu.',
      en: 'Intangible assets and key-person risk limit access to cheap debt; enterprise value "walks out the door each evening", hence a high cost of capital despite a light balance sheet.',
    },
  },
  {
    industry: 'retail-trade',
    label: { pl: 'Handel detaliczny', en: 'Retail & trade' },
    waccBand: { low: 10, mid: 13, high: 16 },
    terminalGrowthBand: { low: 1, mid: 2, high: 3 },
    rationale: {
      pl: 'Cienkie marże i wrażliwość na popyt konsumencki podnoszą premię za ryzyko; zapasy i nieruchomości handlowe dają częściowe zabezpieczenie, które trzyma dolną granicę.',
      en: 'Thin margins and consumer-demand sensitivity raise the risk premium; inventory and retail real estate give partial collateral that holds the lower bound.',
    },
  },
  {
    industry: 'software-saas',
    label: { pl: 'Oprogramowanie / SaaS', en: 'Software / SaaS' },
    waccBand: { low: 13, mid: 17, high: 22 },
    terminalGrowthBand: { low: 2, mid: 4, high: 6 },
    rationale: {
      pl: 'Wysoka niepewność wzrostu i niemal zerowe aktywa trwałe do zabezpieczenia długu dają najwyższy koszt kapitału; w zamian najwyższy dopuszczalny wzrost terminalny (skalowalność).',
      en: 'High growth uncertainty and near-zero fixed assets to collateralise debt yield the highest cost of capital; in exchange, the highest allowable terminal growth (scalability).',
    },
  },
  {
    industry: 'infrastructure-utilities',
    label: { pl: 'Infrastruktura / utilities', en: 'Infrastructure / utilities' },
    waccBand: { low: 6, mid: 8, high: 10 },
    terminalGrowthBand: { low: 1, mid: 2, high: 2 },
    rationale: {
      pl: 'Regulowane, przewidywalne przepływy i wysokie aktywa trwałe pozwalają na dominację taniego długu — najniższy koszt kapitału w całym zestawie; niski wzrost terminalny (rynek dojrzały).',
      en: 'Regulated, predictable cash flows and high fixed assets allow cheap debt to dominate — the lowest cost of capital in the set; low terminal growth (mature market).',
    },
  },
  {
    industry: 'generic',
    label: { pl: 'Ogólny (segment nieokreślony)', en: 'Generic (unspecified segment)' },
    waccBand: { low: 9, mid: 12, high: 16 },
    terminalGrowthBand: { low: 1, mid: 2, high: 3 },
    rationale: {
      pl: 'Zakres domyślny dla nieokreślonego segmentu — szeroki, świadomie mniej pewny. Zastąp konkretną branżą, gdy segment jest znany; wskaż to jawnie w założeniach modelu.',
      en: 'Default band for an unspecified segment — wide and deliberately less certain. Replace with a concrete industry once the segment is known; flag this explicitly in the model assumptions.',
    },
  },
];

/** Size adjustment applied to WACC band, in percentage points. */
const SIZE_WACC_ADJUST_PP: Record<SizeBand, number> = {
  micro: 4,
  small: 2,
  medium: 0,
  large: -1.5,
};

/**
 * Resolve a free-text industry segment (any language / phrasing) to a
 * canonical class. Falls back to 'generic' — never throws.
 */
export function resolveIndustryClass(segment?: string | null): FinanceIndustryClass {
  const key = String(segment ?? '')
    .trim()
    .toLowerCase();
  if (!key) return 'generic';
  const has = (...needles: string[]): boolean => needles.some((n) => key.includes(n));

  if (has('saas', 'software', 'oprogram', 'aplikac', 'app', 'tech startup', 'startup'))
    return 'software-saas';
  if (has('util', 'infrastr', 'energy', 'energet', 'water', 'wod', 'grid', 'power'))
    return 'infrastructure-utilities';
  if (
    has(
      'process manufactur',
      'produkcja procesow',
      'chem',
      'pharma',
      'farmac',
      'food',
      'spożyw',
      'spozyw',
      'refin'
    )
  )
    return 'process-manufacturing';
  if (
    has(
      'discrete',
      'dyskretn',
      'machinery',
      'maszyn',
      'automotive',
      'component',
      'komponent',
      'manufactur',
      'produkc',
      'przemysł',
      'przemysl'
    )
  )
    return 'discrete-manufacturing';
  if (
    has(
      'retail',
      'detal',
      'trade',
      'handel',
      'e-commerce',
      'ecommerce',
      'sklep',
      'shop',
      'wholesale',
      'hurt'
    )
  )
    return 'retail-trade';
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
  return 'generic';
}

/** Look up a profile by canonical class (never throws — 'generic' fallback). */
export function getIndustryParameterProfile(
  industry: FinanceIndustryClass
): IndustryParameterProfile {
  return (
    INDUSTRY_PARAMETER_PROFILES.find((p) => p.industry === industry) ??
    INDUSTRY_PARAMETER_PROFILES.find((p) => p.industry === 'generic')!
  );
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Shift a rate band by a delta (pp), clamped so it never goes negative and
 * low ≤ mid ≤ high is preserved.
 */
function shiftBand(band: RateBand, deltaPp: number): RateBand {
  const low = Math.max(0, round1(band.low + deltaPp));
  const mid = Math.max(low, round1(band.mid + deltaPp));
  const high = Math.max(mid, round1(band.high + deltaPp));
  return { low, mid, high };
}

export type GradeVerdict = 'below-band' | 'in-band' | 'above-band';

export interface RateGrade {
  verdict: GradeVerdict;
  /** Distance to the nearest band edge in pp (0 when in-band). */
  distancePp: number;
  /** Direction-aware note: what an out-of-band rate implies for the model. */
  note: { pl: string; en: string };
}

export interface WaccGuidance {
  industry: FinanceIndustryClass;
  label: { pl: string; en: string };
  sizeBand: SizeBand;
  /** Size-adjusted WACC band, pp. Use `mid` as the default if none supplied. */
  waccBand: RateBand;
  /** Recommended default when the caller has no WACC of its own. */
  recommendedWaccPct: number;
  terminalGrowthBand: RateBand;
  rationale: { pl: string; en: string };
  /** Honest provenance — this is a hypothesis band, not a benchmark. */
  confidence: 'expert-hypothesis';
  disclaimer: { pl: string; en: string };
  source: typeof PARAMETER_GUIDANCE_SOURCE;
}

/**
 * Produce WACC / rate guidance for an org. This is the primary O4.5 entry:
 * replaces the hardcoded discount-rate default with a branżowy zakres.
 */
export function waccGuidance(params: {
  industrySegment?: string | null;
  sizeBand?: SizeBand;
}): WaccGuidance {
  const industry = resolveIndustryClass(params.industrySegment);
  const profile = getIndustryParameterProfile(industry);
  const size: SizeBand = params.sizeBand ?? 'medium';
  const waccBand = shiftBand(profile.waccBand, SIZE_WACC_ADJUST_PP[size]);

  return {
    industry,
    label: profile.label,
    sizeBand: size,
    waccBand,
    recommendedWaccPct: waccBand.mid,
    terminalGrowthBand: profile.terminalGrowthBand,
    rationale: profile.rationale,
    confidence: 'expert-hypothesis',
    disclaimer: PARAMETER_GUIDANCE_DISCLAIMER,
    source: PARAMETER_GUIDANCE_SOURCE,
  };
}

/**
 * Grade a caller-supplied WACC against the guidance band. Lets a reviewer flag
 * "assumed rate below the expected band → NPV likely overstated" without
 * re-deriving anything. Numbers only from the band + the supplied rate.
 */
export function gradeWacc(suppliedWaccPct: number, band: RateBand): RateGrade {
  const rate = Number.isFinite(suppliedWaccPct) ? suppliedWaccPct : 0;
  if (rate < band.low) {
    const distancePp = round1(band.low - rate);
    return {
      verdict: 'below-band',
      distancePp,
      note: {
        pl: `Założona WACC ${round1(rate)}% jest poniżej zakresu branżowego (${band.low}–${band.high}%). Zbyt niska stopa zawyża NPV — zweryfikuj strukturę kapitału i premię za ryzyko.`,
        en: `Assumed WACC ${round1(rate)}% is below the industry band (${band.low}–${band.high}%). Too low a rate overstates NPV — verify the capital structure and risk premium.`,
      },
    };
  }
  if (rate > band.high) {
    const distancePp = round1(rate - band.high);
    return {
      verdict: 'above-band',
      distancePp,
      note: {
        pl: `Założona WACC ${round1(rate)}% jest powyżej zakresu branżowego (${band.low}–${band.high}%). Zbyt wysoka stopa zaniża NPV i może odrzucić dobre projekty — uzasadnij premię lub urealnij.`,
        en: `Assumed WACC ${round1(rate)}% is above the industry band (${band.low}–${band.high}%). Too high a rate understates NPV and may reject good projects — justify the premium or bring it back to reality.`,
      },
    };
  }
  return {
    verdict: 'in-band',
    distancePp: 0,
    note: {
      pl: `Założona WACC ${round1(rate)}% mieści się w zakresie branżowym (${band.low}–${band.high}%).`,
      en: `Assumed WACC ${round1(rate)}% is within the industry band (${band.low}–${band.high}%).`,
    },
  };
}
