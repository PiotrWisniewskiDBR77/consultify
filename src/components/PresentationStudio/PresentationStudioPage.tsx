/**
 * PresentationStudioPage (Sprints S5 + S7)
 *
 * Module: Consultify Presentation Studio.
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - DRD/UI_UX_SOURCE_OF_TRUTH.md
 *   - DRD/consultify/docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md
 *   - DRD/consultify/docs/ui-standards/CONSULTIFY_UI_UX_OPERATING_STANDARD.md
 *
 * Studio surface that consumes the four S1..S4 preview endpoints plus the
 * S6 approval-gated generate endpoints. The page is read-only by default;
 * the only mutating actions are gated by an explicit two-step flow:
 *   1. `Request approval` mints a single-use ticket (server validates
 *      `wouldGenerate.canProceed`). Visible only on a healthy preview.
 *   2. `Confirm generate` redeems the ticket; on success the deck is
 *      persisted (server-side) and the audit event
 *      `presentation_generated_via_studio` is emitted.
 *
 * UI/UX governance:
 *   - All contextual AI actions ("Run preview", "Request approval",
 *     "Confirm generate") live on the right side of the local Menu 3
 *     command row per `.cursor/rules/ai-actions-menu3.mdc`. This page does
 *     not yet adopt the full ModuleHub shell, so the local command row
 *     stands in for `commandRowRightContent`. Adopting the full ModuleHub
 *     shell will be a separate sprint.
 *   - Status semantics use the canonical color map (slate/blue/amber/
 *     emerald/rose; primary reserved for selection/CTA).
 *   - Loading, success, error, empty, and degraded states are all rendered
 *     honestly. No fake success, no infinite spinner, no hidden writes.
 *   - Approval failures (`PRECONDITION_NOT_MET`) and ticket rejections
 *     (`INVALID_APPROVAL_TICKET` with typed reason) are surfaced in
 *     dedicated banners, never silently swallowed.
 */

import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ExecuteGenerateResponse,
  GeneratePreviewResponse,
  NarrativePlanPreviewResponse,
  PresentationStudioApi,
  PresentationStudioApiError,
  PresentationStudioApprovalTicket,
  PresentationStudioSetupInput,
  PresentationStudioSourceArtifactItem,
  PresentationStudioSourceArtifactList,
  SourcePackPreviewResponse,
  TemplatePlanPreviewResponse,
} from '@/services/api/presentationStudio.api';

import { PresentationStudioLayoutAuditBanner } from './PresentationStudioLayoutAuditBanner';
import { PresentationStudioLayoutCapacityAdminPanel } from './PresentationStudioLayoutCapacityAdminPanel';
import {
  PRESENTATION_STUDIO_SETUP_FORM_DEFAULT,
  PresentationStudioSetupForm,
  PresentationStudioSetupFormValue,
  validatePresentationStudioSetupForm,
} from './PresentationStudioSetupForm';
import { PresentationStudioSourceArtifactPicker } from './PresentationStudioSourceArtifactPicker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PreviewState {
  loading: boolean;
  error: string | null;
  sourcePack: SourcePackPreviewResponse | null;
  narrativePlan: NarrativePlanPreviewResponse | null;
  templatePlan: TemplatePlanPreviewResponse | null;
  generate: GeneratePreviewResponse | null;
}

interface SourceArtifactsState {
  loading: boolean;
  error: string | null;
  list: PresentationStudioSourceArtifactList | null;
  selectedIds: string[];
}

const INITIAL_SOURCE_ARTIFACTS_STATE: SourceArtifactsState = {
  loading: false,
  error: null,
  list: null,
  selectedIds: [],
};

interface ApprovalState {
  /** Currently held single-use ticket. Null when none has been minted (or after redemption / expiry / rejection). */
  ticket: PresentationStudioApprovalTicket | null;
  /** Truthy while either CTA (request-approval / confirm-generate) is in flight. */
  pending: 'requesting' | 'executing' | null;
  /** Honest banner shown when /request-approval returns 412 PRECONDITION_NOT_MET. Cleared on next attempt. */
  approvalErrorReason: string | null;
  /** Honest banner shown when /generate returns 403 INVALID_APPROVAL_TICKET. Cleared on next attempt. */
  ticketRejectionReason: string | null;
  /** Successfully generated deck info, surfaced after /generate returns 200. */
  generated: ExecuteGenerateResponse | null;
}

