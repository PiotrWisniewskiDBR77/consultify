/**
 * ENTERPRISE VALUE — KOSZYK METOD (Z113 · _KONCEPT_FINANCE §5)
 * ----------------------------------------------------------------------------
 * Kanon bankowości inwestycyjnej: wycena to TRIANGULACJA, nie jedna liczba.
 * Ten serwis NIE liczy DCF ani mnożników od zera — bierze WYNIKI istniejącego
 * `valuationService` (computeValuation → results.dcf / results.comps /
 * results.scenarioComparison / results.sensitivity) i syntetyzuje koszyk:
 *
 *   M1  DCF/FCFF                — z valuationService.computeDcf (zakres ze scenariuszy)
 *   M2  Mnożniki rynkowe (comps)— z valuationService.computeComps (trading comps)
 *   M3  Transakcje precedensowe — ten sam silnik mnożników + premia za kontrolę 20-40%
 *   M4  Metoda dochodowo/majątkowa (fallback, gdy brak peers dla M2/M3)
 *
 * Wyjście: { methods:[{label,low,mid,high}], intersection:{low,high},
 *            recommended, consistencyFlag, weights }.
 *
 * REGUŁY:
 *  - STREFA PRZECIĘCIA = część wspólna wszystkich zakresów = rekomendowany przedział.
 *  - REGUŁA SPÓJNOŚCI: jeśli którakolwiek para metod rozjeżdża się środkami (mid)
 *    powyżej progu (domyślnie 20%) → flaga „przejrzyj założenia" + wskazanie
 *    pary metod, która najbardziej się rozjeżdża (TOP-driver różnicy).
 *  - WAGI konfigurowalne (domyślnie równe wśród włączonych metod), normalizowane do 1.
 *
 * DETERMINIZM: 100% TS, zero LLM. Wszystkie progi/tolerancje jawne i parametryczne.
 * ADDITIVE: nie zmienia zachowania istniejących endpointów; woła computeValuation
 * jak czytelnik i dokłada tylko klucz `results.basket`.
 */

