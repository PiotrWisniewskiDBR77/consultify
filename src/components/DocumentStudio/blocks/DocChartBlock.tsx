/**
 * Document Studio — DocChartBlock (R3).
 *
 * Pure renderer: props in → JSX out, zero TipTap. Consumes a narrowed
 * {@link DocumentChartBlockContent} (see `narrowChartContent`) and renders a
 * recharts chart inside a `ResponsiveContainer` with its OWN height.
 *
 * Supported kinds: bar · line · pie · donut · area.
 * §P-CHART rules enforced:
 *  - axes + legend + Tooltip MANDATORY (cartesian kinds),
 *  - pie/donut ≤5 slices (surplus aggregated into "Inne"/"Other"),
 *  - series ≤8 (hard cap, MAX_SERIES),
 *  - palette ≤7 (clampPalette).
 *
 * Transform: categories × series → [{ name: cat_i, [label]: values[i] }].
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { DocumentChartBlockContent } from '../types';
import { clampPalette, colorAt, MAX_PIE_SLICES, MAX_SERIES } from './docChartPalette';

export interface DocChartBlockProps {
  content: DocumentChartBlockContent;
  /** Override the default chart height (px). Default 280 (range 240–300). */
  height?: number;
  /** "Other"/"Inne" aggregate-slice label for pie/donut surplus. */
  otherLabel?: string;
}

const TOOLTIP_STYLE: React.CSSProperties = {
  background: '#1e293b',
  border: 'none',
  borderRadius: 8,
  fontSize: 12,
  color: '#f1f5f9',
};

const AXIS_TICK = { fontSize: 11, fill: '#64748b' };
const AXIS_LINE = { stroke: '#cbd5e1' };

/** Clamp height into the §2 240–300px band. */
function clampHeight(h?: number): number {
  const n = Number(h);
  if (!Number.isFinite(n)) return 280;
  return Math.min(300, Math.max(240, Math.round(n)));
}

interface CartesianRow {
  name: string;
  [series: string]: string | number;
}

/** categories × series → recharts row objects. */
function toCartesianRows(
  content: DocumentChartBlockContent,
  series: typeof content.series
): {
  rows: CartesianRow[];
  keys: string[];
} {
  const keys = series.map((s) => s.label);
  const rowCount = Math.max(content.categories?.length ?? 0, ...series.map((s) => s.values.length));
  const rows: CartesianRow[] = [];
  for (let i = 0; i < rowCount; i += 1) {
    const row: CartesianRow = {
      name: content.categories?.[i] ?? `${i + 1}`,
    };
    series.forEach((s, sIdx) => {
      const key = keys[sIdx];
      row[key] = Number.isFinite(s.values[i]) ? s.values[i] : 0;
    });
    rows.push(row);
  }
  return { rows, keys };
}

/** Pie/donut data from the FIRST series, capped to ≤5 slices ("Inne" surplus). */
function toPieData(
  content: DocumentChartBlockContent,
  otherLabel: string
): {
  name: string;
  value: number;
}[] {
  const first = content.series[0];
  if (!first) return [];
  const pairs = first.values.map((v, i) => ({
    name: content.categories?.[i] ?? `${i + 1}`,
    value: Number.isFinite(v) ? v : 0,
  }));
  if (pairs.length <= MAX_PIE_SLICES) return pairs;
  const head = pairs.slice(0, MAX_PIE_SLICES - 1);
  const tail = pairs.slice(MAX_PIE_SLICES - 1);
  const otherValue = tail.reduce((acc, p) => acc + p.value, 0);
  return [...head, { name: otherLabel, value: otherValue }];
}

