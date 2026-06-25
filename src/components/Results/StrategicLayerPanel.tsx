/**
 * StrategicLayerPanel — M15/W5 tasks 5.1–5.8.
 * Renders BSC (4 perspectives) + BDN stats + OKR summary + adoption + sustainment.
 * Data from /api/results-strategic/:projectId/strategic + /api/results-extended/:projectId/adoption
 * + /api/results-extended/:projectId/sustainment.
 * Behind flag resultsFeatureFlags('strategicLayer').
 */
import { AlertTriangle, CheckCircle2, Layers, Target, TrendingUp } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

interface BscPerspective {
  perspective: string;
  totalKpis: number;
  onTarget: number;
  below: number;
  noData: number;
  health: number;
}

interface BdnStats {
  nodeCount: number;
  edgeCount: number;
  benefitCount: number;
  enablerCount: number;
}

interface AdoptionFlag {
  id: string;
  atRisk: boolean;
  reason?: string;
}

interface SustainmentStatus {
  id: string;
  name: string;
  status: 'sustained' | 'at-risk' | 'unowned' | 'overdue-review';
  reasons: string[];
}

interface SustainmentSummary {
  total: number;
  sustained: number;
  atRisk: number;
  unowned: number;
}

interface StrategicData {
  bsc: {
    perspectives: BscPerspective[];
    totalKpis: number;
    overallHealth: number;
  };
  bdn: {
    stats: BdnStats;
  };
  narrative: {
    executiveSummary?: string;
  };
}

interface AdoptionData {
  flags: AdoptionFlag[];
  total: number;
  atRiskCount: number;
}

interface SustainmentData {
  statuses: SustainmentStatus[];
  summary: SustainmentSummary;
}

const PERSPECTIVE_LABELS: Record<string, string> = {
  financial: 'Finanse',
  customer: 'Klient',
  process: 'Procesy',
  learning: 'Rozwój',
};

const STATUS_COLORS: Record<string, string> = {
  sustained: 'text-emerald-600 dark:text-emerald-400',
  'at-risk': 'text-amber-600 dark:text-amber-400',
  unowned: 'text-slate-500',
  'overdue-review': 'text-red-600 dark:text-red-400',
};

interface Props {
  projectId?: string;
}

