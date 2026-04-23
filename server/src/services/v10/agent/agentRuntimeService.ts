import {
  type ApprovalBarrierSequence,
  assertBarrierEventEmitted,
  assertResumePoint,
  resumeAfterBarrier,
  simulateBarrierSequence,
} from '../../../../../src/models/agent/ApprovalBarrierSequence.js';
import {
  type ExecutionProposalV1,
  type Severity,
  type TenantId,
} from '../../../../../src/models/agent/ExecutionProposalV1.js';
import {
  applyInterrupt,
  assertCompensationImpliedByVerb,
} from '../../../../../src/models/agent/InterruptVerbs.js';
import { type RunId, type RunRow, unsafeRunId } from '../../../../../src/models/agent/RunLedger.js';
import { getSeverityPolicy } from '../../../../../src/models/agent/SeverityPolicies.js';
import {
  runAgentExecutionPipeline,
  unsafeAgentExecutionPipelineRunId,
} from '../../../../../src/models/v10/pipelines/AgentExecutionPipeline.js';
import type {
  AgentRuntimeApprovalContract,
  AgentRuntimeLedgerEvent,
  AgentRuntimeLedgerStore,
  AgentRuntimeSagaPlan,
  AppendRunLedgerInput,
  EvaluateExecutionProposalInput,
  EvaluateExecutionProposalResult,
  PlanApprovalBarrierInput,
  PlanApprovalBarrierResult,
  QueryRunLedgerInput,
  ResumeApprovalBarrierInput,
  ResumeApprovalBarrierResult,
  SubmitInterruptVerbInput,
  SubmitInterruptVerbResult,
  SummarizeRunLedgerInput,
} from '../../../types/v10/agent-runtime.js';
import { createInMemoryAgentRuntimeLedgerStore } from './runLedgerMemoryStore.js';

type SupportedRunStatus = RunRow['status'];

function eventId(prefix: string, runId: RunId, recordedAt: string, sequence: number): string {
  return `${prefix}:${String(runId)}:${recordedAt}:${sequence}`;
}

function interruptStateFromRunStatus(
  status: SupportedRunStatus
): SubmitInterruptVerbResult['currentState'] {
  switch (status) {
    case 'pending':
      return 'idle';
    case 'running':
      return 'running';
    case 'paused':
      return 'paused';
    case 'succeeded':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
  }
}

function runStatusFromInterruptState(
  state: SubmitInterruptVerbResult['currentState']
): SupportedRunStatus | null {
  switch (state) {
    case 'idle':
      return 'pending';
    case 'running':
      return 'running';
    case 'paused':
      return 'paused';
    case 'completed':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'aborted':
      return 'cancelled';
  }
}

function buildPendingRunRow(proposal: ExecutionProposalV1, runId: RunId): RunRow {
  return {
    id: runId,
    tenantId: proposal.tenantId,
    correlationId: proposal.correlationId,
    status: 'pending',
    severity: proposal.severity,
    startedAt: null,
    finishedAt: null,
    budgetUsed: {
      wallMs: 0,
      costCents: 0,
      toolCalls: 0,
      tokens: 0,
    },
  };
}

function buildApprovalContract(severity: Severity): AgentRuntimeApprovalContract {
  const policy = getSeverityPolicy(severity);
  switch (severity) {
    case 'S0':
      return {
        severity,
        approvalMode: policy.defaultApproval,
        requiredReviewerCount: 0,
        requiredRoles: [],
        requiresAdminSignature: false,
        requiresExplicitResume: false,
        requiresCompensatingOps: false,
      };
    case 'S1':
      return {
        severity,
        approvalMode: policy.defaultApproval,
        requiredReviewerCount: 1,
        requiredRoles: ['reviewer', 'admin', 'superadmin'],
        requiresAdminSignature: false,
        requiresExplicitResume: true,
        requiresCompensatingOps: false,
      };
    case 'S2':
      return {
        severity,
        approvalMode: policy.defaultApproval,
        requiredReviewerCount: 1,
        requiredRoles: ['reviewer', 'admin', 'superadmin'],
        requiresAdminSignature: false,
        requiresExplicitResume: true,
        requiresCompensatingOps: false,
      };
    case 'S3':
      return {
        severity,
        approvalMode: policy.defaultApproval,
        requiredReviewerCount: 2,
        requiredRoles: ['reviewer', 'admin', 'superadmin'],
        requiresAdminSignature: false,
        requiresExplicitResume: true,
        requiresCompensatingOps: true,
      };
    case 'S4':
      return {
        severity,
        approvalMode: policy.defaultApproval,
        requiredReviewerCount: 1,
        requiredRoles: ['admin', 'superadmin'],
        requiresAdminSignature: true,
        requiresExplicitResume: true,
        requiresCompensatingOps: true,
      };
  }
}

