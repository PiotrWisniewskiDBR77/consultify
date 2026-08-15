import { Check, CircleAlert, Loader2, Plus, RefreshCw, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type MeetingCoreAggregate,
  meetingCoreApi,
  type MeetingCoreOutput,
  type MeetingLifecycleStatus,
} from '@/services/api/meetingCore.api';

const stageLabels: Record<MeetingLifecycleStatus, { pl: string; en: string }> = {
  DRAFT: { pl: 'Szkic', en: 'Draft' },
  PREPARING: { pl: 'Przygotowanie', en: 'Preparing' },
  READY: { pl: 'Gotowe', en: 'Ready' },
  LIVE: { pl: 'W trakcie', en: 'Live' },
  CLOSING: { pl: 'Podsumowanie', en: 'Closing' },
  CLOSED: { pl: 'Zamknięte', en: 'Closed' },
  CANCELLED: { pl: 'Anulowane', en: 'Cancelled' },
};

const nextStage: Partial<
  Record<MeetingLifecycleStatus, { transition: string; pl: string; en: string }>
> = {
  DRAFT: { transition: 'START_PREPARING', pl: 'Rozpocznij przygotowanie', en: 'Start preparation' },
  PREPARING: { transition: 'MARK_READY', pl: 'Oznacz jako gotowe', en: 'Mark ready' },
  READY: { transition: 'START_LIVE', pl: 'Rozpocznij spotkanie', en: 'Start meeting' },
  LIVE: { transition: 'START_CLOSING', pl: 'Przejdź do podsumowania', en: 'Start wrap-up' },
  CLOSING: { transition: 'CLOSE', pl: 'Zamknij protokół', en: 'Close minutes' },
};

const outputStatusLabel = (output: MeetingCoreOutput, isPolish: boolean): string => {
  const labels: Record<MeetingCoreOutput['status'], [string, string]> = {
    PROPOSED: ['Do akceptacji', 'Awaiting approval'],
    APPROVED: ['Zatwierdzone', 'Approved'],
    REJECTED: ['Odrzucone', 'Rejected'],
    MATERIALIZING: ['Tworzenie…', 'Creating…'],
    MATERIALIZED: ['Utworzone', 'Created'],
    MATERIALIZATION_FAILED: ['Wymaga ponowienia', 'Retry required'],
  };
  return labels[output.status][isPolish ? 0 : 1];
};

const outputTitle = (output: MeetingCoreOutput): string =>
  String(output.proposedPayload.title || output.proposedPayload.name || '').trim() ||
  (output.outputKind === 'task' ? 'Task' : 'Decision');

