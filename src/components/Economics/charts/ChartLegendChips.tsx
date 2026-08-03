/**
 * ChartLegendChips — Recharts `<Legend content={...}>` renderer that draws the
 * TRIADA chip legend (rounded pill, colored dot + label) instead of Recharts'
 * bare swatch-and-text default (FINANCE_VISUAL_CANON §6, VF2-1 data-viz chrome
 * mini-kanon). Only mount `<Legend>` when a chart has >1 series (existing
 * canon §4 rule) — a single-series chart never needs a legend.
 *
 * Usage: `<Legend content={<ChartLegendChips />} />`
 */
import React from 'react';

interface LegendPayloadEntry {
  value?: React.ReactNode;
  color?: string;
  dataKey?: string | number;
}

export interface ChartLegendChipsProps {
  payload?: LegendPayloadEntry[];
}

export const ChartLegendChips: React.FC<ChartLegendChipsProps> = ({ payload }) => {
  if (!payload || payload.length === 0) return null;
  return (
    <ul
      className="mt-2 flex flex-wrap items-center justify-end gap-1.5"
      data-testid="chart-legend-chips"
    >
      {payload.map((entry, i) => (
        <li
          key={`${entry.dataKey ?? entry.value ?? i}`}
          className="flex items-center gap-1.5 rounded-full border border-c-border-subtle bg-c-surface-raised px-2 py-0.5 text-[11px] leading-none text-c-text-secondary"
        >
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: entry.color }}
            aria-hidden="true"
          />
          {entry.value}
        </li>
      ))}
    </ul>
  );
};

export default ChartLegendChips;
