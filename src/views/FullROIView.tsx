/**
 * FullROIView — Module 05 (Inicjatywy) · Value Realization & ROI
 *
 * Real dashboard backed by the economics service: `GET /api/economics/analyses`
 * (Api.getEconomicsAnalyses) joined with `analysis_financials` (npv, roi_percent)
 * and the linked initiative name. Replaces the former "Under Construction" stub.
 *
 * Shell: ModuleHub (canon) — NOT SplitLayout.
 * Tokens: navy/neutral UI + Harvard Crimson (#A51C30) brand accent.
 */

import { BarChart3, GitCompare, Sparkles, Timer, TrendingUp, Wallet } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/ui/primitives';
import { Button } from '@/components/ui/primitives/Button';
import { ROUTES } from '@/routes/routeConfig';
import { Api, shouldAllowDemoData } from '@/services/api';

import type { ModuleTab, ViewMode } from '../components/shared/ModuleHub/types';
import { StandardModuleBar } from '../components/standard/StandardModuleBar';
import { useAppStore } from '../store/useAppStore';

/** Normalised analysis row used by the dashboard. */
interface RoiAnalysis {
  id: string;
  name: string;
  initiativeId?: string | null;
  initiativeName?: string | null;
  status?: string | null;
  npv?: number | null;
  roi?: number | null; // roi_percent, stored as fraction (0.45) or percent (45)
  paybackMonths?: number | null;
  /** FIN-006/A O2: from analysis_financials.currency via GET /api/economics/analyses[/:id]. */
  currency?: string | null;
}

type RoiTab = Extract<ModuleTab, 'roi' | 'roi_analysis'>;

/** Demo (Atelier Toys) figures shown only when the demo toggle is on. */
const DEMO_ANALYSES: RoiAnalysis[] = [
  {
    id: 'demo-roi-1',
    name: 'Smart Factory MES Rollout',
    initiativeName: 'Smart Factory MES Rollout',
    status: 'EXECUTING',
    npv: 1_240_000,
    roi: 0.62,
    paybackMonths: 18,
    currency: 'EUR',
  },
  {
    id: 'demo-roi-2',
    name: 'Predictive Maintenance Pilot',
    initiativeName: 'Predictive Maintenance Pilot',
    status: 'APPROVED',
    npv: 480_000,
    roi: 0.41,
    paybackMonths: 24,
    currency: 'EUR',
  },
  {
    id: 'demo-roi-3',
    name: 'E-commerce Personalisation Engine',
    initiativeName: 'E-commerce Personalisation Engine',
    status: 'PLANNING',
    npv: 720_000,
    roi: 0.34,
    paybackMonths: 30,
    currency: 'EUR',
  },
];

/** roi_percent may be stored as a fraction (0.45) or a whole percent (45). */
function normaliseRoiPercent(roi?: number | null): number | null {
  if (roi == null || Number.isNaN(roi)) return null;
  return Math.abs(roi) <= 5 ? roi * 100 : roi;
}