export const MeetingCorePanel: React.FC<{ meetingId: string; isPolish: boolean }> = ({
  meetingId,
  isPolish,
}) => {
  const [aggregate, setAggregate] = useState<MeetingCoreAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalKind, setProposalKind] = useState<'task' | 'decision'>('task');
  const proposalKeyRef = useRef<string | null>(null);

  const copy = useMemo(
    () => ({
      title: isPolish ? 'Protokół i ustalenia' : 'Minutes and outcomes',
      intro: isPolish
        ? 'Jedno miejsce na notatki, decyzje i zadania wymagające zatwierdzenia.'
        : 'One place for notes, decisions, and tasks that require approval.',
      enable: isPolish ? 'Włącz protokół spotkania' : 'Enable governed minutes',
      addNote: isPolish ? 'Dodaj notatkę' : 'Add note',
      notePlaceholder: isPolish
        ? 'Zapisz fakt, ustalenie albo ryzyko…'
        : 'Capture a fact, agreement, or risk…',
      proposalPlaceholder: isPolish ? 'Nazwij zadanie albo decyzję…' : 'Name the task or decision…',
      propose: isPolish ? 'Dodaj do akceptacji' : 'Propose for approval',
      emptyNotes: isPolish ? 'Nie ma jeszcze notatek.' : 'No notes yet.',
      emptyOutputs: isPolish
        ? 'Nie ma jeszcze ustaleń do zatwierdzenia.'
        : 'No outcomes awaiting review.',
      retry: isPolish ? 'Spróbuj ponownie' : 'Try again',
    }),
    [isPolish]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAggregate(await meetingCoreApi.getAggregate(meetingId));
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.retry);
    } finally {
      setLoading(false);
    }
  }, [copy.retry, meetingId]);

  useEffect(() => {
    proposalKeyRef.current = null;
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.retry);
    } finally {
      setBusy(false);
    }
  };

  const handlePropose = async (): Promise<void> => {
    const title = proposalTitle.trim();
    if (!title) return;
    const key = proposalKeyRef.current || crypto.randomUUID();
    proposalKeyRef.current = key;
    await run(async () => {
      await meetingCoreApi.proposeOutput(meetingId, proposalKind, title, key);
      setProposalTitle('');
      proposalKeyRef.current = null;
    });
  };

  const lifecycle = aggregate?.meeting.lifecycleStatus ?? null;
  const stageAction = lifecycle ? nextStage[lifecycle] : undefined;
  const activeNotes = aggregate?.notes.filter((item) => item.status !== 'archived') ?? [];

  return (
    <section
      className="rounded-2xl border border-c-border-subtle bg-c-surface overflow-hidden"
      aria-label={copy.title}
    >
      <div className="flex items-start justify-between gap-4 border-b border-c-border-subtle px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-c-text">
            <Sparkles size={16} className="text-c-primary" />
            {copy.title}
          </div>
          <p className="mt-1 text-xs text-c-text-muted">{copy.intro}</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full p-2 text-c-text-muted hover:bg-c-surface-raised"
          aria-label={copy.retry}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 p-5 text-sm text-c-text-muted">
          <Loader2 size={16} className="animate-spin" />
          {isPolish ? 'Ładowanie protokołu…' : 'Loading minutes…'}
        </div>
      ) : error && !aggregate ? (
        <div className="p-5">
          <div className="flex items-center gap-2 text-sm text-c-danger">
            <CircleAlert size={16} />
            {error}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 text-sm font-medium text-c-text underline"
          >
            {copy.retry}
          </button>
        </div>
      ) : aggregate && !lifecycle ? (
        <div className="p-5">
          <p className="text-sm text-c-text-secondary">
            {isPolish
              ? 'To spotkanie korzysta ze starszego zapisu. Możesz włączyć protokół bez zmiany jego identyfikatora ani danych.'
              : 'This meeting uses the earlier record. Enable governed minutes without changing its identity or data.'}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => meetingCoreApi.adopt(meetingId))}
            className="mt-4 rounded-full bg-c-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {copy.enable}
          </button>
        </div>
      ) : aggregate && lifecycle ? (
        <div className="grid gap-5 p-5 xl:grid-cols-2">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-c-surface-raised px-3 py-1 text-xs font-semibold text-c-text">
                {stageLabels[lifecycle][isPolish ? 'pl' : 'en']}
              </span>
              {stageAction ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      stageAction.transition === 'CLOSE'
                        ? meetingCoreApi.close(meetingId)
                        : meetingCoreApi.transition(
                            meetingId,
                            stageAction.transition as Parameters<
                              typeof meetingCoreApi.transition
                            >[1]
                          )
                    )
                  }
                  className="rounded-full border border-c-border px-3 py-1 text-xs font-medium text-c-text disabled:opacity-50"
                >
                  {stageAction[isPolish ? 'pl' : 'en']}
                </button>
              ) : null}
            </div>
            <div>
              <div className="flex gap-2">
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={copy.notePlaceholder}
                  className="min-w-0 flex-1 rounded-xl border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text"
                />
                <button
                  type="button"
                  disabled={busy || !note.trim()}
                  onClick={() =>
                    void run(async () => {
                      await meetingCoreApi.addNote(meetingId, note.trim());
                      setNote('');
                    })
                  }
                  className="rounded-xl border border-c-border px-3 text-c-text disabled:opacity-40"
                  aria-label={copy.addNote}
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {activeNotes.length ? (
                  activeNotes.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-xl bg-c-surface-raised px-3 py-2"
                    >
                      <div>
                        <p className="text-sm text-c-text-secondary">{item.content}</p>
                        <span className="mt-1 block text-[11px] text-c-text-muted">
                          {item.authorKind === 'system'
                            ? 'Teresa'
                            : isPolish
                              ? 'Uczestnik'
                              : 'Participant'}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(() => meetingCoreApi.archiveNote(meetingId, item.id))
                        }
                        className="text-xs text-c-text-muted underline underline-offset-2"
                      >
                        {isPolish ? 'Archiwizuj' : 'Archive'}
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-c-text-muted">{copy.emptyNotes}</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="flex gap-2">
              <select
                value={proposalKind}
                onChange={(event) => {
                  setProposalKind(event.target.value as 'task' | 'decision');
                  proposalKeyRef.current = null;
                }}
                className="rounded-xl border border-c-border bg-c-surface px-2 text-sm text-c-text"
              >
                <option value="task">{isPolish ? 'Zadanie' : 'Task'}</option>
                <option value="decision">{isPolish ? 'Decyzja' : 'Decision'}</option>
              </select>
              <input
                value={proposalTitle}
                onChange={(event) => {
                  setProposalTitle(event.target.value);
                  proposalKeyRef.current = null;
                }}
                placeholder={copy.proposalPlaceholder}
                className="min-w-0 flex-1 rounded-xl border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text"
              />
              <button
                type="button"
                disabled={busy || !proposalTitle.trim()}
                onClick={() => void handlePropose()}
                className="rounded-xl bg-c-text px-3 text-sm font-medium text-c-surface disabled:opacity-40"
              >
                {copy.propose}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {aggregate.outputs.length ? (
                aggregate.outputs.map((output) => (
                  <div key={output.id} className="rounded-xl border border-c-border-subtle p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-c-text">{outputTitle(output)}</div>
                        <div className="mt-1 text-xs text-c-text-muted">
                          {outputStatusLabel(output, isPolish)}
                        </div>
                        {output.failureReason ? (
                          <div className="mt-1 text-xs text-c-danger">{output.failureReason}</div>
                        ) : null}
                      </div>
                      <div className="flex gap-1">
                        {output.status === 'PROPOSED' ? (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void run(() => meetingCoreApi.approveOutput(meetingId, output.id))
                              }
                              className="rounded-full p-2 text-c-success hover:bg-c-surface-raised"
                              aria-label={isPolish ? 'Zatwierdź' : 'Approve'}
                            >
                              <Check size={15} />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void run(() => meetingCoreApi.rejectOutput(meetingId, output.id))
                              }
                              className="rounded-full p-2 text-c-danger hover:bg-c-surface-raised"
                              aria-label={isPolish ? 'Odrzuć' : 'Reject'}
                            >
                              <X size={15} />
                            </button>
                          </>
                        ) : null}
                        {output.status === 'APPROVED' ||
                        output.status === 'MATERIALIZATION_FAILED' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void run(() =>
                                meetingCoreApi.materializeOutput(
                                  meetingId,
                                  output.id,
                                  output.idempotencyKey
                                )
                              )
                            }
                            className="rounded-full border border-c-border px-3 py-1 text-xs font-medium text-c-text"
                          >
                            {isPolish ? 'Utwórz' : 'Create'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-c-text-muted">{copy.emptyOutputs}</p>
              )}
            </div>
          </div>
          {error ? (
            <div className="xl:col-span-2 flex items-center gap-2 rounded-xl bg-c-danger/10 px-3 py-2 text-sm text-c-danger">
              <CircleAlert size={16} />
              {error}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
