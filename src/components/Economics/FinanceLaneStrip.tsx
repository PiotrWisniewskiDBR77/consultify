import { AlertTriangle, CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type {
  FinanceLaneRun,
  FinanceLaneStep,
  KpiLinkageStatus,
} from '../../services/api/v8/finance';
import type { DegradedAlert } from './hooks/useFinanceLane';

interface FinanceLaneStripProps {
  activeLaneRun: FinanceLaneRun | null;
  degradedAlerts: DegradedAlert[];
  onOpenPanel?: () => void;
}

const STEPS: FinanceLaneStep[] = ['import', 'analysis', 'mutation', 'readback'];

function getStepStatus(
  step: FinanceLaneStep,
  run: FinanceLaneRun
): 'done' | 'active' | 'failed' | 'pending' {
  const stepIdx = STEPS.indexOf(step);
  const currentIdx = STEPS.indexOf(run.currentStep);

  if (stepIdx < currentIdx) return 'done';
  if (stepIdx > currentIdx) return 'pending';

  if (
    step === 'import' &&
    (run.importOutcome === 'failed' ||
      run.importOutcome === 'mapping_missing' ||
      run.importOutcome === 'schema_drift')
  )
    return 'failed';
  if (
    step === 'mutation' &&
    (run.mutationOutcome === 'failed' || run.mutationOutcome === 'conflict')
  )
    return 'failed';
  if (step === 'readback' && run.readbackConfirmed) return 'done';

  return 'active';
}

const StepIcon: React.FC<{ status: 'done' | 'active' | 'failed' | 'pending'; size?: number }> = ({
  status,
  size = 12,
}) => {
  switch (status) {
    case 'done':
      return <CheckCircle2 size={size} className="text-emerald-400" />;
    case 'active':
      return <Loader2 size={size} className="text-c-info animate-spin" />;
    case 'failed':
      return <XCircle size={size} className="text-danger-400" />;
    case 'pending':
      return <Circle size={size} className="text-slate-500" />;
  }
};

const KPI_DOT_COLORS: Record<KpiLinkageStatus, string> = {
  coherent: 'bg-emerald-400',
  stale: 'bg-amber-400',
  unavailable: 'bg-danger-400',
};

export const FinanceLaneStrip: React.FC<FinanceLaneStripProps> = ({
  activeLaneRun,
  degradedAlerts,
  onOpenPanel,
}) => {
  const { t } = useTranslation();
  if (!activeLaneRun) return null;

  const stepLabels: Record<FinanceLaneStep, string> = {
    import: t('finance.lane.steps.import', 'Import'),
    analysis: t('finance.lane.steps.analysis', 'Analysis'),
    mutation: t('finance.lane.steps.mutation', 'Mutation'),
    readback: t('finance.lane.steps.readback', 'Readback'),
  };

  const kpiLabels: Record<KpiLinkageStatus, string> = {
    coherent: t('finance.lane.kpi.coherent', 'KPI: coherent'),
    stale: t('finance.lane.kpi.stale', 'KPI: stale'),
    unavailable: t('finance.lane.kpi.unavailable', 'KPI: unavailable'),
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className="mx-1 h-5 w-px shrink-0 bg-slate-200/70 dark:bg-white/[0.08]" />

      {STEPS.map((step) => {
        const status = getStepStatus(step, activeLaneRun);
        return (
          <button
            key={step}
            className="h-8 inline-flex items-center gap-1 rounded-full px-2 text-[11px] font-medium border whitespace-nowrap bg-c-surface text-c-text-secondary border-c-border hover:bg-c-surface-raised transition-colors"
            onClick={onOpenPanel}
            type="button"
          >
            <StepIcon status={status} />
            <span>{stepLabels[step]}</span>
          </button>
        );
      })}

      {degradedAlerts.length > 0 && (
        <>
          <div className="mx-1 h-5 w-px shrink-0 bg-slate-200/70 dark:bg-white/[0.08]" />
          <button
            className="h-8 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium border whitespace-nowrap bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
            onClick={onOpenPanel}
            type="button"
          >
            <AlertTriangle size={12} />
            <span>
              {t('finance.lane.issueCount', '{{count}} issue', { count: degradedAlerts.length })}
              {degradedAlerts.length !== 1 ? 's' : ''}
            </span>
          </button>
        </>
      )}

      <div className="mx-1 h-5 w-px shrink-0 bg-slate-200/70 dark:bg-white/[0.08]" />

      <div className="h-8 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium border whitespace-nowrap bg-c-surface text-c-text-secondary border-c-border">
        <span
          className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${KPI_DOT_COLORS[activeLaneRun.kpiLinkageStatus]}`}
        />
        <span>{kpiLabels[activeLaneRun.kpiLinkageStatus]}</span>
      </div>

      <div className="h-8 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium border whitespace-nowrap bg-c-surface text-c-text-secondary border-c-border">
        <span
          className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${activeLaneRun.versionType === 'actual' ? 'bg-c-success' : 'bg-sky-400'}`}
        />
        <span>
          {activeLaneRun.versionType === 'actual'
            ? t('finance.lane.version.actual', 'Actual')
            : t('finance.lane.version.current', 'Current')}
        </span>
      </div>
    </div>
  );
};
