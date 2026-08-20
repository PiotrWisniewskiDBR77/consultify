import { ArrowRight, Plus, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/shared/states';

import { Api } from '../../services/api';
import { shouldFallbackToLegacyFinance, V8FinanceApi } from '../../services/api/v8/finance';

interface Analysis {
  id: string;
  title: string;
  status: string;
  currency: string;
}

interface Ratio {
  id: string;
  ratio_code: string;
  ratio_name: string;
  value: number | null;
  period: string;
  benchmark_value?: number;
  benchmark?: number;
  interpretation?: string;
}

interface FinancialAnalysisWorkspaceProps {
  initialAnalysisId?: string;
  hideSidebar?: boolean;
  onAnalysisChanged?: () => void;
}

/** #82e — target model for the "Use as model assumptions" bridge. */
interface TargetModelOption {
  id: string;
  name: string;
}

// #82e — Analysis→Models bridge helpers (mirror the same V8-first/legacy-fallback
// pattern already used for ratios/analyses above; no new backend, reuses the
// existing financial-modeling CRUD: GET /models, GET /models/:id, PUT /models/:id).
async function getModelsListForBridge(): Promise<TargetModelOption[]> {
  try {
    const data = await V8FinanceApi.getModels();
    return Array.isArray(data?.models) ? data.models.map((m) => ({ id: m.id, name: m.name })) : [];
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) throw error;
    const data = (await Api.get('/api/financial-modeling/models')) as any;
    return Array.isArray(data) ? data.map((m: any) => ({ id: m.id, name: m.name })) : [];
  }
}

async function getModelAssumptionsForBridge(modelId: string): Promise<Record<string, unknown>> {
  try {
    const data = await V8FinanceApi.getModel(modelId);
    return (data?.model as any)?.assumptions_json || {};
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) throw error;
    const data = (await Api.get(`/api/financial-modeling/models/${modelId}`)) as any;
    return data?.assumptions_json || {};
  }
}

async function updateModelAssumptionsForBridge(
  modelId: string,
  assumptions: Record<string, unknown>
): Promise<void> {
  try {
    await V8FinanceApi.updateModel(modelId, { assumptions });
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) throw error;
    await Api.put(`/api/financial-modeling/models/${modelId}`, { assumptions });
  }
}

type RatioValueFormat = 'percent' | 'multiple' | 'days' | 'currency';

const RATIO_BLOCKS = [
  {
    key: 'profitability',
    order: '1',
    title: 'Rentowność',
    subtitle: 'Bez tego nie ma biznesu.',
    codes: [
      'gross_margin_pct',
      'ebitda_margin_pct',
      'net_profit_margin_pct',
      'contribution_margin_pct',
    ],
  },
  {
    key: 'cost_control',
    order: '2',
    title: 'Koszty i Struktura',
    subtitle: 'Czy produkcja, praca i energia są pod kontrolą.',
    codes: ['cogs_to_revenue_pct', 'labor_cost_ratio_pct', 'energy_cost_ratio_pct'],
  },
  {
    key: 'cash_liquidity',
    order: '3',
    title: 'Płynność i Cash',
    subtitle: 'Tu firmy się wywracają.',
    codes: [
      'current_ratio',
      'quick_ratio',
      'cash_conversion_cycle',
      'operating_cf_to_ebitda',
      'free_cash_flow',
    ],
  },
  {
    key: 'working_capital',
    order: '4',
    title: 'Kapitał Obrotowy',
    subtitle: 'Gdzie gotówka blokuje się w operacji.',
    codes: ['inventory_days', 'dso', 'dpo', 'inventory_turnover'],
  },
  {
    key: 'leverage',
    order: '5',
    title: 'Zadłużenie i Stabilność',
    subtitle: 'Poziom ryzyka finansowego i obsługa odsetek.',
    codes: ['debt_to_ebitda', 'interest_coverage'],
  },
] as const;

