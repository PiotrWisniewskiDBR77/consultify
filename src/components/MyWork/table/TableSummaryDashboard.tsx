/**
 * TableSummaryDashboard — Auto-generated summary panel for the Idea Table.
 *
 * Shows: quick stats, mini bar charts per select column, AI narrative summary,
 * completeness gauge, and distribution breakdowns.
 */
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from './tableTypes';
import { ROW_ACCENT_COLORS } from './tableTypes';

interface TableSummaryDashboardProps {
  open: boolean;
  onClose: () => void;
  nodes: TableNode[];
  columns: ColumnDef[];
  ideaId?: string;
}

export const TableSummaryDashboard: React.FC<TableSummaryDashboardProps> = ({
  open,
  onClose,
  nodes,
  columns,
  ideaId,
}) => {
  const { t, i18n } = useTranslation();

  const [aiNarrative, setAiNarrative] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const visibleCols = useMemo(() => columns.filter((c) => c.visible), [columns]);

  const stats = useMemo(() => {
    const totalRows = nodes.length;
    const totalFields = totalRows * visibleCols.length;
    let filledFields = 0;
    for (const n of nodes) {
      for (const c of visibleCols) {
        if (n.data?.[c.key] != null && n.data[c.key] !== '') filledFields++;
      }
    }
    const completeness = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

    const categories = new Set(nodes.map((n) => String(n.data?.type || 'idea')));
    const withComments = nodes.filter((n) => (n.data?.comments || []).length > 0).length;
    const withAttachments = nodes.filter((n) => (n.data?.attachments || []).length > 0).length;

    return { totalRows, completeness, categories: categories.size, withComments, withAttachments };
  }, [nodes, visibleCols]);

  const selectDistributions = useMemo(() => {
    const result: {
      column: ColumnDef;
      distribution: { label: string; count: number; color: string }[];
    }[] = [];
    for (const col of visibleCols) {
      if (col.type !== 'select') continue;
      const counts: Record<string, number> = {};
      for (const n of nodes) {
        const v = String(n.data?.[col.key] || '');
        if (v) counts[v] = (counts[v] || 0) + 1;
      }
      const dist = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count], i) => ({
          label,
          count,
          color: col.optionColors?.[label] || ROW_ACCENT_COLORS[i % ROW_ACCENT_COLORS.length],
        }));
      if (dist.length > 0) result.push({ column: col, distribution: dist });
    }
    return result;
  }, [nodes, visibleCols]);

  const numberStats = useMemo(() => {
    const result: { column: ColumnDef; avg: number; min: number; max: number; sum: number }[] = [];
    for (const col of visibleCols) {
      if (
        col.type !== 'number' &&
        col.type !== 'currency' &&
        col.type !== 'rating' &&
        col.type !== 'progress'
      )
        continue;
      const vals = nodes.map((n) => Number(n.data?.[col.key])).filter((v) => !isNaN(v) && v !== 0);
      if (vals.length === 0) continue;
      result.push({
        column: col,
        avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
        min: Math.min(...vals),
        max: Math.max(...vals),
        sum: Math.round(vals.reduce((a, b) => a + b, 0) * 10) / 10,
      });
    }
    return result;
  }, [nodes, visibleCols]);

  const handleGenerateNarrative = useCallback(async () => {
    setAiLoading(true);
    try {
      const { Api } = await import('@/services/api');
      const result = await Api.getIdeaAISuggestions(ideaId || '', {
        context: {
          title: 'Table Summary',
          seedText: `Table has ${stats.totalRows} rows, ${stats.completeness}% completeness, ${stats.categories} categories. Columns: ${visibleCols.map((c) => c.header).join(', ')}`,
          currentNodes: nodes.map((n) => ({ id: n.id, type: n.type, label: n.data?.label })),
          currentEdges: [],
          activeTool: 'table',
        },
        mode: 'on_demand',
        prompt:
          'Generate a brief narrative summary (3-4 sentences) of this idea table, highlighting key patterns, strengths, and gaps.',
        language: i18n.language,
      });
      const texts = (result?.suggestions || []).map((s: any) => s.text || s.detail || '');
      setAiNarrative(texts.join(' ') || t('ideas.table.summaryDashboard.noResults', 'No results'));
    } catch {
      setAiNarrative(
        t('ideas.table.summaryDashboard.failedToGenerateSummary', 'Failed to generate summary')
      );
    } finally {
      setAiLoading(false);
    }
  }, [i18n.language, ideaId, nodes, stats, t, visibleCols]);

  if (!open) return null;

  return (
    <div className="border-t border-c-border-subtle bg-c-surface-raised">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-c-surface-raised transition-colors"
      >
        <BarChart3 size={13} className="text-c-text-secondary" />
        <span className="text-[11px] font-bold text-c-text">
          {t('ideas.table.summaryDashboard.tableSummary', 'Table Summary')}
        </span>
        <div className="flex-1" />
        {expanded ? (
          <ChevronDown size={12} className="text-c-text-secondary" />
        ) : (
          <ChevronUp size={12} className="text-c-text-secondary" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              {
                label: t('ideas.table.summaryDashboard.ideas', 'Ideas'),
                value: stats.totalRows,
                icon: FileText,
                color: 'var(--c-info)',
              },
              {
                label: t('ideas.table.summaryDashboard.completeness', 'Completeness'),
                value: `${stats.completeness}%`,
                icon: CheckCircle2,
                color:
                  stats.completeness > 70
                    ? 'var(--c-success)'
                    : stats.completeness > 40
                      ? 'var(--c-warning)'
                      : 'var(--c-danger)',
              },
              {
                label: t('ideas.table.summaryDashboard.categories', 'Categories'),
                value: stats.categories,
                icon: TrendingUp,
                color: 'var(--c-info)',
              },
              {
                label: t('ideas.table.summaryDashboard.withComments', 'With comments'),
                value: stats.withComments,
                icon: FileText,
                color: 'var(--c-info)',
              },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-xl bg-c-surface border border-slate-200/60 dark:border-white/[0.03] p-3"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon size={11} style={{ color: stat.color }} />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-c-text-secondary">
                      {stat.label}
                    </span>
                  </div>
                  <span className="text-lg font-bold" style={{ color: stat.color }}>
                    {stat.value}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Completeness gauge */}
          <div className="rounded-xl bg-c-surface border border-slate-200/60 dark:border-white/[0.03] p-3">
            <span className="text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-2 block">
              {t('ideas.table.summaryDashboard.dataCompleteness', 'Data completeness')}
            </span>
            <div className="h-2.5 rounded-full bg-c-border-subtle overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${stats.completeness}%`,
                  background: `linear-gradient(90deg, ${stats.completeness > 70 ? 'var(--c-success)' : stats.completeness > 40 ? 'var(--c-warning)' : 'var(--c-danger)'}, ${stats.completeness > 70 ? 'var(--c-success)' : stats.completeness > 40 ? 'var(--c-warning)' : 'var(--c-danger)'})`,
                }}
              />
            </div>
            <span className="text-[10px] text-c-text-muted mt-1 block">
              {stats.completeness}% —{' '}
              {stats.completeness > 70
                ? t('ideas.table.summaryDashboard.good', 'Good')
                : stats.completeness > 40
                  ? t('ideas.table.summaryDashboard.average', 'Average')
                  : t('ideas.table.summaryDashboard.low', 'Low')}
            </span>
          </div>

          {/* Select distributions */}
          {selectDistributions.length > 0 && (
            <div className="space-y-3">
              {selectDistributions.map(({ column, distribution }) => (
                <div
                  key={column.key}
                  className="rounded-xl bg-c-surface border border-slate-200/60 dark:border-white/[0.03] p-3"
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-2 block">
                    {column.header}
                  </span>
                  <div className="space-y-1.5">
                    {distribution.map((d) => (
                      <div key={d.label} className="flex items-center gap-2">
                        <span className="text-[10px] text-c-text-secondary w-20 truncate">
                          {d.label}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-c-surface-raised overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(d.count / nodes.length) * 100}%`,
                              backgroundColor: d.color,
                            }}
                          />
                        </div>
                        <span className="text-[9px] text-c-text-secondary w-6 text-right">
                          {d.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Number stats */}
          {numberStats.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {numberStats.map(({ column, avg, min, max, sum }) => (
                <div
                  key={column.key}
                  className="rounded-xl bg-c-surface border border-slate-200/60 dark:border-white/[0.03] p-3"
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-1 block">
                    {column.header}
                  </span>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <span className="text-c-text-muted">
                      {t('ideas.table.summaryDashboard.avg', 'Avg')}:{' '}
                      <strong className="text-c-text">{avg}</strong>
                    </span>
                    <span className="text-c-text-muted">
                      {t('ideas.table.summaryDashboard.sum', 'Sum')}:{' '}
                      <strong className="text-c-text">{sum}</strong>
                    </span>
                    <span className="text-c-text-muted">
                      {t('ideas.table.summaryDashboard.min', 'Min')}:{' '}
                      <strong className="text-c-text">{min}</strong>
                    </span>
                    <span className="text-c-text-muted">
                      {t('ideas.table.summaryDashboard.max', 'Max')}:{' '}
                      <strong className="text-c-text">{max}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AI Narrative */}
          <div className="rounded-xl border border-c-border bg-c-surface-raised p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles size={11} className="text-c-text-secondary" />
              <span className="text-[10px] font-bold text-c-text">
                {t('ideas.table.summaryDashboard.aiNarrative', 'AI Narrative')}
              </span>
            </div>
            {aiNarrative ? (
              <p className="text-[11px] text-c-text leading-relaxed">{aiNarrative}</p>
            ) : (
              <button
                onClick={handleGenerateNarrative}
                disabled={aiLoading}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold text-c-text hover:bg-c-surface-raised transition-colors disabled:opacity-50"
              >
                {aiLoading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                {aiLoading
                  ? t('ideas.table.summaryDashboard.generating', 'Generating...')
                  : t('ideas.table.summaryDashboard.generateAiSummary', 'Generate AI summary')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TableSummaryDashboard;
