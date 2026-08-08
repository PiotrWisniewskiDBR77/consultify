import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('../../../utils/DbPromise.js', () => ({ get: getMock }));

import {
  loadTransformationAgentExecutionContext,
  TRANSFORMATION_AGENT_ID,
} from '../transformationAgentExecutionContextService.js';

describe('transformationAgentExecutionContextService', () => {
  beforeEach(() => getMock.mockReset());

  it('returns only a case-bound canonical run and stable Teresa agent identity', async () => {
    getMock.mockResolvedValue({
      transformation_case_id: 'case-1',
      organization_id: 'org-1',
      project_id: 'project-1',
      execution_run_id: 'run-1',
      lineage_id: 'lineage-1',
      identity_run_id: 'run-1',
      identity_lineage_id: 'lineage-1',
      agent_id: TRANSFORMATION_AGENT_ID,
    });
    await expect(
      loadTransformationAgentExecutionContext({
        transformationCaseId: 'case-1',
        organizationId: 'org-1',
        actorUserId: 'user-1',
      })
    ).resolves.toEqual({
      transformationCaseId: 'case-1',
      organizationId: 'org-1',
      canonicalRunId: 'run-1',
      projectId: 'project-1',
      actorUserId: 'user-1',
      agentId: TRANSFORMATION_AGENT_ID,
      lineageId: 'lineage-1',
    });
  });

  it.each([
    [{ execution_run_id: null, identity_run_id: null }, 'canonical_run_identity_missing'],
    [
      { execution_run_id: 'run-1', identity_run_id: 'run-1', identity_lineage_id: 'wrong' },
      'canonical_run_identity_drift',
    ],
    [
      {
        execution_run_id: 'run-1',
        identity_run_id: 'run-1',
        identity_lineage_id: 'lineage-1',
        agent_id: null,
      },
      'agent_identity_missing',
    ],
  ])('fails closed for missing or drifted identity %#', async (override, error) => {
    getMock.mockResolvedValue({
      transformation_case_id: 'case-1',
      organization_id: 'org-1',
      project_id: null,
      execution_run_id: 'run-1',
      lineage_id: 'lineage-1',
      identity_run_id: 'run-1',
      identity_lineage_id: 'lineage-1',
      agent_id: TRANSFORMATION_AGENT_ID,
      ...override,
    });
    await expect(
      loadTransformationAgentExecutionContext({
        transformationCaseId: 'case-1',
        organizationId: 'org-1',
        actorUserId: 'user-1',
      })
    ).rejects.toThrow(error);
  });
});
