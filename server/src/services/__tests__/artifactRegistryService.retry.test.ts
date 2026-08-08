import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rows: new Map<string, any>(),
  audits: [] as any[][],
  handoff: vi.fn(),
  transition: vi.fn(),
  cleanupReads: 0,
  managedTables: new Map<string, { table_id: string; field_count: number }>(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  get: vi.fn(async (sql: string, params: any[]) => {
    if (sql.includes('FROM v8_artifact_runs')) {
      return mocks.rows.get(`${params[1]}:${params[0]}`) ?? null;
    }
    if (sql.includes('FROM v8_artifact_origin_links')) {
      mocks.cleanupReads += 1;
      return null;
    }
    if (sql.includes('FROM tp_tables')) {
      return mocks.managedTables.get(`${params[1]}:${params[0]}`) ?? null;
    }
    return null;
  }),
  all: vi.fn(async (sql: string, params: any[]) => {
    if (sql.includes('FROM v8_artifact_runs') && sql.includes('retry_of_run_id')) {
      return [...mocks.rows.values()]
        .filter((row) => row.retry_of_run_id === params[0] && row.organization_id === params[1])
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return [];
  }),
  run: vi.fn(async (sql: string, params: any[]) => {
    if (sql.includes('INSERT INTO v8_artifact_runs')) {
      const row = makeRow({
        run_id: params[0],
        organization_id: params[2],
        execution_run_id: params[3],
        context_snapshot_id: params[4],
        requested_by_user_id: params[8],
        plan_json: params[9],
        run_status: params[10],
        retry_of_run_id: params[12],
        source_context_type: params[6],
        source_context_id: params[7],
        started_at: params[14],
        created_at: params[16],
        updated_at: params[17],
      });
      mocks.rows.set(`${row.organization_id}:${row.run_id}`, row);
    } else if (sql.includes('INSERT INTO v8_artifact_run_audit_log')) {
      mocks.audits.push(params);
    } else if (sql.includes('UPDATE v8_artifact_runs') && sql.includes('run_status')) {
      throw new Error('retry must not mutate parent status');
    }
    return { changes: 1 };
  }),
}));

vi.mock('../v8/chatExecutionService.js', () => ({
  initiateHandoff: mocks.handoff,
}));

vi.mock('../v8/executionSpineService.js', () => ({
  getRun: vi.fn(async () => null),
  transitionRunState: mocks.transition,
}));

import {
  computeArtifactRunPreflight,
  isArtifactRunLifecycleMaterializable,
  retryArtifactRun,
} from '../v8/artifactRegistryService.js';

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    run_id: 'parent',
    artifact_id: null,
    organization_id: 'org-a',
    execution_run_id: 'exec-parent',
    context_snapshot_id: 'snapshot-1',
    trigger_type: 'chat',
    source_context_type: 'conversation',
    source_context_id: 'conversation-1',
    requested_by_user_id: 'user-1',
    plan_json: JSON.stringify({
      artifactFamily: 'document',
      outputType: 'report',
      titleHint: 'Retry report',
      governancePath: 'execution_spine',
      visibilityScope: 'private',
    }),
    run_status: 'failed',
    proposal_id: null,
    retry_of_run_id: null,
    failure_reason: 'generation failed',
    preflight_state: null,
    preflight_json: null,
    materialization_origin_runtime: null,
    materialization_origin_record_id: null,
    failure_package_json: null,
    started_at: '2026-07-31T10:00:00.000Z',
    completed_at: '2026-07-31T10:01:00.000Z',
    created_at: '2026-07-31T10:00:00.000Z',
    updated_at: '2026-07-31T10:01:00.000Z',
    ...overrides,
  };
}

function seedParent(status: string, overrides: Record<string, unknown> = {}) {
  const row = makeRow({ run_status: status, ...overrides });
  mocks.rows.set(`${row.organization_id}:${row.run_id}`, row);
  return row;
}

