import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import {
  listSourceProposals,
  readSourceProposal,
  type SourceProposalReadModel,
} from '@/services/initiatives-execution/runtimeApi';

import {
  type SourceProposal,
  SourceProposalRegistrationWorkbench,
} from './SourceProposalRegistrationWorkbench';

interface Props {
  onOpenInitiative: (initiativeId: string) => void;
  initialSelectedId?: string | null;
  onSelectionChange?: (proposalId: string | null) => void;
}

function toProposal(row: SourceProposalReadModel): SourceProposal {
  return {
    ...row,
    problem: row.problem,
    projectName: row.projectId || 'Unknown — assign project',
    ownerName: row.initiativeOwnerId || 'Unknown — assign owner',
  };
}

export const SourceProposalRegistrationSurface: React.FC<Props> = ({
  onOpenInitiative,
  initialSelectedId = null,
  onSelectionChange,
}) => {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [proposals, setProposals] = useState<SourceProposal[]>([]);
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [validationId, setValidationId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState('LOADING');
    Promise.all([
      listSourceProposals(controller.signal),
      initialSelectedId
        ? readSourceProposal(initialSelectedId, controller.signal).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([rows, historical]) => {
        const exact =
          historical && !rows.some((row) => row.id === historical.id)
            ? [...rows, historical]
            : rows;
        setProposals(exact.map(toProposal));
        setState('READY');
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState('ERROR');
      });
    return () => controller.abort();
  }, [initialSelectedId]);

  useEffect(() => {
    if (state !== 'READY') return;
    const top = Number(sessionStorage.getItem('initiatives.source.scrollTop') ?? 0);
    requestAnimationFrame(() => {
      const scroller = surfaceRef.current?.querySelector<HTMLElement>('.app-table-scrollbar');
      if (scroller) scroller.scrollTop = top;
      if (initialSelectedId) surfaceRef.current?.focus();
    });
  }, [state, initialSelectedId]);

  if (state === 'LOADING') {
    return (
      <div role="status" className="flex items-center gap-2 p-6 text-sm text-c-text-muted">
        <Loader2 aria-hidden="true" className="animate-spin" size={16} /> Loading source proposals
      </div>
    );
  }
  if (state === 'ERROR') {
    return (
      <div
        role="alert"
        className="m-4 flex items-center gap-2 rounded-md border border-c-danger/30 p-4 text-sm text-c-danger"
      >
        <AlertTriangle aria-hidden="true" size={16} /> Source proposals are unavailable. No
        registration action was performed.
      </div>
    );
  }
  const validationProposal = proposals.find((proposal) => proposal.id === validationId) ?? null;
  if (validationProposal) {
    return (
      <section aria-label="Source validation workspace" className="h-full overflow-auto p-6">
        <button className="btn-secondary mb-4" type="button" onClick={() => setValidationId(null)}>
          <ArrowLeft aria-hidden="true" size={15} /> Back to proposals
        </button>
        <header className="mb-6">
          <div className="text-xs uppercase text-c-text-muted">Source validation</div>
          <h2 className="mt-1 text-xl font-semibold text-c-text-primary">
            {validationProposal.title}
          </h2>
          <p className="mt-2 text-sm text-c-text-secondary">
            {validationProposal.problem ||
              'Problem is unknown and must be completed before Register.'}
          </p>
        </header>
        <dl className="grid gap-4 rounded-lg border border-c-border p-4 text-sm md:grid-cols-2">
          <div>
            <dt className="text-c-text-muted">Source identity</dt>
            <dd>
              {validationProposal.sourceType} / {validationProposal.sourceId} / v
              {validationProposal.sourceVersion}
            </dd>
          </div>
          <div>
            <dt className="text-c-text-muted">Provenance</dt>
            <dd>
              {validationProposal.provenance.system} / {validationProposal.provenance.recordType}
            </dd>
          </div>
          <div>
            <dt className="text-c-text-muted">Proposal version</dt>
            <dd>v{validationProposal.proposalVersion}</dd>
          </div>
          <div>
            <dt className="text-c-text-muted">Evidence</dt>
            <dd>{validationProposal.evidenceState}</dd>
          </div>
          <div>
            <dt className="text-c-text-muted">Duplicate comparison</dt>
            <dd>{validationProposal.duplicateState}</dd>
          </div>
          <div>
            <dt className="text-c-text-muted">Project</dt>
            <dd>{validationProposal.projectName}</dd>
          </div>
          <div>
            <dt className="text-c-text-muted">Initiative owner</dt>
            <dd>{validationProposal.ownerName}</dd>
          </div>
          <div>
            <dt className="text-c-text-muted">Effective policy</dt>
            <dd>
              {validationProposal.policy.policyId} v{validationProposal.policy.version} (
              {validationProposal.policy.source})
            </dd>
          </div>
          <div>
            <dt className="text-c-text-muted">Proposed outcome</dt>
            <dd>{validationProposal.proposedOutcome || 'Unknown — requires definition'}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-c-text-muted">
          AI signals are advisory. Register remains a separate human confirmation in the proposal
          preview.
        </p>
      </section>
    );
  }
  return (
    <div
      ref={surfaceRef}
      tabIndex={-1}
      role="region"
      aria-label="Source proposals workspace"
      className="h-full focus:outline-none"
    >
      <SourceProposalRegistrationWorkbench
        proposals={proposals}
        initialSelectedId={initialSelectedId}
        onSelectionChange={onSelectionChange}
        createIds={() => ({
          initiativeId: crypto.randomUUID(),
          clientRequestId: crypto.randomUUID(),
        })}
        onOpenInitiative={(initiativeId) => {
          const scroller = surfaceRef.current?.querySelector<HTMLElement>('.app-table-scrollbar');
          sessionStorage.setItem('initiatives.source.scrollTop', String(scroller?.scrollTop ?? 0));
          onOpenInitiative(initiativeId);
        }}
        onOpenValidation={setValidationId}
        onProposalDecided={(proposalId) => {
          setProposals((current) => current.filter((proposal) => proposal.id !== proposalId));
          setValidationId(null);
        }}
      />
    </div>
  );
};
