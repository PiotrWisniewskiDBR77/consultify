/**
 * KPI Attribution Panel (T048)
 * Contribution estimate + uncertainty + sponsor-grade output.
 */

import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Info,
  Loader2,
  PieChart,
  Shield,
  Target,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

interface ContributionEstimate {
  initiativeId: string;
  initiativeName: string;
  contributionPercent: number;
  contributionValue: number;
  confidence: 'low' | 'medium' | 'high';
  confidenceReason: string;
  explanation: string;
  signals: string[];
}

interface AttributionResult {
  kpiId: string;
  kpiName: string;
  periodStart: string;
  periodEnd: string;
  kpiDelta: number;
  contributions: ContributionEstimate[];
  unexplainedRemainder: number;
  unexplainedPercent: number;
  overallConfidence: 'low' | 'medium' | 'high';
  confidenceReasons: string[];
  assumptions: string[];
  disclaimer: string;
}

interface KPIOption {
  id: string;
  name: string;
  unit: string;
}

export const KPIAttributionPanel: React.FC = () => {
  const { t } = useTranslation();
  const [kpis, setKpis] = useState<KPIOption[]>([]);
  const [selectedKpi, setSelectedKpi] = useState<string>('');
  const [attribution, setAttribution] = useState<AttributionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [expandedContrib, setExpandedContrib] = useState<string | null>(null);
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  useEffect(() => {
    loadKPIs();
  }, []);

  const loadKPIs = async () => {
    setLoadingKpis(true);
    try {
      const res = await Api.get('/benefits/kpi-mappings');
      const uniqueKpis = new Map<string, KPIOption>();
      (res.data || []).forEach((m: any) => {
        if (m.kpi_id && !uniqueKpis.has(m.kpi_id)) {
          uniqueKpis.set(m.kpi_id, {
            id: m.kpi_id,
            name: m.kpi_name || 'Unknown',
            unit: m.unit || '',
          });
        }
      });
      setKpis(Array.from(uniqueKpis.values()));
    } catch {
      console.error('[Attribution] Failed to load KPIs');
    } finally {
      setLoadingKpis(false);
    }
  };

  const loadAttribution = useCallback(async (kpiId: string) => {
    if (!kpiId) return;
    setLoading(true);
    try {
      const res = await Api.get(`/benefits/attribution/${kpiId}`);
      setAttribution(res.data);
      trackFunnelEvent('kpi_attribution_viewed', { kpiId });
    } catch {
      console.error('[Attribution] Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKpiSelect = (kpiId: string) => {
    setSelectedKpi(kpiId);
    setAttribution(null);
    loadAttribution(kpiId);
  };

  const handleSaveSnapshot = useCallback(async () => {
    if (!selectedKpi || !attribution) return;
    setSavingSnapshot(true);
    try {
      await Api.post(`/benefits/attribution/${selectedKpi}/snapshot`, {
        periodStart: attribution.periodStart,
        periodEnd: attribution.periodEnd,
      });
      toast.success(t('kpi.attribution.snapshotSaved', 'Attribution snapshot saved'));
    } catch {
      toast.error(t('kpi.attribution.snapshotFailed', 'Failed to save attribution snapshot'));
    } finally {
      setSavingSnapshot(false);
    }
  }, [attribution, selectedKpi, t]);

  if (loadingKpis) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-c-info animate-spin" />
      </div>
    );
  }

  if (kpis.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-6">
        <PieChart className="w-12 h-12 text-c-text-muted mb-3" />
        <p className="text-lg text-c-text dark:text-white">
          {t('kpi.attribution.noMappings', 'No KPI Mappings Found')}
        </p>
        <p className="text-sm text-c-text-muted dark:text-c-text-muted mt-1">
          {t(
            'kpi.attribution.noMappingsHint',
            'Map KPIs to initiatives first to see attribution analysis.'
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* KPI Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-c-text-secondary dark:text-c-text-secondary">
          {t('kpi.attribution.selectKpi', 'Select KPI')}:
        </label>
        <select
          value={selectedKpi}
          onChange={(e) => handleKpiSelect(e.target.value)}
          className="flex-1 max-w-md px-3 py-2 rounded-lg border border-c-border-strong dark:border-c-border-strong bg-white dark:bg-c-surface-raised text-c-text dark:text-white text-sm"
        >
          <option value="">{t('kpi.attribution.choose', '— Choose a KPI —')}</option>
          {kpis.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name} ({k.unit})
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 text-c-info animate-spin" />
        </div>
      )}

      {attribution && !loading && (
        <>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2">
                <Shield className="mt-0.5 h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                    {t('kpi.attribution.policyTitle', 'Attribution policy')}
                  </p>
                  <p className="mt-1 text-sm text-blue-800 dark:text-blue-200/90">
                    {t(
                      'kpi.attribution.policyBody',
                      'Manual KPI-to-initiative mappings are the source of truth. Heuristic attribution is advisory and should be reviewed before downstream finance or reporting decisions.'
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleSaveSnapshot()}
                disabled={savingSnapshot}
                className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60 dark:border-blue-400/20 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/30"
              >
                {savingSnapshot
                  ? t('common.saving', 'Saving...')
                  : t('kpi.attribution.saveSnapshot', 'Save snapshot')}
              </button>
            </div>
          </div>

          {/* Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label={t('kpi.attribution.kpiDelta', 'KPI Change')}
              value={attribution.kpiDelta.toFixed(2)}
              icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
            />
            <MetricCard
              label={t('kpi.attribution.contributors', 'Contributors')}
              value={String(attribution.contributions.length)}
              icon={<Target className="w-5 h-5 text-green-400" />}
            />
            <MetricCard
              label={t('kpi.attribution.unexplained', 'Unexplained')}
              value={`${attribution.unexplainedPercent.toFixed(1)}%`}
              icon={<HelpCircle className="w-5 h-5 text-yellow-400" />}
            />
            <div className="bg-c-surface-raised dark:bg-c-surface-raised rounded-xl p-4 border border-c-border dark:border-c-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-c-info/10 rounded-lg">
                  <Shield className="w-5 h-5 text-c-info" />
                </div>
                <div>
                  <p className="text-sm text-c-text-muted dark:text-c-text-muted">
                    {t('kpi.attribution.confidence', 'Confidence')}
                  </p>
                  <ConfBadge level={attribution.overallConfidence} />
                </div>
              </div>
            </div>
          </div>

          {/* Contribution Bar */}
          {attribution.contributions.length > 0 && (
            <div className="bg-white dark:bg-c-surface rounded-xl border border-c-border dark:border-c-border p-4">
              <h4 className="text-sm font-medium text-c-text-secondary dark:text-c-text-secondary mb-3">
                {t('kpi.attribution.breakdown', 'Attribution Breakdown')}
              </h4>
              <div className="flex rounded-lg overflow-hidden h-8">
                {attribution.contributions.map((c, i) => (
                  <div
                    key={c.initiativeId}
                    className="flex items-center justify-center text-xs font-medium text-white cursor-pointer hover:opacity-80 transition-opacity"
                    style={{
                      width: `${Math.max(c.contributionPercent, 3)}%`,
                      backgroundColor: COLORS[i % COLORS.length],
                    }}
                    title={`${c.initiativeName}: ${c.contributionPercent}%`}
                    onClick={() =>
                      setExpandedContrib(expandedContrib === c.initiativeId ? null : c.initiativeId)
                    }
                  >
                    {c.contributionPercent > 8 ? `${c.contributionPercent}%` : ''}
                  </div>
                ))}
                {attribution.unexplainedPercent > 2 && (
                  <div
                    className="flex items-center justify-center text-xs font-medium text-c-text-muted bg-c-surface-raised dark:bg-c-surface-raised"
                    style={{ width: `${attribution.unexplainedPercent}%` }}
                  >
                    {attribution.unexplainedPercent > 8
                      ? `${attribution.unexplainedPercent.toFixed(0)}%`
                      : ''}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3 mt-3">
                {attribution.contributions.map((c, i) => (
                  <div key={c.initiativeId} className="flex items-center gap-1.5 text-xs">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-c-text-secondary dark:text-c-text-secondary">{c.initiativeName}</span>
                  </div>
                ))}
                {attribution.unexplainedPercent > 2 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full bg-c-surface-raised dark:bg-c-surface-raised" />
                    <span className="text-c-text-secondary">
                      {t('kpi.attribution.unexplainedLabel', 'Unexplained / External')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contributors List */}
          <div className="space-y-2">
            {attribution.contributions.map((c) => (
              <div
                key={c.initiativeId}
                className="bg-white dark:bg-c-surface rounded-xl border border-c-border dark:border-c-border overflow-hidden"
              >
                <button
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-c-surface-raised dark:hover:bg-c-surface-raised/50"
                  onClick={() =>
                    setExpandedContrib(expandedContrib === c.initiativeId ? null : c.initiativeId)
                  }
                >
                  <div className="flex items-center gap-3">
                    {expandedContrib === c.initiativeId ? (
                      <ChevronDown size={16} className="text-c-text-secondary" />
                    ) : (
                      <ChevronRight size={16} className="text-c-text-secondary" />
                    )}
                    <span className="font-medium text-c-text dark:text-white">
                      {c.initiativeName}
                    </span>
                    <ConfBadge level={c.confidence} />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-c-text">
                      {c.contributionPercent}%
                    </span>
                    <span className="text-sm text-c-text-muted">
                      ({c.contributionValue > 0 ? '+' : ''}
                      {c.contributionValue.toFixed(2)})
                    </span>
                  </div>
                </button>
                {expandedContrib === c.initiativeId && (
                  <div className="px-4 pb-4 space-y-2 border-t border-c-border dark:border-c-border pt-3">
                    <p className="text-sm text-c-text-secondary dark:text-c-text-secondary">{c.explanation}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.signals.map((s, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 bg-c-surface-raised dark:bg-c-surface-raised rounded-full text-c-text-muted dark:text-c-text-muted"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-c-text-secondary italic">{c.confidenceReason}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Confidence Reasons */}
          {attribution.confidenceReasons.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-500/5 border border-yellow-200 dark:border-yellow-500/20 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-400 text-sm">
                    {t('kpi.attribution.qualitySignals', 'Quality Signals')}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {attribution.confidenceReasons.map((r, i) => (
                      <li key={i} className="text-sm text-yellow-700 dark:text-yellow-300/80">
                        • {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-2 text-xs text-c-text-secondary">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="italic">{attribution.disclaimer}</p>
          </div>
        </>
      )}
    </div>
  );
};

const COLORS = [
  '#6366f1',
  '#3b82f6',
  '#f59e0b',
  '#f43f5e',
  '#22c55e',
  '#ec4899',
  '#3b82f6',
  '#f59e0b',
];

const MetricCard: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({
  label,
  value,
  icon,
}) => (
  <div className="bg-c-surface-raised dark:bg-c-surface-raised rounded-xl p-4 border border-c-border dark:border-c-border">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-c-surface-raised dark:bg-c-surface-raised rounded-lg">{icon}</div>
      <div>
        <p className="text-sm text-c-text-muted dark:text-c-text-muted">{label}</p>
        <p className="text-2xl font-bold text-c-text dark:text-white">{value}</p>
      </div>
    </div>
  </div>
);

const ConfBadge: React.FC<{ level: string }> = ({ level }) => {
  const cls: Record<string, string> = {
    high: 'bg-green-500/20 text-green-600 dark:text-green-400',
    medium: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
    low: 'bg-danger-500/20 text-danger-600 dark:text-danger-400',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls[level] || cls.low}`}>
      {level}
    </span>
  );
};

export default KPIAttributionPanel;
