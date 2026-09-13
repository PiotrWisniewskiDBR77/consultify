/** @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import llmService from '../../ai/llmService.js';
import {
  ConfiguredPortfolioConsultingModelGateway,
  isPortfolioConsultingAnalysisEnabled,
  PortfolioAnalysisRuntimeError,
  PostgresPortfolioConsultingAnalysisRuntimeService,
} from '../portfolioConsultingAnalysisRuntimeService.js';

const organizationId = 'org-runtime-analysis';
const scenarioId = 'scenario-runtime-analysis';

function fixture() {
  const scenario = {
    scenarioId,
    scenarioVersion: 6,
    status: 'PUBLISHED',
    scope: { portfolioId: 'portfolio-runtime', goalIds: [], asOf: '2026-09-13T10:00:00Z' },
    model: { modelId: 'portfolio-model', version: 2 },
    memberships: [
      { initiativeId: 'initiative-no-project', initiativeVersion: 4, disposition: 'INCLUDED' },
      { initiativeId: 'initiative-b', initiativeVersion: 7, disposition: 'CONDITIONAL' },
    ],
  };
  const initiatives = new Map([
    [
      'initiative-no-project',
      {
        version: 4,
        initiative: {
          initiativeId: 'initiative-no-project',
          projectId: null,
          lifecycleState: 'READY_FOR_DECISION',
          title: 'Native portfolio item',
        },
        updatedAt: '2026-09-13T11:00:00.000Z',
      },
    ],
    [
      'initiative-b',
      {
        version: 7,
        initiative: {
          initiativeId: 'initiative-b',
          projectId: 'project-b',
          lifecycleState: 'IN_EXECUTION',
          title: 'Running item',
        },
        updatedAt: '2026-09-13T11:01:00.000Z',
      },
    ],
  ]);
  const sourceRows = [
    {
      aggregate_type: 'decision',
      aggregate_id: 'decision-parking',
      version: 3,
      payload_json: {
        initiativeId: 'initiative-no-project',
        status: 'APPROVED',
        disposition: {
          kind: 'PARKING',
          reason: 'Wait for regulation',
          returnCondition: 'Regulation published',
        },
      },
    },
    {
      aggregate_type: 'execution_task',
      aggregate_id: 'task-running',
      version: 2,
      payload_json: {
        initiativeId: 'initiative-b',
        executionCaseId: 'case-b',
        status: 'OPEN',
      },
    },
  ];
  const context = {
    snapshotId: 'context-runtime',
    organizationId,
    version: 9,
    schemaVersion: 1,
    contentHash: 'context-hash',
    claimCount: 2,
    createdAt: '2026-09-13T09:00:00.000Z',
    createdBy: 'context-owner',
    claims: [
      {
        claimId: 'claim-public',
        visibilityScope: 'organization',
        value: 'Public regulated market fact',
      },
      {
        claimId: 'claim-restricted',
        visibilityScope: 'restricted',
        value: 'RESTRICTED_CONTEXT_SECRET',
      },
    ],
    sourceRefs: [
      { claimId: 'claim-public', sourceDocId: null, dangling: false, danglingReason: null },
      { claimId: 'claim-restricted', sourceDocId: null, dangling: false, danglingReason: null },
    ],
  };
  return { scenario, initiatives, sourceRows, context };
}

function service(overrides: { initiativeVersion?: number; contextId?: string } = {}) {
  const data = fixture();
  if (overrides.initiativeVersion !== undefined) {
    data.initiatives.get('initiative-no-project')!.version = overrides.initiativeVersion;
  }
  if (overrides.contextId !== undefined) data.context.snapshotId = overrides.contextId;
  const query = vi
    .fn()
    .mockResolvedValueOnce({ rows: [{ as_of: new Date('2026-09-13T12:00:00.123Z') }] })
    .mockResolvedValueOnce({ rows: data.sourceRows });
  const initiativeReader = {
    findPortfolioScenario: vi.fn().mockResolvedValue({ version: 8, scenario: data.scenario }),
    listInitiativesByIds: vi.fn().mockResolvedValue(data.initiatives),
  };
  const readHeader = vi.fn(async (_org: string, id: string) => ({
    id,
    title: id,
    lifecycleState: 'READY_FOR_DECISION',
    projectId: id === 'initiative-no-project' ? null : 'project-b',
    ownerId: 'owner-a',
    source: 'CANONICAL' as const,
  }));
  const contextService = {
    getSnapshotVersion: vi.fn(async (_org: string, _version: number, opts?: unknown) => {
      if (
        opts &&
        typeof opts === 'object' &&
        (opts as { includeRestricted?: boolean }).includeRestricted
      ) {
        return data.context;
      }
      return {
        ...data.context,
        claims: data.context.claims.filter((claim) => claim.visibilityScope !== 'restricted'),
        sourceRefs: data.context.sourceRefs.filter((ref) => ref.claimId !== 'claim-restricted'),
      };
    }),
  };
  return {
    data,
    query,
    initiativeReader,
    readHeader,
    contextService,
    subject: new PostgresPortfolioConsultingAnalysisRuntimeService(
      { query } as any,
      initiativeReader as any,
      { readHeader, contextService: contextService as any }
    ),
  };
}

describe('Portfolio consulting analysis production snapshot reader', () => {
  it('freezes the exact portfolio set, nullable project, decision disposition and running work at one DB asOf', async () => {
    const f = service();

    const snapshot = await f.subject.buildSnapshot({
      organizationId,
      scenarioId,
      contextSnapshotId: 'context-runtime',
      contextVersion: 9,
    });

    expect(snapshot).toMatchObject({
      organizationId,
      asOf: '2026-09-13T12:00:00.123Z',
      source: { capturedAt: '2026-09-13T12:00:00.123Z' },
      portfolio: { scenarioId, aggregateVersion: 8, scenarioVersion: 6 },
      initiatives: [
        {
          initiativeId: 'initiative-no-project',
          initiativeVersion: 4,
          projectId: null,
          evidenceRefs: ['initiative:initiative-no-project:v4'],
        },
        { initiativeId: 'initiative-b', initiativeVersion: 7, projectId: 'project-b' },
      ],
      decisionHistory: [
        {
          decisionId: 'decision-parking',
          version: 3,
          initiativeId: 'initiative-no-project',
          sourceRef: 'decision:decision-parking:v3',
          facts: {
            disposition: {
              kind: 'PARKING',
              reason: 'Wait for regulation',
              returnCondition: 'Regulation published',
            },
          },
        },
      ],
      runningWork: [
        {
          aggregateType: 'execution_task',
          aggregateId: 'task-running',
          version: 2,
          sourceRef: 'execution_task:task-running:v2',
        },
      ],
      organizationContext: {
        snapshotId: 'context-runtime',
        version: 9,
        contentHash: 'context-hash',
        facts: {
          organizationId,
          claims: [
            {
              claimId: 'claim-public',
              visibilityScope: 'organization',
              value: 'Public regulated market fact',
            },
          ],
          sourceRefs: [{ claimId: 'claim-public' }],
        },
      },
    });
    expect(JSON.stringify(snapshot)).not.toContain('RESTRICTED_CONTEXT_SECRET');
    expect(f.contextService.getSnapshotVersion).toHaveBeenCalledWith(organizationId, 9);
    expect(f.readHeader).toHaveBeenCalledTimes(2);
    expect(f.query.mock.calls[1][1]).toEqual([
      organizationId,
      ['decision', 'execution_case', 'execution_task', 'task'],
      '2026-09-13T12:00:00.123Z',
      ['initiative-no-project', 'initiative-b'],
    ]);
  });

  it('fails closed when a scenario membership version differs from the canonical Initiative', async () => {
    const f = service({ initiativeVersion: 5 });

    await expect(
      f.subject.buildSnapshot({
        organizationId,
        scenarioId,
        contextSnapshotId: 'context-runtime',
        contextVersion: 9,
      })
    ).rejects.toMatchObject<Partial<PortfolioAnalysisRuntimeError>>({
      code: 'PORTFOLIO_ANALYSIS_INITIATIVE_NOT_CANONICAL',
      httpStatus: 409,
    });
  });

  it('captures an exact DRAFT scenario without inventing an analysis-only publication gate', async () => {
    const f = service();
    f.data.scenario.status = 'DRAFT';

    await expect(
      f.subject.buildSnapshot({
        organizationId,
        scenarioId,
        contextSnapshotId: 'context-runtime',
        contextVersion: 9,
      })
    ).resolves.toMatchObject({
      portfolio: { scenarioId, facts: { status: 'DRAFT' } },
    });
  });

  it('fails closed when the requested governed context ID does not match its exact version', async () => {
    const f = service({ contextId: 'different-context' });

    await expect(
      f.subject.buildSnapshot({
        organizationId,
        scenarioId,
        contextSnapshotId: 'context-runtime',
        contextVersion: 9,
      })
    ).rejects.toMatchObject<Partial<PortfolioAnalysisRuntimeError>>({
      code: 'PORTFOLIO_ANALYSIS_CONTEXT_NOT_FOUND',
      httpStatus: 404,
    });
  });

  it('reads persisted analyses by exact tenant and aggregate identity', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ version: 2, payload_json: { analysisId: 'analysis-a', status: 'PENDING_REVIEW' } }],
    });
    const subject = new PostgresPortfolioConsultingAnalysisRuntimeService(
      { query } as any,
      {} as any,
      { readHeader: vi.fn() as any, contextService: {} as any }
    );

    await expect(subject.find(organizationId, 'analysis-a')).resolves.toMatchObject({
      version: 2,
      analysis: { analysisId: 'analysis-a', status: 'PENDING_REVIEW' },
    });
    expect(query.mock.calls[0][1]).toEqual([organizationId, 'analysis-a']);
  });

  it('revalidates finalize against the same public governed-context projection', async () => {
    const f = service();

    const found = await f.subject.findGovernedSnapshot({
      organizationId,
      snapshotId: 'context-runtime',
      version: 9,
    });

    expect(found?.snapshot.claims).toEqual([expect.objectContaining({ claimId: 'claim-public' })]);
    expect(JSON.stringify(found)).not.toContain('RESTRICTED_CONTEXT_SECRET');
    expect(f.contextService.getSnapshotVersion).toHaveBeenCalledWith(organizationId, 9);
  });
});

describe('configured Portfolio consulting model gateway', () => {
  it('binds provenance to the resolved configured provider and disables response caching', async () => {
    const resolve = vi
      .spyOn(llmService, 'resolveModelConfig')
      .mockResolvedValue({ provider: 'openai', model_id: 'gpt-configured', version: '2026-09' });
    const call = vi.spyOn(llmService, 'call').mockResolvedValue({ object: { items: [] } });
    const gateway = new ConfiguredPortfolioConsultingModelGateway();

    const result = await gateway.analyze({
      rubricVersion: 'portfolio-consulting-v1',
      requestDigest: 'digest-a',
      snapshot: { organizationId } as any,
    });

    expect(resolve).toHaveBeenCalledWith({ id: 'premium', tier: 'PREMIUM' });
    expect(call).toHaveBeenCalledWith(
      expect.objectContaining({
        modelConfig: expect.objectContaining({ provider: 'openai', model_id: 'gpt-configured' }),
        cache: false,
      })
    );
    expect(result.provenance).toMatchObject({
      provider: 'openai',
      modelId: 'gpt-configured',
      modelVersion: '2026-09',
      promptVersion: 'portfolio-consulting-v1',
    });
    expect(result.provenance.runId).toBeTruthy();
    resolve.mockRestore();
    call.mockRestore();
  });

  it('does not misrepresent the deterministic QA adapter as real-model evidence', async () => {
    const resolve = vi
      .spyOn(llmService, 'resolveModelConfig')
      .mockResolvedValue({ provider: 'openai', model_id: 'gpt-configured' });
    const call = vi
      .spyOn(llmService, 'call')
      .mockResolvedValue({ object: { items: [] }, qaMock: true });

    await expect(
      new ConfiguredPortfolioConsultingModelGateway().analyze({
        rubricVersion: 'portfolio-consulting-v1',
        requestDigest: 'digest-a',
        snapshot: { organizationId } as any,
      })
    ).rejects.toMatchObject({
      code: 'PORTFOLIO_ANALYSIS_REAL_MODEL_REQUIRED',
      httpStatus: 503,
    });
    resolve.mockRestore();
    call.mockRestore();
  });
});

describe('Portfolio consulting analysis server flag', () => {
  it('is default OFF and enables only for the exact true token', () => {
    const before = process.env.ENABLE_INITIATIVE_PORTFOLIO_ANALYSIS;
    try {
      delete process.env.ENABLE_INITIATIVE_PORTFOLIO_ANALYSIS;
      expect(isPortfolioConsultingAnalysisEnabled()).toBe(false);
      for (const value of ['1', 'yes', 'TRUE', 'on']) {
        process.env.ENABLE_INITIATIVE_PORTFOLIO_ANALYSIS = value;
        expect(isPortfolioConsultingAnalysisEnabled()).toBe(false);
      }
      process.env.ENABLE_INITIATIVE_PORTFOLIO_ANALYSIS = 'true';
      expect(isPortfolioConsultingAnalysisEnabled()).toBe(true);
    } finally {
      if (before === undefined) delete process.env.ENABLE_INITIATIVE_PORTFOLIO_ANALYSIS;
      else process.env.ENABLE_INITIATIVE_PORTFOLIO_ANALYSIS = before;
    }
  });
});
