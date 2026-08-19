import React, { useCallback, useEffect, useRef, useState } from 'react';

import { EmptyState, LoadingState } from '@/components/shared/states';
import {
  type AgentMaterializationProposal,
  type AgentMaterializationTarget,
  createAgentMaterializationProposal,
  decideAgentMaterializationProposal,
  getAgentMaterializationSource,
  listAgentMaterializationProposals,
  materializeAgentMaterializationProposal,
} from '@/services/api/agentMaterialization.api';
import { useAppStore } from '@/store/useAppStore';

export function AgentMaterializationPanel({ planId, isPolish }: { planId?: string; isPolish: boolean }) {
  const currentUserId = useAppStore((state) => state.currentUser?.id);
  const [proposals, setProposals] = useState<AgentMaterializationProposal[] | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [target, setTarget] = useState<AgentMaterializationTarget>('task');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const commandIdentity = useRef<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await listAgentMaterializationProposals(planId);
      setProposals(result.proposals);
      setCanReview(result.canReview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load proposals');
      setProposals([]);
    }
  }, [planId]);

  useEffect(() => { setProposals(null); void load(); }, [load]);
  useEffect(() => { commandIdentity.current = null; }, [planId, target, title, description]);

  const create = async () => {
    if (!planId || !title.trim() || busy) return;
    setBusy('create'); setError(null); setSuccess(null);
    try {
      const source = await getAgentMaterializationSource(planId);
      commandIdentity.current ||= `myw-ui:${planId}:${crypto.randomUUID()}`;
      await createAgentMaterializationProposal({
        sourcePlanId: planId, sourceVersion: source.sourceVersion, sourceHash: source.sourceHash,
        targetKind: target, content: { title: title.trim(), description: description.trim() || undefined },
        idempotencyKey: commandIdentity.current, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      await load();
      setSuccess(isPolish ? 'Propozycja czeka na decyzję drugiej osoby.' : 'Proposal awaits another person’s decision.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Failed to create proposal'); }
    finally { setBusy(null); }
  };

  const materializeAndReadback = async (proposal: AgentMaterializationProposal) => {
    await materializeAgentMaterializationProposal(proposal);
    const readback = await listAgentMaterializationProposals(planId);
    const canonical = readback.proposals.find((item) => item.proposal_id === proposal.proposal_id);
    if (canonical?.receipt_status !== 'SUCCEEDED' || !canonical.target_id || !canonical.output_digest) {
      throw new Error('MYW_AGENT_CANONICAL_READBACK_INCOMPLETE');
    }
    setProposals(readback.proposals); setCanReview(readback.canReview);
    setSuccess(`${isPolish ? 'Utworzono kanoniczny rekord' : 'Canonical record created'}: ${canonical.target_id}`);
  };

  const decide = async (proposal: AgentMaterializationProposal, decision: 'APPROVE' | 'REJECT') => {
    setBusy(proposal.proposal_id); setError(null); setSuccess(null);
    try {
      const decided = await decideAgentMaterializationProposal(proposal, decision);
      if (decision === 'APPROVE') {
        await materializeAndReadback(decided.proposal);
      } else {
        await load();
        setSuccess(isPolish ? 'Propozycja została odrzucona.' : 'Proposal rejected.');
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Decision failed'); await load(); }
    finally { setBusy(null); }
  };

  const retryMaterialization = async (proposal: AgentMaterializationProposal) => {
    setBusy(proposal.proposal_id); setError(null); setSuccess(null);
    try { await materializeAndReadback(proposal); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Materialization failed'); await load(); }
    finally { setBusy(null); }
  };

  if (proposals === null) return <LoadingState template="list" rows={3} />;
  return (
    <section className="space-y-4 p-4" aria-busy={Boolean(busy)} data-testid="agent-materialization-panel">
      <header>
        <h2 className="text-sm font-semibold text-c-text">{isPolish ? 'Przekazanie wyniku do Mojej pracy' : 'Send result to My Work'}</h2>
        <p className="mt-1 text-xs text-c-text-secondary">{isPolish ? 'Agent tylko proponuje. Inna uprawniona osoba zatwierdza utworzenie kanonicznego rekordu.' : 'The agent only proposes. Another authorized person approves the canonical record.'}</p>
      </header>
      {planId ? (
        <div className="rounded-lg border border-c-border bg-c-surface p-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['task','decision','notebook'] as const).map((kind) => <button key={kind} type="button" onClick={() => setTarget(kind)} className={`rounded-md border px-3 py-1.5 text-xs ${target === kind ? 'border-c-border-strong bg-c-surface-raised text-c-text' : 'border-c-border text-c-text-secondary'}`}>{kind}</button>)}
          </div>
          <input aria-label={isPolish ? 'Tytuł propozycji' : 'Proposal title'} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} className="w-full rounded-md border border-c-border bg-c-bg px-3 py-2 text-sm text-c-text" placeholder={isPolish ? 'Tytuł kanonicznego rekordu' : 'Canonical record title'} />
          <textarea aria-label={isPolish ? 'Opis propozycji' : 'Proposal description'} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={20000} rows={3} className="w-full rounded-md border border-c-border bg-c-bg px-3 py-2 text-sm text-c-text" />
          <button type="button" disabled={!title.trim() || Boolean(busy)} onClick={() => void create()} className="rounded-md border border-c-border-strong bg-c-surface-raised px-3 py-2 text-xs font-semibold text-c-text disabled:opacity-50">{busy === 'create' ? (isPolish ? 'Wysyłanie…' : 'Sending…') : (isPolish ? 'Wyślij do niezależnej akceptacji' : 'Send for independent approval')}</button>
        </div>
      ) : null}
      {error ? <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">{error}</div> : null}
      {success ? <div role="status" className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">{success}</div> : null}
      {proposals.length === 0 ? <EmptyState variant="new" title={isPolish ? 'Brak propozycji' : 'No proposals'} /> : (
        <ul className="space-y-2">
          {proposals.map((proposal) => <li key={proposal.proposal_id} className="rounded-lg border border-c-border bg-c-surface p-3">
            <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-medium text-c-text">{proposal.content.title}</div><div className="mt-1 text-xs text-c-text-secondary">{proposal.target_kind} · {proposal.state}{proposal.receipt_status ? ` · ${proposal.receipt_status}` : ''}</div>{proposal.target_id ? <div className="mt-1 break-all font-mono text-[11px] text-c-text-muted">{proposal.target_id}</div> : null}</div>
            {proposal.state === 'PENDING' && canReview && proposal.requester_id !== currentUserId ? <div className="flex gap-2"><button type="button" disabled={Boolean(busy)} onClick={() => void decide(proposal,'REJECT')} className="rounded-md border border-c-border px-2 py-1 text-xs text-c-text">{isPolish ? 'Odrzuć' : 'Reject'}</button><button type="button" disabled={Boolean(busy)} onClick={() => void decide(proposal,'APPROVE')} className="rounded-md border border-c-border-strong bg-c-surface-raised px-2 py-1 text-xs font-semibold text-c-text">{busy === proposal.proposal_id ? '…' : (isPolish ? 'Zatwierdź i utwórz' : 'Approve and create')}</button></div> : null}
            {proposal.state === 'APPROVED' && proposal.approver_id === currentUserId && proposal.receipt_status !== 'SUCCEEDED' ? <button type="button" disabled={Boolean(busy)} onClick={() => void retryMaterialization(proposal)} className="rounded-md border border-c-border-strong bg-c-surface-raised px-2 py-1 text-xs font-semibold text-c-text">{busy === proposal.proposal_id ? '…' : (isPolish ? 'Ponów utworzenie' : 'Retry creation')}</button> : null}</div>
          </li>)}
        </ul>
      )}
    </section>
  );
}