const INITIAL_STATE: PreviewState = {
  loading: false,
  error: null,
  sourcePack: null,
  narrativePlan: null,
  templatePlan: null,
  generate: null,
};

const INITIAL_APPROVAL_STATE: ApprovalState = {
  ticket: null,
  pending: null,
  approvalErrorReason: null,
  ticketRejectionReason: null,
  generated: null,
};

/**
 * Human-readable labels for the typed `INVALID_APPROVAL_TICKET` reasons
 * surfaced by the backend. Defensive default ('Unknown reason') keeps the UI
 * honest when the server adds a new reason before the client is updated.
 */
const TICKET_REJECTION_LABELS: Record<string, string> = {
  not_found: 'Ticket not found.',
  expired: 'Ticket expired before confirmation.',
  consumed: 'Ticket has already been used.',
  tenant_mismatch: 'Ticket was issued for a different organization.',
  user_mismatch: 'Ticket was issued for a different user.',
  payload_mismatch:
    'Setup changed since the ticket was issued. Re-run preview and request a new approval.',
};

function formatTicketRejection(reason: string | null | undefined): string {
  if (!reason) return 'Approval ticket was rejected.';
  return TICKET_REJECTION_LABELS[reason] || `Approval ticket rejected: ${reason}`;
}

/**
 * Static, governance-aware extras the form does NOT yet expose. Audited as
 * intentionally constant for the Studio surface; theme and confidentiality
 * controls land in a future sprint without touching the approval flow
 * contract. (S9 replaced the demo source artifact with the real
 * tenant-scoped picker, so `sourceArtifacts` is no longer hard-coded here.)
 */
const SETUP_NON_FORM_EXTRAS: Pick<PresentationStudioSetupInput, 'theme' | 'confidentiality'> = {
  theme: 'corporate',
  confidentiality: 'internal',
};

/**
 * Project the form value plus the user-selected source artifacts into the
 * API setup shape. We intentionally do NOT inject any default artifact
 * when the user has selected nothing — the source pack preview will then
 * render an honest empty / degraded state instead of a synthetic "ready".
 */
function buildSetupFromForm(
  form: PresentationStudioSetupFormValue,
  selectedArtifacts: PresentationStudioSourceArtifactItem[]
): PresentationStudioSetupInput {
  const sourceArtifacts = selectedArtifacts.map((artifact) => {
    const projected: Record<string, unknown> = {
      type: artifact.type,
      id: artifact.id,
      label: artifact.label,
      readiness: artifact.readiness,
    };
    if (artifact.confidence != null) {
      projected.confidence = artifact.confidence;
    }
    return projected;
  });
  return {
    title: form.title.trim(),
    audience: form.audience,
    goal: form.goal,
    language: form.language,
    deckType: form.deckType,
    ...SETUP_NON_FORM_EXTRAS,
    sourceArtifacts,
  };
}

// ---------------------------------------------------------------------------
// Reusable status badge using canonical color semantics
// ---------------------------------------------------------------------------

type StatusTone = 'slate' | 'blue' | 'amber' | 'emerald' | 'rose';

interface StatusBadgeProps {
  tone: StatusTone;
  label: string;
  icon?: React.ReactNode;
}

function StatusBadge({ tone, label, icon }: StatusBadgeProps): React.ReactElement {
  const TONE_CLASS: Record<StatusTone, string> = {
    slate: 'bg-c-surface-raised text-c-text-secondary',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    rose: 'bg-danger-100 text-danger-700 dark:bg-danger-900/40 dark:text-danger-300',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}
      data-testid="status-badge"
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section card primitive
// ---------------------------------------------------------------------------

interface SectionCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
  testId?: string;
}