// FIN-006/A O2: EUR (not PLN) is the neutral last-resort default — no caller
// deliberately chose PLN here, it only ever leaked in via an unrelated
// schema DEFAULT (see economics.routes.ts). Callers should pass the real
// `analysis.currency` whenever it is present.
function formatCurrency(value?: number | null, currency = 'EUR'): string {
  if (value == null || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value).toLocaleString()} ${currency}`;
  }
}

function formatPercent(value: number | null): string {
  if (value == null) return '—';
  return `${Math.round(value)}%`;
}

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
  teresaHint: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, icon, accent, teresaHint }) => (
  <div className="relative flex-1 min-w-[200px] rounded-2xl border border-c-border dark:border-c-border/60 bg-white dark:bg-c-surface-raised p-5 shadow-sm">
    <div className="flex items-start justify-between">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          accent
            ? 'bg-crimson-50 text-crimson-600 dark:bg-crimson-500/10 dark:text-crimson-400'
            : 'bg-c-surface-raised text-c-text-muted dark:bg-c-surface-raised dark:text-c-text-secondary'
        }`}
      >
        {icon}
      </div>
      <span
        title={teresaHint}
        className="inline-flex items-center gap-1 rounded-full border border-crimson-200/60 dark:border-crimson-500/30 px-2 py-0.5 text-[10px] font-medium text-crimson-600 dark:text-crimson-400"
      >
        <Sparkles className="h-3 w-3" />
        Teresa
      </span>
    </div>
    <div className="mt-4">
      <div
        className={`text-2xl font-bold ${
          accent ? 'text-crimson-600 dark:text-crimson-400' : 'text-c-text dark:text-white'
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-sm text-c-text-muted dark:text-c-text-muted">{label}</div>
    </div>
  </div>
);

export const FullROIView: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentProjectId = useAppStore((s) => s.currentProjectId);

  const [analyses, setAnalyses] = useState<RoiAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<RoiTab>('roi');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await Api.getEconomicsAnalyses(
        currentProjectId ? { projectId: currentProjectId } : undefined
      );
      const list: RoiAnalysis[] = (res?.analyses || []).map((a: any) => ({
        id: String(a.id),
        name: a.name || a.initiativeName || 'Analysis',
        initiativeId: a.initiativeId ?? null,
        initiativeName: a.initiativeName ?? null,
        status: a.status ?? null,
        npv: a.npv ?? a.financial_npv ?? null,
        roi: a.roi ?? a.roi_percent ?? a.financial_roi ?? null,
        paybackMonths: a.paybackMonths ?? a.payback_months ?? null,
        currency: a.currency ?? null,
      }));
      if (list.length === 0 && shouldAllowDemoData()) {
        setAnalyses(DEMO_ANALYSES);
      } else {
        setAnalyses(list);
      }
    } catch {
      if (shouldAllowDemoData()) {
        setAnalyses(DEMO_ANALYSES);
        setError(false);
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    const withNpv = analyses.filter((a) => typeof a.npv === 'number');
    const totalNpv = withNpv.reduce((sum, a) => sum + (a.npv || 0), 0);
    const rois = analyses
      .map((a) => normaliseRoiPercent(a.roi))
      .filter((v): v is number => v != null);
    const avgRoi = rois.length ? rois.reduce((s, v) => s + v, 0) / rois.length : null;
    const paybacks = analyses
      .map((a) => a.paybackMonths)
      .filter((v): v is number => typeof v === 'number');
    const avgPayback = paybacks.length
      ? Math.round(paybacks.reduce((s, v) => s + v, 0) / paybacks.length)
      : null;
    // Portfolio-level currency for the aggregate NPV KPI: same
    // first-non-null convention used by executionBudgetService's
    // getPortfolioBudgetSummary, since a single org's analyses share one
    // reporting currency in practice.
    const currency = analyses.find((a) => a.currency)?.currency ?? undefined;
    return { totalNpv, avgRoi, avgPayback, count: analyses.length, currency };
  }, [analyses]);

  const bestNpvId = useMemo(() => {
    let best: RoiAnalysis | null = null;
    for (const a of analyses) {
      if (typeof a.npv === 'number' && (!best || (a.npv || 0) > (best.npv || 0))) best = a;
    }
    return best?.id ?? null;
  }, [analyses]);

  const tabs = useMemo(
    () => [
      {
        id: 'roi' as ModuleTab,
        label: t('initiatives.roi.tabs.overview', 'Overview'),
        icon: <BarChart3 size={14} />,
      },
      {
        id: 'roi_analysis' as ModuleTab,
        label: t('initiatives.roi.tabs.compare', 'Scenario comparison'),
        icon: <GitCompare size={14} />,
      },
    ],
    [t]
  );

  const toggleCompare = (id: string) => {
    setSelectedForCompare((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const renderTable = () => (
    <div className="overflow-x-auto rounded-xl border border-c-border dark:border-c-border/60 bg-white dark:bg-c-surface-raised">
      <table
        /* §27-exempt: render danych nie-listowy, nie spelnia definicji 1 (przegladana kolekcja encji z akcjami) */ className="min-w-full text-sm"
        data-testid="roi-table"
      >
        <thead>
          <tr className="border-b border-c-border dark:border-c-border/60 text-left text-xs uppercase tracking-wide text-c-text-muted dark:text-c-text-muted">
            <th className="px-4 py-3 font-medium">
              {t('initiatives.roi.table.analysis', 'Analysis')}
            </th>
            <th className="px-4 py-3 font-medium">
              {t('initiatives.roi.table.initiative', 'Initiative')}
            </th>
            <th className="px-4 py-3 font-medium text-right">
              {t('initiatives.roi.table.npv', 'NPV')}
            </th>
            <th className="px-4 py-3 font-medium text-right">
              {t('initiatives.roi.table.roi', 'ROI %')}
            </th>
            <th className="px-4 py-3 font-medium">{t('initiatives.roi.table.status', 'Status')}</th>
          </tr>
        </thead>
        <tbody>
          {[...analyses]
            .sort((a, b) => (b.npv || 0) - (a.npv || 0))
            .map((a) => {
              const roiPct = normaliseRoiPercent(a.roi);
              return (
                <tr
                  key={a.id}
                  className="border-b border-c-border dark:border-c-border/40 transition-colors hover:bg-c-surface-raised dark:hover:bg-c-surface-raised/40"
                >
                  <td className="px-4 py-3 font-medium text-c-text dark:text-white">{a.name}</td>
                  <td className="px-4 py-3 text-c-text-secondary dark:text-c-text-secondary">
                    {a.initiativeName || (
                      <span className="text-c-text-secondary dark:text-c-text-muted">
                        {t('initiatives.roi.table.unlinked', 'Not linked')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-c-text dark:text-white">
                    {formatCurrency(a.npv, a.currency ?? undefined)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-semibold ${
                      roiPct != null && roiPct >= 0
                        ? 'text-crimson-600 dark:text-crimson-400'
                        : 'text-c-text-muted dark:text-c-text-muted'
                    }`}
                  >
                    {formatPercent(roiPct)}
                  </td>
                  <td className="px-4 py-3 text-c-text-muted dark:text-c-text-muted">
                    {a.status || '—'}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );

  const renderCompare = () => {
    const selected = analyses.filter((a) => selectedForCompare.includes(a.id));
    return (
      <div className="space-y-4">
        <p className="text-sm text-c-text-muted dark:text-c-text-muted">
          {t(
            'initiatives.roi.compare.hint',
            'Pick two or more analyses to compare NPV and ROI side by side.'
          )}
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {analyses.map((a) => {
            const checked = selectedForCompare.includes(a.id);
            const isBest = a.id === bestNpvId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleCompare(a.id)}
                className={`relative rounded-xl border p-4 text-left transition-all ${
                  checked
                    ? 'border-crimson-400 dark:border-crimson-500/60 bg-crimson-50/40 dark:bg-crimson-500/10'
                    : 'border-c-border dark:border-c-border/60 bg-white dark:bg-c-surface-raised hover:border-c-border-strong dark:hover:border-c-border-strong'
                }`}
              >
                {isBest && (
                  <span className="absolute right-3 top-3 rounded-full bg-crimson-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {t('initiatives.roi.compare.best', 'Best NPV')}
                  </span>
                )}
                <div className="font-medium text-c-text dark:text-white">{a.name}</div>
                <div className="mt-2 flex items-center gap-4 text-sm">
                  <span className="text-c-text-muted dark:text-c-text-muted">
                    {t('initiatives.roi.table.npv', 'NPV')}:{' '}
                    <span className="font-semibold text-c-text dark:text-white">
                      {formatCurrency(a.npv, a.currency ?? undefined)}
                    </span>
                  </span>
                  <span className="text-c-text-muted dark:text-c-text-muted">
                    {t('initiatives.roi.table.roi', 'ROI %')}:{' '}
                    <span className="font-semibold text-crimson-600 dark:text-crimson-400">
                      {formatPercent(normaliseRoiPercent(a.roi))}
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        {selected.length < 2 && (
          <p className="text-xs text-c-text-secondary dark:text-c-text-muted">
            {t('initiatives.roi.compare.empty', 'Select at least two analyses above to compare.')}
          </p>
        )}
      </div>
    );
  };

  const renderBody = () => {
    if (loading) {
      return (
        <div className="space-y-6 p-6">
          <div className="flex flex-wrap gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex-1 min-w-[200px] rounded-2xl border border-c-border dark:border-c-border/60 bg-white dark:bg-c-surface-raised p-5"
              >
                <LoadingState variant="pulse" rows={2} />
              </div>
            ))}
          </div>
          <LoadingState variant="skeleton" rows={5} />
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-6">
          <ErrorState
            title={t('initiatives.roi.error.title', "Couldn't load ROI data")}
            message={t(
              'initiatives.roi.error.message',
              "We couldn't reach the economics service. Please try again."
            )}
            retry={() => void load()}
          />
        </div>
      );
    }

    if (analyses.length === 0) {
      return (
        <div className="p-6">
          <EmptyState
            icon={<TrendingUp />}
            title={t('initiatives.roi.empty.title', 'No economic analyses yet')}
            description={t(
              'initiatives.roi.empty.description',
              'Link an initiative to an Economics analysis to see ROI, NPV and payback here.'
            )}
            action={{
              label: t('initiatives.roi.empty.cta', 'Go to Portfolio'),
              onClick: () => navigate(ROUTES.INITIATIVES),
            }}
          />
        </div>
      );
    }

    return (
      <div className="space-y-6 p-6" data-testid="roi-dashboard">
        <div className="flex flex-wrap gap-4">
          <KpiCard
            label={t('initiatives.roi.kpi.roi', 'Portfolio ROI')}
            value={formatPercent(kpis.avgRoi)}
            icon={<TrendingUp size={18} />}
            accent
            teresaHint={t('initiatives.roi.teresa.hint', 'Ask Teresa to model ROI')}
          />
          <KpiCard
            label={t('initiatives.roi.kpi.npv', 'Net Present Value')}
            value={formatCurrency(kpis.totalNpv, kpis.currency)}
            icon={<Wallet size={18} />}
            teresaHint={t('initiatives.roi.teresa.hint', 'Ask Teresa to model ROI')}
          />
          <KpiCard
            label={t('initiatives.roi.kpi.payback', 'Payback Period')}
            value={
              kpis.avgPayback != null
                ? t('initiatives.roi.months', {
                    count: kpis.avgPayback,
                    defaultValue: `${kpis.avgPayback} months`,
                  })
                : '—'
            }
            icon={<Timer size={18} />}
            teresaHint={t('initiatives.roi.teresa.hint', 'Ask Teresa to model ROI')}
          />
          <KpiCard
            label={t('initiatives.roi.kpi.analyses', 'Linked Analyses')}
            value={String(kpis.count)}
            icon={<BarChart3 size={18} />}
            teresaHint={t('initiatives.roi.teresa.hint', 'Ask Teresa to model ROI')}
          />
        </div>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-c-text-muted dark:text-c-text-muted">
            {activeTab === 'roi_analysis'
              ? t('initiatives.roi.compare.title', 'Scenario comparison')
              : t('initiatives.roi.table.title', 'ROI by analysis')}
          </h2>
          {activeTab === 'roi_analysis' ? renderCompare() : renderTable()}
        </section>
      </div>
    );
  };

  return (
    <div className="h-full" data-testid="full-roi-view">
      <StandardModuleBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as RoiTab)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={() => {}}
        openItems={[]}
        activeItemId={null}
        onSelectItem={() => {}}
        onCloseItem={() => {}}
        onShowList={() => setActiveTab('roi')}
        activeFilters={[]}
        onRemoveFilter={() => {}}
        onClearFilters={() => {}}
        viewModes={['table']}
        primaryCtaContent={
          <Button
            variant="brand"
            size="sm"
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            onClick={() => navigate(ROUTES.INITIATIVES)}
          >
            {t('initiatives.roi.empty.cta', 'Go to Portfolio')}
          </Button>
        }
      >
        <div className="h-full min-h-0 overflow-auto">{renderBody()}</div>
      </StandardModuleBar>
    </div>
  );
};

export default FullROIView;
