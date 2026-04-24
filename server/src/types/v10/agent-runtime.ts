import { z } from 'zod';

import type {
  ApprovalBarrierSequence,
  BarrierPauseState,
  BarrierResumeResult,
} from '../../models/agent/ApprovalBarrierSequence.js';
import type {
  ExecutionProposalV1,
  Severity,
  TenantId,
} from '../../models/agent/ExecutionProposalV1.js';
import type {
  CompensationRecord,
  InterruptVerb,
  NextStateDecision,
  RunState,
} from '../../models/agent/InterruptVerbs.js';
import type { LedgerQuery, RunId, RunRow, RunStatus } from '../../models/agent/RunLedger.js';
import type { AgentExecutionPipelineOutput } from '../../models/v10/pipelines/AgentExecutionPipeline.js';

export type AgentRuntimeLedgerEventCategory =
  | 'proposal_evaluated'
  | 'approval_barrier_planned'
  | 'approval_barrier_resumed'
  | 'interrupt_submitted'
  | 'run_status_synced'
  | 'ledger_appended'
  | 'custom';

export interface AgentRuntimeApprovalContract {
  readonly severity: Severity;
  readonly approvalMode: ExecutionProposalV1['approvalMode'];
  readonly requiredReviewerCount: number;
  readonly requiredRoles: readonly string[];
  readonly requiresAdminSignature: boolean;
  readonly requiresExplicitResume: boolean;
  readonly requiresCompensatingOps: boolean;
}

export interface AgentRuntimeSagaPlan {
  readonly stepCount: number;
  readonly barrierOrdinals: readonly number[];
  readonly compensatingOpCount: number;
  readonly interruptible: boolean;
}

export interface AgentRuntimeLedgerEvent {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly runId: RunId;
  readonly category: AgentRuntimeLedgerEventCategory;
  readonly recordedAt: string;
  readonly actorId: string | null;
  readonly payload: unknown;
}

export interface AgentRuntimeLedgerQueryResult {
  readonly runs: readonly RunRow[];
  readonly events: readonly AgentRuntimeLedgerEvent[];
}

export interface AgentRuntimeLedgerSummary {
  readonly runId: RunId;
  readonly tenantId: TenantId;
  readonly run: RunRow | null;
  readonly runtimeState: RunState | null;
  readonly eventCount: number;
  readonly categories: Readonly<Record<string, number>>;
  readonly lastRecordedAt: string | null;
}

export interface EvaluateExecutionProposalInput {
  readonly pipelineRunId: string;
  readonly runId: string;
  readonly proposal: ExecutionProposalV1;
  readonly operatorApproved?: boolean;
  readonly now: string;
  readonly persistRun?: boolean;
}

export interface EvaluateExecutionProposalResult {
  readonly pipeline: AgentExecutionPipelineOutput;
  readonly contract: AgentRuntimeApprovalContract;
  readonly sagaPlan: AgentRuntimeSagaPlan;
  readonly barrierSequence: ApprovalBarrierSequence | null;
}

export interface PlanApprovalBarrierInput {
  readonly proposal: ExecutionProposalV1;
  readonly runId: string;
  readonly stepCount?: number;
  readonly untilStepOrdinal?: number;
  readonly emittedAt: string;
}

export interface PlanApprovalBarrierResult {
  readonly sequence: ApprovalBarrierSequence;
  readonly simulation:
    | { readonly outcome: 'completed'; readonly completedSteps: number }
    | { readonly outcome: 'paused'; readonly pause: BarrierPauseState };
}

export interface ResumeApprovalBarrierInput {
  readonly tenantId: TenantId;
  readonly runId: RunId;
  readonly pause: BarrierPauseState;
  readonly decision: 'approved' | 'rejected';
  readonly resumedAt: string;
  readonly actorId?: string;
  readonly actorRole?: string | null;
  readonly reviewerCount?: number;
  readonly adminSignature?: string | null;
  readonly note?: string | null;
}

export interface ResumeApprovalBarrierResult {
  readonly resume: BarrierResumeResult;
  readonly run: RunRow | null;
}

export interface SubmitInterruptVerbInput {
  readonly tenantId: TenantId;
  readonly runId: RunId;
  readonly currentState?: RunState;
  readonly verb: InterruptVerb;
  readonly actorId: string;
  readonly recordedAt: string;
  readonly compensationRecord?: CompensationRecord | null;
}

export interface SubmitInterruptVerbResult {
  readonly currentState: RunState;
  readonly decision: NextStateDecision;
  readonly syncedRun: RunRow | null;
}

