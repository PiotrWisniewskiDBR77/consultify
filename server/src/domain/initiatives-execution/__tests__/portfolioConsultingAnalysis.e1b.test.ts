/** @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import { materialCommandFingerprint, MaterialCommandRuleError } from '../materialCommand.js';
import {
  type CapturedPortfolioConsultingAnalysis,
  capturePortfolioConsultingAnalysis,
  portfolioAnalysisRequestDigest,
  type PortfolioAnalysisSnapshot,
  type PortfolioConsultingAnalysis,
  runCapturedPortfolioConsultingAnalysis,
} from '../portfolioConsultingAnalysis.js';

const contextFacts = (organizationId: string) => ({
  organizationId,
  schemaVersion: 1,
  claims: [{ claimId: `claim-${organizationId}`, claimPath: 'strategy.theme', value: 'lead-time' }],
});

const snapshot = (organizationId = 'org-a'): PortfolioAnalysisSnapshot => ({
  snapshotVersion: 1,
  organizationId,
  asOf: '2026-09-13T12:00:00.000Z',
  source: {
    system: 'initiativeUnifiedReader',
    version: 'runtime-v1',
    capturedAt: '2026-09-13T12:00:00.000Z',
  },
  portfolio: {
    scenarioId: 'portfolio-a',
    aggregateVersion: 3,
    scenarioVersion: 2,
    facts: { scenarioId: 'portfolio-a', scenarioVersion: 2, name: 'Current portfolio' },
  },
  initiatives: [
    {
      initiativeId: 'initiative-a',
      initiativeVersion: 4,
      projectId: 'project-a',
      source: 'CANONICAL',
      facts: {
        projectId: 'project-a',
        title: 'Reduce lead time',
        lifecycleState: 'READY_FOR_DECISION',
      },
      evidenceRefs: ['initiative:initiative-a:v4'],
    },
  ],
  decisionHistory: [
    {
      decisionId: 'decision-old',
      version: 2,
      initiativeId: 'initiative-a',
      sourceRef: 'decision:decision-old:v2',
      facts: { initiativeId: 'initiative-a', outcome: 'DEFERRED' },
    },
  ],
  runningWork: [
    {
      aggregateType: 'execution_case',
      aggregateId: 'case-a',
      version: 3,
      sourceRef: 'execution_case:case-a:v3',
      facts: { initiativeId: 'initiative-a', status: 'IN_PROGRESS' },
    },
  ],
  organizationContext: {
    snapshotId: `context-${organizationId}`,
    version: 5,
    contentHash: `context-hash-${organizationId}`,
    facts: contextFacts(organizationId),
  },
});

const output = (decisionKind: 'IN' | 'PARKING' = 'IN') => ({
  items: [
    {
      itemId: 'observation-a',
      position: 1,
      kind: 'OBSERVATION',
      criterion: 'COVERAGE_GAP',
      initiativeIds: ['initiative-a'],
      rationale: 'The current portfolio leaves one documented goal uncovered.',
      evidence: [
        {
          initiativeId: 'initiative-a',
          field: 'facts.lifecycleState',
          source: 'initiativeUnifiedReader',
          sourceRef: 'initiative:initiative-a:v4',
        },
      ],
      confidence: 'MEDIUM',
      alternatives: ['Accept the gap explicitly.'],
      missingData: ['Goal weighting is unavailable.'],
      proposedDisposition: null,
    },
    {
      itemId: 'recommendation-a',
      position: 2,
      kind: 'RECOMMENDATION',
      criterion: 'PRIORITY',
      initiativeIds: ['initiative-a'],
      rationale: 'Review the initiative against the uncovered goal before committing capacity.',
      evidence: [
        {
          initiativeId: 'initiative-a',
          field: 'facts.title',
          source: 'initiativeUnifiedReader',
          sourceRef: 'initiative:initiative-a:v4',
        },
      ],
      confidence: 'LOW',
      alternatives: ['Keep the current rank.'],
      missingData: ['Capacity confidence is unavailable.'],
      proposedDisposition: null,
    },
    {
      itemId: 'decision-a',
      position: 3,
      kind: 'DECISION',
      criterion: 'NEW_VS_EXTENSION',
      initiativeIds: ['initiative-a'],
      rationale: 'A human portfolio owner must choose the disposition.',
      evidence: [
        {
          initiativeId: 'initiative-a',
          field: 'initiativeVersion',
          source: 'initiativeUnifiedReader',
          sourceRef: 'initiative:initiative-a:v4',
        },
      ],
      confidence: 'MEDIUM',
      alternatives: ['Extend an existing initiative.'],
      missingData: [],
      proposedDisposition: {
        kind: decisionKind,
        reason: decisionKind === 'IN' ? 'Fits the current portfolio.' : 'Wait for goal approval.',
        returnCondition: decisionKind === 'PARKING' ? 'Goal G1 is approved.' : null,
      },
    },
  ],
});

const provenance = (organizationId = 'org-a') => ({
  runId: `model-run-${organizationId}`,
  provider: 'test-provider',
  modelId: 'test-model',
  modelVersion: '2026-09',
  promptVersion: 'portfolio-consulting-v1',
  generatedAt: '2026-09-13T12:00:01.000Z',
});

const captureEnvelope = (organizationId = 'org-a') => ({
  organizationId,
  actorId: 'portfolio-owner',
  aggregateType: 'portfolio_analysis',
  aggregateId: `analysis-${organizationId}`,
  expectedVersion: 0,
  clientRequestId: `analysis-capture-${organizationId}`,
  correlationId: `analysis-capture-correlation-${organizationId}`,
  policyId: 'policy-a',
  policyVersion: 1,
  commandType: 'portfolio.analysis.capture',
  createIfMissing: true,
  payload: { rubricVersion: 'portfolio-consulting-v1', snapshot: snapshot(organizationId) },
});

function captured(organizationId = 'org-a'): CapturedPortfolioConsultingAnalysis {
  const source = snapshot(organizationId);
  return {
    analysisId: `analysis-${organizationId}`,
    aggregateVersion: 1,
    status: 'CAPTURED',
    rubricVersion: 'portfolio-consulting-v1',
    requestDigest: portfolioAnalysisRequestDigest('portfolio-consulting-v1', source),
    snapshot: source,
    requestedBy: 'portfolio-owner',
  };
}

function harness(args?: {
  captured?: CapturedPortfolioConsultingAnalysis;
  initiativePayload?: Record<string, unknown>;
  portfolioVersion?: number;
  portfolioPayload?: Record<string, unknown>;
  contextFacts?: Record<string, unknown>;
  contextHash?: string;
  decisionVersion?: number;
  decisionPayload?: Record<string, unknown>;
  runningVersion?: number;
  runningPayload?: Record<string, unknown>;
}) {
  const stored = args?.captured;
  let inTransaction = false;
  const transaction = {
    findReceipt: vi.fn().mockResolvedValue(null),
    getAggregateVersion: vi.fn().mockResolvedValue(stored ? 1 : null),
    getAggregatePayload: vi.fn(async (_org: string, type: string) => {
      if (type === 'portfolio_analysis') return stored ?? null;
      if (type === 'initiative')
        return (
          args?.initiativePayload ?? {
            projectId: 'project-a',
            title: 'Reduce lead time',
            lifecycleState: 'READY_FOR_DECISION',
          }
        );
      return null;
    }),
    getRelatedAggregateForUpdate: vi.fn(async (_org: string, type: string, id: string) => {
      if (type === 'portfolio_scenario')
        return {
          version: args?.portfolioVersion ?? 3,
          payload: args?.portfolioPayload ?? {
            scenarioId: 'portfolio-a',
            scenarioVersion: 2,
            name: 'Current portfolio',
          },
        };
      if (type === 'initiative')
        return {
          version: 4,
          payload: args?.initiativePayload ?? {
            projectId: 'project-a',
            title: 'Reduce lead time',
            lifecycleState: 'READY_FOR_DECISION',
          },
        };
      if (type === 'decision' && id === 'decision-old')
        return {
          version: args?.decisionVersion ?? 2,
          payload: args?.decisionPayload ?? { initiativeId: 'initiative-a', outcome: 'DEFERRED' },
        };
      return {
        version: args?.runningVersion ?? 3,
        payload: args?.runningPayload ?? { initiativeId: 'initiative-a', status: 'IN_PROGRESS' },
      };
    }),
    persistAggregate: vi.fn().mockResolvedValue(undefined),
    appendAudit: vi.fn().mockResolvedValue(undefined),
    appendOutbox: vi.fn().mockResolvedValue(undefined),
    saveReceipt: vi.fn().mockResolvedValue(undefined),
  };
  const contextReader = {
    findGovernedSnapshot: vi.fn(async (input: { organizationId: string }) => ({
      contentHash: args?.contextHash ?? `context-hash-${input.organizationId}`,
      snapshot: args?.contextFacts ?? contextFacts(input.organizationId),
    })),
  };
  const unitOfWork = {
    transaction: vi.fn(async (work: (tx: typeof transaction) => Promise<unknown>) => {
      inTransaction = true;
      try {
        return await work(transaction);
      } finally {
        inTransaction = false;
      }
    }),
  };
  return { transaction, unitOfWork, contextReader, isInTransaction: () => inTransaction };
}

const gateway = (organizationId = 'org-a') => ({
  analyze: vi.fn().mockResolvedValue({
    provenance: provenance(organizationId),
    output: output(organizationId === 'org-a' ? 'IN' : 'PARKING'),
  }),
});

describe('E1b durable portfolio consulting analysis', () => {
  it('captures a tenant-scoped exact snapshot through MaterialCommand', async () => {
    const { transaction, unitOfWork, contextReader } = harness();

    const result = await capturePortfolioConsultingAnalysis(
      unitOfWork as any,
      captureEnvelope() as any,
      contextReader
    );

    expect(result).toMatchObject({
      status: 'APPLIED',
      aggregateVersion: 1,
      response: {
        analysisId: 'analysis-org-a',
        status: 'CAPTURED',
        snapshot: { organizationId: 'org-a', asOf: '2026-09-13T12:00:00.000Z' },
      },
    });
    expect(transaction.persistAggregate).toHaveBeenCalledWith(
      'org-a',
      'portfolio_analysis',
      'analysis-org-a',
      0,
      1,
      expect.objectContaining({ status: 'CAPTURED' })
    );
    expect(transaction.appendAudit).toHaveBeenCalledOnce();
    expect(transaction.appendOutbox).toHaveBeenCalledOnce();
    expect(transaction.saveReceipt).toHaveBeenCalledOnce();
  });

  it.each([
    [
      'facts',
      {
        initiativePayload: {
          projectId: 'project-a',
          title: 'Altered',
          lifecycleState: 'READY_FOR_DECISION',
        },
      },
      'Exact Portfolio Initiative snapshot is stale',
    ],
    [
      'project',
      {
        initiativePayload: {
          projectId: 'project-b',
          title: 'Reduce lead time',
          lifecycleState: 'READY_FOR_DECISION',
        },
      },
      'Exact Portfolio Initiative snapshot is stale',
    ],
    ['portfolio', { portfolioVersion: 4 }, 'Exact Portfolio Scenario snapshot is stale'],
    [
      'portfolio facts',
      {
        portfolioPayload: {
          scenarioId: 'portfolio-a',
          scenarioVersion: 2,
          name: 'Altered portfolio',
        },
      },
      'Exact Portfolio Scenario snapshot is stale',
    ],
    [
      'organization context bytes',
      { contextFacts: { organizationId: 'org-a', schemaVersion: 1, claims: [] } },
      'Exact governed organization snapshot is stale',
    ],
    [
      'organization context hash',
      { contextHash: 'altered-hash' },
      'Exact governed organization snapshot is stale',
    ],
    ['decision history', { decisionVersion: 3 }, 'Exact Portfolio Decision history is stale'],
    [
      'decision history facts',
      { decisionPayload: { initiativeId: 'initiative-a', outcome: 'APPROVED' } },
      'Exact Portfolio Decision history is stale',
    ],
    ['running work', { runningVersion: 4 }, 'Exact Portfolio running work snapshot is stale'],
    [
      'running work facts',
      { runningPayload: { initiativeId: 'initiative-a', status: 'DONE' } },
      'Exact Portfolio running work snapshot is stale',
    ],
  ])('rejects same-identity altered %s before capture', async (_label, overrides, message) => {
    const { transaction, unitOfWork, contextReader } = harness(overrides);
    await expect(
      capturePortfolioConsultingAnalysis(unitOfWork as any, captureEnvelope() as any, contextReader)
    ).rejects.toThrow(message);
    expect(transaction.persistAggregate).not.toHaveBeenCalled();
  });

  it.each([
    ['source', (value: any) => (value.initiatives[0].source = 'LEGACY')],
    ['evidence ref', (value: any) => (value.initiatives[0].evidenceRefs = ['invented'])],
    ['capture time', (value: any) => (value.source.capturedAt = '2026-09-13T12:01:00.000Z')],
    ['context tenant', (value: any) => (value.organizationContext.facts.organizationId = 'org-b')],
    ['running work type', (value: any) => (value.runningWork[0].aggregateType = 'anything')],
    ['arrays', (value: any) => (value.runningWork = null)],
  ])('rejects malformed snapshot %s before opening a transaction', async (_label, mutate) => {
    const command = captureEnvelope();
    mutate(command.payload.snapshot);
    const { unitOfWork, contextReader } = harness();
    await expect(
      capturePortfolioConsultingAnalysis(unitOfWork as any, command as any, contextReader)
    ).rejects.toBeTruthy();
    expect(unitOfWork.transaction).not.toHaveBeenCalled();
  });

  it('finalizes only the exact persisted capture and bound model run', async () => {
    const source = captured();
    const { transaction, unitOfWork, contextReader } = harness({ captured: source });

    const result = await runCapturedPortfolioConsultingAnalysis({
      organizationId: 'org-a',
      actorId: 'portfolio-owner',
      analysisId: source.analysisId,
      clientRequestId: 'analysis-finalize-org-a',
      correlationId: 'analysis-finalize-correlation-org-a',
      policyId: 'policy-a',
      policyVersion: 1,
      reader: { find: vi.fn().mockResolvedValue({ version: 1, analysis: source }) },
      contextReader,
      gateway: gateway(),
      uow: unitOfWork as any,
    });

    expect(result).toMatchObject({
      aggregateVersion: 2,
      status: 'PENDING_REVIEW',
      requestDigest: source.requestDigest,
      model: { runId: 'model-run-org-a', promptVersion: 'portfolio-consulting-v1' },
    });
    expect(transaction.persistAggregate).toHaveBeenCalledWith(
      'org-a',
      'portfolio_analysis',
      'analysis-org-a',
      1,
      2,
      expect.objectContaining({ status: 'PENDING_REVIEW' })
    );
  });

  it('rejects source drift between capture and finalize with zero review output', async () => {
    const source = captured();
    const { transaction, unitOfWork, contextReader } = harness({
      captured: source,
      initiativePayload: {
        projectId: 'project-a',
        title: 'Changed after capture',
        lifecycleState: 'READY_FOR_DECISION',
      },
    });

    const attempt = runCapturedPortfolioConsultingAnalysis({
      organizationId: 'org-a',
      actorId: 'portfolio-owner',
      analysisId: source.analysisId,
      clientRequestId: 'analysis-finalize-drift',
      correlationId: 'analysis-finalize-drift-correlation',
      policyId: 'policy-a',
      policyVersion: 1,
      reader: { find: vi.fn().mockResolvedValue({ version: 1, analysis: source }) },
      contextReader,
      gateway: gateway(),
      uow: unitOfWork as any,
    });
    await expect(attempt).rejects.toThrow('Exact Portfolio Initiative snapshot is stale');
    await expect(attempt).rejects.toMatchObject<Partial<MaterialCommandRuleError>>({
      rule: 'PORTFOLIO_ANALYSIS_SOURCE_CONFLICT',
      httpStatus: 409,
    });
    expect(transaction.persistAggregate).not.toHaveBeenCalled();
    expect(transaction.appendAudit).not.toHaveBeenCalled();
    expect(transaction.saveReceipt).not.toHaveBeenCalled();
  });

  it('rejects altered model provenance from another rubric/run contract', async () => {
    const source = captured();
    const { transaction, unitOfWork, contextReader } = harness({ captured: source });
    const model = gateway();
    model.analyze.mockResolvedValue({
      provenance: { ...provenance(), promptVersion: 'other-prompt' },
      output: output(),
    });

    await expect(
      runCapturedPortfolioConsultingAnalysis({
        organizationId: 'org-a',
        actorId: 'portfolio-owner',
        analysisId: source.analysisId,
        clientRequestId: 'analysis-finalize-altered-run',
        correlationId: 'analysis-finalize-altered-run-correlation',
        policyId: 'policy-a',
        policyVersion: 1,
        reader: { find: vi.fn().mockResolvedValue({ version: 1, analysis: source }) },
        contextReader,
        gateway: model,
        uow: unitOfWork as any,
      })
    ).rejects.toThrow('Complete bound Portfolio model provenance is required');
    expect(transaction.persistAggregate).not.toHaveBeenCalled();
  });

  it('calls the model outside the transaction and does not call it after a persisted finalize', async () => {
    const source = captured();
    const first = harness({ captured: source });
    const model = gateway();
    model.analyze.mockImplementation(async () => {
      expect(first.isInTransaction()).toBe(false);
      return { provenance: provenance(), output: output() };
    });
    const reader = { find: vi.fn().mockResolvedValue({ version: 1, analysis: source }) };

    const completed = await runCapturedPortfolioConsultingAnalysis({
      organizationId: 'org-a',
      actorId: 'portfolio-owner',
      analysisId: source.analysisId,
      clientRequestId: 'finalize-run-a',
      correlationId: 'correlation-run-a',
      policyId: 'policy-a',
      policyVersion: 1,
      reader,
      contextReader: first.contextReader,
      gateway: model,
      uow: first.unitOfWork as any,
    });
    expect(completed.status).toBe('PENDING_REVIEW');
    expect(model.analyze).toHaveBeenCalledOnce();

    const already = completed as PortfolioConsultingAnalysis;
    const replayGateway = gateway();
    await expect(
      runCapturedPortfolioConsultingAnalysis({
        organizationId: 'org-a',
        actorId: 'portfolio-owner',
        analysisId: source.analysisId,
        clientRequestId: 'ignored',
        correlationId: 'ignored',
        policyId: 'policy-a',
        policyVersion: 1,
        reader: { find: vi.fn().mockResolvedValue({ version: 2, analysis: already }) },
        contextReader: first.contextReader,
        gateway: replayGateway,
        uow: first.unitOfWork as any,
      })
    ).resolves.toBe(already);
    expect(replayGateway.analyze).not.toHaveBeenCalled();
  });

  it('leaves the persisted capture retryable when the model gateway fails', async () => {
    const source = captured();
    const current = harness({ captured: source });
    const failedGateway = {
      analyze: vi.fn().mockRejectedValue(new Error('model unavailable')),
    };

    await expect(
      runCapturedPortfolioConsultingAnalysis({
        organizationId: 'org-a',
        actorId: 'portfolio-owner',
        analysisId: source.analysisId,
        clientRequestId: 'failed-model-run',
        correlationId: 'failed-model-run-correlation',
        policyId: 'policy-a',
        policyVersion: 1,
        reader: { find: vi.fn().mockResolvedValue({ version: 1, analysis: source }) },
        contextReader: current.contextReader,
        gateway: failedGateway,
        uow: current.unitOfWork as any,
      })
    ).rejects.toThrow('model unavailable');
    expect(current.unitOfWork.transaction).not.toHaveBeenCalled();
    expect(current.transaction.persistAggregate).not.toHaveBeenCalled();
  });

  it('passes different persisted organization contexts to the model', async () => {
    const seen: unknown[] = [];
    for (const organizationId of ['org-a', 'org-b']) {
      const source = captured(organizationId);
      const current = harness({ captured: source });
      const model = gateway(organizationId);
      model.analyze.mockImplementation(async (input) => {
        seen.push(input);
        return {
          provenance: provenance(organizationId),
          output: output(organizationId === 'org-a' ? 'IN' : 'PARKING'),
        };
      });
      await runCapturedPortfolioConsultingAnalysis({
        organizationId,
        actorId: 'portfolio-owner',
        analysisId: source.analysisId,
        clientRequestId: `finalize-${organizationId}`,
        correlationId: `correlation-${organizationId}`,
        policyId: 'policy-a',
        policyVersion: 1,
        reader: { find: vi.fn().mockResolvedValue({ version: 1, analysis: source }) },
        contextReader: current.contextReader,
        gateway: model,
        uow: current.unitOfWork as any,
      });
    }
    expect(seen).toHaveLength(2);
    expect(seen[0]).not.toEqual(seen[1]);
  });

  it('replays capture without any source lock or second write', async () => {
    const command = captureEnvelope();
    const stored = captured();
    const { transaction, unitOfWork, contextReader } = harness();
    transaction.findReceipt.mockResolvedValue({
      organizationId: 'org-a',
      clientRequestId: command.clientRequestId,
      commandType: command.commandType,
      aggregateType: command.aggregateType,
      aggregateId: command.aggregateId,
      aggregateVersion: 1,
      correlationId: command.correlationId,
      requestFingerprint: materialCommandFingerprint(command),
      response: stored,
    });
    await expect(
      capturePortfolioConsultingAnalysis(unitOfWork as any, command as any, contextReader)
    ).resolves.toMatchObject({ status: 'REPLAYED', response: stored });
    expect(contextReader.findGovernedSnapshot).not.toHaveBeenCalled();
    expect(transaction.getRelatedAggregateForUpdate).not.toHaveBeenCalled();
    expect(transaction.persistAggregate).not.toHaveBeenCalled();
  });
});