function SectionCard({
  title,
  description,
  children,
  badge,
  testId,
}: SectionCardProps): React.ReactElement {
  return (
    <section
      className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-sm"
      data-testid={testId}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-c-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-c-text">{title}</h2>
          <p className="mt-1 text-sm text-c-text-secondary">{description}</p>
        </div>
        {badge ? <div className="flex shrink-0 items-center">{badge}</div> : null}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tone helpers
// ---------------------------------------------------------------------------

function toneForSourcePackStatus(status?: string): StatusTone {
  if (status === 'ready') return 'emerald';
  if (status === 'partial') return 'amber';
  return 'slate';
}

function toneForNarrativeStatus(status?: string): StatusTone {
  if (status === 'ready') return 'emerald';
  if (status === 'needs_sources') return 'amber';
  return 'slate';
}

function toneForTemplateStatus(status?: string): StatusTone {
  if (status === 'ready_for_review') return 'blue';
  if (status === 'draft') return 'amber';
  if (status === 'needs_sources') return 'rose';
  return 'slate';
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export const PresentationStudioPage: React.FC = () => {
  const [formValue, setFormValue] = useState<PresentationStudioSetupFormValue>(
    PRESENTATION_STUDIO_SETUP_FORM_DEFAULT
  );
  const [showFormErrors, setShowFormErrors] = useState<boolean>(false);
  const [state, setState] = useState<PreviewState>(INITIAL_STATE);
  const [approval, setApproval] = useState<ApprovalState>(INITIAL_APPROVAL_STATE);
  const [sourceArtifactsState, setSourceArtifactsState] = useState<SourceArtifactsState>(
    INITIAL_SOURCE_ARTIFACTS_STATE
  );
  // Tick state used purely to drive the ticket TTL countdown re-render.
  // The numeric value is intentionally read by the countdown memos below so
  // the linter sees a real dependency, not a hidden `Date.now()` side effect.
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const formErrors = useMemo(() => validatePresentationStudioSetupForm(formValue), [formValue]);
  const formIsValid = Object.keys(formErrors).length === 0;

  const selectedArtifacts = useMemo<PresentationStudioSourceArtifactItem[]>(() => {
    const all = sourceArtifactsState.list?.artifacts ?? [];
    const selected = new Set(sourceArtifactsState.selectedIds);
    return all.filter((a) => selected.has(a.id));
  }, [sourceArtifactsState.list, sourceArtifactsState.selectedIds]);

  const setup = useMemo(
    () => buildSetupFromForm(formValue, selectedArtifacts),
    [formValue, selectedArtifacts]
  );

  /**
   * Setup form changes invalidate any in-flight approval flow because the
   * ticket fingerprint commits to the exact payload at request-approval
   * time. We clear the ticket eagerly on change so the user does not click
   * Confirm-generate against a stale ticket and trip a server-side
   * payload_mismatch round-trip. Banners are also cleared so the canvas
   * reflects the freshly-edited setup.
   */
  const handleFormChange = useCallback((next: PresentationStudioSetupFormValue) => {
    setFormValue(next);
    setApproval(INITIAL_APPROVAL_STATE);
  }, []);

  /**
   * Source picker selection changes also invalidate any in-flight ticket —
   * `sourceArtifacts` is part of the canonical fingerprint payload, so a
   * fresh selection requires a fresh ticket. We do NOT auto-rerun the
   * preview; the user clicks Run preview again to refresh source / narrative
   * / template / generate cards against the new selection.
   */
  const handleSourceSelectionChange = useCallback((nextIds: string[]) => {
    setSourceArtifactsState((prev) => ({ ...prev, selectedIds: nextIds }));
    setApproval(INITIAL_APPROVAL_STATE);
  }, []);

  const reloadSourceArtifacts = useCallback(async () => {
    setSourceArtifactsState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const list = await PresentationStudioApi.listSourceArtifacts();
      setSourceArtifactsState((prev) => {
        // Drop any selected ids that are no longer in the freshly-loaded
        // list so the picker never claims to "select" a missing artifact.
        const validIds = new Set(list.artifacts.map((a) => a.id));
        const selectedIds = prev.selectedIds.filter((id) => validIds.has(id));
        return { loading: false, error: null, list, selectedIds };
      });
    } catch (error) {
      setSourceArtifactsState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error loading source artifacts.',
      }));
    }
  }, []);

  // Initial fetch on mount. Subsequent reloads are user-driven via the
  // picker's reload button.
  useEffect(() => {
    void reloadSourceArtifacts();
  }, [reloadSourceArtifacts]);

  const runPreview = useCallback(async () => {
    if (!formIsValid) {
      setShowFormErrors(true);
      return;
    }
    setShowFormErrors(false);
    setState((prev) => ({ ...prev, loading: true, error: null }));
    // Re-running the preview invalidates any in-flight approval flow: the
    // ticket is fingerprinted against the previous payload and a new run may
    // produce a different fingerprint. Clear the ticket and any banners.
    setApproval(INITIAL_APPROVAL_STATE);
    try {
      const [sourcePack, narrativePlan, templatePlan, generate] = await Promise.all([
        PresentationStudioApi.previewSourcePack(setup),
        PresentationStudioApi.previewNarrativePlan({ setup }),
        PresentationStudioApi.previewTemplatePlan({ setup }),
        PresentationStudioApi.previewGenerate({ setup }),
      ]);
      setState({
        loading: false,
        error: null,
        sourcePack,
        narrativePlan,
        templatePlan,
        generate,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error running Studio preview.',
      }));
    }
  }, [formIsValid, setup]);

  const requestApproval = useCallback(async () => {
    setApproval((prev) => ({
      ...prev,
      pending: 'requesting',
      approvalErrorReason: null,
      ticketRejectionReason: null,
      generated: null,
    }));
    try {
      const result = await PresentationStudioApi.requestApproval({ setup });
      setApproval({
        ticket: result.ticket,
        pending: null,
        approvalErrorReason: null,
        ticketRejectionReason: null,
        generated: null,
      });
    } catch (error) {
      const reason =
        error instanceof PresentationStudioApiError
          ? error.code === 'PRECONDITION_NOT_MET'
            ? error.preview?.wouldGenerate.blockingReasons[0] ||
              'Generation preview blocks approval.'
            : error.message
          : error instanceof Error
            ? error.message
            : 'Unknown error requesting approval.';
      setApproval((prev) => ({
        ...prev,
        pending: null,
        ticket: null,
        approvalErrorReason: reason,
      }));
    }
  }, [setup]);

  const confirmGenerate = useCallback(async () => {
    if (!approval.ticket) return;
    setApproval((prev) => ({
      ...prev,
      pending: 'executing',
      ticketRejectionReason: null,
    }));
    try {
      const result = await PresentationStudioApi.executeGenerate({
        setup,
        approvalTicket: approval.ticket.ticketId,
      });
      setApproval((prev) => ({
        ...prev,
        pending: null,
        ticket: null, // single-use; clear once redeemed
        ticketRejectionReason: null,
        generated: result,
      }));
    } catch (error) {
      const isApi = error instanceof PresentationStudioApiError;
      setApproval((prev) => ({
        ...prev,
        pending: null,
        ticket: null, // any rejection invalidates the ticket
        ticketRejectionReason: isApi
          ? error.code === 'INVALID_APPROVAL_TICKET'
            ? formatTicketRejection(error.reason)
            : error.message
          : error instanceof Error
            ? error.message
            : 'Unknown error confirming generation.',
      }));
    }
  }, [approval.ticket, setup]);

  // 1 Hz tick to refresh the visible TTL countdown on the ticket badge.
  // Only mounts the interval while a ticket exists.
  useEffect(() => {
    if (!approval.ticket) return undefined;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [approval.ticket]);

  const ticketCountdownLabel = useMemo<string | null>(() => {
    if (!approval.ticket) return null;
    const remainingMs = Date.parse(approval.ticket.expiresAt) - nowTick;
    if (remainingMs <= 0) return 'expired';
    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }, [approval.ticket, nowTick]);

  const ticketLooksFresh = useMemo<boolean>(() => {
    if (!approval.ticket) return false;
    return Date.parse(approval.ticket.expiresAt) - nowTick > 0;
  }, [approval.ticket, nowTick]);

  const canRequestApproval =
    state.generate?.wouldGenerate.canProceed === true &&
    !approval.pending &&
    !approval.ticket &&
    !approval.generated;

  const canConfirmGenerate =
    !!approval.ticket && ticketLooksFresh && approval.pending !== 'executing';

  const isEmpty =
    !state.sourcePack && !state.narrativePlan && !state.templatePlan && !state.generate;

  // Stable display fields built off current state. Memoized so re-renders
  // from local state do not recompute these on every paint.
  const summary = useMemo(() => {
    return {
      sourcePackStatus: state.sourcePack?.sourcePack.status ?? null,
      narrativeStatus: state.narrativePlan?.narrativePlan.status ?? null,
      templateStatus: state.templatePlan?.templatePlan.status ?? null,
      canProceed: state.generate?.wouldGenerate.canProceed ?? null,
    };
  }, [state]);

  return (
    <div className="min-h-screen bg-c-bg" data-testid="presentation-studio-page">
      {/* Local Menu 3 / command row. Per the AI-actions-menu3 rule, the
          contextual AI action ("Run preview") MUST live on the right side of
          the local command row, not inside the canvas. Command-row hierarchy
          (editor-shell-canon § 2 STREFA GÓRNA): secondary actions (Run
          preview · Request approval) sit left of the primary accent action
          (Confirm generate). Uses the canonical `z-sticky` token, not raw
          z-index (canon § 3 z-index scale). */}
      <header
        className="sticky top-0 z-sticky border-b border-c-border bg-c-surface/90 backdrop-blur-sm"
        data-testid="presentation-studio-command-row"
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-c-text-muted">
              Presentation Studio
            </p>
            <h1 className="truncate text-base font-semibold text-c-text">Studio preview surface</h1>
          </div>
          <div
            className="flex shrink-0 items-center gap-2"
            data-testid="presentation-studio-command-row-right"
          >
            <button
              type="button"
              onClick={runPreview}
              disabled={state.loading}
              className="inline-flex items-center gap-2 rounded-full border border-c-border bg-c-surface px-3.5 py-1.5 text-sm font-medium text-c-text-secondary shadow-sm transition-colors hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-70"
              data-testid="presentation-studio-run-preview"
            >
              {state.loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{state.loading ? 'Running preview…' : 'Run preview'}</span>
            </button>

            {canRequestApproval ? (
              <button
                type="button"
                onClick={requestApproval}
                disabled={approval.pending !== null}
                className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-sm font-medium text-amber-800 shadow-sm transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40"
                data-testid="presentation-studio-request-approval"
              >
                {approval.pending === 'requesting' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                )}
                <span>
                  {approval.pending === 'requesting' ? 'Requesting approval…' : 'Request approval'}
                </span>
              </button>
            ) : null}

            {approval.ticket ? (
              <span aria-hidden="true" className="mx-1 h-5 w-px self-center bg-c-border" />
            ) : null}

            {approval.ticket ? (
              <button
                type="button"
                onClick={confirmGenerate}
                disabled={!canConfirmGenerate}
                className="inline-flex items-center gap-2 rounded-full bg-c-accent px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-c-accent disabled:cursor-not-allowed disabled:opacity-70"
                data-testid="presentation-studio-confirm-generate"
              >
                {approval.pending === 'executing' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                )}
                <span data-testid="presentation-studio-confirm-generate-label">
                  {approval.pending === 'executing'
                    ? 'Generating…'
                    : ticketCountdownLabel === 'expired'
                      ? 'Ticket expired'
                      : `Confirm generate · ${ticketCountdownLabel}`}
                </span>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-4 px-6 py-6">
        <PresentationStudioSetupForm
          value={formValue}
          onChange={handleFormChange}
          showErrors={showFormErrors}
          disabled={state.loading || approval.pending !== null}
        />

        <PresentationStudioSourceArtifactPicker
          list={sourceArtifactsState.list}
          loading={sourceArtifactsState.loading}
          error={sourceArtifactsState.error}
          selectedIds={sourceArtifactsState.selectedIds}
          onSelectionChange={handleSourceSelectionChange}
          onReload={reloadSourceArtifacts}
          disabled={state.loading || approval.pending !== null}
        />

        {showFormErrors && !formIsValid ? (
          <div
            className="flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-900/60 dark:bg-danger-900/40 dark:text-danger-300"
            role="alert"
            data-testid="presentation-studio-form-error"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <div className="font-medium">Setup is incomplete</div>
              <div className="mt-1">
                Fix the highlighted required fields above before running a Studio preview. No silent
                defaults are applied.
              </div>
            </div>
          </div>
        ) : null}

        {state.error ? (
          <div
            className="flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-900/60 dark:bg-danger-900/40 dark:text-danger-300"
            role="alert"
            data-testid="presentation-studio-error"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <div className="font-medium">Studio preview failed</div>
              <div className="mt-1">{state.error}</div>
            </div>
          </div>
        ) : null}

        {approval.approvalErrorReason ? (
          <div
            className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
            role="alert"
            data-testid="presentation-studio-approval-error"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <div className="font-medium">Approval cannot be requested yet</div>
              <div className="mt-1">{approval.approvalErrorReason}</div>
            </div>
          </div>
        ) : null}

        {approval.ticketRejectionReason ? (
          <div
            className="flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-900/60 dark:bg-danger-900/40 dark:text-danger-300"
            role="alert"
            data-testid="presentation-studio-ticket-error"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <div className="font-medium">Approval ticket rejected</div>
              <div className="mt-1">{approval.ticketRejectionReason}</div>
            </div>
          </div>
        ) : null}

        {approval.generated ? (
          <div
            className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
            role="status"
            data-testid="presentation-studio-generated"
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">Deck generated and audited</div>
              <div className="mt-1">
                Deck id{' '}
                <span
                  className="font-mono text-emerald-900 dark:text-emerald-100"
                  data-testid="presentation-studio-generated-deck-id"
                >
                  {approval.generated.deckId}
                </span>{' '}
                · {approval.generated.slideCount} slides ·{' '}
                <span className="font-mono text-xs text-emerald-700 dark:text-emerald-300">
                  audit:{approval.generated.auditEvent}
                </span>
              </div>
              {approval.generated.validationWarnings.length > 0 ? (
                <ul
                  className="mt-2 list-disc space-y-0.5 pl-5 text-emerald-900 dark:text-emerald-100"
                  data-testid="presentation-studio-generated-warnings"
                >
                  {approval.generated.validationWarnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Sprint S11: pre-flight layout audit banner. Advisory only,
            never blocks generation. Sits canvas-side with other status
            banners so it stays visually adjacent to the Generate CTA in
            Menu 3 without violating the AI-actions-in-Menu-3 rule. */}
        <PresentationStudioLayoutAuditBanner
          audit={state.generate?.layoutAudit ?? null}
          data-testid="presentation-studio-layout-audit"
        />

        {isEmpty && !state.loading && !state.error ? (
          <div
            className="rounded-xl border border-dashed border-c-border bg-c-surface px-5 py-10 text-center text-sm text-c-text-secondary"
            data-testid="presentation-studio-empty"
          >
            Click <strong className="font-semibold text-c-text">Run preview</strong> to fetch source
            pack, narrative plan, template plan, and generate previews. This page never persists
            anything and never invokes deck generation.
          </div>
        ) : null}

        {/* Source Pack */}
        <SectionCard
          title="Source pack preview"
          description="Tenant-scoped read of source coverage, missing inputs, and readiness."
          testId="section-source-pack"
          badge={
            summary.sourcePackStatus ? (
              <StatusBadge
                tone={toneForSourcePackStatus(summary.sourcePackStatus)}
                label={summary.sourcePackStatus}
              />
            ) : null
          }
        >
          {state.sourcePack ? (
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-c-text-muted">
                  Sources
                </dt>
                <dd className="mt-1 font-medium text-c-text">
                  {state.sourcePack.sourcePack.sources.length}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-c-text-muted">
                  Missing inputs
                </dt>
                <dd className="mt-1 font-medium text-c-text">
                  {state.sourcePack.missingInputs.length}
                </dd>
              </div>
              {state.sourcePack.warnings.length > 0 ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wider text-c-text-muted">
                    Warnings
                  </dt>
                  <ul
                    className="mt-1 list-disc space-y-0.5 pl-5 text-c-text-secondary"
                    data-testid="source-pack-warnings"
                  >
                    {state.sourcePack.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="text-sm text-c-text-muted">No data yet.</p>
          )}
        </SectionCard>

        {/* Narrative Plan */}
        <SectionCard
          title="Narrative plan preview"
          description="Deck-level thesis, storyline, decisions, and per-slide narrative role."
          testId="section-narrative-plan"
          badge={
            summary.narrativeStatus ? (
              <StatusBadge
                tone={toneForNarrativeStatus(summary.narrativeStatus)}
                label={summary.narrativeStatus}
              />
            ) : null
          }
        >
          {state.narrativePlan ? (
            <div className="space-y-3 text-sm">
              {state.narrativePlan.narrativePlan.thesis ? (
                <p className="text-c-text">
                  <span className="font-medium">Thesis:</span>{' '}
                  {state.narrativePlan.narrativePlan.thesis}
                </p>
              ) : null}
              <p className="text-c-text-secondary">
                {state.narrativePlan.narrativePlan.slidePlan.length} slide narrative roles planned.
              </p>
              {state.narrativePlan.warnings.length > 0 ? (
                <ul
                  className="list-disc space-y-0.5 pl-5 text-c-text-secondary"
                  data-testid="narrative-warnings"
                >
                  {state.narrativePlan.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-c-text-muted">No data yet.</p>
          )}
        </SectionCard>

        {/* Template Plan */}
        <SectionCard
          title="Template architect plan preview"
          description="Methodology-first template plan. Always returned with approvalRequired=true."
          testId="section-template-plan"
          badge={
            summary.templateStatus ? (
              <StatusBadge
                tone={toneForTemplateStatus(summary.templateStatus)}
                label={summary.templateStatus}
                icon={<ShieldAlert className="h-3 w-3" aria-hidden="true" />}
              />
            ) : null
          }
        >
          {state.templatePlan ? (
            <div className="space-y-3 text-sm">
              <p className="text-c-text">
                <span className="font-medium">Template:</span>{' '}
                {state.templatePlan.templatePlan.templateName}{' '}
                <span className="text-c-text-muted">
                  ({state.templatePlan.templatePlan.templateFamily})
                </span>
              </p>
              <p className="text-c-text-secondary">
                {state.templatePlan.templatePlan.sections.length} sections,{' '}
                {state.templatePlan.templatePlan.requiredInputs.length} required inputs,{' '}
                {state.templatePlan.templatePlan.optionalInputs.length} optional.
              </p>
              <div
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                data-testid="template-approval-banner"
              >
                Approval required before this template enters the registry.
              </div>
            </div>
          ) : (
            <p className="text-sm text-c-text-muted">No data yet.</p>
          )}
        </SectionCard>

        {/* Generate Preview */}
        <SectionCard
          title="Generate dispatcher preview"
          description="What the deck would look like if generated now. Read-only — never persists."
          testId="section-generate"
          badge={
            summary.canProceed === null ? null : summary.canProceed ? (
              <StatusBadge
                tone="emerald"
                label="canProceed=true"
                icon={<CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
              />
            ) : (
              <StatusBadge
                tone="rose"
                label="canProceed=false"
                icon={<AlertTriangle className="h-3 w-3" aria-hidden="true" />}
              />
            )
          }
        >
          {state.generate ? (
            <div className="space-y-3 text-sm">
              <p className="text-c-text">
                <span className="font-medium">Outline:</span> {state.generate.outlinePreview.length}{' '}
                items, {state.generate.estimatedSlideCount} estimated slides.
              </p>
              <p className="text-c-text-secondary">
                Template family:{' '}
                <span className="font-medium text-c-text">
                  {state.generate.usedTemplate.family ?? '—'}
                </span>
                {'  ·  '}
                Source: {state.generate.usedTemplate.source}
              </p>
              {state.generate.wouldGenerate.blockingReasons.length > 0 ? (
                <ul
                  className="list-disc space-y-0.5 pl-5 text-danger-700 dark:text-danger-300"
                  data-testid="generate-blocking-reasons"
                >
                  {state.generate.wouldGenerate.blockingReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-c-text-muted">No data yet.</p>
          )}
        </SectionCard>

        {/* Sprint S20: SuperAdmin layout-capacity admin surface.
            Server-driven visibility: a non-SuperAdmin GET returns
            403 PERMISSION_DENIED and the panel renders nothing — the
            mount is therefore safe for every role and only adds DOM
            for users with `presentation_admin_layout_capacity`.
            Closes R-S17-3 (no UI for the S17 admin endpoint),
            R-S18-4 (loadWarning was not surfaced anywhere in UI),
            and R-S19-3 (reset action had no UI button). */}
        <PresentationStudioLayoutCapacityAdminPanel />
      </main>
    </div>
  );
};

export default PresentationStudioPage;