const StrategicLayerPanel: React.FC<Props> = ({ projectId = 'all' }) => {
  const { t } = useTranslation();
  const [strategic, setStrategic] = useState<StrategicData | null>(null);
  const [adoption, setAdoption] = useState<AdoptionData | null>(null);
  const [sustainment, setSustainment] = useState<SustainmentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      Api.get(`/results-strategic/${projectId}/strategic`),
      Api.get(`/results-extended/${projectId}/adoption`),
      Api.get(`/results-extended/${projectId}/sustainment`),
    ]).then(([s, a, su]) => {
      if (s.status === 'fulfilled') setStrategic((s.value as any)?.data ?? s.value);
      if (a.status === 'fulfilled') setAdoption((a.value as any)?.data ?? a.value);
      if (su.status === 'fulfilled') setSustainment((su.value as any)?.data ?? su.value);
    }).finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div data-testid="strategic-layer-loading" className="flex items-center justify-center py-12 text-slate-400 text-sm">
        <Layers size={16} className="mr-2 animate-pulse" />
        {t('common.loading', 'Loading...')}
      </div>
    );
  }

  const bscPerspectives = strategic?.bsc?.perspectives ?? [];
  const bdnStats = strategic?.bdn?.stats;
  const adoptionFlags = adoption?.flags ?? [];
  const sustainStatuses = sustainment?.statuses ?? [];
  const sustainSummary = sustainment?.summary;

  return (
    <div data-testid="strategic-layer-panel" className="space-y-6">

      {/* BSC — 4 perspektywy */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
          <Target size={14} />
          {t('results.strategic.bsc', 'Balanced Scorecard')}
          {strategic?.bsc?.totalKpis != null && (
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              ({strategic.bsc.totalKpis} KPI)
            </span>
          )}
        </h3>

        {bscPerspectives.length === 0 ? (
          <div className="text-sm text-slate-400 py-4 text-center">
            {t('results.strategic.bscNoData', 'Brak KPI — dodaj KPI i powiąż je z inicjatywami.')}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['financial', 'customer', 'process', 'learning'] as const).map((persp) => {
              const p = bscPerspectives.find((pp) => pp.perspective === persp) ?? {
                perspective: persp, totalKpis: 0, onTarget: 0, below: 0, noData: 0, health: 0,
              };
              const healthColor = p.health >= 0.7 ? 'text-emerald-600 dark:text-emerald-400'
                : p.health >= 0.4 ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400';
              return (
                <div key={persp} className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                    {t(`results.strategic.perspective.${persp}`, PERSPECTIVE_LABELS[persp])}
                  </div>
                  <div className={`text-2xl font-bold ${healthColor}`}>
                    {Math.round(p.health * 100)}%
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {p.onTarget} OK / {p.below} niżej / {p.noData} brak
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(p.health * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* BDN Stats */}
      {bdnStats && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <TrendingUp size={14} />
            {t('results.strategic.bdn', 'Benefits Dependency Network')}
          </h3>
          <div className="flex flex-wrap gap-3">
            {[
              { label: t('results.strategic.bdnBenefits', 'Korzyści'), value: bdnStats.benefitCount },
              { label: t('results.strategic.bdnEnablers', 'Enablerzy'), value: bdnStats.enablerCount },
              { label: t('results.strategic.bdnLinks', 'Powiązania'), value: bdnStats.edgeCount },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] px-4 py-2.5">
                <div className="text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
                <div className="text-xl font-semibold text-slate-800 dark:text-slate-100">{s.value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Adoption risk */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
          <AlertTriangle size={14} />
          {t('results.strategic.adoption', 'Adopcja → ryzyko korzyści')}
          {adoption && (
            <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
              {adoption.atRiskCount} / {adoption.total}
            </span>
          )}
        </h3>
        {adoptionFlags.length === 0 ? (
          <div className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 size={14} />
            {t('results.strategic.adoptionOk', 'Brak inicjatyw zagrożonych słabą adopcją.')}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {adoptionFlags.slice(0, 8).map((f) => (
              <div key={f.id} className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300">
                ID {f.id.slice(0, 8)}… {f.reason ?? 'słaba adopcja'}
              </div>
            ))}
            {adoptionFlags.length > 8 && (
              <div className="text-xs text-slate-400 flex items-center">
                +{adoptionFlags.length - 8} więcej
              </div>
            )}
          </div>
        )}
      </section>

      {/* Sustainment */}
      {sustainSummary && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <CheckCircle2 size={14} />
            {t('results.strategic.sustainment', 'Utrzymanie wartości')}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { key: 'total', label: 'Razem', value: sustainSummary.total, color: 'text-slate-700 dark:text-slate-200' },
              { key: 'sustained', label: 'Utrzymane', value: sustainSummary.sustained, color: 'text-emerald-600 dark:text-emerald-400' },
              { key: 'atRisk', label: 'Zagrożone', value: sustainSummary.atRisk, color: 'text-amber-600 dark:text-amber-400' },
              { key: 'unowned', label: 'Bez właściciela', value: sustainSummary.unowned, color: 'text-red-600 dark:text-red-400' },
            ].map((s) => (
              <div key={s.key} className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {sustainStatuses.slice(0, 5).some((s) => s.status !== 'sustained') && (
            <div className="mt-3 space-y-1.5">
              {sustainStatuses
                .filter((s) => s.status !== 'sustained')
                .slice(0, 5)
                .map((s) => (
                  <div key={s.id} className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-white/[0.03] px-3 py-2 text-sm">
                    <span className={`font-medium shrink-0 ${STATUS_COLORS[s.status] ?? 'text-slate-500'}`}>
                      {s.status}
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 truncate">{s.name}</span>
                    {s.reasons[0] && (
                      <span className="text-xs text-slate-400 ml-auto shrink-0">{s.reasons[0]}</span>
                    )}
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      {/* Executive narrative */}
      {strategic?.narrative?.executiveSummary && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
            {t('results.strategic.narrative', 'Narracja zarządcza')}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4">
            {strategic.narrative.executiveSummary}
          </p>
        </section>
      )}
    </div>
  );
};

export default StrategicLayerPanel;
