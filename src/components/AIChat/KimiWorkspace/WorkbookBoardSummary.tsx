import React from 'react';

import type { WorkbookGridSheet } from '@/utils/workbookGridPreview';

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.startsWith('=')) return null;
  const normalized = value.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const display = (value: unknown): string =>
  typeof value === 'number' ? value.toLocaleString('pl-PL', { maximumFractionDigits: 1 }) : String(value ?? '—');

export const WorkbookBoardSummary: React.FC<{ sheets: WorkbookGridSheet[]; activeSheetName?: string }> = ({ sheets, activeSheetName }) => {
  if (activeSheetName && activeSheetName !== 'Executive Summary') return null;
  const summary = sheets.find((sheet) => sheet.name === 'Executive Summary');
  const scenarios = sheets.find((sheet) => sheet.name === 'Scenario Model');
  if (!summary || !scenarios) return null;

  const summaryLabel = summary.columns[0];
  const summaryValue = summary.columns[1];
  const cards = summary.rows.slice(0, 5).map((row) => ({ label: String(row[summaryLabel] ?? ''), value: row[summaryValue] }));
  const scenarioLabel = scenarios.columns[0];
  const scenarioRow = scenarios.rows.find((row) => /korzyści risk-adjusted/i.test(String(row[scenarioLabel] ?? '')));
  const series = scenarioRow
    ? scenarios.columns.slice(1).map((column) => ({ label: column, value: asNumber(scenarioRow[column]) })).filter((point): point is { label: string; value: number } => point.value !== null)
    : [];
  const max = Math.max(0, ...series.map((point) => Math.abs(point.value)));

  return (
    <section data-testid="workbook-board-summary" className="border-b border-c-border-subtle bg-c-surface-raised/40 p-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">{card.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-c-text">{display(card.value)}</p>
          </div>
        ))}
      </div>
      {series.length >= 2 && max > 0 ? (
        <div className="mt-3 rounded-lg border border-c-border-subtle bg-c-surface p-3">
          <p className="mb-2 text-xs font-semibold text-c-text">Risk-adjusted benefits by scenario</p>
          <div className="flex h-28 items-end gap-4" role="img" aria-label="Risk-adjusted benefits by scenario">
            {series.map((point) => (
              <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="text-[10px] tabular-nums text-c-text-secondary">{display(point.value)}</span>
                <div className="w-full max-w-16 rounded-t bg-c-chart-1" style={{ height: `${Math.max(8, Math.abs(point.value) / max * 76)}px` }} />
                <span className="text-[10px] font-medium text-c-text-secondary">{point.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
};

