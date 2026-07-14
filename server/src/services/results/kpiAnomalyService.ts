/**
 * kpiAnomalyService — czyste wykrywanie anomalii w szeregu pomiarów KPI.
 *
 * Brak zależności od bazy/IO. Brak argless `new Date()` / `Date.now()`.
 * Działa na szeregu liczb (kolejność = oś czasu) i pozwala:
 *  - wykryć punkty odstające metodą z-score (|z| > threshold),
 *  - wykryć outliery metodą IQR (poza [Q1−k·IQR, Q3+k·IQR]),
 *  - połączyć obie metody w jeden deterministyczny raport anomalii z severity.
 *
 * Wszystkie funkcje są czyste i deterministyczne. Wejściowe wartości NaN/Infinity
 * są odfiltrowywane (z zachowaniem oryginalnych indeksów szeregu).
 */

export type AnomalyMethod = 'z-score' | 'iqr' | 'both';

export type AnomalySeverity = 'mild' | 'severe';

export interface KpiDataPoint {
  periodIso?: string;
  value: number;
}

export interface ZScoreAnomaly {
  index: number;
  value: number;
  z: number;
}

export interface IqrAnomaly {
  index: number;
  value: number;
  bound: 'low' | 'high';
}

export interface DetectedAnomaly {
  index: number;
  value: number;
  method: AnomalyMethod;
  severity: AnomalySeverity;
}

export interface DetectAnomaliesOptions {
  /** Próg z-score (domyślnie 2). Punkt anomalny gdy |z| > zThreshold. */
  zThreshold?: number;
  /** Mnożnik IQR (domyślnie 1.5). Outlier poza [Q1−k·IQR, Q3+k·IQR]. */
  iqrK?: number;
  /** Próg |z| dla severity 'severe' (domyślnie 3). */
  severeZThreshold?: number;
}

export interface DetectAnomaliesResult {
  anomalies: DetectedAnomaly[];
  summary: {
    count: number;
    hasAnomalies: boolean;
    method: 'z-score+iqr';
  };
}

interface CleanValue {
  /** Indeks w oryginalnym szeregu wejściowym. */
  index: number;
  value: number;
}

const DEFAULT_Z_THRESHOLD = 2;
const DEFAULT_IQR_K = 1.5;
const DEFAULT_SEVERE_Z = 3;

/**
 * Zachowuje tylko skończone wartości liczbowe, pamiętając ich oryginalny indeks
 * w szeregu (anomalie raportujemy względem pozycji w pełnym wejściu).
 */
function cleanValues(values: number[] | null | undefined): CleanValue[] {
  if (!Array.isArray(values)) return [];
  const out: CleanValue[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out.push({ index: i, value: v });
    }
  }
  return out;
}

/**
 * Kwantyl metodą interpolacji liniowej (typ R-7, jak Excel PERCENTILE.INC).
 * `sorted` musi być posortowane rosnąco. `q` w [0,1].
 */