describe('artifactRegistryService.retryArtifactRun', () => {
  beforeEach(() => {
    mocks.rows.clear();
    mocks.audits.length = 0;
    mocks.cleanupReads = 0;
    mocks.managedTables.clear();
    mocks.handoff.mockReset().mockResolvedValue({ executionRunId: 'exec-retry' });
    mocks.transition.mockReset().mockResolvedValue(undefined);
  });

  it.each(['failed', 'rejected', 'cancelled'])(
    'creates a child for %s without mutating the parent',
    async (status) => {
      const parent = seedParent(status);

      const child = await retryArtifactRun({
        runId: parent.run_id,
        organizationId: parent.organization_id,
        actorUserId: 'actor-1',
      });

      expect(child.retryOfRunId).toBe(parent.run_id);
      expect(child.runStatus).toBe('planned');
      expect(child.persistedRunStatus).toBe('planned');
      expect(child.effectiveRunStatus).toBe('planned');
      expect(mocks.rows.get('org-a:parent').run_status).toBe(status);
      const audit = mocks.audits.at(-1)!;
      expect(audit[4]).toBe(status);
      expect(audit[5]).toBe(status);
      expect(JSON.parse(audit[7])).toMatchObject({ childRunId: child.runId });
    }
  );

  it.each([
    'planned',
    'proposal_created',
    'awaiting_review',
    'approved_for_apply',
    'applying',
    'retry_requested',
    'completed',
  ])('rejects retry from %s with a stable 409 conflict', async (status) => {
    seedParent(status);

    await expect(
      retryArtifactRun({ runId: 'parent', organizationId: 'org-a', actorUserId: 'actor-1' })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'ARTIFACT_RUN_RETRY_NOT_ALLOWED',
      details: { runId: 'parent', runStatus: status },
    });
    expect(mocks.handoff).not.toHaveBeenCalled();
  });

  it('returns one child for concurrent and repeated retry requests', async () => {
    seedParent('failed');
    mocks.handoff.mockImplementation(async () => {
      await Promise.resolve();
      return { executionRunId: 'exec-retry' };
    });

    const [first, second] = await Promise.all([
      retryArtifactRun({ runId: 'parent', organizationId: 'org-a', actorUserId: 'actor-1' }),
      retryArtifactRun({ runId: 'parent', organizationId: 'org-a', actorUserId: 'actor-1' }),
    ]);
    const third = await retryArtifactRun({
      runId: 'parent',
      organizationId: 'org-a',
      actorUserId: 'actor-1',
    });

    expect(first.runId).toBe(second.runId);
    expect(second.runId).toBe(third.runId);
    expect(mocks.handoff).toHaveBeenCalledTimes(1);
    expect([...mocks.rows.values()].filter((row) => row.retry_of_run_id === 'parent')).toHaveLength(
      1
    );
  });

  it('scopes parent and child lookup to the tenant', async () => {
    seedParent('failed');

    await expect(
      retryArtifactRun({ runId: 'parent', organizationId: 'org-b', actorUserId: 'actor-1' })
    ).rejects.toThrow('ArtifactRun parent not found');
    expect(mocks.handoff).not.toHaveBeenCalled();
  });

  it('attempts best-effort ghost cleanup only for failed runs with an origin', async () => {
    seedParent('rejected', {
      materialization_origin_runtime: 'report',
      materialization_origin_record_id: 'report-1',
    });
    await retryArtifactRun({ runId: 'parent', organizationId: 'org-a', actorUserId: 'actor-1' });
    expect(mocks.cleanupReads).toBe(0);

    mocks.rows.clear();
    seedParent('failed', {
      materialization_origin_runtime: 'report',
      materialization_origin_record_id: 'report-1',
    });
    await retryArtifactRun({ runId: 'parent', organizationId: 'org-a', actorUserId: 'actor-1' });
    expect(mocks.cleanupReads).toBe(1);
  });
});

describe('artifactRegistryService materialization lifecycle reconciliation', () => {
  it.each(['approved_for_apply', 'applying'])(
    'accepts a stale planned lifecycle only when the execution spine is %s',
    (executionState) => {
      expect(isArtifactRunLifecycleMaterializable('planned', executionState)).toBe(true);
      expect(isArtifactRunLifecycleMaterializable('retry_requested', executionState)).toBe(true);
    }
  );

  it.each(['planning', 'proposals_ready', 'waiting_for_review'])(
    'keeps a stale planned lifecycle fail-closed while the execution spine is %s',
    (executionState) => {
      expect(isArtifactRunLifecycleMaterializable('planned', executionState)).toBe(false);
      expect(isArtifactRunLifecycleMaterializable('retry_requested', executionState)).toBe(false);
    }
  );

  it.each(['rejected', 'failed', 'completed', 'cancelled'])(
    'never reconciles terminal artifact lifecycle %s',
    (artifactStatus) => {
      expect(isArtifactRunLifecycleMaterializable(artifactStatus, 'approved_for_apply')).toBe(false);
      expect(isArtifactRunLifecycleMaterializable(artifactStatus, 'applying')).toBe(false);
    }
  );
});

describe('artifactRegistryService.computeArtifactRunPreflight', () => {
  beforeEach(() => {
    mocks.managedTables.clear();
  });

  const run = (outputType: 'report' | 'presentation' | 'sheet') =>
    ({
      organizationId: 'org-a',
      contextSnapshotId: 'snapshot-1',
      plan: { outputType },
    }) as any;

  it.each(['report', 'presentation'] as const)(
    'preserves the grounded %s green path',
    async (outputType) => {
      const preflight = await computeArtifactRunPreflight({
        run: run(outputType),
        executionRunExists: true,
        materializationParams: {
          runId: 'run-1',
          organizationId: 'org-a',
          actorUserId: 'actor-1',
        },
      });
      expect(preflight.state).toBe('passed');
    }
  );

  it('blocks a sheet when tableId is missing', async () => {
    const preflight = await computeArtifactRunPreflight({
      run: run('sheet'),
      executionRunExists: true,
      materializationParams: {
        runId: 'run-1',
        organizationId: 'org-a',
        actorUserId: 'actor-1',
        config: {},
      },
    });
    expect(preflight.state).toBe('attention_required');
    expect(preflight.checks).toContainEqual(
      expect.objectContaining({ id: 'materialization_target', status: 'failed' })
    );
  });

  it('blocks a sheet table owned by another tenant', async () => {
    mocks.managedTables.set('org-b:table-1', { table_id: 'table-1', field_count: 2 });
    const preflight = await computeArtifactRunPreflight({
      run: run('sheet'),
      executionRunExists: true,
      materializationParams: {
        runId: 'run-1',
        organizationId: 'org-a',
        actorUserId: 'actor-1',
        config: { tableId: 'table-1' },
      },
    });
    expect(preflight.state).toBe('attention_required');
  });

  it('passes a sheet with a usable table owned by the tenant', async () => {
    mocks.managedTables.set('org-a:table-1', { table_id: 'table-1', field_count: 2 });
    const preflight = await computeArtifactRunPreflight({
      run: run('sheet'),
      executionRunExists: true,
      materializationParams: {
        runId: 'run-1',
        organizationId: 'org-a',
        actorUserId: 'actor-1',
        config: { tableId: 'table-1' },
      },
    });
    expect(preflight.state).toBe('passed');
  });
});