const RATIO_META: Record<
  string,
  { formula: string; format: RatioValueFormat; benchmarkHint?: string }
> = {
  gross_margin_pct: {
    formula: '(Gross Profit / Revenue) * 100',
    format: 'percent',
    benchmarkHint: '>= 30%',
  },
  ebitda_margin_pct: {
    formula: '(EBITDA / Revenue) * 100',
    format: 'percent',
    benchmarkHint: '>= 15%',
  },
  net_profit_margin_pct: {
    formula: '(Net Income / Revenue) * 100',
    format: 'percent',
    benchmarkHint: '>= 8%',
  },
  contribution_margin_pct: {
    formula: '((Revenue - Variable Costs) / Revenue) * 100',
    format: 'percent',
    benchmarkHint: '>= 20%',
  },
  cogs_to_revenue_pct: {
    formula: '(COGS / Revenue) * 100',
    format: 'percent',
    benchmarkHint: '<= 65%',
  },
  labor_cost_ratio_pct: {
    formula: '(Labor Costs / Revenue) * 100',
    format: 'percent',
    benchmarkHint: '<= 18%',
  },
  energy_cost_ratio_pct: {
    formula: '(Energy Costs / Revenue) * 100',
    format: 'percent',
    benchmarkHint: '<= 8%',
  },
  current_ratio: {
    formula: 'Current Assets / Current Liabilities',
    format: 'multiple',
    benchmarkHint: '>= 1.5x',
  },
  quick_ratio: {
    formula: '(Current Assets - Inventory) / Current Liabilities',
    format: 'multiple',
    benchmarkHint: '>= 1.0x',
  },
  cash_conversion_cycle: {
    formula: 'DSO + Inventory Days - DPO',
    format: 'days',
    benchmarkHint: '<= 45 dni',
  },
  operating_cf_to_ebitda: {
    formula: 'Operating Cash Flow / EBITDA',
    format: 'multiple',
    benchmarkHint: '>= 0.8x',
  },
  free_cash_flow: {
    formula: 'Operating Cash Flow - CAPEX',
    format: 'currency',
    benchmarkHint: '> 0',
  },
  inventory_days: {
    formula: '(Inventory / COGS) * 365',
    format: 'days',
    benchmarkHint: '<= 75 dni',
  },
  dso: {
    formula: '(Accounts Receivable / Revenue) * 365',
    format: 'days',
    benchmarkHint: '<= 45 dni',
  },
  dpo: {
    formula: '(Accounts Payable / COGS) * 365',
    format: 'days',
    benchmarkHint: '~ 60 dni',
  },
  inventory_turnover: {
    formula: 'COGS / Inventory',
    format: 'multiple',
    benchmarkHint: '>= 5.0x',
  },
  debt_to_ebitda: {
    formula: 'Total Debt / EBITDA',
    format: 'multiple',
    benchmarkHint: '<= 3.0x',
  },
  interest_coverage: {
    formula: 'EBIT / Interest Expense',
    format: 'multiple',
    benchmarkHint: '>= 4.0x',
  },
};

function formatRatioValue(
  value: number | null | undefined,
  format: RatioValueFormat,
  fmtNumber: Intl.NumberFormat
): string {
  if (value == null || Number.isNaN(value)) return '—';
  if (format === 'percent') return `${fmtNumber.format(value)}%`;
  if (format === 'multiple') return `${fmtNumber.format(value)}x`;
  if (format === 'days') return `${fmtNumber.format(value)} d`;
  return fmtNumber.format(value);
}

function getLatestRatios(ratios: Ratio[]): Ratio[] {
  if (ratios.length === 0) return [];
  const periods = [...new Set(ratios.map((ratio) => ratio.period).filter(Boolean))].sort();
  const latestPeriod = periods.at(-1);
  return latestPeriod ? ratios.filter((ratio) => ratio.period === latestPeriod) : ratios;
}