function quantileSorted(sorted: number[], q: number): number {
  const n = sorted.length;
  if (n === 0) return Number.NaN;
  if (n === 1) return sorted[0];
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const frac = pos - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

/**
 * Wykrywa punkty odstające metodą z-score: z = (x − mean) / stddev (populacyjne).
 * Anomalia gdy |z| > threshold.
 *
 * Krańce:
 *  - szereg < 2 punktów → pusta lista (brak określonego rozrzutu),
 *  - stddev = 0 (wszystkie wartości równe) → pusta lista (brak anomalii),
 *  - wartości NaN/Infinity są odfiltrowane.
 *
 * Indeksy w wyniku odnoszą się do oryginalnego szeregu wejściowego.
 */
export function zScoreAnomalies(
  values: number[],
  threshold: number = DEFAULT_Z_THRESHOLD
): ZScoreAnomaly[] {
  const clean = cleanValues(values);
  const n = clean.length;
  if (n < 2) return [];

  const mean = clean.reduce((acc, p) => acc + p.value, 0) / n;
  const variance = clean.reduce((acc, p) => acc + (p.value - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);

  // Wszystkie wartości równe → brak rozrzutu → brak anomalii.
  if (stddev === 0) return [];

  const out: ZScoreAnomaly[] = [];
  for (const p of clean) {
    const z = (p.value - mean) / stddev;
    if (Math.abs(z) > threshold) {
      out.push({ index: p.index, value: p.value, z });
    }
  }
  return out;
}

/**
 * Wykrywa outliery metodą IQR: poza [Q1 − k·IQR, Q3 + k·IQR].
 * Kwartyle liczone metodą interpolacji liniowej (R-7).
 *
 * Krańce:
 *  - szereg < 2 punktów → pusta lista,
 *  - IQR = 0 (rozkład bez rozrzutu międzykwartylowego) → pusta lista,
 *  - wartości NaN/Infinity są odfiltrowane.
 *
 * Indeksy w wyniku odnoszą się do oryginalnego szeregu wejściowego.
 */
export function iqrAnomalies(values: number[], k: number = DEFAULT_IQR_K): IqrAnomaly[] {
  const clean = cleanValues(values);
  if (clean.length < 2) return [];

  const sorted = clean
    .map((p) => p.value)
    .slice()
    .sort((a, b) => a - b);
  const q1 = quantileSorted(sorted, 0.25);
  const q3 = quantileSorted(sorted, 0.75);
  const iqr = q3 - q1;

  // Brak rozrzutu międzykwartylowego → brak outlierów.
  if (iqr === 0) return [];

  const lowBound = q1 - k * iqr;
  const highBound = q3 + k * iqr;

  const out: IqrAnomaly[] = [];
  for (const p of clean) {
    if (p.value < lowBound) {
      out.push({ index: p.index, value: p.value, bound: 'low' });
    } else if (p.value > highBound) {
      out.push({ index: p.index, value: p.value, bound: 'high' });
    }
  }
  return out;
}

/**
 * Łączy obie metody w jeden raport. Punkt jest anomalny, gdy wykryje go
 * z-score LUB IQR. `method` opisuje, która metoda (lub obie) go wskazała.
 *
 * Severity:
 *  - 'severe' gdy |z| >= severeZThreshold (domyślnie 3) lub gdy obie metody
 *    zgodnie wskazały punkt,
 *  - w innym wypadku 'mild'.
 *
 * Wynik posortowany rosnąco po indeksie (deterministyczny).
 */
export function detectAnomalies(
  values: number[],
  opts?: DetectAnomaliesOptions
): DetectAnomaliesResult {
  const zThreshold = opts?.zThreshold ?? DEFAULT_Z_THRESHOLD;
  const iqrK = opts?.iqrK ?? DEFAULT_IQR_K;
  const severeZ = opts?.severeZThreshold ?? DEFAULT_SEVERE_Z;

  const zHits = zScoreAnomalies(values, zThreshold);
  const iqrHits = iqrAnomalies(values, iqrK);

  const zByIndex = new Map<number, ZScoreAnomaly>();
  for (const z of zHits) zByIndex.set(z.index, z);
  const iqrByIndex = new Map<number, IqrAnomaly>();
  for (const i of iqrHits) iqrByIndex.set(i.index, i);

  const indices = new Set<number>();
  for (const z of zHits) indices.add(z.index);
  for (const i of iqrHits) indices.add(i.index);

  const anomalies: DetectedAnomaly[] = [];
  for (const index of Array.from(indices).sort((a, b) => a - b)) {
    const z = zByIndex.get(index);
    const iqr = iqrByIndex.get(index);

    let method: AnomalyMethod;
    if (z && iqr) method = 'both';
    else if (z) method = 'z-score';
    else method = 'iqr';

    const bothAgree = !!z && !!iqr;
    const zSevere = !!z && Math.abs(z.z) >= severeZ;
    const severity: AnomalySeverity = bothAgree || zSevere ? 'severe' : 'mild';

    // value pochodzi z którejkolwiek metody, która wskazała ten indeks.
    const value = z ? z.value : (iqr as IqrAnomaly).value;

    anomalies.push({ index, value, method, severity });
  }

  return {
    anomalies,
    summary: {
      count: anomalies.length,
      hasAnomalies: anomalies.length > 0,
      method: 'z-score+iqr',
    },
  };
}

export default {
  zScoreAnomalies,
  iqrAnomalies,
  detectAnomalies,
};
