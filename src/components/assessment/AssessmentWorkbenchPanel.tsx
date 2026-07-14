import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import {
  V8AssessmentApi,
  type V8AssessmentDefinitionRecord,
  type V8AssessmentWorkbench,
} from '@/services/api/v8/assessment';

interface AssessmentWorkbenchPanelProps {
  assessmentId: string;
  permissions?: {
    canView: boolean;
    canEdit: boolean;
    canApprove: boolean;
  };
}

function parseJsonRecord(raw: string, fallback: Record<string, number>): Record<string, number> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : fallback;
  } catch {
    return fallback;
  }
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function getErrorMessage(error: any): string {
  return error?.error || error?.message || 'Workbench request failed';
}

export const AssessmentWorkbenchPanel: React.FC<AssessmentWorkbenchPanelProps> = ({
  assessmentId,
  permissions,
}) => {
  const [workbench, setWorkbench] = useState<V8AssessmentWorkbench | null>(null);
  const [definition, setDefinition] = useState<V8AssessmentDefinitionRecord | null>(null);
  const [whatNext, setWhatNext] = useState<string[]>([]);
  const [promotionValidation, setPromotionValidation] = useState<string[]>([]);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inlineErrorSteps, setInlineErrorSteps] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const [evidenceKind, setEvidenceKind] = useState('document');
  const [evidenceRef, setEvidenceRef] = useState('');
  const [evidenceLabel, setEvidenceLabel] = useState('');

  const [scoreRationale, setScoreRationale] = useState('');
  const [scoreValuesRaw, setScoreValuesRaw] = useState('{"readiness":3}');
  const [scoreConfidence, setScoreConfidence] = useState('0.7');
  const [scoreAssumptions, setScoreAssumptions] = useState('');
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [overrideScoreRaw, setOverrideScoreRaw] = useState('{"readiness":4}');

  const [interpretationSummary, setInterpretationSummary] = useState('');
  const [interpretationFindings, setInterpretationFindings] = useState('');
  const [interpretationLimits, setInterpretationLimits] = useState('');
  const [interpretationActions, setInterpretationActions] = useState('');
  const [overrideSummary, setOverrideSummary] = useState('');

  const [promotionTargetKind, setPromotionTargetKind] = useState<
    'outputs_artifact' | 'interview_insight'
  >('outputs_artifact');
  const [promotionTargetRef, setPromotionTargetRef] = useState('');
  const canViewUi = permissions?.canView ?? true;
  const canEditUi = permissions?.canEdit ?? true;
  const canApproveUi = permissions?.canApprove ?? true;

  const loadWorkbench = useCallback(async () => {
    if (!assessmentId) return;
    setIsLoading(true);
    setInlineError(null);
    setInlineErrorSteps([]);
    try {
      const [workbenchResponse, definitionResponse, promotionResponse] = await Promise.all([
        V8AssessmentApi.getWorkbench(assessmentId),
        V8AssessmentApi.getWorkbenchDefinition(assessmentId),
        V8AssessmentApi.getWorkbenchPromotionPayload(assessmentId).catch(() => null),
      ]);
      setWorkbench(workbenchResponse.workbench);
      setWhatNext(workbenchResponse.whatNext || []);
      setDefinition(definitionResponse.definition || null);
      setPromotionValidation(promotionResponse?.validationErrors || []);
      setSelectedEvidenceIds((prev) =>
        prev.filter((id) =>
          workbenchResponse.workbench.evidencePointers.some((pointer) => pointer.id === id)
        )
      );
    } catch (error: any) {
      setInlineError(getErrorMessage(error));
      setInlineErrorSteps(Array.isArray(error?.whatNext) ? error.whatNext : []);
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    void loadWorkbench();
  }, [loadWorkbench]);

  const runAction = useCallback(
    async (fn: () => Promise<any>, successMessage: string) => {
      setIsBusy(true);
      setInlineError(null);
      setInlineErrorSteps([]);
      try {
        await fn();
        toast.success(successMessage);
        await loadWorkbench();
      } catch (error: any) {
        setInlineError(getErrorMessage(error));
        setInlineErrorSteps(Array.isArray(error?.whatNext) ? error.whatNext : []);
        toast.error(getErrorMessage(error));
      } finally {
        setIsBusy(false);
      }
    },
    [loadWorkbench]
  );

  const evidenceOptions = workbench?.evidencePointers || [];

  const canComplete = useMemo(() => {
    return (
      workbench?.runState === 'interpretation_reviewed' || workbench?.runState === 'score_reviewed'
    );
  }, [workbench?.runState]);

  const businessSummary = useMemo(() => {
    const runStateLabel = String(workbench?.runState || 'draft').replace(/_/g, ' ');
    const primaryGuidance =
      workbench?.degraded?.message ||
      whatNext[0] ||
      'Move the run forward by attaching evidence, reviewing proposals, and promoting only approved outputs.';

    const reviewState = workbench?.interpretationReview?.status
      ? `Interpretation ${workbench.interpretationReview.status}`
      : workbench?.scoreReview?.status
        ? `Score ${workbench.scoreReview.status}`
        : 'Review not started';

    const promotionState = workbench?.promotionTraces?.length
      ? `${workbench.promotionTraces.length} downstream handoff(s) recorded`
      : workbench?.pendingPromotion
        ? 'Promotion retry pending'
        : 'No downstream handoff yet';

    return {
      runStateLabel,
      primaryGuidance,
      reviewState,
      promotionState,
    };
  }, [
    whatNext,
    workbench?.degraded?.message,
    workbench?.interpretationReview?.status,
    workbench?.pendingPromotion,
    workbench?.promotionTraces,
    workbench?.runState,
    workbench?.scoreReview?.status,
  ]);

  if (!assessmentId) return null;

  return (
    <section
      id="assessment-workbench-panel"
      className="rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-c-text-muted">
            Assessment Workbench
          </div>
          <div className="mt-1 text-sm text-c-text-secondary">
            {workbench
              ? `${workbench.runState} • ${workbench.assessmentDefinitionRef.methodologyId} v${workbench.assessmentDefinitionRef.version}`
              : 'Loading runtime'}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            className="rounded-lg border border-c-border px-3 py-1.5 text-sm hover:bg-c-surface-raised"
            onClick={() => void loadWorkbench()}
            disabled={isLoading || isBusy || !canEditUi}
          >
            Reload
          </button>
          <button
            type="button"
            className="rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] px-3 py-1.5 text-sm disabled:opacity-50"
            onClick={() =>
              void runAction(
                () => V8AssessmentApi.applyWorkbenchPreset(assessmentId, 'DRD'),
                'Preset applied'
              )
            }
            disabled={isLoading || isBusy || !canEditUi}
          >
            Apply DRD preset
          </button>
          <button
            type="button"
            className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            onClick={() =>
              void runAction(
                () => V8AssessmentApi.transitionWorkbench(assessmentId, { toState: 'running' }),
                'Workbench started'
              )
            }
            disabled={isLoading || isBusy || !canEditUi}
          >
            Start
          </button>
          <button
            type="button"
            className="rounded-lg bg-navy-900 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            onClick={() =>
              void runAction(
                () =>
                  V8AssessmentApi.transitionWorkbench(assessmentId, {
                    toState: 'completed',
                    reason:
                      workbench?.runState === 'score_reviewed'
                        ? 'Accepted for completion with missing interpretation.'
                        : undefined,
                  }),
                'Run completed'
              )
            }
            disabled={isLoading || isBusy || !canComplete || !canApproveUi}
          >
            Complete
          </button>
        </div>
      </div>

      {isLoading ? <div className="mt-4 text-sm text-c-text-muted">Loading workbench…</div> : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-c-text-muted">
            Current State
          </div>
          <div className="mt-1 text-sm font-medium text-c-text">
            {businessSummary.runStateLabel}
          </div>
          <div className="mt-2 text-sm text-c-text-secondary">
            {businessSummary.primaryGuidance}
          </div>
        </div>
        <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-c-text-muted">
            Review Readiness
          </div>
          <div className="mt-1 text-sm font-medium text-c-text">{businessSummary.reviewState}</div>
          <div className="mt-2 text-sm text-c-text-secondary">
            Review remains explicit. AI can help prepare proposals, but approval gates still live
            here.
          </div>
        </div>
        <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-c-text-muted">
            Downstream Status
          </div>
          <div className="mt-1 text-sm font-medium text-c-text">
            {businessSummary.promotionState}
          </div>
          <div className="mt-2 text-sm text-c-text-secondary">
            Reports and initiative packs should be created from this run so provenance stays intact.
          </div>
        </div>
      </div>

      {definition ? (
        <div className="mt-4 rounded-xl border border-c-border-subtle bg-c-surface-raised p-3 text-sm">
          <div className="font-medium text-c-text">{definition.title}</div>
          <div className="mt-1 text-c-text-secondary">
            Published definition `{definition.id}` is read-only and versioned.
          </div>
        </div>
      ) : null}

      {workbench?.degraded ? (
        <div className="mt-4 rounded-xl border border-amber-300/70 bg-amber-50/70 dark:bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          <div className="font-medium">{workbench.degraded.code}</div>
          <div>{workbench.degraded.message}</div>
        </div>
      ) : null}

      {workbench?.pendingPromotion ? (
        <div className="mt-4 rounded-xl border border-danger-300/70 bg-danger-50/70 dark:bg-danger-500/10 p-3 text-sm text-danger-900 dark:text-danger-200">
          Pending promotion retry for `{workbench.pendingPromotion.targetKind}`:{' '}
          {workbench.pendingPromotion.error}
        </div>
      ) : null}

      {inlineError ? (
        <div className="mt-4 rounded-xl border border-danger-300/70 bg-danger-50/70 dark:bg-danger-500/10 p-3 text-sm text-danger-900 dark:text-danger-200">
          <div className="font-medium">{inlineError}</div>
          {inlineErrorSteps.length ? (
            <ul className="mt-2 space-y-1">
              {inlineErrorSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {whatNext.length ? (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-c-text-muted">
            What Next
          </div>
          <ul className="mt-2 space-y-1 text-sm text-c-text-secondary">
            {whatNext.map((line) => (
              <li key={line} className="rounded-lg bg-c-surface-raised px-3 py-2">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-c-border-subtle p-4">
          <div className="font-medium text-c-text">Evidence</div>
          <div className="mt-3 space-y-2">
            {evidenceOptions.map((pointer) => (
              <label
                key={pointer.id}
                className="flex items-start gap-3 rounded-lg bg-c-surface-raised px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedEvidenceIds.includes(pointer.id)}
                  onChange={(event) =>
                    setSelectedEvidenceIds((prev) =>
                      event.target.checked
                        ? [...prev, pointer.id]
                        : prev.filter((id) => id !== pointer.id)
                    )
                  }
                />
                <span>
                  <span className="font-medium text-c-text">{pointer.kind}</span> {pointer.ref}
                  {pointer.label ? (
                    <span className="text-c-text-muted"> • {pointer.label}</span>
                  ) : null}
                </span>
              </label>
            ))}
            {!evidenceOptions.length ? (
              <div className="text-sm text-c-text-muted">No evidence pointers yet.</div>
            ) : null}
          </div>
          <div className="mt-4 grid gap-2">
            <select
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              value={evidenceKind}
              onChange={(event) => setEvidenceKind(event.target.value)}
            >
              <option value="document">document</option>
              <option value="interview_note">interview_note</option>
              <option value="survey_response">survey_response</option>
              <option value="artifact">artifact</option>
              <option value="external_url">external_url</option>
            </select>
            <input
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder="Evidence ref"
              value={evidenceRef}
              onChange={(event) => setEvidenceRef(event.target.value)}
            />
            <input
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder="Optional label"
              value={evidenceLabel}
              onChange={(event) => setEvidenceLabel(event.target.value)}
            />
            <button
              type="button"
              className="rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] px-3 py-2 text-sm disabled:opacity-50"
              disabled={isBusy || !evidenceRef.trim() || !canEditUi}
              onClick={() =>
                void runAction(
                  () =>
                    V8AssessmentApi.addWorkbenchEvidence(assessmentId, [
                      {
                        kind: evidenceKind,
                        ref: evidenceRef.trim(),
                        label: evidenceLabel.trim() || undefined,
                      },
                    ]),
                  'Evidence added'
                ).then(() => {
                  setEvidenceRef('');
                  setEvidenceLabel('');
                })
              }
            >
              Add evidence
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-c-border-subtle p-4">
          <div className="font-medium text-c-text">Score Proposal</div>
          <div className="mt-3 grid gap-2">
            <textarea
              className="min-h-20 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder="Scoring rationale"
              value={scoreRationale}
              onChange={(event) => setScoreRationale(event.target.value)}
            />
            <textarea
              className="min-h-16 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm font-mono"
              value={scoreValuesRaw}
              onChange={(event) => setScoreValuesRaw(event.target.value)}
            />
            <input
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              value={scoreConfidence}
              onChange={(event) => setScoreConfidence(event.target.value)}
              placeholder="Confidence 0-1"
            />
            <textarea
              className="min-h-16 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder="Assumptions, one per line"
              value={scoreAssumptions}
              onChange={(event) => setScoreAssumptions(event.target.value)}
            />
            <button
              type="button"
              className="rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] px-3 py-2 text-sm disabled:opacity-50"
              disabled={isBusy || !scoreRationale.trim() || !canEditUi}
              onClick={() =>
                void runAction(
                  () =>
                    V8AssessmentApi.proposeWorkbenchScore(assessmentId, {
                      scoreValues: parseJsonRecord(scoreValuesRaw, { readiness: 3 }),
                      scoringRationale: scoreRationale.trim(),
                      evidencePointerIds: selectedEvidenceIds,
                      assumptions: splitLines(scoreAssumptions),
                      confidence: Number(scoreConfidence || 0.7),
                    }),
                  'Score proposed'
                )
              }
            >
              Propose score
            </button>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="rounded-lg border border-emerald-300 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
                disabled={isBusy || !canApproveUi}
                onClick={() =>
                  void runAction(
                    () => V8AssessmentApi.reviewWorkbenchScore(assessmentId, { action: 'accept' }),
                    'Score accepted'
                  )
                }
              >
                Accept score
              </button>
              <button
                type="button"
                className="rounded-lg border border-amber-300 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
                disabled={isBusy || !canApproveUi}
                onClick={() =>
                  void runAction(
                    () => V8AssessmentApi.reviewWorkbenchScore(assessmentId, { action: 'reject' }),
                    'Score rejected'
                  )
                }
              >
                Reject score
              </button>
              <button
                type="button"
                className="rounded-lg border border-c-border px-3 py-2 text-sm text-c-text-secondary hover:bg-c-surface-raised"
                disabled={isBusy || !canApproveUi}
                onClick={() =>
                  void runAction(
                    () =>
                      V8AssessmentApi.reviewWorkbenchScore(assessmentId, {
                        action: 'override',
                        overrideScoreValues: parseJsonRecord(overrideScoreRaw, { readiness: 4 }),
                      }),
                    'Score overridden'
                  )
                }
              >
                Override score
              </button>
            </div>
            <textarea
              className="min-h-16 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm font-mono"
              value={overrideScoreRaw}
              onChange={(event) => setOverrideScoreRaw(event.target.value)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-c-border-subtle p-4">
          <div className="font-medium text-c-text">Interpretation Proposal</div>
          <div className="mt-3 grid gap-2">
            <textarea
              className="min-h-20 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder="Interpretation summary"
              value={interpretationSummary}
              onChange={(event) => setInterpretationSummary(event.target.value)}
            />
            <textarea
              className="min-h-16 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder="Key findings, one per line"
              value={interpretationFindings}
              onChange={(event) => setInterpretationFindings(event.target.value)}
            />
            <textarea
              className="min-h-16 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder="Limits"
              value={interpretationLimits}
              onChange={(event) => setInterpretationLimits(event.target.value)}
            />
            <textarea
              className="min-h-16 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder="Next actions, one per line"
              value={interpretationActions}
              onChange={(event) => setInterpretationActions(event.target.value)}
            />
            <button
              type="button"
              className="rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] px-3 py-2 text-sm disabled:opacity-50"
              disabled={isBusy || !interpretationLimits.trim() || !canEditUi}
              onClick={() =>
                void runAction(
                  () =>
                    V8AssessmentApi.proposeWorkbenchInterpretation(assessmentId, {
                      summary: interpretationSummary.trim(),
                      keyFindings: splitLines(interpretationFindings),
                      limits: interpretationLimits.trim(),
                      nextActions: splitLines(interpretationActions),
                    }),
                  'Interpretation proposed'
                )
              }
            >
              Propose interpretation
            </button>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="rounded-lg border border-emerald-300 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
                disabled={isBusy || !canApproveUi}
                onClick={() =>
                  void runAction(
                    () =>
                      V8AssessmentApi.reviewWorkbenchInterpretation(assessmentId, {
                        action: 'accept',
                      }),
                    'Interpretation accepted'
                  )
                }
              >
                Accept interpretation
              </button>
              <button
                type="button"
                className="rounded-lg border border-amber-300 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
                disabled={isBusy || !canApproveUi}
                onClick={() =>
                  void runAction(
                    () =>
                      V8AssessmentApi.reviewWorkbenchInterpretation(assessmentId, {
                        action: 'reject',
                      }),
                    'Interpretation rejected'
                  )
                }
              >
                Reject interpretation
              </button>
              <button
                type="button"
                className="rounded-lg border border-c-border px-3 py-2 text-sm text-c-text-secondary hover:bg-c-surface-raised"
                disabled={isBusy || !overrideSummary.trim() || !canApproveUi}
                onClick={() =>
                  void runAction(
                    () =>
                      V8AssessmentApi.reviewWorkbenchInterpretation(assessmentId, {
                        action: 'override',
                        overrideSummary: overrideSummary.trim(),
                      }),
                    'Interpretation overridden'
                  )
                }
              >
                Override interpretation
              </button>
            </div>
            <textarea
              className="min-h-16 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder="Override summary"
              value={overrideSummary}
              onChange={(event) => setOverrideSummary(event.target.value)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-c-border-subtle p-4">
          <div className="font-medium text-c-text">Promotion</div>
          <div className="mt-3 grid gap-2">
            <select
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              value={promotionTargetKind}
              onChange={(event) =>
                setPromotionTargetKind(
                  event.target.value as 'outputs_artifact' | 'interview_insight'
                )
              }
            >
              <option value="outputs_artifact">outputs_artifact</option>
              <option value="interview_insight">interview_insight</option>
            </select>
            <input
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder={
                promotionTargetKind === 'interview_insight'
                  ? 'Leave blank to auto-create draft insight proposal'
                  : 'Target ref'
              }
              value={promotionTargetRef}
              onChange={(event) => setPromotionTargetRef(event.target.value)}
            />
            {promotionValidation.length ? (
              <div className="rounded-lg bg-amber-50/80 dark:bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
                {promotionValidation.join(' ')}
              </div>
            ) : null}
            <button
              type="button"
              className="rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] px-3 py-2 text-sm disabled:opacity-50"
              disabled={
                isBusy ||
                !canApproveUi ||
                (promotionTargetKind === 'outputs_artifact' && !promotionTargetRef.trim())
              }
              onClick={() =>
                void runAction(
                  () =>
                    V8AssessmentApi.promoteWorkbench(assessmentId, {
                      targetKind: promotionTargetKind,
                      targetRef: promotionTargetRef.trim() || undefined,
                    }),
                  'Promotion recorded'
                )
              }
            >
              Promote
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AssessmentWorkbenchPanel;
