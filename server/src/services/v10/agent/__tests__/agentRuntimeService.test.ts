import { describe, expect, it } from 'vitest';

import {
  type ApprovalMode,
  type ExecutionProposalV1,
  type Severity,
  unsafeActorId,
  unsafePolicyId,
  unsafeProposalId,
  unsafeTenantId,
} from '../../../../../../src/models/agent/ExecutionProposalV1.js';
import { unsafeRunId } from '../../../../../../src/models/agent/RunLedger.js';
import { createAgentRuntimeService, createInMemoryAgentRuntimeLedgerStore } from '../index.js';

function makeProposal(
  severity: Severity,
  approvalMode: ApprovalMode,
  overrides: Partial<ExecutionProposalV1> = {}
): ExecutionProposalV1 {
  const compensatingOp = {
    kind: 'ledger_write' as const,
    target: { kind: 'ledger', id: 'undo-1' },
    payload: { undo: true },
  };

  return {
    schemaVersion: 'v1',
    id: unsafeProposalId(`proposal-${severity}`),
    tenantId: unsafeTenantId('tenant-1'),
    correlationId: `corr-${severity}`,
    messageType: 'execution_proposal',
    severity,
    ops: [
      {
        kind: 'update_entity',
        target: { kind: 'task', id: 'task-1' },
        payload: { status: 'done' },
        compensatingOp,
      },
    ],
    sources: [{ trustBundleSha256: 'sha-1', sourceHint: 'unit-test' }],
    rationale: 'Runtime test proposal',
    expectedVersions: { 'task:task-1': 'v1' },
    approvalMode,
    approvalPolicyId: unsafePolicyId('policy-1'),
    preview: { summary: 'Apply change', renderedMarkdown: null },
    navigationIntent: 'stay_in_chat',
    budget: { maxWallClockMs: 1000, maxCostUsdCents: 50, maxToolCalls: 3 },
    blastRadius: { entityCount: 1, externalVisible: severity === 'S4', tenantsAffected: 1 },
    reversibilityHint: severity === 'S4' ? 'irreversible' : 'compensating',
    proposedBy: unsafeActorId('actor-1'),
    proposedAt: '2026-04-20T10:00:00.000Z',
    expiresAt: '2026-04-20T11:00:00.000Z',
    ...overrides,
  };
}

describe('AgentRuntimeService', () => {
  it('evaluates S4 proposals with admin signature contract wiring', () => {
    const store = createInMemoryAgentRuntimeLedgerStore();
    const service = createAgentRuntimeService(store);

    const proposal = makeProposal('S4', 'admin_only');
    const result = service.evaluateExecutionProposal({
      pipelineRunId: 'pipe-1',
      runId: 'run-s4',
      proposal,
      now: '2026-04-20T10:05:00.000Z',
      persistRun: true,
    });

    expect(result.contract.requiresAdminSignature).toBe(true);
    expect(result.contract.requiredRoles).toEqual(['admin', 'superadmin']);
    expect(result.pipeline.gateDecision).toBe('requires_approval');

    const summary = service.summarizeRunLedger({
      tenantId: proposal.tenantId,
      runId: unsafeRunId('run-s4'),
    });
    expect(summary.run?.status).toBe('pending');
    expect(summary.categories.proposal_evaluated).toBe(1);
  });

  it('plans and resumes approval barriers into a running run', () => {
    const store = createInMemoryAgentRuntimeLedgerStore();
    const service = createAgentRuntimeService(store);
    const proposal = makeProposal('S3', 'multi_reviewer');

    service.evaluateExecutionProposal({
      pipelineRunId: 'pipe-2',
      runId: 'run-s3',
      proposal,
      now: '2026-04-20T10:10:00.000Z',
      persistRun: true,
    });

    const planned = service.planApprovalBarrier({
      proposal,
      runId: 'run-s3',
      emittedAt: '2026-04-20T10:11:00.000Z',
    });
    expect(planned.simulation.outcome).toBe('paused');

    const resumed = service.resumeApprovalBarrier({
      tenantId: proposal.tenantId,
      runId: unsafeRunId('run-s3'),
      pause:
        planned.simulation.outcome === 'paused'
          ? planned.simulation.pause
          : (() => {
              throw new Error('Expected paused simulation');
            })(),
      decision: 'approved',
      resumedAt: '2026-04-20T10:12:00.000Z',
    });

    expect(resumed.resume.outcome).toBe('resumed');
    expect(resumed.run?.status).toBe('running');

    const summary = service.summarizeRunLedger({
      tenantId: proposal.tenantId,
      runId: unsafeRunId('run-s3'),
    });
    expect(summary.categories.approval_barrier_planned).toBe(1);
    expect(summary.categories.approval_barrier_resumed).toBe(1);
  });

  it('submits interrupts and syncs cancel to the ledger when possible', () => {
    const store = createInMemoryAgentRuntimeLedgerStore();
    const service = createAgentRuntimeService(store);
    const proposal = makeProposal('S0', 'implicit');

    service.evaluateExecutionProposal({
      pipelineRunId: 'pipe-3',
      runId: 'run-s0',
      proposal,
      now: '2026-04-20T10:15:00.000Z',
      persistRun: true,
    });

    const result = service.submitInterruptVerb({
      tenantId: proposal.tenantId,
      runId: unsafeRunId('run-s0'),
      verb: 'cancel',
      actorId: 'operator-1',
      recordedAt: '2026-04-20T10:16:00.000Z',
      compensationRecord: {
        entries: [{ stepId: 'step-1', action: 'undo write' }],
      },
    });

    expect(result.currentState).toBe('running');
    expect(result.decision.nextState).toBe('cancelled');
    expect(result.syncedRun?.status).toBe('cancelled');
  });

  it('queries and summarizes appended ledger events', () => {
    const store = createInMemoryAgentRuntimeLedgerStore();
    const service = createAgentRuntimeService(store);
    const proposal = makeProposal('S1', 'inline');

    service.appendRunLedger({
      run: {
        id: unsafeRunId('run-query'),
        tenantId: proposal.tenantId,
        correlationId: 'corr-query',
        status: 'pending',
        severity: 'S1',
        startedAt: null,
        finishedAt: null,
        budgetUsed: { wallMs: 0, costCents: 0, toolCalls: 0, tokens: 0 },
      },
      event: {
        tenantId: proposal.tenantId,
        runId: unsafeRunId('run-query'),
        category: 'custom',
        recordedAt: '2026-04-20T10:20:00.000Z',
        payload: { marker: true },
      },
    });

    const query = service.queryRunLedger({
      query: {
        tenantId: proposal.tenantId,
        id: unsafeRunId('run-query'),
      },
    });
    expect(query.runs).toHaveLength(1);
    expect(query.events).toHaveLength(1);

    const summary = service.summarizeRunLedger({
      tenantId: proposal.tenantId,
      runId: unsafeRunId('run-query'),
    });
    expect(summary.eventCount).toBe(1);
    expect(summary.categories.custom).toBe(1);
  });
});
