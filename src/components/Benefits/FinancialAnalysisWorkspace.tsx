import type { TFunction } from 'i18next';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  Lightbulb,
  Loader2,
  Play,
  Plus,
  Save,
  Shield,
  TrendingUp,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { API_URL, getHeaders } from '../../services/api';
import { trackFunnelEvent } from '../../services/funnelAnalytics';

interface Analysis {
  id: string;
  title: string;
  status: string;
  analysisType: string;
  currency: string;
  periods: string[];
  createdAt: string;
}
interface Ratio {
  id: string;
  category: string;
  ratio_code: string;
  ratio_name: string;
  value: number;
  period: string;
  benchmark_value?: number;
}
interface Insight {
  id: string;
  insight_type: string;
  title: string;
  description: string;
  priority: number;
}

interface FinancialAnalysisWorkspaceProps {
  initialAnalysisId?: string;
  hideSidebar?: boolean;
  onAnalysisChanged?: () => void;
}

export const FinancialAnalysisWorkspace: React.FC<FinancialAnalysisWorkspaceProps> = ({
  initialAnalysisId,
  hideSidebar,
  onAnalysisChanged,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [selected, setSelected] = useState<Analysis | null>(null);
  const [ratios, setRatios] = useState<Ratio[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'ratios' | 'insights' | 'horizontal'>(
    'overview'
  );
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [liveMode, setLiveMode] = useState(false);
  const [liveRatios, setLiveRatios] = useState<Ratio[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);

  const fetchAnalyses = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/economics/financial-analyses`, { headers: getHeaders() });
      if (res.ok) {
        const d = await res.json();
        setAnalyses(d.analyses || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  const selectAnalysis = useCallback(async (a: Analysis) => {
    setSelected(a);
    try {
      const [rr, ir] = await Promise.all([
        fetch(`${API_URL}/economics/financial-analyses/${a.id}/ratios`, { headers: getHeaders() }),
        fetch(`${API_URL}/economics/financial-analyses/${a.id}/insights`, {
          headers: getHeaders(),
        }),
      ]);
      if (rr.ok) {
        const d = await rr.json();
        setRatios(d.ratios || []);
      }
      if (ir.ok) {
        const d = await ir.json();
        setInsights(d.insights || []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (initialAnalysisId && analyses.length > 0 && !selected) {
      const match = analyses.find((a) => a.id === initialAnalysisId);
      if (match) selectAnalysis(match);
    }
  }, [initialAnalysisId, analyses, selected, selectAnalysis]);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch(`${API_URL}/economics/financial-analyses`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        const d = await res.json();
        setShowCreate(false);
        setNewTitle('');
        await fetchAnalyses();
        if (d.analysis) selectAnalysis(d.analysis);
        onAnalysisChanged?.();
      }
    } catch {
      toast.error(t('finance.analysis.createFailed', 'Failed to create analysis'));
    }
  }, [newTitle, fetchAnalyses, selectAnalysis, onAnalysisChanged]);

  const handleRun = useCallback(async () => {
    if (!selected) return;
    setRunning(true);
    try {
      const res = await fetch(`${API_URL}/economics/financial-analyses/${selected.id}/run`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        toast.success(t('finance.analysis.runSuccess', 'Analysis completed'));
        trackFunnelEvent('finance_analysis_generated', { analysisId: selected.id });
        await selectAnalysis(selected);
        await fetchAnalyses();
        onAnalysisChanged?.();
      }
    } catch {
      toast.error(t('finance.analysis.runFailed', 'Run failed'));
    } finally {
      setRunning(false);
    }
  }, [selected, t, selectAnalysis, fetchAnalyses, onAnalysisChanged]);

  const handleApprove = useCallback(async () => {
    if (!selected) return;
    try {
      const res = await fetch(`${API_URL}/economics/financial-analyses/${selected.id}/approve`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        toast.success(t('finance.analysis.approved', 'Analysis approved'));
        trackFunnelEvent('finance_analysis_approved', { analysisId: selected.id });
        await fetchAnalyses();
        onAnalysisChanged?.();
      }
    } catch {
      toast.error(t('finance.analysis.approveFailed', 'Approve failed'));
    }
  }, [selected, t, fetchAnalyses, onAnalysisChanged]);

  const handleLivePreview = useCallback(async () => {
    setLiveLoading(true);
    setLiveMode(true);
    setSelected(null);
    try {
      const res = await fetch(`${API_URL}/economics/financial-analyses/live-preview`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const d = await res.json();
        setLiveRatios(d.ratios || []);
        setActiveTab('ratios');
      }
    } catch {
      toast.error(t('finance.analysis.livePreviewFailed', 'Live preview failed'));
    } finally {
      setLiveLoading(false);
    }
  }, []);

  const handleSaveLiveAsAnalysis = useCallback(
    async (title: string) => {
      try {
        const res = await fetch(`${API_URL}/economics/financial-analyses`, {
          method: 'POST',
          headers: { ...getHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, liveRatios }),
        });
        if (res.ok) {
          const d = await res.json();
          toast.success(t('finance.analysis.savedFromLive', 'Analysis saved from live preview'));
          setLiveMode(false);
          setLiveRatios([]);
          await fetchAnalyses();
          if (d.analysis) selectAnalysis(d.analysis);
          onAnalysisChanged?.();
        }
      } catch {
        toast.error(t('finance.analysis.saveFailed', 'Save failed'));
      }
    },
    [liveRatios, t, fetchAnalyses, selectAnalysis, onAnalysisChanged]
  );

  const fmtNumber = useMemo(
    () => new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    []
  );

  const activeRatios = liveMode ? liveRatios : ratios;

  const groupedRatios = useMemo(() => {
    const groups: Record<string, Ratio[]> = {};
    for (const r of activeRatios) {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    }
    return groups;
  }, [activeRatios]);

  const insightsByType = useMemo(() => {
    const map: Record<string, Insight[]> = { driver: [], risk: [], action: [], quality_note: [] };
    for (const ins of insights) {
      if (!map[ins.insight_type]) map[ins.insight_type] = [];
      map[ins.insight_type].push(ins);
    }
    return map;
  }, [insights]);

  const tabItems = [
    {
      id: 'overview' as const,
      label: t('finance.analysis.tabs.overview', 'Overview'),
      icon: <BarChart3 size={14} />,
    },
    {
      id: 'ratios' as const,
      label: t('finance.analysis.tabs.ratios', 'Ratios'),
      icon: <TrendingUp size={14} />,
    },
    {
      id: 'insights' as const,
      label: t('finance.analysis.tabs.insights', 'Insights'),
      icon: <Lightbulb size={14} />,
    },
    {
      id: 'horizontal' as const,
      label: t('finance.analysis.tabs.horizontal', 'Period Comparison'),
      icon: <FileText size={14} />,
    },
  ];

  if (loading)
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );

  return (
    <div className="flex h-full">
      {!hideSidebar && (
        <div className="w-64 border-r border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex flex-col">
          <div className="p-3 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('finance.analysis.title', 'Financial Analysis')}
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={handleLivePreview}
                disabled={liveLoading}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800 text-emerald-500"
                title={t('finance.analysis.livePreview', 'Quick Analysis (Live)') as string}
              >
                {liveLoading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800 text-purple-500"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {analyses.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 p-2">
                {t('finance.analysis.noAnalyses', 'No analyses yet')}
              </p>
            ) : (
              analyses.map((a) => (
                <button
                  key={a.id}
                  onClick={() => selectAnalysis(a)}
                  className={`w-full text-left p-2 rounded-lg text-sm transition ${selected?.id === a.id ? 'bg-purple-500/20 text-purple-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'}`}
                >
                  <div className="font-medium truncate">{a.title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">{a.status}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        {liveMode ? (
          <LivePreviewPanel
            ratios={liveRatios}
            groupedRatios={groupedRatios}
            onSave={handleSaveLiveAsAnalysis}
            onClose={() => {
              setLiveMode(false);
              setLiveRatios([]);
            }}
            t={t}
          />
        ) : !selected ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400">
            {t('finance.analysis.selectOrCreate', 'Select an analysis or create a new one')}
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between bg-white dark:bg-navy-900">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {selected.title}
                </h2>
                <p className="text-xs text-slate-500">
                  {selected.status} · {selected.currency}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRun}
                  disabled={running}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-500 disabled:opacity-50"
                >
                  {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  {t('finance.analysis.run', 'Run Analysis')}
                </button>
                <button
                  onClick={handleApprove}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-500"
                >
                  <CheckCircle2 size={14} />
                  {t('finance.analysis.approve', 'Approve')}
                </button>
              </div>
            </div>
            <div
              className="border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-4 flex gap-1"
              role="tablist"
              aria-label={t('finance.analysis.tabsLabel', 'Analysis views')}
            >
              {tabItems.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition ${activeTab === tab.id ? 'border-purple-500 text-purple-500' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
            <div
              className="flex-1 overflow-y-auto p-4"
              role="tabpanel"
              id={`tabpanel-${activeTab}`}
              aria-labelledby={`tab-${activeTab}`}
            >
              {(insightsByType['quality_note'] || []).length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase">
                      {t('finance.analysis.dataQualityWarning', 'Data Quality Issues')}
                    </span>
                  </div>
                  <ul className="space-y-0.5">
                    {(insightsByType['quality_note'] || []).slice(0, 3).map((q) => (
                      <li
                        key={q.id}
                        className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1.5"
                      >
                        <span className="mt-1 w-1 h-1 bg-amber-500 rounded-full shrink-0" />
                        {q.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-2 gap-4">
                  {[
                    {
                      key: 'driver',
                      title: t('finance.analysis.topDrivers', 'Top Drivers'),
                      icon: <TrendingUp size={16} className="text-blue-400" />,
                      subIcon: <ChevronRight size={12} className="text-blue-400 mt-0.5 shrink-0" />,
                    },
                    {
                      key: 'risk',
                      title: t('finance.analysis.keyRisks', 'Key Risks'),
                      icon: <AlertTriangle size={16} className="text-amber-400" />,
                      subIcon: <Shield size={12} className="text-amber-400 mt-0.5 shrink-0" />,
                    },
                    {
                      key: 'action',
                      title: t('finance.analysis.actions', 'Actions'),
                      icon: <Lightbulb size={16} className="text-green-400" />,
                      subIcon: <Lightbulb size={12} className="text-green-400 mt-0.5 shrink-0" />,
                    },
                    {
                      key: 'quality_note',
                      title: t('finance.analysis.dataQuality', 'Data Quality'),
                      icon: <FileText size={16} className="text-slate-400" />,
                      subIcon: <FileText size={12} className="text-slate-400 mt-0.5 shrink-0" />,
                    },
                  ].map(({ key, title, icon, subIcon }) => (
                    <div
                      key={key}
                      className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        {icon}
                        <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
                      </div>
                      {(insightsByType[key] || []).length === 0 ? (
                        <p className="text-sm text-slate-500">
                          {t(
                            'finance.analysis.noInsights',
                            'Run the analysis to generate insights'
                          )}
                        </p>
                      ) : (
                        (insightsByType[key] || []).slice(0, 5).map((i) => (
                          <div
                            key={i.id}
                            className="flex items-start gap-2 py-1.5 border-b border-slate-200 dark:border-navy-700 last:border-0"
                          >
                            {subIcon}
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              {key === 'quality_note' ? i.description : i.title}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  ))}
                  {insights.length > 0 && (
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => {
                          const summary = insights
                            .map((i) => `[${i.insight_type}] ${i.title}: ${i.description}`)
                            .join('\n');
                          const prompt = encodeURIComponent(
                            `Refine and deepen the following financial analysis insights for ${selected?.title || 'this analysis'}:\n\n${summary}\n\nProvide additional context, actionable recommendations, and risk mitigations.`
                          );
                          navigate(`/chat?prompt=${prompt}`);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 transition-colors"
                      >
                        <Lightbulb size={12} />
                        {t('finance.analysis.refineWithAI', 'Refine with AI')}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'ratios' && (
                <div className="space-y-4">
                  {Object.keys(groupedRatios).length === 0 ? (
                    <p className="text-sm text-slate-500">
                      {t(
                        'finance.analysis.noRatios',
                        'Run the analysis to compute financial ratios'
                      )}
                    </p>
                  ) : (
                    Object.entries(groupedRatios).map(([cat, items]) => (
                      <div
                        key={cat}
                        className="bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden"
                      >
                        <div className="px-4 py-2 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white capitalize">
                            {cat}
                          </h3>
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-slate-500">
                              <th className="px-4 py-2">Ratio</th>
                              <th className="px-4 py-2">
                                {t('finance.analysis.period', 'Period')}
                              </th>
                              <th className="px-4 py-2 text-right">
                                {t('finance.analysis.value', 'Value')}
                              </th>
                              <th className="px-4 py-2 text-right">
                                {t('finance.analysis.benchmark', 'Benchmark')}
                              </th>
                              <th className="px-4 py-2 w-32">
                                {t('finance.analysis.position', 'Position')}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((r) => {
                              const bv = r.benchmark_value;
                              let bandStatus: 'ok' | 'warn' | 'crit' | 'none' = 'none';
                              if (bv != null && bv > 0) {
                                const ratio = r.value / bv;
                                if (ratio >= 0.9) bandStatus = 'ok';
                                else if (ratio >= 0.6) bandStatus = 'warn';
                                else bandStatus = 'crit';
                              }
                              const bandColor =
                                bandStatus === 'ok'
                                  ? 'bg-emerald-500'
                                  : bandStatus === 'warn'
                                    ? 'bg-amber-500'
                                    : bandStatus === 'crit'
                                      ? 'bg-red-500'
                                      : 'bg-slate-300 dark:bg-navy-600';
                              const bandWidth =
                                bv != null && bv > 0
                                  ? `${Math.min(100, Math.max(5, (r.value / bv) * 100))}%`
                                  : '0%';
                              return (
                                <tr
                                  key={r.id}
                                  className="border-t border-slate-200 dark:border-navy-700"
                                >
                                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                                    {r.ratio_name}
                                  </td>
                                  <td className="px-4 py-2 text-slate-500">{r.period}</td>
                                  <td className="px-4 py-2 text-right font-mono text-slate-900 dark:text-white">
                                    {r.value != null ? fmtNumber.format(r.value) : '—'}
                                  </td>
                                  <td className="px-4 py-2 text-right font-mono text-slate-500">
                                    {bv != null ? fmtNumber.format(bv) : '—'}
                                  </td>
                                  <td className="px-4 py-2">
                                    {bv != null ? (
                                      <div className="flex items-center gap-2">
                                        <div className="relative flex-1 h-2.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                                          <div
                                            className={`h-full rounded-full transition-all duration-300 ${bandColor}`}
                                            style={{ width: bandWidth }}
                                          />
                                          <div
                                            className="absolute top-0 h-full w-px bg-slate-900/30 dark:bg-white/30"
                                            style={{ left: '100%' }}
                                            title={`Benchmark: ${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(bv)}`}
                                          />
                                        </div>
                                        <span
                                          className={`text-[10px] font-bold min-w-[3rem] text-right ${bandStatus === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : bandStatus === 'warn' ? 'text-amber-600 dark:text-amber-400' : bandStatus === 'crit' ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}
                                        >
                                          {bv > 0
                                            ? `${Math.round((r.value / bv) * 100)}%`
                                            : '—'}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-slate-400">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))
                  )}
                </div>
              )}
              {activeTab === 'insights' && (
                <div className="space-y-2">
                  {insights.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      {t('finance.analysis.noInsights', 'Run the analysis to generate insights')}
                    </p>
                  ) : (
                    insights.map((ins) => (
                      <div
                        key={ins.id}
                        className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 text-xs rounded-lg font-medium capitalize ${ins.insight_type === 'driver' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' : ins.insight_type === 'risk' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : ins.insight_type === 'action' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400'}`}
                          >
                            {ins.insight_type}
                          </span>
                          <span className="font-medium text-sm text-slate-900 dark:text-white">
                            {ins.title}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {ins.description}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
              {activeTab === 'horizontal' &&
                (() => {
                  const periods = [...new Set(ratios.map((r) => r.period))].sort();
                  const ratiosByCode = new Map<
                    string,
                    { name: string; values: Map<string, number> }
                  >();
                  for (const r of ratios) {
                    if (!ratiosByCode.has(r.ratio_code)) {
                      ratiosByCode.set(r.ratio_code, { name: r.ratio_name, values: new Map() });
                    }
                    ratiosByCode.get(r.ratio_code)!.values.set(r.period, r.value);
                  }
                  if (periods.length < 2 || ratiosByCode.size === 0) {
                    return (
                      <p className="text-sm text-slate-500">
                        {t(
                          'finance.analysis.noHorizontal',
                          'Run the analysis to see period comparisons'
                        )}
                      </p>
                    );
                  }
                  return (
                    <div className="bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-navy-700">
                            <th className="px-4 py-2 sticky left-0 bg-slate-50 dark:bg-navy-800">
                              Ratio
                            </th>
                            {periods.map((p) => (
                              <th key={p} className="px-3 py-2 text-right">
                                {p}
                              </th>
                            ))}
                            <th className="px-3 py-2 text-right">Δ %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...ratiosByCode.entries()].map(([code, { name, values }]) => {
                            const first = values.get(periods[0]);
                            const last = values.get(periods[periods.length - 1]);
                            const pctChange =
                              first && first !== 0 && last != null
                                ? ((last - first) / Math.abs(first)) * 100
                                : null;
                            return (
                              <tr
                                key={code}
                                className="border-t border-slate-200 dark:border-navy-700"
                              >
                                <td className="px-4 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap sticky left-0 bg-slate-50 dark:bg-navy-800">
                                  {name}
                                </td>
                                {periods.map((p) => (
                                  <td
                                    key={p}
                                    className="px-3 py-2 text-right font-mono text-slate-900 dark:text-white"
                                  >
                                    {values.has(p) ? fmtNumber.format(values.get(p)!) : '—'}
                                  </td>
                                ))}
                                <td
                                  className={`px-3 py-2 text-right font-mono font-semibold ${
                                    pctChange != null && Math.abs(pctChange) > 10
                                      ? pctChange > 0
                                        ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
                                        : 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20'
                                      : pctChange != null && pctChange > 0
                                        ? 'text-emerald-500'
                                        : pctChange != null && pctChange < 0
                                          ? 'text-red-500'
                                          : 'text-slate-400'
                                  }`}
                                >
                                  {pctChange != null
                                    ? `${pctChange > 0 ? '+' : ''}${pctChange.toFixed(1)}%`
                                    : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
            </div>
          </>
        )}
      </div>
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('finance.analysis.createTitle', 'New Financial Analysis')}
              </h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t('finance.analysis.titlePlaceholder', 'e.g., Q4 2025 Financial Review')}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-500"
              >
                {t('common.create', 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LivePreviewPanel: React.FC<{
  ratios: Ratio[];
  groupedRatios: Record<string, Ratio[]>;
  onSave: (title: string) => Promise<void>;
  onClose: () => void;
  t: TFunction;
}> = ({ ratios, groupedRatios, onSave, onClose, t }) => {
  const [saveTitle, setSaveTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const fmtNumber = useMemo(
    () => new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    []
  );

  const handleSave = async () => {
    if (!saveTitle.trim()) return;
    setSaving(true);
    await onSave(saveTitle.trim());
    setSaving(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 bg-emerald-50 dark:bg-emerald-900/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye size={16} className="text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            {t('finance.analysis.livePreviewMode', 'Live Preview Mode')}
          </span>
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            ({ratios.length} {t('finance.analysis.ratiosComputed', 'ratios computed')})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={saveTitle}
            onChange={(e) => setSaveTitle(e.target.value)}
            placeholder={t('finance.analysis.saveTitlePlaceholder', 'Analysis title...') as string}
            className="px-2 py-1 text-xs border border-slate-300 dark:border-navy-600 rounded bg-white dark:bg-navy-800 w-48"
          />
          <button
            onClick={handleSave}
            disabled={saving || !saveTitle.trim()}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {t('finance.analysis.saveAsAnalysis', 'Save as Analysis')}
          </button>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {Object.keys(groupedRatios).length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-8">
            {t(
              'finance.analysis.noLiveData',
              'No data available. Ensure financial models exist to analyze.'
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedRatios).map(([cat, items]) => (
              <div key={cat}>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {cat}
                </h4>
                <div className="bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-navy-700">
                        <th className="px-4 py-2">{t('finance.analysis.ratioName', 'Ratio')}</th>
                        <th className="px-4 py-2">{t('finance.analysis.period', 'Period')}</th>
                        <th className="px-4 py-2 text-right">
                          {t('finance.analysis.value', 'Value')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((r) => (
                        <tr key={r.id} className="border-t border-slate-200 dark:border-navy-700">
                          <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                            {r.ratio_name}
                          </td>
                          <td className="px-4 py-2 text-slate-500">{r.period}</td>
                          <td className="px-4 py-2 text-right font-mono text-slate-900 dark:text-white">
                            {r.value != null ? fmtNumber.format(r.value) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialAnalysisWorkspace;
