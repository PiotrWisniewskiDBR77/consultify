/**
 * FinanceCandidateHandoffModal (FIN-06)
 *
 * ONE shared preview→confirm→pending→success/error flow for every Finance
 * source type that can be handed off as an `initiative_candidates` row
 * ("Candidate", never an Initiative directly — FIN-06 bans Finance from
 * creating Initiatives). Per Codex's explicit correction on this round: a
 * single component with a source variant, not three separate modals.
 *
 * Shape (matches Codex's flow literally):
 *   Preview → Confirm → pending/progress → durable Candidate → fresh
 *   read-back → deep link/reopen.
 *
 * Behavior is shared; copy is parameterized. Nothing Finance/Valuation/
 * Statement-Pack-specific is hardcoded here — every string is a prop so each
 * call site keeps its own hard-won wording (including the existing
 * ineligible-reason mapping, idempotent-replay copy, and the honest "no
 * per-candidate deep link exists yet" finding).
 *
 * Internal phase machine:
 *   previewing → eligible | ineligible
 *   eligible → confirming → success | error
 * `success` is transient: it exists so the state machine has the shape
 * Codex asked for, but by default (`closeOnSuccess !== false`) the modal
 * closes itself right after calling `onConfirmed`, exactly matching what
 * both prior implementations already did (they show the "fresh" result via
 * their OWN toast/onExportComplete, not a screen inside this modal). Pass
 * `closeOnSuccess={false}` to keep the modal open and drive your own success
 * screen instead.
 *
 * "Fresh read-back": `confirm()` already returns the backend's persisted
 * truth (never optimistic client state), so it alone satisfies "never show
 * false success". If a source additionally supports a lineage GET receipt
 * (both existing FIN-06 API clients already define one — until this
 * component neither call site actually called it), pass it as
 * `fetchHandoff` and this component will re-fetch it after confirm succeeds
 * and prefer its `sourceSnapshot` for the summary, best-effort (a failed
 * read-back never turns a real success into an error — it just falls back to
 * confirm()'s own response).
 */
import { AlertTriangle, ExternalLink, Loader2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

export type FinanceCandidateSourceType =
  | 'finance_investment_case'
  | 'finance_valuation_recommendation'
  | 'finance_statement_pack';

/**
 * Mirrors the backend's `FinanceCandidateSourceSnapshot`
 * (`server/src/services/finance/financeCandidateHandoffCore.ts`): every
 * field is either a real value read verbatim off the source, or the literal
 * string `'unknown'` — the backend NEVER substitutes 0/null for a value the
 * source doesn't have. Kept as an open record (rather than importing the
 * server type directly) so this client stays tolerant of a field being
 * absent entirely on an older cached response, and doesn't need a
 * cross-boundary import.
 */
export interface FinanceCandidateSourceSnapshot {
  currency?: string | 'unknown';
  capex?: number | 'unknown';
  opex?: number | 'unknown';
  npv?: number | 'unknown';
  irr?: number | 'unknown';
  roi?: number | 'unknown';
  payback?: number | 'unknown';
  baselineOrScenario?: string | 'unknown';
  assumptions?: string[] | 'unknown';
  risks?: string[] | 'unknown';
  sourceVersion?: string | 'unknown';
  sourceFingerprint?: string | 'unknown';
  [key: string]: unknown;
}

export interface FinanceCandidatePreviewData {
  title: string;
  rationale: string;
  fitScore?: number;
  sourceType: FinanceCandidateSourceType;
  sourceId: string;
  sourceSnapshot?: FinanceCandidateSourceSnapshot | null;
}

export type FinanceCandidatePreviewResult =
  | { eligible: true; preview: FinanceCandidatePreviewData }
  | { eligible: false; reason: string };

export interface FinanceCandidateConfirmResult {
  /** false on an idempotent replay — this source was already handed off before. */
  created: boolean;
  candidateId: string;
  sourceSnapshot?: FinanceCandidateSourceSnapshot | null;
}

export interface FinanceCandidateHandoffReceipt {
  id: string;
  organizationId: string;
  sourceType: string;
  sourceId: string;
  candidateId: string;
  createdBy: string | null;
  createdAt: string;
  sourceSnapshot?: FinanceCandidateSourceSnapshot | null;
}

export interface FinanceCandidateConfirmedInfo {
  created: boolean;
  candidateId: string;
  preview: FinanceCandidatePreviewData;
  sourceSnapshot?: FinanceCandidateSourceSnapshot | null;
  reopenLink: string | null;
}

type Phase = 'previewing' | 'eligible' | 'ineligible' | 'confirming' | 'success' | 'error';

export interface FinanceCandidateHandoffModalProps {
  open: boolean;
  onClose: () => void;
  sourceType: FinanceCandidateSourceType;
  sourceId: string;

  /**
   * 'standalone' (default) renders its own fixed overlay + card, with a
   * header (title + X) and a Cancel button next to Confirm — for call sites
   * that open this on demand as a floating modal (Valuation, Statement
   * Pack).
   * 'embedded' renders only the phase-driven body (no overlay, no header,
   * no Cancel button) — for a call site that already owns its own modal
   * chrome and just wants to swap in this flow for one tab/section
   * (ExportToOutputDialog's "Initiatives" output type).
   */
  variant?: 'standalone' | 'embedded';

  /** Read-only eligibility + preview check — no lock, no write. */
  preview: () => Promise<FinanceCandidatePreviewResult>;
  /** Mutating confirm — creates the Candidate (never an Initiative). */
  confirm: () => Promise<FinanceCandidateConfirmResult>;
  /** Optional lineage GET for a genuine fresh read-back after confirm. */
  fetchHandoff?: () => Promise<FinanceCandidateHandoffReceipt | null>;
  /** Deep link to the created Candidate, or null if no such link exists yet
   * (never fabricate a URL that doesn't work — return null/a list fallback). */
  getReopenLink?: (candidateId: string) => string | null;

  /** Fired once, right after a successful confirm (+ best-effort fresh read-back). */
  onConfirmed?: (info: FinanceCandidateConfirmedInfo) => void;
  /** Fired whenever preview() resolves, eligible or not — for analytics hooks. */
  onPreviewResolved?: (result: FinanceCandidatePreviewResult) => void;

  /** Maps a raw backend reason code to caller-specific copy. Defaults to the raw reason. */
  describeIneligibleReason?: (reason: string) => string;

  title: string;
  noticeText: string;
  confirmLabel: string;
  cancelLabel?: string;
  closeLabel?: string;
  checkingLabel?: string;
  confirmingLabel?: string;
  fitScoreLabel?: string;
  reopenLabel?: string;
  previewErrorFallback?: string;
  confirmErrorFallback?: string;
  /** May contain a literal `{{title}}` placeholder, replaced with preview.title. */
  createdMessage?: string;
  /** May contain a literal `{{title}}` placeholder, replaced with preview.title. */
  replayMessage?: string;

  /** Keep the modal open after a successful confirm instead of auto-closing. Default false (auto-close). */
  keepOpenOnSuccess?: boolean;
}

function interpolateTitle(template: string, title: string): string {
  return template.split('{{title}}').join(title);
}

/**
 * Lineage/integrity identifiers, not "key figures" — showing a raw version
 * string or a 16-char sha256 fingerprint next to "Currency: PLN" would be
 * clutter, not a summary. Still present in the data for callers that want
 * them (e.g. debugging), just not in this human-facing grid.
 */
const SNAPSHOT_SUMMARY_HIDDEN_KEYS = new Set(['sourceVersion', 'sourceFingerprint']);

/**
 * Renders a real value verbatim. The backend's `FinanceCandidateSourceSnapshot`
 * never substitutes 0/null for a missing figure — every field is either a
 * real value or the literal string `'unknown'` — so this only ever needs to
 * turn `'unknown'` (and, defensively, null/undefined) into an honest dash;
 * it must never coerce a genuine `'unknown'` into `0` or a blank cell.
 */
function formatSnapshotValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    return value.map((item) => String(item)).join(', ');
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'unknown') return '—';
    return trimmed;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return '—';
}

