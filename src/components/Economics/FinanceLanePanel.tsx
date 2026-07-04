import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Loader2,
  Lock,
  Shield,
  XCircle,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  FinanceLaneRun,
  FinanceLaneStep,
  FinanceMutationAudit,
  FinanceVersionSnapshot,
  KpiCoherenceResult,
} from '../../services/api/v8/finance';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { FinanceVersionTimeline } from './FinanceVersionTimeline';
import type { DegradedAlert, DegradedSeverity } from './hooks/useFinanceLane';

interface FinanceLanePanelProps {
  open: boolean;
  onClose: () => void;
  activeLaneRun: FinanceLaneRun | null;
  degradedAlerts: DegradedAlert[];
  mutationAudits: FinanceMutationAudit[];
  kpiCoherence: KpiCoherenceResult | null;
  versionSnapshots: FinanceVersionSnapshot[];
  onAdvanceStep?: (outcome: string, detail?: string) => Promise<unknown>;
  onFinalizeVersion?: (snapshotId: string) => Promise<unknown>;
  onRefreshCoherence?: () => Promise<void>;
  loading?: boolean;
}

const STEPS: FinanceLaneStep[] = ['import', 'analysis', 'mutation', 'readback'];

const VALID_OUTCOMES: Record<FinanceLaneStep, string[]> = {
  import: ['completed', 'completed_with_warnings', 'failed', 'mapping_missing', 'schema_drift'],
  analysis: ['completed', 'failed'],
  mutation: ['applied', 'failed', 'conflict', 'rolled_back'],
  readback: ['confirmed', 'failed'],
};

const SEVERITY_VARIANT: Record<DegradedSeverity, 'destructive' | 'warning' | 'default'> = {
  destructive: 'destructive',
  warning: 'warning',
  info: 'default',
};

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

function StepIcon({ status }: { status: 'done' | 'active' | 'failed' | 'pending' }) {
  switch (status) {
    case 'done':
      return <CheckCircle2 size={18} className="text-emerald-400" />;
    case 'active':
      return <Loader2 size={18} className="text-primary-400 animate-spin" />;
    case 'failed':
      return <XCircle size={18} className="text-danger-400" />;
    case 'pending':
      return <Circle size={18} className="text-slate-500" />;
  }
}

function getStepOutcome(step: FinanceLaneStep, run: FinanceLaneRun): string | null {
  if (step === 'import') return run.importOutcome;
  if (step === 'analysis') return run.analysisCompleted ? 'completed' : null;
  if (step === 'mutation') return run.mutationOutcome;
  if (step === 'readback') return run.readbackConfirmed ? 'confirmed' : null;
  return null;
}

