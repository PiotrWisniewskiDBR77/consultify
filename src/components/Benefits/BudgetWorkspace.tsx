import {
  CheckCircle2,
  ExternalLink,
  FileUp,
  Loader2,
  Lock,
  Play,
  Plus,
  TrendingUp,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { LoadingState } from '@/components/shared/states';
import { V8FinanceApi } from '@/services/api/v8/finance';

import { API_URL, getHeaders } from '../../services/api';
import { trackFunnelEvent } from '../../services/funnelAnalytics';

interface BudgetSummary {
  id: string;
  title: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  granularity: string;
  currency: string;
  version: number;
  createdAt: string;
}
interface BudgetLineItem {
  id: string;
  lineCode: string;
  lineName: string;
  statementType: string;
  source: string;
  baselineValue: number;
  isLocked: boolean;
  displayOrder: number;
}
interface Scenario {
  id: string;
  scenarioType: string;
  name: string;
  adjustments: Record<string, number>;
  projections: { periods?: string[]; lines?: Record<string, Record<string, number>> };
  summaryMetrics: Record<string, number>;
  isActive: boolean;
}

interface LinkedInitiative {
  id: string;
  title: string;
  status: string;
  revenueUplift: number;
  costSavings: number;
  capexRequired: number;
}

const SCENARIO_COLORS: Record<string, string> = {
  base: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
  optimistic: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
  conservative: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300',
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  approved: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  archived: 'bg-slate-100 dark:bg-navy-700 text-slate-500 dark:text-slate-400',
  in_progress: 'bg-primary-500/10 text-primary-600 dark:text-primary-400',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  planned: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

const getStatusBadgeClass = (status: string): string =>
  STATUS_BADGE_COLORS[status.toLowerCase().replace(/[\s-]/g, '_')] ||
  'bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300';

interface BudgetWorkspaceProps {
  initialBudgetId?: string;
  hideSidebar?: boolean;
  onBudgetChanged?: () => void;
}

export const BudgetWorkspace: React.FC<BudgetWorkspaceProps> = ({
  initialBudgetId,
  hideSidebar,
  onBudgetChanged,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState<BudgetSummary[]>([]);
  const [selected, setSelected] = useState<BudgetSummary | null>(null);
  const [lines, setLines] = useState<BudgetLineItem[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'inputs' | 'projections' | 'scenarios' | 'initiatives'
  >('inputs');
  const [showCreate, setShowCreate] = useState(false);
  const [linkedInitiatives, setLinkedInitiatives] = useState<LinkedInitiative[]>([]);
  const [linkingInitiative, setLinkingInitiative] = useState(false);
  const [availableInitiatives, setAvailableInitiatives] = useState<any[]>([]);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [showDocImport, setShowDocImport] = useState(false);
  const [docImportFile, setDocImportFile] = useState<File | null>(null);
  const [docImporting, setDocImporting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [startPeriod, setStartPeriod] = useState('');
  const [endPeriod, setEndPeriod] = useState('');
  const [createIntentKey, setCreateIntentKey] = useState(() => crypto.randomUUID());

  const fetchBudgets = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/economics/budgets`, { headers: getHeaders() });
      if (res.ok) {
        const d = await res.json();
        setBudgets(d.budgets || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const fetchLinkedInitiatives = useCallback(async (budgetId: string) => {
    try {
      const res = await fetch(`${API_URL}/economics/budgets/${budgetId}/initiatives`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const d = await res.json();
        setLinkedInitiatives(d.initiatives || []);
      }
    } catch {
      setLinkedInitiatives([]);
    }
  }, []);

  const selectBudget = useCallback(
    async (b: BudgetSummary) => {
      setSelected(b);
      try {
        const res = await fetch(`${API_URL}/economics/budgets/${b.id}`, { headers: getHeaders() });
        if (res.ok) {
          const d = await res.json();
          setSelected((current) =>
            current?.id === b.id
              ? {
                  ...current,
                  version: Number(d.version ?? current.version),
                  status: String(d.status ?? current.status),
                }
              : current
          );
          setLines(d.lines || []);
          setScenarios(d.scenarios || []);
        }
      } catch {
        /* ignore */
      }
      fetchLinkedInitiatives(b.id);
    },
    [fetchLinkedInitiatives]
  );

  useEffect(() => {
    if (initialBudgetId && budgets.length > 0 && !selected) {
      const match = budgets.find((b) => b.id === initialBudgetId);
      if (match) selectBudget(match);
    }
  }, [initialBudgetId, budgets, selected, selectBudget]);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim() || !startPeriod || !endPeriod || startPeriod > endPeriod) return;
    try {
      const [endYear, endMonth] = endPeriod.split('-').map(Number);
      const result = await V8FinanceApi.createBudget(
        {
          title: newTitle.trim(),
          periodStart: `${startPeriod}-01`,
          periodEnd: new Date(Date.UTC(endYear, endMonth, 0)).toISOString().slice(0, 10),
          granularity: 'monthly',
          currency: 'PLN',
          sourceKind: 'manual',
        },
        createIntentKey
      );
      trackFunnelEvent('budget_created', { budgetId: result.budget.id });
      setShowCreate(false);
      setNewTitle('');
      setStartPeriod('');
      setEndPeriod('');
      setCreateIntentKey(crypto.randomUUID());
      await fetchBudgets();
      if (result.budget) selectBudget(result.budget as BudgetSummary);
      onBudgetChanged?.();
    } catch {
      toast.error(t('finance.budget.createFailed', 'Failed to create budget'));
    }
  }, [
    newTitle,
    startPeriod,
    endPeriod,
    createIntentKey,
    fetchBudgets,
    selectBudget,
    onBudgetChanged,
    t,
  ]);

  const handleGenerate = useCallback(async () => {
    if (!selected || scenarios.length === 0) return;
    setGenerating(true);
    try {
      let currentVersion = selected.version;
      for (const sc of scenarios) {
        const result = await V8FinanceApi.projectBudgetScenario(
          selected.id,
          sc.id,
          currentVersion,
          crypto.randomUUID()
        );
        currentVersion = result.budgetVersion;
        setSelected((current) =>
          current?.id === selected.id ? { ...current, version: currentVersion } : current
        );
      }
      toast.success(t('finance.budget.projected', 'Projections generated'));
      await selectBudget({ ...selected, version: currentVersion });
      onBudgetChanged?.();
    } catch {
      toast.error(t('finance.budget.projectFailed', 'Generation failed'));
      await selectBudget(selected);
    } finally {
      setGenerating(false);
    }
  }, [selected, scenarios, t, selectBudget, onBudgetChanged]);

  const handleApprove = useCallback(async () => {
    if (!selected) return;
    try {
      const res = await fetch(`${API_URL}/economics/budgets/${selected.id}/approve`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        toast.success(t('finance.budget.approved', 'Budget approved'));
        trackFunnelEvent('budget_approved', { budgetId: selected.id });
        await fetchBudgets();
        onBudgetChanged?.();
      }
    } catch {
      toast.error(t('finance.budget.approveFailed', 'Approve failed'));
    }
  }, [selected, t, fetchBudgets, onBudgetChanged]);

  const handleLineUpdate = useCallback(
    async (lineId: string, value: number) => {
      if (!selected) return;
      try {
        const result = await V8FinanceApi.updateBudgetLine(
          selected.id,
          lineId,
          { expectedVersion: selected.version, baselineValue: String(value) },
          crypto.randomUUID()
        );
        setSelected((current) =>
          current?.id === selected.id ? { ...current, version: result.budgetVersion } : current
        );
        setLines((prev) =>
          prev.map((line) =>
            line.id === lineId
              ? { ...line, baselineValue: Number(result.line.baselineValue) }
              : line
          )
        );
      } catch {
        await selectBudget(selected);
        toast.error(
          t('finance.budget.lineUpdateFailed', 'Budget line changed; current data reloaded')
        );
      }
    },
    [selected, selectBudget, t]
  );

  const handleToggleLock = useCallback(
    async (lineId: string, isLocked: boolean) => {
      if (!selected) return;
      try {
        const result = await V8FinanceApi.updateBudgetLine(
          selected.id,
          lineId,
          { expectedVersion: selected.version, isLocked: !isLocked },
          crypto.randomUUID()
        );
        setSelected((current) =>
          current?.id === selected.id ? { ...current, version: result.budgetVersion } : current
        );
        setLines((prev) =>
          prev.map((line) =>
            line.id === lineId ? { ...line, isLocked: result.line.isLocked } : line
          )
        );
      } catch {
        await selectBudget(selected);
        toast.error(
          t('finance.budget.lineUpdateFailed', 'Budget line changed; current data reloaded')
        );
      }
    },
    [selected, selectBudget, t]
  );

  const handleLinkInitiative = useCallback(
    async (initiativeId: string) => {
      if (!selected) return;
      setLinkingInitiative(true);
      try {
        const res = await fetch(`${API_URL}/economics/budgets/${selected.id}/initiatives`, {
          method: 'POST',
          headers: { ...getHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ initiativeId }),
        });
        if (res.ok) {
          toast.success(t('finance.budget.initiativeLinked', 'Initiative linked'));
          await fetchLinkedInitiatives(selected.id);
          setShowLinkPicker(false);
        }
      } catch {
        toast.error(t('finance.budget.linkFailed', 'Failed to link initiative'));
      } finally {
        setLinkingInitiative(false);
      }
    },
    [selected, t, fetchLinkedInitiatives]
  );

  const handleUnlinkInitiative = useCallback(
    async (initiativeId: string) => {
      if (!selected) return;
      try {
        await fetch(`${API_URL}/economics/budgets/${selected.id}/initiatives/${initiativeId}`, {
          method: 'DELETE',
          headers: getHeaders(),
        });
        toast.success(t('finance.budget.initiativeUnlinked', 'Initiative unlinked'));
        await fetchLinkedInitiatives(selected.id);
      } catch {
        toast.error(t('finance.budget.unlinkFailed', 'Failed to unlink initiative'));
      }
    },
    [selected, t, fetchLinkedInitiatives]
  );

  const handleOpenLinkPicker = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/initiatives`, { headers: getHeaders() });
      if (res.ok) {
        const d = await res.json();
        setAvailableInitiatives(
          (d.initiatives || d || []).filter(
            (i: any) => !linkedInitiatives.some((li) => li.id === i.id)
          )
        );
      }
    } catch {
      /* ignore */
    }
    setShowLinkPicker(true);
  }, [linkedInitiatives]);

  const handleDocImport = useCallback(async () => {
    if (!docImportFile || !selected) return;
    setDocImporting(true);
    try {
      const documentText = await docImportFile.text();
      const res = await fetch(`${API_URL}/economics/budgets/${selected.id}/import-document`, {
        method: 'POST',
        headers: {
          Authorization: getHeaders()['Authorization'] || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: docImportFile.name,
          documentText,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        toast.success(
          t('finance.budget.docImported', `Imported ${d.linesImported || 0} budget lines`)
        );
        setShowDocImport(false);
        setDocImportFile(null);
        await selectBudget(selected);
        onBudgetChanged?.();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t('finance.budget.importFailed', 'Import failed'));
      }
    } catch {
      toast.error(t('finance.budget.documentImportFailed', 'Document import failed'));
    } finally {
      setDocImporting(false);
    }
  }, [docImportFile, selected, t, selectBudget, onBudgetChanged]);

  const initiativeImpactTotal = useMemo(
    () => ({
      revenueUplift: linkedInitiatives.reduce((s, i) => s + (i.revenueUplift || 0), 0),
      costSavings: linkedInitiatives.reduce((s, i) => s + (i.costSavings || 0), 0),
      capexRequired: linkedInitiatives.reduce((s, i) => s + (i.capexRequired || 0), 0),
    }),
    [linkedInitiatives]
  );

  const plLines = useMemo(() => lines.filter((l) => l.statementType === 'P&L'), [lines]);
  const cfLines = useMemo(() => lines.filter((l) => l.statementType === 'CF'), [lines]);
  const activeScenario = useMemo(
    () => scenarios.find((s) => s.isActive) || scenarios[0],
    [scenarios]
  );
  const projectionPeriods = activeScenario?.projections?.periods || [];

  const fmtNumber = useMemo(
    () => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }),
    []
  );

  const baseScenario = useMemo(() => scenarios.find((s) => s.scenarioType === 'base'), [scenarios]);

  const tabItems = [
    { id: 'inputs' as const, label: t('finance.budget.tabs.inputs', 'Inputs') },
    { id: 'projections' as const, label: t('finance.budget.tabs.projections', 'Projections') },
    { id: 'scenarios' as const, label: t('finance.budget.tabs.scenarios', 'Scenario Comparison') },
    {
      id: 'initiatives' as const,
      label: `${t('finance.budget.tabs.initiatives', 'Initiatives')} (${linkedInitiatives.length})`,
    },
  ];

  if (loading)
    return (
      <div className="h-full p-6">
        <LoadingState template="panel" />
      </div>
    );

  const renderLineTable = (tableLines: BudgetLineItem[], title: string) => (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
      <div className="bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <table
          /* §27-exempt: edytor komorkowy/workspace, edycja cell-by-cell */ className="w-full text-sm"
        >
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-navy-700">
              <th className="px-4 py-2">{t('finance.budget.line', 'Line')}</th>
              <th className="px-4 py-2 text-right">Baseline ({selected?.currency})</th>
              <th className="px-4 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {tableLines.map((line) => (
              <tr
                key={line.id}
                className="border-b border-slate-200 dark:border-navy-700 last:border-0"
              >
                <td className="px-4 py-2 text-slate-700 dark:text-slate-300 font-medium">
                  <div className="flex items-center gap-1.5">
                    {line.lineName}
                    {line.source === 'manual' && (
                      <span
                        title={
                          t(
                            'finance.budget.driverHint',
                            'Consider linking to a KPI driver for automatic projections'
                          ) as string
                        }
                        className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-500 font-semibold uppercase cursor-help"
                      >
                        {t('finance.budget.manual', 'manual')}
                      </span>
                    )}
                    {line.source === 'kpi' && (
                      <span
                        className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold uppercase cursor-default"
                        title={
                          t(
                            'finance.budget.kpiHint',
                            'Driven by linked KPI — updates automatically'
                          ) as string
                        }
                      >
                        KPI
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    value={line.baselineValue}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isFinite(val)) return;
                      handleLineUpdate(line.id, val);
                    }}
                    min={0}
                    step={1000}
                    disabled={line.isLocked}
                    aria-label={`${line.lineName} baseline value`}
                    className="w-32 text-right px-2 py-1 rounded border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-shadow"
                  />
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleToggleLock(line.id, line.isLocked)}
                    className="text-slate-600 hover:text-slate-600"
                  >
                    {line.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      {!hideSidebar && (
        <div className="w-64 border-r border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex flex-col">
          <div className="p-3 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('finance.budget.title', 'Budget Planning')}
            </h3>
            <div className="flex items-center gap-1">
              {selected && (
                <button
                  onClick={() => setShowDocImport(true)}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800 text-emerald-500"
                  title={t('finance.budget.importDocument', 'Import from Document') as string}
                >
                  <FileUp size={16} />
                </button>
              )}
              <button
                onClick={() => setShowCreate(true)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800 text-primary-500"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {budgets.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 p-2">
                {t('finance.budget.noBudgets', 'No budgets yet')}
              </p>
            ) : (
              budgets.map((b) => (
                <button
                  key={b.id}
                  onClick={() => selectBudget(b)}
                  className={`w-full text-left p-2 rounded-lg text-sm transition ${selected?.id === b.id ? 'bg-slate-200/70 dark:bg-white/[0.09] text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'}`}
                >
                  <div className="font-medium truncate">{b.title}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getStatusBadgeClass(b.status)}`}
                    >
                      {b.status}
                    </span>
                    <span className="text-xs text-slate-500">v{b.version}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400">
            {t('finance.budget.selectOrCreate', 'Select a budget or create a new one')}
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between bg-white dark:bg-navy-900">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {selected.title}
                </h2>
                <p className="text-xs text-slate-500">
                  {selected.periodStart} → {selected.periodEnd} · {selected.granularity} ·{' '}
                  {selected.currency} · v{selected.version}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm rounded-lg hover:bg-navy-800 disabled:opacity-50"
                >
                  {generating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  {t('finance.budget.project', 'Generate Projections')}
                </button>
                <button
                  onClick={handleApprove}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-500"
                >
                  <CheckCircle2 size={14} />
                  {t('finance.budget.approve', 'Approve')}
                </button>
                <button
                  onClick={() => {
                    const linesSummary = lines
                      .map(
                        (l) =>
                          `${l.lineName} (${l.statementType}): ${fmtNumber.format(l.baselineValue)} ${selected?.currency}`
                      )
                      .join('\n');
                    const prompt = encodeURIComponent(
                      `Review and validate the following budget assumptions for "${selected?.title}":\n\nPeriod: ${selected?.periodStart} → ${selected?.periodEnd}\nGranularity: ${selected?.granularity}\n\nBudget lines:\n${linesSummary}\n\nPlease:\n1. Validate reasonableness of each line\n2. Flag potential risks or missing items\n3. Suggest improvements to assumptions\n4. Confirm if ready for projection generation`
                    );
                    navigate(`/chat?prompt=${prompt}`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors"
                >
                  <CheckCircle2 size={14} />
                  {t('finance.budget.confirmWithAI', 'Confirm with AI')}
                </button>
                <button
                  onClick={() =>
                    navigate(`/economics?tab=valuation&createFrom=budget&sourceId=${selected.id}`)
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
                >
                  <TrendingUp size={14} />
                  {t('finance.budget.valuate', 'Wycen budżet')}
                </button>
              </div>
            </div>
            <div
              role="tablist"
              className="border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-4 flex gap-1"
            >
              {tabItems.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-sm border-b-2 transition ${activeTab === tab.id ? 'border-slate-800 dark:border-white/70 text-slate-900 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'inputs' && (
                <div className="space-y-6">
                  {renderLineTable(plLines, `${t('finance.budget.baselines', 'Baselines')} — P&L`)}
                  {renderLineTable(cfLines, t('finance.budget.cashFlow', 'Cash Flow'))}
                </div>
              )}

              {activeTab === 'projections' &&
                (projectionPeriods.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    {t('finance.budget.noProjections', 'Click "Generate Projections" to compute')}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-navy-700">
                          <th className="px-3 py-2 sticky left-0 bg-white dark:bg-navy-900">
                            {t('finance.budget.line', 'Line')}
                          </th>
                          {projectionPeriods.map((p) => (
                            <th key={p} className="px-3 py-2 text-right">
                              {p}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => (
                          <tr
                            key={line.id}
                            className="border-b border-slate-200 dark:border-navy-700"
                          >
                            <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-navy-900">
                              {line.lineName}
                            </td>
                            {projectionPeriods.map((p) => (
                              <td
                                key={p}
                                className="px-3 py-2 text-right font-mono text-slate-900 dark:text-white"
                              >
                                {fmtNumber.format(
                                  activeScenario?.projections?.lines?.[line.lineCode]?.[p] ?? 0
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              {activeTab === 'scenarios' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    {scenarios.map((sc) => {
                      const baseRevenue = baseScenario?.summaryMetrics?.totalRevenue ?? 0;
                      const baseNetIncome = baseScenario?.summaryMetrics?.netIncome ?? 0;
                      const revenueDelta = (sc.summaryMetrics?.totalRevenue ?? 0) - baseRevenue;
                      const netIncomeDelta = (sc.summaryMetrics?.netIncome ?? 0) - baseNetIncome;
                      const isBase = sc.scenarioType === 'base';

                      return (
                        <div
                          key={sc.id}
                          className={`rounded-xl p-4 border ${SCENARIO_COLORS[sc.scenarioType] || 'border-slate-200 dark:border-navy-700'}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-slate-900 dark:text-white">
                              {sc.name}
                            </h4>
                            {sc.isActive && (
                              <span className="text-xs font-medium px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-baseline">
                              <span className="text-slate-500">
                                {t('finance.budget.totalRevenue', 'Revenue')}
                              </span>
                              <div className="text-right">
                                <span className="font-mono text-slate-900 dark:text-white">
                                  {fmtNumber.format(sc.summaryMetrics?.totalRevenue ?? 0)}
                                </span>
                                {!isBase && revenueDelta !== 0 && (
                                  <span
                                    className={`ml-2 text-xs font-medium ${revenueDelta > 0 ? 'text-emerald-500' : 'text-danger-500'}`}
                                  >
                                    {revenueDelta > 0 ? '+' : ''}
                                    {fmtNumber.format(revenueDelta)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-between items-baseline">
                              <span className="text-slate-500">
                                {t('finance.budget.netIncome', 'Net Income')}
                              </span>
                              <div className="text-right">
                                <span className="font-mono text-slate-900 dark:text-white">
                                  {fmtNumber.format(sc.summaryMetrics?.netIncome ?? 0)}
                                </span>
                                {!isBase && netIncomeDelta !== 0 && (
                                  <span
                                    className={`ml-2 text-xs font-medium ${netIncomeDelta > 0 ? 'text-emerald-500' : 'text-danger-500'}`}
                                  >
                                    {netIncomeDelta > 0 ? '+' : ''}
                                    {fmtNumber.format(netIncomeDelta)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {scenarios.length > 0 && (
                    <div className="bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                      <div className="px-4 py-2 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {t('finance.budget.scenarioDiff', 'Scenario Comparison')}
                        </h3>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-navy-700">
                            <th className="px-4 py-2">{t('finance.budget.metric', 'Metric')}</th>
                            {scenarios.map((sc) => (
                              <th key={sc.id} className="px-4 py-2 text-right">
                                {sc.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            'totalRevenue',
                            'grossProfit',
                            'ebitda',
                            'netIncome',
                            'operatingCF',
                            'fcf',
                          ].map((metric) => {
                            const baseVal = (baseScenario?.summaryMetrics as any)?.[metric] ?? 0;
                            return (
                              <tr
                                key={metric}
                                className="border-b border-slate-200 dark:border-navy-700 last:border-0"
                              >
                                <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 capitalize">
                                  {metric.replace(/([A-Z])/g, ' $1').trim()}
                                </td>
                                {scenarios.map((sc) => {
                                  const val = (sc.summaryMetrics as any)?.[metric] ?? 0;
                                  const delta = val - baseVal;
                                  const isBase = sc.scenarioType === 'base';
                                  return (
                                    <td
                                      key={sc.id}
                                      className="px-4 py-2 text-right font-mono text-slate-900 dark:text-white"
                                    >
                                      {fmtNumber.format(val)}
                                      {!isBase && delta !== 0 && (
                                        <span
                                          className={`ml-1.5 text-xs ${delta > 0 ? 'text-emerald-500' : 'text-danger-500'}`}
                                        >
                                          ({delta > 0 ? '+' : ''}
                                          {fmtNumber.format(delta)})
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'initiatives' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {t('finance.budget.linkedInitiatives', 'Linked Initiatives')}
                    </h3>
                    <button
                      onClick={handleOpenLinkPicker}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm rounded-lg hover:bg-navy-800"
                    >
                      <Plus size={14} />
                      {t('finance.budget.linkInitiative', 'Link Initiative')}
                    </button>
                  </div>

                  {linkedInitiatives.length > 0 && (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="rounded-xl p-4 border border-emerald-500/30 bg-emerald-500/5">
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">
                          {t('finance.budget.totalRevenueUplift', 'Revenue Uplift')}
                        </div>
                        <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                          +{fmtNumber.format(initiativeImpactTotal.revenueUplift)}
                        </div>
                      </div>
                      <div className="rounded-xl p-4 border border-blue-500/30 bg-blue-500/5">
                        <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                          {t('finance.budget.totalCostSavings', 'Cost Savings')}
                        </div>
                        <div className="text-xl font-bold text-blue-700 dark:text-blue-300 font-mono">
                          +{fmtNumber.format(initiativeImpactTotal.costSavings)}
                        </div>
                      </div>
                      <div className="rounded-xl p-4 border border-amber-500/30 bg-amber-500/5">
                        <div className="text-xs text-amber-600 dark:text-amber-400 mb-1">
                          {t('finance.budget.totalCapex', 'CAPEX Required')}
                        </div>
                        <div className="text-xl font-bold text-amber-700 dark:text-amber-300 font-mono">
                          {fmtNumber.format(initiativeImpactTotal.capexRequired)}
                        </div>
                      </div>
                    </div>
                  )}

                  {linkedInitiatives.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                      <p className="text-sm">
                        {t(
                          'finance.budget.noLinkedInitiatives',
                          'No initiatives linked to this budget yet.'
                        )}
                      </p>
                      <p className="text-xs mt-1">
                        {t(
                          'finance.budget.linkInitiativeHint',
                          'Link initiatives to see their revenue uplift and cost savings impact on budget projections.'
                        )}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-navy-700">
                            <th className="px-4 py-2">
                              {t('finance.budget.initiative', 'Initiative')}
                            </th>
                            <th className="px-4 py-2">{t('common.status', 'Status')}</th>
                            <th className="px-4 py-2 text-right">
                              {t('finance.budget.revenueUplift', 'Revenue Uplift')}
                            </th>
                            <th className="px-4 py-2 text-right">
                              {t('finance.budget.costSavings', 'Cost Savings')}
                            </th>
                            <th className="px-4 py-2 text-right">
                              {t('finance.budget.capex', 'CAPEX')}
                            </th>
                            <th className="px-4 py-2 w-16"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {linkedInitiatives.map((ini) => (
                            <tr
                              key={ini.id}
                              className="border-b border-slate-200 dark:border-navy-700 last:border-0"
                            >
                              <td className="px-4 py-2">
                                <button
                                  onClick={() => navigate(`/initiatives?id=${ini.id}`)}
                                  className="text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                                >
                                  {ini.title} <ExternalLink size={12} />
                                </button>
                              </td>
                              <td className="px-4 py-2">
                                <span
                                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusBadgeClass(ini.status)}`}
                                >
                                  {ini.status}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                                {ini.revenueUplift
                                  ? `+${fmtNumber.format(ini.revenueUplift)}`
                                  : '—'}
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-blue-600 dark:text-blue-400">
                                {ini.costSavings ? `+${fmtNumber.format(ini.costSavings)}` : '—'}
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-amber-600 dark:text-amber-400">
                                {ini.capexRequired ? fmtNumber.format(ini.capexRequired) : '—'}
                              </td>
                              <td className="px-4 py-2">
                                <button
                                  onClick={() => handleUnlinkInitiative(ini.id)}
                                  className="text-danger-400 hover:text-danger-600"
                                  title={t('finance.budget.unlinkInitiative', 'Unlink') as string}
                                >
                                  <X size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {showLinkPicker && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6 w-full max-w-lg max-h-[70vh] flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            {t('finance.budget.selectInitiative', 'Select Initiative to Link')}
                          </h2>
                          <button
                            onClick={() => setShowLinkPicker(false)}
                            className="text-slate-600 hover:text-slate-600"
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-1">
                          {availableInitiatives.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-4">
                              {t(
                                'finance.budget.noAvailableInitiatives',
                                'No available initiatives to link'
                              )}
                            </p>
                          ) : (
                            availableInitiatives.map((ini: any) => (
                              <button
                                key={ini.id}
                                onClick={() => handleLinkInitiative(ini.id)}
                                disabled={linkingInitiative}
                                className="w-full text-left p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-800 border border-slate-200 dark:border-navy-700 disabled:opacity-50"
                              >
                                <div className="font-medium text-sm text-slate-900 dark:text-white">
                                  {ini.title}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                  {ini.status} · {ini.priority}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('finance.budget.createTitle', 'New Budget')}
              </h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-slate-600 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <input
                value={newTitle}
                onChange={(e) => {
                  setNewTitle(e.target.value);
                  setCreateIntentKey(crypto.randomUUID());
                }}
                placeholder={t('finance.budget.titlePlaceholder', 'e.g., 2026 Operating Budget')}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">
                    {t('finance.budget.startPeriod', 'Start')}
                  </label>
                  <input
                    type="month"
                    value={startPeriod}
                    onChange={(e) => {
                      setStartPeriod(e.target.value);
                      setCreateIntentKey(crypto.randomUUID());
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">
                    {t('finance.budget.endPeriod', 'End')}
                  </label>
                  <input
                    type="month"
                    value={endPeriod}
                    onChange={(e) => {
                      setEndPeriod(e.target.value);
                      setCreateIntentKey(crypto.randomUUID());
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || !startPeriod || !endPeriod || startPeriod > endPeriod}
                className="px-4 py-2 bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-medium rounded-lg hover:bg-navy-800"
              >
                {t('common.create', 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
      {showDocImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('finance.budget.importFromDocument', 'Import Budget from Document')}
              </h2>
              <button
                onClick={() => {
                  setShowDocImport(false);
                  setDocImportFile(null);
                }}
                className="text-slate-600 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              {t(
                'finance.budget.importDocDesc',
                'Upload a PDF or Excel file containing budget data. Lines will be extracted and added to the current budget.'
              )}
            </p>
            <div
              onClick={() => document.getElementById('doc-import-input')?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-navy-600 rounded-xl p-6 text-center cursor-pointer hover:border-primary-400 transition-colors"
            >
              <Upload size={32} className="mx-auto text-slate-600 mb-2" />
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {docImportFile
                  ? docImportFile.name
                  : t('finance.budget.dropOrBrowse', 'Click to browse or drop file')}
              </p>
              <p className="text-xs text-slate-600 mt-1">PDF, XLSX, XLS, CSV</p>
              <input
                id="doc-import-input"
                type="file"
                accept=".pdf,.xlsx,.xls,.csv"
                onChange={(e) => setDocImportFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowDocImport(false);
                  setDocImportFile(null);
                }}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleDocImport}
                disabled={!docImportFile || docImporting}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-500 disabled:opacity-50"
              >
                {docImporting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FileUp size={14} />
                )}
                {t('finance.budget.importLines', 'Import Lines')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetWorkspace;
