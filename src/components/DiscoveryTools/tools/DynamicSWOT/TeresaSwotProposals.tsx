/**
 * TeresaSwotProposals (TLS-04) — "Ask Teresa" entry point for the SWOT tool.
 *
 * Teresa proposes SWOT edits (add / update / remove a quadrant item); she never
 * writes to the matrix herself. A proposal only ever changes the SWOT session
 * once the user explicitly clicks Accept, which round-trips through the
 * backend's swot_proposals table. Nothing here mutates useToolStore or the
 * local SWOT quadrant items directly — success is defined ONLY by a confirmed
 * backend response (201 on generate, 200 on accept/reject).
 *
 * Backend contract: POST/GET /api/tools/:toolId/swot-proposals,
 * POST /api/tools/:toolId/swot-proposals/:id/accept|reject (see TLS-04 packet).
 */

import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Api, SwotProposal } from '@/services/api';

type QuadrantId = SwotProposal['quadrant'];

export interface TeresaSwotProposalsProps {
  /** tool_sessions.id for the SWOT session — same id ToolDocumentView calls toolSessionId. */
  toolSessionId: string;
  isPolish?: boolean;
  /** Omit to ask Teresa to propose across all four quadrants at once. */
  quadrantFocus?: QuadrantId;
  className?: string;
}

type GeneratePhase = 'idle' | 'loading' | 'error';
type ErrorKind = 'PROVIDER_ERROR' | 'INVALID_MODEL_RESPONSE' | 'UNKNOWN';

type ProposalIssue =
  | { kind: 'stale'; currentVersion?: number }
  | { kind: 'already-decided'; status?: 'accepted' | 'rejected' }
  | { kind: 'error'; message: string };

const QUADRANT_LABEL: Record<QuadrantId, { en: string; pl: string }> = {
  strengths: { en: 'Strengths', pl: 'Mocne strony' },
  weaknesses: { en: 'Weaknesses', pl: 'Słabe strony' },
  opportunities: { en: 'Opportunities', pl: 'Szanse' },
  threats: { en: 'Threats', pl: 'Zagrożenia' },
};

const OPERATION_LABEL: Record<SwotProposal['operation'], { en: string; pl: string }> = {
  add: { en: 'Add', pl: 'Dodaj' },
  update: { en: 'Update', pl: 'Aktualizacja' },
  remove: { en: 'Remove', pl: 'Usuń' },
};

function confidenceLabel(confidence: number, isPolish: boolean): string {
  const pct = Math.round(Math.max(0, Math.min(1, confidence || 0)) * 100);
  if (confidence >= 0.75) return isPolish ? `Wysoka pewność · ${pct}%` : `High confidence · ${pct}%`;
  if (confidence >= 0.4) return isPolish ? `Średnia pewność · ${pct}%` : `Medium confidence · ${pct}%`;
  return isPolish ? `Niska pewność · ${pct}%` : `Low confidence · ${pct}%`;
}

/* ───────────────────────── single proposal card ───────────────────────── */

