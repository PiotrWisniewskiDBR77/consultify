/**
 * ReportDocumentView — Task #20 finish.
 *
 * Renders a generated ReportDocument (from reportContentGenerator) into a
 * readable, light/dark-styled report body. Presentation-only: all numbers come
 * pre-computed from live data. Used inside the ExecutionHub Reporting preview
 * panel so an opened/previewed wizard report shows REAL content, not just a
 * descriptor row.
 */

import React from 'react';

import type {
  ReportBlock,
  ReportDocument,
  ReportMetric,
  ReportTableRow,
} from './reportContentGenerator';

const toneText: Record<string, string> = {
  good: 'text-emerald-700 dark:text-emerald-400',
  warn: 'text-amber-700 dark:text-amber-400',
  critical: 'text-danger-700 dark:text-danger-400',
  default: 'text-slate-700 dark:text-slate-300',
};

const ragBadge: Record<string, string> = {
  green:
    'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  amber:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  red: 'bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-400 border-danger-200 dark:border-danger-800',
};

const calloutTone: Record<string, string> = {
  good: 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300',
  warn: 'bg-amber-50 dark:bg-amber-900/15 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300',
  critical:
    'bg-danger-50 dark:bg-danger-900/15 border-danger-200 dark:border-danger-800 text-danger-800 dark:text-danger-300',
  info: 'bg-slate-50 dark:bg-navy-800/60 border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300',
};

function MetricCard({ m }: { m: ReportMetric }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900/40 px-3 py-2 min-w-[96px]">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
        {m.label}
      </div>
      <div className={`text-base font-semibold ${toneText[m.tone || 'default']}`}>{m.value}</div>
      {m.hint && <div className="text-[10px] text-slate-400 dark:text-slate-500">{m.hint}</div>}
    </div>
  );
}

function Table({
  columns,
  rows,
  emptyText,
}: {
  columns: string[];
  rows: ReportTableRow[];
  emptyText?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-[11px] italic text-slate-500 dark:text-slate-500 px-1 py-1.5">
        {emptyText || '—'}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-navy-700">
      <table
        /* §27-exempt: tabela dokumentowa/raportowa read-only, do druku/eksportu */ className="w-full text-[11px]"
      >
        <thead>
          <tr className="bg-slate-50 dark:bg-navy-800/60">
            {columns.map((c) => (
              <th
                key={c}
                className="text-left font-medium text-slate-600 dark:text-slate-400 px-2.5 py-1.5 whitespace-nowrap"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100 dark:border-navy-800 align-top">
              {r.cells.map((cell, j) => (
                <td
                  key={j}
                  className={`px-2.5 py-1.5 ${j === r.cells.length - 1 ? toneText[r.tone || 'default'] : 'text-slate-700 dark:text-slate-300'}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Block({ block }: { block: ReportBlock }) {
  switch (block.kind) {
    case 'paragraph':
      return (
        <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">{block.text}</p>
      );
    case 'metrics':
      return (
        <div className="flex flex-wrap gap-2">
          {block.items.map((m) => (
            <MetricCard key={m.label} m={m} />
          ))}
        </div>
      );
    case 'list':
      return block.ordered ? (
        <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700 dark:text-slate-300">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc list-inside space-y-1 text-xs text-slate-700 dark:text-slate-300">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case 'table':
      return <Table columns={block.columns} rows={block.rows} emptyText={block.emptyText} />;
    case 'callout':
      return (
        <div className={`rounded-lg border px-3 py-2 text-[11px] ${calloutTone[block.tone]}`}>
          {block.text}
        </div>
      );
    default:
      return null;
  }
}

export interface GeneratedReportViewProps {
  doc: ReportDocument;
  className?: string;
}

export const GeneratedReportView: React.FC<GeneratedReportViewProps> = ({ doc, className }) => {
  return (
    <div className={`p-4 space-y-5 overflow-auto ${className || ''}`}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${ragBadge[doc.rag]}`}
          >
            {doc.ragLabel}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-500">{doc.periodLabel}</span>
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">{doc.title}</h2>
        <div className="text-[11px] text-slate-500 dark:text-slate-500">
          {doc.audience} · {doc.generatedAtLabel}
        </div>
        <p className="mt-2 text-xs italic text-slate-600 dark:text-slate-400">{doc.summary}</p>
      </div>

      {/* Sections */}
      {doc.sections.map((s) => (
        <section key={s.id} className="space-y-2">
          <div className="flex items-baseline gap-2 border-b border-slate-100 dark:border-navy-800 pb-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              {s.heading}
            </h3>
          </div>
          {s.intro && <p className="text-[11px] text-slate-500 dark:text-slate-500">{s.intro}</p>}
          <div className="space-y-2.5">
            {s.blocks.map((b, i) => (
              <Block key={i} block={b} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default GeneratedReportView;