function buildSagaPlan(proposal: ExecutionProposalV1, stepCount: number): AgentRuntimeSagaPlan {
  const barrierOrdinals = proposal.approvalMode === 'implicit' ? [] : ([0] as const);

  return {
    stepCount,
    barrierOrdinals,
    compensatingOpCount: proposal.ops.filter((op) => op.compensatingOp != null).length,
    interruptible: true,
  };
}

function buildBarrierSequence(
  proposal: ExecutionProposalV1,
  stepCount: number
): ApprovalBarrierSequence {
  const contract = buildApprovalContract(proposal.severity);
  return {
    id: `sequence:${String(proposal.id)}`,
    tenantId: proposal.tenantId,
    stepCount,
    barriers:
      contract.requiredReviewerCount === 0
        ? []
        : [
            {
              id: `barrier:${String(proposal.id)}:approval`,
              stepOrdinal: 0,
              reason: `severity=${proposal.severity} approval_mode=${proposal.approvalMode}`,
            },
          ],
  };
}

function createLedgerEvent(
  id: string,
  tenantId: TenantId,
  runId: RunId,
  category: AgentRuntimeLedgerEvent['category'],
  recordedAt: string,
  payload: unknown,
  actorId: string | null = null
): AgentRuntimeLedgerEvent {
  return {
    id,
    tenantId,
    runId,
    category,
    recordedAt,
    actorId,
    payload,
  };
}

export class AgentRuntimeService {
  private sequence = 0;

  constructor(
    private readonly store: AgentRuntimeLedgerStore = createInMemoryAgentRuntimeLedgerStore()
  ) {}

  private nextEventId(prefix: string, runId: RunId, recordedAt: string): string {
    this.sequence += 1;
    return eventId(prefix, runId, recordedAt, this.sequence);
  }

  evaluateExecutionProposal(
    input: EvaluateExecutionProposalInput
  ): EvaluateExecutionProposalResult {
    const runId = unsafeRunId(input.runId);
    const pipeline = runAgentExecutionPipeline({
      pipelineRunId: unsafeAgentExecutionPipelineRunId(input.pipelineRunId),
      runId,
      proposal: input.proposal,
      operatorApproved: input.operatorApproved,
      now: input.now,
    });

    const stepCount = Math.max(1, input.proposal.ops.length + 1);
    const contract = buildApprovalContract(input.proposal.severity);
    const sagaPlan = buildSagaPlan(input.proposal, stepCount);
    const barrierSequence =
      contract.requiredReviewerCount > 0 ? buildBarrierSequence(input.proposal, stepCount) : null;

    if (input.persistRun === true) {
      const baseRun = pipeline.ledgerRunRow ?? buildPendingRunRow(input.proposal, runId);
      this.store.upsertRun(baseRun);
      this.store.setRuntimeState(
        runId,
        input.proposal.tenantId,
        interruptStateFromRunStatus(baseRun.status)
      );

      if (pipeline.gateDecision === 'rejected') {
        const cancelled = this.store.transitionRun(
          runId,
          input.proposal.tenantId,
          'cancelled',
          input.now
        );
        if (cancelled !== null) {
          this.store.setRuntimeState(runId, input.proposal.tenantId, 'cancelled');
        }
      }
    }

    this.store.appendEvent(
      createLedgerEvent(
        this.nextEventId('proposal', runId, input.now),
        input.proposal.tenantId,
        runId,
        'proposal_evaluated',
        input.now,
        {
          proposalId: String(input.proposal.id),
          severity: pipeline.severity,
          gateDecision: pipeline.gateDecision,
          contract,
        },
        String(input.proposal.proposedBy)
      )
    );

    return {
      pipeline,
      contract,
      sagaPlan,
      barrierSequence,
    };
  }

  planApprovalBarrier(input: PlanApprovalBarrierInput): PlanApprovalBarrierResult {
    const runId = unsafeRunId(input.runId);
    const stepCount = Math.max(1, input.stepCount ?? input.proposal.ops.length + 1);
    const sequence = buildBarrierSequence(input.proposal, stepCount);
    const simulation = simulateBarrierSequence(sequence, {
      untilStepOrdinal: input.untilStepOrdinal,
      emittedAt: input.emittedAt,
    });

    assertBarrierEventEmitted(simulation);

    this.store.appendEvent(
      createLedgerEvent(
        this.nextEventId('barrier-plan', runId, input.emittedAt),
        input.proposal.tenantId,
        runId,
        'approval_barrier_planned',
        input.emittedAt,
        {
          sequenceId: sequence.id,
          outcome: simulation.outcome,
        },
        String(input.proposal.proposedBy)
      )
    );

    return { sequence, simulation };
  }