export interface AppendRunLedgerInput {
  readonly run?: RunRow;
  readonly event: {
    readonly id?: string;
    readonly tenantId: TenantId;
    readonly runId: RunId;
    readonly category: AgentRuntimeLedgerEventCategory;
    readonly recordedAt: string;
    readonly actorId?: string | null;
    readonly payload: unknown;
  };
}

export interface QueryRunLedgerInput {
  readonly query: LedgerQuery;
}

export interface SummarizeRunLedgerInput {
  readonly tenantId: TenantId;
  readonly runId: RunId;
}

export interface AgentRuntimeLedgerStore {
  upsertRun(run: RunRow): Promise<RunRow>;
  getRun(runId: RunId, tenantId: TenantId): Promise<RunRow | null>;
  transitionRun(
    runId: RunId,
    tenantId: TenantId,
    status: RunStatus,
    at: string
  ): Promise<RunRow | null>;
  appendEvent(event: AgentRuntimeLedgerEvent): Promise<AgentRuntimeLedgerEvent>;
  query(query: LedgerQuery): Promise<AgentRuntimeLedgerQueryResult>;
  summarize(runId: RunId, tenantId: TenantId): Promise<AgentRuntimeLedgerSummary>;
  setRuntimeState(runId: RunId, tenantId: TenantId, state: RunState): Promise<void>;
  getRuntimeState(runId: RunId, tenantId: TenantId): Promise<RunState | null>;
}

export const EvaluateExecutionProposalSchema = z.object({
  pipelineRunId: z.string().min(1),
  runId: z.string().min(1),
  proposal: z.custom<ExecutionProposalV1>(),
  operatorApproved: z.boolean().optional(),
  now: z.string().min(1),
  persistRun: z.boolean().optional(),
});

export const PlanApprovalBarrierSchema = z.object({
  proposal: z.custom<ExecutionProposalV1>(),
  runId: z.string().min(1),
  stepCount: z.number().int().positive().optional(),
  untilStepOrdinal: z.number().int().min(0).optional(),
  emittedAt: z.string().min(1),
});

export const ResumeApprovalBarrierSchema = z.object({
  tenantId: z.string().min(1),
  runId: z.string().min(1),
  pause: z.custom<BarrierPauseState>(),
  decision: z.enum(['approved', 'rejected']),
  resumedAt: z.string().min(1),
  actorId: z.string().min(1).optional(),
  actorRole: z.string().nullable().optional(),
  reviewerCount: z.number().int().nonnegative().optional(),
  adminSignature: z.string().nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});

export const SubmitInterruptVerbSchema = z.object({
  tenantId: z.string().min(1),
  runId: z.string().min(1),
  currentState: z.custom<RunState>().optional(),
  verb: z.enum([
    'pause',
    'resume',
    'cancel',
    'skip',
    'redo',
    'retry',
    'reset',
    'rewind',
    'abort',
  ] as [InterruptVerb, ...InterruptVerb[]]),
  actorId: z.string().min(1),
  recordedAt: z.string().min(1),
  compensationRecord: z.custom<CompensationRecord>().nullable().optional(),
});

export const AppendRunLedgerSchema = z.object({
  run: z.custom<RunRow>().optional(),
  event: z.object({
    id: z.string().min(1).optional(),
    tenantId: z.string().min(1),
    runId: z.string().min(1),
    category: z.enum([
      'proposal_evaluated',
      'approval_barrier_planned',
      'approval_barrier_resumed',
      'interrupt_submitted',
      'run_status_synced',
      'ledger_appended',
      'custom',
    ]),
    recordedAt: z.string().min(1),
    actorId: z.string().nullable().optional(),
    payload: z.unknown(),
  }),
});

export const QueryRunLedgerSchema = z.object({
  query: z.object({
    tenantId: z.string().min(1),
    id: z.string().optional(),
    correlationId: z.string().optional(),
    conversationId: z.string().optional(),
    origin: z.string().optional(),
    runType: z.string().optional(),
    parentRunId: z.string().optional(),
    status: z.custom<RunStatus>().optional(),
    severity: z.custom<Severity>().optional(),
    startedAtFrom: z.string().optional(),
    startedAtTo: z.string().optional(),
    limit: z.number().int().positive().max(1000).optional(),
  }),
});

export const SummarizeRunLedgerSchema = z.object({
  tenantId: z.string().min(1),
  runId: z.string().min(1),
});
