/**
 * OkrAlignmentsView — RN-G3 lane `okr` (2026-08-11), the "Alignment" mode of
 * the full OKR tool workspace (design §8.3 mode 4, §6 "Alignment"). Lists
 * outgoing ("this objective contributes to") and incoming ("contributes to
 * this objective") `contributes_to` relations for one Objective of the Set,
 * with propose/accept/reject/remove actions — MVP list/tree per design §6
 * ("MVP may show parent/contribution relations as a list/tree. Interactive
 * organization graph is V2").
 *
 * ── Objective picker, not a Set-level alignment endpoint ────────────────
 * There is no `GET /sets/:setId/alignments` — alignments are addressed by
 * Objective (`okr.routes.ts` L1918-2120: every alignment route hangs off
 * `/objectives/:objectiveId/...` or `/alignments/:alignmentId/...`). This
 * view therefore lists the Set's own Objectives first (reusing
 * `listObjectivesForSet`, already fetched by the Objectives tab — refetched
 * here independently, same "each tab owns its own fetch" convention
 * `ResultsOkrHub.tsx` already established for its own tabs) and lets the
 * user pick one to see/manage its alignments.
 *
 * ── Target objective picker: manual ID paste, same precedent as check-in's
 * cadenceOccurrenceId ─────────────────────────────────────────────────────
 * No endpoint in this backend searches Objectives across the organization
 * (confirmed by reading `okr.routes.ts` in full) — an alignment target is
 * very often a DIFFERENT Set's Objective (e.g. a team Objective contributing
 * to a company Objective), so it cannot be resolved from "Objectives of
 * this Set" either. `OkrCheckInRecordDialog.tsx` already established the
 * pattern for an identical backend gap (`cadenceOccurrenceId`): manual paste
 * with a visible explanation, never a random/guessed value. Reused here
 * verbatim rather than inventing a second convention for the same class of
 * gap. Flagged as a real, disclosed limitation, not silently worked around.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import type { StandardBreadcrumb, TableColumn, TableRow } from '@/components/standard';
import { Modal } from '@/components/ui/primitives';
import { StatusChip } from '@/components/ui/primitives';

import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import type { OkrSetDto } from './okrApi';
import { listObjectivesForSet, type OkrObjectiveWithKeyResultsDto } from './okrObjectiveApi';
import {
  acceptAlignment,
  listAlignmentsForObjective,
  newOkrWorkspaceIdempotencyKey,
  OkrWorkspaceApiError,
  proposeAlignment,
  rejectAlignment,
  removeAlignment,
  type OkrAlignmentDto,
} from './okrWorkspaceApi';
import { OKR_ALIGNMENT_STATUS_TONE, okrAlignmentStatusLabel, shortWorkspaceId } from './okrWorkspaceMappers';
import { formatOkrDate } from './okrRegistryMappers';
import { toUserFacingErrorMessage } from '../shared/errorMessage';

export interface OkrAlignmentsViewProps {
  set: OkrSetDto;
  isPolish: boolean;
  breadcrumbs: StandardBreadcrumb[];
}

function withId(row: OkrAlignmentDto & { direction: 'outgoing' | 'incoming' }): OkrAlignmentDto & { direction: 'outgoing' | 'incoming'; id: string } {
  return { ...row, id: row.alignmentId };
}

export const OkrAlignmentsView: React.FC<OkrAlignmentsViewProps> = ({ set, isPolish, breadcrumbs }) => {
  const [objectives, setObjectives] = useState<OkrObjectiveWithKeyResultsDto[] | null>(null);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [alignments, setAlignments] = useState<(OkrAlignmentDto & { direction: 'outgoing' | 'incoming' })[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [proposeOpen, setProposeOpen] = useState(false);
  const [targetObjectiveId, setTargetObjectiveId] = useState('');
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    listObjectivesForSet(set.setId)
      .then((rows) => {
        setObjectives(rows);
        if (rows.length > 0 && !selectedObjectiveId) setSelectedObjectiveId(rows[0].objectiveId);
      })
      .catch((err) => setError(toUserFacingErrorMessage(err, isPolish)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.setId]);

  const load = useCallback(() => {
    if (!selectedObjectiveId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      listAlignmentsForObjective(selectedObjectiveId, 'outgoing'),
      listAlignmentsForObjective(selectedObjectiveId, 'incoming'),
    ])
      .then(([outgoing, incoming]) => {
        setAlignments([
          ...outgoing.map((a) => ({ ...a, direction: 'outgoing' as const })),
          ...incoming.map((a) => ({ ...a, direction: 'incoming' as const })),
        ]);
      })
      .catch((err) => setError(toUserFacingErrorMessage(err, isPolish)))
      .finally(() => setLoading(false));
  }, [selectedObjectiveId]);

  useEffect(() => {
    load();
  }, [load]);

  const respond = (fn: () => Promise<unknown>) => {
    fn()
      .then(() => load())
      .catch((err) => setError(toUserFacingErrorMessage(err, isPolish)));
  };

  const columns: TableColumn[] = [
    {
      id: 'direction',
      label: isPolish ? 'Kierunek' : 'Direction',
      width: '150px',
      render: (row: OkrAlignmentDto & { direction: string }) => (
        <span className="text-sm text-c-text-secondary">
          {row.direction === 'outgoing' ? (isPolish ? 'Przyczynia się do →' : 'Contributes to →') : (isPolish ? '← Przyczynia się tutaj' : '← Contributes here')}
        </span>
      ),
    },
    {
      id: 'otherObjective',
      label: isPolish ? 'Powiązany cel' : 'Related objective',
      width: '220px',
      render: (row: OkrAlignmentDto & { direction: string }) => (
        <span className="font-mono text-sm text-c-text" title={row.direction === 'outgoing' ? row.targetObjectiveId : row.sourceObjectiveId}>
          {shortWorkspaceId(row.direction === 'outgoing' ? row.targetObjectiveId : row.sourceObjectiveId)}
        </span>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      width: '150px',
      filterable: true,
      filterOptions: (['proposed', 'accepted', 'rejected', 'removed'] as const).map((s) => ({ value: s, label: okrAlignmentStatusLabel(s, isPolish) })),
      render: (row: OkrAlignmentDto) => <StatusChip label={okrAlignmentStatusLabel(row.status, isPolish)} tone={OKR_ALIGNMENT_STATUS_TONE[row.status]} />,
    },
    {
      id: 'rationale',
      label: isPolish ? 'Uzasadnienie' : 'Rationale',
      width: '260px',
      render: (row: OkrAlignmentDto) => <span className="text-sm text-c-text-secondary line-clamp-2">{row.rationale ?? '—'}</span>,
    },
    {
      id: 'proposedAt',
      label: isPolish ? 'Zaproponowano' : 'Proposed',
      width: '150px',
      render: (row: OkrAlignmentDto) => <span className="text-sm text-c-text-secondary">{formatOkrDate(row.proposedAt, isPolish)}</span>,
    },
  ];

  const rows: TableRow[] = (alignments ?? []).map(withId);

  const objectivePicker =
    objectives && objectives.length > 0 ? (
      <select
        aria-label={isPolish ? 'Wybierz cel' : 'Select objective'}
        value={selectedObjectiveId ?? ''}
        onChange={(e) => setSelectedObjectiveId(e.target.value)}
        className="h-8 rounded-md border border-c-border bg-c-surface px-2 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        data-testid="okr-alignment-objective-picker"
      >
        {objectives.map((o) => (
          <option key={o.objectiveId} value={o.objectiveId}>
            {o.title}
          </option>
        ))}
      </select>
    ) : null;

  return (
    <>
      <ResultsVNextRegistryShell
        domain="okr"
        moduleBar={{
          breadcrumbs,
          filterControls: objectivePicker,
          breadcrumbCta: {
            label: isPolish ? 'Zaproponuj dopasowanie' : 'Propose alignment',
            onClick: () => {
              setFormError(null);
              setTargetObjectiveId('');
              setRationale('');
              setProposeOpen(true);
            },
            testId: 'okr-alignment-propose-cta',
            locked: !selectedObjectiveId,
            lockedReason: !selectedObjectiveId ? (isPolish ? 'Ten zestaw nie ma jeszcze żadnego celu.' : 'This set has no objective yet.') : undefined,
          },
        }}
        table={{
          columns,
          data: rows,
          persistKey: 'results-vnext.okr-alignments',
          loading,
          error,
          onRetry: load,
          empty:
            !loading && !error && rows.length === 0
              ? {
                  title: isPolish ? 'Brak dopasowań' : 'No alignments',
                  description: isPolish
                    ? 'Ten cel nie ma jeszcze żadnego dopasowania (contributes_to) w żadnym kierunku.'
                    : 'This objective has no contributes_to alignment in either direction yet.',
                }
              : undefined,
          rowMenu: (row) => {
            const a = row as unknown as OkrAlignmentDto & { direction: 'outgoing' | 'incoming' };
            const isIncomingProposed = a.direction === 'incoming' && a.status === 'proposed';
            const canRemove = a.status === 'accepted';
            return {
              primary: [],
              universalHandlers: {},
              statusTransitions: isIncomingProposed
                ? [
                    {
                      id: 'accept',
                      label: isPolish ? 'Akceptuj' : 'Accept',
                      onClick: () =>
                        respond(() =>
                          acceptAlignment(a.alignmentId, { expectedVersion: a.rowVersion, idempotencyKey: newOkrWorkspaceIdempotencyKey() })
                        ),
                    },
                    {
                      id: 'reject',
                      label: isPolish ? 'Odrzuć' : 'Reject',
                      onClick: () =>
                        respond(() => rejectAlignment(a.alignmentId, { expectedVersion: a.rowVersion, idempotencyKey: newOkrWorkspaceIdempotencyKey() })),
                    },
                  ]
                : undefined,
              destructive: canRemove
                ? {
                    label: isPolish ? 'Usuń dopasowanie' : 'Remove alignment',
                    onClick: () =>
                      respond(() => removeAlignment(a.alignmentId, { expectedVersion: a.rowVersion, idempotencyKey: newOkrWorkspaceIdempotencyKey() })),
                  }
                : {
                    label: isPolish ? 'Usuń dopasowanie' : 'Remove alignment',
                    note: isPolish ? 'Tylko zaakceptowane dopasowanie można usunąć.' : 'Only an accepted alignment may be removed.',
                  },
            };
          },
        }}
        preview={null}
      />

      <Modal
        open={proposeOpen}
        onClose={busy ? () => {} : () => setProposeOpen(false)}
        title={isPolish ? 'Zaproponuj dopasowanie' : 'Propose alignment'}
        size="sm"
        preventOverlayClose={busy}
        preventEscapeClose={busy}
        footer={
          <>
            <button type="button" onClick={() => setProposeOpen(false)} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 text-sm font-medium text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus">
              {isPolish ? 'Wstecz' : 'Back'}
            </button>
            <button
              type="button"
              disabled={busy || !targetObjectiveId.trim() || !selectedObjectiveId}
              onClick={() => {
                if (!selectedObjectiveId) return;
                setBusy(true);
                setFormError(null);
                proposeAlignment(selectedObjectiveId, {
                  targetObjectiveId: targetObjectiveId.trim(),
                  rationale: rationale.trim() || null,
                  idempotencyKey: newOkrWorkspaceIdempotencyKey(),
                })
                  .then(() => {
                    setProposeOpen(false);
                    load();
                  })
                  .catch((err) => setFormError(toUserFacingErrorMessage(err, isPolish)))
                  .finally(() => setBusy(false));
              }}
              data-testid="okr-alignment-propose-submit"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-c-border-strong bg-c-text px-4 text-sm font-medium text-c-surface hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (isPolish ? 'Wysyłanie…' : 'Sending…') : isPolish ? 'Zaproponuj' : 'Propose'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[12px] text-c-text-muted">
            {isPolish
              ? 'Brak wyszukiwarki celów w całej organizacji w tym backendzie — wklej identyfikator (UUID) celu docelowego. Nigdy nie zgaduj/generuj identyfikatora losowo.'
              : 'No cross-organization objective search exists in this backend — paste the target objective\'s UUID. Never guess/generate an id at random.'}
          </p>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5" htmlFor="okr-align-target">
              {isPolish ? 'Docelowy cel (UUID)' : 'Target objective (UUID)'}
            </label>
            <input
              id="okr-align-target"
              value={targetObjectiveId}
              onChange={(e) => setTargetObjectiveId(e.target.value)}
              className="w-full h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              data-testid="okr-alignment-target-input"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5" htmlFor="okr-align-rationale">
              {isPolish ? 'Uzasadnienie (opcjonalnie)' : 'Rationale (optional)'}
            </label>
            <textarea
              id="okr-align-rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              className="w-full min-h-[72px] rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            />
          </div>
          {formError ? (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
              <span>{formError}</span>
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
};

export default OkrAlignmentsView;

export { OkrWorkspaceApiError };