export const DocChartBlock: React.FC<DocChartBlockProps> = ({ content, height, otherLabel }) => {
  const { t } = useTranslation();
  const resolvedOtherLabel = otherLabel ?? t('documentStudio.blocks.chartOther', 'Other');
  const h = clampHeight(height);
  // §P-CHART hard cap: never render more than MAX_SERIES series.
  const series = useMemo(() => content.series.slice(0, MAX_SERIES), [content.series]);
  const palette = useMemo(
    () => clampPalette(Math.max(series.length, content.categories?.length ?? 0)),
    [series.length, content.categories]
  );

  const isPie = content.kind === 'pie' || content.kind === 'donut';

  const { rows, keys } = useMemo(
    () => (isPie ? { rows: [], keys: [] } : toCartesianRows(content, series)),
    [isPie, content, series]
  );
  const pieData = useMemo(
    () => (isPie ? toPieData(content, resolvedOtherLabel) : []),
    [isPie, content, resolvedOtherLabel]
  );

  const empty = isPie ? pieData.length === 0 : rows.length === 0 || keys.length === 0;

  return (
    <figure className="doc-chart-block" style={{ margin: 0, width: '100%' }}>
      {content.title && (
        <figcaption
          className="doc-chart-block__title"
          style={{
            fontSize: 14,
            fontWeight: 600,
            // Blok wykresu — w odróżnieniu od DocKpiStrip/DocTableBlock — NIE maluje
            // własnego białego tła: siedzi wprost na `bg-c-surface` karty, więc
            // sztywny slate-700 znikał na navy w ciemnym motywie. Token sam zmienia
            // wartość z motywem (jasny #475569, ciemny #b8c4d6).
            color: 'var(--c-text-secondary)',
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          {content.title}
        </figcaption>
      )}

      {empty ? (
        <div
          className="doc-chart-block__empty"
          // `--c-text-muted` = dokładnie #64748b w jasnym motywie (jasny bez zmian),
          // a w ciemnym #8a99b0 — czytelne na navy.
          style={{
            padding: '24px 0',
            textAlign: 'center',
            color: 'var(--c-text-muted)',
            fontSize: 13,
          }}
        >
          {t('documentStudio.blocks.noChartData', 'No chart data available')}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={h}>
          {content.kind === 'pie' || content.kind === 'donut' ? (
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={Math.round(h * 0.36)}
                innerRadius={content.kind === 'donut' ? Math.round(h * 0.2) : 0}
                paddingAngle={2}
                label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                labelLine={false}
              >
                {pieData.map((_, idx) => (
                  <Cell key={idx} fill={colorAt(idx)} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
            </PieChart>
          ) : content.kind === 'line' ? (
            <LineChart data={rows} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={AXIS_TICK}
                axisLine={AXIS_LINE}
                label={
                  content.xAxisLabel
                    ? {
                        value: content.xAxisLabel,
                        position: 'insideBottom',
                        offset: -2,
                        fontSize: 11,
                      }
                    : undefined
                }
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={AXIS_LINE}
                label={
                  content.yAxisLabel
                    ? {
                        value: content.yAxisLabel,
                        angle: -90,
                        position: 'insideLeft',
                        fontSize: 11,
                      }
                    : undefined
                }
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
              {keys.map((key, idx) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={palette[idx % palette.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          ) : content.kind === 'area' ? (
            <AreaChart data={rows} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={AXIS_TICK}
                axisLine={AXIS_LINE}
                label={
                  content.xAxisLabel
                    ? {
                        value: content.xAxisLabel,
                        position: 'insideBottom',
                        offset: -2,
                        fontSize: 11,
                      }
                    : undefined
                }
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={AXIS_LINE}
                label={
                  content.yAxisLabel
                    ? {
                        value: content.yAxisLabel,
                        angle: -90,
                        position: 'insideLeft',
                        fontSize: 11,
                      }
                    : undefined
                }
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
              {keys.map((key, idx) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={palette[idx % palette.length]}
                  fill={palette[idx % palette.length]}
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          ) : (
            // Default: bar (also covers kind 'scatter' which degrades to bar).
            <BarChart data={rows} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={AXIS_TICK}
                axisLine={AXIS_LINE}
                label={
                  content.xAxisLabel
                    ? {
                        value: content.xAxisLabel,
                        position: 'insideBottom',
                        offset: -2,
                        fontSize: 11,
                      }
                    : undefined
                }
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={AXIS_LINE}
                label={
                  content.yAxisLabel
                    ? {
                        value: content.yAxisLabel,
                        angle: -90,
                        position: 'insideLeft',
                        fontSize: 11,
                      }
                    : undefined
                }
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
              {keys.map((key, idx) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={palette[idx % palette.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      )}

      {content.caption && (
        <figcaption
          className="doc-chart-block__caption"
          style={{ fontSize: 12, color: 'var(--c-text-muted)', textAlign: 'center', marginTop: 6 }}
        >
          {content.caption}
        </figcaption>
      )}
    </figure>
  );
};

export default DocChartBlock;
