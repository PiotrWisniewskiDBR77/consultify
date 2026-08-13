import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  Gavel,
  Loader2,
} from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  decideSourceProposal,
  readRegisteredInitiative,
  registerSourceProposal,
  RuntimeApiError,
  type SourceProposalDecisionCommand,
  type SourceProposalDisposition,
  type SourceProposalRegistration,
} from '@/services/initiatives-execution/runtimeApi';

export interface SourceProposal extends TableRow {
  id: string;
  title: string;
  problem: string | null;
  proposedOutcome: string | null;
  sourceType: string;
  sourceId: string;
  sourceVersion: number;
  proposalVersion: number;
  projectId: string | null;
  projectName: string;
  initiativeOwnerId: string | null;
  ownerName: string;
  evidenceState: 'READY' | 'PARTIAL' | 'STALE' | 'UNKNOWN';
  duplicateState: 'CLEAR' | 'POSSIBLE' | 'UNKNOWN';
  provenance: { system: string; recordType: string; capturedAt: string; evidenceRefs: string[] };
  policyRef: { policyId: string; policyVersion: number };
  updatedAt: string;
  status?: string;
  registeredInitiativeId?: string | null;
  policy: {
    policyId: string;
    version: number;
    baseline: 'LITE' | 'STANDARD' | 'COMPLEX';
    strictness: number;
    source: 'PRODUCT' | 'ORGANIZATION' | 'PROJECT' | 'INITIATIVE';
  };
  capabilities: {
    canRegister: boolean;
    canMerge: boolean;
    canExtend: boolean;
    canReturn: boolean;
    canDefer: boolean;
    canDismiss: boolean;
  };
}

interface Props {
  proposals: SourceProposal[];
  createIds: (proposal: SourceProposal) => { initiativeId: string; clientRequestId: string };
  onOpenInitiative: (initiativeId: string) => void;
  onOpenValidation: (proposalId: string) => void;
  onProposalDecided: (proposalId: string) => void;
  register?: typeof registerSourceProposal;
  readBack?: typeof readRegisteredInitiative;
  decide?: typeof decideSourceProposal;
  initialSelectedId?: string | null;
  onSelectionChange?: (proposalId: string | null) => void;
}

type WriteState =
  | { kind: 'IDLE' }
  | { kind: 'SAVING' }
  | { kind: 'READ_BACK_PENDING'; initiativeId: string }
  | { kind: 'SUCCESS'; initiativeId: string; replayed: boolean }
  | { kind: 'CONFLICT' }
  | { kind: 'PERMISSION_DENIED' }
  | { kind: 'FAILED' };

const columns: TableColumn[] = [
  { id: 'title', label: 'Proposal', sortable: true, width: '30%' },
  { id: 'evidenceState', label: 'Evidence', sortable: true, filterable: true },
  { id: 'duplicateState', label: 'Duplicates', sortable: true, filterable: true },
  { id: 'projectName', label: 'Project', sortable: true },
  { id: 'ownerName', label: 'Proposed owner', sortable: true },
  { id: 'updatedAt', label: 'Updated', sortable: true },
];

function stateMessage(state: WriteState): string | null {
  switch (state.kind) {
    case 'READ_BACK_PENDING':
      return 'Registration was accepted. Waiting for the canonical Initiative read-back.';
    case 'CONFLICT':
      return 'The proposal or request changed. Review current data before retrying.';
    case 'PERMISSION_DENIED':
      return 'You do not have authority to register this proposal.';
    case 'FAILED':
      return 'Registration failed. The proposal remains unchanged.';
    default:
      return null;
  }
}

function isRegisterable(
  proposal: SourceProposal
): proposal is SourceProposal & { problem: string; projectId: string; initiativeOwnerId: string } {
  return Boolean(
    proposal.problem?.trim() &&
    proposal.capabilities.canRegister &&
    proposal.projectId?.trim() &&
    proposal.initiativeOwnerId?.trim() &&
    proposal.evidenceState === 'READY' &&
    proposal.duplicateState === 'CLEAR'
  );
}