export const FinanceLanePanel: React.FC<FinanceLanePanelProps> = ({
  open,
  onClose,
  activeLaneRun,
  degradedAlerts,
  mutationAudits,
  kpiCoherence,
  versionSnapshots,
  onAdvanceStep,
  onFinalizeVersion,
  onRefreshCoherence,
  loading,
}) => {
  const { t } = useTranslation();
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceDetail, setAdvanceDetail] = useState('');

  if (!open) return null;

  const stepLabels: Record<FinanceLaneStep, string> = {
    import: t('finance.lane.steps.import', 'Import'),
    analysis: t('finance.lane.steps.analysisL123', 'Analysis (L1/L2/L3)'),
    mutation: t('finance.lane.steps.mutation', 'Mutation'),
    readback: t('finance.lane.steps.readback', 'Readback'),
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full max-w-lg flex-col p-0 shadow-2xl dark:bg-slate-900"
      >
        <SheetHeader className="shrink-0 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t('finance.lane.title', 'Finance Lane')}
              </SheetTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {activeLaneRun
                  ? `${t('finance.lane.run', 'Run')} ${activeLaneRun.runId.slice(0, 8)}… · ${activeLaneRun.versionType}`
                  : t('finance.lane.noActiveRun', 'No active run')}
              </p>
            </div>
            <SheetClose className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100" />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Lane Progress Stepper */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              {t('finance.lane.progress', 'Lane Progress')}
            </h3>
            {activeLaneRun ? (
              <div className="space-y-1">
                {STEPS.map((step, idx) => {
                  const status = getStepStatus(step, activeLaneRun);
                  const outcome = getStepOutcome(step, activeLaneRun);
                  const auditEntry = activeLaneRun.auditTrail.filter((a) => a.step === step);
                  const isCurrentStep = activeLaneRun.currentStep === step;

                  return (
                    <div key={step} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <StepIcon status={status} />
                        {idx < STEPS.length - 1 && (
                          <div
                            className={`w-px flex-1 min-h-[24px] ${status === 'done' ? 'bg-emerald-300 dark:bg-emerald-500/40' : 'bg-slate-200 dark:bg-slate-700'}`}
                          />
                        )}
                      </div>
                      <div className="pb-4 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {stepLabels[step]}
                          </span>
                          {outcome && (
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                status === 'failed'
                                  ? 'bg-danger-100 text-danger-600 dark:bg-danger-500/20 dark:text-danger-300'
                                  : status === 'done'
                                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300'
                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                              }`}
                            >
                              {outcome}
                            </span>
                          )}
                        </div>
                        {auditEntry.length > 0 && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {auditEntry.at(-1)?.at
                              ? new Date(auditEntry.at(-1)!.at).toLocaleString()
                              : ''}{' '}
                            {auditEntry.at(-1)?.detail && `— ${auditEntry.at(-1)!.detail}`}
                          </p>
                        )}
                        {isCurrentStep && !loading && onAdvanceStep && (
                          <div className="mt-2 relative">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] transition-colors"
                                onClick={() => setAdvanceOpen(!advanceOpen)}
                              >
                                {t('finance.lane.advance', 'Advance')} <ChevronDown size={12} />
                              </button>
                            </div>
                            {advanceOpen && (
                              <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg py-1 min-w-[220px]">
                                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                                  <input
                                    type="text"
                                    value={advanceDetail}
                                    onChange={(e) => setAdvanceDetail(e.target.value)}
                                    placeholder={t(
                                      'finance.lane.advanceDetailPlaceholder',
                                      'Optional detail / note…'
                                    )}
                                    className="w-full text-xs px-2 py-1.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                                  />
                                </div>
                                {VALID_OUTCOMES[step].map((o) => (
                                  <button
                                    key={o}
                                    type="button"
                                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                    onClick={() => {
                                      const detail = advanceDetail.trim() || undefined;
                                      setAdvanceOpen(false);
                                      setAdvanceDetail('');
                                      onAdvanceStep(o, detail);
                                    }}
                                  >
                                    {o.replace(/_/g, ' ')}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t(
                  'finance.lane.noActiveRunHint',
                  'No active lane run. Start one from the Analyze menu.'
                )}
              </p>
            )}
          </section>

          {/* Degraded States */}
          {degradedAlerts.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-500" />
                {t('finance.lane.issues', 'Issues')} ({degradedAlerts.length})
              </h3>
              <div className="space-y-2">
                {degradedAlerts.map((alert, i) => (
                  <Alert key={`${alert.reason}-${i}`} variant={SEVERITY_VARIANT[alert.severity]}>
                    <AlertTitle className="text-xs">{alert.title}</AlertTitle>
                    <AlertDescription>
                      <p className="text-xs mt-1">{alert.description}</p>
                      <p className="text-xs mt-1.5 font-medium flex items-center gap-1">
                        <ArrowRight size={10} /> {alert.nextAction}
                      </p>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </section>
          )}

          {/* Audit Trail */}
          {(activeLaneRun?.auditTrail?.length ?? 0) > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                <Clock size={14} />
                {t('finance.lane.auditTrail', 'Audit Trail')}
              </h3>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {[...(activeLaneRun?.auditTrail || [])].reverse().map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className="text-slate-600 dark:text-slate-500 whitespace-nowrap font-mono">
                      {new Date(entry.at).toLocaleTimeString()}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300">
                      <span className="font-medium">{entry.step}</span> → {entry.outcome}
                      {entry.detail && <span className="text-slate-600"> — {entry.detail}</span>}
                    </span>
                  </div>
                ))}
              </div>

              {mutationAudits.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-1.5 max-h-32 overflow-y-auto">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    {t('finance.lane.mutationAudits', 'Mutation Audits')}
                  </p>
                  {mutationAudits.map((a) => (
                    <div key={a.auditId} className="flex items-start gap-2 text-[11px]">
                      <span className="text-slate-600 dark:text-slate-500 whitespace-nowrap font-mono">
                        {new Date(a.createdAt).toLocaleTimeString()}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {a.mutationType} →{' '}
                        <span
                          className={a.outcome === 'applied' ? 'text-emerald-500' : 'text-danger-500'}
                        >
                          {a.outcome}
                        </span>{' '}
                        {t('finance.lane.on', 'on')} {a.targetEntity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* KPI Coherence */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
              <Shield size={14} />
              {t('finance.lane.kpiCoherence', 'KPI Coherence')}
            </h3>
            {kpiCoherence ? (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      kpiCoherence.status === 'coherent'
                        ? 'bg-emerald-400'
                        : kpiCoherence.status === 'stale'
                          ? 'bg-amber-400'
                          : 'bg-danger-400'
                    }`}
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
                    {kpiCoherence.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {kpiCoherence.detail}
                </p>
                {kpiCoherence.reconciliationMismatches &&
                  kpiCoherence.reconciliationMismatches.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {kpiCoherence.reconciliationMismatches.map((m) => (
                        <div
                          key={m.reconciliationId}
                          className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1"
                        >
                          <span className="font-mono">{m.reconciliationId.slice(0, 8)}…</span>
                          <span className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px]">
                            {m.mismatchCategory}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                {onRefreshCoherence && (
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors"
                    onClick={onRefreshCoherence}
                  >
                    {t('finance.lane.refreshCoherence', 'Refresh coherence check')}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeLaneRun
                  ? t('finance.lane.coherenceNotChecked', 'Coherence not yet checked.')
                  : t('finance.lane.startToCheck', 'Start a lane run to check coherence.')}
              </p>
            )}
          </section>

          {/* Version Snapshots */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
              <Lock size={14} />
              {t('finance.lane.versionSnapshots', 'Version Snapshots')}
            </h3>
            {versionSnapshots.length > 0 ? (
              <div className="space-y-3">
                <FinanceVersionTimeline snapshots={versionSnapshots} />
                {versionSnapshots
                  .filter((snap) => !snap.isFinalized && snap.versionType === 'actual')
                  .map((snap) => (
                    <button
                      key={snap.snapshotId}
                      type="button"
                      className="text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors"
                      onClick={() => onFinalizeVersion?.(snap.snapshotId)}
                    >
                      {t('finance.lane.finalizeSwitchover', 'Finalize')}{' '}
                      {snap.snapshotId.slice(0, 8)}…
                    </button>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('finance.lane.noSnapshots', 'No version snapshots yet.')}
              </p>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};
