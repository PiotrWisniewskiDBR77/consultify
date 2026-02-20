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
          uniqueKpis.set(m.kpi_id, { id: m.kpi_id, name: m.kpi_name || 'Unknown', unit: m.unit || '' });
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

  if (loadingKpis) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (kpis.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-6">
        <PieChart className="w-12 h-12 text-purple-400/50 mb-3" />
        <p className="text-lg text-slate-900 dark:text-white">{t('kpi.attribution.noMappings', 'No KPI Mappings Found')}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t('kpi.attribution.noMappingsHint', 'Map KPIs to initiatives first to see attribution analysis.')}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* KPI Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('kpi.attribution.selectKpi', 'Select KPI')}:</label>
        <select
          value={selectedKpi}
          onChange={(e) => handleKpiSelect(e.target.value)}
          className="flex-1 max-w-md px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm"
        >
          <option value="">{t('kpi.attribution.choose', '— Choose a KPI —')}</option>
          {kpis.map((k) => (
            <option key={k.id} value={k.id}>{k.name} ({k.unit})</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
        </div>
      )}

      {attribution && !loading && (
        <>
          {/* Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label={t('kpi.attribution.kpiDelta', 'KPI Change')} value={attribution.kpiDelta.toFixed(2)} icon={<TrendingUp className="w-5 h-5 text-blue-400" />} />
            <MetricCard label={t('kpi.attribution.contributors', 'Contributors')} value={String(attribution.contributions.length)} icon={<Target className="w-5 h-5 text-green-400" />} />
            <MetricCard label={t('kpi.attribution.unexplained', 'Unexplained')} value={`${attribution.unexplainedPercent.toFixed(1)}%`} icon={<HelpCircle className="w-5 h-5 text-yellow-400" />} />
            <div className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Shield className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('kpi.attribution.confidence', 'Confidence')}</p>
                  <ConfBadge level={attribution.overallConfidence} />
                </div>
              </div>
            </div>
          </div>

          {/* Contribution Bar */}
          {attribution.contributions.length > 0 && (
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t('kpi.attribution.breakdown', 'Attribution Breakdown')}</h4>
              <div className="flex rounded-lg overflow-hidden h-8">
                {attribution.contributions.map((c, i) => (
                  <div
                    key={c.initiativeId}
                    className="flex items-center justify-center text-xs font-medium text-white cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ width: `${Math.max(c.contributionPercent, 3)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                    title={`${c.initiativeName}: ${c.contributionPercent}%`}
                    onClick={() => setExpandedContrib(expandedContrib === c.initiativeId ? null : c.initiativeId)}
                  >
                    {c.contributionPercent > 8 ? `${c.contributionPercent}%` : ''}
                  </div>
                ))}
                {attribution.unexplainedPercent > 2 && (
                  <div
                    className="flex items-center justify-center text-xs font-medium text-slate-500 bg-slate-200 dark:bg-navy-700"
                    style={{ width: `${attribution.unexplainedPercent}%` }}
                  >
                    {attribution.unexplainedPercent > 8 ? `${attribution.unexplainedPercent.toFixed(0)}%` : ''}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3 mt-3">
                {attribution.contributions.map((c, i) => (
                  <div key={c.initiativeId} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-slate-600 dark:text-slate-300">{c.initiativeName}</span>
                  </div>
                ))}
                {attribution.unexplainedPercent > 2 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-navy-600" />
                    <span className="text-slate-400">{t('kpi.attribution.unexplainedLabel', 'Unexplained / External')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contributors List */}
          <div className="space-y-2">
            {attribution.contributions.map((c) => (
              <div key={c.initiativeId} className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                <button
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-navy-800/50"
                  onClick={() => setExpandedContrib(expandedContrib === c.initiativeId ? null : c.initiativeId)}
                >
                  <div className="flex items-center gap-3">
                    {expandedContrib === c.initiativeId ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                    <span className="font-medium text-slate-900 dark:text-white">{c.initiativeName}</span>
                    <ConfBadge level={c.confidence} />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-purple-500">{c.contributionPercent}%</span>
                    <span className="text-sm text-slate-500">({c.contributionValue > 0 ? '+' : ''}{c.contributionValue.toFixed(2)})</span>
                  </div>
                </button>
                {expandedContrib === c.initiativeId && (
                  <div className="px-4 pb-4 space-y-2 border-t border-slate-100 dark:border-navy-700 pt-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300">{c.explanation}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.signals.map((s, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-navy-700 rounded-full text-slate-500 dark:text-slate-400">{s}</span>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 italic">{c.confidenceReason}</p>
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
                  <p className="font-medium text-yellow-800 dark:text-yellow-400 text-sm">{t('kpi.attribution.qualitySignals', 'Quality Signals')}</p>
                  <ul className="mt-1 space-y-0.5">
                    {attribution.confidenceReasons.map((r, i) => (
                      <li key={i} className="text-sm text-yellow-700 dark:text-yellow-300/80">• {r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-2 text-xs text-slate-400">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="italic">{attribution.disclaimer}</p>
          </div>
        </>
      )}
    </div>
  );
};

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#22c55e', '#ec4899', '#3b82f6', '#f97316'];

const MetricCard: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-slate-100 dark:bg-navy-700 rounded-lg">{icon}</div>
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  </div>
);

const ConfBadge: React.FC<{ level: string }> = ({ level }) => {
  const cls: Record<string, string> = {
    high: 'bg-green-500/20 text-green-600 dark:text-green-400',
    medium: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
    low: 'bg-red-500/20 text-red-600 dark:text-red-400',
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls[level] || cls.low}`}>{level}</span>;
};

export default KPIAttributionPanel;
