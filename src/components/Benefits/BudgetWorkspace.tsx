import { CheckCircle2, Loader2, Lock, Play, Plus, Unlock, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { API_URL, getHeaders } from '../../services/api';
import { trackFunnelEvent } from '../../services/funnelAnalytics';

interface BudgetSummary { id: string; title: string; status: string; periodStart: string; periodEnd: string; granularity: string; currency: string; version: number; createdAt: string; }
interface BudgetLineItem { id: string; lineCode: string; lineName: string; statementType: string; source: string; baselineValue: number; isLocked: boolean; displayOrder: number; }
interface Scenario { id: string; scenarioType: string; name: string; adjustments: Record<string, number>; projections: { periods?: string[]; lines?: Record<string, Record<string, number>> }; summaryMetrics: Record<string, number>; isActive: boolean; }

const SCENARIO_COLORS: Record<string, string> = { base: 'text-blue-400 bg-blue-500/20 border-blue-500/30', optimistic: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30', conservative: 'text-amber-400 bg-amber-500/20 border-amber-500/30' };

export const BudgetWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const [budgets, setBudgets] = useState<BudgetSummary[]>([]);
  const [selected, setSelected] = useState<BudgetSummary | null>(null);
  const [lines, setLines] = useState<BudgetLineItem[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'inputs' | 'projections' | 'scenarios'>('inputs');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [startPeriod, setStartPeriod] = useState('2026-01');
  const [endPeriod, setEndPeriod] = useState('2026-12');

  const fetchBudgets = useCallback(async () => {
    try { const res = await fetch(`${API_URL}/economics/budgets`, { headers: getHeaders() }); if (res.ok) { const d = await res.json(); setBudgets(d.budgets || []); } } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  const selectBudget = useCallback(async (b: BudgetSummary) => {
    setSelected(b);
    try { const res = await fetch(`${API_URL}/economics/budgets/${b.id}`, { headers: getHeaders() }); if (res.ok) { const d = await res.json(); setLines(d.lines || []); setScenarios(d.scenarios || []); } } catch { /* ignore */ }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    try { const res = await fetch(`${API_URL}/economics/budgets`, { method: 'POST', headers: { ...getHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle, periodStart: startPeriod, periodEnd: endPeriod }) }); if (res.ok) { const d = await res.json(); trackFunnelEvent('budget_created', { budgetId: d.budget?.id }); setShowCreate(false); setNewTitle(''); await fetchBudgets(); if (d.budget) setSelected(d.budget); } } catch { toast.error('Failed to create budget'); }
  }, [newTitle, startPeriod, endPeriod, fetchBudgets]);

  const handleGenerate = useCallback(async () => {
    if (!selected || scenarios.length === 0) return;
    setGenerating(true);
    try { for (const sc of scenarios) { await fetch(`${API_URL}/economics/budgets/${selected.id}/scenarios/${sc.id}/project`, { method: 'POST', headers: getHeaders() }); } toast.success(t('finance.budget.projected', 'Projections generated')); await selectBudget(selected); } catch { toast.error('Generation failed'); } finally { setGenerating(false); }
  }, [selected, scenarios, t, selectBudget]);

  const handleApprove = useCallback(async () => {
    if (!selected) return;
    try { const res = await fetch(`${API_URL}/economics/budgets/${selected.id}/approve`, { method: 'POST', headers: getHeaders() }); if (res.ok) { toast.success(t('finance.budget.approved', 'Budget approved')); trackFunnelEvent('budget_approved', { budgetId: selected.id }); await fetchBudgets(); } } catch { toast.error('Approve failed'); }
  }, [selected, t, fetchBudgets]);

  const handleLineUpdate = useCallback(async (lineId: string, value: number) => {
    if (!selected) return;
    try { await fetch(`${API_URL}/economics/budgets/${selected.id}/lines/${lineId}`, { method: 'PUT', headers: { ...getHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ baselineValue: value }) }); setLines((prev) => prev.map((l) => l.id === lineId ? { ...l, baselineValue: value } : l)); } catch { /* ignore */ }
  }, [selected]);

  const handleToggleLock = useCallback(async (lineId: string, isLocked: boolean) => {
    if (!selected) return;
    try { await fetch(`${API_URL}/economics/budgets/${selected.id}/lines/${lineId}`, { method: 'PUT', headers: { ...getHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ isLocked: !isLocked }) }); setLines((prev) => prev.map((l) => l.id === lineId ? { ...l, isLocked: !isLocked } : l)); } catch { /* ignore */ }
  }, [selected]);

  const plLines = useMemo(() => lines.filter((l) => l.statementType === 'P&L'), [lines]);
  const cfLines = useMemo(() => lines.filter((l) => l.statementType === 'CF'), [lines]);
  const activeScenario = useMemo(() => scenarios.find((s) => s.isActive) || scenarios[0], [scenarios]);
  const projectionPeriods = activeScenario?.projections?.periods || [];

  const tabItems = [
    { id: 'inputs' as const, label: t('finance.budget.tabs.inputs', 'Inputs') },
    { id: 'projections' as const, label: t('finance.budget.tabs.projections', 'Projections') },
    { id: 'scenarios' as const, label: t('finance.budget.tabs.scenarios', 'Scenario Comparison') },
  ];

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 text-purple-500 animate-spin" /></div>;

  const renderLineTable = (tableLines: BudgetLineItem[], title: string) => (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
      <div className="bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-navy-700"><th className="px-4 py-2">{t('finance.budget.line', 'Line')}</th><th className="px-4 py-2 text-right">Baseline ({selected?.currency})</th><th className="px-4 py-2 w-12"></th></tr></thead>
          <tbody>{tableLines.map((line) => (
            <tr key={line.id} className="border-b border-slate-200 dark:border-navy-700 last:border-0">
              <td className="px-4 py-2 text-slate-700 dark:text-slate-300 font-medium">{line.lineName}</td>
              <td className="px-4 py-2 text-right"><input type="number" value={line.baselineValue} onChange={(e) => handleLineUpdate(line.id, Number(e.target.value))} disabled={line.isLocked} className="w-32 text-right px-2 py-1 rounded border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm disabled:opacity-50" /></td>
              <td className="px-4 py-2"><button onClick={() => handleToggleLock(line.id, line.isLocked)} className="text-slate-400 hover:text-slate-600">{line.isLocked ? <Lock size={14} /> : <Unlock size={14} />}</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex flex-col">
        <div className="p-3 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('finance.budget.title', 'Budget Planning')}</h3>
          <button onClick={() => setShowCreate(true)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800 text-purple-500"><Plus size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {budgets.length === 0 ? <p className="text-xs text-slate-500 dark:text-slate-400 p-2">{t('finance.budget.noBudgets', 'No budgets yet')}</p> : budgets.map((b) => (
            <button key={b.id} onClick={() => selectBudget(b)} className={`w-full text-left p-2 rounded-lg text-sm transition ${selected?.id === b.id ? 'bg-purple-500/20 text-purple-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'}`}>
              <div className="font-medium truncate">{b.title}</div><div className="text-xs text-slate-500 mt-0.5">{b.status} · v{b.version}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400">{t('finance.budget.selectOrCreate', 'Select a budget or create a new one')}</div> : (
          <>
            <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between bg-white dark:bg-navy-900">
              <div><h2 className="text-lg font-semibold text-slate-900 dark:text-white">{selected.title}</h2><p className="text-xs text-slate-500">{selected.periodStart} → {selected.periodEnd} · {selected.granularity} · {selected.currency} · v{selected.version}</p></div>
              <div className="flex items-center gap-2">
                <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-500 disabled:opacity-50">{generating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}{t('finance.budget.project', 'Generate Projections')}</button>
                <button onClick={handleApprove} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-500"><CheckCircle2 size={14} />{t('finance.budget.approve', 'Approve')}</button>
              </div>
            </div>
            <div className="border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-4 flex gap-1">
              {tabItems.map((tab) => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-3 py-2 text-sm border-b-2 transition ${activeTab === tab.id ? 'border-purple-500 text-purple-500' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>{tab.label}</button>))}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'inputs' && <div className="space-y-6">{renderLineTable(plLines, `${t('finance.budget.baselines', 'Baselines')} — P&L`)}{renderLineTable(cfLines, t('finance.budget.cashFlow', 'Cash Flow'))}</div>}
              {activeTab === 'projections' && (projectionPeriods.length === 0 ? <p className="text-sm text-slate-500">{t('finance.budget.noProjections', 'Click "Generate Projections" to compute')}</p> : (
                <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-navy-700"><th className="px-3 py-2 sticky left-0 bg-white dark:bg-navy-900">{t('finance.budget.line', 'Line')}</th>{projectionPeriods.map((p) => <th key={p} className="px-3 py-2 text-right">{p}</th>)}</tr></thead>
                <tbody>{lines.map((line) => (<tr key={line.id} className="border-b border-slate-200 dark:border-navy-700"><td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-navy-900">{line.lineName}</td>{projectionPeriods.map((p) => <td key={p} className="px-3 py-2 text-right font-mono text-slate-900 dark:text-white">{(activeScenario?.projections?.lines?.[line.lineCode]?.[p] ?? 0).toLocaleString()}</td>)}</tr>)}</tbody></table></div>
              ))}
              {activeTab === 'scenarios' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">{scenarios.map((sc) => (
                    <div key={sc.id} className={`rounded-xl p-4 border ${SCENARIO_COLORS[sc.scenarioType] || 'border-slate-200 dark:border-navy-700'}`}>
                      <div className="flex items-center justify-between mb-3"><h4 className="font-semibold text-slate-900 dark:text-white">{sc.name}</h4>{sc.isActive && <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">Active</span>}</div>
                      <div className="space-y-1 text-sm"><div className="flex justify-between"><span className="text-slate-500">{t('finance.budget.totalRevenue', 'Revenue')}</span><span className="font-mono text-slate-900 dark:text-white">{(sc.summaryMetrics?.totalRevenue ?? 0).toLocaleString()}</span></div><div className="flex justify-between"><span className="text-slate-500">{t('finance.budget.netIncome', 'Net Income')}</span><span className="font-mono text-slate-900 dark:text-white">{(sc.summaryMetrics?.netIncome ?? 0).toLocaleString()}</span></div></div>
                    </div>
                  ))}</div>
                  {scenarios.length > 0 && (
                    <div className="bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                      <div className="px-4 py-2 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900"><h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('finance.budget.scenarioDiff', 'Scenario Comparison')}</h3></div>
                      <table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-navy-700"><th className="px-4 py-2">{t('finance.budget.metric', 'Metric')}</th>{scenarios.map((sc) => <th key={sc.id} className="px-4 py-2 text-right">{sc.name}</th>)}</tr></thead>
                      <tbody>{['totalRevenue', 'grossProfit', 'ebitda', 'netIncome', 'operatingCF', 'fcf'].map((metric) => (
                        <tr key={metric} className="border-b border-slate-200 dark:border-navy-700 last:border-0"><td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 capitalize">{metric.replace(/([A-Z])/g, ' $1').trim()}</td>{scenarios.map((sc) => <td key={sc.id} className="px-4 py-2 text-right font-mono text-slate-900 dark:text-white">{((sc.summaryMetrics as any)?.[metric] ?? 0).toLocaleString()}</td>)}</tr>
                      ))}</tbody></table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('finance.budget.createTitle', 'New Budget')}</h2><button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>
            <div className="space-y-3 mb-4">
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t('finance.budget.titlePlaceholder', 'e.g., 2026 Operating Budget')} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-500 mb-1 block">{t('finance.budget.startPeriod', 'Start')}</label><input type="month" value={startPeriod} onChange={(e) => setStartPeriod(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm" /></div>
                <div><label className="text-xs text-slate-500 mb-1 block">{t('finance.budget.endPeriod', 'End')}</label><input type="month" value={endPeriod} onChange={(e) => setEndPeriod(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm" /></div>
              </div>
            </div>
            <div className="flex justify-end gap-2"><button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Cancel</button><button onClick={handleCreate} className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-500">Create</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetWorkspace;
