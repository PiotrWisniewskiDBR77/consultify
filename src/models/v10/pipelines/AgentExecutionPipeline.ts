import type { ExecutionProposalV1 } from '../../agent/ExecutionProposalV1.js';
import type { RunId, RunRow } from '../../agent/RunLedger.js';

export type AgentExecutionPipelineRunId = string & {
  readonly __brand: 'AgentExecutionPipelineRunId';
};

export function unsafeAgentExecutionPipelineRunId(value: string): AgentExecutionPipelineRunId {
  return String(value) as AgentExecutionPipelineRunId;
}

export type AgentExecutionPipelineOutput = {
  readonly pipelineRunId: AgentExecutionPipelineRunId;
  readonly runId: RunId;
  readonly severity: ExecutionProposalV1['severity'];
  readonly gateDecision: 'approved' | 'rejected';
  readonly ledgerRunRow: RunRow | null;
};

export function runAgentExecutionPipeline(input: {
  readonly pipelineRunId: AgentExecutionPipelineRunId;
  readonly runId: RunId;
  readonly proposal: ExecutionProposalV1;
  readonly operatorApproved?: boolean;
  readonly now: string;
}): AgentExecutionPipelineOutput {
  const gateDecision = input.operatorApproved === false ? 'rejected' : 'approved';
  return {
    pipelineRunId: input.pipelineRunId,
    runId: input.runId,
    severity: input.proposal.severity,
    gateDecision,
    ledgerRunRow: null,
  };
}

