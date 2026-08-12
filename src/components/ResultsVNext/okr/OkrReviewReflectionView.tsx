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
 *
 * D13 (RN-G5 lane `teresa`, 2026-08-12): "Poproś Teresę o szkic refleksji"
 * next to each Objective's "Zapisz refleksję" routes the `reflection_synthesis`
 * advisor mode through the shared, governed P08 propose→approve/reject→
 * execute→audit lifecycle (`okrTeresaReflectionDraft.ts`). See that file's
 * header for a real, confirmed gap this wiring works around honestly: OKR
 * has no REST route for a second "draft disposition" decision (unlike
 * ROI), so Teresa's draft is offered back to the human as a client-side
 * "insert into fields" convenience only — the pre-existing "Zapisz
 * refleksję" button (untouched) remains the ONLY path that writes the real
 * narrative fields, with or without Teresa's involvement.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';

import { StatusChip } from '@/components/ui/primitives';

import type { OkrSetDto } from './okrApi';
import { listObjectivesForSet, type OkrObjectiveWithKeyResultsDto } from './okrObjectiveApi';
import { OkrActionDialog } from './OkrActionDialog';
import { OkrCarryForwardDialog } from './OkrCarryForwardDialog';
import { toUserFacingErrorMessage } from '../shared/errorMessage';
import { TeresaProposalPanel } from '../teresa/TeresaProposalPanel';
import {
  buildOkrReflectionHandoffContext,
  buildOkrReflectionSuggestion,
  buildOkrReflectionTargetPayload,
  extractOkrReflectionRowVersionFromHandoffResult,
  okrReflectionTeresaConsequencePreview,
} from './okrTeresaReflectionDraft';
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
  // RN-G5 lane `teresa` (2026-08-12) — GENERATION gate for `reflection_synthesis`
  // (see file header + `okrTeresaReflectionDraft.ts`). `askTeresaKey` is a
  // fresh idempotency key per open ATTEMPT, same convention as ROI's
  // `askTeresaKey` in `RoiCaseLearnWorkspace.tsx`.
  const [askTeresaObjectiveId, setAskTeresaObjectiveId] = useState<string | null>(null);
  const [askTeresaKey, setAskTeresaKey] = useState('');
  // Teresa's draft text is NOT re-fetchable (no GET endpoint — see file
  // header) — kept in local session state from the successful `execute`
  // response only, purely so the human can review it and choose to insert
  // it into the manual fields below. Never auto-inserted.
  const [teresaDraftByObjective, setTeresaDraftByObjective] = useState<Record<string, string>>({});

  // TDZ FIX (2026-08-11): `load`, `selfReview` and `managerReview` used to be
  // declared BELOW the dialog callbacks that list them as dependencies, so the
  // dependency arrays read them inside their temporal dead zone. Declared here,
  // before their first use.
  const load = useCallback(() => {
    setError(null);
    Promise.all([listOkrSetReviews(set.setId), listObjectivesForSet(set.setId)])
      .then(([r, o]) => {
        setReviews(r);
        setObjectives(o);
      })
      // RN-G5 polish: plain list-load failure (reviews + objectives), no
      // server business-rule payload involved here — unlike the write
      // actions below (`run()`, request-changes, carry-forward), which stay
      // untouched: this file's own header documents that a Close-gate
      // rejection is deliberately surfaced verbatim ("the honest source of
      // truth"), since the client cannot know the pinned policy value any
      // other way. This catch has no such rationale — it is the ordinary
      // "couldn't load the tab" case, so it gets the same translated,
      // generic message every other ResultsVNext load failure gets.
      .catch((err) => setError(toUserFacingErrorMessage(err, isPolish)));
  }, [set.setId]);

  useEffect(() => {
    load();
  }, [load]);

  const selfReview = (reviews ?? []).find((r) => r.reviewType === 'self') ?? null;
  const managerReview = (reviews ?? []).find((r) => r.reviewType === 'manager') ?? null;

  // "Request changes" dialog (replaces `window.prompt` — RN-G3 prompt-removal
  // pass, 2026-08-11). Kept OUTSIDE `run()`/`pending` on purpose: a rejected
  // submit must keep the dialog open with the server's error shown inline,
  // not bounce the user back to the page-level error banner and lose their
  // typed notes.
  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const [requestChangesBusy, setRequestChangesBusy] = useState(false);
  const [requestChangesError, setRequestChangesError] = useState<string | null>(null);
  const [requestChangesConflict, setRequestChangesConflict] = useState(false);

  const submitRequestChanges = useCallback(
    (values: Record<string, string>) => {
      if (!managerReview) return;
      setRequestChangesBusy(true);
      setRequestChangesError(null);
      setRequestChangesConflict(false);
      requestChangesOnOkrSetManagerReview(set.setId, {
        expectedVersion: managerReview.rowVersion,
        changeRequestNotes: values.notes || null,
        idempotencyKey: newOkrWorkspaceIdempotencyKey(),
      })
        .then(() => {
          setRequestChangesOpen(false);
          load();
        })
        .catch((err) => {
          setRequestChangesConflict(err instanceof OkrWorkspaceApiError && err.status === 409);
          setRequestChangesError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => setRequestChangesBusy(false));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [managerReview, set.setId, load]
  );

  // "Carry forward" dialog (replaces `window.prompt` — same pass). Same
  // reasoning as above: keeps the picked cycle + server error visible in
  // the dialog on failure instead of routing through the page banner.
  const [carryForwardOpen, setCarryForwardOpen] = useState(false);
  const [carryForwardBusy, setCarryForwardBusy] = useState(false);
  const [carryForwardError, setCarryForwardError] = useState<string | null>(null);
  const [carryForwardConflict, setCarryForwardConflict] = useState(false);

  const submitCarryForward = useCallback(
    (targetCycleId: string) => {
      setCarryForwardBusy(true);
      setCarryForwardError(null);
      setCarryForwardConflict(false);
      carryForwardOkrSet(set.setId, { targetCycleId, idempotencyKey: newOkrWorkspaceIdempotencyKey() })
        .then(() => {
          setCarryForwardOpen(false);
          setNotice(isPolish ? 'Zestaw przeniesiony na kolejny cykl.' : 'Set carried forward to the next cycle.');
          load();
        })
        .catch((err) => {
          setCarryForwardConflict(err instanceof OkrWorkspaceApiError && err.status === 409);
          setCarryForwardError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => setCarryForwardBusy(false));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [set.setId, isPolish, load]
  );


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
    <>
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
              setRequestChangesError(null);
              setRequestChangesConflict(false);
              setRequestChangesOpen(true);
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
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <button
                    type="button"
                    className={BTN_GHOST}
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
                  {/* RN-G5 lane `teresa` — GENERATION trigger. Always
                      available (no state gate beyond `pending`) since a
                      reflection draft is optional at any point before
                      close, unlike KPI's phase-gated RCA action. */}
                  <button
                    type="button"
                    className={BTN_GHOST}
                    disabled={pending !== null}
                    title={
                      isPolish
                        ? 'Poproś Teresę o szkic refleksji przez zarządzaną ścieżkę (propozycja → zatwierdzenie → wykonanie → audyt)'
                        : "Ask Teresa for a reflection draft through the governed pipeline (propose → approve → execute → audit)"
                    }
                    data-testid={`okr-reflection-ask-teresa-${o.objectiveId}`}
                    onClick={() => {
                      setAskTeresaKey(`${o.objectiveId}-${Date.now()}`);
                      setAskTeresaObjectiveId(o.objectiveId);
                    }}
                  >
                    <Sparkles size={13} />
                    {isPolish ? 'Poproś Teresę o szkic refleksji' : 'Ask Teresa for a reflection draft'}
                  </button>
                </div>
                {teresaDraftByObjective[o.objectiveId] ? (
                  <div
                    className="mt-2 rounded-lg border border-c-border bg-c-surface-raised p-2"
                    data-testid={`okr-reflection-teresa-draft-${o.objectiveId}`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted mb-1">
                      {isPolish ? 'Szkic Teresy (zapisany, jeszcze nie w polach)' : "Teresa's draft (saved, not yet in the fields)"}
                    </p>
                    <p className="text-xs text-c-text whitespace-pre-wrap">{teresaDraftByObjective[o.objectiveId]}</p>
                    <button
                      type="button"
                      className={`${BTN_GHOST} mt-2`}
                      data-testid={`okr-reflection-insert-teresa-draft-${o.objectiveId}`}
                      onClick={() =>
                        setReflectionDrafts((prev) => ({
                          ...prev,
                          [o.objectiveId]: { ...draftFor(o.objectiveId), whatWorked: teresaDraftByObjective[o.objectiveId] },
                        }))
                      }
                    >
                      {isPolish ? 'Wstaw szkic Teresy do pól' : "Insert Teresa's draft into the fields"}
                    </button>
                  </div>
                ) : null}
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
              setCarryForwardError(null);
              setCarryForwardConflict(false);
              setCarryForwardOpen(true);
            }}
          >
            {isPolish ? 'Przenieś na kolejny cykl' : 'Carry forward'}
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

    <OkrActionDialog
      open={requestChangesOpen}
      title={isPolish ? 'Żądaj poprawek' : 'Request changes'}
      description={isPolish ? `Zestaw: ${set.title}` : `Set: ${set.title}`}
      fields={[{ id: 'notes', label: { pl: 'Uwagi do poprawek', en: 'Change-request notes' }, required: false }]}
      isPolish={isPolish}
      onClose={() => (requestChangesBusy ? undefined : setRequestChangesOpen(false))}
      onSubmit={submitRequestChanges}
      submitLabel={isPolish ? 'Żądaj poprawek' : 'Request changes'}
      busy={requestChangesBusy}
      errorMessage={requestChangesError}
      isConflict={requestChangesConflict}
    />

    <OkrCarryForwardDialog
      open={carryForwardOpen}
      programId={set.programId}
      isPolish={isPolish}
      onClose={() => (carryForwardBusy ? undefined : setCarryForwardOpen(false))}
      onSubmit={submitCarryForward}
      busy={carryForwardBusy}
      errorMessage={carryForwardError}
      isConflict={carryForwardConflict}
    />

    {askTeresaObjectiveId
      ? (() => {
          const objective = (objectives ?? []).find((o) => o.objectiveId === askTeresaObjectiveId);
          if (!objective) return null;
          const suggestion = buildOkrReflectionSuggestion({ set, objective, isPolish });
          const sessionId = `okr-reflection-teresa-${objective.objectiveId}`;
          const expectedVersion = reflectionVersions[objective.objectiveId] ?? 0;
          return (
            <TeresaProposalPanel
              open={!!askTeresaObjectiveId}
              onClose={() => setAskTeresaObjectiveId(null)}
              isPolish={isPolish}
              title={isPolish ? 'Poproś Teresę o szkic refleksji' : 'Ask Teresa for a reflection draft'}
              targetModule="okr"
              sessionId={sessionId}
              idempotencyKey={askTeresaKey}
              buildHandoffContext={() =>
                buildOkrReflectionHandoffContext({
                  set,
                  objective,
                  organizationId: set.organizationId,
                  suggestion,
                  sessionId,
                })
              }
              buildTargetPayload={() =>
                buildOkrReflectionTargetPayload({ set, objective, expectedVersion, suggestion })
              }
              renderProposedChange={() => (
                <p className="whitespace-pre-wrap" data-testid="teresa-okr-draft-text">
                  {suggestion.draftReflectionText}
                </p>
              )}
              evidenceBreakdown={suggestion.evidenceBreakdown}
              evidencePointers={suggestion.evidencePointers}
              consequencePreview={okrReflectionTeresaConsequencePreview(isPolish)}
              onCompleted={(execution) => {
                // D13 "przeładowanie i zimne otwarcie": there is no GET
                // endpoint to re-fetch the reflection row (documented gap,
                // see `okrTeresaReflectionDraft.ts`), so — same convention
                // as this component's OWN manual-save path just above —
                // the CAS version Teresa's execute actually wrote is read
                // straight from `handoff_result.row_version` and fed into
                // the SAME session cache the manual path uses, so a
                // following manual "Save reflection" does not stale-CAS
                // against a version this client never learned about.
                const rowVersion = extractOkrReflectionRowVersionFromHandoffResult(execution.handoff_result);
                if (rowVersion != null) {
                  setReflectionVersions((prev) => ({ ...prev, [objective.objectiveId]: rowVersion }));
                }
                setTeresaDraftByObjective((prev) => ({ ...prev, [objective.objectiveId]: suggestion.draftReflectionText }));
              }}
              onManualFallback={() => setAskTeresaObjectiveId(null)}
            />
          );
        })()
      : null}
    </>
  );
};

export default OkrReviewReflectionView;

export { OkrWorkspaceApiError };
