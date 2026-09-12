import { Api } from '@/services/api';
import { enumLabel } from '@/utils/enumLabel';
import { DefinitionCardContent } from './DefinitionCardContent';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  decideDefinitionApproval,
  readDefinitionApproval,
  requestDefinitionApproval,
  type DefinitionApprovalRead,
} from '@/services/initiatives-execution/definitionApprovalApi';

/** Inline content for the existing Gates card and active Decisions presenter. */
function DefinitionApprovalContentForInitiative({
  initiativeId,
  decisionId,
  onChanged,
  readOnly = false,
}: {
  initiativeId: string;
  decisionId?: string;
  onChanged?: () => void;
  readOnly?: boolean;
}) {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const { i18n, t } = useTranslation();
  const pl = i18n.language.startsWith('pl');
  const [read, setRead] = useState<DefinitionApprovalRead | null>(null);
  const [error, setError] = useState('');
  const [readiness, setReadiness] = useState<{
    readiness: string;
    findings: Array<{ findingId: string; cardKey: string; message: string; rule: string }>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [authority, setAuthority] = useState('');
  const [due, setDue] = useState('');
  const [rationale, setRationale] = useState('');
  const reload = async () => {
    const next = await readDefinitionApproval(initiativeId);
    if (!active.current) return;
    if (decisionId && next.enabled && next.decision?.decisionId !== decisionId)
      throw new Error(
        pl ? 'Nie znaleziono tej decyzji inicjatywy.' : 'This initiative decision was not found.'
      );
    const nextReadiness = next.enabled
      ? await Api.get(
          `/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/gates/definition/readiness`
        )
      : null;
    if (!active.current) return;
    setReadiness(nextReadiness);
    setRead(next);
  };
  useEffect(() => {
    setRead(null);
    setError('');
    void reload().catch((e) => active.current && setError(e.message));
  }, [initiativeId, decisionId]);
  const act = async (fn: () => Promise<unknown>) => {
    if (!active.current) return;
    setBusy(true);
    setError('');
    try {
      await fn();
      if (!active.current) return;
      await reload();
      if (!active.current) return;
      setRationale('');
      onChanged?.();
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (active.current) setBusy(false);
    }
  };
  if (read && !read.enabled) return null;
  return (
    <section
      aria-label={pl ? 'Zatwierdzenie definicji' : 'Definition approval'}
      className="space-y-3 rounded-lg border border-c-border p-4"
    >
      <h3 className="font-semibold">{pl ? 'Zatwierdzenie definicji' : 'Definition approval'}</h3>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {!read && !error && <p>{pl ? 'Wczytywanie…' : 'Loading…'}</p>}
      {read && (
        <>
          <p>
            {pl ? 'Stan inicjatywy' : 'Initiative state'}:{' '}
            {enumLabel('initiativeLifecycle', read.lifecycleState, t)}
          </p>
          {read.decision && (
            <>
              <p>
                {pl ? 'Decyzja' : 'Decision'}:{' '}
                {
                  {
                    PENDING: pl ? 'Oczekuje' : 'Pending',
                    RETURNED: pl ? 'Do poprawy' : 'Returned for changes',
                    APPROVED: pl ? 'Zatwierdzona' : 'Approved',
                    REJECTED: pl ? 'Odrzucona' : 'Rejected',
                  }[read.decision.status]
                }
              </p>
              {read.decision.rationale && <p>{read.decision.rationale}</p>}
            </>
          )}
          {readiness && readiness.readiness !== 'READY' && (
            <p role="status">
              {pl
                ? 'Definicja wymaga uzupełnienia lub niezależnego przeglądu kart. Otwórz treść kart poniżej.'
                : 'Definition requires completed cards and independent review. Open the card content below.'}
            </p>
          )}
          <DefinitionCardContent
            initiativeId={initiativeId}
            actorId={read.actorId}
            participants={read.participants}
            canEdit={!readOnly && read.capabilities.edit}
            canReview={!readOnly && read.capabilities.review}
            onChanged={reload}
          />
          {!readOnly && read.capabilities.request && (
            <>
              <label className="block">
                {pl ? 'Osoba zatwierdzająca' : 'Approver'}
                <select
                  aria-label={pl ? 'Osoba zatwierdzająca' : 'Approver'}
                  value={authority}
                  onChange={(e) => setAuthority(e.target.value)}
                  className="block w-full bg-c-bg border border-c-border p-2"
                >
                  <option value="">{pl ? 'Wybierz osobę' : 'Select a person'}</option>
                  {read.authorities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name || a.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                {pl ? 'Termin decyzji' : 'Decision deadline'}
                <input
                  type="datetime-local"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="block bg-c-bg border border-c-border p-2"
                />
              </label>
              <button
                disabled={busy || !authority || !due || readiness?.readiness !== 'READY'}
                onClick={() =>
                  void act(() =>
                    requestDefinitionApproval(read, authority, new Date(due).toISOString())
                  )
                }
              >
                {read.decision
                  ? pl
                    ? 'Zgłoś ponownie'
                    : 'Resubmit'
                  : pl
                    ? 'Poproś o zatwierdzenie definicji'
                    : 'Request Definition approval'}
              </button>
              {!read.authorities.length && (
                <p>
                  {pl
                    ? 'Brak uprawnionej osoby w polityce projektu.'
                    : 'No eligible approver in the project policy.'}
                </p>
              )}
            </>
          )}
          {!readOnly && read.capabilities.decide && (
            <>
              <label className="block">
                {pl ? 'Uzasadnienie decyzji' : 'Decision rationale'}
                <textarea
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  className="block w-full bg-c-bg border border-c-border p-2"
                />
              </label>
              <div className="flex gap-4">
                <button
                  disabled={busy || !rationale.trim()}
                  onClick={() =>
                    void act(() => decideDefinitionApproval(read, 'RETURNED', rationale.trim()))
                  }
                >
                  {pl ? 'Zwróć do poprawy' : 'Return for changes'}
                </button>
                <button
                  disabled={busy || !rationale.trim()}
                  onClick={() =>
                    void act(() => decideDefinitionApproval(read, 'APPROVED', rationale.trim()))
                  }
                >
                  {pl ? 'Zatwierdź definicję' : 'Approve Definition'}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

/** Identity boundary: a navigation never carries editable state or pending reads to another record. */
export function DefinitionApprovalContent(
  props: Parameters<typeof DefinitionApprovalContentForInitiative>[0]
) {
  return (
    <DefinitionApprovalContentForInitiative
      key={`${props.initiativeId}:${props.decisionId || ''}`}
      {...props}
    />
  );
}
