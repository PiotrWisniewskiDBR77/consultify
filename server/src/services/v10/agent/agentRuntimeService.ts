import {
  type ApprovalBarrierSequence,
  assertBarrierEventEmitted,
  assertResumePoint,
  resumeAfterBarrier,
  simulateBarrierSequence,
} from '../../../models/agent/ApprovalBarrierSequence.js';
import {
  type ExecutionProposalV1,
  type Severity,
  type TenantId,
} from '../../../models/agent/ExecutionProposalV1.js';
import {
  applyInterrupt,
  assertCompensationImpliedByVerb,
  type RunState,
} from '../../../models/agent/InterruptVerbs.js';
import { type RunId, type RunRow, unsafeRunId } from '../../../models/agent/RunLedger.js';
import { getSeverityPolicy } from '../../../models/agent/SeverityPolicies.js';
import {
  runAgentExecutionPipeline,
  unsafeAgentExecutionPipelineRunId,
} from '../../../models/v10/pipelines/AgentExecutionPipeline.js';
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
import { createDatabaseBackedAgentRuntimeLedgerStore } from './runLedgerDbStore.js';

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
    approvalState: proposal.approvalMode === 'implicit' ? 'approved' : 'awaiting_approval',
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

function normalizeRole(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function roleSatisfies(requiredRoles: readonly string[], actorRole: string | null | undefined): boolean {
  const normalized = normalizeRole(actorRole);
  if (!normalized) return false;
  if (normalized === 'superadmin' || normalized === 'super_admin' || normalized === 'owner') {
    return true;
  }
  return requiredRoles.map(normalizeRole).includes(normalized);
}

export class AgentRuntimeService {
  private sequence = 0;

  constructor(
    private readonly store: AgentRuntimeLedgerStore = createDatabaseBackedAgentRuntimeLedgerStore()
  ) {}

  private nextEventId(prefix: string, runId: RunId, recordedAt: string): string {
    this.sequence += 1;
    return eventId(prefix, runId, recordedAt, this.sequence);
  }

  async evaluateExecutionProposal(
    input: EvaluateExecutionProposalInput
  ): Promise<EvaluateExecutionProposalResult> {
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
      await this.store.upsertRun(baseRun);
      await this.store.setRuntimeState(
        runId,
        input.proposal.tenantId,
        interruptStateFromRunStatus(baseRun.status)
      );

      if (pipeline.gateDecision === 'rejected') {
        const cancelled = await this.store.transitionRun(
          runId,
          input.proposal.tenantId,
          'cancelled',
          input.now
        );
        if (cancelled !== null) {
          await this.store.setRuntimeState(runId, input.proposal.tenantId, 'cancelled');
        }
      }
    }

    await this.store.appendEvent(
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

  async planApprovalBarrier(input: PlanApprovalBarrierInput): Promise<PlanApprovalBarrierResult> {
    const runId = unsafeRunId(input.runId);
    const stepCount = Math.max(1, input.stepCount ?? input.proposal.ops.length + 1);
    const sequence = buildBarrierSequence(input.proposal, stepCount);
    const simulation = simulateBarrierSequence(sequence, {
      untilStepOrdinal: input.untilStepOrdinal,
      emittedAt: input.emittedAt,
    });

    assertBarrierEventEmitted(simulation);

    if (simulation.outcome === 'paused') {
      await this.trySyncRunStatus(runId, input.proposal.tenantId, 'paused', input.emittedAt);
      await this.store.setRuntimeState(runId, input.proposal.tenantId, 'paused');
    }

    await this.store.appendEvent(
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

  async resumeApprovalBarrier(
    input: ResumeApprovalBarrierInput
  ): Promise<ResumeApprovalBarrierResult> {
    const resume = resumeAfterBarrier(input.pause, input.decision, input.resumedAt);
    assertResumePoint(input.pause, resume);

    const run = await this.store.getRun(input.runId, input.tenantId);
    if (!run) {
      throw new Error(`Run ${String(input.runId)} not found`);
    }

    const contract = buildApprovalContract(run.severity);
    if (contract.requiredReviewerCount > 0) {
      if ((input.reviewerCount ?? 0) < contract.requiredReviewerCount) {
        throw new Error(
          `Resume requires ${contract.requiredReviewerCount} reviewer approvals for ${run.severity}`
        );
      }
      if (!roleSatisfies(contract.requiredRoles, input.actorRole || null)) {
        throw new Error(`Role ${String(input.actorRole || 'unknown')} cannot resume ${run.severity}`);
      }
    }
    if (contract.requiresAdminSignature && !String(input.adminSignature || '').trim()) {
      throw new Error(`Resume for ${run.severity} requires admin signature`);
    }

    let syncedRun: RunRow | null = null;
    if (resume.outcome === 'resumed') {
      syncedRun = await this.trySyncRunStatus(input.runId, input.tenantId, 'running', input.resumedAt);
      await this.store.setRuntimeState(input.runId, input.tenantId, 'running');
    } else {
      syncedRun = await this.trySyncRunStatus(
        input.runId,
        input.tenantId,
        'cancelled',
        input.resumedAt
      );
      await this.store.setRuntimeState(input.runId, input.tenantId, 'cancelled');
    }

    await this.store.appendEvent(
      createLedgerEvent(
        this.nextEventId('barrier-resume', input.runId, input.resumedAt),
        input.tenantId,
        input.runId,
        'approval_barrier_resumed',
        input.resumedAt,
        {
          ...resume,
          actorId: input.actorId || null,
          actorRole: input.actorRole || null,
          reviewerCount: input.reviewerCount ?? 0,
          adminSignaturePresent: Boolean(input.adminSignature),
          note: input.note || null,
        },
        input.actorId || null
      )
    );

    return { resume, run: syncedRun };
  }

  async submitInterruptVerb(input: SubmitInterruptVerbInput): Promise<SubmitInterruptVerbResult> {
    const inferredCurrentState =
      input.currentState ??
      (await this.store.getRuntimeState(input.runId, input.tenantId)) ??
      (await this.inferCurrentStateFromRun(input.runId, input.tenantId));

    assertCompensationImpliedByVerb(input.verb, input.compensationRecord);
    const decision = applyInterrupt(inferredCurrentState, input.verb);

    if (decision.reason !== 'illegal') {
      await this.store.setRuntimeState(input.runId, input.tenantId, decision.nextState);
    }

    let syncedRun: RunRow | null = null;
    const mappedStatus = runStatusFromInterruptState(decision.nextState);
    if (decision.reason !== 'illegal' && mappedStatus !== null) {
      syncedRun = await this.trySyncRunStatus(
        input.runId,
        input.tenantId,
        mappedStatus,
        input.recordedAt
      );
    }

    await this.store.appendEvent(
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

  async appendRunLedger(input: AppendRunLedgerInput): Promise<AgentRuntimeLedgerEvent> {
    if (input.run) {
      await this.store.upsertRun(input.run);
      await this.store.setRuntimeState(
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

  async queryRunLedger(input: QueryRunLedgerInput) {
    return this.store.query(input.query);
  }

  async summarizeRunLedger(input: SummarizeRunLedgerInput) {
    return this.store.summarize(input.runId, input.tenantId);
  }

  getStore(): AgentRuntimeLedgerStore {
    return this.store;
  }

  private async inferCurrentStateFromRun(
    runId: RunId,
    tenantId: TenantId
  ): Promise<SubmitInterruptVerbResult['currentState']> {
    const run = await this.store.getRun(runId, tenantId);
    return run ? interruptStateFromRunStatus(run.status) : 'idle';
  }

  private async trySyncRunStatus(
    runId: RunId,
    tenantId: TenantId,
    status: SupportedRunStatus,
    at: string
  ): Promise<RunRow | null> {
    try {
      const run = await this.store.transitionRun(runId, tenantId, status, at);
      if (run !== null) {
        await this.store.appendEvent(
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
