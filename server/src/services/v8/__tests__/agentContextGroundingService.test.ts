import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, runMock } = vi.hoisted(() => ({ getMock: vi.fn(), runMock: vi.fn() }));
vi.mock('../../../utils/DbPromise.js', () => ({
  get: getMock,
  run: runMock,
  all: vi.fn().mockResolvedValue([]),
}));

import {
  boundWorkingMemory,
  policyFirstRank,
  revalidateCanonicalRunContextForWorker,
  revalidateTransformationContext,
} from '../agentContextGroundingService.js';

const policy = {
  allowedModules: ['Vault', 'Assessments'],
  allowedArtifactIds: [],
  projectId: 'project-1',
  maxResults: 5,
  maxWorkingMemoryChars: 12,
};
const candidates = [
  {
    sourceRef: 'vault:a',
    artifactId: 'a',
    module: 'Vault',
    projectId: 'project-1',
    content: '123456',
    relevance: 0.4,
  },
  {
    sourceRef: 'finance:b',
    artifactId: 'b',
    module: 'Finance',
    projectId: 'project-1',
    content: 'forbidden',
    relevance: 1,
  },
  {
    sourceRef: 'assessment:c',
    artifactId: 'c',
    module: 'Assessments',
    projectId: 'project-1',
    content: 'abcdef',
    relevance: 0.9,
  },
];

describe('agentContextGroundingService', () => {
  beforeEach(() => {
    getMock.mockReset();
    runMock.mockReset().mockResolvedValue({ changes: 1 });
  });

  it('applies scope policy before relevance ranking and preserves attribution', () => {
    const result = policyFirstRank(candidates, policy);
    expect(result.admitted.map((item) => item.sourceRef)).toEqual(['assessment:c', 'vault:a']);
    expect(result.denied).toEqual([
      expect.objectContaining({ artifactId: 'b', reason: 'module_not_allowed' }),
    ]);
  });

  it('bounds working memory without truncating or losing source identity', () => {
    expect(boundWorkingMemory(candidates, 12).map((item) => item.sourceRef)).toEqual([
      'vault:a',
      'assessment:c',
    ]);
  });

  it('fails closed on resume drift and persists the blocking decision', async () => {
    getMock.mockResolvedValue({
      execution_run_id: 'run-1',
      context_snapshot_id: 'snap-1',
      project_id: 'project-1',
      snapshot_org: 'org-1',
      snapshot_project: 'project-1',
      source_context_refs: '["vault:a"]',
      drift_events: '[{"type":"artifact_changed"}]',
    });
    const result = await revalidateTransformationContext({
      transformationCaseId: 'case-1',
      organizationId: 'org-1',
      actorUserId: 'user-1',
      policy,
      candidates,
    });
    expect(result.decision).toBe('blocked_drift');
    expect(runMock).toHaveBeenCalledTimes(1);
    expect(runMock.mock.calls[0][1]).toContain('blocked_drift');
  });

  it('admits bounded sources only after a clean tenant and scope revalidation', async () => {
    getMock.mockResolvedValue({
      execution_run_id: 'run-1',
      context_snapshot_id: 'snap-1',
      project_id: 'project-1',
      snapshot_org: 'org-1',
      snapshot_project: 'project-1',
      source_context_refs: '["vault:a"]',
      drift_events: '[]',
    });
    const result = await revalidateTransformationContext({
      transformationCaseId: 'case-1',
      organizationId: 'org-1',
      actorUserId: 'user-1',
      policy,
      candidates,
    });
    expect(result.decision).toBe('allowed');
    // The service returns a union: the blocked_snapshot short-circuit carries no
    // working-memory set. Narrow before reading it.
    if (!('admitted' in result)) {
      throw new Error('expected an admitted working-memory set on an allowed decision');
    }
    expect(result.admitted.map((item) => item.sourceRef)).toEqual(['assessment:c', 'vault:a']);
    expect(runMock).toHaveBeenCalledTimes(3);
  });

  it('uses the pinned transaction client for both revalidation read and decision write', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            execution_run_id: 'run-1',
            context_snapshot_id: 'snap-1',
            project_id: 'project-1',
            snapshot_org: 'org-1',
            snapshot_project: 'project-1',
            source_context_refs: '[]',
            drift_events: '[]',
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValue({ rows: [], rowCount: 1 });
    const result = await revalidateTransformationContext({
      transformationCaseId: 'case-1',
      organizationId: 'org-1',
      actorUserId: 'user-1',
      policy,
      candidates: [],
      client: { query },
    });
    expect(result.decision).toBe('allowed');
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain('FROM transformation_cases');
    expect(query.mock.calls[1][0]).toContain('v8_agent_context_revalidations');
    expect(getMock).not.toHaveBeenCalled();
    expect(runMock).not.toHaveBeenCalled();
  });

  it('resolves a canonical worker binding and persists a drift denial before execution', async () => {
    getMock
      .mockResolvedValueOnce({ transformation_case_id: 'case-1', project_id: 'project-1' })
      .mockResolvedValueOnce({
        execution_run_id: 'run-1',
        context_snapshot_id: 'snap-1',
        project_id: 'project-1',
        snapshot_org: 'org-1',
        snapshot_project: 'project-1',
        source_context_refs: '[]',
        drift_events: '[{"type":"source_changed"}]',
      });
    const result = await revalidateCanonicalRunContextForWorker({
      canonicalRunId: 'run-1',
      organizationId: 'org-1',
      actorUserId: 'worker-1',
      workerKind: 'wave8_schedule',
      externalId: 'schedule-1',
    });
    expect(result.decision).toBe('blocked_drift');
    expect(runMock).toHaveBeenCalledTimes(1);
    expect(runMock.mock.calls[0][1]).toContain('blocked_drift');
  });

  it('fails closed without a durable cross-tenant write when canonical ownership is absent', async () => {
    getMock.mockResolvedValueOnce(undefined);
    const result = await revalidateCanonicalRunContextForWorker({
      canonicalRunId: 'run-foreign',
      organizationId: 'org-1',
      actorUserId: 'worker-1',
      workerKind: 'work_graph_branch',
      externalId: 'graph-1',
    });
    expect(result.decision).toBe('blocked_snapshot');
    expect(runMock).not.toHaveBeenCalled();
  });
});
