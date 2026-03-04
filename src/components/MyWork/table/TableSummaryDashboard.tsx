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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

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
    const result: { column: ColumnDef; distribution: { label: string; count: number; color: string }[] }[] = [];
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
      if (col.type !== 'number' && col.type !== 'currency' && col.type !== 'rating' && col.type !== 'progress') continue;
      const vals = nodes.map((n) => Number(n.data?.[col.key])).filter((v) => !isNaN(v) && v !== 0);
      if (vals.length === 0) continue;
      result.push({
        column: col,
        avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10,
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
        prompt: 'Generate a brief narrative summary (3-4 sentences) of this idea table, highlighting key patterns, strengths, and gaps.',
        language: i18n.language,
      });
      const texts = (result?.suggestions || []).map((s: any) => s.text || s.detail || '');
      setAiNarrative(texts.join(' ') || (isPl ? 'Brak wyników' : 'No results'));
    } catch {
      setAiNarrative(isPl ? 'Nie udało się wygenerować podsumowania' : 'Failed to generate summary');
    } finally {
      setAiLoading(false);
    }
  }, [i18n.language, ideaId, isPl, nodes, stats, visibleCols]);

  if (!open) return null;

  return (
    <div className="border-t border-slate-200/60 dark:border-navy-700/60 bg-gradient-to-b from-slate-50/80 to-white dark:from-navy-900/50 dark:to-navy-950">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors"
      >
        <BarChart3 size={13} className="text-violet-500" />
        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
          {isPl ? 'Podsumowanie tabeli' : 'Table Summary'}
        </span>
        <div className="flex-1" />
        {expanded ? <ChevronDown size={12} className="text-slate-400" /> : <ChevronUp size={12} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: isPl ? 'Pomysły' : 'Ideas', value: stats.totalRows, icon: FileText, color: '#6366f1' },
              { label: isPl ? 'Kompletność' : 'Completeness', value: `${stats.completeness}%`, icon: CheckCircle2, color: stats.completeness > 70 ? '#10b981' : stats.completeness > 40 ? '#f59e0b' : '#ef4444' },
              { label: isPl ? 'Kategorie' : 'Categories', value: stats.categories, icon: TrendingUp, color: '#8b5cf6' },
              { label: isPl ? 'Z komentarzami' : 'With comments', value: stats.withComments, icon: FileText, color: '#06b6d4' },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="rounded-xl bg-white dark:bg-navy-900 border border-slate-200/40 dark:border-navy-700/40 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon size={11} style={{ color: stat.color }} />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{stat.label}</span>
                  </div>
                  <span className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</span>
                </div>
              );
            })}
          </div>

          {/* Completeness gauge */}
          <div className="rounded-xl bg-white dark:bg-navy-900 border border-slate-200/40 dark:border-navy-700/40 p-3">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">
              {isPl ? 'Kompletność danych' : 'Data completeness'}
            </span>
            <div className="h-2.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${stats.completeness}%`,
                  background: `linear-gradient(90deg, ${stats.completeness > 70 ? '#10b981' : stats.completeness > 40 ? '#f59e0b' : '#ef4444'}, ${stats.completeness > 70 ? '#06d6a0' : stats.completeness > 40 ? '#fbbf24' : '#f87171'})`,
                }}
              />
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">{stats.completeness}% — {stats.completeness > 70 ? (isPl ? 'Dobrze' : 'Good') : stats.completeness > 40 ? (isPl ? 'Średnio' : 'Average') : (isPl ? 'Nisko' : 'Low')}</span>
          </div>

          {/* Select distributions */}
          {selectDistributions.length > 0 && (
            <div className="space-y-3">
              {selectDistributions.map(({ column, distribution }) => (
                <div key={column.key} className="rounded-xl bg-white dark:bg-navy-900 border border-slate-200/40 dark:border-navy-700/40 p-3">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">{column.header}</span>
                  <div className="space-y-1.5">
                    {distribution.map((d) => (
                      <div key={d.label} className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-600 dark:text-slate-300 w-20 truncate">{d.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-navy-800 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${(d.count / nodes.length) * 100}%`, backgroundColor: d.color }} />
                        </div>
                        <span className="text-[9px] text-slate-400 w-6 text-right">{d.count}</span>
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
                <div key={column.key} className="rounded-xl bg-white dark:bg-navy-900 border border-slate-200/40 dark:border-navy-700/40 p-3">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">{column.header}</span>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <span className="text-slate-500">{isPl ? 'Śr.' : 'Avg'}: <strong className="text-slate-700 dark:text-slate-300">{avg}</strong></span>
                    <span className="text-slate-500">{isPl ? 'Suma' : 'Sum'}: <strong className="text-slate-700 dark:text-slate-300">{sum}</strong></span>
                    <span className="text-slate-500">Min: <strong className="text-slate-700 dark:text-slate-300">{min}</strong></span>
                    <span className="text-slate-500">Max: <strong className="text-slate-700 dark:text-slate-300">{max}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AI Narrative */}
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles size={11} className="text-violet-500" />
              <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">
                {isPl ? 'Narracja AI' : 'AI Narrative'}
              </span>
            </div>
            {aiNarrative ? (
              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">{aiNarrative}</p>
            ) : (
              <button
                onClick={handleGenerateNarrative}
                disabled={aiLoading}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
              >
                {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {aiLoading ? (isPl ? 'Generuję...' : 'Generating...') : (isPl ? 'Generuj podsumowanie AI' : 'Generate AI summary')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TableSummaryDashboard;