import { run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { computeValuation, type DcfResult, getValuation } from './valuationService.js';

// ── Typy ────────────────────────────────────────────────────────────────────

export type BasketMethodKey = 'M1' | 'M2' | 'M3' | 'M4';

/** Surowy zakres metody podany na wejściu syntezy (przed normalizacją wag). */
export interface MethodRange {
  key: BasketMethodKey;
  label: string;
  low: number;
  mid: number;
  high: number;
  /** Waga względna (przed normalizacją). Domyślnie 1 = równe wagi. */
  weight?: number;
  note?: string;
}

/** Metoda po syntezie: zakres + znormalizowana waga. */
export interface BasketMethod {
  key: BasketMethodKey;
  label: string;
  low: number;
  mid: number;
  high: number;
  /** Waga znormalizowana (suma wszystkich = 1). */
  weight: number;
  note?: string;
}

export interface ConsistencyFlag {
  triggered: boolean;
  thresholdPct: number;
  /** Największa rozbieżność środków (mid) między parą metod, w %. */
  maxDivergencePct: number;
  message: string;
  /** Para metod, która najbardziej się rozjeżdża — TOP-driver różnicy. */
  topDriver: {
    methods: [string, string];
    divergencePct: number;
    lowerLabel: string;
    higherLabel: string;
  } | null;
}

export interface BasketResult {
  methods: BasketMethod[];
  /** Strefa przecięcia zakresów = rekomendowany przedział; null gdy brak części wspólnej. */
  intersection: { low: number; high: number } | null;
  /** Rekomendacja: przecięcie gdy istnieje, inaczej ważona mieszanka zakresów. */
  recommended: { low: number; mid: number; high: number };
  consistencyFlag: ConsistencyFlag;
  /** Wagi znormalizowane per klucz metody. */
  weights: Record<string, number>;
}

export interface SynthesizeOptions {
  /** Nadpisania wag względnych per metoda (przed normalizacją). */
  weights?: Partial<Record<BasketMethodKey, number>>;
  /** Próg reguły spójności w % (domyślnie 20). */
  divergenceThresholdPct?: number;
}

const DEFAULT_DIVERGENCE_THRESHOLD_PCT = 20;
/** Premia za kontrolę dla transakcji precedensowych (M3): 20% dolna, 40% górna. */
const CONTROL_PREMIUM_LOW = 0.2;
const CONTROL_PREMIUM_MID = 0.3;
const CONTROL_PREMIUM_HIGH = 0.4;
/** Domyślne pasmo ± dla metody majątkowej/dochodowej z pojedynczą wartością. */
const ASSET_INCOME_BAND = 0.1;

// ── Narzędzia ─────────────────────────────────────────────────────────────

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

function isFiniteNum(n: any): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/** Normalizuje pojedynczy zakres: gwarantuje low<=high i sensowny mid. */
function normalizeRange(r: MethodRange): MethodRange | null {
  const low = Number(r.low);
  const high = Number(r.high);
  if (!isFiniteNum(low) || !isFiniteNum(high)) return null;
  const lo = Math.min(low, high);
  const hi = Math.max(low, high);
  let mid = Number(r.mid);
  if (!isFiniteNum(mid)) mid = (lo + hi) / 2;
  // mid poza zakresem → dociśnij do zakresu (spójność wizualna football-field)
  mid = Math.max(lo, Math.min(hi, mid));
  return { ...r, low: round(lo), mid: round(mid), high: round(hi) };
}

/**
 * Rozbieżność środków dwóch metod w %. Bazą jest mniejszy z |mid| (klasyczne
 * „rozjeżdżają się o X%"); gdy mniejszy = 0, bazą jest większy; gdy oba = 0 → 0.
 */
function divergencePct(midA: number, midB: number): number {
  const a = Math.abs(midA);
  const b = Math.abs(midB);
  const diff = Math.abs(midA - midB);
  const denom = Math.min(a, b) || Math.max(a, b) || 0;
  if (denom === 0) return 0;
  return (diff / denom) * 100;
}

// ── RDZEŃ: synteza koszyka ────────────────────────────────────────────────

/**
 * Syntetyzuje koszyk z listy zakresów metod. Funkcja CZYSTA (bez DB/LLM) —
 * serce testów fault-injection. Metody z niepełnymi danymi są odrzucane.
 */
export function synthesizeBasket(
  rawMethods: MethodRange[],
  opts: SynthesizeOptions = {}
): BasketResult {
  const threshold = isFiniteNum(opts.divergenceThresholdPct)
    ? Number(opts.divergenceThresholdPct)
    : DEFAULT_DIVERGENCE_THRESHOLD_PCT;

  const normalized = (Array.isArray(rawMethods) ? rawMethods : [])
    .map(normalizeRange)
    .filter((r): r is MethodRange => r != null);

  // Wagi względne: override z opts.weights[key] → r.weight → 1; potem normalizacja.
  const rawWeights = normalized.map((r) => {
    const override = opts.weights?.[r.key];
    if (isFiniteNum(override) && Number(override) >= 0) return Number(override);
    if (isFiniteNum(r.weight) && Number(r.weight) >= 0) return Number(r.weight);
    return 1;
  });
  const weightSum = rawWeights.reduce((a, b) => a + b, 0);

  const methods: BasketMethod[] = normalized.map((r, i) => ({
    key: r.key,
    label: r.label,
    low: r.low,
    mid: r.mid,
    high: r.high,
    weight: weightSum > 0 ? round(rawWeights[i] / weightSum, 4) : 0,
    ...(r.note ? { note: r.note } : {}),
  }));

  const weights: Record<string, number> = {};
  for (const m of methods) weights[m.key] = m.weight;

  // Strefa przecięcia = max(low) .. min(high).
  let intersection: { low: number; high: number } | null = null;
  if (methods.length > 0) {
    const intLow = Math.max(...methods.map((m) => m.low));
    const intHigh = Math.min(...methods.map((m) => m.high));
    if (intLow <= intHigh) intersection = { low: round(intLow), high: round(intHigh) };
  }

  // Reguła spójności: największa parowa rozbieżność środków.
  let maxDivergencePct = 0;
  let topDriver: ConsistencyFlag['topDriver'] = null;
  for (let i = 0; i < methods.length; i++) {
    for (let j = i + 1; j < methods.length; j++) {
      const a = methods[i];
      const b = methods[j];
      const d = divergencePct(a.mid, b.mid);
      if (d > maxDivergencePct) {
        maxDivergencePct = d;
        const lower = a.mid <= b.mid ? a : b;
        const higher = a.mid <= b.mid ? b : a;
        topDriver = {
          methods: [a.label, b.label],
          divergencePct: round(d, 1),
          lowerLabel: lower.label,
          higherLabel: higher.label,
        };
      }
    }
  }
  const triggered = methods.length >= 2 && maxDivergencePct > threshold;
  const consistencyFlag: ConsistencyFlag = {
    triggered,
    thresholdPct: threshold,
    maxDivergencePct: round(maxDivergencePct, 1),
    topDriver,
    message: triggered
      ? `Metody wyceny rozjeżdżają się o ${round(maxDivergencePct, 1)}% (próg ${threshold}%) — przejrzyj założenia.${
          topDriver
            ? ` Największa różnica: ${topDriver.methods[0]} vs ${topDriver.methods[1]}.`
            : ''
        }`
      : methods.length >= 2
        ? `Metody wyceny spójne w granicach progu ${threshold}% (max rozbieżność ${round(maxDivergencePct, 1)}%).`
        : methods.length === 1
          ? 'Tylko jedna metoda w koszyku — brak triangulacji; dodaj mnożniki lub metodę majątkową.'
          : 'Brak metod w koszyku.',
  };

  // Rekomendacja: przecięcie gdy istnieje; inaczej ważona mieszanka zakresów.
  let recommended: { low: number; mid: number; high: number };
  const weightedMid = methods.reduce((acc, m) => acc + m.mid * m.weight, 0);
  if (intersection) {
    const clampedMid = Math.max(intersection.low, Math.min(intersection.high, weightedMid));
    recommended = {
      low: intersection.low,
      mid: round(clampedMid),
      high: intersection.high,
    };
  } else if (methods.length > 0) {
    recommended = {
      low: round(methods.reduce((acc, m) => acc + m.low * m.weight, 0)),
      mid: round(weightedMid),
      high: round(methods.reduce((acc, m) => acc + m.high * m.weight, 0)),
    };
  } else {
    recommended = { low: 0, mid: 0, high: 0 };
  }

  return { methods, intersection, recommended, consistencyFlag, weights };
}

// ── ADAPTERY: budowa zakresów metod z wyników valuationService ──────────────

/** Wejście dla metody majątkowej/dochodowej (M4). */
export interface AssetIncomeInput {
  /** Skorygowane aktywa netto (podejście majątkowe). */
  adjustedNetAssets?: number;
  /** Znormalizowany zysk roczny (podejście dochodowe / kapitalizacja). */
  normalizedEarnings?: number;
  /** Stopa kapitalizacji w % (EV = zysk / (capRate/100)). */
  capitalizationRatePct?: number;
  /** Pasmo ± wokół pojedynczej wartości (domyślnie 0.1 = ±10%). */
  band?: number;
}

/**
 * M1 — zakres DCF. Preferuje scenariusze (Cons→Opt), potem siatkę wrażliwości,
 * a w ostateczności pojedynczy punkt EV (zakres zdegenerowany).
 */
export function dcfMethod(
  dcf: Partial<DcfResult> | null | undefined,
  scenarioComparison?: Array<{ scenario: string; dcf: Partial<DcfResult> }> | null,
  sensitivity?: { matrix?: Array<{ ev: number }> } | null,
  label = 'DCF / FCFF'
): MethodRange | null {
  const baseEv = Number(dcf?.enterpriseValue);
  if (!isFiniteNum(baseEv)) return null;

  // 1) Scenariusze — najlepszy zakres (rozrzut Base/Opt/Cons).
  const scenEvs = (Array.isArray(scenarioComparison) ? scenarioComparison : [])
    .map((s) => Number(s?.dcf?.enterpriseValue))
    .filter(isFiniteNum);
  if (scenEvs.length >= 2) {
    const evs = [...scenEvs, baseEv];
    return {
      key: 'M1',
      label,
      low: Math.min(...evs),
      mid: baseEv,
      high: Math.max(...evs),
      note: `Zakres z ${scenEvs.length} scenariuszy + baza`,
    };
  }

  // 2) Siatka wrażliwości (WACC×g / WACC×multiple) — zakres z macierzy.
  const sensEvs = (Array.isArray(sensitivity?.matrix) ? sensitivity!.matrix : [])
    .map((c) => Number(c?.ev))
    .filter(isFiniteNum);
  if (sensEvs.length >= 2) {
    return {
      key: 'M1',
      label,
      low: Math.min(...sensEvs),
      mid: baseEv,
      high: Math.max(...sensEvs),
      note: 'Zakres z siatki wrażliwości',
    };
  }

  // 3) Pojedynczy punkt — zakres zdegenerowany.
  return {
    key: 'M1',
    label,
    low: baseEv,
    mid: baseEv,
    high: baseEv,
    note: 'Punkt (brak scenariuszy)',
  };
}

/** Kształt comps zwracany przez valuationService.computeComps. */
export interface CompsShape {
  metric?: string;
  impliedEnterpriseValue?: { min?: number; median?: number; max?: number };
}

/** M2 — mnożniki rynkowe (trading comps). Null gdy brak peers / zerowa baza. */
export function multiplesMethod(
  comps: CompsShape | null | undefined,
  label?: string
): MethodRange | null {
  const iev = comps?.impliedEnterpriseValue;
  if (!iev) return null;
  const min = Number(iev.min);
  const median = Number(iev.median);
  const max = Number(iev.max);
  if (!isFiniteNum(min) || !isFiniteNum(max)) return null;
  // Zerowa baza (brak metryki spółki) → mnożniki bez treści.
  if (min === 0 && median === 0 && max === 0) return null;
  return {
    key: 'M2',
    label: label || `Mnożniki rynkowe${comps?.metric ? ` (${comps.metric})` : ''}`,
    low: min,
    mid: isFiniteNum(median) ? median : (min + max) / 2,
    high: max,
    note: 'Trading comps',
  };
}

/**
 * M3 — transakcje precedensowe = ten sam koszyk mnożników co M2 + premia za
 * kontrolę (20% dolna, 30% środek, 40% górna). Osobna etykieta na football-field.
 */
export function precedentMethod(
  comps: CompsShape | null | undefined,
  premium?: { low?: number; mid?: number; high?: number },
  label = 'Transakcje precedensowe'
): MethodRange | null {
  const m2 = multiplesMethod(comps, 'tmp');
  if (!m2) return null;
  const pLow = isFiniteNum(premium?.low) ? Number(premium!.low) : CONTROL_PREMIUM_LOW;
  const pMid = isFiniteNum(premium?.mid) ? Number(premium!.mid) : CONTROL_PREMIUM_MID;
  const pHigh = isFiniteNum(premium?.high) ? Number(premium!.high) : CONTROL_PREMIUM_HIGH;
  return {
    key: 'M3',
    label,
    low: round(m2.low * (1 + pLow)),
    mid: round(m2.mid * (1 + pMid)),
    high: round(m2.high * (1 + pHigh)),
    note: `Mnożniki + premia za kontrolę ${round(pLow * 100)}–${round(pHigh * 100)}%`,
  };
}

/**
 * M4 — metoda majątkowa/dochodowa (fallback dla MŚP bez peers). Łączy podejście
 * majątkowe (skorygowane aktywa netto) i dochodowe (kapitalizacja zysku); przy
 * jednej wartości stosuje pasmo ±band.
 */
export function assetIncomeMethod(
  input: AssetIncomeInput | null | undefined,
  label = 'Metoda majątkowo-dochodowa'
): MethodRange | null {
  if (!input) return null;
  const band = isFiniteNum(input.band) ? Number(input.band) : ASSET_INCOME_BAND;
  const values: number[] = [];

  const ana = Number(input.adjustedNetAssets);
  if (isFiniteNum(ana)) values.push(ana);

  const earnings = Number(input.normalizedEarnings);
  const capRate = Number(input.capitalizationRatePct);
  if (isFiniteNum(earnings) && isFiniteNum(capRate) && capRate > 0) {
    values.push(earnings / (capRate / 100));
  }

  if (values.length === 0) return null;

  if (values.length === 1) {
    const v = values[0];
    return {
      key: 'M4',
      label,
      low: round(v * (1 - band)),
      mid: round(v),
      high: round(v * (1 + band)),
      note: `Pojedyncza wartość ±${round(band * 100)}%`,
    };
  }

  const low = Math.min(...values);
  const high = Math.max(...values);
  return {
    key: 'M4',
    label,
    low: round(low),
    mid: round((low + high) / 2),
    high: round(high),
    note: 'Majątkowa + dochodowa',
  };
}

/** Konfiguracja koszyka (opcjonalna, additive; czytana z assumptions.basket). */
export interface BasketConfig {
  weights?: Partial<Record<BasketMethodKey, number>>;
  divergenceThresholdPct?: number;
  /** Włącz M3 transakcje precedensowe (wymaga peers). Domyślnie true gdy są comps. */
  includePrecedent?: boolean;
  controlPremium?: { low?: number; mid?: number; high?: number };
  /** Wejście M4 — używane jako FALLBACK gdy brak peers (M2/M3). */
  assetIncome?: AssetIncomeInput;
  /** Wymuś M4 nawet gdy są peers (triangulacja szersza). Domyślnie false. */
  alwaysIncludeAssetIncome?: boolean;
}

/** Kształt `results` z valuationService.computeValuation (podzbiór używany tutaj). */
export interface ValuationResultsShape {
  dcf?: Partial<DcfResult> | null;
  comps?: CompsShape | null;
  scenarioComparison?: Array<{ scenario: string; dcf: Partial<DcfResult> }> | null;
  sensitivity?: { matrix?: Array<{ ev: number }> } | null;
}

/**
 * Buduje koszyk z gotowych `results` valuationService. Reguła fallbacku M4:
 * gdy brak peers (M2 nieobecne) → włącz M4 z config.assetIncome (jeśli podano).
 */
export function buildBasketFromResults(
  results: ValuationResultsShape | null | undefined,
  config: BasketConfig = {}
): BasketResult {
  const methods: MethodRange[] = [];

  const m1 = dcfMethod(results?.dcf, results?.scenarioComparison, results?.sensitivity);
  if (m1) methods.push(m1);

  const m2 = multiplesMethod(results?.comps);
  if (m2) {
    methods.push(m2);
    const includePrecedent = config.includePrecedent !== false; // domyślnie true gdy są comps
    if (includePrecedent) {
      const m3 = precedentMethod(results?.comps, config.controlPremium);
      if (m3) methods.push(m3);
    }
  }

  // M4: fallback gdy brak peers, lub wymuszony gdy alwaysIncludeAssetIncome.
  const noPeers = !m2;
  if (config.assetIncome && (noPeers || config.alwaysIncludeAssetIncome)) {
    const m4 = assetIncomeMethod(config.assetIncome);
    if (m4) methods.push(m4);
  }

  return synthesizeBasket(methods, {
    weights: config.weights,
    divergenceThresholdPct: config.divergenceThresholdPct,
  });
}

// ── ORKIESTRACJA DB (thin, additive) ────────────────────────────────────────

function safeJsonParse<T>(raw: any, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Liczy koszyk EV dla wyceny i dokłada `results.basket` (additive — nie rusza
 * istniejących kluczy results ani zachowania computeValuation). Config czytany
 * z assumptions.basket (opcjonalne pola). Zwraca BasketResult.
 */
export async function computeValuationBasket(
  orgId: string,
  valuationId: string,
  configOverride?: BasketConfig
): Promise<BasketResult> {
  const val = await getValuation(orgId, valuationId);
  if (!val) throw new Error('Valuation not found');

  const assumptions = safeJsonParse<any>(val.assumptions, {});
  const config: BasketConfig = {
    ...(assumptions?.basket && typeof assumptions.basket === 'object' ? assumptions.basket : {}),
    ...(configOverride || {}),
  };

  // Reużyj policzonych wyników; policz gdy brak DCF.
  let results = safeJsonParse<ValuationResultsShape & Record<string, any>>(val.results, {});
  if (!results?.dcf || results?.dcf?.enterpriseValue == null) {
    results = (await computeValuation(orgId, valuationId)) as any;
  }

  const basket = buildBasketFromResults(results, config);

  try {
    const merged = { ...(results || {}), basket };
    await dbRun(
      `UPDATE valuations SET results = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
      [JSON.stringify(merged), valuationId, orgId]
    );
  } catch (e) {
    // Persist jest wygodą, nie warunkiem poprawności — nie wywracaj obliczenia.
    logger.warn('[ValuationBasket] Persist basket failed (non-fatal)', e as any);
  }

  return basket;
}