function groupRatiosForBlocks(ratios: Ratio[]): Record<string, Ratio[]> {
  const latestRatios = getLatestRatios(ratios);
  const byCode = new Map(latestRatios.map((ratio) => [ratio.ratio_code, ratio]));
  return Object.fromEntries(
    RATIO_BLOCKS.map((block) => [
      block.key,
      block.codes.map((code) => byCode.get(code)).filter(Boolean) as Ratio[],
    ])
  );
}

export const FinancialAnalysisWorkspace: React.FC<FinancialAnalysisWorkspaceProps> = ({
  initialAnalysisId,
  hideSidebar,
  onAnalysisChanged,
}) => {
  const { t } = useTranslation();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [selected, setSelected] = useState<Analysis | null>(null);
  const [ratios, setRatios] = useState<Ratio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  // #82e — Analysis→Models bridge: which ratio rows are selected, and the
  // modal state for picking the target model.
  const [selectedRatioIds, setSelectedRatioIds] = useState<Set<string>>(new Set());
  const [showUseAsAssumptions, setShowUseAsAssumptions] = useState(false);
  const [targetModels, setTargetModels] = useState<TargetModelOption[]>([]);
  const [targetModelsLoading, setTargetModelsLoading] = useState(false);
  const [targetModelId, setTargetModelId] = useState('');
  const [applyingAssumptions, setApplyingAssumptions] = useState(false);

  const fetchAnalyses = useCallback(async () => {
    try {
      let data: any;
      try {
        data = await V8FinanceApi.getAnalyses();
      } catch (error) {
        if (!shouldFallbackToLegacyFinance(error)) {
          throw error;
        }
        data = await Api.get('/api/economics/financial-analyses');
      }
      setAnalyses(Array.isArray(data?.analyses) ? data.analyses : []);
    } catch {
      toast.error(t('finance.analysis.loadFailed', 'Failed to load financial analyses'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const selectAnalysis = useCallback(async (analysis: Analysis) => {
    setSelected(analysis);
    setSelectedRatioIds(new Set());
    try {
      let data: any;
      try {
        data = await V8FinanceApi.getAnalysisRatios(analysis.id);
      } catch (error) {
        if (!shouldFallbackToLegacyFinance(error)) {
          throw error;
        }
        data = await Api.get(`/api/economics/financial-analyses/${analysis.id}/ratios`);
      }
      setRatios(Array.isArray(data?.ratios) ? data.ratios : []);
    } catch {
      setRatios([]);
    }
  }, []);

  const toggleRatioSelected = useCallback((ratioId: string) => {
    setSelectedRatioIds((prev) => {
      const next = new Set(prev);
      if (next.has(ratioId)) next.delete(ratioId);
      else next.add(ratioId);
      return next;
    });
  }, []);

  useEffect(() => {
    void fetchAnalyses();
  }, [fetchAnalyses]);

  useEffect(() => {
    if (analyses.length === 0) return;
    const preferred =
      analyses.find((analysis) => analysis.id === initialAnalysisId) ||
      analyses.find((analysis) => analysis.id === selected?.id) ||
      analyses[0];

    if (preferred && preferred.id !== selected?.id) {
      void selectAnalysis(preferred);
    }
  }, [analyses, initialAnalysisId, selectAnalysis, selected?.id]);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    try {
      const data: any = await V8FinanceApi.createAnalysis({ title: newTitle.trim() });
      setShowCreate(false);
      setNewTitle('');
      await fetchAnalyses();
      if (data.analysis) await selectAnalysis(data.analysis);
      onAnalysisChanged?.();
    } catch {
      toast.error(t('finance.analysis.createFailed', 'Failed to create analysis'));
    }
  }, [fetchAnalyses, newTitle, onAnalysisChanged, selectAnalysis, t]);

  // #82e — open the "Use as model assumptions" picker; lazy-loads the org's
  // financial models the first time it's opened.
  const openUseAsAssumptions = useCallback(async () => {
    setShowUseAsAssumptions(true);
    if (targetModels.length > 0) return;
    setTargetModelsLoading(true);
    try {
      const models = await getModelsListForBridge();
      setTargetModels(models);
      if (models.length > 0) setTargetModelId((prev) => prev || models[0].id);
    } catch {
      toast.error(t('finance.analysis.bridgeModelsLoadFailed', 'Failed to load financial models'));
    } finally {
      setTargetModelsLoading(false);
    }
  }, [t, targetModels.length]);

  // #82e — bridge: push the selected ratios into the target model's assumptions
  // layer via the existing assumptions CRUD (PUT /models/:id), tagged with
  // provenance 'from-analysis' so the model's Inputs & Assumptions tab can show
  // where they came from. Ratios are KPIs (margins/days/multiples), not raw P&L
  // baseline lines, so they are attached as a labeled, reviewable bundle rather
  // than silently overwriting numeric baseline drivers with mismatched units.
  const handleApplyAsAssumptions = useCallback(async () => {
    if (!selected || !targetModelId) return;
    const chosenRatios = getLatestRatios(ratios).filter((r) => selectedRatioIds.has(r.id));
    if (chosenRatios.length === 0) return;
    setApplyingAssumptions(true);
    try {
      const existingAssumptions = await getModelAssumptionsForBridge(targetModelId);
      const mergedAssumptions = {
        ...existingAssumptions,
        fromAnalysis: {
          analysisId: selected.id,
          analysisTitle: selected.title,
          appliedAt: new Date().toISOString(),
          provenance: 'from-analysis',
          ratios: chosenRatios.map((r) => ({
            ratio_code: r.ratio_code,
            ratio_name: r.ratio_name,
            value: r.value,
            period: r.period,
            interpretation: r.interpretation ?? null,
            benchmark: r.benchmark_value ?? r.benchmark ?? null,
          })),
        },
      };
      await updateModelAssumptionsForBridge(targetModelId, mergedAssumptions);
      toast.success(
        t('finance.analysis.bridgeApplied', 'Model assumptions updated from this analysis')
      );
      setShowUseAsAssumptions(false);
      setSelectedRatioIds(new Set());
    } catch {
      toast.error(t('finance.analysis.bridgeApplyFailed', 'Failed to update model assumptions'));
    } finally {
      setApplyingAssumptions(false);
    }
  }, [ratios, selected, selectedRatioIds, t, targetModelId]);

  const fmtNumber = useMemo(
    () => new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    []
  );

  const groupedRatios = useMemo(() => groupRatiosForBlocks(ratios), [ratios]);
  const latestPeriod = useMemo(() => getLatestRatios(ratios)[0]?.period || '—', [ratios]);
  const hasRatios = Object.values(groupedRatios).some((items) => items.length > 0);

  if (loading) {
    return (
      <div className="h-full p-6">
        <LoadingState template="panel" />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-950 text-slate-100">
      {!hideSidebar && (
        <aside className="flex w-72 flex-col border-r border-white/[0.06] bg-slate-950/80">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {t('finance.analysis.title', 'Financial Analysis')}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {t('finance.analysis.sidebarHint', 'Only ratio analysis is shown here.')}
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-white/[0.04] p-2 text-slate-600 transition hover:bg-white/[0.08]"
              title={t('finance.analysis.createTitle', 'New Financial Analysis') as string}
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
            {analyses.length === 0 ? (
              <div className="rounded-xl bg-white/[0.03] px-3 py-4 text-sm text-slate-500">
                {t('finance.analysis.noAnalyses', 'No analyses yet')}
              </div>
            ) : (
              analyses.map((analysis) => (
                <button
                  key={analysis.id}
                  onClick={() => void selectAnalysis(analysis)}
                  className={`w-full rounded-xl px-3 py-3 text-left transition ${
                    selected?.id === analysis.id
                      ? 'bg-white/[0.08] text-slate-100'
                      : 'text-slate-600 hover:bg-white/[0.04] hover:text-slate-200'
                  }`}
                >
                  <div className="truncate text-sm font-medium">{analysis.title}</div>
                  <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                    {analysis.status}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>
      )}

      <main className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {t('finance.analysis.selectOrCreate', 'Select an analysis')}
          </div>
        ) : (
          <div className="px-6 py-5">
            <div className="mb-5 rounded-2xl bg-white/[0.03] px-5 py-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    {t('finance.analysis.headerLabel', 'Ratio Analysis')}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-50">{selected.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {t(
                      'finance.analysis.headerDescription',
                      'Only the 18 core KPI blocks are shown: profitability, cost structure, cash, working capital and leverage.'
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-white/[0.04] px-3 py-1.5">
                    {selected.status}
                  </span>
                  <span className="rounded-full bg-white/[0.04] px-3 py-1.5">
                    {selected.currency}
                  </span>
                  <span className="rounded-full bg-white/[0.04] px-3 py-1.5">
                    {t('finance.analysis.period', 'Period')}: {latestPeriod}
                  </span>
                  {/* #82e — Analysis→Models bridge entry point. Disabled until at
                      least one ratio row is checked below. */}
                  <button
                    onClick={() => void openUseAsAssumptions()}
                    disabled={selectedRatioIds.size === 0}
                    title={
                      selectedRatioIds.size === 0
                        ? (t(
                            'finance.analysis.bridgeSelectHint',
                            'Check one or more indicators below first'
                          ) as string)
                        : undefined
                    }
                    className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
                  >
                    {t('finance.analysis.useAsAssumptions', 'Use as model assumptions')}
                    {selectedRatioIds.size > 0 ? ` (${selectedRatioIds.size})` : ''}
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </div>

            {!hasRatios ? (
              <div className="rounded-2xl bg-white/[0.03] px-5 py-10 text-center text-sm text-slate-500">
                {t(
                  'finance.analysis.noRatios',
                  'No KPI values are available yet for this analysis.'
                )}
              </div>
            ) : (
              <RatioBlocksTable
                groupedRatios={groupedRatios}
                fmtNumber={fmtNumber}
                selectedRatioIds={selectedRatioIds}
                onToggleRatio={toggleRatioSelected}
              />
            )}
          </div>
        )}
      </main>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-2xl bg-slate-950 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">
                {t('finance.analysis.createTitle', 'New Financial Analysis')}
              </h2>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300"
              >
                <X size={18} />
              </button>
            </div>
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder={t(
                'finance.analysis.titlePlaceholder',
                'e.g., FY 2025 Financial Analysis'
              )}
              className="mb-4 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-xl px-4 py-2 text-sm text-slate-600 transition hover:bg-white/[0.04] hover:text-slate-200"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={() => void handleCreate()}
                className="rounded-xl bg-c-text px-4 py-2 text-sm font-medium text-c-bg transition hover:bg-c-text-secondary"
              >
                {t('common.create', 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* #82e — Analysis→Models bridge modal: pick a target financial model,
          push the checked ratios into its assumptions layer (provenance
          'from-analysis'). No new engine — reuses the existing models list +
          assumptions CRUD. */}
      {showUseAsAssumptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-2xl bg-slate-950 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">
                {t('finance.analysis.useAsAssumptions', 'Use as model assumptions')}
              </h2>
              <button
                onClick={() => setShowUseAsAssumptions(false)}
                className="rounded-lg p-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-500">
              {t(
                'finance.analysis.bridgeHint',
                'The selected indicators will be attached to the chosen financial model’s assumptions, labeled as coming from this analysis.'
              )}
            </p>
            {targetModelsLoading ? (
              <div className="py-4 text-sm text-slate-500">{t('common.loading', 'Loading…')}</div>
            ) : targetModels.length === 0 ? (
              <div className="mb-4 rounded-xl bg-white/[0.03] px-3 py-4 text-sm text-slate-500">
                {t(
                  'finance.analysis.bridgeNoModels',
                  'No financial models yet. Create one in the Models tab first.'
                )}
              </div>
            ) : (
              <div className="mb-4">
                <label className="text-xs text-slate-500">
                  {t('finance.analysis.bridgeTargetModel', 'Target model')}
                </label>
                <select
                  value={targetModelId}
                  onChange={(event) => setTargetModelId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100 outline-none"
                >
                  {targetModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.id}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowUseAsAssumptions(false)}
                className="rounded-xl px-4 py-2 text-sm text-slate-600 transition hover:bg-white/[0.04] hover:text-slate-200"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={() => void handleApplyAsAssumptions()}
                disabled={applyingAssumptions || !targetModelId || targetModels.length === 0}
                className="rounded-xl bg-c-text px-4 py-2 text-sm font-medium text-c-bg transition hover:bg-c-text-secondary disabled:opacity-50"
              >
                {applyingAssumptions
                  ? t('common.saving', 'Saving…')
                  : t('finance.analysis.bridgeApply', 'Apply to model')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const RatioBlocksTable: React.FC<{
  groupedRatios: Record<string, Ratio[]>;
  fmtNumber: Intl.NumberFormat;
  selectedRatioIds: Set<string>;
  onToggleRatio: (ratioId: string) => void;
}> = ({ groupedRatios, fmtNumber, selectedRatioIds, onToggleRatio }) => (
  <div className="space-y-4">
    {RATIO_BLOCKS.map((block) => {
      const items = groupedRatios[block.key] || [];
      if (items.length === 0) return null;

      return (
        <section key={block.key} className="overflow-hidden rounded-2xl bg-white/[0.03]">
          <div className="px-5 py-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
              Blok {block.order}
            </div>
            <h3 className="mt-1 text-sm font-semibold text-slate-100">{block.title}</h3>
            <p className="mt-1 text-xs text-slate-500">{block.subtitle}</p>
          </div>
          <div className="overflow-x-auto">
            <table
              /* §27-exempt: edytor komorkowy/workspace, edycja cell-by-cell */ className="w-full min-w-[980px] text-sm"
            >
              <thead>
                <tr className="border-y border-white/[0.06] text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="w-10 px-5 py-3" />
                  <th className="px-5 py-3 min-w-[240px]">Wskaźnik</th>
                  <th className="px-5 py-3 min-w-[240px]">Wyliczenie</th>
                  <th className="px-5 py-3 min-w-[360px]">Interpretacja</th>
                  <th className="px-5 py-3 min-w-[180px]">Wskaźnik branżowy</th>
                </tr>
              </thead>
              <tbody>
                {items.map((ratio) => {
                  const meta = RATIO_META[ratio.ratio_code] || {
                    formula: 'Derived from financial statements',
                    format: 'multiple' as const,
                    benchmarkHint: undefined,
                  };
                  const benchmark = ratio.benchmark_value ?? ratio.benchmark;

                  return (
                    <tr key={ratio.id} className="border-t border-white/[0.06] align-top">
                      <td className="px-5 py-4">
                        <input
                          type="checkbox"
                          checked={selectedRatioIds.has(ratio.id)}
                          onChange={() => onToggleRatio(ratio.id)}
                          aria-label={`${ratio.ratio_name} — use as model assumption`}
                          className="h-4 w-4 rounded border-white/20 bg-white/[0.04] accent-white"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-100">{ratio.ratio_name}</div>
                        <div className="mt-1 text-xs text-slate-500">Okres: {ratio.period}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-mono text-sm text-slate-100">
                          {formatRatioValue(ratio.value, meta.format, fmtNumber)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{meta.formula}</div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {ratio.interpretation || 'Brak automatycznej interpretacji dla tego KPI.'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-mono text-sm text-slate-100">
                          {benchmark != null
                            ? formatRatioValue(benchmark, meta.format, fmtNumber)
                            : '—'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {meta.benchmarkHint || 'Reference range'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      );
    })}
  </div>
);

export default FinancialAnalysisWorkspace;
