import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  V8AssessmentApi,
  type V8AssessmentDefinitionRecord,
  type V8AssessmentRunState,
  type V8AssessmentWorkbench,
} from '@/services/api/v8/assessment';
import {
  looksLikeApiInstructionText,
  looksLikeInternalIdentifierText,
} from '@/utils/detectInternalIdentifierText';

interface AssessmentWorkbenchPanelProps {
  assessmentId: string;
  permissions?: {
    canView: boolean;
    canEdit: boolean;
    canApprove: boolean;
  };
}

type ReviewStatus = 'pending' | 'accepted' | 'rejected' | 'overridden';
type EvidenceKind = 'document' | 'interview_note' | 'survey_response' | 'artifact' | 'external_url';
type PromotionTargetKind = 'outputs_artifact' | 'interview_insight';

// CB-06 / RV-016 — every raw enum value the backend returns or the UI lets
// the user pick must resolve to a canonical PL/EN display label; the stored
// value passed back to the API always stays the raw enum below.
const RUN_STATE_LABEL_KEY: Record<V8AssessmentRunState, string> = {
  draft: 'assessment.workbench.runState.draft',
  running: 'assessment.workbench.runState.running',
  awaiting_evidence: 'assessment.workbench.runState.awaitingEvidence',
  score_proposed: 'assessment.workbench.runState.scoreProposed',
  score_reviewed: 'assessment.workbench.runState.scoreReviewed',
  interpretation_proposed: 'assessment.workbench.runState.interpretationProposed',
  interpretation_reviewed: 'assessment.workbench.runState.interpretationReviewed',
  completed: 'assessment.workbench.runState.completed',
  failed: 'assessment.workbench.runState.failed',
};

const RUN_STATE_LABEL_FALLBACK: Record<V8AssessmentRunState, string> = {
  draft: 'Draft',
  running: 'Running',
  awaiting_evidence: 'Awaiting evidence',
  score_proposed: 'Score proposed',
  score_reviewed: 'Score reviewed',
  interpretation_proposed: 'Interpretation proposed',
  interpretation_reviewed: 'Interpretation reviewed',
  completed: 'Completed',
  failed: 'Failed',
};

const REVIEW_STATUS_LABEL_KEY: Record<ReviewStatus, string> = {
  pending: 'assessment.workbench.reviewStatus.pending',
  accepted: 'assessment.workbench.reviewStatus.accepted',
  rejected: 'assessment.workbench.reviewStatus.rejected',
  overridden: 'assessment.workbench.reviewStatus.overridden',
};

const REVIEW_STATUS_LABEL_FALLBACK: Record<ReviewStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  overridden: 'Overridden',
};

const EVIDENCE_KIND_LABEL_KEY: Record<EvidenceKind, string> = {
  document: 'assessment.workbench.evidenceKind.document',
  interview_note: 'assessment.workbench.evidenceKind.interviewNote',
  survey_response: 'assessment.workbench.evidenceKind.surveyResponse',
  artifact: 'assessment.workbench.evidenceKind.artifact',
  external_url: 'assessment.workbench.evidenceKind.externalUrl',
};

const EVIDENCE_KIND_LABEL_FALLBACK: Record<EvidenceKind, string> = {
  document: 'Document',
  interview_note: 'Interview note',
  survey_response: 'Survey response',
  artifact: 'Artifact',
  external_url: 'External link',
};

const PROMOTION_TARGET_LABEL_KEY: Record<PromotionTargetKind, string> = {
  outputs_artifact: 'assessment.workbench.promotionTarget.outputsArtifact',
  interview_insight: 'assessment.workbench.promotionTarget.interviewInsight',
};

const PROMOTION_TARGET_LABEL_FALLBACK: Record<PromotionTargetKind, string> = {
  outputs_artifact: 'Output artifact',
  interview_insight: 'Interview insight',
};

