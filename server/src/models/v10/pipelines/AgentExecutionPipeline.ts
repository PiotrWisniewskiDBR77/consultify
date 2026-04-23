import type { ExecutionProposalV1 } from '../../agent/ExecutionProposalV1.js';
import type { RunId, RunRow } from '../../agent/RunLedger.js';

export type AgentExecutionPipelineRunId = string & { readonly __brand: 'AgentExecutionPipelineRunId' };

export function unsafeAgentExecutionPipelineRunId(value: string): AgentExecutionPipelineRunId {
  return String(value) as AgentExecutionPipelineRunId;
}

export type AgentExecutionPipelineOutput = {
  readonly pipelineRunId: AgentExecutionPipelineRunId;
  readonly runId: RunId;
  readonly severity: ExecutionProposalV1['severity'];
  readonly gateDecision: 'approved' | 'rejected' | 'requires_approval';
  readonly ledgerRunRow: RunRow | null;
};

export function runAgentExecutionPipeline(input: {
  readonly pipelineRunId: AgentExecutionPipelineRunId;
  readonly runId: RunId;
  readonly proposal: ExecutionProposalV1;
  readonly operatorApproved?: boolean;
  readonly now: string;
}): AgentExecutionPipelineOutput {
  const approvalMode = input.proposal.approvalMode;
  const requiresApproval = approvalMode !== 'implicit';
  const gateDecision =
    input.operatorApproved === false
      ? 'rejected'
      : requiresApproval && input.operatorApproved !== true
        ? 'requires_approval'
        : 'approved';

  const ledgerRunRow: RunRow = {
    id: input.runId,
    tenantId: input.proposal.tenantId,
    correlationId: input.proposal.correlationId,
    approvalState:
      gateDecision === 'requires_approval'
        ? 'awaiting_approval'
        : gateDecision === 'rejected'
          ? 'rejected'
          : 'approved',
    status:
      gateDecision === 'approved'
        ? 'running'
        : gateDecision === 'rejected'
          ? 'cancelled'
          : 'pending',
    severity: input.proposal.severity,
    startedAt: gateDecision === 'approved' ? input.now : null,
    finishedAt: gateDecision === 'rejected' ? input.now : null,
    budgetUsed: {
      wallMs: 0,
      costCents: 0,
      toolCalls: 0,
      tokens: 0,
    },
  };
  return {
    pipelineRunId: input.pipelineRunId,
    runId: input.runId,
    severity: input.proposal.severity,
    gateDecision,
    ledgerRunRow,
  };
}

