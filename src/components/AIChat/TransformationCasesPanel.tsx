import { Ban, GitBranch, ListChecks, PlayCircle, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import {
  PreviewActionButton,
  PreviewDetailsSection,
  PreviewMetaCard,
} from '@/components/shared/PreviewPane';
import { EmptyState, LoadingState } from '@/components/shared/states';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import { MetaChip, StatusChip } from '@/components/ui/primitives/chips';
import {
  type BenefitsCheckpointDto,
  type CanonicalTransformationRunDto,
  type DrdAssessmentProposalDto,
  type ExecutionCheckpointDto,
  type FinalOutputPublicationProposalDto,
  type FinanceKpiPackProposalDto,
  type GovernedProposalProjectionDto,
  type GovernedStageProposalDto,
  type InitialIdeasProposalDto,
  type InterviewsProposalDto,
  type MobilizationBlueprintProposalDto,
  type OpportunitySynthesisProposalDto,
  type PortfolioDecisionProposalDto,
  type SustainabilityCheckpointDto,
  type TransformationCaseDto,
  TransformationCasesApi,
  type TransformationFinalOutputRunDto,
  type TransformationPlanStepDto,
} from '@/services/api/v8/transformation-cases';
import { useAppStore } from '@/store/useAppStore';
import { ProjectTeamCard } from './ProjectTeamCard';

type FinalOutputPublicationState = FinalOutputPublicationProposalDto & {
  governance: GovernedProposalProjectionDto;
};

type StageProposalWithId = GovernedStageProposalDto & { proposalId: string; status: string };

export function deriveMobilizationDates(now: Date = new Date()): {
  startDate: string;
  endDate: string;
} {
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(base);
  start.setUTCDate(start.getUTCDate() + 14);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 120);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

const GovernedProposalReview: React.FC<{
  proposal: StageProposalWithId | null;
  isLoading: boolean;
  isPolish: boolean;
  busy: boolean;
  onScopeDecision: (
    scopeKey: string,
    decision: 'approved' | 'rejected' | 'revision_requested'
  ) => void;
  onRevise: () => void;
  onRebaseline: () => void;
}> = ({ proposal, isLoading, isPolish, busy, onScopeDecision, onRevise, onRebaseline }) => {
  if (isLoading) {
    return (
      <section
        className="rounded-lg border border-c-border bg-c-surface p-3"
        aria-label={isPolish ? 'Governance propozycji' : 'Proposal governance'}
        aria-busy="true"
        role="status"
      >
        <p className="text-xs text-c-text-muted">
          {isPolish ? 'Wczytywanie governance propozycji…' : 'Loading proposal governance…'}
        </p>
      </section>
    );
  }
  if (!proposal) return null;

  const governance = proposal.governance;
  const unavailable = isPolish ? 'Dowód niedostępny' : 'Evidence unavailable';
  const mutationUnavailable = isPolish
    ? 'Akcja zablokowana: endpoint governance nie jest dostępny w kontrakcie klienta.'
    : 'Action blocked: the governance endpoint is not available in the client contract.';

  if (!governance) {
    return (
      <section
        className="rounded-lg border border-amber-300/50 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/5"
        aria-label={isPolish ? 'Governance propozycji' : 'Proposal governance'}
        data-testid="proposal-governance"
      >
        <h3 className="text-xs font-semibold text-c-text">
          {isPolish ? 'Governance propozycji' : 'Proposal governance'}
        </h3>
        <p className="mt-1 text-[11px] text-c-text-secondary" role="status">
          {isPolish
            ? 'Endpoint etapu nie zwrócił wersjonowanego before/after ani praw do zakresów. Częściowa akceptacja pozostaje zablokowana.'
            : 'The stage endpoint did not return versioned before/after or scope authority. Partial approval remains blocked.'}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            isPolish ? 'Zatwierdź zakres' : 'Approve scope',
            isPolish ? 'Poproś o korektę' : 'Request revision',
            isPolish ? 'Utwórz rewizję' : 'Create revision',
            isPolish ? 'Rebaseline' : 'Rebaseline',
          ].map((label) => (
            <button
              key={label}
              type="button"
              disabled
              title={mutationUnavailable}
              className="rounded-md border border-c-border px-2 py-1.5 text-[11px] font-semibold text-c-text-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    );
  }

  const blockedState =
    governance.accessState === 'denied' ||
    governance.accessState === 'error' ||
    governance.status === 'expired' ||
    governance.status === 'invalidated';
  const stateReason =
    governance.accessReason || governance.invalidationReason || governance.revisionReason || null;
  const scopeReviewable = ['pending_review', 'partially_approved'].includes(governance.status);
  const hasReviewerAuthority = governance.scopes.some((scope) => scope.authority.canReview);

  return (
    <section
      className="rounded-lg border border-c-border bg-c-surface p-3"
      aria-label={isPolish ? 'Governance propozycji' : 'Proposal governance'}
      aria-busy={busy}
      data-testid="proposal-governance"
    >
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {isPolish ? 'Stan governance propozycji' : 'Proposal governance state'}: v
        {governance.proposalVersion}, {governance.status}.
      </p>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-c-text">
          {isPolish ? 'Governance propozycji' : 'Proposal governance'} · v
          {governance.proposalVersion}
        </h3>
        <StatusChip
          label={governance.status}
          tone={governance.status === 'approved' ? 'success' : 'warning'}
          size="sm"
        />
      </div>
      {blockedState ? (
        <p className="mt-2 text-[11px] text-c-danger" role="alert">
          {governance.accessState === 'denied'
            ? isPolish
              ? 'Brak uprawnień do review.'
              : 'Review access denied.'
            : governance.accessState === 'error'
              ? isPolish
                ? 'Nie udało się potwierdzić governance.'
                : 'Governance could not be verified.'
              : governance.status === 'expired'
                ? isPolish
                  ? 'Propozycja wygasła.'
                  : 'Proposal expired.'
                : isPolish
                  ? 'Propozycja została unieważniona.'
                  : 'Proposal was invalidated.'}{' '}
          {stateReason ?? unavailable}
        </p>
      ) : null}
      <dl className="mt-2 grid gap-2 text-[11px] sm:grid-cols-2">
        <div className="min-w-0 rounded-md border border-c-border bg-c-card p-2">
          <dt className="font-semibold text-c-text">{isPolish ? 'Przed' : 'Before'}</dt>
          <dd className="mt-1 whitespace-pre-wrap break-all text-c-text-secondary">
            {JSON.stringify(governance.before, null, 2)}
          </dd>
        </div>
        <div className="min-w-0 rounded-md border border-c-border bg-c-card p-2">
          <dt className="font-semibold text-c-text">{isPolish ? 'Po' : 'After'}</dt>
          <dd className="mt-1 whitespace-pre-wrap break-all text-c-text-secondary">
            {JSON.stringify(governance.after, null, 2)}
          </dd>
        </div>
      </dl>
      <div className="mt-3 space-y-2">
        <p className="text-[11px] font-semibold text-c-text">
          {isPolish ? 'Zakresy i uprawnienia' : 'Scopes and authority'}
        </p>
        {governance.scopes.length ? (
          governance.scopes.map((scope) => (
            <div
              key={scope.scopeKey}
              data-testid={`proposal-governance-scope-${scope.scopeKey}`}
              className="flex min-w-0 flex-col gap-2 rounded-md border border-c-border bg-c-card p-2 text-[11px] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 break-words">
                <p className="font-semibold text-c-text">{scope.label || scope.scopeKey}</p>
                <p className="text-c-text-muted">
                  {scope.authority.canReview
                    ? `${isPolish ? 'Uprawniony' : 'Authorized'}${scope.authority.reviewerRole ? `: ${scope.authority.reviewerRole}` : ''}`
                    : `${isPolish ? 'Brak uprawnienia' : 'Not authorized'}: ${scope.authority.deniedReason || unavailable}`}
                  {' · '}
                  {scope.decision}
                </p>
              </div>
              <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
                <button
                  type="button"
                  disabled={busy || !scopeReviewable || !scope.authority.canReview}
                  title={
                    scope.authority.canReview
                      ? undefined
                      : scope.authority.deniedReason ||
                        (isPolish ? 'Brak uprawnienia do zakresu.' : 'No authority for this scope.')
                  }
                  aria-label={`${isPolish ? 'Zatwierdź zakres' : 'Approve scope'} ${scope.label || scope.scopeKey}`}
                  className="rounded-md border border-c-border px-2 py-1 font-semibold text-c-text-muted disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onScopeDecision(scope.scopeKey, 'approved')}
                >
                  {isPolish ? 'Zatwierdź zakres' : 'Approve scope'}
                </button>
                <button
                  type="button"
                  disabled={busy || !scopeReviewable || !scope.authority.canReview}
                  aria-label={`${isPolish ? 'Odrzuć zakres' : 'Reject scope'} ${scope.label || scope.scopeKey}`}
                  className="rounded-md border border-c-border px-2 py-1 font-semibold text-c-text-muted disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onScopeDecision(scope.scopeKey, 'rejected')}
                >
                  {isPolish ? 'Odrzuć' : 'Reject'}
                </button>
                <button
                  type="button"
                  disabled={busy || !scopeReviewable || !scope.authority.canReview}
                  aria-label={`${isPolish ? 'Poproś o korektę zakresu' : 'Request scope revision'} ${scope.label || scope.scopeKey}`}
                  className="rounded-md border border-c-border px-2 py-1 font-semibold text-c-text-muted disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onScopeDecision(scope.scopeKey, 'revision_requested')}
                >
                  {isPolish ? 'Korekta' : 'Revision'}
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-[11px] text-c-text-muted">{unavailable}</p>
        )}
      </div>
      <p className="mt-2 text-[11px] text-c-text-muted">
        {isPolish ? 'Ważna do' : 'Expires at'}: {governance.expiresAt}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy || governance.status !== 'revision_requested' || !hasReviewerAuthority}
          onClick={onRevise}
          className="rounded-md border border-c-border px-2 py-1.5 text-[11px] font-semibold text-c-text-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPolish ? 'Utwórz rewizję' : 'Create revision'}
        </button>
        <button
          type="button"
          disabled={
            busy || !['invalidated', 'expired'].includes(governance.status) || !hasReviewerAuthority
          }
          onClick={onRebaseline}
          className="rounded-md border border-c-border px-2 py-1.5 text-[11px] font-semibold text-c-text-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          Rebaseline
        </button>
      </div>
    </section>
  );
};

interface TransformationCaseRow extends TableRow {
  id: string;
  title: string;
  transformationCase: TransformationCaseDto;
}

function capabilityTone(status: TransformationPlanStepDto['capabilityStatus']) {
  if (status === 'REAL') return 'success' as const;
  if (status === 'PARTIAL' || status === 'PROPOSAL_ONLY') return 'warning' as const;
  return 'neutral' as const;
}

export const TransformationQualityTrustSection: React.FC<{
  transformationCase: TransformationCaseDto;
  isPolish: boolean;
}> = ({ transformationCase, isPolish }) => {
  const quality = transformationCase.qualityEvaluation;
  const hasVerifiedState = quality?.status === 'passed' || quality?.status === 'failed';
  const hasConfidence = typeof quality?.score === 'number' && Number.isFinite(quality.score);
  const failedDimensions = Array.from(
    new Set(
      (quality?.cases ?? [])
        .filter((qualityCase) => qualityCase.passed === false && qualityCase.dimension)
        .map((qualityCase) => qualityCase.dimension as string)
    )
  );
  const limitations = [
    ...transformationCase.missingInputs.map((item) =>
      isPolish ? `Brakujące dane: ${item}` : `Missing input: ${item}`
    ),
    ...transformationCase.assumptions.map((item) =>
      isPolish ? `Założenie: ${item}` : `Assumption: ${item}`
    ),
  ];
  const unavailable = isPolish ? 'Dowód niedostępny' : 'Evidence unavailable';
  const verifiedLabel =
    quality?.status === 'passed'
      ? isPolish
        ? 'Zweryfikowano'
        : 'Verified'
      : quality?.status === 'failed'
        ? isPolish
          ? 'Nie zweryfikowano'
          : 'Not verified'
        : unavailable;

  return (
    <section
      className="rounded-lg border border-c-border bg-c-surface p-3"
      aria-labelledby={`quality-trust-${transformationCase.transformationCaseId}`}
      data-testid="transformation-quality-trust"
    >
      <h3
        id={`quality-trust-${transformationCase.transformationCaseId}`}
        className="text-xs font-semibold text-c-text"
      >
        {isPolish ? 'Jakość i wiarygodność' : 'Quality and trust'}
      </h3>
      <dl className="mt-2 grid gap-2 text-[11px] sm:grid-cols-2">
        <div>
          <dt className="text-c-text-muted">
            {isPolish ? 'Stan weryfikacji' : 'Verification state'}
          </dt>
          <dd className="font-medium text-c-text" role="status">
            {verifiedLabel}
          </dd>
        </div>
        <div>
          <dt className="text-c-text-muted">{isPolish ? 'Pewność' : 'Confidence'}</dt>
          <dd className="font-medium text-c-text">
            {hasConfidence ? `${Math.round((quality?.score as number) * 100)}%` : unavailable}
          </dd>
        </div>
        <div>
          <dt className="text-c-text-muted">{isPolish ? 'Ograniczenia' : 'Limitations'}</dt>
          <dd className="font-medium text-c-text">
            {limitations.length > 0 ? limitations.join(' · ') : unavailable}
          </dd>
        </div>
        <div>
          <dt className="text-c-text-muted">
            {isPolish ? 'Niespełnione wymiary jakości' : 'Failed quality dimensions'}
          </dt>
          <dd className="font-medium text-c-text">
            {quality
              ? failedDimensions.length > 0
                ? failedDimensions.join(', ')
                : hasVerifiedState
                  ? isPolish
                    ? 'Brak'
                    : 'None'
                  : unavailable
              : unavailable}
          </dd>
        </div>
      </dl>
      {(quality?.criticalFailures?.length ?? 0) > 0 ? (
        <p className="mt-2 text-[11px] text-c-danger" role="alert">
          {isPolish ? 'Krytyczne niezgodności' : 'Critical failures'}:{' '}
          {quality?.criticalFailures?.join(', ')}
        </p>
      ) : null}
    </section>
  );
};

export const TransformationCasesPanel: React.FC<{
  onCanonicalContextChange?: (context: {
    transformationCaseId: string;
    canonicalRunId?: string;
  }) => void;
  onOpenOperations?: (context: { transformationCaseId: string; canonicalRunId: string }) => void;
}> = ({ onCanonicalContextChange, onOpenOperations }) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const [searchParams] = useSearchParams();
  const currentUserId = useAppStore((state) => state.currentUser?.id ?? null);
  const linkedCaseId = searchParams.get('transformationCaseId');
  const [cases, setCases] = useState<TransformationCaseDto[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(linkedCaseId);
  const [error, setError] = useState<string | null>(null);
  const [canonicalRuntime, setCanonicalRuntime] = useState<
    CanonicalTransformationRunDto | null | undefined
  >(undefined);
  const [reconcilingRuntime, setReconcilingRuntime] = useState(false);
  const [editableSteps, setEditableSteps] = useState<TransformationPlanStepDto[] | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [ideasProposal, setIdeasProposal] = useState<InitialIdeasProposalDto | null | undefined>(
    undefined
  );
  const [stageAction, setStageAction] = useState<string | null>(null);
  const [interviewsProposal, setInterviewsProposal] = useState<
    InterviewsProposalDto | null | undefined
  >(undefined);
  const [financeProposal, setFinanceProposal] = useState<
    FinanceKpiPackProposalDto | null | undefined
  >(undefined);
  const [financeInputs, setFinanceInputs] = useState({
    capex: '800000',
    opexAnnual: '120000',
    benefitAnnual: '900000',
    horizonYears: '3',
    waccPct: '12',
    kpiName: 'Approval lead time',
    kpiUnit: 'days',
    baselineValue: '8',
    targetValue: '3',
  });
  const [portfolioProposal, setPortfolioProposal] = useState<
    PortfolioDecisionProposalDto | null | undefined
  >(undefined);
  const [decisionMakerId, setDecisionMakerId] = useState('');
  const [mobilizationProposal, setMobilizationProposal] = useState<
    MobilizationBlueprintProposalDto | null | undefined
  >(undefined);
  const [mobilizationInputs, setMobilizationInputs] = useState(() => ({
    ownerUserId: '',
    ...deriveMobilizationDates(),
  }));
  const [executionCheckpoint, setExecutionCheckpoint] = useState<
    ExecutionCheckpointDto | null | undefined
  >(undefined);
  const [benefitsCheckpoint, setBenefitsCheckpoint] = useState<
    BenefitsCheckpointDto | null | undefined
  >(undefined);
  const [effectiveness, setEffectiveness] = useState<'confirmed' | 'partial' | 'not_achieved'>(
    'confirmed'
  );
  const [sustainabilityCheckpoint, setSustainabilityCheckpoint] = useState<
    SustainabilityCheckpointDto | null | undefined
  >(undefined);
  const [finalOutputRun, setFinalOutputRun] = useState<
    TransformationFinalOutputRunDto | null | undefined
  >(undefined);
  const [finalOutputPublication, setFinalOutputPublication] =
    useState<FinalOutputPublicationState | null>(null);
  const [stakeholderUserId, setStakeholderUserId] = useState('');
  const [stakeholderRole, setStakeholderRole] = useState('');
  const [stakeholderFocus, setStakeholderFocus] = useState('');
  const [acceptedInsightIds, setAcceptedInsightIds] = useState('');
  const [drdProposal, setDrdProposal] = useState<DrdAssessmentProposalDto | null | undefined>(
    undefined
  );
  const [drdName, setDrdName] = useState('');
  const [synthesisProposal, setSynthesisProposal] = useState<
    OpportunitySynthesisProposalDto | null | undefined
  >(undefined);

  const loadCases = useCallback(async () => {
    setError(null);
    try {
      const list = await TransformationCasesApi.list({ limit: 100 });
      const withQuality = await Promise.all(
        list.map(async (item) => {
          try {
            return {
              ...item,
              qualityEvaluation: await TransformationCasesApi.getQualityEvaluation(
                item.transformationCaseId
              ),
            };
          } catch {
            return { ...item, qualityEvaluation: null };
          }
        })
      );
      if (linkedCaseId && !withQuality.some((item) => item.transformationCaseId === linkedCaseId)) {
        try {
          const linked = await TransformationCasesApi.get(linkedCaseId);
          let qualityEvaluation = null;
          try {
            qualityEvaluation = await TransformationCasesApi.getQualityEvaluation(linkedCaseId);
          } catch {
            // Keep canonical Case visible while the quality endpoint remains fail-closed.
          }
          setCases([{ ...linked, qualityEvaluation }, ...withQuality]);
          setSelectedId(linkedCaseId);
          return;
        } catch {
          // The list remains useful; inaccessible deep links retain 404 semantics.
        }
      }
      setCases(withQuality);
      if (linkedCaseId && withQuality.some((item) => item.transformationCaseId === linkedCaseId)) {
        setSelectedId(linkedCaseId);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load transformations');
    }
  }, [linkedCaseId]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const rows = useMemo<TransformationCaseRow[]>(
    () =>
      (cases ?? []).map((transformationCase) => ({
        id: transformationCase.transformationCaseId,
        title: transformationCase.mandate,
        transformationCase,
      })),
    [cases]
  );
  const selectedRow = rows.find((row) => row.id === selectedId) ?? null;
  const finalPublicationProposal: StageProposalWithId | null = finalOutputPublication
    ? {
        proposalId: finalOutputPublication.publicationMappingId,
        status: finalOutputPublication.governance.status,
        governance: finalOutputPublication.governance,
      }
    : null;
  const proposalStates = [
    ideasProposal,
    interviewsProposal,
    drdProposal,
    synthesisProposal,
    financeProposal,
    portfolioProposal,
    mobilizationProposal,
  ];
  const resolvedStageProposals = proposalStates.filter((proposal) => proposal != null);
  const activeStageProposal =
    (selectedRow?.transformationCase.lifecycleStage === 'final_outputs'
      ? finalPublicationProposal
      : null) ??
    resolvedStageProposals.find((proposal) => proposal.status === 'pending_review') ??
    resolvedStageProposals.at(-1) ??
    null;
  const proposalsLoading =
    Boolean(selectedId) && proposalStates.some((proposal) => proposal === undefined);
  const finalPublicationExecutable = Boolean(
    finalOutputPublication &&
    finalOutputPublication.caseVersion === selectedRow?.transformationCase.version &&
    finalOutputPublication.governance.status === 'approved' &&
    finalOutputPublication.governance.after.factsDigest === finalOutputPublication.factsDigest &&
    new Date(finalOutputPublication.governance.expiresAt).getTime() > Date.now()
  );
  const finalPublicationStateReason = !finalOutputPublication
    ? isPolish
      ? 'Najpierw przygotuj publikację i zatwierdź dokładny digest faktów.'
      : 'Prepare the publication and approve the exact facts digest first.'
    : finalOutputPublication.caseVersion !== selectedRow?.transformationCase.version
      ? isPolish
        ? 'Publikacja jest zablokowana: wersja Case uległa zmianie.'
        : 'Publication is blocked: the Case version changed.'
      : finalOutputPublication.governance.after.factsDigest !== finalOutputPublication.factsDigest
        ? isPolish
          ? 'Publikacja jest zablokowana: digest zatwierdzonej zmiany nie jest zgodny.'
          : 'Publication is blocked: the approved change digest does not match.'
        : new Date(finalOutputPublication.governance.expiresAt).getTime() <= Date.now()
          ? isPolish
            ? 'Publikacja jest zablokowana: zgoda wygasła.'
            : 'Publication is blocked: the approval expired.'
          : finalOutputPublication.governance.status !== 'approved'
            ? isPolish
              ? `Publikacja jest zablokowana: stan zgody ${finalOutputPublication.governance.status}.`
              : `Publication is blocked: approval state ${finalOutputPublication.governance.status}.`
            : isPolish
              ? 'Publikacja odblokowana dla dokładnego zatwierdzonego digestu.'
              : 'Publication unlocked for the exact approved digest.';

  useEffect(() => {
    setEditableSteps(
      selectedRow?.transformationCase.status === 'plan_proposed'
        ? (selectedRow.transformationCase.activePlan?.steps ?? []).map((step) => ({ ...step }))
        : null
    );
  }, [selectedRow?.id, selectedRow?.transformationCase.activePlan?.planId]);

  useEffect(() => {
    if (!selectedId) {
      setCanonicalRuntime(undefined);
      setIdeasProposal(undefined);
      setInterviewsProposal(undefined);
      setDrdProposal(undefined);
      setSynthesisProposal(undefined);
      setFinanceProposal(undefined);
      setPortfolioProposal(undefined);
      setMobilizationProposal(undefined);
      setExecutionCheckpoint(undefined);
      setBenefitsCheckpoint(undefined);
      setSustainabilityCheckpoint(undefined);
      setFinalOutputRun(undefined);
      setFinalOutputPublication(null);
      return;
    }
    let disposed = false;
    setFinalOutputPublication(null);
    setCanonicalRuntime(undefined);
    TransformationCasesApi.getCanonicalRuntime(selectedId)
      .then((runtime) => {
        if (!disposed) {
          setCanonicalRuntime(runtime);
          onCanonicalContextChange?.({
            transformationCaseId: selectedId,
            canonicalRunId: runtime.canonicalRunId,
          });
        }
      })
      .catch(() => {
        if (!disposed) setCanonicalRuntime(null);
      });
    setIdeasProposal(undefined);
    TransformationCasesApi.getInitialIdeasProposal(selectedId)
      .then((proposal) => {
        if (!disposed) setIdeasProposal(proposal);
      })
      .catch(() => {
        if (!disposed) setIdeasProposal(null);
      });
    setInterviewsProposal(undefined);
    TransformationCasesApi.getInterviewsProposal(selectedId)
      .then((proposal) => {
        if (!disposed) setInterviewsProposal(proposal);
      })
      .catch(() => {
        if (!disposed) setInterviewsProposal(null);
      });
    setDrdProposal(undefined);
    TransformationCasesApi.getDrdAssessmentProposal(selectedId)
      .then((proposal) => {
        if (!disposed) setDrdProposal(proposal);
      })
      .catch(() => {
        if (!disposed) setDrdProposal(null);
      });
    setSynthesisProposal(undefined);
    TransformationCasesApi.getOpportunitySynthesisProposal(selectedId)
      .then((proposal) => {
        if (!disposed) setSynthesisProposal(proposal);
      })
      .catch(() => {
        if (!disposed) setSynthesisProposal(null);
      });
    setFinanceProposal(undefined);
    TransformationCasesApi.getFinanceKpiPackProposal(selectedId)
      .then((proposal) => {
        if (!disposed) setFinanceProposal(proposal);
      })
      .catch(() => {
        if (!disposed) setFinanceProposal(null);
      });
    setPortfolioProposal(undefined);
    TransformationCasesApi.getPortfolioDecisionProposal(selectedId)
      .then((proposal) => {
        if (!disposed) setPortfolioProposal(proposal);
      })
      .catch(() => {
        if (!disposed) setPortfolioProposal(null);
      });
    setMobilizationProposal(undefined);
    TransformationCasesApi.getMobilizationBlueprintProposal(selectedId)
      .then((proposal) => {
        if (!disposed) setMobilizationProposal(proposal);
      })
      .catch(() => {
        if (!disposed) setMobilizationProposal(null);
      });
    setExecutionCheckpoint(undefined);
    TransformationCasesApi.getExecutionCheckpoint(selectedId)
      .then((checkpoint) => {
        if (!disposed) setExecutionCheckpoint(checkpoint);
      })
      .catch(() => {
        if (!disposed) setExecutionCheckpoint(null);
      });
    setBenefitsCheckpoint(undefined);
    TransformationCasesApi.getBenefitsCheckpoint(selectedId)
      .then((checkpoint) => {
        if (!disposed) setBenefitsCheckpoint(checkpoint);
      })
      .catch(() => {
        if (!disposed) setBenefitsCheckpoint(null);
      });
    setSustainabilityCheckpoint(undefined);
    TransformationCasesApi.getSustainabilityCheckpoint(selectedId)
      .then((checkpoint) => {
        if (!disposed) setSustainabilityCheckpoint(checkpoint);
      })
      .catch(() => {
        if (!disposed) setSustainabilityCheckpoint(null);
      });
    setFinalOutputRun(undefined);
    TransformationCasesApi.getLatestFinalOutputs(selectedId)
      .then((run) => {
        if (!disposed) setFinalOutputRun(run);
      })
      .catch(() => {
        if (!disposed) setFinalOutputRun(null);
      });
    return () => {
      disposed = true;
    };
  }, [onCanonicalContextChange, selectedId]);

  const selectCase = useCallback(
    (transformationCaseId: string | null) => {
      setSelectedId(transformationCaseId);
      if (transformationCaseId) {
        onCanonicalContextChange?.({ transformationCaseId, canonicalRunId: undefined });
      }
    },
    [onCanonicalContextChange]
  );

  const reconcileRuntime = useCallback(async () => {
    if (!selectedId || !canonicalRuntime?.stateDrift) return;
    setReconcilingRuntime(true);
    setError(null);
    try {
      setCanonicalRuntime(
        await TransformationCasesApi.reconcileCanonicalRuntime(
          selectedId,
          'Operator confirmed transformation lifecycle projection in Agent Hub'
        )
      );
    } catch (runtimeError) {
      setError(
        runtimeError instanceof Error ? runtimeError.message : 'Runtime reconciliation failed'
      );
    } finally {
      setReconcilingRuntime(false);
    }
  }, [canonicalRuntime?.stateDrift, selectedId]);

  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'title',
        label: isPolish ? 'Mandat transformacji' : 'Transformation mandate',
        render: (raw) => {
          const row = raw as TransformationCaseRow;
          return (
            <span className="text-sm font-semibold text-c-text line-clamp-2">{row.title}</span>
          );
        },
      },
      {
        id: 'status',
        label: isPolish ? 'Status' : 'Status',
        width: '150px',
        render: (raw) => {
          const item = (raw as TransformationCaseRow).transformationCase;
          return (
            <StatusChip
              label={
                item.status === 'cancelled'
                  ? isPolish
                    ? 'Anulowany'
                    : 'Cancelled'
                  : isPolish
                    ? 'Do przeglądu'
                    : 'Review required'
              }
              tone={item.status === 'cancelled' ? 'neutral' : 'warning'}
            />
          );
        },
      },
      {
        id: 'version',
        label: isPolish ? 'Wersja' : 'Version',
        width: '110px',
        render: (raw) => (
          <MetaChip
            icon={GitBranch}
            label={`v${(raw as TransformationCaseRow).transformationCase.version}`}
          />
        ),
      },
      {
        id: 'steps',
        label: isPolish ? 'Etapy' : 'Stages',
        width: '110px',
        render: (raw) => (
          <MetaChip
            icon={ListChecks}
            label={String(
              (raw as TransformationCaseRow).transformationCase.activePlan?.steps.length ?? 0
            )}
          />
        ),
      },
    ],
    [isPolish]
  );

  const handleCancel = useCallback(async () => {
    if (!selectedRow || selectedRow.transformationCase.status === 'cancelled') return;
    const confirmed = window.confirm(
      isPolish
        ? 'Anulować ten plan transformacji? Żaden etap downstream nie zostanie uruchomiony.'
        : 'Cancel this transformation plan? No downstream stage will be started.'
    );
    if (!confirmed) return;
    setCancelling(true);
    try {
      const updated = await TransformationCasesApi.cancel(
        selectedRow.id,
        selectedRow.transformationCase.version,
        isPolish ? 'Anulowanie przez użytkownika w Agent Hub' : 'Cancelled by user in Agent Hub'
      );
      setCases(
        (current) =>
          current?.map((item) =>
            item.transformationCaseId === updated.transformationCaseId ? updated : item
          ) ?? current
      );
    } catch (cancelError) {
      setError(
        cancelError instanceof Error ? cancelError.message : 'Failed to cancel transformation'
      );
    } finally {
      setCancelling(false);
    }
  }, [isPolish, selectedRow]);

  const replaceCase = useCallback((updated: TransformationCaseDto) => {
    setCases(
      (current) =>
        current?.map((item) =>
          item.transformationCaseId === updated.transformationCaseId ? updated : item
        ) ?? current
    );
  }, []);

  const updateProposalGovernance = useCallback(
    (proposalId: string, governance: GovernedProposalProjectionDto) => {
      const update = <T extends StageProposalWithId>(current: T | null | undefined) =>
        current?.proposalId === proposalId ? ({ ...current, governance } as T) : current;
      setIdeasProposal((current) => update(current));
      setInterviewsProposal((current) => update(current));
      setDrdProposal((current) => update(current));
      setSynthesisProposal((current) => update(current));
      setFinanceProposal((current) => update(current));
      setPortfolioProposal((current) => update(current));
      setMobilizationProposal((current) => update(current));
      setFinalOutputPublication((current) =>
        current?.publicationMappingId === proposalId ? { ...current, governance } : current
      );
    },
    []
  );

  const refreshGovernance = useCallback(
    async (
      proposal: StageProposalWithId,
      proposalVersionId = proposal.governance?.proposalVersionId
    ) => {
      if (!proposalVersionId) return;
      const raw = await TransformationCasesApi.getGovernedProposal(proposalVersionId);
      const previousScopes = proposal.governance?.scopes ?? [];
      const scopes = raw.scopes?.length
        ? raw.scopes
        : (raw.approvalScopes ?? previousScopes.map((scope) => scope.scopeKey)).map((scopeKey) => {
            const previous = previousScopes.find((scope) => scope.scopeKey === scopeKey);
            const review = raw.reviews?.find((item) => item.scopeKey === scopeKey);
            return {
              scopeKey,
              label: previous?.label,
              decision:
                review?.decision === 'revision_requested'
                  ? ('pending' as const)
                  : (review?.decision ?? previous?.decision ?? ('pending' as const)),
              authority: previous?.authority ?? {
                canReview: Boolean(
                  currentUserId && raw.reviewerAuthorityByScope?.[scopeKey]?.includes(currentUserId)
                ),
                deniedReason:
                  currentUserId && raw.reviewerAuthorityByScope?.[scopeKey]?.includes(currentUserId)
                    ? null
                    : isPolish
                      ? 'Bieżący użytkownik nie jest przypisanym recenzentem zakresu.'
                      : 'The current user is not an assigned reviewer for this scope.',
              },
            };
          });
      updateProposalGovernance(proposal.proposalId, {
        ...proposal.governance,
        ...raw,
        scopes,
      });
    },
    [currentUserId, isPolish, updateProposalGovernance]
  );

  const governanceErrorText = useCallback(
    (actionError: unknown) => {
      const status = (actionError as { status?: number })?.status;
      if (status === 403)
        return isPolish
          ? 'Brak uprawnienia do decyzji w tym zakresie.'
          : 'You are not authorized to decide this scope.';
      if (status === 409)
        return isPolish
          ? 'Propozycja zmieniła stan. Odświeżono governance; sprawdź aktualną wersję.'
          : 'The proposal state changed. Governance was refreshed; review the current version.';
      if (status === 410)
        return isPolish
          ? 'Propozycja wygasła i nie może zostać zatwierdzona.'
          : 'The proposal expired and cannot be approved.';
      return actionError instanceof Error
        ? actionError.message
        : isPolish
          ? 'Operacja governance nie powiodła się.'
          : 'Governance operation failed.';
    },
    [isPolish]
  );

  const handleScopeGovernanceDecision = useCallback(
    async (scopeKey: string, decision: 'approved' | 'rejected' | 'revision_requested') => {
      const proposal = activeStageProposal;
      const governance = proposal?.governance;
      const scope = governance?.scopes.find((item) => item.scopeKey === scopeKey);
      if (
        !proposal ||
        !governance ||
        !scope?.authority.canReview ||
        !['pending_review', 'partially_approved'].includes(governance.status)
      )
        return;
      const reason = window.prompt(
        isPolish ? 'Podaj uzasadnienie decyzji zakresowej' : 'Enter the scope decision reason'
      );
      if (!reason?.trim()) return;
      setStageAction(`governance-${decision}-${scopeKey}`);
      setError(null);
      try {
        if (decision === 'approved') {
          await TransformationCasesApi.reviewGovernedProposalScope(
            governance.proposalVersionId,
            scopeKey,
            { decision, reason: reason.trim() }
          );
        } else if (decision === 'rejected') {
          await TransformationCasesApi.rejectGovernedProposalScope(
            governance.proposalVersionId,
            scopeKey,
            reason.trim()
          );
        } else {
          await TransformationCasesApi.requestGovernedProposalRevision(
            governance.proposalVersionId,
            scopeKey,
            reason.trim()
          );
        }
        await refreshGovernance(proposal);
        replaceCase(await TransformationCasesApi.get(selectedRow!.id));
      } catch (actionError) {
        try {
          await refreshGovernance(proposal);
        } catch {
          // Preserve the original HTTP governance error.
        }
        setError(governanceErrorText(actionError));
      } finally {
        setStageAction(null);
      }
    },
    [
      activeStageProposal,
      governanceErrorText,
      isPolish,
      refreshGovernance,
      replaceCase,
      selectedRow,
    ]
  );

  const handleReviseGovernedProposal = useCallback(async () => {
    const proposal = activeStageProposal;
    const governance = proposal?.governance;
    if (
      !proposal ||
      !governance ||
      governance.status !== 'revision_requested' ||
      !governance.scopes.some((scope) => scope.authority.canReview)
    )
      return;
    const afterRaw = window.prompt(
      isPolish ? 'Poprawiona wartość „po” (JSON)' : 'Revised “after” value (JSON)',
      JSON.stringify(governance.after, null, 2)
    );
    const expiresAt = window.prompt(
      isPolish ? 'Nowy termin ważności (ISO)' : 'New expiry (ISO)',
      governance.expiresAt
    );
    const reason = window.prompt(isPolish ? 'Powód rewizji' : 'Revision reason');
    if (!afterRaw || !expiresAt?.trim() || !reason?.trim()) return;
    let after: Record<string, unknown>;
    try {
      after = JSON.parse(afterRaw) as Record<string, unknown>;
      if (!after || Array.isArray(after) || typeof after !== 'object') throw new Error();
    } catch {
      setError(
        isPolish ? 'Wartość „po” musi być obiektem JSON.' : '“After” must be a JSON object.'
      );
      return;
    }
    setStageAction('governance-revise');
    setError(null);
    try {
      const created = await TransformationCasesApi.reviseGovernedProposal(
        governance.proposalVersionId,
        { after, expiresAt: expiresAt.trim(), reason: reason.trim() }
      );
      await refreshGovernance(proposal, created.proposalVersionId);
      replaceCase(await TransformationCasesApi.get(selectedRow!.id));
    } catch (actionError) {
      setError(governanceErrorText(actionError));
    } finally {
      setStageAction(null);
    }
  }, [
    activeStageProposal,
    governanceErrorText,
    isPolish,
    refreshGovernance,
    replaceCase,
    selectedRow,
  ]);

  const handleRebaselineGovernedProposal = useCallback(async () => {
    const proposal = activeStageProposal;
    const governance = proposal?.governance;
    if (
      !proposal ||
      !governance ||
      !['invalidated', 'expired'].includes(governance.status) ||
      !governance.scopes.some((scope) => scope.authority.canReview)
    )
      return;
    const planVersion = Number(
      window.prompt(
        isPolish ? 'Nowa wersja planu' : 'New plan version',
        String(selectedRow?.transformationCase.activePlan?.version ?? '')
      )
    );
    const contextDigest = window.prompt(
      isPolish ? 'Nowy digest kontekstu' : 'New context digest',
      governance.contextDigest ?? ''
    );
    const expiresAt = window.prompt(
      isPolish ? 'Nowy termin ważności (ISO)' : 'New expiry (ISO)',
      governance.expiresAt
    );
    const reason = window.prompt(isPolish ? 'Powód rebaseline' : 'Rebaseline reason');
    if (
      !Number.isInteger(planVersion) ||
      planVersion < 1 ||
      !contextDigest?.trim() ||
      !expiresAt?.trim() ||
      !reason?.trim()
    )
      return;
    setStageAction('governance-rebaseline');
    setError(null);
    try {
      const created = await TransformationCasesApi.rebaselineGovernedProposal(
        governance.proposalVersionId,
        {
          planVersion,
          contextDigest: contextDigest.trim(),
          expiresAt: expiresAt.trim(),
          reason: reason.trim(),
        }
      );
      await refreshGovernance(proposal, created.proposalVersionId);
      replaceCase(await TransformationCasesApi.get(selectedRow!.id));
    } catch (actionError) {
      setError(governanceErrorText(actionError));
    } finally {
      setStageAction(null);
    }
  }, [
    activeStageProposal,
    governanceErrorText,
    isPolish,
    refreshGovernance,
    replaceCase,
    selectedRow,
  ]);

  const handleApprovePlan = useCallback(async () => {
    if (!selectedRow || selectedRow.transformationCase.status !== 'plan_proposed') return;
    const confirmed = window.confirm(
      isPolish
        ? 'Zatwierdzić plan? Każda mutacja biznesowa nadal będzie wymagała osobnej akceptacji.'
        : 'Approve the plan? Every business mutation will still require separate approval.'
    );
    if (!confirmed) return;
    setStageAction('approve-plan');
    setError(null);
    try {
      const updated = await TransformationCasesApi.approvePlan(
        selectedRow.id,
        selectedRow.transformationCase.version,
        isPolish ? 'Plan zaakceptowany w Agent Hub' : 'Plan approved in Agent Hub'
      );
      replaceCase(updated);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to approve plan');
    } finally {
      setStageAction(null);
    }
  }, [isPolish, replaceCase, selectedRow]);

  const movePlanStep = useCallback((index: number, direction: -1 | 1) => {
    setEditableSteps((current) => {
      if (!current) return current;
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((step, stepIndex) => ({ ...step, stepIndex }));
    });
  }, []);

  const updatePlanDependencies = useCallback((index: number, raw: string) => {
    setEditableSteps(
      (current) =>
        current?.map((step, stepIndex) =>
          stepIndex === index
            ? {
                ...step,
                dependsOn: raw
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
              }
            : step
        ) ?? current
    );
  }, []);

  const updatePlanStep = useCallback(
    <K extends keyof TransformationPlanStepDto>(
      index: number,
      field: K,
      value: TransformationPlanStepDto[K]
    ) => {
      setEditableSteps(
        (current) =>
          current?.map((step, stepIndex) =>
            stepIndex === index ? { ...step, [field]: value } : step
          ) ?? current
      );
    },
    []
  );

  const addPlanStep = useCallback(() => {
    const suffix = crypto.randomUUID().replaceAll('-', '_');
    setEditableSteps((current) => {
      if (!current) return current;
      return [
        ...current,
        {
          stepId: `draft-${suffix}`,
          stepIndex: current.length,
          lifecycleStage: `custom_${suffix}`,
          businessPurpose: isPolish ? 'Nowy krok planu' : 'New plan step',
          moduleTarget: 'Agent',
          capabilityStatus: 'PROPOSAL_ONLY',
          inputs: [],
          outputs: [],
          ownerRole: isPolish ? 'Do przypisania' : 'To be assigned',
          dependsOn: [],
          approvalClass: 'requires_human_approval',
          riskClass: 'safe_additive',
          executionMode: 'foreground',
          estimatedEffort: 'TBD',
          blockerReason: 'No verified runtime capability binding.',
        },
      ];
    });
  }, [isPolish]);

  const removePlanStep = useCallback(
    (index: number) => {
      setEditableSteps((current) => {
        if (!current) return current;
        const removed = current[index];
        const dependents = current
          .filter((step) => step.dependsOn.includes(removed.lifecycleStage))
          .map((step) => step.lifecycleStage);
        if (dependents.length > 0) {
          setError(
            `${isPolish ? 'Najpierw usuń zależność w etapach' : 'Remove the dependency first from'}: ${dependents.join(', ')}`
          );
          return current;
        }
        setError(null);
        return current
          .filter((_step, stepIndex) => stepIndex !== index)
          .map((step, stepIndex) => ({ ...step, stepIndex }));
      });
    },
    [isPolish]
  );

  const savePlanWorkshop = useCallback(async () => {
    if (!selectedRow || !editableSteps) return;
    setStageAction('save-plan-workshop');
    setError(null);
    try {
      const steps = editableSteps.map(({ stepId, stepIndex: _stepIndex, ...step }) => ({
        ...step,
        ...(stepId.startsWith('draft-') ? {} : { sourceStepId: stepId }),
      }));
      replaceCase(
        await TransformationCasesApi.revise(selectedRow.id, {
          expectedVersion: selectedRow.transformationCase.version,
          steps,
        })
      );
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to save plan workshop');
    } finally {
      setStageAction(null);
    }
  }, [editableSteps, replaceCase, selectedRow]);

  const handleProposeIdeas = useCallback(async () => {
    if (!selectedRow || selectedRow.transformationCase.status !== 'plan_approved') return;
    setStageAction('propose-ideas');
    setError(null);
    try {
      const proposal = await TransformationCasesApi.proposeInitialIdeas(
        selectedRow.id,
        selectedRow.transformationCase.version,
        5
      );
      setIdeasProposal(proposal);
      replaceCase(await TransformationCasesApi.get(selectedRow.id));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to propose Ideas');
    } finally {
      setStageAction(null);
    }
  }, [replaceCase, selectedRow]);

  const handleReviewIdeas = useCallback(
    async (decision: 'approve' | 'reject') => {
      if (
        !selectedRow ||
        !ideasProposal ||
        !['pending_review', 'approved'].includes(ideasProposal.status)
      )
        return;
      const confirmed =
        ideasProposal.status === 'approved' ||
        window.confirm(
          decision === 'approve'
            ? isPolish
              ? `Zatwierdzić i utworzyć ${ideasProposal.candidates.length} idei w My Ideas?`
              : `Approve and create ${ideasProposal.candidates.length} items in My Ideas?`
            : isPolish
              ? 'Odrzucić tę propozycję idei?'
              : 'Reject this Ideas proposal?'
        );
      if (!confirmed) return;
      setStageAction(`review-${decision}`);
      setError(null);
      try {
        const reviewed = await TransformationCasesApi.reviewInitialIdeasProposal(
          selectedRow.id,
          ideasProposal.proposalId,
          {
            expectedVersion: selectedRow.transformationCase.version,
            decision,
            reason:
              decision === 'approve'
                ? isPolish
                  ? 'Hipotezy zatwierdzone do dalszej weryfikacji'
                  : 'Hypotheses approved for further validation'
                : isPolish
                  ? 'Propozycja wymaga ponownego opracowania'
                  : 'Proposal requires revision',
          }
        );
        setIdeasProposal(reviewed);
        replaceCase(await TransformationCasesApi.get(selectedRow.id));
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : 'Failed to review Ideas');
      } finally {
        setStageAction(null);
      }
    },
    [ideasProposal, isPolish, replaceCase, selectedRow]
  );

  const handleProposeInterviews = useCallback(async () => {
    if (!selectedRow || !stakeholderUserId.trim() || !stakeholderRole.trim()) return;
    const focus = stakeholderFocus
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (!focus.length) return;
    setStageAction('propose-interviews');
    setError(null);
    try {
      const proposal = await TransformationCasesApi.proposeInterviews(selectedRow.id, {
        expectedVersion: selectedRow.transformationCase.version,
        stakeholders: [
          {
            assigneeUserId: stakeholderUserId.trim(),
            role: stakeholderRole.trim(),
            focus,
          },
        ],
      });
      setInterviewsProposal(proposal);
      replaceCase(await TransformationCasesApi.get(selectedRow.id));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to propose Interviews');
    } finally {
      setStageAction(null);
    }
  }, [replaceCase, selectedRow, stakeholderFocus, stakeholderRole, stakeholderUserId]);

  const handleReviewInterviews = useCallback(
    async (decision: 'approve' | 'reject') => {
      if (
        !selectedRow ||
        !interviewsProposal ||
        !['pending_review', 'approved'].includes(interviewsProposal.status)
      )
        return;
      const confirmed =
        interviewsProposal.status === 'approved' ||
        window.confirm(
          decision === 'approve'
            ? isPolish
              ? `Zatwierdzić i utworzyć ${interviewsProposal.candidates.length} zadań Interview?`
              : `Approve and create ${interviewsProposal.candidates.length} Interview assignments?`
            : isPolish
              ? 'Odrzucić plan rozmów?'
              : 'Reject the Interview plan?'
        );
      if (!confirmed) return;
      setStageAction(`review-interviews-${decision}`);
      setError(null);
      try {
        const reviewed = await TransformationCasesApi.reviewInterviewsProposal(
          selectedRow.id,
          interviewsProposal.proposalId,
          {
            expectedVersion: selectedRow.transformationCase.version,
            decision,
            reason:
              decision === 'approve'
                ? isPolish
                  ? 'Plan rozmów i lista interesariuszy zatwierdzone'
                  : 'Interview plan and stakeholders approved'
                : isPolish
                  ? 'Plan rozmów wymaga korekty'
                  : 'Interview plan requires revision',
          }
        );
        setInterviewsProposal(reviewed);
        replaceCase(await TransformationCasesApi.get(selectedRow.id));
      } catch (actionError) {
        setError(
          actionError instanceof Error ? actionError.message : 'Failed to review Interviews'
        );
      } finally {
        setStageAction(null);
      }
    },
    [interviewsProposal, isPolish, replaceCase, selectedRow]
  );

  const handleAcceptInterviewResults = useCallback(async () => {
    if (!selectedRow) return;
    const insightIds = acceptedInsightIds
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (!insightIds.length) return;
    const confirmed = window.confirm(
      isPolish
        ? 'Zaakceptować komplet odpowiedzi i insightów oraz otworzyć etap DRD?'
        : 'Accept all answers and insights and open the DRD stage?'
    );
    if (!confirmed) return;
    setStageAction('accept-interview-results');
    setError(null);
    try {
      await TransformationCasesApi.acceptInterviewResults(selectedRow.id, {
        expectedVersion: selectedRow.transformationCase.version,
        insightIds,
        decisionReason: isPolish
          ? 'Odpowiedzi i insighty zweryfikowane w Agent Hub'
          : 'Answers and insights verified in Agent Hub',
      });
      replaceCase(await TransformationCasesApi.get(selectedRow.id));
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Failed to accept Interview results'
      );
    } finally {
      setStageAction(null);
    }
  }, [acceptedInsightIds, isPolish, replaceCase, selectedRow]);

  const handleProposeDrd = useCallback(async () => {
    if (!selectedRow || !drdName.trim()) return;
    setStageAction('propose-drd');
    setError(null);
    try {
      const proposal = await TransformationCasesApi.proposeDrdAssessment(selectedRow.id, {
        expectedVersion: selectedRow.transformationCase.version,
        name: drdName.trim(),
      });
      setDrdProposal(proposal);
      replaceCase(await TransformationCasesApi.get(selectedRow.id));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to propose DRD');
    } finally {
      setStageAction(null);
    }
  }, [drdName, replaceCase, selectedRow]);

  const handleReviewDrd = useCallback(
    async (decision: 'approve' | 'reject') => {
      if (
        !selectedRow ||
        !drdProposal ||
        !['pending_review', 'approved'].includes(drdProposal.status)
      )
        return;
      const confirmed =
        drdProposal.status === 'approved' ||
        window.confirm(
          decision === 'approve'
            ? isPolish
              ? 'Zatwierdzić zakres i utworzyć assessment DRD?'
              : 'Approve the scope and create the DRD assessment?'
            : isPolish
              ? 'Odrzucić propozycję DRD?'
              : 'Reject the DRD proposal?'
        );
      if (!confirmed) return;
      setStageAction(`review-drd-${decision}`);
      setError(null);
      try {
        const reviewed = await TransformationCasesApi.reviewDrdAssessmentProposal(
          selectedRow.id,
          drdProposal.proposalId,
          {
            expectedVersion: selectedRow.transformationCase.version,
            decision,
            reason:
              decision === 'approve'
                ? isPolish
                  ? 'Zakres DRD i źródła Interview zatwierdzone'
                  : 'DRD scope and Interview sources approved'
                : isPolish
                  ? 'Zakres DRD wymaga korekty'
                  : 'DRD scope requires revision',
          }
        );
        setDrdProposal(reviewed);
        replaceCase(await TransformationCasesApi.get(selectedRow.id));
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : 'Failed to review DRD');
      } finally {
        setStageAction(null);
      }
    },
    [drdProposal, isPolish, replaceCase, selectedRow]
  );

  const handleAcceptDrdResults = useCallback(async () => {
    if (!selectedRow || !drdProposal?.assessmentId) return;
    const confirmed = window.confirm(
      isPolish
        ? 'Przyjąć aktualny immutable snapshot DRD i otworzyć syntezę szans?'
        : 'Accept the current immutable DRD snapshot and open opportunity synthesis?'
    );
    if (!confirmed) return;
    setStageAction('accept-drd-results');
    setError(null);
    try {
      await TransformationCasesApi.acceptDrdResults(selectedRow.id, {
        expectedVersion: selectedRow.transformationCase.version,
        decisionReason: isPolish
          ? 'Zaakceptowany wynik DRD zweryfikowany w Agent Hub'
          : 'Accepted DRD output verified in Agent Hub',
      });
      replaceCase(await TransformationCasesApi.get(selectedRow.id));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to accept DRD results');
    } finally {
      setStageAction(null);
    }
  }, [drdProposal?.assessmentId, isPolish, replaceCase, selectedRow]);

  const handleProposeSynthesis = useCallback(async () => {
    if (!selectedRow) return;
    setStageAction('propose-synthesis');
    setError(null);
    try {
      const proposal = await TransformationCasesApi.proposeOpportunitySynthesis(
        selectedRow.id,
        selectedRow.transformationCase.version
      );
      setSynthesisProposal(proposal);
      replaceCase(await TransformationCasesApi.get(selectedRow.id));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to propose synthesis');
    } finally {
      setStageAction(null);
    }
  }, [replaceCase, selectedRow]);

  const handleReviewSynthesis = useCallback(
    async (decision: 'approve' | 'reject') => {
      if (
        !selectedRow ||
        !synthesisProposal ||
        !['pending_review', 'approved'].includes(synthesisProposal.status)
      )
        return;
      const confirmed =
        synthesisProposal.status === 'approved' ||
        window.confirm(
          decision === 'approve'
            ? isPolish
              ? 'Zatwierdzić syntezę i utworzyć kanonicznego kandydata inicjatywy?'
              : 'Approve synthesis and create the canonical Initiative Candidate?'
            : isPolish
              ? 'Odrzucić syntezę szans?'
              : 'Reject opportunity synthesis?'
        );
      if (!confirmed) return;
      setStageAction(`review-synthesis-${decision}`);
      setError(null);
      try {
        const reviewed = await TransformationCasesApi.reviewOpportunitySynthesis(
          selectedRow.id,
          synthesisProposal.proposalId,
          {
            expectedVersion: selectedRow.transformationCase.version,
            decision,
            reason:
              decision === 'approve'
                ? 'Cross-source synthesis approved in Agent Hub'
                : 'Synthesis requires revision',
          }
        );
        setSynthesisProposal(reviewed);
        replaceCase(await TransformationCasesApi.get(selectedRow.id));
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : 'Failed to review synthesis');
      } finally {
        setStageAction(null);
      }
    },
    [isPolish, replaceCase, selectedRow, synthesisProposal]
  );

  const handleAcceptInitiativeResults = useCallback(async () => {
    if (!selectedRow) return;
    setStageAction('accept-initiative-results');
    setError(null);
    try {
      await TransformationCasesApi.acceptInitiativeResults(selectedRow.id, {
        expectedVersion: selectedRow.transformationCase.version,
        decisionReason: isPolish
          ? 'Zaakceptowany Candidate i trwała Initiative zweryfikowane w Agent Hub'
          : 'Accepted Candidate and durable Initiative verified in Agent Hub',
      });
      replaceCase(await TransformationCasesApi.get(selectedRow.id));
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Failed to accept Initiative results'
      );
    } finally {
      setStageAction(null);
    }
  }, [isPolish, replaceCase, selectedRow]);

  const handleProposeFinance = useCallback(async () => {
    if (!selectedRow) return;
    setStageAction('propose-finance-kpi');
    setError(null);
    try {
      const proposal = await TransformationCasesApi.proposeFinanceKpiPack(selectedRow.id, {
        expectedVersion: selectedRow.transformationCase.version,
        capex: Number(financeInputs.capex),
        opexAnnual: Number(financeInputs.opexAnnual),
        benefitAnnual: Number(financeInputs.benefitAnnual),
        horizonYears: Number(financeInputs.horizonYears),
        waccPct: Number(financeInputs.waccPct),
        currency: 'PLN',
        kpi: {
          name: financeInputs.kpiName,
          unit: financeInputs.kpiUnit,
          baselineValue: Number(financeInputs.baselineValue),
          targetValue: Number(financeInputs.targetValue),
          measurementFrequency: 'MONTHLY',
          direction:
            Number(financeInputs.targetValue) < Number(financeInputs.baselineValue)
              ? 'LOWER_IS_BETTER'
              : 'HIGHER_IS_BETTER',
        },
      });
      setFinanceProposal(proposal);
      replaceCase(await TransformationCasesApi.get(selectedRow.id));
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Failed to propose Finance/KPI pack'
      );
    } finally {
      setStageAction(null);
    }
  }, [financeInputs, replaceCase, selectedRow]);

  const handleReviewFinance = useCallback(
    async (decision: 'approve' | 'reject') => {
      if (
        !selectedRow ||
        !financeProposal ||
        !['pending_review', 'approved'].includes(financeProposal.status)
      )
        return;
      if (
        financeProposal.status !== 'approved' &&
        !window.confirm(
          decision === 'approve'
            ? isPolish
              ? 'Zatwierdzić i utworzyć analizę finansową oraz KPI?'
              : 'Approve and create Financial Analysis and KPI?'
            : isPolish
              ? 'Odrzucić pakiet Finance/KPI?'
              : 'Reject Finance/KPI pack?'
        )
      )
        return;
      setStageAction(`review-finance-${decision}`);
      setError(null);
      try {
        const reviewed = await TransformationCasesApi.reviewFinanceKpiPack(
          selectedRow.id,
          financeProposal.proposalId,
          {
            expectedVersion: selectedRow.transformationCase.version,
            decision,
            reason:
              decision === 'approve'
                ? 'Economics and KPI definition approved in Agent Hub'
                : 'Finance/KPI pack requires revision',
          }
        );
        setFinanceProposal(reviewed);
        replaceCase(await TransformationCasesApi.get(selectedRow.id));
      } catch (actionError) {
        setError(
          actionError instanceof Error ? actionError.message : 'Failed to review Finance/KPI pack'
        );
      } finally {
        setStageAction(null);
      }
    },
    [financeProposal, isPolish, replaceCase, selectedRow]
  );

  const handleAcceptFinance = useCallback(async () => {
    if (!selectedRow) return;
    setStageAction('accept-finance-kpi');
    setError(null);
    try {
      await TransformationCasesApi.acceptFinanceKpiResults(selectedRow.id, {
        expectedVersion: selectedRow.transformationCase.version,
        decisionReason: 'Approved Financial Analysis and versioned KPI reviewed in Agent Hub',
      });
      replaceCase(await TransformationCasesApi.get(selectedRow.id));
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Failed to accept Finance/KPI results'
      );
    } finally {
      setStageAction(null);
    }
  }, [replaceCase, selectedRow]);

  const handleProposePortfolio = useCallback(async () => {
    if (!selectedRow || !decisionMakerId.trim()) return;
    setStageAction('propose-portfolio');
    setError(null);
    try {
      const proposal = await TransformationCasesApi.proposePortfolioDecision(selectedRow.id, {
        expectedVersion: selectedRow.transformationCase.version,
        decisionMakerId: decisionMakerId.trim(),
        supportingEvidence: [
          {
            ref: `transformation-case:${selectedRow.id}:finance-kpi`,
            snapshot: {
              lifecycleStage: selectedRow.transformationCase.lifecycleStage,
              caseVersion: selectedRow.transformationCase.version,
            },
          },
        ],
        contradictingEvidence: [
          {
            ref: `transformation-case:${selectedRow.id}:decision-risk`,
            snapshot: {
              assumptions: selectedRow.transformationCase.assumptions,
              missingInputs: selectedRow.transformationCase.missingInputs,
            },
          },
        ],
      });
      setPortfolioProposal(proposal);
      replaceCase(await TransformationCasesApi.get(selectedRow.id));
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Failed to propose portfolio decision'
      );
    } finally {
      setStageAction(null);
    }
  }, [decisionMakerId, replaceCase, selectedRow]);

  const handleReviewPortfolio = useCallback(
    async (decision: 'approve' | 'reject') => {
      if (
        !selectedRow ||
        !portfolioProposal ||
        !['pending_review', 'approved'].includes(portfolioProposal.status)
      )
        return;
      if (
        portfolioProposal.status !== 'approved' &&
        !window.confirm(
          decision === 'approve'
            ? isPolish
              ? 'Utworzyć formalną decyzję GO/NO-GO?'
              : 'Create the formal GO/NO-GO decision?'
            : isPolish
              ? 'Odrzucić pakiet decyzyjny?'
              : 'Reject the decision packet?'
        )
      )
        return;
      setStageAction(`review-portfolio-${decision}`);
      setError(null);
      try {
        const reviewed = await TransformationCasesApi.reviewPortfolioDecision(
          selectedRow.id,
          portfolioProposal.proposalId,
          {
            expectedVersion: selectedRow.transformationCase.version,
            decision,
            reason:
              decision === 'approve'
                ? 'Board-ready decision packet approved'
                : 'Decision packet requires revision',
          }
        );
        setPortfolioProposal(reviewed);
        replaceCase(await TransformationCasesApi.get(selectedRow.id));
      } catch (actionError) {
        setError(
          actionError instanceof Error ? actionError.message : 'Failed to review portfolio decision'
        );
      } finally {
        setStageAction(null);
      }
    },
    [isPolish, portfolioProposal, replaceCase, selectedRow]
  );

  const handleAcceptPortfolio = useCallback(async () => {
    if (!selectedRow) return;
    setStageAction('accept-portfolio');
    setError(null);
    try {
      await TransformationCasesApi.acceptPortfolioDecisionResults(selectedRow.id, {
        expectedVersion: selectedRow.transformationCase.version,
        decisionReason: 'Approved GO and canonical Initiative status reviewed in Agent Hub',
      });
      replaceCase(await TransformationCasesApi.get(selectedRow.id));
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Failed to accept portfolio result'
      );
    } finally {
      setStageAction(null);
    }
  }, [replaceCase, selectedRow]);

  const handleProposeMobilization = useCallback(async () => {
    if (!selectedRow || !mobilizationInputs.ownerUserId.trim()) return;
    setStageAction('propose-mobilization');
    setError(null);
    try {
      const proposal = await TransformationCasesApi.proposeMobilizationBlueprint(selectedRow.id, {
        expectedVersion: selectedRow.transformationCase.version,
        ...mobilizationInputs,
        ownerUserId: mobilizationInputs.ownerUserId.trim(),
      });
      setMobilizationProposal(proposal);
      replaceCase(await TransformationCasesApi.get(selectedRow.id));
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Failed to propose mobilization'
      );
    } finally {
      setStageAction(null);
    }
  }, [mobilizationInputs, replaceCase, selectedRow]);
  const handleReviewMobilization = useCallback(
    async (decision: 'approve' | 'reject') => {
      if (
        !selectedRow ||
        !mobilizationProposal ||
        !['pending_review', 'approved'].includes(mobilizationProposal.status)
      )
        return;
      if (
        mobilizationProposal.status !== 'approved' &&
        !window.confirm(
          decision === 'approve'
            ? isPolish
              ? 'Utworzyć WBS, milestones, zależności i zasoby?'
              : 'Create WBS, milestones, dependencies and resources?'
            : isPolish
              ? 'Odrzucić blueprint mobilizacji?'
              : 'Reject mobilization blueprint?'
        )
      )
        return;
      setStageAction(`review-mobilization-${decision}`);
      setError(null);
      try {
        const reviewed = await TransformationCasesApi.reviewMobilizationBlueprint(
          selectedRow.id,
          mobilizationProposal.proposalId,
          {
            expectedVersion: selectedRow.transformationCase.version,
            decision,
            reason:
              decision === 'approve'
                ? 'Execution blueprint approved in Agent Hub'
                : 'Mobilization blueprint requires revision',
          }
        );
        setMobilizationProposal(reviewed);
        replaceCase(await TransformationCasesApi.get(selectedRow.id));
      } catch (actionError) {
        setError(
          actionError instanceof Error ? actionError.message : 'Failed to review mobilization'
        );
      } finally {
        setStageAction(null);
      }
    },
    [isPolish, mobilizationProposal, replaceCase, selectedRow]
  );
  const handleAcceptMobilization = useCallback(async () => {
    if (!selectedRow) return;
    setStageAction('accept-mobilization');
    setError(null);
    try {
      await TransformationCasesApi.acceptMobilizationResults(selectedRow.id, {
        expectedVersion: selectedRow.transformationCase.version,
        decisionReason:
          'Applied blueprint and canonical SCHEDULED Initiative reviewed in Agent Hub',
      });
      replaceCase(await TransformationCasesApi.get(selectedRow.id));
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Failed to accept mobilization'
      );
    } finally {
      setStageAction(null);
    }
  }, [replaceCase, selectedRow]);
  const refreshExecution = useCallback(async () => {
    if (!selectedRow) return;
    try {
      setExecutionCheckpoint(await TransformationCasesApi.getExecutionCheckpoint(selectedRow.id));
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Failed to load execution checkpoint'
      );
    }
  }, [selectedRow]);
  const handleAcceptExecutionStart = useCallback(async () => {
    if (!selectedRow) return;
    setStageAction('accept-execution-start');
    setError(null);
    try {
      await TransformationCasesApi.acceptExecutionStart(selectedRow.id, {
        expectedVersion: selectedRow.transformationCase.version,
        decisionReason: 'Canonical EXECUTING status reviewed in Agent Hub',
      });
      replaceCase(await TransformationCasesApi.get(selectedRow.id));
      await refreshExecution();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Failed to accept execution start'
      );
    } finally {
      setStageAction(null);
    }
  }, [refreshExecution, replaceCase, selectedRow]);
  const handleAcceptExecutionResults = useCallback(async () => {
    if (!selectedRow) return;
    setStageAction('accept-execution-results');
    setError(null);
    try {
      await TransformationCasesApi.acceptExecutionResults(selectedRow.id, {
        expectedVersion: selectedRow.transformationCase.version,
        decisionReason: 'DONE lifecycle and completed WBS/milestones reviewed in Agent Hub',
      });
      replaceCase(await TransformationCasesApi.get(selectedRow.id));
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Failed to accept execution results'
      );
    } finally {
      setStageAction(null);
    }
  }, [replaceCase, selectedRow]);
  const refreshBenefits = useCallback(async () => {
    if (!selectedRow) return;
    try {
      setBenefitsCheckpoint(await TransformationCasesApi.getBenefitsCheckpoint(selectedRow.id));
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Failed to load benefits checkpoint'
      );
    }
  }, [selectedRow]);
  const handleAcceptDeliveryHandoff = useCallback(async () => {
    if (!selectedRow) return;
    setStageAction('accept-delivery-handoff');
    setError(null);
    try {
      await TransformationCasesApi.acceptDeliveryHandoff(selectedRow.id, {
        expectedVersion: selectedRow.transformationCase.version,
        effectiveness,
        decisionReason: 'Benefit owner, actuals and measurement quality reviewed in Agent Hub',
      });
      replaceCase(await TransformationCasesApi.get(selectedRow.id));
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Failed to accept benefits handoff'
      );
    } finally {
      setStageAction(null);
    }
  }, [effectiveness, replaceCase, selectedRow]);
  const handleAcceptBenefitsReview = useCallback(async () => {
    if (!selectedRow) return;
    setStageAction('accept-benefits-review');
    setError(null);
    try {
      await TransformationCasesApi.acceptBenefitsReview(selectedRow.id, {
        expectedVersion: selectedRow.transformationCase.version,
        decisionReason: 'Achieved benefits and verified measurements reviewed in Agent Hub',
      });
      replaceCase(await TransformationCasesApi.get(selectedRow.id));
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Failed to accept benefits review'
      );
    } finally {
      setStageAction(null);
    }
  }, [replaceCase, selectedRow]);
  const refreshSustainability = useCallback(async () => {
    if (!selectedRow) return;
    try {
      setSustainabilityCheckpoint(
        await TransformationCasesApi.getSustainabilityCheckpoint(selectedRow.id)
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'Failed to load sustainability checkpoint'
      );
    }
  }, [selectedRow]);
  const handleSustainabilityReview = useCallback(
    async (conclusion: 'sustained' | 'corrective_continuation') => {
      if (!selectedRow) return;
      setStageAction(`sustainability-${conclusion}`);
      setError(null);
      try {
        await TransformationCasesApi.acceptSustainabilityReview(selectedRow.id, {
          expectedVersion: selectedRow.transformationCase.version,
          conclusion,
          decisionReason:
            conclusion === 'sustained'
              ? 'Thirty-day sustained outcome window accepted in Agent Hub'
              : 'Regression requires corrective continuation',
        });
        replaceCase(await TransformationCasesApi.get(selectedRow.id));
      } catch (actionError) {
        setError(
          actionError instanceof Error ? actionError.message : 'Failed to review sustainability'
        );
      } finally {
        setStageAction(null);
      }
    },
    [replaceCase, selectedRow]
  );
  const handleGenerateFinalOutputs = useCallback(async () => {
    if (!selectedRow || !finalPublicationExecutable || !finalPublicationProposal) return;
    setStageAction('generate-final-outputs');
    setError(null);
    try {
      setFinalOutputRun(await TransformationCasesApi.generateFinalOutputs(selectedRow.id));
    } catch (actionError) {
      if ((actionError as { status?: number })?.status === 409) {
        try {
          await refreshGovernance(finalPublicationProposal);
        } catch {
          // Preserve the publication preflight failure.
        }
      }
      setError(governanceErrorText(actionError));
    } finally {
      setStageAction(null);
    }
  }, [
    finalPublicationExecutable,
    finalPublicationProposal,
    governanceErrorText,
    refreshGovernance,
    selectedRow,
  ]);

  const handlePrepareFinalOutputPublication = useCallback(async () => {
    if (!selectedRow || selectedRow.transformationCase.lifecycleStage !== 'final_outputs') return;
    setStageAction('prepare-final-output-publication');
    setError(null);
    try {
      const mapping = await TransformationCasesApi.prepareFinalOutputPublication(selectedRow.id);
      const raw = await TransformationCasesApi.getGovernedProposal(mapping.proposalVersionId);
      const scopes = (raw.approvalScopes ?? [mapping.scopeKey]).map((scopeKey) => {
        const review = raw.reviews?.find((item) => item.scopeKey === scopeKey);
        const authorized = Boolean(
          currentUserId && raw.reviewerAuthorityByScope?.[scopeKey]?.includes(currentUserId)
        );
        return {
          scopeKey,
          label:
            scopeKey === 'final_outputs.publish'
              ? isPolish
                ? 'Publikacja raportu końcowego'
                : 'Final report publication'
              : scopeKey,
          decision:
            review?.decision === 'approved'
              ? ('approved' as const)
              : review?.decision === 'rejected'
                ? ('rejected' as const)
                : ('pending' as const),
          authority: {
            canReview: authorized,
            reviewerRole: authorized
              ? isPolish
                ? 'Przypisany recenzent'
                : 'Assigned reviewer'
              : null,
            deniedReason: authorized
              ? null
              : isPolish
                ? 'Bieżący użytkownik nie jest przypisanym recenzentem publikacji.'
                : 'The current user is not the assigned publication reviewer.',
          },
        };
      });
      setFinalOutputPublication({
        ...mapping,
        governance: { ...raw, scopes },
      });
    } catch (actionError) {
      setError(governanceErrorText(actionError));
    } finally {
      setStageAction(null);
    }
  }, [currentUserId, governanceErrorText, isPolish, selectedRow]);

  if (error && cases === null) {
    return (
      <EmptyState
        variant="error"
        title={isPolish ? 'Nie udało się wczytać transformacji' : 'Failed to load transformations'}
        description={error}
        onRetry={() => void loadCases()}
        className="h-full"
      />
    );
  }
  if (cases === null) {
    return (
      <div className="p-4">
        <LoadingState template="list" rows={5} />
      </div>
    );
  }
  if (cases.length === 0) {
    return (
      <EmptyState
        icon={PlayCircle}
        title={isPolish ? 'Brak planów transformacji' : 'No transformation plans'}
        description={
          isPolish
            ? 'Napisz do Teresy: „Przygotuj plan transformacji”, aby utworzyć pierwszy trwały Transformation Case.'
            : 'Ask Teresa to “Prepare a transformation plan” to create the first durable Transformation Case.'
        }
        className="h-full"
      />
    );
  }

  return (
    <section
      className="h-full min-h-0"
      aria-label={isPolish ? 'Plany transformacji' : 'Transformation plans'}
      aria-busy={Boolean(stageAction || reconcilingRuntime || cancelling)}
    >
      {error ? (
        <p role="alert" className="px-4 pt-3 text-xs text-c-danger">
          {error}
        </p>
      ) : null}
      <TableWithPreviewLayout<{ id: string; title: string }>
        selectedId={selectedId}
        selectedItem={selectedRow ? { id: selectedRow.id, title: selectedRow.title } : null}
        onSelect={selectCase}
        itemIds={rows.map((row) => row.id)}
        renderPreview={() => {
          if (!selectedRow) return null;
          const item = selectedRow.transformationCase;
          const steps = item.activePlan?.steps ?? [];
          return (
            <div className="space-y-4" data-testid="transformation-case-preview">
              <PreviewMetaCard
                pills={[
                  { label: isPolish ? 'Wersja' : 'Version', value: `v${item.version}` },
                  {
                    label: isPolish ? 'Autonomia' : 'Autonomy',
                    value: item.autonomyLevel,
                    tone: 'warning',
                  },
                  { label: isPolish ? 'Etapy' : 'Stages', value: steps.length },
                ]}
              />
              <PreviewDetailsSection text={item.mandate} />
              <TransformationQualityTrustSection transformationCase={item} isPolish={isPolish} />
              <ProjectTeamCard
                caseId={item.transformationCaseId}
                caseVersion={item.version}
                projectId={item.projectId}
                currentUserId={currentUserId}
                isPolish={isPolish}
                onProjectBound={async () => {
                  await loadCases();
                }}
              />
              {canonicalRuntime ? (
                <div
                  className={`rounded-lg border p-3 ${
                    canonicalRuntime.stateDrift
                      ? 'border-amber-300/50 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/5'
                      : 'border-c-border bg-c-surface'
                  }`}
                  data-testid="canonical-runtime"
                  role="status"
                  aria-live="polite"
                >
                  <p className="text-xs font-semibold text-c-text">
                    {isPolish ? 'Kanoniczny przebieg agenta' : 'Canonical agent run'}
                  </p>
                  <p className="mt-1 break-all text-[11px] text-c-text-secondary">
                    Run ID: {canonicalRuntime.canonicalRunId}
                  </p>
                  <p className="mt-1 text-[11px] text-c-text-muted">
                    {isPolish ? 'Stan zapisany' : 'Persisted state'}: {canonicalRuntime.actualState}
                    {' · '}
                    {isPolish ? 'Stan wynikający z procesu' : 'Projected state'}:{' '}
                    {canonicalRuntime.projectedState}
                  </p>
                  {onOpenOperations ? (
                    <button
                      type="button"
                      className="mt-2 rounded-md border border-c-border px-2 py-1 text-xs font-semibold text-c-text"
                      onClick={() =>
                        onOpenOperations({
                          transformationCaseId: item.transformationCaseId,
                          canonicalRunId: canonicalRuntime.canonicalRunId,
                        })
                      }
                    >
                      {isPolish ? 'Otwórz diagnostykę przebiegu' : 'Open run diagnostics'}
                    </button>
                  ) : null}
                  <p className="mt-1 text-[11px] text-c-text-muted">
                    Lineage: {canonicalRuntime.lineageId} · Identity:{' '}
                    {canonicalRuntime.identityRegistered ? 'registered' : 'missing'}
                  </p>
                  {canonicalRuntime.stateDrift ? (
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        {isPolish
                          ? 'Wykryto rozbieżność stanu. Automatyczna spójność nie jest jeszcze dowiedziona.'
                          : 'State drift detected. Automatic consistency is not yet proven.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => void reconcileRuntime()}
                        disabled={reconcilingRuntime}
                        className="rounded-md border border-amber-400/50 px-2 py-1 text-xs font-semibold text-c-text disabled:opacity-50"
                      >
                        {reconcilingRuntime
                          ? isPolish
                            ? 'Uzgadnianie…'
                            : 'Reconciling…'
                          : isPolish
                            ? 'Uzgodnij stan'
                            : 'Reconcile state'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {finalOutputRun ? (
                <div className="rounded-lg border border-c-border bg-c-surface p-3">
                  <p className="text-xs font-semibold text-c-text">
                    {isPolish ? 'Końcowy Word + PowerPoint' : 'Final Word + PowerPoint'}
                  </p>
                  <p className="mt-1 break-all text-[11px] text-c-text-secondary">
                    {isPolish ? 'Digest faktów' : 'Facts digest'}: {finalOutputRun.factsDigest}
                  </p>
                  <p className="mt-1 text-[11px] text-c-text-muted">
                    DOCX {finalOutputRun.docxSha256.slice(0, 12)}… · PPTX{' '}
                    {finalOutputRun.pptxSha256.slice(0, 12)}…
                  </p>
                  <div className="mt-2 flex gap-3 text-xs font-semibold text-c-info">
                    <a
                      href={`/api/v8/transformation-cases/${encodeURIComponent(item.transformationCaseId)}/final-outputs/docx/download`}
                    >
                      Word
                    </a>
                    <a
                      href={`/api/v8/transformation-cases/${encodeURIComponent(item.transformationCaseId)}/final-outputs/pptx/download`}
                    >
                      PowerPoint
                    </a>
                  </div>
                </div>
              ) : null}
              {finalOutputPublication ? (
                <section
                  className="rounded-lg border border-c-border bg-c-surface p-3"
                  aria-labelledby={`final-publication-${item.transformationCaseId}`}
                  data-testid="final-output-publication"
                >
                  <h3
                    id={`final-publication-${item.transformationCaseId}`}
                    className="text-xs font-semibold text-c-text"
                  >
                    {isPolish ? 'Zgoda na publikację końcową' : 'Final publication approval'}
                  </h3>
                  <p className="mt-1 break-all text-[11px] text-c-text-secondary">
                    {isPolish ? 'Dokładny digest faktów' : 'Exact facts digest'}:{' '}
                    {finalOutputPublication.factsDigest}
                  </p>
                  <p
                    id={`final-publication-state-${item.transformationCaseId}`}
                    className="mt-1 break-words text-[11px] text-c-text-muted"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {isPolish ? 'Wersja Case' : 'Case version'}: v
                    {finalOutputPublication.caseVersion} · {isPolish ? 'Zakres' : 'Scope'}:{' '}
                    {finalOutputPublication.scopeKey} · {finalPublicationStateReason}
                  </p>
                </section>
              ) : item.lifecycleStage === 'final_outputs' ? (
                <p
                  id={`final-publication-state-${item.transformationCaseId}`}
                  className="sr-only"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {finalPublicationStateReason}
                </p>
              ) : null}
              {item.missingInputs.length > 0 ? (
                <div className="rounded-lg border border-amber-300/40 bg-amber-50/60 p-3 dark:border-amber-500/20 dark:bg-amber-500/5">
                  <p className="text-xs font-semibold text-c-text">
                    {isPolish ? 'Brakujące dane' : 'Missing inputs'}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-c-text-secondary">
                    {item.missingInputs.map((input) => (
                      <li key={input}>{input}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <GovernedProposalReview
                proposal={activeStageProposal}
                isLoading={proposalsLoading && !activeStageProposal}
                isPolish={isPolish}
                busy={Boolean(stageAction)}
                onScopeDecision={(scopeKey, decision) =>
                  void handleScopeGovernanceDecision(scopeKey, decision)
                }
                onRevise={() => void handleReviseGovernedProposal()}
                onRebaseline={() => void handleRebaselineGovernedProposal()}
              />
              {ideasProposal ? (
                <div className="space-y-2 rounded-lg border border-c-border bg-c-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-c-text">
                      {isPolish ? 'Propozycja początkowych idei' : 'Initial Ideas proposal'}
                    </p>
                    <StatusChip
                      label={ideasProposal.status}
                      tone={ideasProposal.status === 'applied' ? 'success' : 'warning'}
                      size="sm"
                    />
                  </div>
                  {ideasProposal.candidates.map((candidate) => (
                    <div
                      key={candidate.candidateId}
                      className="rounded-md border border-c-border bg-c-card p-2.5"
                    >
                      <p className="text-xs font-semibold text-c-text">{candidate.title}</p>
                      <p className="mt-1 text-[11px] text-c-text-secondary">
                        {candidate.hypothesis}
                      </p>
                    </div>
                  ))}
                  {ideasProposal.artifactIds?.length ? (
                    <p className="text-[11px] text-c-text-muted">
                      {isPolish
                        ? `Utworzono w My Ideas: ${ideasProposal.artifactIds.length}`
                        : `Created in My Ideas: ${ideasProposal.artifactIds.length}`}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {ideasProposal?.status === 'applied' && interviewsProposal === null ? (
                <div className="space-y-2 rounded-lg border border-c-border bg-c-surface p-3">
                  <p className="text-xs font-semibold text-c-text">
                    {isPolish ? 'Przygotuj plan Interview' : 'Prepare Interview plan'}
                  </p>
                  <input
                    aria-label={isPolish ? 'ID użytkownika interesariusza' : 'Stakeholder user ID'}
                    value={stakeholderUserId}
                    onChange={(event) => setStakeholderUserId(event.target.value)}
                    placeholder={isPolish ? 'ID użytkownika' : 'User ID'}
                    className="w-full rounded-md border border-c-border bg-c-card px-2.5 py-2 text-xs text-c-text"
                  />
                  <input
                    aria-label={isPolish ? 'Rola interesariusza' : 'Stakeholder role'}
                    value={stakeholderRole}
                    onChange={(event) => setStakeholderRole(event.target.value)}
                    placeholder={
                      isPolish ? 'Rola, np. Dyrektor Operacyjny' : 'Role, e.g. Operations Director'
                    }
                    className="w-full rounded-md border border-c-border bg-c-card px-2.5 py-2 text-xs text-c-text"
                  />
                  <input
                    aria-label={isPolish ? 'Obszary rozmowy' : 'Interview focus areas'}
                    value={stakeholderFocus}
                    onChange={(event) => setStakeholderFocus(event.target.value)}
                    placeholder={
                      isPolish ? 'Obszary oddzielone przecinkami' : 'Comma-separated focus areas'
                    }
                    className="w-full rounded-md border border-c-border bg-c-card px-2.5 py-2 text-xs text-c-text"
                  />
                </div>
              ) : null}
              {interviewsProposal ? (
                <div className="space-y-2 rounded-lg border border-c-border bg-c-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-c-text">
                      {isPolish ? 'Plan Interview' : 'Interview plan'}
                    </p>
                    <StatusChip
                      label={interviewsProposal.status}
                      tone={interviewsProposal.status === 'applied' ? 'success' : 'warning'}
                      size="sm"
                    />
                  </div>
                  {interviewsProposal.candidates.map((candidate) => (
                    <div
                      key={candidate.candidateId}
                      className="rounded-md border border-c-border bg-c-card p-2.5"
                    >
                      <p className="text-xs font-semibold text-c-text">
                        {candidate.stakeholderRole} · {candidate.assigneeUserId}
                      </p>
                      <p className="mt-1 text-[11px] text-c-text-secondary">
                        {candidate.objective}
                      </p>
                      <p className="mt-1 text-[11px] text-c-text-muted">
                        {isPolish ? 'Pytania' : 'Questions'}: {candidate.questions.length}
                      </p>
                    </div>
                  ))}
                  {interviewsProposal.artifactIds?.length ? (
                    <p className="text-[11px] text-c-text-muted">
                      {isPolish
                        ? `Utworzone assignmenty: ${interviewsProposal.artifactIds.length}`
                        : `Created assignments: ${interviewsProposal.artifactIds.length}`}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {interviewsProposal?.status === 'applied' && item.lifecycleStage === 'interviews' ? (
                <div className="space-y-2 rounded-lg border border-c-border bg-c-surface p-3">
                  <p className="text-xs font-semibold text-c-text">
                    {isPolish ? 'Zamknij Interview po review' : 'Close Interview after review'}
                  </p>
                  <p className="text-[11px] text-c-text-secondary">
                    {isPolish
                      ? 'Wymagane są ukończone sesje, zaakceptowane assignmenty i insighty po governance review.'
                      : 'Completed sessions, approved assignments and governance-reviewed insights are required.'}
                  </p>
                  <input
                    aria-label={isPolish ? 'ID zaakceptowanych insightów' : 'Approved insight IDs'}
                    value={acceptedInsightIds}
                    onChange={(event) => setAcceptedInsightIds(event.target.value)}
                    placeholder={
                      isPolish
                        ? 'ID insightów oddzielone przecinkami'
                        : 'Comma-separated insight IDs'
                    }
                    className="w-full rounded-md border border-c-border bg-c-card px-2.5 py-2 text-xs text-c-text"
                  />
                </div>
              ) : null}
              {item.lifecycleStage === 'drd' && drdProposal === null ? (
                <div className="space-y-2 rounded-lg border border-c-border bg-c-surface p-3">
                  <p className="text-xs font-semibold text-c-text">
                    {isPolish ? 'Przygotuj diagnozę DRD' : 'Prepare DRD diagnosis'}
                  </p>
                  <p className="text-[11px] text-c-text-secondary">
                    {isPolish
                      ? 'Agent utworzy propozycję opartą na zaakceptowanych insightach Interview. Assessment powstanie dopiero po akceptacji.'
                      : 'The Agent will prepare a proposal from accepted Interview Insights. The assessment is created only after approval.'}
                  </p>
                  <input
                    aria-label={isPolish ? 'Nazwa assessmentu DRD' : 'DRD assessment name'}
                    value={drdName}
                    onChange={(event) => setDrdName(event.target.value)}
                    placeholder={isPolish ? 'Nazwa diagnozy DRD' : 'DRD diagnosis name'}
                    className="w-full rounded-md border border-c-border bg-c-card px-2.5 py-2 text-xs text-c-text"
                  />
                </div>
              ) : null}
              {drdProposal ? (
                <div className="space-y-2 rounded-lg border border-c-border bg-c-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-c-text">
                      {drdProposal.assessmentName}
                    </p>
                    <StatusChip
                      label={drdProposal.status}
                      tone={drdProposal.status === 'applied' ? 'success' : 'warning'}
                      size="sm"
                    />
                  </div>
                  <p className="text-[11px] text-c-text-secondary">
                    {isPolish ? 'Źródłowe insighty Interview' : 'Source Interview Insights'}:{' '}
                    {drdProposal.sourceInsightIds.length}
                  </p>
                  {drdProposal.assessmentId ? (
                    <a
                      href={`/assessment/drd/${encodeURIComponent(drdProposal.assessmentId)}`}
                      className="inline-flex text-xs font-semibold text-c-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      {isPolish ? 'Otwórz assessment DRD' : 'Open DRD assessment'}
                    </a>
                  ) : null}
                </div>
              ) : null}
              {item.lifecycleStage === 'opportunity_synthesis' && synthesisProposal === null ? (
                <div className="space-y-2 rounded-lg border border-c-border bg-c-surface p-3">
                  <p className="text-xs font-semibold text-c-text">
                    {isPolish ? 'Synteza szans' : 'Opportunity synthesis'}
                  </p>
                  <p className="text-[11px] text-c-text-secondary">
                    {isPolish
                      ? 'Agent połączy lineage Ideas, zaakceptowanych Interview Insights i immutable wyniku DRD. Candidate powstanie dopiero po akceptacji.'
                      : 'The Agent will join Ideas, accepted Interview Insights and immutable DRD lineage. The Candidate is created only after approval.'}
                  </p>
                </div>
              ) : null}
              {synthesisProposal ? (
                <div className="space-y-2 rounded-lg border border-c-border bg-c-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-c-text">
                      {isPolish ? 'Synteza szans' : 'Opportunity synthesis'}
                    </p>
                    <StatusChip
                      label={synthesisProposal.status}
                      tone={synthesisProposal.status === 'applied' ? 'success' : 'warning'}
                      size="sm"
                    />
                  </div>
                  <p className="text-[11px] text-c-text-secondary">
                    {synthesisProposal.synthesisSummary}
                  </p>
                  <p className="text-[11px] text-c-text-muted">
                    Ideas: {synthesisProposal.sourceIdeaIds.length} · Interview Insights:{' '}
                    {synthesisProposal.sourceInsightIds.length}
                  </p>
                  {synthesisProposal.candidateId ? (
                    <p className="text-[11px] font-semibold text-c-text">
                      Candidate: {synthesisProposal.candidateId}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {item.lifecycleStage === 'finance_kpi' && financeProposal === null ? (
                <div className="space-y-2 rounded-lg border border-c-border bg-c-surface p-3">
                  <p className="text-xs font-semibold text-c-text">
                    {isPolish ? 'Business case i karta KPI' : 'Business case and KPI card'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ['capex', 'CAPEX'],
                        ['opexAnnual', 'OPEX / rok'],
                        ['benefitAnnual', 'Korzyść / rok'],
                        ['horizonYears', 'Horyzont (lata)'],
                        ['waccPct', 'WACC %'],
                        ['baselineValue', 'KPI baseline'],
                        ['targetValue', 'KPI target'],
                      ] as const
                    ).map(([key, label]) => (
                      <input
                        key={key}
                        aria-label={label}
                        value={financeInputs[key]}
                        onChange={(event) =>
                          setFinanceInputs((current) => ({ ...current, [key]: event.target.value }))
                        }
                        placeholder={label}
                        className="rounded-md border border-c-border bg-c-card px-2.5 py-2 text-xs text-c-text"
                      />
                    ))}
                    <input
                      aria-label="KPI name"
                      value={financeInputs.kpiName}
                      onChange={(event) =>
                        setFinanceInputs((current) => ({ ...current, kpiName: event.target.value }))
                      }
                      className="rounded-md border border-c-border bg-c-card px-2.5 py-2 text-xs text-c-text"
                    />
                    <input
                      aria-label="KPI unit"
                      value={financeInputs.kpiUnit}
                      onChange={(event) =>
                        setFinanceInputs((current) => ({ ...current, kpiUnit: event.target.value }))
                      }
                      className="rounded-md border border-c-border bg-c-card px-2.5 py-2 text-xs text-c-text"
                    />
                  </div>
                </div>
              ) : null}
              {financeProposal ? (
                <div className="space-y-2 rounded-lg border border-c-border bg-c-surface p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-c-text">
                      Finance/KPI · {financeProposal.businessCase.verdict.toUpperCase()}
                    </p>
                    <StatusChip
                      label={financeProposal.status}
                      tone={financeProposal.status === 'applied' ? 'success' : 'warning'}
                      size="sm"
                    />
                  </div>
                  <p className="text-[11px] text-c-text-secondary">
                    {financeProposal.businessCase.summary}
                  </p>
                  <p className="text-[11px] text-c-text-muted">
                    KPI: {financeProposal.kpi.name} · {financeProposal.kpi.baselineValue} →{' '}
                    {financeProposal.kpi.targetValue} {financeProposal.kpi.unit}
                  </p>
                  {financeProposal.financialAnalysisId ? (
                    <p className="text-[11px] font-semibold text-c-text">
                      Analysis: {financeProposal.financialAnalysisId} · KPI: {financeProposal.kpiId}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {item.lifecycleStage === 'portfolio_decision' && portfolioProposal === null ? (
                <div className="space-y-2 rounded-lg border border-c-border bg-c-surface p-3">
                  <p className="text-xs font-semibold text-c-text">
                    {isPolish ? 'Decyzja portfelowa GO/NO-GO' : 'Portfolio GO/NO-GO decision'}
                  </p>
                  <p className="text-[11px] text-c-text-secondary">
                    {isPolish
                      ? 'Agent przygotuje pakiet z zatwierdzonej analizy, KPI i pełnego lineage. Sama decyzja powstanie po akceptacji.'
                      : 'The Agent prepares a packet from approved Finance, KPI and full lineage. The decision is created only after approval.'}
                  </p>
                  <input
                    aria-label={isPolish ? 'ID właściciela decyzji' : 'Decision owner ID'}
                    value={decisionMakerId}
                    onChange={(event) => setDecisionMakerId(event.target.value)}
                    placeholder={
                      isPolish ? 'ID sponsora / decision makera' : 'Sponsor / decision maker ID'
                    }
                    className="w-full rounded-md border border-c-border bg-c-card px-2.5 py-2 text-xs text-c-text"
                  />
                </div>
              ) : null}
              {portfolioProposal ? (
                <div className="space-y-2 rounded-lg border border-c-border bg-c-surface p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-c-text">{portfolioProposal.title}</p>
                    <StatusChip
                      label={portfolioProposal.status}
                      tone={portfolioProposal.status === 'applied' ? 'success' : 'warning'}
                      size="sm"
                    />
                  </div>
                  <p className="text-[11px] text-c-text-secondary">
                    {portfolioProposal.description}
                  </p>
                  <p className="text-[11px] text-c-text-muted">
                    Decision maker: {portfolioProposal.decisionMakerId}
                  </p>
                  {portfolioProposal.decisionId ? (
                    <a
                      href={`/decisions/${encodeURIComponent(portfolioProposal.decisionId)}`}
                      className="text-xs font-semibold text-c-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      {isPolish ? 'Otwórz decyzję GO/NO-GO' : 'Open GO/NO-GO decision'}
                    </a>
                  ) : null}
                </div>
              ) : null}
              {item.lifecycleStage === 'mobilization' && mobilizationProposal === null ? (
                <div className="space-y-2 rounded-lg border border-c-border bg-c-surface p-3">
                  <p className="text-xs font-semibold text-c-text">
                    {isPolish ? 'Mobilizacja Initiative' : 'Initiative mobilization'}
                  </p>
                  <p className="text-[11px] text-c-text-secondary">
                    {isPolish
                      ? 'Agent przygotuje WBS, zależności, kamienie milowe i obsadę. Rekordy powstaną dopiero po akceptacji.'
                      : 'The Agent prepares WBS, dependencies, milestones and staffing. Records are created only after approval.'}
                  </p>
                  {(['ownerUserId', 'startDate', 'endDate'] as const).map((key) => (
                    <input
                      key={key}
                      aria-label={key}
                      type={key === 'ownerUserId' ? 'text' : 'date'}
                      value={mobilizationInputs[key]}
                      onChange={(event) =>
                        setMobilizationInputs((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-c-border bg-c-card px-2.5 py-2 text-xs text-c-text"
                    />
                  ))}
                </div>
              ) : null}
              {mobilizationProposal ? (
                <div className="space-y-2 rounded-lg border border-c-border bg-c-surface p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-c-text">
                      {isPolish ? 'Blueprint mobilizacji' : 'Mobilization blueprint'}
                    </p>
                    <StatusChip
                      label={mobilizationProposal.status}
                      tone={mobilizationProposal.status === 'applied' ? 'success' : 'warning'}
                      size="sm"
                    />
                  </div>
                  <p className="text-[11px] text-c-text-secondary">
                    WBS: {mobilizationProposal.wbs.length} · Milestones:{' '}
                    {mobilizationProposal.milestones.length} · Dependencies:{' '}
                    {mobilizationProposal.dependencies.length} · Resources:{' '}
                    {mobilizationProposal.resources.length}
                  </p>
                  {mobilizationProposal.blueprintId ? (
                    <p className="text-[11px] font-semibold text-c-text">
                      Blueprint: {mobilizationProposal.blueprintId} · Tasks:{' '}
                      {mobilizationProposal.taskIds?.length ?? 0}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {item.lifecycleStage === 'execution' ? (
                <div className="space-y-2 rounded-lg border border-c-border bg-c-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-c-text">
                      {isPolish ? 'Kontrola wykonania' : 'Execution checkpoint'}
                    </p>
                    {executionCheckpoint ? (
                      <StatusChip
                        label={executionCheckpoint.initiativeStatus}
                        tone={
                          executionCheckpoint.initiativeStatus === 'DONE' ? 'success' : 'warning'
                        }
                        size="sm"
                      />
                    ) : null}
                  </div>
                  {executionCheckpoint ? (
                    <>
                      <p className="text-[11px] text-c-text-secondary">
                        Tasks: {executionCheckpoint.tasks.completed}/
                        {executionCheckpoint.tasks.total}
                        {' · '}Blocked: {executionCheckpoint.tasks.blocked}
                      </p>
                      <p className="text-[11px] text-c-text-secondary">
                        Milestones: {executionCheckpoint.milestones.completed}/
                        {executionCheckpoint.milestones.total}
                        {' · '}Delayed: {executionCheckpoint.milestones.delayed}
                      </p>
                      <p className="text-[11px] text-c-text-secondary">
                        KPI on target: {executionCheckpoint.kpis.onTarget}/
                        {executionCheckpoint.kpis.total}
                        {' · '}
                        {executionCheckpoint.executionStarted
                          ? isPolish
                            ? 'Start wykonania przyjęty'
                            : 'Execution start accepted'
                          : isPolish
                            ? 'Start wykonania oczekuje na przyjęcie'
                            : 'Execution start awaits acceptance'}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-c-text-secondary">
                      {isPolish
                        ? 'Ustaw Initiative w kanonicznym workspace na EXECUTING, a po zakończeniu na DONE. Agent weryfikuje stan, nie omija workflow.'
                        : 'Move the Initiative to EXECUTING, then DONE, in the canonical workspace. The Agent verifies state without bypassing the workflow.'}
                    </p>
                  )}
                </div>
              ) : null}
              {item.lifecycleStage === 'delivery' ? (
                <div className="space-y-2 rounded-lg border border-c-border bg-c-surface p-3">
                  <p className="text-xs font-semibold text-c-text">
                    {isPolish ? 'Odbiór korzyści' : 'Benefits handoff'}
                  </p>
                  {benefitsCheckpoint ? (
                    <>
                      <p className="text-[11px] text-c-text-secondary">
                        Benefits measured: {benefitsCheckpoint.benefits.measured}/
                        {benefitsCheckpoint.benefits.total}
                        {' · '}Owned: {benefitsCheckpoint.benefits.owned}/
                        {benefitsCheckpoint.benefits.total}
                      </p>
                      <p className="text-[11px] text-c-text-secondary">
                        Achieved: {benefitsCheckpoint.benefits.achieved}
                        {' · '}At risk: {benefitsCheckpoint.benefits.atRisk}
                        {' · '}Finance actuals: {benefitsCheckpoint.financeActuals.verified}/
                        {benefitsCheckpoint.financeActuals.total}
                      </p>
                      <select
                        aria-label={
                          isPolish ? 'Klasyfikacja efektu' : 'Effectiveness classification'
                        }
                        value={effectiveness}
                        onChange={(event) =>
                          setEffectiveness(
                            event.target.value as 'confirmed' | 'partial' | 'not_achieved'
                          )
                        }
                        className="w-full rounded-md border border-c-border bg-c-card px-2.5 py-2 text-xs text-c-text"
                      >
                        <option value="confirmed">confirmed</option>
                        <option value="partial">partial</option>
                        <option value="not_achieved">not_achieved</option>
                      </select>
                    </>
                  ) : (
                    <p className="text-[11px] text-c-text-secondary">
                      {isPolish
                        ? 'Delivery nie jest dowodem wartości. Uzupełnij właścicieli, pomiary KPI i finansowe wartości rzeczywiste w Results.'
                        : 'Delivery is not proof of value. Complete owners, KPI measurements and finance actuals in Results.'}
                    </p>
                  )}
                </div>
              ) : null}
              {item.lifecycleStage === 'benefits' ? (
                <div className="space-y-2 rounded-lg border border-c-border bg-c-surface p-3">
                  <p className="text-xs font-semibold text-c-text">
                    {isPolish ? 'Weryfikacja efektu' : 'Effectiveness verification'}
                  </p>
                  <p className="text-[11px] text-c-text-secondary">
                    {isPolish
                      ? 'Każda korzyść musi mieć status achieved/exceeded oraz zweryfikowany pomiar. Dopiero wtedy rozpoczyna się niezależne okno trwałości.'
                      : 'Every benefit must be achieved/exceeded with a verified measurement before the independent sustainability window begins.'}
                  </p>
                </div>
              ) : null}
              {item.lifecycleStage === 'sustainability' ? (
                <div className="space-y-2 rounded-lg border border-c-border bg-c-surface p-3">
                  <p className="text-xs font-semibold text-c-text">
                    {isPolish ? 'Przegląd trwałości' : 'Sustainability review'}
                  </p>
                  {sustainabilityCheckpoint ? (
                    <p className="text-[11px] text-c-text-secondary">
                      Two verified measurements:{' '}
                      {sustainabilityCheckpoint.benefits.withTwoVerifiedMeasurements}/
                      {sustainabilityCheckpoint.benefits.total}
                      {' · '}Sustained ≥30 days:{' '}
                      {sustainabilityCheckpoint.benefits.sustainedAcrossWindow}/
                      {sustainabilityCheckpoint.benefits.total}
                      {' · '}Minimum window:{' '}
                      {sustainabilityCheckpoint.benefits.minimumWindowDays ?? '—'} days
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="space-y-2">
                {(editableSteps ?? steps).map((step, stepIndex, renderedSteps) => (
                  <div
                    key={step.stepId}
                    className="rounded-lg border border-c-border bg-c-card p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-c-text">
                          {step.stepIndex + 1}. {step.businessPurpose}
                        </p>
                        <p className="mt-1 text-[11px] text-c-text-secondary">
                          {step.moduleTarget}
                        </p>
                      </div>
                      <StatusChip
                        label={step.capabilityStatus}
                        tone={capabilityTone(step.capabilityStatus)}
                        size="sm"
                      />
                    </div>
                    {step.blockerReason ? (
                      <p className="mt-2 text-[11px] text-c-text-muted">{step.blockerReason}</p>
                    ) : null}
                    {editableSteps ? (
                      <div className="mt-2 space-y-2 border-t border-c-border pt-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="text-[11px] text-c-text-secondary">
                            {isPolish ? 'Cel biznesowy' : 'Business purpose'}
                            <textarea
                              aria-label={`${isPolish ? 'Cel biznesowy' : 'Business purpose'} ${step.lifecycleStage}`}
                              value={step.businessPurpose}
                              onChange={(event) =>
                                updatePlanStep(stepIndex, 'businessPurpose', event.target.value)
                              }
                              className="mt-1 w-full rounded-md border border-c-border bg-c-surface px-2 py-1.5 text-xs text-c-text"
                            />
                          </label>
                          <label className="text-[11px] text-c-text-secondary">
                            {isPolish ? 'Moduł docelowy' : 'Target module'}
                            <input
                              aria-label={`${isPolish ? 'Moduł docelowy' : 'Target module'} ${step.lifecycleStage}`}
                              value={step.moduleTarget}
                              onChange={(event) =>
                                updatePlanStep(stepIndex, 'moduleTarget', event.target.value)
                              }
                              className="mt-1 w-full rounded-md border border-c-border bg-c-surface px-2 py-1.5 text-xs text-c-text"
                            />
                          </label>
                          <label className="text-[11px] text-c-text-secondary">
                            {isPolish ? 'Wejścia (po przecinku)' : 'Inputs (comma-separated)'}
                            <input
                              aria-label={`${isPolish ? 'Wejścia' : 'Inputs'} ${step.lifecycleStage}`}
                              value={step.inputs.join(', ')}
                              onChange={(event) =>
                                updatePlanStep(
                                  stepIndex,
                                  'inputs',
                                  event.target.value
                                    .split(',')
                                    .map((value) => value.trim())
                                    .filter(Boolean)
                                )
                              }
                              className="mt-1 w-full rounded-md border border-c-border bg-c-surface px-2 py-1.5 text-xs text-c-text"
                            />
                          </label>
                          <label className="text-[11px] text-c-text-secondary">
                            {isPolish ? 'Wyjścia (po przecinku)' : 'Outputs (comma-separated)'}
                            <input
                              aria-label={`${isPolish ? 'Wyjścia' : 'Outputs'} ${step.lifecycleStage}`}
                              value={step.outputs.join(', ')}
                              onChange={(event) =>
                                updatePlanStep(
                                  stepIndex,
                                  'outputs',
                                  event.target.value
                                    .split(',')
                                    .map((value) => value.trim())
                                    .filter(Boolean)
                                )
                              }
                              className="mt-1 w-full rounded-md border border-c-border bg-c-surface px-2 py-1.5 text-xs text-c-text"
                            />
                          </label>
                          <label className="text-[11px] text-c-text-secondary">
                            {isPolish ? 'Właściciel' : 'Owner'}
                            <input
                              aria-label={`${isPolish ? 'Właściciel' : 'Owner'} ${step.lifecycleStage}`}
                              value={step.ownerRole}
                              onChange={(event) =>
                                updatePlanStep(stepIndex, 'ownerRole', event.target.value)
                              }
                              className="mt-1 w-full rounded-md border border-c-border bg-c-surface px-2 py-1.5 text-xs text-c-text"
                            />
                          </label>
                          <label className="text-[11px] text-c-text-secondary">
                            {isPolish ? 'Szacowany wysiłek' : 'Estimated effort'}
                            <input
                              aria-label={`${isPolish ? 'Szacowany wysiłek' : 'Estimated effort'} ${step.lifecycleStage}`}
                              value={step.estimatedEffort}
                              onChange={(event) =>
                                updatePlanStep(stepIndex, 'estimatedEffort', event.target.value)
                              }
                              className="mt-1 w-full rounded-md border border-c-border bg-c-surface px-2 py-1.5 text-xs text-c-text"
                            />
                          </label>
                          <label className="text-[11px] text-c-text-secondary">
                            {isPolish ? 'Klasa akceptacji' : 'Approval class'}
                            <select
                              aria-label={`${isPolish ? 'Klasa akceptacji' : 'Approval class'} ${step.lifecycleStage}`}
                              value={step.approvalClass}
                              onChange={(event) =>
                                updatePlanStep(
                                  stepIndex,
                                  'approvalClass',
                                  event.target.value as TransformationPlanStepDto['approvalClass']
                                )
                              }
                              className="mt-1 w-full rounded-md border border-c-border bg-c-surface px-2 py-1.5 text-xs text-c-text"
                            >
                              <option value="none">none</option>
                              <option value="policy_approvable">policy_approvable</option>
                              <option value="requires_human_approval">
                                requires_human_approval
                              </option>
                            </select>
                          </label>
                          <label className="text-[11px] text-c-text-secondary">
                            {isPolish ? 'Klasa ryzyka' : 'Risk class'}
                            <select
                              aria-label={`${isPolish ? 'Klasa ryzyka' : 'Risk class'} ${step.lifecycleStage}`}
                              value={step.riskClass}
                              onChange={(event) =>
                                updatePlanStep(
                                  stepIndex,
                                  'riskClass',
                                  event.target.value as TransformationPlanStepDto['riskClass']
                                )
                              }
                              className="mt-1 w-full rounded-md border border-c-border bg-c-surface px-2 py-1.5 text-xs text-c-text"
                            >
                              <option value="read_only">read_only</option>
                              <option value="safe_additive">safe_additive</option>
                              <option value="safe_update">safe_update</option>
                              <option value="sensitive_update">sensitive_update</option>
                              <option value="governance_transition">governance_transition</option>
                            </select>
                          </label>
                          <label className="text-[11px] text-c-text-secondary">
                            {isPolish ? 'Tryb wykonania' : 'Execution mode'}
                            <select
                              aria-label={`${isPolish ? 'Tryb wykonania' : 'Execution mode'} ${step.lifecycleStage}`}
                              value={step.executionMode}
                              onChange={(event) =>
                                updatePlanStep(
                                  stepIndex,
                                  'executionMode',
                                  event.target.value as TransformationPlanStepDto['executionMode']
                                )
                              }
                              className="mt-1 w-full rounded-md border border-c-border bg-c-surface px-2 py-1.5 text-xs text-c-text"
                            >
                              <option value="foreground">foreground</option>
                              <option value="background">background</option>
                              <option value="scheduled">scheduled</option>
                              <option value="human_activity">human_activity</option>
                            </select>
                          </label>
                        </div>
                        <p className="text-[11px] text-c-text-muted">
                          {step.lifecycleStage} · {step.capabilityStatus} · {step.blockerReason}
                        </p>
                        <label className="block text-[11px] text-c-text-secondary">
                          {isPolish
                            ? 'Zależności (etapy, po przecinku)'
                            : 'Dependencies (stages, comma-separated)'}
                          <input
                            aria-label={`${isPolish ? 'Zależności' : 'Dependencies'} ${step.lifecycleStage}`}
                            value={step.dependsOn.join(', ')}
                            onChange={(event) =>
                              updatePlanDependencies(stepIndex, event.target.value)
                            }
                            className="mt-1 w-full rounded-md border border-c-border bg-c-surface px-2 py-1.5 text-xs text-c-text"
                          />
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            aria-label={`${isPolish ? 'Przesuń w górę' : 'Move up'} ${step.lifecycleStage}`}
                            disabled={stepIndex === 0}
                            onClick={() => movePlanStep(stepIndex, -1)}
                            className="rounded border border-c-border px-2 py-1 text-xs disabled:opacity-40"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label={`${isPolish ? 'Przesuń w dół' : 'Move down'} ${step.lifecycleStage}`}
                            disabled={stepIndex === renderedSteps.length - 1}
                            onClick={() => movePlanStep(stepIndex, 1)}
                            className="rounded border border-c-border px-2 py-1 text-xs disabled:opacity-40"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            aria-label={`${isPolish ? 'Usuń krok' : 'Remove step'} ${step.lifecycleStage}`}
                            onClick={() => removePlanStep(stepIndex)}
                            className="rounded border border-c-danger/40 px-2 py-1 text-xs text-c-danger"
                          >
                            {isPolish ? 'Usuń' : 'Remove'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              {editableSteps ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={addPlanStep}
                    disabled={Boolean(stageAction)}
                    className="w-full rounded-lg border border-c-border px-3 py-2 text-xs font-semibold text-c-text disabled:opacity-50"
                  >
                    {isPolish ? 'Dodaj krok' : 'Add step'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void savePlanWorkshop()}
                    disabled={Boolean(stageAction)}
                    className="w-full rounded-lg border border-c-border-strong bg-c-surface-raised px-3 py-2 text-xs font-semibold text-c-text hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50"
                  >
                    {stageAction === 'save-plan-workshop'
                      ? isPolish
                        ? 'Zapisywanie nowej wersji…'
                        : 'Saving new version…'
                      : isPolish
                        ? 'Zapisz nową wersję planu'
                        : 'Save new plan version'}
                  </button>
                </div>
              ) : null}
              <div className="rounded-lg border border-c-border bg-c-surface p-3 text-xs text-c-text-secondary">
                {isPolish
                  ? 'Uruchomienie całego planu jest zablokowane, ponieważ wymagane adaptery downstream nie mają statusu REAL.'
                  : 'Running the full plan is blocked because required downstream adapters are not REAL.'}
              </div>
            </div>
          );
        }}
        renderPreviewFooter={() => {
          if (!selectedRow) return null;
          const cancelled = selectedRow.transformationCase.status === 'cancelled';
          return (
            <div className="grid grid-cols-2 gap-2">
              <PreviewActionButton
                variant="neutral"
                icon={RefreshCw}
                label={isPolish ? 'Odśwież' : 'Refresh'}
                onClick={() => void loadCases()}
              />
              <PreviewActionButton
                variant="positive"
                icon={PlayCircle}
                label={isPolish ? 'Uruchom (zablokowane)' : 'Run (blocked)'}
                onClick={() => undefined}
                disabled
              />
              {selectedRow.transformationCase.status === 'plan_proposed' ? (
                <PreviewActionButton
                  variant="positive"
                  label={
                    stageAction === 'approve-plan'
                      ? isPolish
                        ? 'Zatwierdzanie…'
                        : 'Approving…'
                      : isPolish
                        ? 'Zatwierdź plan'
                        : 'Approve plan'
                  }
                  onClick={() => void handleApprovePlan()}
                  disabled={Boolean(stageAction)}
                />
              ) : null}
              {selectedRow.transformationCase.status === 'plan_approved' &&
              ideasProposal === null ? (
                <PreviewActionButton
                  variant="positive"
                  label={
                    stageAction === 'propose-ideas'
                      ? isPolish
                        ? 'Przygotowywanie…'
                        : 'Preparing…'
                      : isPolish
                        ? 'Przygotuj listę idei'
                        : 'Prepare Ideas list'
                  }
                  onClick={() => void handleProposeIdeas()}
                  disabled={Boolean(stageAction)}
                />
              ) : null}
              {ideasProposal && ['pending_review', 'approved'].includes(ideasProposal.status) ? (
                <>
                  <PreviewActionButton
                    variant="positive"
                    label={
                      ideasProposal.status === 'approved'
                        ? isPolish
                          ? 'Wznów tworzenie Ideas'
                          : 'Resume Ideas materialization'
                        : isPolish
                          ? 'Zatwierdź i utwórz Ideas'
                          : 'Approve and create Ideas'
                    }
                    onClick={() => void handleReviewIdeas('approve')}
                    disabled={Boolean(stageAction)}
                  />
                  {ideasProposal.status === 'pending_review' && (
                    <PreviewActionButton
                      variant="warning"
                      label={isPolish ? 'Odrzuć propozycję' : 'Reject proposal'}
                      onClick={() => void handleReviewIdeas('reject')}
                      disabled={Boolean(stageAction)}
                    />
                  )}
                </>
              ) : null}
              {ideasProposal?.status === 'applied' && interviewsProposal === null ? (
                <PreviewActionButton
                  variant="positive"
                  label={isPolish ? 'Przygotuj plan Interview' : 'Prepare Interview plan'}
                  onClick={() => void handleProposeInterviews()}
                  disabled={
                    Boolean(stageAction) ||
                    !stakeholderUserId.trim() ||
                    !stakeholderRole.trim() ||
                    !stakeholderFocus.trim()
                  }
                />
              ) : null}
              {interviewsProposal &&
              ['pending_review', 'approved'].includes(interviewsProposal.status) ? (
                <>
                  <PreviewActionButton
                    variant="positive"
                    label={
                      interviewsProposal.status === 'approved'
                        ? isPolish
                          ? 'Wznów przypisanie Interview'
                          : 'Resume Interview assignment'
                        : isPolish
                          ? 'Zatwierdź i przypisz Interview'
                          : 'Approve and assign Interviews'
                    }
                    onClick={() => void handleReviewInterviews('approve')}
                    disabled={Boolean(stageAction)}
                  />
                  {interviewsProposal.status === 'pending_review' && (
                    <PreviewActionButton
                      variant="warning"
                      label={isPolish ? 'Odrzuć plan Interview' : 'Reject Interview plan'}
                      onClick={() => void handleReviewInterviews('reject')}
                      disabled={Boolean(stageAction)}
                    />
                  )}
                </>
              ) : null}
              {interviewsProposal?.status === 'applied' &&
              selectedRow.transformationCase.lifecycleStage === 'interviews' ? (
                <PreviewActionButton
                  variant="positive"
                  label={
                    isPolish ? 'Zaakceptuj wyniki i otwórz DRD' : 'Accept results and open DRD'
                  }
                  onClick={() => void handleAcceptInterviewResults()}
                  disabled={Boolean(stageAction) || !acceptedInsightIds.trim()}
                />
              ) : null}
              {selectedRow.transformationCase.lifecycleStage === 'drd' && drdProposal === null ? (
                <PreviewActionButton
                  variant="positive"
                  label={isPolish ? 'Przygotuj propozycję DRD' : 'Prepare DRD proposal'}
                  onClick={() => void handleProposeDrd()}
                  disabled={Boolean(stageAction) || !drdName.trim()}
                />
              ) : null}
              {drdProposal && ['pending_review', 'approved'].includes(drdProposal.status) ? (
                <>
                  <PreviewActionButton
                    variant="positive"
                    label={
                      drdProposal.status === 'approved'
                        ? isPolish
                          ? 'Wznów tworzenie DRD'
                          : 'Resume DRD materialization'
                        : isPolish
                          ? 'Zatwierdź i utwórz DRD'
                          : 'Approve and create DRD'
                    }
                    onClick={() => void handleReviewDrd('approve')}
                    disabled={Boolean(stageAction)}
                  />
                  {drdProposal.status === 'pending_review' && (
                    <PreviewActionButton
                      variant="warning"
                      label={isPolish ? 'Odrzuć propozycję DRD' : 'Reject DRD proposal'}
                      onClick={() => void handleReviewDrd('reject')}
                      disabled={Boolean(stageAction)}
                    />
                  )}
                </>
              ) : null}
              {drdProposal?.status === 'applied' &&
              selectedRow.transformationCase.lifecycleStage === 'drd' ? (
                <PreviewActionButton
                  variant="positive"
                  label={isPolish ? 'Przyjmij wynik DRD' : 'Accept DRD result'}
                  onClick={() => void handleAcceptDrdResults()}
                  disabled={Boolean(stageAction) || !drdProposal.assessmentId}
                />
              ) : null}
              {selectedRow.transformationCase.lifecycleStage === 'opportunity_synthesis' &&
              synthesisProposal === null ? (
                <PreviewActionButton
                  variant="positive"
                  label={isPolish ? 'Przygotuj syntezę szans' : 'Prepare opportunity synthesis'}
                  onClick={() => void handleProposeSynthesis()}
                  disabled={Boolean(stageAction)}
                />
              ) : null}
              {synthesisProposal &&
              ['pending_review', 'approved'].includes(synthesisProposal.status) ? (
                <>
                  <PreviewActionButton
                    variant="positive"
                    label={
                      synthesisProposal.status === 'approved'
                        ? isPolish
                          ? 'Wznów tworzenie Candidate'
                          : 'Resume Candidate materialization'
                        : isPolish
                          ? 'Zatwierdź i utwórz Candidate'
                          : 'Approve and create Candidate'
                    }
                    onClick={() => void handleReviewSynthesis('approve')}
                    disabled={Boolean(stageAction)}
                  />
                  {synthesisProposal.status === 'pending_review' && (
                    <PreviewActionButton
                      variant="warning"
                      label={isPolish ? 'Odrzuć syntezę' : 'Reject synthesis'}
                      onClick={() => void handleReviewSynthesis('reject')}
                      disabled={Boolean(stageAction)}
                    />
                  )}
                </>
              ) : null}
              {synthesisProposal?.status === 'applied' &&
              selectedRow.transformationCase.lifecycleStage === 'initiative_candidates' ? (
                <PreviewActionButton
                  variant="positive"
                  label={
                    isPolish ? 'Zweryfikuj zaakceptowaną Initiative' : 'Verify accepted Initiative'
                  }
                  onClick={() => void handleAcceptInitiativeResults()}
                  disabled={Boolean(stageAction) || !synthesisProposal.candidateId}
                />
              ) : null}
              {selectedRow.transformationCase.lifecycleStage === 'finance_kpi' &&
              financeProposal === null ? (
                <PreviewActionButton
                  variant="positive"
                  label={isPolish ? 'Policz Finance i KPI' : 'Calculate Finance and KPI'}
                  onClick={() => void handleProposeFinance()}
                  disabled={Boolean(stageAction)}
                />
              ) : null}
              {financeProposal &&
              ['pending_review', 'approved'].includes(financeProposal.status) ? (
                <>
                  <PreviewActionButton
                    variant="positive"
                    label={
                      financeProposal.status === 'approved'
                        ? isPolish
                          ? 'Wznów Finance i KPI'
                          : 'Resume Finance and KPI'
                        : isPolish
                          ? 'Zatwierdź Finance i KPI'
                          : 'Approve Finance and KPI'
                    }
                    onClick={() => void handleReviewFinance('approve')}
                    disabled={Boolean(stageAction)}
                  />
                  {financeProposal.status === 'pending_review' && (
                    <PreviewActionButton
                      variant="warning"
                      label={isPolish ? 'Odrzuć Finance i KPI' : 'Reject Finance and KPI'}
                      onClick={() => void handleReviewFinance('reject')}
                      disabled={Boolean(stageAction)}
                    />
                  )}
                </>
              ) : null}
              {financeProposal?.status === 'applied' &&
              selectedRow.transformationCase.lifecycleStage === 'finance_kpi' ? (
                <PreviewActionButton
                  variant="positive"
                  label={isPolish ? 'Zweryfikuj zatwierdzoną analizę' : 'Verify approved analysis'}
                  onClick={() => void handleAcceptFinance()}
                  disabled={
                    Boolean(stageAction) ||
                    !financeProposal.financialAnalysisId ||
                    !financeProposal.kpiId
                  }
                />
              ) : null}
              {selectedRow.transformationCase.lifecycleStage === 'portfolio_decision' &&
              portfolioProposal === null ? (
                <PreviewActionButton
                  variant="positive"
                  label={isPolish ? 'Przygotuj decyzję GO/NO-GO' : 'Prepare GO/NO-GO decision'}
                  onClick={() => void handleProposePortfolio()}
                  disabled={Boolean(stageAction) || !decisionMakerId.trim()}
                />
              ) : null}
              {portfolioProposal &&
              ['pending_review', 'approved'].includes(portfolioProposal.status) ? (
                <>
                  <PreviewActionButton
                    variant="positive"
                    label={
                      portfolioProposal.status === 'approved'
                        ? isPolish
                          ? 'Wznów tworzenie decyzji'
                          : 'Resume decision materialization'
                        : isPolish
                          ? 'Zatwierdź i utwórz decyzję'
                          : 'Approve and create decision'
                    }
                    onClick={() => void handleReviewPortfolio('approve')}
                    disabled={Boolean(stageAction)}
                  />
                  {portfolioProposal.status === 'pending_review' && (
                    <PreviewActionButton
                      variant="warning"
                      label={isPolish ? 'Odrzuć pakiet decyzji' : 'Reject decision packet'}
                      onClick={() => void handleReviewPortfolio('reject')}
                      disabled={Boolean(stageAction)}
                    />
                  )}
                </>
              ) : null}
              {portfolioProposal?.status === 'applied' &&
              selectedRow.transformationCase.lifecycleStage === 'portfolio_decision' ? (
                <PreviewActionButton
                  variant="positive"
                  label={
                    isPolish
                      ? 'Zweryfikuj GO i APPROVED Initiative'
                      : 'Verify GO and APPROVED Initiative'
                  }
                  onClick={() => void handleAcceptPortfolio()}
                  disabled={Boolean(stageAction) || !portfolioProposal.decisionId}
                />
              ) : null}
              {selectedRow.transformationCase.lifecycleStage === 'mobilization' &&
              mobilizationProposal === null ? (
                <PreviewActionButton
                  variant="positive"
                  label={isPolish ? 'Przygotuj mobilizację' : 'Prepare mobilization'}
                  onClick={() => void handleProposeMobilization()}
                  disabled={Boolean(stageAction) || !mobilizationInputs.ownerUserId.trim()}
                />
              ) : null}
              {mobilizationProposal &&
              ['pending_review', 'approved'].includes(mobilizationProposal.status) ? (
                <>
                  <PreviewActionButton
                    variant="positive"
                    label={
                      mobilizationProposal.status === 'approved'
                        ? isPolish
                          ? 'Wznów tworzenie planu wykonania'
                          : 'Resume execution-plan materialization'
                        : isPolish
                          ? 'Zatwierdź i utwórz plan wykonania'
                          : 'Approve and create execution plan'
                    }
                    onClick={() => void handleReviewMobilization('approve')}
                    disabled={Boolean(stageAction)}
                  />
                  {mobilizationProposal.status === 'pending_review' && (
                    <PreviewActionButton
                      variant="warning"
                      label={isPolish ? 'Odrzuć mobilizację' : 'Reject mobilization'}
                      onClick={() => void handleReviewMobilization('reject')}
                      disabled={Boolean(stageAction)}
                    />
                  )}
                </>
              ) : null}
              {mobilizationProposal?.status === 'applied' &&
              selectedRow.transformationCase.lifecycleStage === 'mobilization' ? (
                <PreviewActionButton
                  variant="positive"
                  label={
                    isPolish ? 'Zweryfikuj SCHEDULED Initiative' : 'Verify SCHEDULED Initiative'
                  }
                  onClick={() => void handleAcceptMobilization()}
                  disabled={Boolean(stageAction) || !mobilizationProposal.blueprintId}
                />
              ) : null}
              {selectedRow.transformationCase.lifecycleStage === 'execution' ? (
                <PreviewActionButton
                  variant="neutral"
                  icon={RefreshCw}
                  label={isPolish ? 'Odśwież wykonanie' : 'Refresh execution'}
                  onClick={() => void refreshExecution()}
                  disabled={Boolean(stageAction)}
                />
              ) : null}
              {selectedRow.transformationCase.lifecycleStage === 'execution' &&
              executionCheckpoint &&
              !executionCheckpoint.executionStarted ? (
                <PreviewActionButton
                  variant="positive"
                  label={isPolish ? 'Przyjmij start wykonania' : 'Accept execution start'}
                  onClick={() => void handleAcceptExecutionStart()}
                  disabled={
                    Boolean(stageAction) || executionCheckpoint.initiativeStatus !== 'EXECUTING'
                  }
                />
              ) : null}
              {selectedRow.transformationCase.lifecycleStage === 'final_outputs' ? (
                <>
                  <PreviewActionButton
                    variant="neutral"
                    label={
                      stageAction === 'prepare-final-output-publication'
                        ? isPolish
                          ? 'Przygotowywanie zgody…'
                          : 'Preparing approval…'
                        : finalOutputPublication
                          ? isPolish
                            ? 'Odśwież zgodę publikacji'
                            : 'Refresh publication approval'
                          : isPolish
                            ? 'Przygotuj publikację'
                            : 'Prepare publication'
                    }
                    onClick={() => void handlePrepareFinalOutputPublication()}
                    disabled={Boolean(stageAction)}
                    ariaBusy={stageAction === 'prepare-final-output-publication'}
                  />
                  <PreviewActionButton
                    variant="positive"
                    label={
                      finalOutputRun
                        ? isPolish
                          ? 'Odtwórz końcowy Word + PowerPoint'
                          : 'Regenerate final Word + PowerPoint'
                        : isPolish
                          ? 'Wygeneruj końcowy Word + PowerPoint'
                          : 'Generate final Word + PowerPoint'
                    }
                    onClick={() => void handleGenerateFinalOutputs()}
                    disabled={Boolean(stageAction) || !finalPublicationExecutable}
                    ariaBusy={stageAction === 'generate-final-outputs'}
                    ariaDescribedBy={`final-publication-state-${selectedRow.id}`}
                  />
                </>
              ) : null}
              {selectedRow.transformationCase.lifecycleStage === 'delivery' ? (
                <PreviewActionButton
                  variant="neutral"
                  icon={RefreshCw}
                  label={isPolish ? 'Odśwież korzyści' : 'Refresh benefits'}
                  onClick={() => void refreshBenefits()}
                  disabled={Boolean(stageAction)}
                />
              ) : null}
              {selectedRow.transformationCase.lifecycleStage === 'delivery' &&
              benefitsCheckpoint ? (
                <PreviewActionButton
                  variant="positive"
                  label={isPolish ? 'Przyjmij odbiór korzyści' : 'Accept benefits handoff'}
                  onClick={() => void handleAcceptDeliveryHandoff()}
                  disabled={
                    Boolean(stageAction) ||
                    benefitsCheckpoint.benefits.total < 1 ||
                    benefitsCheckpoint.benefits.measured !== benefitsCheckpoint.benefits.total ||
                    benefitsCheckpoint.benefits.owned !== benefitsCheckpoint.benefits.total ||
                    benefitsCheckpoint.financeActuals.verified !==
                      benefitsCheckpoint.financeActuals.total
                  }
                />
              ) : null}
              {selectedRow.transformationCase.lifecycleStage === 'benefits' ? (
                <PreviewActionButton
                  variant="positive"
                  label={isPolish ? 'Zweryfikuj osiągnięte korzyści' : 'Verify achieved benefits'}
                  onClick={() => void handleAcceptBenefitsReview()}
                  disabled={Boolean(stageAction)}
                />
              ) : null}
              {selectedRow.transformationCase.lifecycleStage === 'sustainability' ? (
                <PreviewActionButton
                  variant="neutral"
                  icon={RefreshCw}
                  label={isPolish ? 'Odśwież trwałość' : 'Refresh sustainability'}
                  onClick={() => void refreshSustainability()}
                  disabled={Boolean(stageAction)}
                />
              ) : null}
              {selectedRow.transformationCase.lifecycleStage === 'sustainability' &&
              sustainabilityCheckpoint ? (
                <>
                  <PreviewActionButton
                    variant="positive"
                    label={isPolish ? 'Potwierdź trwały efekt' : 'Confirm sustained outcome'}
                    onClick={() => void handleSustainabilityReview('sustained')}
                    disabled={
                      Boolean(stageAction) ||
                      sustainabilityCheckpoint.benefits.total < 1 ||
                      sustainabilityCheckpoint.benefits.sustainedAcrossWindow !==
                        sustainabilityCheckpoint.benefits.total
                    }
                  />
                  <PreviewActionButton
                    variant="warning"
                    label={isPolish ? 'Uruchom korektę' : 'Start corrective continuation'}
                    onClick={() => void handleSustainabilityReview('corrective_continuation')}
                    disabled={Boolean(stageAction)}
                  />
                </>
              ) : null}
              {selectedRow.transformationCase.lifecycleStage === 'execution' &&
              executionCheckpoint?.executionStarted ? (
                <PreviewActionButton
                  variant="positive"
                  label={isPolish ? 'Przyjmij wynik wykonania' : 'Accept execution results'}
                  onClick={() => void handleAcceptExecutionResults()}
                  disabled={
                    Boolean(stageAction) ||
                    executionCheckpoint.initiativeStatus !== 'DONE' ||
                    executionCheckpoint.tasks.completed !== executionCheckpoint.tasks.total ||
                    executionCheckpoint.milestones.completed !==
                      executionCheckpoint.milestones.total
                  }
                />
              ) : null}
              {!cancelled ? (
                <PreviewActionButton
                  variant="destructive"
                  icon={Ban}
                  label={
                    cancelling
                      ? isPolish
                        ? 'Anulowanie…'
                        : 'Cancelling…'
                      : isPolish
                        ? 'Anuluj plan'
                        : 'Cancel plan'
                  }
                  onClick={() => void handleCancel()}
                  disabled={cancelling}
                />
              ) : null}
            </div>
          );
        }}
      >
        <div className="p-4 pt-3">
          <StandardTable
            columns={columns}
            data={rows}
            selectedRowId={selectedId}
            onRowClick={(row) => selectCase(String(row.id))}
          />
        </div>
      </TableWithPreviewLayout>
    </section>
  );
};

export default TransformationCasesPanel;
