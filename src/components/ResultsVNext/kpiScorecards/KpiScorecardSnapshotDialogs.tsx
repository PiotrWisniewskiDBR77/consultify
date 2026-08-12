/**
 * KpiScorecardSnapshotDialogs — RN-G5 §G #8 write package:
 * `CreateKpiScorecardReviewSnapshotModal` (`POST .../review-snapshots`) and
 * `PublishKpiScorecardReviewSnapshotDialog` (`POST
 * .../review-snapshots/:snapshotId/publish`).
 *
 * -- ★ D07 / DECISION #6b REMINDER (see `kpiScorecardPresenters.tsx` header
 * and `kpiScorecardApi.ts`'s `publishKpiScorecardReviewSnapshot` doc comment
 * for the full finding): a review snapshot's `snapshotPayload` (item facts +
 * statusCounts) is ONLY safely reader-filtered by `getPublishedSnapshot` —
 * a bare `listReviewSnapshots`/`createReviewSnapshot`/`publishReviewSnapshot`
 * response row is NOT re-filtered per-reader. Both dialogs below are
 * confirmation-only (period pickers / a publish confirm) — NEITHER ever
 * reads or renders `.snapshotPayload` from any response, by construction
 * (there is no code path here that even touches that field). Do not "helpfully"
 * add a payload preview to either dialog without routing through
 * `getPublishedKpiScorecardSnapshot` specifically.
 */
import { AlertTriangle, CheckCircle2, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';
import { Modal } from '@/components/ui/primitives';

const FIELD_CLASS =
  'w-full h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';
const TEXTAREA_CLASS =
  'w-full min-h-[64px] rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors resize-y ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';
const LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5';
const GHOST_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 ' +
  'text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

// ==========================================
// CreateKpiScorecardReviewSnapshotModal
// ==========================================

export interface CreateKpiScorecardReviewSnapshotFormValues {
  reviewPeriodStart: string;
  reviewPeriodEnd: string;
  reason: string | null;
}

export interface CreateKpiScorecardReviewSnapshotModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateKpiScorecardReviewSnapshotFormValues) => void;
  isPolish: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}

export const CreateKpiScorecardReviewSnapshotModal: React.FC<CreateKpiScorecardReviewSnapshotModalProps> = ({
  open,
  onClose,
  onSubmit,
  isPolish,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStart('');
    setEnd('');
    setReason('');
    setTouched(false);
  }, [open]);

  const startError = touched && !start;
  const endError = touched && !end;

  const handleSubmit = () => {
    setTouched(true);
    if (!start || !end) return;
    onSubmit({
      reviewPeriodStart: new Date(start).toISOString(),
      reviewPeriodEnd: new Date(end).toISOString(),
      reason: reason.trim() || null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Nowa migawka przeglądu' : 'New review snapshot'}
      description={
        isPolish
          ? 'Zapisze się jako prawdziwy szkic migawki (Draft) dla podanego okresu.'
          : 'Saves as a real Draft snapshot for the given period.'
      }
      size="sm"
      preventOverlayClose={busy}
      preventEscapeClose={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            data-testid="kpi-scorecard-create-snapshot-submit"
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Plus size={16} />
            <span>{busy ? (isPolish ? 'Tworzenie…' : 'Creating…') : isPolish ? 'Utwórz migawkę' : 'Create snapshot'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="kpi-scorecard-snapshot-start">
              {isPolish ? 'Początek okresu' : 'Period start'}
            </label>
            <input
              id="kpi-scorecard-snapshot-start"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={FIELD_CLASS}
              data-testid="kpi-scorecard-snapshot-start"
              aria-invalid={startError || undefined}
            />
            {startError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Wymagane' : 'Required'}</p> : null}
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="kpi-scorecard-snapshot-end">
              {isPolish ? 'Koniec okresu' : 'Period end'}
            </label>
            <input
              id="kpi-scorecard-snapshot-end"
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={FIELD_CLASS}
              data-testid="kpi-scorecard-snapshot-end"
              aria-invalid={endError || undefined}
            />
            {endError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Wymagane' : 'Required'}</p> : null}
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-scorecard-snapshot-reason">
            {isPolish ? 'Notatka (opcjonalnie)' : 'Note (optional)'}
          </label>
          <textarea
            id="kpi-scorecard-snapshot-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="kpi-scorecard-snapshot-reason"
          />
        </div>
        {errorMessage ? (
          <p className="text-[12px] text-c-danger" role="alert" data-testid="kpi-scorecard-create-snapshot-error">
            {isConflict
              ? isPolish
                ? `Konflikt zapisu: ${errorMessage}`
                : `Write conflict: ${errorMessage}`
              : errorMessage}
          </p>
        ) : null}
      </div>
    </Modal>
  );
};

// ==========================================
// PublishKpiScorecardReviewSnapshotDialog
// ==========================================

export interface PublishKpiScorecardReviewSnapshotDialogProps {
  open: boolean;
  periodLabel: string;
  isPolish: boolean;
  onClose: () => void;
  onSubmit: (reason: string | null) => void;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}

export const PublishKpiScorecardReviewSnapshotDialog: React.FC<PublishKpiScorecardReviewSnapshotDialogProps> = ({
  open,
  periodLabel,
  isPolish,
  onClose,
  onSubmit,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setReason('');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Opublikuj migawkę przeglądu' : 'Publish review snapshot'}
      description={isPolish ? `Okres: ${periodLabel}` : `Period: ${periodLabel}`}
      size="sm"
      preventOverlayClose={busy}
      preventEscapeClose={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => onSubmit(reason.trim() || null)}
            disabled={busy}
            data-testid="kpi-scorecard-publish-snapshot-submit"
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <CheckCircle2 size={16} />
            <span>{busy ? (isPolish ? 'Publikowanie…' : 'Publishing…') : isPolish ? 'Opublikuj' : 'Publish'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-c-text-secondary">
          {isPolish
            ? 'Opublikowana migawka zastąpi poprzednią opublikowaną migawkę tej karty wyników (jeśli istnieje) — ta zmieni status na „Zastąpiona”.'
            : "Publishing replaces this scorecard's previous published snapshot (if any) — that one moves to “Superseded”."}
        </p>
        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-scorecard-publish-snapshot-reason">
            {isPolish ? 'Powód (opcjonalnie)' : 'Reason (optional)'}
          </label>
          <textarea
            id="kpi-scorecard-publish-snapshot-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="kpi-scorecard-publish-snapshot-reason"
          />
        </div>
        {errorMessage ? (
          <p className="flex items-start gap-1.5 text-[12px] text-c-danger" role="alert" data-testid="kpi-scorecard-publish-snapshot-error">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              {isConflict
                ? isPolish
                  ? `Konflikt zapisu: ${errorMessage}`
                  : `Write conflict: ${errorMessage}`
                : errorMessage}
            </span>
          </p>
        ) : null}
      </div>
    </Modal>
  );
};

export default CreateKpiScorecardReviewSnapshotModal;
