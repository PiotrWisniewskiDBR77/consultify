/**
 * OkrSetOverviewView — RN-G3 lane `okr` (2026-08-11), the "Overview" mode of
 * the full OKR tool workspace (design doc §8.3 mode 1 of 7:
 * "1. Overview"). Shows the Set's own properties + honest progress/
 * confidence/attention (HonestValueCell, same 2-way-not-3-way caveat
 * documented in `okrRegistryMappers.ts` — see also `okrWorkspaceApi.ts`
 * header) + the real lifecycle action buttons (submit/approve/request-
 * changes/activate/open-review/cancel), each gated per
 * `okrWorkspaceMappers.ts`'s cited state-machine table — TRIADA §C3 "visible,
 * disabled, with a reason", never hidden.
 *
 * Uses `ArtifactPropertiesTable` (imported directly, matching the existing
 * repo-wide precedent in `TaskDetailView.tsx`/`DecisionDetailView.tsx`/etc.
 * — it is not yet re-exported from `standard/index.ts`'s barrel, a gap
 * `RN_G2_UI_SCOPE.md`'s open question #2 already names as unresolved
 * "Platform" territory, not something this lane may fix) rather than a
 * bespoke properties block — same "standard is code" rule as the list triad.
 */
import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { ArtifactPropertiesTable, type ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import { StatusChip } from '@/components/ui/primitives';

import { HonestValueCell } from '../HonestValue';
import type { OkrSetDto } from './okrApi';
import { toUserFacingErrorMessage } from '../shared/errorMessage';
import {
  formatOkrDate,
  formatOkrProgressPercent,
  okrSetAttentionLabel,
  okrSetConfidenceLabel,
  OKR_SET_ATTENTION_TONE,
  OKR_SET_CONFIDENCE_TONE,
  okrSetScopeLabel,
  okrSetStatusLabel,
  OKR_SET_STATUS_TONE,
  parseOkrProgress,
  shortOkrId,
} from './okrRegistryMappers';
import {
  activateOkrSet,
  approveOkrSet,
  cancelOkrSet,
  newOkrWorkspaceIdempotencyKey,
  openOkrSetReview,
  OkrWorkspaceApiError,
  requestChangesOnOkrSet,
  submitOkrSetForApproval,
} from './okrWorkspaceApi';
import {
  gateActivate,
  gateApprove,
  gateCancel,
  gateOpenReview,
  gateRequestChanges,
  gateSubmit,
} from './okrWorkspaceMappers';

export interface OkrSetOverviewViewProps {
  set: OkrSetDto;
  isPolish: boolean;
  currentUserId: string | null;
  onSetChanged: (set: OkrSetDto) => void;
}

type PendingAction = 'submit' | 'approve' | 'requestChanges' | 'activate' | 'openReview' | 'cancel' | null;

const ACTION_BUTTON_BASE =
  'inline-flex h-9 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50';
const PRIMARY_BUTTON = `${ACTION_BUTTON_BASE} border-c-border-strong bg-c-text text-c-surface hover:opacity-90`;
const GHOST_BUTTON = `${ACTION_BUTTON_BASE} border-c-border bg-transparent text-c-text hover:bg-c-surface-raised`;
const DANGER_BUTTON = `${ACTION_BUTTON_BASE} border-danger-300/40 dark:border-danger-500/30 bg-danger-50 dark:bg-danger-500/10 text-danger-700 dark:text-danger-200`;

export const OkrSetOverviewView: React.FC<OkrSetOverviewViewProps> = ({ set, isPolish, currentUserId, onSetChanged }) => {
  const [pending, setPending] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const progress = parseOkrProgress(set.overallProgress);

  const run = (action: PendingAction, promise: Promise<{ set: OkrSetDto }>) => {
    setPending(action);
    setError(null);
    promise
      .then((res) => {
        onSetChanged(res.set);
        setNotes('');
      })
      .catch((err) => setError(toUserFacingErrorMessage(err, isPolish)))
      .finally(() => setPending(null));
  };

  const submitGate = gateSubmit(set);
  const approveGate = gateApprove(set, currentUserId);
  const requestChangesGate = gateRequestChanges(set);
  const activateGate = gateActivate(set);
  const openReviewGate = gateOpenReview(set);
  const cancelGate = gateCancel(set);

  const rows: ArtifactPropertyRow[] = [
    { id: 'status', label: isPolish ? 'Status' : 'Status', value: <StatusChip label={okrSetStatusLabel(set.status, isPolish)} tone={OKR_SET_STATUS_TONE[set.status]} /> },
    { id: 'scope', label: isPolish ? 'Zasięg' : 'Scope', value: okrSetScopeLabel(set.scopeType, isPolish) },
    { id: 'owner', label: isPolish ? 'Właściciel' : 'Owner', value: <span className="font-mono">{shortOkrId(set.ownerUserId)}</span> },
    { id: 'reviewer', label: isPolish ? 'Recenzent' : 'Reviewer', value: <span className="font-mono">{shortOkrId(set.reviewerUserId)}</span> },
    {
      id: 'progress',
      label: isPolish ? 'Postęp ogólny' : 'Overall progress',
      value: (
        <HonestValueCell
          value={progress}
          align="right"
          notCalculableReason={
            isPolish
              ? 'Zestaw nie rozróżnia "brak danych" od "nieobliczalne" na drucie — patrz nagłówek okrWorkspaceApi.ts (OQ-UI-C).'
              : 'The Set cannot distinguish "no data" from "not calculable" on the wire — see okrWorkspaceApi.ts header (OQ-UI-C).'
          }
          format={(v) => formatOkrProgressPercent(v, isPolish)}
        />
      ),
    },
    {
      id: 'confidence',
      label: isPolish ? 'Pewność ogólna' : 'Overall confidence',
      value: set.overallConfidence ? (
        <StatusChip label={okrSetConfidenceLabel(set.overallConfidence, isPolish)} tone={OKR_SET_CONFIDENCE_TONE[set.overallConfidence]} />
      ) : (
        <span className="text-c-text-muted">—</span>
      ),
    },
    {
      id: 'attention',
      label: isPolish ? 'Uwaga' : 'Attention',
      value: <StatusChip label={okrSetAttentionLabel(set.attentionState, isPolish)} tone={OKR_SET_ATTENTION_TONE[set.attentionState]} />,
    },
    { id: 'lastCheckin', label: isPolish ? 'Ostatni check-in' : 'Last check-in', value: formatOkrDate(set.lastCheckinAt, isPolish) },
    { id: 'nextCheckin', label: isPolish ? 'Następny check-in' : 'Next check-in due', value: formatOkrDate(set.nextCheckinDueAt, isPolish) },
    { id: 'currentVersion', label: isPolish ? 'Wersja bieżąca' : 'Current version', value: set.currentVersion },
    { id: 'approvedVersion', label: isPolish ? 'Wersja zaakceptowana' : 'Approved version', value: set.approvedVersion ?? '—' },
    { id: 'updatedAt', label: isPolish ? 'Zaktualizowano' : 'Updated', value: formatOkrDate(set.updatedAt, isPolish) },
  ];

  if (set.changesRequestedReason) {
    rows.push({
      id: 'changesRequestedReason',
      label: isPolish ? 'Powód żądania poprawek' : 'Change request reason',
      value: set.changesRequestedReason,
    });
  }

  interface ActionSpec {
    id: Exclude<PendingAction, null>;
    label: string;
    gate: { pl: string; en: string } | null;
    variant: 'primary' | 'ghost' | 'danger';
    onRun: () => void;
    needsNotes?: boolean;
  }

  const actions: ActionSpec[] = [
    {
      id: 'submit',
      label: isPolish ? 'Złóż do akceptacji' : 'Submit for approval',
      gate: submitGate,
      variant: 'primary',
      onRun: () =>
        run(
          'submit',
          submitOkrSetForApproval(set.setId, { expectedVersion: set.rowVersion, idempotencyKey: newOkrWorkspaceIdempotencyKey() })
        ),
    },
    {
      id: 'approve',
      label: isPolish ? 'Zaakceptuj' : 'Approve',
      gate: approveGate,
      variant: 'primary',
      onRun: () =>
        run('approve', approveOkrSet(set.setId, { expectedVersion: set.rowVersion, idempotencyKey: newOkrWorkspaceIdempotencyKey() })),
    },
    {
      id: 'requestChanges',
      label: isPolish ? 'Żądaj poprawek' : 'Request changes',
      gate: requestChangesGate ?? (notes.trim() ? null : { pl: 'Podaj powód żądania poprawek.', en: 'Provide a reason for the change request.' }),
      variant: 'ghost',
      needsNotes: true,
      onRun: () =>
        run(
          'requestChanges',
          requestChangesOnOkrSet(set.setId, {
            expectedVersion: set.rowVersion,
            changeRequestNotes: notes.trim(),
            idempotencyKey: newOkrWorkspaceIdempotencyKey(),
          })
        ),
    },
    {
      id: 'activate',
      label: isPolish ? 'Aktywuj' : 'Activate',
      gate: activateGate,
      variant: 'primary',
      onRun: () =>
        run('activate', activateOkrSet(set.setId, { expectedVersion: set.rowVersion, idempotencyKey: newOkrWorkspaceIdempotencyKey() })),
    },
    {
      id: 'openReview',
      label: isPolish ? 'Otwórz przegląd' : 'Open review',
      gate: openReviewGate,
      variant: 'ghost',
      onRun: () =>
        run('openReview', openOkrSetReview(set.setId, { expectedVersion: set.rowVersion, idempotencyKey: newOkrWorkspaceIdempotencyKey() })),
    },
    {
      id: 'cancel',
      label: isPolish ? 'Anuluj zestaw' : 'Cancel set',
      gate: cancelGate,
      variant: 'danger',
      onRun: () =>
        run('cancel', cancelOkrSet(set.setId, { expectedVersion: set.rowVersion, idempotencyKey: newOkrWorkspaceIdempotencyKey() })),
    },
  ];

  return (
    <div className="h-full overflow-auto px-4 py-4 space-y-4" data-testid="okr-set-overview">
      <div className="rounded-lg border border-c-border-subtle bg-c-surface p-4">
        <h3 className="text-sm font-semibold text-c-text mb-3">{isPolish ? 'Właściwości zestawu' : 'Set properties'}</h3>
        <ArtifactPropertiesTable rows={rows} propertyLabel={isPolish ? 'Właściwość' : 'Property'} valueLabel={isPolish ? 'Wartość' : 'Value'} />
      </div>

      <div className="rounded-lg border border-c-border-subtle bg-c-surface p-4">
        <h3 className="text-sm font-semibold text-c-text mb-3">{isPolish ? 'Cykl życia zestawu' : 'Set lifecycle'}</h3>
        {requestChangesGate === null || actions.find((a) => a.id === 'requestChanges' && !a.gate) ? (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isPolish ? 'Powód żądania poprawek (wymagane dla "Żądaj poprawek")' : 'Change-request reason (required for "Request changes")'}
            className="mb-3 w-full min-h-[60px] rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text placeholder:text-c-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            data-testid="okr-overview-change-notes"
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => {
            const disabled = !!action.gate || pending !== null;
            const cls = action.variant === 'primary' ? PRIMARY_BUTTON : action.variant === 'danger' ? DANGER_BUTTON : GHOST_BUTTON;
            const title = action.gate ? (isPolish ? action.gate.pl : action.gate.en) : undefined;
            return (
              <button
                key={action.id}
                type="button"
                className={cls}
                disabled={disabled}
                title={title}
                onClick={action.onRun}
                data-testid={`okr-overview-action-${action.id}`}
              >
                {pending === action.id ? (isPolish ? 'Trwa…' : 'Working…') : action.label}
              </button>
            );
          })}
        </div>
        {actions
          .filter((a) => a.gate)
          .map((a) => (
            <p key={`gate-${a.id}`} className="mt-2 text-[11px] text-c-text-muted flex items-center gap-1">
              <AlertTriangle size={12} className="shrink-0" />
              {a.label}: {isPolish ? a.gate!.pl : a.gate!.en}
            </p>
          ))}
        {error ? (
          <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text" data-testid="okr-overview-error">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>{error}</span>
          </div>
        ) : null}
        {!error && pending === null ? (
          <p className="mt-2 flex items-center gap-1 text-[11px] text-c-text-muted">
            <CheckCircle2 size={12} className="shrink-0" />
            {isPolish
              ? 'Każdy przycisk stosuje regułę serwera 1:1 — patrz cytaty plik:linia w okrWorkspaceMappers.ts.'
              : 'Every button mirrors the server rule 1:1 — see file:line citations in okrWorkspaceMappers.ts.'}
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default OkrSetOverviewView;

// Re-exported for callers that only need to detect a 409 write conflict.
export { OkrWorkspaceApiError };