// CB-06 / RV-016 — score values are edited as normal UI rows (dimension name
// + numeric value), never as a raw JSON blob the user has to hand-type. The
// payload sent to the API is still a plain `Record<string, number>`; only
// the display/edit surface changed.
interface ScoreDimensionRow {
  id: string;
  key: string;
  value: string;
}

let scoreDimensionRowSeq = 0;
function nextScoreDimensionRowId(): string {
  scoreDimensionRowSeq += 1;
  return `dim-${scoreDimensionRowSeq}`;
}

function dimensionRowsToRecord(rows: ScoreDimensionRow[]): Record<string, number> {
  const record: Record<string, number> = {};
  rows.forEach((row) => {
    const key = row.key.trim();
    if (!key) return;
    const numeric = Number(row.value);
    record[key] = Number.isFinite(numeric) ? numeric : 0;
  });
  return record;
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export const AssessmentWorkbenchPanel: React.FC<AssessmentWorkbenchPanelProps> = ({
  assessmentId,
  permissions,
}) => {
  const { t } = useTranslation();

  const getErrorMessage = useCallback(
    (error: any): string =>
      error?.error ||
      error?.message ||
      t('assessment.workbench.requestFailed', 'Workbench request failed'),
    [t]
  );

  const runStateLabel = useCallback(
    (state: V8AssessmentRunState | string) => {
      const known = RUN_STATE_LABEL_KEY[state as V8AssessmentRunState];
      if (!known) return state;
      return t(known, RUN_STATE_LABEL_FALLBACK[state as V8AssessmentRunState]);
    },
    [t]
  );

  const reviewStatusLabel = useCallback(
    (status: ReviewStatus | string) => {
      const known = REVIEW_STATUS_LABEL_KEY[status as ReviewStatus];
      if (!known) return status;
      return t(known, REVIEW_STATUS_LABEL_FALLBACK[status as ReviewStatus]);
    },
    [t]
  );

  const evidenceKindLabel = useCallback(
    (kind: EvidenceKind | string) => {
      const known = EVIDENCE_KIND_LABEL_KEY[kind as EvidenceKind];
      if (!known) return kind;
      return t(known, EVIDENCE_KIND_LABEL_FALLBACK[kind as EvidenceKind]);
    },
    [t]
  );

  const [workbench, setWorkbench] = useState<V8AssessmentWorkbench | null>(null);
  const [definition, setDefinition] = useState<V8AssessmentDefinitionRecord | null>(null);
  const [whatNext, setWhatNext] = useState<string[]>([]);
  const [promotionValidation, setPromotionValidation] = useState<string[]>([]);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inlineErrorSteps, setInlineErrorSteps] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const [evidenceKind, setEvidenceKind] = useState<EvidenceKind>('document');
  const [evidenceRef, setEvidenceRef] = useState('');
  const [evidenceLabel, setEvidenceLabel] = useState('');

  const [scoreRationale, setScoreRationale] = useState('');
  const [scoreDimensions, setScoreDimensions] = useState<ScoreDimensionRow[]>([
    { id: nextScoreDimensionRowId(), key: 'readiness', value: '3' },
  ]);
  const [scoreConfidence, setScoreConfidence] = useState('0.7');
  const [scoreAssumptions, setScoreAssumptions] = useState('');
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [overrideDimensions, setOverrideDimensions] = useState<ScoreDimensionRow[]>([
    { id: nextScoreDimensionRowId(), key: 'readiness', value: '4' },
  ]);

  const updateDimensionRow = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<ScoreDimensionRow[]>>,
      id: string,
      patch: Partial<Pick<ScoreDimensionRow, 'key' | 'value'>>
    ) => {
      setter((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    },
    []
  );

  const addDimensionRow = useCallback(
    (setter: React.Dispatch<React.SetStateAction<ScoreDimensionRow[]>>) => {
      setter((rows) => [...rows, { id: nextScoreDimensionRowId(), key: '', value: '0' }]);
    },
    []
  );

  const removeDimensionRow = useCallback(
    (setter: React.Dispatch<React.SetStateAction<ScoreDimensionRow[]>>, id: string) => {
      setter((rows) => (rows.length > 1 ? rows.filter((row) => row.id !== id) : rows));
    },
    []
  );

  const [interpretationSummary, setInterpretationSummary] = useState('');
  const [interpretationFindings, setInterpretationFindings] = useState('');
  const [interpretationLimits, setInterpretationLimits] = useState('');
  const [interpretationActions, setInterpretationActions] = useState('');
  const [overrideSummary, setOverrideSummary] = useState('');

  const [promotionTargetKind, setPromotionTargetKind] =
    useState<PromotionTargetKind>('outputs_artifact');
  const [promotionTargetRef, setPromotionTargetRef] = useState('');
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
  }, [assessmentId, getErrorMessage]);

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
    [loadWorkbench, getErrorMessage]
  );

  const evidenceOptions = workbench?.evidencePointers || [];

  const canComplete = useMemo(() => {
    return (
      workbench?.runState === 'interpretation_reviewed' || workbench?.runState === 'score_reviewed'
    );
  }, [workbench?.runState]);

  const businessSummary = useMemo(() => {
    // CB-06 / RV-016: never surface a raw HTTP-call instruction as the
    // headline state guidance — fall through to the safe default instead.
    const firstSafeWhatNext = whatNext.find((line) => !looksLikeApiInstructionText(line));
    const primaryGuidance =
      workbench?.degraded?.message ||
      firstSafeWhatNext ||
      t(
        'assessment.workbench.defaultGuidance',
        'Move the run forward by attaching evidence, reviewing proposals, and promoting only approved outputs.'
      );

    const reviewState = workbench?.interpretationReview?.status
      ? t('assessment.workbench.interpretationStatus', 'Interpretation: {{status}}', {
          status: reviewStatusLabel(workbench.interpretationReview.status),
        })
      : workbench?.scoreReview?.status
        ? t('assessment.workbench.scoreStatus', 'Score: {{status}}', {
            status: reviewStatusLabel(workbench.scoreReview.status),
          })
        : t('assessment.workbench.reviewNotStarted', 'Review not started');

    const promotionState = workbench?.promotionTraces?.length
      ? t('assessment.workbench.downstreamHandoffs', '{{count}} downstream handoff(s) recorded', {
          count: workbench.promotionTraces.length,
        })
      : workbench?.pendingPromotion
        ? t('assessment.workbench.promotionRetryPending', 'Promotion retry pending')
        : t('assessment.workbench.noDownstreamHandoff', 'No downstream handoff yet');

    return {
      runStateLabel: runStateLabel(workbench?.runState || 'draft'),
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
    t,
    runStateLabel,
    reviewStatusLabel,
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
            {t('assessment.workbench.title', 'Assessment Workbench')}
          </div>
          <div className="mt-1 text-sm text-c-text-secondary">
            {workbench
              ? `${runStateLabel(workbench.runState)} • ${workbench.assessmentDefinitionRef.methodologyId} v${workbench.assessmentDefinitionRef.version}`
              : t('assessment.workbench.loadingRuntime', 'Loading runtime')}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            className="rounded-lg border border-c-border px-3 py-1.5 text-sm hover:bg-c-surface-raised"
            onClick={() => void loadWorkbench()}
            disabled={isLoading || isBusy || !canEditUi}
          >
            {t('assessment.workbench.reload', 'Reload')}
          </button>
          <button
            type="button"
            className="rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] px-3 py-1.5 text-sm disabled:opacity-50"
            onClick={() =>
              void runAction(
                () => V8AssessmentApi.applyWorkbenchPreset(assessmentId, 'DRD'),
                t('assessment.workbench.toast.presetApplied', 'Preset applied')
              )
            }
            disabled={isLoading || isBusy || !canEditUi}
          >
            {t('assessment.workbench.applyPreset', 'Apply DRD preset')}
          </button>
          <button
            type="button"
            className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            onClick={() =>
              void runAction(
                () => V8AssessmentApi.transitionWorkbench(assessmentId, { toState: 'running' }),
                t('assessment.workbench.toast.workbenchStarted', 'Workbench started')
              )
            }
            disabled={isLoading || isBusy || !canEditUi}
          >
            {t('assessment.workbench.start', 'Start')}
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
                        ? t(
                            'assessment.workbench.completedWithoutInterpretationReason',
                            'Accepted for completion with missing interpretation.'
                          )
                        : undefined,
                  }),
                t('assessment.workbench.toast.runCompleted', 'Run completed')
              )
            }
            disabled={isLoading || isBusy || !canComplete || !canApproveUi}
          >
            {t('assessment.workbench.complete', 'Complete')}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 text-sm text-c-text-muted">
          {t('assessment.workbench.loadingWorkbench', 'Loading workbench…')}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-c-text-muted">
            {t('assessment.workbench.currentState', 'Current State')}
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
            {t('assessment.workbench.reviewReadiness', 'Review Readiness')}
          </div>
          <div className="mt-1 text-sm font-medium text-c-text">{businessSummary.reviewState}</div>
          <div className="mt-2 text-sm text-c-text-secondary">
            {t(
              'assessment.workbench.reviewReadinessHint',
              'Review remains explicit. AI can help prepare proposals, but approval gates still live here.'
            )}
          </div>
        </div>
        <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-c-text-muted">
            {t('assessment.workbench.downstreamStatus', 'Downstream Status')}
          </div>
          <div className="mt-1 text-sm font-medium text-c-text">
            {businessSummary.promotionState}
          </div>
          <div className="mt-2 text-sm text-c-text-secondary">
            {t(
              'assessment.workbench.downstreamHint',
              'Reports and initiative packs should be created from this run so provenance stays intact.'
            )}
          </div>
        </div>
      </div>

      {definition ? (
        <div className="mt-4 rounded-xl border border-c-border-subtle bg-c-surface-raised p-3 text-sm">
          <div className="font-medium text-c-text">{definition.title}</div>
          <div className="mt-1 text-c-text-secondary">
            {t(
              'assessment.workbench.definitionReadOnly',
              'Published definition `{{id}}` is read-only and versioned.',
              { id: definition.id }
            )}
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
          {t(
            'assessment.workbench.pendingPromotionRetry',
            'Pending promotion retry for `{{targetKind}}`: {{error}}',
            {
              targetKind: workbench.pendingPromotion.targetKind,
              error: workbench.pendingPromotion.error,
            }
          )}
        </div>
      ) : null}

      {inlineError ? (
        <div className="mt-4 rounded-xl border border-danger-300/70 bg-danger-50/70 dark:bg-danger-500/10 p-3 text-sm text-danger-900 dark:text-danger-200">
          <div className="font-medium">{inlineError}</div>
          {(() => {
            const safeSteps = inlineErrorSteps.filter((step) => !looksLikeApiInstructionText(step));
            return safeSteps.length ? (
              <ul className="mt-2 space-y-1">
                {safeSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            ) : null;
          })()}
        </div>
      ) : null}

      {(() => {
        // CB-06 / RV-016: the backend's "what next" guidance can leak raw
        // HTTP-call instructions (e.g. "Call POST .../workbench/transition
        // with { toState: "running" }") instead of a human next step —
        // dropped here rather than shown verbatim; the real governed action
        // is the Start/Complete buttons above.
        const guidanceLines = whatNext.filter((line) => !looksLikeApiInstructionText(line));
        return guidanceLines.length ? (
          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-c-text-muted">
              {t('assessment.workbench.whatNext', 'What Next')}
            </div>
            <ul className="mt-2 space-y-1 text-sm text-c-text-secondary">
              {guidanceLines.map((line) => (
                <li key={line} className="rounded-lg bg-c-surface-raised px-3 py-2">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null;
      })()}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-c-border-subtle p-4">
          <div className="font-medium text-c-text">
            {t('assessment.workbench.evidence', 'Evidence')}
          </div>
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
                {(() => {
                  // CB-06 / RV-016: never show a raw internal identifier
                  // (UUID / snake_case system key) as the evidence pointer's
                  // display identity — fall back to a safe placeholder. The
                  // real `pointer.ref` still travels in the payload
                  // (checkbox selection → proposeWorkbenchScore).
                  const safeRef = looksLikeInternalIdentifierText(pointer.ref) ? null : pointer.ref;
                  const primaryIdentity =
                    pointer.label ||
                    safeRef ||
                    t('assessment.workbench.evidenceReferenceOnFile', 'Reference on file');
                  const showRefAsSecondary = pointer.label && safeRef;
                  return (
                    <span>
                      <span className="font-medium text-c-text">
                        {evidenceKindLabel(pointer.kind)}
                      </span>{' '}
                      {primaryIdentity}
                      {showRefAsSecondary ? (
                        <span className="text-c-text-muted"> • {safeRef}</span>
                      ) : null}
                    </span>
                  );
                })()}
              </label>
            ))}
            {!evidenceOptions.length ? (
              <div className="text-sm text-c-text-muted">
                {t('assessment.workbench.noEvidenceYet', 'No evidence pointers yet.')}
              </div>
            ) : null}
          </div>
          <div className="mt-4 grid gap-2">
            <select
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              value={evidenceKind}
              onChange={(event) => setEvidenceKind(event.target.value as EvidenceKind)}
              aria-label={t('assessment.workbench.evidenceKindLabel', 'Evidence type')}
            >
              {(
                [
                  'document',
                  'interview_note',
                  'survey_response',
                  'artifact',
                  'external_url',
                ] as const
              ).map((kind) => (
                <option key={kind} value={kind}>
                  {evidenceKindLabel(kind)}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder={t('assessment.workbench.evidenceRef', 'Evidence reference')}
              aria-label={t('assessment.workbench.evidenceRef', 'Evidence reference')}
              value={evidenceRef}
              onChange={(event) => setEvidenceRef(event.target.value)}
            />
            <input
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder={t('assessment.workbench.evidenceLabel', 'Optional label')}
              aria-label={t('assessment.workbench.evidenceLabel', 'Optional label')}
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
                  t('assessment.workbench.toast.evidenceAdded', 'Evidence added')
                ).then(() => {
                  setEvidenceRef('');
                  setEvidenceLabel('');
                })
              }
            >
              {t('assessment.workbench.addEvidence', 'Add evidence')}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-c-border-subtle p-4">
          <div className="font-medium text-c-text">
            {t('assessment.workbench.scoreProposal', 'Score Proposal')}
          </div>
          <div className="mt-3 grid gap-2">
            <textarea
              className="min-h-20 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder={t('assessment.workbench.scoringRationale', 'Scoring rationale')}
              aria-label={t('assessment.workbench.scoringRationale', 'Scoring rationale')}
              value={scoreRationale}
              onChange={(event) => setScoreRationale(event.target.value)}
            />
            <div
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] p-2 space-y-2"
              role="group"
              aria-label={t('assessment.workbench.scoreValues', 'Score values')}
            >
              {scoreDimensions.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-1.5 text-sm"
                    value={row.key}
                    onChange={(event) =>
                      updateDimensionRow(setScoreDimensions, row.id, { key: event.target.value })
                    }
                    placeholder={t('assessment.workbench.dimensionName', 'Dimension')}
                    aria-label={t('assessment.workbench.dimensionName', 'Dimension')}
                  />
                  <input
                    type="number"
                    className="w-20 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-1.5 text-sm"
                    value={row.value}
                    onChange={(event) =>
                      updateDimensionRow(setScoreDimensions, row.id, { value: event.target.value })
                    }
                    aria-label={t('assessment.workbench.dimensionValue', 'Value')}
                  />
                  <button
                    type="button"
                    className="text-xs text-c-text-muted hover:text-c-text-secondary disabled:opacity-40"
                    onClick={() => removeDimensionRow(setScoreDimensions, row.id)}
                    disabled={scoreDimensions.length <= 1}
                    aria-label={t('assessment.workbench.removeDimension', 'Remove dimension')}
                  >
                    {t('assessment.workbench.removeDimension', 'Remove dimension')}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-xs font-medium text-c-info hover:underline"
                onClick={() => addDimensionRow(setScoreDimensions)}
              >
                {t('assessment.workbench.addDimension', 'Add dimension')}
              </button>
            </div>
            <input
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              value={scoreConfidence}
              onChange={(event) => setScoreConfidence(event.target.value)}
              placeholder={t('assessment.workbench.scoreConfidence', 'Confidence 0-1')}
              aria-label={t('assessment.workbench.scoreConfidence', 'Confidence 0-1')}
            />
            <textarea
              className="min-h-16 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder={t('assessment.workbench.scoreAssumptions', 'Assumptions, one per line')}
              aria-label={t('assessment.workbench.scoreAssumptions', 'Assumptions, one per line')}
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
                      scoreValues: dimensionRowsToRecord(scoreDimensions),
                      scoringRationale: scoreRationale.trim(),
                      evidencePointerIds: selectedEvidenceIds,
                      assumptions: splitLines(scoreAssumptions),
                      confidence: Number(scoreConfidence || 0.7),
                    }),
                  t('assessment.workbench.toast.scoreProposed', 'Score proposed')
                )
              }
            >
              {t('assessment.workbench.proposeScore', 'Propose score')}
            </button>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="rounded-lg border border-emerald-300 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
                disabled={isBusy || !canApproveUi}
                onClick={() =>
                  void runAction(
                    () => V8AssessmentApi.reviewWorkbenchScore(assessmentId, { action: 'accept' }),
                    t('assessment.workbench.toast.scoreAccepted', 'Score accepted')
                  )
                }
              >
                {t('assessment.workbench.acceptScore', 'Accept score')}
              </button>
              <button
                type="button"
                className="rounded-lg border border-amber-300 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
                disabled={isBusy || !canApproveUi}
                onClick={() =>
                  void runAction(
                    () => V8AssessmentApi.reviewWorkbenchScore(assessmentId, { action: 'reject' }),
                    t('assessment.workbench.toast.scoreRejected', 'Score rejected')
                  )
                }
              >
                {t('assessment.workbench.rejectScore', 'Reject score')}
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
                        overrideScoreValues: dimensionRowsToRecord(overrideDimensions),
                      }),
                    t('assessment.workbench.toast.scoreOverridden', 'Score overridden')
                  )
                }
              >
                {t('assessment.workbench.overrideScore', 'Override score')}
              </button>
            </div>
            <div
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] p-2 space-y-2"
              role="group"
              aria-label={t('assessment.workbench.overrideScoreValues', 'Override score values')}
            >
              {overrideDimensions.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-1.5 text-sm"
                    value={row.key}
                    onChange={(event) =>
                      updateDimensionRow(setOverrideDimensions, row.id, { key: event.target.value })
                    }
                    placeholder={t('assessment.workbench.dimensionName', 'Dimension')}
                    aria-label={t('assessment.workbench.dimensionName', 'Dimension')}
                  />
                  <input
                    type="number"
                    className="w-20 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-1.5 text-sm"
                    value={row.value}
                    onChange={(event) =>
                      updateDimensionRow(setOverrideDimensions, row.id, {
                        value: event.target.value,
                      })
                    }
                    aria-label={t('assessment.workbench.dimensionValue', 'Value')}
                  />
                  <button
                    type="button"
                    className="text-xs text-c-text-muted hover:text-c-text-secondary disabled:opacity-40"
                    onClick={() => removeDimensionRow(setOverrideDimensions, row.id)}
                    disabled={overrideDimensions.length <= 1}
                    aria-label={t('assessment.workbench.removeDimension', 'Remove dimension')}
                  >
                    {t('assessment.workbench.removeDimension', 'Remove dimension')}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-xs font-medium text-c-info hover:underline"
                onClick={() => addDimensionRow(setOverrideDimensions)}
              >
                {t('assessment.workbench.addDimension', 'Add dimension')}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-c-border-subtle p-4">
          <div className="font-medium text-c-text">
            {t('assessment.workbench.interpretationProposal', 'Interpretation Proposal')}
          </div>
          <div className="mt-3 grid gap-2">
            <textarea
              className="min-h-20 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder={t(
                'assessment.workbench.interpretationSummary',
                'Interpretation summary'
              )}
              aria-label={t('assessment.workbench.interpretationSummary', 'Interpretation summary')}
              value={interpretationSummary}
              onChange={(event) => setInterpretationSummary(event.target.value)}
            />
            <textarea
              className="min-h-16 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder={t('assessment.workbench.keyFindings', 'Key findings, one per line')}
              aria-label={t('assessment.workbench.keyFindings', 'Key findings, one per line')}
              value={interpretationFindings}
              onChange={(event) => setInterpretationFindings(event.target.value)}
            />
            <textarea
              className="min-h-16 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder={t('assessment.workbench.limits', 'Limits')}
              aria-label={t('assessment.workbench.limits', 'Limits')}
              value={interpretationLimits}
              onChange={(event) => setInterpretationLimits(event.target.value)}
            />
            <textarea
              className="min-h-16 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder={t('assessment.workbench.nextActions', 'Next actions, one per line')}
              aria-label={t('assessment.workbench.nextActions', 'Next actions, one per line')}
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
                  t('assessment.workbench.toast.interpretationProposed', 'Interpretation proposed')
                )
              }
            >
              {t('assessment.workbench.proposeInterpretation', 'Propose interpretation')}
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
                    t(
                      'assessment.workbench.toast.interpretationAccepted',
                      'Interpretation accepted'
                    )
                  )
                }
              >
                {t('assessment.workbench.acceptInterpretation', 'Accept interpretation')}
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
                    t(
                      'assessment.workbench.toast.interpretationRejected',
                      'Interpretation rejected'
                    )
                  )
                }
              >
                {t('assessment.workbench.rejectInterpretation', 'Reject interpretation')}
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
                    t(
                      'assessment.workbench.toast.interpretationOverridden',
                      'Interpretation overridden'
                    )
                  )
                }
              >
                {t('assessment.workbench.overrideInterpretation', 'Override interpretation')}
              </button>
            </div>
            <textarea
              className="min-h-16 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder={t('assessment.workbench.overrideSummary', 'Override summary')}
              aria-label={t('assessment.workbench.overrideSummary', 'Override summary')}
              value={overrideSummary}
              onChange={(event) => setOverrideSummary(event.target.value)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-c-border-subtle p-4">
          <div className="font-medium text-c-text">
            {t('assessment.workbench.promotion', 'Promotion')}
          </div>
          <div className="mt-3 grid gap-2">
            <select
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              value={promotionTargetKind}
              onChange={(event) =>
                setPromotionTargetKind(event.target.value as PromotionTargetKind)
              }
              aria-label={t('assessment.workbench.promotionTargetKindLabel', 'Promotion target')}
            >
              {(['outputs_artifact', 'interview_insight'] as const).map((kind) => (
                <option key={kind} value={kind}>
                  {t(PROMOTION_TARGET_LABEL_KEY[kind], PROMOTION_TARGET_LABEL_FALLBACK[kind])}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid px-3 py-2 text-sm"
              placeholder={
                promotionTargetKind === 'interview_insight'
                  ? t(
                      'assessment.workbench.promotionAutoCreateHint',
                      'Leave blank to auto-create draft insight proposal'
                    )
                  : t('assessment.workbench.promotionTargetRef', 'Target reference')
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
                  t('assessment.workbench.toast.promotionRecorded', 'Promotion recorded')
                )
              }
            >
              {t('assessment.workbench.promote', 'Promote')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AssessmentWorkbenchPanel;
