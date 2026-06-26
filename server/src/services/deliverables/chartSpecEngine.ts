/**
 * chartSpecEngine (F11.1) — wykresy think-cell-grade, DATA-BOUND.
 *
 * Buduje znormalizowane SPECYFIKACJE wykresów (nie renderuje pikseli) dla
 * archetypów, których brakuje w zwykłych bibliotekach, a robią różnicę w decku
 * konsultanta: waterfall/bridge (mostek wartości), macierz 2×2 (priorytetyzacja),
 * status RAG. Spec → renderer (pptx/docx/web) rysuje wg liczb.
 *
 * Czyste funkcje, deterministyczne, nigdy nie rzucają.
 */

// ── Waterfall / bridge ───────────────────────────────────────────────────────
export type WaterfallKind = 'increase' | 'decrease' | 'total';

export interface WaterfallInput {
  label: string;
  value: number;
  /** Słupek absolutny od zera (start/koniec/subtotal), nie delta. */
  isTotal?: boolean;
}

export interface WaterfallBar {
  label: string;
  /** Dolna krawędź pływającego słupka. */
  start: number;
  /** Górna krawędź. */
  end: number;
  /** Wartość (delta lub absolut dla total). */
  value: number;
  kind: WaterfallKind;
}

export interface WaterfallSpec {
  type: 'waterfall';
  bars: WaterfallBar[];
  /** Zakres osi Y (min..max) — do skalowania. */
  domain: { min: number; max: number };
}

/**
 * Waterfall: delty kumulują się; pozycje pływających słupków policzone.
 * isTotal = słupek absolutny od zera (resetuje bieżącą sumę do swojej wartości).
 */
export function buildWaterfall(items: WaterfallInput[]): WaterfallSpec {
  let running = 0;
  let min = 0;
  let max = 0;
  const bars: WaterfallBar[] = items.map((it) => {
    let start: number;
    let end: number;
    let kind: WaterfallKind;
    if (it.isTotal) {
      start = 0;
      end = it.value;
      kind = 'total';
      running = it.value;
    } else {
      start = running;
      end = running + it.value;
      kind = it.value >= 0 ? 'increase' : 'decrease';
      running = end;
    }
    min = Math.min(min, start, end);
    max = Math.max(max, start, end);
    return { label: it.label, start: Math.min(start, end), end: Math.max(start, end), value: it.value, kind };
  });
  return { type: 'waterfall', bars, domain: { min, max } };
}

// ── Macierz 2×2 (priorytetyzacja) ────────────────────────────────────────────
export type Quadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4'; // TR, TL, BL, BR

export interface MatrixPointInput {
  label: string;
  x: number;
  y: number;
}

export interface MatrixPoint extends MatrixPointInput {
  quadrant: Quadrant;
}

export interface Matrix2x2Spec {
  type: 'matrix_2x2';
  points: MatrixPoint[];
  midpoints: { x: number; y: number };
  axisLabels: { x: string; y: string };
  quadrantLabels: Record<Quadrant, string>;
}

const DEFAULT_QUADRANT_LABELS: Record<Quadrant, string> = {
  Q1: 'Wysoki priorytet', // high/high (TR)
  Q2: 'Szybkie wygrane', // low-x/high-y (TL)
  Q3: 'Pomiń', // low/low (BL)
  Q4: 'Rozważ', // high-x/low-y (BR)
};

function quadrantOf(x: number, y: number, xMid: number, yMid: number): Quadrant {
  const right = x >= xMid;
  const top = y >= yMid;
  if (right && top) return 'Q1';
  if (!right && top) return 'Q2';
  if (!right && !top) return 'Q3';
  return 'Q4';
}

/**
 * Macierz 2×2: każdy punkt przypisany do ćwiartki względem środków osi.
 * Domyślnie midpoint = środek zakresu danych (auto), nadpisywalny.
 */
export function buildMatrix2x2(
  points: MatrixPointInput[],
  opts: {
    xMid?: number;
    yMid?: number;
    axisLabels?: { x: string; y: string };
    quadrantLabels?: Partial<Record<Quadrant, string>>;
  } = {}
): Matrix2x2Spec {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMid = opts.xMid ?? (points.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0);
  const yMid = opts.yMid ?? (points.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0);

  return {
    type: 'matrix_2x2',
    points: points.map((p) => ({ ...p, quadrant: quadrantOf(p.x, p.y, xMid, yMid) })),
    midpoints: { x: xMid, y: yMid },
    axisLabels: opts.axisLabels ?? { x: 'Wpływ', y: 'Wykonalność' },
    quadrantLabels: { ...DEFAULT_QUADRANT_LABELS, ...(opts.quadrantLabels ?? {}) },
  };
}

// ── Status RAG ───────────────────────────────────────────────────────────────
export type RagStatus = 'green' | 'amber' | 'red';

export interface RagInput {
  label: string;
  value: number;
}

export interface RagItem extends RagInput {
  status: RagStatus;
}

export interface RagSpec {
  type: 'rag';
  items: RagItem[];
  thresholds: { green: number; amber: number };
  lowerIsBetter: boolean;
}

/**
 * RAG: wartość ≥ green → zielony; ≥ amber → bursztynowy; inaczej → czerwony.
 * `lowerIsBetter` odwraca porównania (np. koszt, churn, opóźnienie).
 */
export function buildRag(
  items: RagInput[],
  thresholds: { green: number; amber: number },
  lowerIsBetter = false
): RagSpec {
  const classify = (v: number): RagStatus => {
    if (lowerIsBetter) {
      if (v <= thresholds.green) return 'green';
      if (v <= thresholds.amber) return 'amber';
      return 'red';
    }
    if (v >= thresholds.green) return 'green';
    if (v >= thresholds.amber) return 'amber';
    return 'red';
  };
  return {
    type: 'rag',
    items: items.map((it) => ({ ...it, status: classify(it.value) })),
    thresholds,
    lowerIsBetter,
  };
}