export const SourceProposalRegistrationWorkbench: React.FC<Props> = ({
  proposals,
  createIds,
  onOpenInitiative,
  onOpenValidation,
  onProposalDecided,
  register = registerSourceProposal,
  readBack = readRegisteredInitiative,
  decide = decideSourceProposal,
  initialSelectedId = null,
  onSelectionChange,
}) => {
  const [selectedId, setSelectedIdState] = useState<string | null>(initialSelectedId);
  const setSelectedId = (id: string | null) => {
    setSelectedIdState(id);
    onSelectionChange?.(id);
  };
  const [confirming, setConfirming] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [disposition, setDisposition] = useState<SourceProposalDisposition>('RETURN');
  const [reasonCode, setReasonCode] = useState('VALIDATOR_DECISION');
  const [rationale, setRationale] = useState('');
  const [targetInitiativeId, setTargetInitiativeId] = useState('');
  const [resolverId, setResolverId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [reviewTrigger, setReviewTrigger] = useState('');
  const [writeStates, setWriteStates] = useState<Record<string, WriteState>>({});
  const commandIds = useRef(new Map<string, { initiativeId: string; clientRequestId: string }>());
  const decisionIds = useRef(new Map<string, { decisionId: string; clientRequestId: string }>());
  const selected = useMemo(
    () => proposals.find((proposal) => proposal.id === selectedId) ?? null,
    [proposals, selectedId]
  );
  const writeState: WriteState = selected
    ? (writeStates[selected.id] ?? { kind: 'IDLE' })
    : { kind: 'IDLE' };
  const setProposalWriteState = (proposalId: string, state: WriteState) =>
    setWriteStates((current) => ({ ...current, [proposalId]: state }));
  const message = stateMessage(writeState);

  const performRegister = async () => {
    if (!selected || !isRegisterable(selected) || writeState.kind === 'SAVING') return;
    setConfirming(false);
    const proposal = selected;
    setProposalWriteState(proposal.id, { kind: 'SAVING' });
    const ids = commandIds.current.get(proposal.id) ?? createIds(proposal);
    commandIds.current.set(proposal.id, ids);
    const command: SourceProposalRegistration = {
      initiativeId: ids.initiativeId,
      clientRequestId: ids.clientRequestId,
      expectedVersion: 0,
      proposalId: proposal.id,
      proposalVersion: proposal.proposalVersion,
      sourceType: proposal.sourceType,
      sourceId: proposal.sourceId,
      sourceVersion: proposal.sourceVersion,
      title: proposal.title,
      problem: proposal.problem,
      proposedOutcome: proposal.proposedOutcome,
      projectId: proposal.projectId,
      visibility: 'PROJECT',
      initiativeOwnerId: proposal.initiativeOwnerId,
    };
    let accepted: Awaited<ReturnType<typeof register>>;
    try {
      accepted = await register(command);
    } catch (error) {
      if (error instanceof RuntimeApiError && error.status === 409) {
        setProposalWriteState(proposal.id, { kind: 'CONFLICT' });
      } else if (error instanceof RuntimeApiError && error.status === 403) {
        setProposalWriteState(proposal.id, { kind: 'PERMISSION_DENIED' });
      } else {
        setProposalWriteState(proposal.id, { kind: 'FAILED' });
      }
      return;
    }
    setProposalWriteState(proposal.id, {
      kind: 'READ_BACK_PENDING',
      initiativeId: accepted.initiativeId,
    });
    try {
      await readBack(accepted.initiativeId);
      setProposalWriteState(proposal.id, {
        kind: 'SUCCESS',
        initiativeId: accepted.initiativeId,
        replayed: accepted.status === 'REPLAYED',
      });
    } catch {
      setProposalWriteState(proposal.id, {
        kind: 'READ_BACK_PENDING',
        initiativeId: accepted.initiativeId,
      });
    }
  };

  const decisionIsComplete = Boolean(
    selected &&
    selected.capabilities[
      `can${disposition.charAt(0)}${disposition.slice(1).toLowerCase()}` as
        | 'canMerge'
        | 'canExtend'
        | 'canReturn'
        | 'canDefer'
        | 'canDismiss'
    ] &&
    reasonCode.trim() &&
    rationale.trim() &&
    (!(disposition === 'MERGE' || disposition === 'EXTEND') || targetInitiativeId.trim()) &&
    (disposition !== 'RETURN' || (resolverId.trim() && dueAt)) &&
    (disposition !== 'DEFER' || (resolverId.trim() && reviewTrigger.trim()))
  );

  const performDecision = async () => {
    if (!selected || !decisionIsComplete || writeState.kind === 'SAVING') return;
    const proposal = selected;
    setProposalWriteState(proposal.id, { kind: 'SAVING' });
    const cacheKey = `${selected.id}:${disposition}`;
    const ids = decisionIds.current.get(cacheKey) ?? {
      decisionId: crypto.randomUUID(),
      clientRequestId: crypto.randomUUID(),
    };
    decisionIds.current.set(cacheKey, ids);
    const command: SourceProposalDecisionCommand = {
      ...ids,
      expectedProposalVersion: selected.proposalVersion,
      disposition,
      targetInitiativeId:
        disposition === 'MERGE' || disposition === 'EXTEND' ? targetInitiativeId.trim() : null,
      reasonCode: reasonCode.trim(),
      rationale: rationale.trim(),
      evidenceSnapshot: {
        sourceType: selected.sourceType,
        sourceId: selected.sourceId,
        sourceVersion: selected.sourceVersion,
        proposalVersion: selected.proposalVersion,
        evidenceState: selected.evidenceState,
        duplicateState: selected.duplicateState,
      },
      resolverId: disposition === 'RETURN' || disposition === 'DEFER' ? resolverId.trim() : null,
      dueAt: disposition === 'RETURN' ? new Date(dueAt).toISOString() : null,
      reviewTrigger: disposition === 'DEFER' ? reviewTrigger.trim() : null,
    };
    try {
      await decide(selected.id, command);
      setProposalWriteState(proposal.id, { kind: 'IDLE' });
      setDeciding(false);
      onProposalDecided(selected.id);
      setSelectedId(null);
    } catch (error) {
      if (error instanceof RuntimeApiError && error.status === 409) {
        setProposalWriteState(proposal.id, { kind: 'CONFLICT' });
      } else if (
        error instanceof RuntimeApiError &&
        (error.status === 403 || error.status === 404)
      ) {
        setProposalWriteState(proposal.id, { kind: 'PERMISSION_DENIED' });
      } else {
        setProposalWriteState(proposal.id, { kind: 'FAILED' });
      }
    }
  };

  return (
    <section aria-label="Source proposals" className="min-h-0">
      <div aria-live="polite" className="sr-only">
        {writeState.kind === 'SAVING' ? 'Registering proposal' : message}
      </div>
      {message && (
        <div
          role={writeState.kind === 'FAILED' || writeState.kind === 'CONFLICT' ? 'alert' : 'status'}
          className="mx-4 mt-3 flex items-center gap-2 rounded-md border border-c-border px-3 py-2 text-sm text-c-text-secondary"
        >
          <AlertTriangle aria-hidden="true" size={16} />
          {message}
        </div>
      )}
      <TableWithPreviewLayout<SourceProposal>
        selectedId={selectedId}
        selectedItem={selected}
        onSelect={setSelectedId}
        onOpenFull={onOpenValidation}
        itemIds={proposals.map((proposal) => proposal.id)}
        getItemById={(id) => proposals.find((proposal) => proposal.id === id) ?? null}
        renderPreview={(proposal) => (
          <div className="space-y-4 px-4 py-3 text-sm">
            <div>
              <div className="text-xs uppercase text-c-text-muted">Problem</div>
              <p className="mt-1 text-c-text-primary">
                {proposal.problem || 'Unknown — requires validation'}
              </p>
            </div>
            <div>
              <div className="text-xs uppercase text-c-text-muted">Proposed outcome</div>
              <p className="mt-1 text-c-text-secondary">
                {proposal.proposedOutcome || 'Unknown — requires definition'}
              </p>
            </div>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-c-text-muted">Source</dt>
                <dd>
                  {proposal.sourceType} v{proposal.sourceVersion}
                </dd>
              </div>
              <div>
                <dt className="text-c-text-muted">Evidence</dt>
                <dd>{proposal.evidenceState}</dd>
              </div>
              <div>
                <dt className="text-c-text-muted">Duplicates</dt>
                <dd>{proposal.duplicateState}</dd>
              </div>
              <div>
                <dt className="text-c-text-muted">Project</dt>
                <dd>{proposal.projectName}</dd>
              </div>
            </dl>
          </div>
        )}
        renderPreviewFooter={(proposal) => (
          <div className="flex w-full items-center justify-end gap-2 px-3 py-2">
            <button
              className="btn-secondary"
              type="button"
              onClick={() => onOpenValidation(proposal.id)}
            >
              <FileSearch aria-hidden="true" size={15} /> Validate
            </button>
            <button
              className="btn-secondary"
              type="button"
              disabled={writeState.kind === 'SAVING'}
              onClick={() => setDeciding(true)}
            >
              <Gavel aria-hidden="true" size={15} /> Other decision
            </button>
            {writeState.kind === 'SUCCESS' || proposal.registeredInitiativeId ? (
              <button
                className="btn-primary"
                type="button"
                onClick={() =>
                  onOpenInitiative(
                    proposal.registeredInitiativeId ||
                      (writeState.kind === 'SUCCESS' ? writeState.initiativeId : '')
                  )
                }
              >
                <ExternalLink aria-hidden="true" size={15} /> Open Initiative
              </button>
            ) : (
              <button
                className="btn-primary"
                type="button"
                disabled={writeState.kind === 'SAVING' || !isRegisterable(proposal)}
                onClick={() => setConfirming(true)}
              >
                {writeState.kind === 'SAVING' ? (
                  <Loader2 className="animate-spin" aria-hidden="true" size={15} />
                ) : (
                  <CheckCircle2 aria-hidden="true" size={15} />
                )}
                Register
              </button>
            )}
          </div>
        )}
      >
        <StandardTable
          columns={columns}
          data={proposals}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(row.id)}
          onRowDoubleClick={(row) => onOpenValidation(row.id)}
          persistKey="initiatives.source-proposals.v1"
          empty={{
            title: 'No proposals awaiting validation',
            description: 'Drafts remain in their source modules until submitted for validation.',
          }}
        />
      </TableWithPreviewLayout>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent aria-describedby="register-impact-description">
          <DialogHeader>
            <DialogTitle>Register as a new Initiative?</DialogTitle>
            <DialogDescription id="register-impact-description">
              This creates one Registered Draft and preserves the source lineage. It does not
              approve or schedule the Initiative.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <dl className="grid grid-cols-1 gap-3 rounded-md border border-c-border p-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-c-text-muted">Initial state</dt>
                <dd>REGISTERED_DRAFT</dd>
              </div>
              <div>
                <dt className="text-c-text-muted">Readiness</dt>
                <dd>NOT_EVALUATED</dd>
              </div>
              <div>
                <dt className="text-c-text-muted">Policy</dt>
                <dd>
                  {selected.policy.policyId} v{selected.policy.version}
                </dd>
              </div>
              <div>
                <dt className="text-c-text-muted">Owner</dt>
                <dd>{selected.ownerName}</dd>
              </div>
            </dl>
          )}
          <DialogFooter>
            <button className="btn-secondary" type="button" onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button className="btn-primary" type="button" onClick={performRegister}>
              Confirm Register
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deciding} onOpenChange={setDeciding}>
        <DialogContent aria-describedby="source-decision-impact-description">
          <DialogHeader>
            <DialogTitle>Record source-validation decision</DialogTitle>
            <DialogDescription id="source-decision-impact-description">
              This closes the current proposal version without creating a new Initiative. The
              decision, evidence snapshot and source read-back are persisted atomically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="mb-1 block text-c-text-muted">Decision</span>
              <select
                className="w-full rounded-md border border-c-border bg-c-surface px-3 py-2"
                value={disposition}
                onChange={(event) =>
                  setDisposition(event.target.value as SourceProposalDisposition)
                }
              >
                {selected?.capabilities.canReturn && (
                  <option value="RETURN">Return for clarification</option>
                )}
                {selected?.capabilities.canDefer && <option value="DEFER">Defer</option>}
                {selected?.capabilities.canMerge && (
                  <option value="MERGE">Merge into an Initiative</option>
                )}
                {selected?.capabilities.canExtend && (
                  <option value="EXTEND">Extend an Initiative</option>
                )}
                {selected?.capabilities.canDismiss && <option value="DISMISS">Dismiss</option>}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-c-text-muted">Reason code</span>
              <input
                className="w-full rounded-md border border-c-border bg-c-surface px-3 py-2"
                value={reasonCode}
                onChange={(event) => setReasonCode(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-c-text-muted">Human rationale</span>
              <textarea
                className="min-h-24 w-full rounded-md border border-c-border bg-c-surface px-3 py-2"
                value={rationale}
                onChange={(event) => setRationale(event.target.value)}
              />
            </label>
            {(disposition === 'MERGE' || disposition === 'EXTEND') && (
              <label className="block">
                <span className="mb-1 block text-c-text-muted">Target Initiative ID</span>
                <input
                  className="w-full rounded-md border border-c-border bg-c-surface px-3 py-2"
                  value={targetInitiativeId}
                  onChange={(event) => setTargetInitiativeId(event.target.value)}
                />
              </label>
            )}
            {(disposition === 'RETURN' || disposition === 'DEFER') && (
              <label className="block">
                <span className="mb-1 block text-c-text-muted">Accountable resolver</span>
                <input
                  className="w-full rounded-md border border-c-border bg-c-surface px-3 py-2"
                  value={resolverId}
                  onChange={(event) => setResolverId(event.target.value)}
                />
              </label>
            )}
            {disposition === 'RETURN' && (
              <label className="block">
                <span className="mb-1 block text-c-text-muted">Resolution due</span>
                <input
                  className="w-full rounded-md border border-c-border bg-c-surface px-3 py-2"
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                />
              </label>
            )}
            {disposition === 'DEFER' && (
              <label className="block">
                <span className="mb-1 block text-c-text-muted">Review trigger</span>
                <input
                  className="w-full rounded-md border border-c-border bg-c-surface px-3 py-2"
                  value={reviewTrigger}
                  onChange={(event) => setReviewTrigger(event.target.value)}
                />
              </label>
            )}
          </div>
          <DialogFooter>
            <button className="btn-secondary" type="button" onClick={() => setDeciding(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              type="button"
              disabled={!decisionIsComplete || writeState.kind === 'SAVING'}
              onClick={performDecision}
            >
              Record decision
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
