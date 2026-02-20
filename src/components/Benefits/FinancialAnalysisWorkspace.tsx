import { AlertTriangle, BarChart3, CheckCircle2, ChevronRight, FileText, Lightbulb, Loader2, Play, Plus, Shield, TrendingUp, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { API_URL, getHeaders } from '../../services/api';
import { trackFunnelEvent } from '../../services/funnelAnalytics';

interface Analysis { id: string; title: string; status: string; analysisType: string; currency: string; periods: string[]; createdAt: string; }
interface Ratio { id: string; category: string; ratio_code: string; ratio_name: string; value: number; period: string; benchmark_value?: number; }
interface Insight { id: string; insight_type: string; title: string; description: string; priority: number; }

export const FinancialAnalysisWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [selected, setSelected] = useState<Analysis | null>(null);
  const [ratios, setRatios] = useState<Ratio[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'ratios' | 'insights' | 'horizontal'>('overview');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const fetchAnalyses = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/economics/financial-analyses`, { headers: getHeaders() });
      if (res.ok) { const d = await res.json(); setAnalyses(d.analyses || []); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAnalyses(); }, [fetchAnalyses]);

  const selectAnalysis = useCallback(async (a: Analysis) => {
    setSelected(a);
    try {
      const [rr, ir] = await Promise.all([
        fetch(`${API_URL}/economics/financial-analyses/${a.id}/ratios`, { headers: getHeaders() }),
        fetch(`${API_URL}/economics/financial-analyses/${a.id}/insights`, { headers: getHeaders() }),
      ]);
      if (rr.ok) { const d = await rr.json(); setRatios(d.ratios || []); }
      if (ir.ok) { const d = await ir.json(); setInsights(d.insights || []); }
    } catch { /* ignore */ }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch(`${API_URL}/economics/financial-analyses`, { method: 'POST', headers: { ...getHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle }) });
      if (res.ok) { const d = await res.json(); setShowCreate(false); setNewTitle(''); await fetchAnalyses(); if (d.analysis) setSelected(d.analysis); }
    } catch { toast.error('Failed to create analysis'); }
  }, [newTitle, fetchAnalyses]);

  const handleRun = useCallback(async () => {
    if (!selected) return;
    setRunning(true);
    try {
      const res = await fetch(`${API_URL}/economics/financial-analyses/${selected.id}/run`, { method: 'POST', headers: getHeaders() });
      if (res.ok) { toast.success(t('finance.analysis.runSuccess', 'Analysis completed')); trackFunnelEvent('finance_analysis_generated', { analysisId: selected.id }); await selectAnalysis(selected); await fetchAnalyses(); }
    } catch { toast.error('Run failed'); } finally { setRunning(false); }
  }, [selected, t, selectAnalysis, fetchAnalyses]);

  const handleApprove = useCallback(async () => {
    if (!selected) return;
    try {
      const res = await fetch(`${API_URL}/economics/financial-analyses/${selected.id}/approve`, { method: 'POST', headers: getHeaders() });
      if (res.ok) { toast.success(t('finance.analysis.approved', 'Analysis approved')); trackFunnelEvent('finance_analysis_approved', { analysisId: selected.id }); await fetchAnalyses(); }
    } catch { toast.error('Approve failed'); }
  }, [selected, t, fetchAnalyses]);

  const groupedRatios = useMemo(() => {
    const groups: Record<string, Ratio[]> = {};
    for (const r of ratios) { if (!groups[r.category]) groups[r.category] = []; groups[r.category].push(r); }
    return groups;
  }, [ratios]);

  const insightsByType = useMemo(() => {
    const map: Record<string, Insight[]> = { driver: [], risk: [], action: [], quality_note: [] };
    for (const ins of insights) { if (!map[ins.insight_type]) map[ins.insight_type] = []; map[ins.insight_type].push(ins); }
    return map;
  }, [insights]);

  const tabItems = [
    { id: 'overview' as const, label: t('finance.analysis.tabs.overview', 'Overview'), icon: <BarChart3 size={14} /> },
    { id: 'ratios' as const, label: t('finance.analysis.tabs.ratios', 'Ratios'), icon: <TrendingUp size={14} /> },
    { id: 'insights' as const, label: t('finance.analysis.tabs.insights', 'Insights'), icon: <Lightbulb size={14} /> },
    { id: 'horizontal' as const, label: t('finance.analysis.tabs.horizontal', 'Period Comparison'), icon: <FileText size={14} /> },
  ];

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 text-purple-500 animate-spin" /></div>;

  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex flex-col">
        <div className="p-3 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('finance.analysis.title', 'Financial Analysis')}</h3>
          <button onClick={() => setShowCreate(true)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800 text-purple-500"><Plus size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {analyses.length === 0 ? <p className="text-xs text-slate-500 dark:text-slate-400 p-2">{t('finance.analysis.noAnalyses', 'No analyses yet')}</p> : analyses.map((a) => (
            <button key={a.id} onClick={() => selectAnalysis(a)} className={`w-full text-left p-2 rounded-lg text-sm transition ${selected?.id === a.id ? 'bg-purple-500/20 text-purple-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'}`}>
              <div className="font-medium truncate">{a.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{a.status}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400">{t('finance.analysis.selectOrCreate', 'Select an analysis or create a new one')}</div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between bg-white dark:bg-navy-900">
              <div><h2 className="text-lg font-semibold text-slate-900 dark:text-white">{selected.title}</h2><p className="text-xs text-slate-500">{selected.status} · {selected.currency}</p></div>
              <div className="flex items-center gap-2">
                <button onClick={handleRun} disabled={running} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-500 disabled:opacity-50">{running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}{t('finance.analysis.run', 'Run Analysis')}</button>
                <button onClick={handleApprove} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-500"><CheckCircle2 size={14} />{t('finance.analysis.approve', 'Approve')}</button>
              </div>
            </div>
            <div className="border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-4 flex gap-1">
              {tabItems.map((tab) => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition ${activeTab === tab.id ? 'border-purple-500 text-purple-500' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>{tab.icon} {tab.label}</button>))}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'overview' && (
                <div className="grid grid-cols-2 gap-4">
                  {[{ key: 'driver', title: t('finance.analysis.topDrivers', 'Top Drivers'), icon: <TrendingUp size={16} className="text-blue-400" />, subIcon: <ChevronRight size={12} className="text-blue-400 mt-0.5 shrink-0" /> },
                    { key: 'risk', title: t('finance.analysis.keyRisks', 'Key Risks'), icon: <AlertTriangle size={16} className="text-amber-400" />, subIcon: <Shield size={12} className="text-amber-400 mt-0.5 shrink-0" /> },
                    { key: 'action', title: t('finance.analysis.actions', 'Actions'), icon: <Lightbulb size={16} className="text-green-400" />, subIcon: <Lightbulb size={12} className="text-green-400 mt-0.5 shrink-0" /> },
                    { key: 'quality_note', title: t('finance.analysis.dataQuality', 'Data Quality'), icon: <FileText size={16} className="text-slate-400" />, subIcon: <FileText size={12} className="text-slate-400 mt-0.5 shrink-0" /> },
                  ].map(({ key, title, icon, subIcon }) => (
                    <div key={key} className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
                      <div className="flex items-center gap-2 mb-3">{icon}<h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3></div>
                      {(insightsByType[key] || []).length === 0
                        ? <p className="text-sm text-slate-500">{t('finance.analysis.noInsights', 'Run the analysis to generate insights')}</p>
                        : (insightsByType[key] || []).slice(0, 5).map((i) => (
                          <div key={i.id} className="flex items-start gap-2 py-1.5 border-b border-slate-200 dark:border-navy-700 last:border-0">{subIcon}<span className="text-sm text-slate-700 dark:text-slate-300">{key === 'quality_note' ? i.description : i.title}</span></div>
                        ))}
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 'ratios' && (
                <div className="space-y-4">
                  {Object.keys(groupedRatios).length === 0 ? <p className="text-sm text-slate-500">{t('finance.analysis.noRatios', 'Run the analysis to compute financial ratios')}</p> : Object.entries(groupedRatios).map(([cat, items]) => (
                    <div key={cat} className="bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                      <div className="px-4 py-2 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700"><h3 className="text-sm font-semibold text-slate-900 dark:text-white capitalize">{cat}</h3></div>
                      <table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500"><th className="px-4 py-2">Ratio</th><th className="px-4 py-2">{t('finance.analysis.period', 'Period')}</th><th className="px-4 py-2 text-right">{t('finance.analysis.value', 'Value')}</th></tr></thead>
                      <tbody>{items.map((r) => (<tr key={r.id} className="border-t border-slate-200 dark:border-navy-700"><td className="px-4 py-2 text-slate-700 dark:text-slate-300">{r.ratio_name}</td><td className="px-4 py-2 text-slate-500">{r.period}</td><td className="px-4 py-2 text-right font-mono text-slate-900 dark:text-white">{r.value?.toFixed(2) ?? '—'}</td></tr>))}</tbody></table>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 'insights' && (
                <div className="space-y-2">
                  {insights.length === 0 ? <p className="text-sm text-slate-500">{t('finance.analysis.noInsights', 'Run the analysis to generate insights')}</p> : insights.map((ins) => (
                    <div key={ins.id} className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${ins.insight_type === 'driver' ? 'bg-blue-500/20 text-blue-400' : ins.insight_type === 'risk' ? 'bg-amber-500/20 text-amber-400' : ins.insight_type === 'action' ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>{ins.insight_type}</span>
                        <span className="font-medium text-sm text-slate-900 dark:text-white">{ins.title}</span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{ins.description}</p>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 'horizontal' && <p className="text-sm text-slate-500">{t('finance.analysis.noHorizontal', 'Run the analysis to see period comparisons')}</p>}
            </div>
          </>
        )}
      </div>
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('finance.analysis.createTitle', 'New Financial Analysis')}</h2><button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t('finance.analysis.titlePlaceholder', 'e.g., Q4 2025 Financial Review')} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm mb-4" />
            <div className="flex justify-end gap-2"><button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Cancel</button><button onClick={handleCreate} className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-500">Create</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialAnalysisWorkspace;
