/**
 * deckChartAdapter (P2.3) — DATA-BOUND chart specs for the FE deck renderer.
 *
 * Turns a deck `chart` block's loose `content` (authored by the deck pipeline /
 * fixtures) into a NORMALIZED, discriminated spec the {@link ChartBlock}
 * renderer draws with recharts. This is the FE twin of the server's
 * chart engines — the pure math is ported (NOT re-invented) from:
 *   • server/src/services/deliverables/chartSpecEngine.ts  (waterfall / 2×2 / RAG)
 *   • server/src/services/deliverables/advancedCharts.ts   (marimekko / harvey)
 * Server modules are `.js`-ESM and browser-hostile to import directly, so the
 * (small, deterministic) math lives here too; keep the two in lockstep.
 *
 * HARD RULE — fail-open: any block whose data cannot form a real chart resolves
 * to `null`. The renderer then draws NOTHING (no placeholder balast, no crash).
 * Every function is pure and never throws.
 */

// ── Public spec union ────────────────────────────────────────────────────────

export type CartesianKind = 'bar' | 'line' | 'area';
export type PieKind = 'pie' | 'donut';

export interface CartesianSpec {
  type: CartesianKind;
  title?: string;
  categories: string[];
  series: { label: string; values: number[] }[];
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export interface PieSpec {
  type: PieKind;
  title?: string;
  slices: { name: string; value: number }[];
}

export interface WaterfallBar {
  label: string;
  start: number;
  end: number;
  value: number;
  kind: 'increase' | 'decrease' | 'total';
}
export interface WaterfallSpec {
  type: 'waterfall';
  title?: string;
  bars: WaterfallBar[];
  domain: { min: number; max: number };
}

export type Quadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export interface MatrixPoint {
  label: string;
  x: number;
  y: number;
  quadrant: Quadrant;
}
export interface Matrix2x2Spec {
  type: 'matrix_2x2';
  title?: string;
  points: MatrixPoint[];
  midpoints: { x: number; y: number };
  axisLabels: { x: string; y: string };
}

export type RagStatus = 'green' | 'amber' | 'red';
export interface RagSpec {
  type: 'rag';
  title?: string;
  items: { label: string; value: number; status: RagStatus }[];
}

export interface MarimekkoRect {
  columnLabel: string;
  segmentName: string;
  value: number;
  x: number;
  y: number;
  w: number;
  h: number;
  shareOfTotal: number;
}
export interface MarimekkoSpec {
  type: 'marimekko';
  title?: string;
  rects: MarimekkoRect[];
  columnBounds: { label: string; x: number; w: number }[];
  segmentNames: string[];
}

export type HarveyLevel = 0 | 1 | 2 | 3 | 4;
export interface HarveyBall {
  label: string;
  level: HarveyLevel;
  fillFraction: number;
  note?: string;
}
export interface HarveySpec {
  type: 'harvey_balls';
  title?: string;
  balls: HarveyBall[];
}

export type DeckChartSpec =
  | CartesianSpec
  | PieSpec
  | WaterfallSpec
  | Matrix2x2Spec
  | RagSpec
  | MarimekkoSpec
  | HarveySpec;

// ── Coercion helpers (fail-soft) ─────────────────────────────────────────────

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** Normalize the two authoring shapes of cartesian/pie data into series+categories. */
function readSeries(content: Record<string, unknown>): {
  categories: string[];
  series: { label: string; values: number[] }[];
} {
  // Shape A: series: [{ name, data: number[] }]  (fixture / deck pipeline)
  const rawSeries = asArray(content.series);
  if (rawSeries.length > 0) {
    const series = rawSeries
      .map((s) => {
        const obj = (s ?? {}) as Record<string, unknown>;
        const values = asArray(obj.data ?? obj.values)
          .map(num)
          .filter((n): n is number => n !== null);
        return { label: str(obj.name ?? obj.label) || 'Seria', values };
      })
      .filter((s) => s.values.length > 0);
    if (series.length > 0) {
      const maxLen = Math.max(...series.map((s) => s.values.length));
      const labelled = asArray(content.categories ?? content.labels).map(str);
      const categories =
        labelled.length >= maxLen
          ? labelled.slice(0, maxLen)
          : Array.from({ length: maxLen }, (_, i) => labelled[i] ?? `${i + 1}`);
      return { categories, series };
    }
  }

  // Shape B: data: [{ label, value }]  (legacy single-series)
  const rawData = asArray(content.data);
  if (rawData.length > 0) {
    const pairs = rawData
      .map((d) => {
        const obj = (d ?? {}) as Record<string, unknown>;
        return { label: str(obj.label ?? obj.name), value: num(obj.value) };
      })
      .filter((p): p is { label: string; value: number } => p.value !== null);
    if (pairs.length > 0) {
      return {
        categories: pairs.map((p) => p.label || ''),
        series: [{ label: str(content.title) || 'Wartość', values: pairs.map((p) => p.value) }],
      };
    }
  }

  return { categories: [], series: [] };
}

// ── Ported pure math ─────────────────────────────────────────────────────────

/** Waterfall — ported from chartSpecEngine.buildWaterfall. */
function buildWaterfall(
  items: { label: string; value: number; isTotal?: boolean }[]
): { bars: WaterfallBar[]; domain: { min: number; max: number } } {
  let running = 0;
  let min = 0;
  let max = 0;
  const bars = items.map((it) => {
    let start: number;
    let end: number;
    let kind: WaterfallBar['kind'];
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
    return {
      label: it.label,
      start: Math.min(start, end),
      end: Math.max(start, end),
      value: it.value,
      kind,
    };
  });
  return { bars, domain: { min, max } };
}

function quadrantOf(x: number, y: number, xMid: number, yMid: number): Quadrant {
  const right = x >= xMid;
  const top = y >= yMid;
  if (right && top) return 'Q1';
  if (!right && top) return 'Q2';
  if (!right && !top) return 'Q3';
  return 'Q4';
}

/** Marimekko — ported from advancedCharts.computeMarimekkoLayout. */
function computeMarimekko(
  columns: { label: string; segments: { name: string; value: number }[] }[]
): { rects: MarimekkoRect[]; columnBounds: { label: string; x: number; w: number }[] } {
  const colTotals = columns.map((c) =>
    (c.segments ?? []).reduce((s, seg) => s + Math.max(0, seg.value || 0), 0)
  );
  const total = colTotals.reduce((a, b) => a + b, 0);
  if (total <= 0) return { rects: [], columnBounds: [] };

  const rects: MarimekkoRect[] = [];
  const columnBounds: { label: string; x: number; w: number }[] = [];
  let cursorX = 0;
  columns.forEach((col, ci) => {
    const colTotal = colTotals[ci];
    const colW = colTotal / total;
    columnBounds.push({ label: col.label, x: cursorX, w: colW });
    if (colTotal > 0) {
      let cursorY = 0;
      for (const seg of col.segments ?? []) {
        const v = Math.max(0, seg.value || 0);
        if (v <= 0) continue;
        const segH = v / colTotal;
        rects.push({
          columnLabel: col.label,
          segmentName: seg.name,
          value: v,
          x: cursorX,
          y: cursorY,
          w: colW,
          h: segH,
          shareOfTotal: v / total,
        });
        cursorY += segH;
      }
    }
    cursorX += colW;
  });
  return { rects, columnBounds };
}

function toHarveyLevel(value: number): HarveyLevel {
  if (!Number.isFinite(value)) return 0;
  const r = Math.round(value);
  return Math.max(0, Math.min(4, r)) as HarveyLevel;
}

// ── Advanced-type builders (each fail-open to null) ──────────────────────────

function adaptWaterfall(
  content: Record<string, unknown>,
  title?: string
): WaterfallSpec | null {
  const items = asArray(content.items ?? content.data ?? content.bars)
    .map((it) => {
      const obj = (it ?? {}) as Record<string, unknown>;
      const value = num(obj.value ?? obj.delta ?? obj.amount);
      if (value === null) return null;
      return {
        label: str(obj.label ?? obj.name),
        value,
        isTotal: Boolean(obj.isTotal ?? obj.total),
      };
    })
    .filter((x): x is { label: string; value: number; isTotal: boolean } => x !== null);
  if (items.length < 2) return null;
  const { bars, domain } = buildWaterfall(items);
  return { type: 'waterfall', title, bars, domain };
}

function adaptMatrix(content: Record<string, unknown>, title?: string): Matrix2x2Spec | null {
  const raw = asArray(content.points ?? content.items ?? content.data);
  const points = raw
    .map((p) => {
      const obj = (p ?? {}) as Record<string, unknown>;
      const x = num(obj.x ?? obj.impact ?? obj.value);
      const y = num(obj.y ?? obj.feasibility ?? obj.effort);
      if (x === null || y === null) return null;
      return { label: str(obj.label ?? obj.name), x, y };
    })
    .filter((p): p is { label: string; x: number; y: number } => p !== null);
  if (points.length === 0) return null;

  const axis = (content.axisLabels ?? {}) as Record<string, unknown>;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMid = num(content.xMid) ?? (Math.min(...xs) + Math.max(...xs)) / 2;
  const yMid = num(content.yMid) ?? (Math.min(...ys) + Math.max(...ys)) / 2;
  return {
    type: 'matrix_2x2',
    title,
    points: points.map((p) => ({ ...p, quadrant: quadrantOf(p.x, p.y, xMid, yMid) })),
    midpoints: { x: xMid, y: yMid },
    axisLabels: { x: str(axis.x) || 'Wpływ', y: str(axis.y) || 'Wykonalność' },
  };
}

function adaptRag(content: Record<string, unknown>, title?: string): RagSpec | null {
  const raw = asArray(content.items ?? content.data);
  const th = (content.thresholds ?? {}) as Record<string, unknown>;
  const green = num(th.green);
  const amber = num(th.amber);
  const lowerIsBetter = Boolean(content.lowerIsBetter);
  const classify = (v: number): RagStatus => {
    if (green === null || amber === null) return 'amber';
    if (lowerIsBetter) {
      if (v <= green) return 'green';
      if (v <= amber) return 'amber';
      return 'red';
    }
    if (v >= green) return 'green';
    if (v >= amber) return 'amber';
    return 'red';
  };
  const items = raw
    .map((it) => {
      const obj = (it ?? {}) as Record<string, unknown>;
      const value = num(obj.value);
      if (value === null) return null;
      // Explicit status wins; otherwise classify by thresholds.
      const explicit = str(obj.status).toLowerCase();
      const status: RagStatus =
        explicit === 'green' || explicit === 'amber' || explicit === 'red'
          ? (explicit as RagStatus)
          : classify(value);
      return { label: str(obj.label ?? obj.name), value, status };
    })
    .filter((x): x is { label: string; value: number; status: RagStatus } => x !== null);
  if (items.length === 0) return null;
  return { type: 'rag', title, items };
}

function adaptMarimekko(content: Record<string, unknown>, title?: string): MarimekkoSpec | null {
  const columns = asArray(content.columns)
    .map((c) => {
      const obj = (c ?? {}) as Record<string, unknown>;
      const segments = asArray(obj.segments)
        .map((s) => {
          const so = (s ?? {}) as Record<string, unknown>;
          const value = num(so.value);
          return value === null ? null : { name: str(so.name), value };
        })
        .filter((x): x is { name: string; value: number } => x !== null);
      return { label: str(obj.label ?? obj.name), segments };
    })
    .filter((c) => c.segments.length > 0);
  if (columns.length === 0) return null;
  const { rects, columnBounds } = computeMarimekko(columns);
  if (rects.length === 0) return null;
  const segmentNames: string[] = [];
  for (const r of rects) if (!segmentNames.includes(r.segmentName)) segmentNames.push(r.segmentName);
  return { type: 'marimekko', title, rects, columnBounds, segmentNames };
}

function adaptHarvey(content: Record<string, unknown>, title?: string): HarveySpec | null {
  const raw = asArray(content.rows ?? content.items ?? content.data);
  const balls = raw
    .map((row) => {
      const obj = (row ?? {}) as Record<string, unknown>;
      const level = num(obj.level ?? obj.value);
      if (level === null) return null;
      const lvl = toHarveyLevel(level);
      const ball: HarveyBall = { label: str(obj.label ?? obj.name), level: lvl, fillFraction: lvl / 4 };
      if (obj.note != null) ball.note = str(obj.note);
      return ball;
    })
    .filter((x): x is HarveyBall => x !== null);
  if (balls.length === 0) return null;
  return { type: 'harvey_balls', title, balls };
}

// ── Entry point ──────────────────────────────────────────────────────────────

const ADVANCED = new Set([
  'waterfall',
  'bridge',
  'matrix_2x2',
  'matrix',
  'prioritization',
  'rag',
  'rag_status',
  'marimekko',
  'mekko',
  'harvey_balls',
  'harvey',
]);

/**
 * Adapt a deck `chart` block's content into a normalized {@link DeckChartSpec}.
 * Returns `null` when the block carries no usable chart data — the renderer
 * MUST draw nothing in that case (fail-open, no placeholder). Never throws.
 */
export function adaptChartBlockContent(content: unknown): DeckChartSpec | null {
  try {
    if (!content || typeof content !== 'object') return null;
    const c = content as Record<string, unknown>;
    const title = c.title != null ? str(c.title) : undefined;
    const kind = str(c.chartType ?? c.kind ?? c.chart_kind ?? 'bar').toLowerCase();

    if (ADVANCED.has(kind)) {
      if (kind === 'waterfall' || kind === 'bridge') return adaptWaterfall(c, title);
      if (kind === 'matrix_2x2' || kind === 'matrix' || kind === 'prioritization')
        return adaptMatrix(c, title);
      if (kind === 'rag' || kind === 'rag_status') return adaptRag(c, title);
      if (kind === 'marimekko' || kind === 'mekko') return adaptMarimekko(c, title);
      if (kind === 'harvey_balls' || kind === 'harvey') return adaptHarvey(c, title);
    }

    // Cartesian / pie families.
    const { categories, series } = readSeries(c);
    if (series.length === 0) return null;

    if (kind === 'pie' || kind === 'donut') {
      const first = series[0];
      const slices = first.values
        .map((v, i) => ({ name: categories[i] ?? `${i + 1}`, value: v }))
        .filter((s) => Number.isFinite(s.value));
      if (slices.length === 0) return null;
      return { type: kind, title, slices };
    }

    const cartKind: CartesianKind = kind === 'line' || kind === 'area' ? kind : 'bar';
    return {
      type: cartKind,
      title,
      categories,
      series,
      xAxisLabel: c.xAxisLabel != null ? str(c.xAxisLabel) : undefined,
      yAxisLabel: c.yAxisLabel != null ? str(c.yAxisLabel) : undefined,
    };
  } catch {
    return null;
  }
}