function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function SourceSnapshotSummary({ snapshot }: { snapshot: FinanceCandidateSourceSnapshot }) {
  const entries = Object.entries(snapshot).filter(
    ([key, v]) => v !== undefined && !SNAPSHOT_SUMMARY_HIDDEN_KEYS.has(key)
  );
  if (entries.length === 0) return null;
  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-c-border-subtle bg-c-surface-raised p-2.5 text-[11px]">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between gap-2">
          <dt className="text-c-text-muted truncate">{humanizeKey(key)}</dt>
          <dd className="text-c-text font-medium tabular-nums">{formatSnapshotValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export const FinanceCandidateHandoffModal: React.FC<FinanceCandidateHandoffModalProps> = ({
  open,
  onClose,
  variant = 'standalone',
  preview,
  confirm,
  fetchHandoff,
  getReopenLink,
  onConfirmed,
  onPreviewResolved,
  describeIneligibleReason,
  title,
  noticeText,
  confirmLabel,
  cancelLabel = 'Cancel',
  closeLabel = 'Close',
  checkingLabel = 'Checking eligibility...',
  confirmingLabel,
  fitScoreLabel = 'Fit',
  reopenLabel = 'Open',
  previewErrorFallback = 'Could not check eligibility',
  confirmErrorFallback = 'Could not create the Candidate',
  createdMessage = 'Candidate created: {{title}}',
  replayMessage = 'Already sent as a Candidate: {{title}}',
  keepOpenOnSuccess = false,
}) => {
  const [phase, setPhase] = useState<Phase>('previewing');
  const [previewData, setPreviewData] = useState<FinanceCandidatePreviewData | null>(null);
  const [ineligibleReason, setIneligibleReason] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [resultMessage, setResultMessage] = useState<string>('');
  const [reopenLink, setReopenLink] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase('previewing');
    setPreviewData(null);
    setIneligibleReason('');
    setErrorMessage('');
    setResultMessage('');
    setReopenLink(null);

    preview()
      .then((result) => {
        if (cancelled) return;
        onPreviewResolved?.(result);
        if (result.eligible) {
          setPreviewData(result.preview);
          setPhase('eligible');
        } else {
          setIneligibleReason(result.reason);
          setPhase('ineligible');
        }
      })
      .catch((error: any) => {
        if (cancelled) return;
        setErrorMessage(error?.data?.error || error?.message || previewErrorFallback);
        setPhase('error');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleConfirm = async () => {
    if (phase !== 'eligible' || !previewData) return;
    setPhase('confirming');
    try {
      const result = await confirm();
      let sourceSnapshot = result.sourceSnapshot ?? previewData.sourceSnapshot ?? null;

      if (fetchHandoff) {
        try {
          const fresh = await fetchHandoff();
          if (fresh?.sourceSnapshot) {
            sourceSnapshot = fresh.sourceSnapshot;
          }
        } catch (readBackError) {
          // Best-effort only: confirm() already reflects backend-persisted
          // truth, so a failed fresh read-back never turns a real success
          // into an error — it just keeps confirm()'s own snapshot.
          console.warn(
            '[FinanceCandidateHandoffModal] fresh read-back failed, using confirm() response',
            readBackError
          );
        }
      }

      const link = getReopenLink ? getReopenLink(result.candidateId) : null;
      setReopenLink(link);
      setResultMessage(
        interpolateTitle(result.created ? createdMessage : replayMessage, previewData.title)
      );
      setPhase('success');
      onConfirmed?.({
        created: result.created,
        candidateId: result.candidateId,
        preview: previewData,
        sourceSnapshot,
        reopenLink: link,
      });
      if (!keepOpenOnSuccess) {
        onClose();
      }
    } catch (error: any) {
      setErrorMessage(error?.data?.error || error?.message || confirmErrorFallback);
      setPhase('error');
    }
  };

  const ineligibleCopy = describeIneligibleReason
    ? describeIneligibleReason(ineligibleReason)
    : ineligibleReason;
  const embedded = variant === 'embedded';

  const body = (
    <>
      {!embedded && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-c-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={phase === 'confirming'}
            className="text-c-text-secondary hover:text-c-text disabled:opacity-60"
            aria-label={closeLabel}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {phase === 'previewing' && (
        <div className="flex items-center gap-2 py-6 text-sm text-c-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          {checkingLabel}
        </div>
      )}

      {phase === 'ineligible' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-c-warning/30 bg-c-warning/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-c-warning" />
            <p className="text-xs text-c-text">{ineligibleCopy}</p>
          </div>
          {!embedded && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-c-text-muted hover:text-c-text-secondary"
              >
                {closeLabel}
              </button>
            </div>
          )}
        </div>
      )}

      {(phase === 'eligible' || phase === 'confirming') && previewData && (
        <div className="space-y-4">
          <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-3">
            <div className="text-sm font-semibold text-c-text">{previewData.title}</div>
            <p className="mt-1.5 text-xs leading-relaxed text-c-text-secondary">
              {previewData.rationale}
            </p>
            {typeof previewData.fitScore === 'number' && (
              <div className="mt-2 text-[10px] text-c-text-muted">
                {fitScoreLabel}: {Math.round(previewData.fitScore * 100)}%
              </div>
            )}
            {previewData.sourceSnapshot && (
              <SourceSnapshotSummary snapshot={previewData.sourceSnapshot} />
            )}
          </div>
          <p className="text-xs text-c-text-muted">{noticeText}</p>
          <div className="flex justify-end gap-2">
            {!embedded && (
              <button
                type="button"
                onClick={onClose}
                disabled={phase === 'confirming'}
                className="px-4 py-2 text-sm text-c-text-muted hover:text-c-text-secondary disabled:opacity-60"
              >
                {cancelLabel}
              </button>
            )}
            <button
              type="button"
              disabled={phase === 'confirming'}
              onClick={handleConfirm}
              className="rounded-lg bg-c-text px-4 py-2 text-sm font-medium text-c-bg hover:opacity-90 disabled:opacity-60"
            >
              {phase === 'confirming' ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {confirmingLabel || confirmLabel}
                </span>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      )}

      {phase === 'success' && keepOpenOnSuccess && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-c-success/30 bg-c-success/10 p-3">
            <p className="text-xs text-c-text">{resultMessage}</p>
          </div>
          <div className="flex justify-end gap-2">
            {reopenLink && (
              <a
                href={reopenLink}
                className="flex items-center gap-1 px-4 py-2 text-sm text-c-info hover:underline"
              >
                {reopenLabel}
                <ExternalLink size={12} />
              </a>
            )}
            {!embedded && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-c-text-muted hover:text-c-text-secondary"
              >
                {closeLabel}
              </button>
            )}
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-c-danger" />
            <p className="text-xs text-c-text">{errorMessage}</p>
          </div>
          {!embedded && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-c-text-muted hover:text-c-text-secondary"
              >
                {closeLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (embedded) {
    return body;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-c-border-subtle bg-c-surface p-6 shadow-xl">
        {body}
      </div>
    </div>
  );
};

export default FinanceCandidateHandoffModal;
