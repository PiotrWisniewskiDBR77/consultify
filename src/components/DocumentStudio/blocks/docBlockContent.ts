/**
 * Document Studio — pure block-content narrowers (R3).
 *
 * These functions narrow an opaque `block.content` (`unknown`) into a strict,
 * render-ready shape for the chart / table / KPI block components. They are
 * the *only* contract between R1's TipTap NodeViews and R3's renderers:
 *
 *   const c = narrowChartContent(node.attrs.content);
 *   return c ? <DocChartBlock content={c} /> : <pre>…</pre>;
 *
 * HARD RULES (per blueprint):
 *  - NEVER throw. Garbage in → `null` (chart/kpi/table) so the caller can
 *    fall back to a raw `<pre/>` dump.
 *  - Tolerate DUAL KEYS: `columns ?? headers`, KPI `items[]` vs `columns+rows`,
 *    table `rows` of arrays vs rows of objects.
 *  - Pure: no React, no side effects.
 */

import type { DocumentChartBlockContent, DocumentChartKind, DocumentChartSeries } from '../types';

// ---------------------------------------------------------------------------
// Small tolerant coercion helpers (never throw)
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    // Tolerate "1 234,5", "12%", "1,234.5", "$1,200" etc.
    const cleaned = v.replace(/[^0-9,.\-]/g, '').replace(/\s/g, '');
    if (cleaned === '' || cleaned === '-' || cleaned === '.') return 0;
    // If comma looks like a decimal separator (single comma, no dot), swap it.
    let normalized = cleaned;
    if (normalized.includes(',') && !normalized.includes('.')) {
      normalized = normalized.replace(/,/g, '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** First non-undefined value across a set of candidate keys. */
function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Chart
// ---------------------------------------------------------------------------

const CHART_KINDS: DocumentChartKind[] = ['bar', 'line', 'pie', 'donut', 'scatter', 'area'];

function narrowKind(v: unknown): DocumentChartKind {
  const s = toStr(v).toLowerCase().trim();
  if ((CHART_KINDS as string[]).includes(s)) return s as DocumentChartKind;
  // Friendly aliases.
  if (s === 'column' || s === 'bars' || s === '') return 'bar';
  if (s === 'lines') return 'line';
  if (s === 'doughnut') return 'donut';
  return 'bar';
}

/**
 * Narrows opaque content into a {@link DocumentChartBlockContent}.
 *
 * Tolerates dual keys: `categories ?? labels ?? axes`, `series ?? datasets`,
 * series `label ?? name`, `values ?? data`, `color ?? colour`.
 * Returns `null` when no usable series / numeric data can be recovered.
 */
export function narrowChartContent(raw: unknown): DocumentChartBlockContent | null {
  if (!isObject(raw)) return null;

  const kind = narrowKind(pick(raw, 'kind', 'type'));
  const title = toStr(pick(raw, 'title', 'name'));
  const caption = toStr(pick(raw, 'caption', 'subtitle')) || undefined;
  const xAxisLabel = toStr(pick(raw, 'xAxisLabel', 'xLabel', 'xlabel')) || undefined;
  const yAxisLabel = toStr(pick(raw, 'yAxisLabel', 'yLabel', 'ylabel')) || undefined;

  const rawCategories = asArray(pick(raw, 'categories', 'labels', 'axes', 'names'));
  const categories = rawCategories.map(toStr);

  const rawSeries = asArray(pick(raw, 'series', 'datasets', 'data'));
  const series: DocumentChartSeries[] = [];

  for (const s of rawSeries) {
    if (!isObject(s)) {
      // A bare array of numbers → single anonymous series.
      continue;
    }
    const values = asArray(pick(s, 'values', 'data', 'points')).map(toNum);
    if (values.length === 0) continue;
    const label = toStr(pick(s, 'label', 'name')) || `Series ${series.length + 1}`;
    const color = toStr(pick(s, 'color', 'colour')) || undefined;
    series.push({ label, values, color });
  }

  // Fallback: data is a flat array of {name,value} points → one bar series.
  if (series.length === 0) {
    const flat = asArray(pick(raw, 'data', 'points', 'items'));
    const pts = flat.filter(isObject);
    if (pts.length > 0) {
      const cats: string[] = [];
      const vals: number[] = [];
      for (const p of pts) {
        const v = pick(p, 'value', 'y', 'score', 'count');
        if (v === undefined) continue;
        cats.push(toStr(pick(p, 'name', 'label', 'category', 'x')));
        vals.push(toNum(v));
      }
      if (vals.length > 0) {
        if (categories.length === 0) categories.push(...cats);
        series.push({ label: toStr(pick(raw, 'seriesLabel')) || 'Value', values: vals });
      }
    }
  }

  if (series.length === 0) return null;

  return {
    kind,
    title,
    categories: categories.length > 0 ? categories : undefined,
    xAxisLabel,
    yAxisLabel,
    series,
    caption,
  };
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export interface NarrowedTableContent {
  columns: string[];
  rows: string[][];
  /** When true, the table renders risk semantics (Likelihood/Impact colouring). */
  riskSemantics: boolean;
  caption?: string;
}

/**
 * Narrows opaque table content into `{columns, rows}`.
 *
 * Tolerates dual keys:
 *  - columns: `columns ?? headers ?? header`
 *  - rows:    `rows ?? data`, where each row may be an array OR an object
 *             keyed by column name.
 *  - risk:    `riskSemantics ?? isRisk` OR block type 'risk_table'.
 *
 * Returns `null` when no columns AND no rows can be recovered.
 */
export function narrowTableContent(
  raw: unknown,
  opts?: { riskSemantics?: boolean }
): NarrowedTableContent | null {
  if (!isObject(raw)) return null;

  const rawColumns = pick(raw, 'columns', 'headers', 'header', 'cols');
  let columns = asArray(rawColumns).map(toStr);

  const rawRows = asArray(pick(raw, 'rows', 'data', 'records'));
  const rows: string[][] = [];

  for (const r of rawRows) {
    if (Array.isArray(r)) {
      rows.push(r.map(toStr));
    } else if (isObject(r)) {
      // Row keyed by column name → project onto column order. If we have no
      // declared columns yet, infer them from the first object row's keys.
      if (columns.length === 0) columns = Object.keys(r);
      rows.push(columns.map((c) => toStr(r[c])));
    }
  }

  if (columns.length === 0 && rows.length === 0) return null;

  const riskSemantics =
    opts?.riskSemantics === true ||
    pick(raw, 'riskSemantics', 'isRisk') === true ||
    toStr(pick(raw, 'variant')).toLowerCase() === 'risk';

  const caption = toStr(pick(raw, 'caption', 'title')) || undefined;

  return { columns, rows, riskSemantics, caption };
}

// ---------------------------------------------------------------------------
// KPI strip
// ---------------------------------------------------------------------------

export interface NarrowedKpiItem {
  label: string;
  value: string;
  delta?: string;
  /** Optional directional hint for delta colouring. */
  trend?: 'up' | 'down' | 'flat';
}

export interface NarrowedKpiContent {
  items: NarrowedKpiItem[];
  caption?: string;
}

function narrowTrend(v: unknown): 'up' | 'down' | 'flat' | undefined {
  const s = toStr(v).toLowerCase().trim();
  if (s === 'up' || s === 'positive' || s === 'good') return 'up';
  if (s === 'down' || s === 'negative' || s === 'bad') return 'down';
  if (s === 'flat' || s === 'neutral') return 'flat';
  return undefined;
}

/**
 * Narrows opaque KPI content into a flat `items[]` list, supporting BOTH
 * canonical shapes:
 *
 *  A) `{ items: [{ label, value, delta?, trend? }] }`
 *  B) `{ columns: [...], rows: [[...], ...] }` (server `kpi_strip` markdown
 *     shape) — first column → label, second → value, third → delta.
 *
 * Tolerates dual keys (`label ?? name ?? metric`, `value ?? amount`,
 * `delta ?? change`). Returns `null` when no KPI items can be recovered.
 */
export function narrowKpiContent(raw: unknown): NarrowedKpiContent | null {
  if (!isObject(raw)) return null;
  const caption = toStr(pick(raw, 'caption', 'title')) || undefined;

  // Shape A — items[]
  const rawItems = pick(raw, 'items', 'kpis', 'metrics');
  if (Array.isArray(rawItems)) {
    const items: NarrowedKpiItem[] = [];
    for (const it of rawItems) {
      if (!isObject(it)) continue;
      const label = toStr(pick(it, 'label', 'name', 'metric', 'title'));
      const value = toStr(pick(it, 'value', 'amount', 'figure'));
      if (label === '' && value === '') continue;
      const delta = toStr(pick(it, 'delta', 'change', 'diff')) || undefined;
      const trend = narrowTrend(pick(it, 'trend', 'direction'));
      items.push({ label, value, delta, trend });
    }
    if (items.length > 0) return { items, caption };
  }

  // Shape B — columns + rows (each row = one KPI)
  const rawRows = asArray(pick(raw, 'rows', 'data'));
  if (rawRows.length > 0) {
    const items: NarrowedKpiItem[] = [];
    for (const r of rawRows) {
      const cells = Array.isArray(r)
        ? r.map(toStr)
        : isObject(r)
          ? Object.values(r).map(toStr)
          : [];
      if (cells.length === 0) continue;
      const label = cells[0] ?? '';
      const value = cells[1] ?? '';
      if (label === '' && value === '') continue;
      const delta = cells[2] || undefined;
      items.push({ label, value, delta });
    }
    if (items.length > 0) return { items, caption };
  }

  return null;
}
