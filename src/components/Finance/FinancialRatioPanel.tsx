/**
 * T051 — Financial Ratio Analysis Panel
 *
 * Displays computed ratios grouped by category (liquidity, profitability, leverage,
 * efficiency, growth), with trends, formula definitions, benchmark overlays,
 * and coverage indicators.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, Info,
  AlertTriangle, CheckCircle2, XCircle, BarChart3, Target, HelpCircle,
  ArrowUpRight, ArrowDownRight, Loader2, RefreshCw, Download, Settings,
} from 'lucide-react';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import Api from '../../services/Api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComputedRatio {
  code: string;
  name: string;
  namePl: string;
  category: string;
  value: number | null;
  status: 'ok' | 'warn' | 'critical' | 'na';
  formula: string;
  formulaDescription: string;
  formulaDescriptionPl: string;
  unit: string;
  coveragePct: number;
  missingLines: string[];
  benchmark?: { p25?: number; median?: number; p75?: number; targetMin?: number; targetMax?: number; source?: string };
}

interface RatioAnalysisResult {
  statementId: string;
  periodLabel: string;
  ratios: ComputedRatio[];
  categories: Record<string, ComputedRatio[]>;
  coverageSummary: { total: number; computed: number; na: number; coveragePct: number };
}

interface Statement {
  id: string;
  statement_type: string;
  period_label: string;
  period_start: string;
  period_end: string;
  currency: string;
  status: string;
}

interface Props {
  organizationId?: string;
}

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<string, { label: string; labelPl: string; icon: React.ReactNode; color: string }> = {
  liquidity: { label: 'Liquidity', labelPl: 'Płynność', icon: <BarChart3 size={16} />, color: 'blue' },
  profitability: { label: 'Profitability', labelPl: 'Rentowność', icon: <TrendingUp size={16} />, color: 'emerald' },
  leverage: { label: 'Leverage', labelPl: 'Zadłużenie', icon: <Target size={16} />, color: 'amber' },
  efficiency: { label: 'Efficiency', labelPl: 'Efektywność', icon: <RefreshCw size={16} />, color: 'purple' },
  growth: { label: 'Growth', labelPl: 'Wzrost', icon: <ArrowUpRight size={16} />, color: 'sky' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FinancialRatioPanel: React.FC<Props> = () => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [statements, setStatements] = useState<Statement[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState<string>('');
  const [previousStatementId, setPreviousStatementId] = useState<string>('');
  const [result, setResult] = useState<RatioAnalysisResult | null>(null);
  const [growthRatios, setGrowthRatios] = useState<ComputedRatio[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['liquidity', 'profitability', 'leverage', 'efficiency']));
  const [showFormula, setShowFormula] = useState<string | null>(null);
  const [showBenchmarkEditor, setShowBenchmarkEditor] = useState(false);

  // Load confirmed statements
  useEffect(() => {
    const load = async () => {
      try {
        const resp = await Api.get('/api/finance-statements');
        const confirmed = (resp.data || []).filter((s: Statement) => s.status === 'confirmed');
        setStatements(confirmed);
        if (confirmed.length > 0) setSelectedStatementId(confirmed[0].id);
        if (confirmed.length > 1) setPreviousStatementId(confirmed[1].id);
      } catch { /* noop */ }
    };
    load();
  }, []);

  const loadRatios = useCallback(async () => {
    if (!selectedStatementId) return;
    setLoading(true);
    try {
      const resp = await Api.get(`/api/finance-statements/${selectedStatementId}/ratios`);
      setResult(resp.data);
      trackFunnelEvent('financial_ratios_viewed', { statementId: selectedStatementId });

      if (previousStatementId) {
        const gResp = await Api.post('/api/finance-statements/ratios/growth', {
          currentStatementId: selectedStatementId,
          previousStatementId,
        });
        setGrowthRatios(gResp.data || []);
      }
    } catch { /* noop */ }
    setLoading(false);
  }, [selectedStatementId, previousStatementId]);

  useEffect(() => { loadRatios(); }, [loadRatios]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  // ── Render helpers ──

  const statusIcon = (status: string) => {
    if (status === 'ok') return <CheckCircle2 size={14} className="text-emerald-500" />;
    if (status === 'warn') return <AlertTriangle size={14} className="text-amber-500" />;
    if (status === 'critical') return <XCircle size={14} className="text-red-500" />;
    return <Minus size={14} className="text-slate-300" />;
  };

  const statusBg = (status: string) => {
    if (status === 'ok') return 'bg-emerald-50 dark:bg-emerald-900/20';
    if (status === 'warn') return 'bg-amber-50 dark:bg-amber-900/20';
    if (status === 'critical') return 'bg-red-50 dark:bg-red-900/20';
    return 'bg-slate-50 dark:bg-navy-800';
  };

  const formatValue = (value: number | null, unit: string) => {
    if (value === null) return 'N/A';
    const formatted = value.toLocaleString(isPl ? 'pl-PL' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    return `${formatted}${unit === '%' ? '%' : unit === 'days' ? ` ${t('finance.ratios.days', 'days')}` : `${unit}`}`;
  };

  const renderBenchmarkBar = (ratio: ComputedRatio) => {
    const bm = ratio.benchmark;
    if (!bm || ratio.value === null) return null;
    const min = bm.targetMin ?? bm.p25 ?? 0;
    const max = bm.targetMax ?? bm.p75 ?? ratio.value * 2;
    const range = max - min || 1;
    const position = Math.max(0, Math.min(100, ((ratio.value - min) / range) * 100));

    return (
      <div className="mt-2">
        <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded-full relative overflow-hidden">
          {bm.p25 !== undefined && bm.p75 !== undefined && (
            <div
              className="absolute h-full bg-emerald-200 dark:bg-emerald-800 rounded-full"
              style={{ left: `${Math.max(0, ((bm.p25 - min) / range) * 100)}%`, width: `${Math.max(0, ((bm.p75 - bm.p25) / range) * 100)}%` }}
            />
          )}
          <div
            className="absolute w-2.5 h-2.5 bg-blue-600 rounded-full top-1/2 -translate-y-1/2 shadow-sm"
            style={{ left: `${position}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
          {bm.p25 !== undefined && <span>P25: {bm.p25}</span>}
          {bm.median !== undefined && <span>Med: {bm.median}</span>}
          {bm.p75 !== undefined && <span>P75: {bm.p75}</span>}
        </div>
      </div>
    );
  };

  const renderRatioCard = (ratio: ComputedRatio) => (
    <div key={ratio.code} className={`p-4 rounded-xl border border-slate-200 dark:border-navy-700 ${statusBg(ratio.status)} transition-all hover:shadow-sm`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {statusIcon(ratio.status)}
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              {isPl ? ratio.namePl : ratio.name}
            </span>
            <button onClick={() => setShowFormula(showFormula === ratio.code ? null : ratio.code)} className="p-0.5 hover:bg-slate-200 dark:hover:bg-navy-600 rounded">
              <HelpCircle size={12} className="text-slate-400" />
            </button>
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {formatValue(ratio.value, ratio.unit)}
          </div>
          {ratio.coveragePct < 100 && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600">
              <AlertTriangle size={10} />
              <span>{ratio.coveragePct}% {t('finance.ratios.dataCoverage', 'data coverage')}</span>
            </div>
          )}
          {ratio.missingLines.length > 0 && ratio.status === 'na' && (
            <div className="mt-1 text-[10px] text-slate-400">
              {t('finance.ratios.missing', 'Missing')}: {ratio.missingLines.join(', ')}
            </div>
          )}
        </div>
      </div>

      {showFormula === ratio.code && (
        <div className="mt-3 p-3 bg-white dark:bg-navy-900 rounded-lg border border-slate-100 dark:border-navy-700 text-xs space-y-1">
          <div className="font-mono text-blue-600 dark:text-blue-400">{ratio.formula}</div>
          <div className="text-slate-500">{isPl ? ratio.formulaDescriptionPl : ratio.formulaDescription}</div>
        </div>
      )}

      {renderBenchmarkBar(ratio)}
    </div>
  );

  const allRatios = [...(result?.ratios || []), ...growthRatios];
  const categories = { ...result?.categories || {}, growth: growthRatios };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {t('finance.ratios.title', 'Financial Ratio Analysis')}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {t('finance.ratios.subtitle', 'Key ratios computed from imported financial statements')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedStatementId}
            onChange={e => setSelectedStatementId(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-sm"
          >
            <option value="">{t('finance.ratios.selectStatement', 'Select statement…')}</option>
            {statements.map(s => (
              <option key={s.id} value={s.id}>{s.statement_type} — {s.period_label || s.period_end} ({s.currency})</option>
            ))}
          </select>
          {statements.length > 1 && (
            <select
              value={previousStatementId}
              onChange={e => setPreviousStatementId(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-sm"
            >
              <option value="">{t('finance.ratios.comparePeriod', 'Compare with…')}</option>
              {statements.filter(s => s.id !== selectedStatementId).map(s => (
                <option key={s.id} value={s.id}>{s.statement_type} — {s.period_label || s.period_end}</option>
              ))}
            </select>
          )}
          <button onClick={loadRatios} disabled={loading} className="p-2 border border-slate-200 dark:border-navy-600 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-800">
            {loading ? <Loader2 size={16} className="animate-spin text-blue-500" /> : <RefreshCw size={16} className="text-slate-500" />}
          </button>
        </div>
      </div>

      {/* Coverage summary */}
      {result && (
        <div className="grid grid-cols-4 gap-4">
          <SummaryCard
            label={t('finance.ratios.totalRatios', 'Total Ratios')}
            value={String(result.coverageSummary.total)}
            icon={<BarChart3 size={16} className="text-blue-500" />}
          />
          <SummaryCard
            label={t('finance.ratios.computed', 'Computed')}
            value={String(result.coverageSummary.computed)}
            icon={<CheckCircle2 size={16} className="text-emerald-500" />}
          />
          <SummaryCard
            label={t('finance.ratios.notAvailable', 'N/A (missing data)')}
            value={String(result.coverageSummary.na)}
            icon={<AlertTriangle size={16} className="text-amber-500" />}
          />
          <SummaryCard
            label={t('finance.ratios.coverage', 'Data Coverage')}
            value={`${result.coverageSummary.coveragePct}%`}
            icon={<Target size={16} className="text-purple-500" />}
          />
        </div>
      )}

      {/* Ratio categories */}
      {loading && !result && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      )}

      {result && Object.entries(categories).map(([cat, ratios]) => {
        if (!ratios || ratios.length === 0) return null;
        const config = CATEGORY_CONFIG[cat];
        if (!config) return null;
        const isExpanded = expandedCategories.has(cat);
        const okCount = ratios.filter((r: ComputedRatio) => r.status === 'ok').length;
        const warnCount = ratios.filter((r: ComputedRatio) => r.status === 'warn' || r.status === 'critical').length;

        return (
          <div key={cat} className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
            <button
              onClick={() => toggleCategory(cat)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg bg-${config.color}-100 dark:bg-${config.color}-900/30 text-${config.color}-600`}>
                  {config.icon}
                </div>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {isPl ? config.labelPl : config.label}
                </span>
                <span className="text-xs text-slate-400">{ratios.length} {t('finance.ratios.ratios', 'ratios')}</span>
              </div>
              <div className="flex items-center gap-3">
                {okCount > 0 && <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full">{okCount} OK</span>}
                {warnCount > 0 && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">{warnCount} ⚠</span>}
                {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
              </div>
            </button>

            {isExpanded && (
              <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {ratios.map((r: ComputedRatio) => renderRatioCard(r))}
              </div>
            )}
          </div>
        );
      })}

      {!result && !loading && (
        <div className="text-center py-16 text-slate-400">
          <BarChart3 size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-lg">{t('finance.ratios.noData', 'No confirmed financial statements yet')}</p>
          <p className="text-sm mt-1">{t('finance.ratios.importFirst', 'Import a statement first to see ratio analysis')}</p>
        </div>
      )}
    </div>
  );
};

// ── Sub-components ──

const SummaryCard: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 flex items-center gap-3">
    <div className="p-2 bg-slate-50 dark:bg-navy-800 rounded-lg">{icon}</div>
    <div>
      <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  </div>
);

export default FinancialRatioPanel;