  resumeApprovalBarrier(input: ResumeApprovalBarrierInput): ResumeApprovalBarrierResult {
    const resume = resumeAfterBarrier(input.pause, input.decision, input.resumedAt);
    assertResumePoint(input.pause, resume);

    let run: RunRow | null = null;
    if (resume.outcome === 'resumed') {
      run = this.trySyncRunStatus(input.runId, input.tenantId, 'running', input.resumedAt);
      this.store.setRuntimeState(input.runId, input.tenantId, 'running');
    } else {
      run = this.trySyncRunStatus(input.runId, input.tenantId, 'cancelled', input.resumedAt);
      this.store.setRuntimeState(input.runId, input.tenantId, 'cancelled');
    }

    this.store.appendEvent(
      createLedgerEvent(
        this.nextEventId('barrier-resume', input.runId, input.resumedAt),
        input.tenantId,
        input.runId,
        'approval_barrier_resumed',
        input.resumedAt,
        resume
      )
    );

    return { resume, run };
  }

  submitInterruptVerb(input: SubmitInterruptVerbInput): SubmitInterruptVerbResult {
    const inferredCurrentState =
      input.currentState ??
      this.store.getRuntimeState(input.runId, input.tenantId) ??
      this.inferCurrentStateFromRun(input.runId, input.tenantId);

    assertCompensationImpliedByVerb(input.verb, input.compensationRecord);
    const decision = applyInterrupt(inferredCurrentState, input.verb);

    if (decision.reason !== 'illegal') {
      this.store.setRuntimeState(input.runId, input.tenantId, decision.nextState);
    }

    let syncedRun: RunRow | null = null;
    const mappedStatus = runStatusFromInterruptState(decision.nextState);
    if (decision.reason !== 'illegal' && mappedStatus !== null) {
      syncedRun = this.trySyncRunStatus(
        input.runId,
        input.tenantId,
        mappedStatus,
        input.recordedAt
      );
    }

    this.store.appendEvent(
      createLedgerEvent(
        this.nextEventId('interrupt', input.runId, input.recordedAt),
        input.tenantId,
        input.runId,
        'interrupt_submitted',
        input.recordedAt,
        {
          verb: input.verb,
          currentState: inferredCurrentState,
          decision,
        },
        input.actorId
      )
    );

    return {
      currentState: inferredCurrentState,
      decision,
      syncedRun,
    };
  }

  appendRunLedger(input: AppendRunLedgerInput): AgentRuntimeLedgerEvent {
    if (input.run) {
      this.store.upsertRun(input.run);
      this.store.setRuntimeState(
        input.run.id,
        input.run.tenantId,
        interruptStateFromRunStatus(input.run.status)
      );
    }

    return this.store.appendEvent(
      createLedgerEvent(
        input.event.id ?? this.nextEventId('ledger', input.event.runId, input.event.recordedAt),
        input.event.tenantId,
        input.event.runId,
        input.event.category,
        input.event.recordedAt,
        input.event.payload,
        input.event.actorId ?? null
      )
    );
  }

  queryRunLedger(input: QueryRunLedgerInput) {
    return this.store.query(input.query);
  }

  summarizeRunLedger(input: SummarizeRunLedgerInput) {
    return this.store.summarize(input.runId, input.tenantId);
  }

  getStore(): AgentRuntimeLedgerStore {
    return this.store;
  }

  private inferCurrentStateFromRun(
    runId: RunId,
    tenantId: TenantId
  ): SubmitInterruptVerbResult['currentState'] {
    const run = this.store.getRun(runId, tenantId);
    return run ? interruptStateFromRunStatus(run.status) : 'idle';
  }

  private trySyncRunStatus(
    runId: RunId,
    tenantId: TenantId,
    status: SupportedRunStatus,
    at: string
  ): RunRow | null {
    try {
      const run = this.store.transitionRun(runId, tenantId, status, at);
      if (run !== null) {
        this.store.appendEvent(
          createLedgerEvent(
            this.nextEventId('run-sync', runId, at),
            tenantId,
            runId,
            'run_status_synced',
            at,
            { status: run.status }
          )
        );
      }
      return run;
    } catch {
      return null;
    }
  }
}

export function createAgentRuntimeService(store?: AgentRuntimeLedgerStore): AgentRuntimeService {
  return new AgentRuntimeService(store);
}

export const agentRuntimeService = createAgentRuntimeService();
