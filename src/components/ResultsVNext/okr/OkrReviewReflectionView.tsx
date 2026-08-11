/**
 * OkrReviewReflectionView — RN-G3 lane `okr` (2026-08-11), the "Review &
 * Reflection" mode of the full OKR tool workspace (design §8.3 mode 6;
 * OKR-E007 §3/§4). Combines four related-but-distinct capabilities on one
 * tab (kept together, not split further, because they share one gate: all
 * four only make sense once the Set is in/after `review` — see
 * `okrWorkspaceMappers.ts`'s cited gate table):
 *  1. Self-review (owner-only submit) + Manager review (submit/approve/
 *     request-changes) + comments, one section each.
 *  2. Final score (`POST .../final-score`, Set-wide, scores every Objective
 *     per the Program's pinned `scoringModel`).
 *  3. Reflection per Objective (what worked / what didn't / why / learning /
 *     next-cycle change / disposition) — required-for-close only if the
 *     pinned policy's `reflectionRequiredForClose` is true (unknown to this
 *     client without a policy-read endpoint; the Close gate error itself is
 *     the honest source of truth, surfaced verbatim on failure rather than
 *     guessed).
 *  4. Close + Carry-forward actions, gated exactly per
 *     `okrWorkspaceMappers.ts`'s `gateClose`/`gateCarryForward`.
 *
 * NOT a StandardTable list screen (this is a bounded set of at most two
 * reviews plus N reflections, one per Objective — a form/action panel, same
 * class of screen as `OkrSetOverviewView.tsx`) — no raw HTML table markup
 * anywhere, so `check-list-canon.sh` does not apply here the way it does to
 * the Objectives/KeyResults/CheckIns/Alignments/Support/History tabs.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { StatusChip } from '@/components/ui/primitives';

import type { OkrSetDto } from './okrApi';
import { listObjectivesForSet, type OkrObjectiveWithKeyResultsDto } from './okrObjectiveApi';
import {
  approveOkrSetManagerReview,
  carryForwardOkrSet,
  closeOkrSet,
  finalScoreOkrSet,
  listOkrSetReviews,
  newOkrWorkspaceIdempotencyKey,
  OkrWorkspaceApiError,
  recordObjectiveReflection,
  requestChangesOnOkrSetManagerReview,
  submitOkrSetForManagerReview,
  submitOkrSetSelfReview,
  type OkrReflectionDisposition,
  type OkrReviewDto,
} from './okrWorkspaceApi';
import {
  gateCarryForward,
  gateClose,
  gateManagerReviewSubmit,
  gateSelfReview,
  OKR_REFLECTION_DISPOSITION_LABELS,
  OKR_REVIEW_STATUS_TONE,
  okrReviewStatusLabel,
  okrReviewTypeLabel,
} from './okrWorkspaceMappers';

export interface OkrReviewReflectionViewProps {
  set: OkrSetDto;
  isPolish: boolean;
  currentUserId: string | null;
  onSetChanged: (set: OkrSetDto) => void;
}

const BTN_BASE =
  'inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50';
const BTN_PRIMARY = `${BTN_BASE} border-c-border-strong bg-c-text text-c-surface hover:opacity-90`;
const BTN_GHOST = `${BTN_BASE} border-c-border bg-transparent text-c-text hover:bg-c-surface-raised`;
const BTN_DANGER = `${BTN_BASE} border-danger-300/40 dark:border-danger-500/30 bg-danger-50 dark:bg-danger-500/10 text-danger-700 dark:text-danger-200`;

export const OkrReviewReflectionView: React.FC<OkrReviewReflectionViewProps> = ({ set, isPolish, currentUserId, onSetChanged }) => {
  const [reviews, setReviews] = useState<OkrReviewDto[] | null>(null);
  const [objectives, setObjectives] = useState<OkrObjectiveWithKeyResultsDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Session-scoped reflection expectedVersion cache — see
  // `RecordReflectionInput`'s doc comment in okrWorkspaceApi.ts for why no
  // GET endpoint exists to discover this after a reload.
  const [reflectionVersions, setReflectionVersions] = useState<Record<string, number>>({});
  const [reflectionDrafts, setReflectionDrafts] = useState<
    Record<string, { whatWorked: string; whatDidNotWork: string; why: string; learning: string; nextCycleChange: string; disposition: OkrReflectionDisposition | '' }>
  >({});

  const load = useCallback(() => {
    setError(null);
    Promise.all([listOkrSetReviews(set.setId), listObjectivesForSet(set.setId)])
      .then(([r, o]) => {
        setReviews(r);
        setObjectives(o);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [set.setId]);

  useEffect(() => {
    load();
  }, [load]);

  const selfReview = (reviews ?? []).find((r) => r.reviewType === 'self') ?? null;
  const managerReview = (reviews ?? []).find((r) => r.reviewType === 'manager') ?? null;

  const run = (id: string, promise: Promise<unknown>, onDone?: () => void) => {
    setPending(id);
    setError(null);
    setNotice(null);
    promise
      .then(() => {
        load();
        onDone?.();
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setPending(null));
  };

  const draftFor = (objectiveId: string) =>
    reflectionDrafts[objectiveId] ?? { whatWorked: '', whatDidNotWork: '', why: '', learning: '', nextCycleChange: '', disposition: '' as const };

  const closeGate = gateClose(set);
  const carryForwardGate = gateCarryForward(set);
  const selfReviewGate = gateSelfReview(set, currentUserId);
  const managerReviewSubmitGate = gateManagerReviewSubmit(set);

  return (
    <div className="h-full overflow-auto px-4 py-4 space-y-4" data-testid="okr-review-reflection">
      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text" data-testid="okr-review-error">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
          <span>{error}</span>
        </div>
      ) : null}
      {notice ? (
        <div className="flex items-start gap-2 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-[12px] text-c-text">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      ) : null}

      {/* Self-review */}
      <section className="rounded-lg border border-c-border-subtle bg-c-surface p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-c-text">{okrReviewTypeLabel('self', isPolish)}</h3>
          {selfReview ? <StatusChip label={okrReviewStatusLabel(selfReview.status, isPolish)} tone={OKR_REVIEW_STATUS_TONE[selfReview.status]} /> : null}
        </div>
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={pending !== null || !!selfReviewGate}
          title={selfReviewGate ? (isPolish ? selfReviewGate.pl : selfReviewGate.en) : undefined}
          data-testid="okr-review-self-submit"
          onClick={() =>
            run(
              'self-submit',
              submitOkrSetSelfReview(set.setId, { expectedVersion: selfReview?.rowVersion ?? 0, idempotencyKey: newOkrWorkspaceIdempotencyKey() })
            )
          }
        >
          {pending === 'self-submit' ? (isPolish ? 'Wysyłanie…' : 'Sending…') : isPolish ? 'Złóż samoocenę' : 'Submit self-review'}
        </button>
        {selfReviewGate ? <p className="mt-2 text-[11px] text-c-text-muted">{isPolish ? selfReviewGate.pl : selfReviewGate.en}</p> : null}
      </section>

      {/* Manager review */}
      <section className="rounded-lg border border-c-border-subtle bg-c-surface p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-c-text">{okrReviewTypeLabel('manager', isPolish)}</h3>
          {managerReview ? <StatusChip label={okrReviewStatusLabel(managerReview.status, isPolish)} tone={OKR_REVIEW_STATUS_TONE[managerReview.status]} /> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={pending !== null || !!managerReviewSubmitGate}
            title={managerReviewSubmitGate ? (isPolish ? managerReviewSubmitGate.pl : managerReviewSubmitGate.en) : undefined}
            data-testid="okr-review-manager-submit"
            onClick={() =>
              run(
                'manager-submit',
                submitOkrSetForManagerReview(set.setId, { expectedVersion: managerReview?.rowVersion ?? 0, idempotencyKey: newOkrWorkspaceIdempotencyKey() })
              )
            }
          >
            {pending === 'manager-submit' ? (isPolish ? 'Wysyłanie…' : 'Sending…') : isPolish ? 'Złóż ocenę managera' : 'Submit manager review'}
          </button>
          <button
            type="button"
            className={BTN_GHOST}
            disabled={pending !== null || !managerReview || managerReview.status !== 'submitted'}
            data-testid="okr-review-manager-approve"
            onClick={() =>
              managerReview &&
              run(
                'manager-approve',
                approveOkrSetManagerReview(set.setId, { expectedVersion: managerReview.rowVersion, idempotencyKey: newOkrWorkspaceIdempotencyKey() })
              )
            }
          >
            {pending === 'manager-approve' ? (isPolish ? 'Trwa…' : 'Working…') : isPolish ? 'Zaakceptuj' : 'Approve'}
          </button>
          <button
            type="button"
            className={BTN_GHOST}
            disabled={pending !== null || !managerReview || managerReview.status !== 'submitted'}
            data-testid="okr-review-manager-request-changes"
            onClick={() => {
              if (!managerReview) return;
              const notes = window.prompt(isPolish ? 'Uwagi do poprawek (opcjonalnie)' : 'Change-request notes (optional)') ?? undefined;
              run(
                'manager-request-changes',
                requestChangesOnOkrSetManagerReview(set.setId, {
                  expectedVersion: managerReview.rowVersion,
                  changeRequestNotes: notes ?? null,
                  idempotencyKey: newOkrWorkspaceIdempotencyKey(),
                })
              );
            }}
          >
            {isPolish ? 'Żądaj poprawek' : 'Request changes'}
          </button>
        </div>
        {managerReviewSubmitGate ? <p className="mt-2 text-[11px] text-c-text-muted">{isPolish ? managerReviewSubmitGate.pl : managerReviewSubmitGate.en}</p> : null}
      </section>

      {/* Final score */}
      <section className="rounded-lg border border-c-border-subtle bg-c-surface p-4">
        <h3 className="text-sm font-semibold text-c-text mb-2">{isPolish ? 'Ocena końcowa (Zestaw)' : 'Final score (Set)'}</h3>
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={pending !== null}
          data-testid="okr-review-final-score"
          onClick={() =>
            run('final-score', finalScoreOkrSet(set.setId, { expectedVersion: set.rowVersion, idempotencyKey: newOkrWorkspaceIdempotencyKey() }), () =>
              setNotice(isPolish ? 'Ocena końcowa policzona dla wszystkich celów.' : 'Final score computed for every objective.')
            )
          }
        >
          {pending === 'final-score' ? (isPolish ? 'Liczenie…' : 'Scoring…') : isPolish ? 'Policz ocenę końcową' : 'Compute final score'}
        </button>
      </section>

      {/* Reflection per objective */}
      <section className="rounded-lg border border-c-border-subtle bg-c-surface p-4">
        <h3 className="text-sm font-semibold text-c-text mb-3">{isPolish ? 'Refleksja per cel' : 'Reflection per objective'}</h3>
        <div className="space-y-4">
          {(objectives ?? []).map((o) => {
            const draft = draftFor(o.objectiveId);
            const savedVersion = reflectionVersions[o.objectiveId] ?? 0;
            return (
              <div key={o.objectiveId} className="rounded-lg border border-c-border-subtle p-3">
                <p className="text-sm font-medium text-c-text mb-2">{o.title}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(
                    [
                      ['whatWorked', isPolish ? 'Co zadziałało' : 'What worked'],
                      ['whatDidNotWork', isPolish ? 'Co nie zadziałało' : "What didn't work"],
                      ['why', isPolish ? 'Dlaczego' : 'Why'],
                      ['learning', isPolish ? 'Czego się nauczono' : 'Learning'],
                      ['nextCycleChange', isPolish ? 'Zmiana w kolejnym cyklu' : 'Next-cycle change'],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-[10px] font-semibold uppercase tracking-wide text-c-text-muted mb-1">{label}</label>
                      <textarea
                        value={draft[field]}
                        onChange={(e) => setReflectionDrafts((prev) => ({ ...prev, [o.objectiveId]: { ...draftFor(o.objectiveId), [field]: e.target.value } }))}
                        className="w-full min-h-[52px] rounded-lg border border-c-border bg-c-surface px-2 py-1.5 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                        data-testid={`okr-reflection-${field}-${o.objectiveId}`}
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-c-text-muted mb-1">
                      {isPolish ? 'Dyspozycja' : 'Disposition'}
                    </label>
                    <select
                      value={draft.disposition}
                      onChange={(e) =>
                        setReflectionDrafts((prev) => ({
                          ...prev,
                          [o.objectiveId]: { ...draftFor(o.objectiveId), disposition: e.target.value as OkrReflectionDisposition | '' },
                        }))
                      }
                      className="w-full h-8 rounded-lg border border-c-border bg-c-surface px-2 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      <option value="">—</option>
                      {(Object.keys(OKR_REFLECTION_DISPOSITION_LABELS) as OkrReflectionDisposition[]).map((d) => (
                        <option key={d} value={d}>
                          {isPolish ? OKR_REFLECTION_DISPOSITION_LABELS[d].pl : OKR_REFLECTION_DISPOSITION_LABELS[d].en}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  className={`${BTN_GHOST} mt-2`}
                  disabled={pending !== null}
                  data-testid={`okr-reflection-save-${o.objectiveId}`}
                  onClick={() =>
                    run(
                      `reflection-${o.objectiveId}`,
                      recordObjectiveReflection(o.objectiveId, {
                        setId: set.setId,
                        expectedVersion: savedVersion,
                        whatWorked: draft.whatWorked || null,
                        whatDidNotWork: draft.whatDidNotWork || null,
                        why: draft.why || null,
                        learning: draft.learning || null,
                        nextCycleChange: draft.nextCycleChange || null,
                        disposition: draft.disposition || null,
                        idempotencyKey: newOkrWorkspaceIdempotencyKey(),
                      }).then((res) => {
                        setReflectionVersions((prev) => ({ ...prev, [o.objectiveId]: res.reflection.rowVersion }));
                      })
                    )
                  }
                >
                  {pending === `reflection-${o.objectiveId}` ? (isPolish ? 'Zapisywanie…' : 'Saving…') : isPolish ? 'Zapisz refleksję' : 'Save reflection'}
                </button>
              </div>
            );
          })}
          {(objectives ?? []).length === 0 ? <p className="text-sm text-c-text-muted">{isPolish ? 'Ten zestaw nie ma jeszcze celów.' : 'This set has no objectives yet.'}</p> : null}
        </div>
      </section>

      {/* Close + carry-forward */}
      <section className="rounded-lg border border-c-border-subtle bg-c-surface p-4">
        <h3 className="text-sm font-semibold text-c-text mb-2">{isPolish ? 'Zamknięcie i przeniesienie' : 'Close & carry forward'}</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={BTN_DANGER}
            disabled={pending !== null || !!closeGate}
            title={closeGate ? (isPolish ? closeGate.pl : closeGate.en) : undefined}
            data-testid="okr-review-close"
            onClick={() =>
              run('close', closeOkrSet(set.setId, { expectedVersion: set.rowVersion, idempotencyKey: newOkrWorkspaceIdempotencyKey() }).then((res) => onSetChanged(res.set)))
            }
          >
            {pending === 'close' ? (isPolish ? 'Zamykanie…' : 'Closing…') : isPolish ? 'Zamknij zestaw' : 'Close set'}
          </button>
          <button
            type="button"
            className={BTN_GHOST}
            disabled={pending !== null || !!carryForwardGate}
            title={carryForwardGate ? (isPolish ? carryForwardGate.pl : carryForwardGate.en) : undefined}
            data-testid="okr-review-carry-forward"
            onClick={() => {
              const targetCycleId = window.prompt(isPolish ? 'Docelowy cykl (UUID) — wklej identyfikator' : 'Target cycle (UUID) — paste the id');
              if (!targetCycleId) return;
              run('carry-forward', carryForwardOkrSet(set.setId, { targetCycleId: targetCycleId.trim(), idempotencyKey: newOkrWorkspaceIdempotencyKey() }), () =>
                setNotice(isPolish ? 'Zestaw przeniesiony na kolejny cykl.' : 'Set carried forward to the next cycle.')
              );
            }}
          >
            {pending === 'carry-forward' ? (isPolish ? 'Przenoszenie…' : 'Carrying forward…') : isPolish ? 'Przenieś na kolejny cykl' : 'Carry forward'}
          </button>
        </div>
        {closeGate ? <p className="mt-2 text-[11px] text-c-text-muted">{isPolish ? closeGate.pl : closeGate.en}</p> : null}
        {carryForwardGate ? <p className="mt-1 text-[11px] text-c-text-muted">{isPolish ? carryForwardGate.pl : carryForwardGate.en}</p> : null}
        <p className="mt-2 text-[11px] text-c-text-muted">
          {isPolish
            ? 'Zamknięcie może dodatkowo wymagać zaakceptowanej oceny managera / złożonej samooceny / kompletnej refleksji na każdym celu, zależnie od polityki Programu — ten klient nie zna polityki z wyprzedzeniem; realny powód odmowy z serwera pokaże się tutaj jako błąd.'
            : "Closing may additionally require an approved manager review / submitted self-review / complete reflection on every objective, depending on Program policy — this client does not know the policy ahead of time; the server's real denial reason will surface here as an error."}
        </p>
      </section>
    </div>
  );
};

export default OkrReviewReflectionView;

export { OkrWorkspaceApiError };