function ProposalDecisionCard({
  proposal,
  isPolish,
  isBusy,
  issue,
  isEditing,
  editValue,
  onToggleEdit,
  onEditChange,
  onAccept,
  onReject,
  onRetryWithCurrentVersion,
  onDismissIssue,
  onRefreshList,
}: {
  proposal: SwotProposal;
  isPolish: boolean;
  isBusy: boolean;
  issue?: ProposalIssue;
  isEditing: boolean;
  editValue: string;
  onToggleEdit: () => void;
  onEditChange: (value: string) => void;
  onAccept: () => void;
  onReject: () => void;
  onRetryWithCurrentVersion: (currentVersion: number) => void;
  onDismissIssue: () => void;
  onRefreshList: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const qLabel = QUADRANT_LABEL[proposal.quadrant];
  const opLabel = OPERATION_LABEL[proposal.operation];
  const canEditText = proposal.operation !== 'remove' && !!proposal.proposedAfter;

  return (
    <div className="rounded-2xl border border-c-ai/30 bg-c-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          <span className="inline-flex items-center gap-1 rounded-full border border-c-ai/40 bg-c-ai/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-c-ai">
            <Sparkles size={11} />
            {isPolish ? qLabel.pl : qLabel.en}
          </span>
          <span className="rounded-full border border-c-border-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-secondary">
            {isPolish ? opLabel.pl : opLabel.en}
          </span>
          {expanded ? (
            <ChevronUp size={14} className="text-c-text-muted" />
          ) : (
            <ChevronDown size={14} className="text-c-text-muted" />
          )}
        </button>
        <span className="shrink-0 text-[11px] font-medium text-c-text-muted">
          {confidenceLabel(proposal.confidence, isPolish)}
        </span>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Diff view */}
          <div className="space-y-1.5 rounded-xl bg-c-surface-raised p-3 text-sm">
            {proposal.operation === 'update' && (
              <>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
                  {isPolish ? 'Przed' : 'Before'}
                </div>
                <div className="text-c-text-secondary line-through decoration-c-text-muted/60">
                  {proposal.before?.text || '—'}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
                  {isPolish ? 'Propozycja' : 'Proposed'}
                </div>
              </>
            )}
            {proposal.operation === 'remove' && (
              <>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
                  {isPolish ? 'Do usunięcia' : 'To remove'}
                </div>
                <div className="text-c-danger line-through decoration-c-danger/60">
                  {proposal.before?.text || '—'}
                </div>
              </>
            )}
            {proposal.operation === 'add' && (
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
                {isPolish ? 'Nowy punkt' : 'New point'}
              </div>
            )}
            {proposal.operation !== 'remove' &&
              (isEditing ? (
                <textarea
                  value={editValue}
                  onChange={(e) => onEditChange(e.target.value)}
                  rows={3}
                  autoFocus
                  className="w-full resize-none rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                />
              ) : (
                <div className="font-medium text-c-text">{proposal.proposedAfter?.text || '—'}</div>
              ))}
          </div>

          {/* Sources / assumption */}
          <div>
            {proposal.isAssumption ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-c-warning/40 bg-c-warning/10 px-2.5 py-1 text-[11px] font-medium text-c-warning">
                <AlertTriangle size={12} />
                {isPolish ? 'Założenie — brak cytowanego źródła' : 'Assumption — no cited source'}
              </span>
            ) : proposal.sourceRefs && proposal.sourceRefs.length > 0 ? (
              <div className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
                  {isPolish ? 'Źródła' : 'Sources'}
                </div>
                <ul className="list-inside list-disc space-y-0.5 text-xs text-c-text-secondary">
                  {proposal.sourceRefs.map((ref, idx) => (
                    <li key={`${proposal.id}-src-${idx}`}>{ref}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <span className="text-xs text-c-text-muted">
                {isPolish ? 'Brak podanych źródeł' : 'No sources listed'}
              </span>
            )}
          </div>

          {/* Rationale */}
          {proposal.rationale && (
            <div className="rounded-lg bg-c-surface-raised px-3 py-2 text-xs leading-relaxed text-c-text-secondary">
              {proposal.rationale}
            </div>
          )}

          {/* Conflict / issue states */}
          {issue?.kind === 'stale' && (
            <div className="space-y-2 rounded-lg border border-c-warning/40 bg-c-warning/10 px-3 py-2 text-xs text-c-text">
              <div className="flex items-start gap-1.5">
                <AlertTriangle size={13} className="mt-0.5 shrink-0 text-c-warning" />
                <span>
                  {isPolish
                    ? 'Ta analiza SWOT zmieniła się od momentu, gdy Teresa złożyła tę propozycję. Odśwież, zanim zdecydujesz.'
                    : 'This SWOT changed since Teresa proposed this — refresh to see the latest before deciding.'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onRefreshList}
                  className="inline-flex items-center gap-1 rounded-md border border-c-border-subtle px-2 py-1 text-[11px] font-medium text-c-text-secondary hover:bg-c-surface-raised"
                >
                  <RefreshCw size={12} />
                  {isPolish ? 'Odśwież listę' : 'Refresh list'}
                </button>
                {typeof issue.currentVersion === 'number' && (
                  <button
                    type="button"
                    onClick={() => onRetryWithCurrentVersion(issue.currentVersion as number)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 rounded-md border border-c-ai/40 bg-c-ai/10 px-2 py-1 text-[11px] font-medium text-c-ai hover:bg-c-ai/15 disabled:opacity-50"
                  >
                    {isPolish
                      ? 'Rozumiem, spróbuj z aktualną wersją'
                      : 'I understand, retry with current version'}
                  </button>
                )}
              </div>
            </div>
          )}
          {issue?.kind === 'already-decided' && (
            <div className="space-y-2 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-xs text-c-text">
              <span>
                {isPolish
                  ? `Ktoś już ${issue.status === 'rejected' ? 'odrzucił' : 'zaakceptował'} tę propozycję.`
                  : `Someone already ${issue.status === 'rejected' ? 'rejected' : 'accepted'} this proposal.`}
              </span>
              <div>
                <button
                  type="button"
                  onClick={onDismissIssue}
                  className="inline-flex items-center gap-1 rounded-md border border-c-border-subtle px-2 py-1 text-[11px] font-medium text-c-text-secondary hover:bg-c-surface"
                >
                  {isPolish ? 'Odrzuć z listy' : 'Dismiss'}
                </button>
              </div>
            </div>
          )}
          {issue?.kind === 'error' && (
            <div className="rounded-lg border border-c-danger/40 bg-c-danger/10 px-3 py-2 text-xs text-c-danger">
              {issue.message}
            </div>
          )}

          {/* Actions */}
          {(!issue || issue.kind === 'error') && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onAccept}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 rounded-full border border-c-success/40 bg-c-success/10 px-3 py-1.5 text-xs font-medium text-c-success transition-colors hover:bg-c-success/15 disabled:opacity-50"
              >
                {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {isPolish ? 'Akceptuj' : 'Accept'}
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 rounded-full border border-c-border-subtle bg-c-surface px-3 py-1.5 text-xs font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised disabled:opacity-50"
              >
                <X size={13} />
                {isPolish ? 'Odrzuć' : 'Reject'}
              </button>
              {canEditText && (
                <button
                  type="button"
                  onClick={onToggleEdit}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1.5 rounded-full border border-c-border-subtle bg-c-surface px-3 py-1.5 text-xs font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised disabled:opacity-50"
                >
                  <Pencil size={13} />
                  {isEditing
                    ? isPolish
                      ? 'Anuluj edycję'
                      : 'Cancel edit'
                    : isPolish
                      ? 'Edytuj przed akceptacją'
                      : 'Edit before accepting'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── main component ───────────────────────── */

export function TeresaSwotProposals({
  toolSessionId,
  isPolish = false,
  quadrantFocus,
  className = '',
}: TeresaSwotProposalsProps) {
  const [phase, setPhase] = useState<GeneratePhase>('idle');
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [proposals, setProposals] = useState<SwotProposal[]>([]);
  const [issues, setIssues] = useState<Record<string, ProposalIssue>>({});
  const [decisionBusyId, setDecisionBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  // Local-only tracking of the SWOT session's version, updated from each
  // accept response. There is no existing client-side awareness of
  // tool_sessions.version in this codebase (ToolDocumentView doesn't fetch or
  // pass one down) — see report for the follow-up wiring note. Not required
  // to build accept/reject requests: each SwotProposal already carries its own
  // `expectedVersion` from when Teresa generated it.
  const [, setLastKnownSessionVersion] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // Cancel-via-abort: createSwotProposals is a dedicated fetch() call (mirrors
  // createToolSession/getToolSession/updateToolSession's own style, not the
  // generic Api.post helper), so it accepts a real AbortSignal — clicking
  // Cancel calls controller.abort(), which aborts the in-flight network
  // request itself, not just the UI's reaction to it.
  const cancelledRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const refreshProposals = useCallback(async () => {
    try {
      const res = await Api.listSwotProposals(toolSessionId);
      if (!mountedRef.current) return;
      setProposals((res.proposals || []).filter((p) => p.status === 'pending'));
      setIssues({});
    } catch {
      // best-effort — keep whatever is currently shown, user can retry manually
    }
  }, [toolSessionId]);

  useEffect(() => {
    void refreshProposals();
    // Only on mount / toolSessionId change — refreshProposals itself is stable per toolSessionId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolSessionId]);

  const errorMessage = useMemo(() => {
    if (errorKind === 'PROVIDER_ERROR') {
      return isPolish
        ? 'Teresa jest chwilowo niedostępna.'
        : 'Teresa is temporarily unavailable.';
    }
    if (errorKind === 'INVALID_MODEL_RESPONSE') {
      return isPolish
        ? 'Teresa nie ukończyła tej propozycji poprawnie.'
        : "Teresa couldn't complete this proposal correctly.";
    }
    return isPolish ? 'Teresa nie ukończyła tego zadania — spróbuj ponownie.' : "Teresa couldn't complete this — try again.";
  }, [errorKind, isPolish]);

  const handleGenerate = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    cancelledRef.current = false;
    setPhase('loading');
    setErrorKind(null);
    try {
      const res = await Api.createSwotProposals(
        toolSessionId,
        quadrantFocus ? { quadrantFocus } : undefined,
        { signal: controller.signal }
      );
      if (cancelledRef.current || !mountedRef.current) return;
      setProposals((current) => {
        const byId = new Map(current.map((p) => [p.id, p] as const));
        (res.proposals || []).forEach((p) => byId.set(p.id, p));
        return Array.from(byId.values());
      });
      setPhase('idle');
    } catch (err: any) {
      if (cancelledRef.current || err?.name === 'AbortError' || !mountedRef.current) return;
      const code = String(err?.data?.code || '').toUpperCase();
      setErrorKind(
        code === 'PROVIDER_ERROR' || code === 'INVALID_MODEL_RESPONSE' ? (code as ErrorKind) : 'UNKNOWN'
      );
      setPhase('error');
    }
  }, [toolSessionId, quadrantFocus]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    setPhase('idle');
    setErrorKind(null);
  }, []);

  const handleDecisionError = useCallback(
    (proposalId: string, err: any) => {
      const status = err?.status;
      const code = String(err?.data?.code || '').toUpperCase();
      if (status === 409 && code === 'STALE_VERSION') {
        setIssues((cur) => ({
          ...cur,
          [proposalId]: { kind: 'stale', currentVersion: err?.data?.currentVersion },
        }));
        return;
      }
      if (status === 409 && code === 'ALREADY_DECIDED') {
        setIssues((cur) => ({
          ...cur,
          [proposalId]: { kind: 'already-decided', status: err?.data?.status },
        }));
        return;
      }
      setIssues((cur) => ({
        ...cur,
        [proposalId]: {
          kind: 'error',
          message:
            err?.message ||
            (isPolish ? 'Nie udało się zapisać decyzji.' : 'Failed to save the decision.'),
        },
      }));
    },
    [isPolish]
  );

  const runAccept = useCallback(
    async (proposal: SwotProposal, expectedVersion: number) => {
      setDecisionBusyId(proposal.id);
      try {
        const draft = editDrafts[proposal.id];
        const isEdited =
          editingId === proposal.id &&
          draft !== undefined &&
          draft !== (proposal.proposedAfter?.text ?? '');
        const res = await Api.acceptSwotProposal(toolSessionId, proposal.id, {
          expectedVersion,
          ...(isEdited ? { editedAfter: { text: draft } } : {}),
        });
        if (!mountedRef.current) return;
        setLastKnownSessionVersion(res.session?.version ?? null);
        setProposals((current) => current.map((p) => (p.id === proposal.id ? res.proposal : p)));
        setIssues((cur) => {
          const next = { ...cur };
          delete next[proposal.id];
          return next;
        });
        setEditingId((cur) => (cur === proposal.id ? null : cur));
      } catch (err) {
        if (!mountedRef.current) return;
        handleDecisionError(proposal.id, err);
      } finally {
        if (mountedRef.current) setDecisionBusyId(null);
      }
    },
    [toolSessionId, editDrafts, editingId, handleDecisionError]
  );

  const handleAccept = useCallback(
    (proposal: SwotProposal) => runAccept(proposal, proposal.expectedVersion),
    [runAccept]
  );

  const handleReject = useCallback(
    async (proposal: SwotProposal) => {
      setDecisionBusyId(proposal.id);
      try {
        await Api.rejectSwotProposal(toolSessionId, proposal.id, {});
        if (!mountedRef.current) return;
        setProposals((current) => current.filter((p) => p.id !== proposal.id));
        setIssues((cur) => {
          const next = { ...cur };
          delete next[proposal.id];
          return next;
        });
      } catch (err) {
        if (!mountedRef.current) return;
        handleDecisionError(proposal.id, err);
      } finally {
        if (mountedRef.current) setDecisionBusyId(null);
      }
    },
    [toolSessionId, handleDecisionError]
  );

  const handleDismissIssue = useCallback((proposalId: string) => {
    setIssues((cur) => {
      const next = { ...cur };
      delete next[proposalId];
      return next;
    });
    setProposals((current) => current.filter((p) => p.id !== proposalId));
  }, []);

  const pendingProposals = proposals.filter((p) => p.status === 'pending');

  const quadrantLabel = quadrantFocus ? QUADRANT_LABEL[quadrantFocus] : null;

  return (
    <div className={`rounded-[26px] border border-c-ai/25 bg-c-ai/[0.04] p-4 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-sm font-semibold text-c-ai">
            <Sparkles size={15} />
            {isPolish ? 'Zapytaj Teresę' : 'Ask Teresa'}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-c-text-secondary">
            {quadrantLabel
              ? isPolish
                ? `Teresa zaproponuje zmiany w kwadrancie „${quadrantLabel.pl}". Nic nie zapisze się automatycznie — każdą propozycję akceptujesz lub odrzucasz osobno.`
                : `Teresa will propose changes for the "${quadrantLabel.en}" quadrant. Nothing saves automatically — you accept or reject each proposal.`
              : isPolish
                ? 'Teresa przeanalizuje wszystkie ćwiartki i zaproponuje zmiany. Nic nie zapisze się automatycznie — każdą propozycję akceptujesz lub odrzucasz osobno.'
                : 'Teresa will analyze all four quadrants and propose changes. Nothing saves automatically — you accept or reject each proposal.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={phase === 'loading'}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-c-ai/50 bg-c-ai/10 px-4 py-2 text-sm font-medium text-c-ai transition-colors hover:bg-c-ai/15 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
        >
          {phase === 'loading' ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Sparkles size={15} />
          )}
          {phase === 'loading'
            ? isPolish
              ? 'Teresa myśli…'
              : 'Teresa is thinking…'
            : isPolish
              ? 'Zapytaj Teresę'
              : 'Ask Teresa'}
        </button>
      </div>

      {phase === 'loading' && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-c-ai/30 bg-c-surface px-3 py-2 text-xs text-c-text-secondary">
          <span className="flex items-center gap-2">
            <Loader2 size={13} className="animate-spin text-c-ai" />
            {isPolish ? 'Teresa przygotowuje propozycje…' : 'Teresa is preparing proposals…'}
          </span>
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-1 rounded-md border border-c-border-subtle px-2 py-1 font-medium text-c-text-secondary hover:bg-c-surface-raised"
          >
            <X size={12} />
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
        </div>
      )}

      {phase === 'error' && (
        <div
          role="alert"
          className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-c-danger/40 bg-c-danger/10 px-3 py-2 text-xs text-c-danger"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle size={13} />
            {errorMessage}
          </span>
          <button
            type="button"
            onClick={handleGenerate}
            className="inline-flex items-center gap-1 rounded-md border border-c-danger/40 px-2 py-1 font-medium text-c-danger hover:bg-c-danger/10"
          >
            <RefreshCw size={12} />
            {isPolish ? 'Spróbuj ponownie' : 'Retry'}
          </button>
        </div>
      )}

      {pendingProposals.length > 0 && (
        <div className="mt-4 space-y-3">
          {pendingProposals.map((proposal) => (
            <ProposalDecisionCard
              key={proposal.id}
              proposal={proposal}
              isPolish={isPolish}
              isBusy={decisionBusyId === proposal.id}
              issue={issues[proposal.id]}
              isEditing={editingId === proposal.id}
              editValue={editDrafts[proposal.id] ?? proposal.proposedAfter?.text ?? ''}
              onToggleEdit={() => {
                setEditingId((cur) => (cur === proposal.id ? null : proposal.id));
                setEditDrafts((cur) => ({
                  ...cur,
                  [proposal.id]: cur[proposal.id] ?? proposal.proposedAfter?.text ?? '',
                }));
              }}
              onEditChange={(value) =>
                setEditDrafts((cur) => ({ ...cur, [proposal.id]: value }))
              }
              onAccept={() => handleAccept(proposal)}
              onReject={() => handleReject(proposal)}
              onRetryWithCurrentVersion={(currentVersion) => runAccept(proposal, currentVersion)}
              onDismissIssue={() => handleDismissIssue(proposal.id)}
              onRefreshList={() => void refreshProposals()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default TeresaSwotProposals;
