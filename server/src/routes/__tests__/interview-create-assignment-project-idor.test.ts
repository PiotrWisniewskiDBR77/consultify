/**
 * M03 Wywiad — cross-org project IDOR contract test for
 * InterviewController.createAssignment.
 *
 * Finding: `projectId` arrives in the request body and was never bound to the
 * caller's organization. The project-role branch happened to catch it for
 * ordinary users — a foreign project has no `project_members` row for them, so
 * they 403 — but the org-level branch (SUPERADMIN / ADMIN / PROJECT_MANAGER)
 * skips that branch entirely on the reasoning "may assign to anyone in org".
 * The supplied projectId was then stamped onto the assignment row, which
 * surfaces under that project's assignment filter (`GET ...?projectId=`) —
 * a row written into another tenant's project.
 *
 * Fix: probe `projects` for (id, caller org) BEFORE any of the role logic, so
 * every branch inherits it, and refuse with 404 — "not in your org" must not be
 * distinguishable from "does not exist".
 *
 * The handler is exercised directly with a mocked queryHelpers, mirroring
 * interview-update-assignment-reassign-idor.test.ts; no network/DB required.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryOne = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../utils/queryHelpers.js', () => ({
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  queryFirst: (...a: unknown[]) => mockQueryOne(...a),
  queryAll: (...a: unknown[]) => mockQueryAll(...a),
  queryRun: (...a: unknown[]) => mockQueryRun(...a),
}));

// Heavy service imports the controller pulls at module load — stub them.
vi.mock('../../services/ai/ingestionPipeline.js', () => ({ IngestionPipeline: class {} }));
vi.mock('../../services/ai/llmService.js', () => ({ llmService: {} }));
vi.mock('../../services/notificationService.js', () => ({ default: { send: vi.fn() } }));
vi.mock('../../services/organizationContext/OrganizationContextService.js', () => ({
  default: { recordInterviewAnswer: vi.fn(), rebuildSnapshot: vi.fn() },
}));
vi.mock('../../services/pdfParserService.js', () => ({ default: {} }));
vi.mock('../../services/workflow/gatePolicy.js', () => ({ evaluateGatePolicy: vi.fn() }));
vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../utils/dbSchema.js', () => ({
  getTableColumns: vi.fn().mockResolvedValue(new Set<string>()),
}));

const ORG_A = 'aaa00000-0000-4000-8000-000000000001';
const ADMIN_A = 'user-a-admin';
const FOREIGN_PROJECT = 'bbb00000-0000-4000-8000-000000000009';
const OWN_PROJECT = 'aaa00000-0000-4000-8000-0000000000aa';

function makeRes() {
  const res: any = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: unknown) => {
    res.body = payload;
    return res;
  });
  return res;
}

async function callCreateAssignment(opts: {
  user: { id: string; role: string; organizationId: string };
  projectId?: string;
}) {
  const { InterviewController } = await import('../../controllers/InterviewController.js');
  const req: any = {
    user: opts.user,
    params: {},
    body: {
      assigneeUserId: 'user-a-222',
      templateId: 'tpl-1',
      templateVersion: 1,
      idempotencyKey: 'idem-key-1234567890',
      projectId: opts.projectId,
    },
  };
  const res = makeRes();
  await (InterviewController as any).createAssignment(req, res, vi.fn());
  return res;
}

/** Did the caller-supplied project id reach ANY write? */
function anyWriteRan(): boolean {
  return mockQueryRun.mock.calls.length > 0;
}

function projectProbeCall(): [string, unknown[]] | undefined {
  return mockQueryOne.mock.calls.find(([sql]: [string]) =>
    /FROM\s+projects\b/i.test(String(sql))
  ) as [string, unknown[]] | undefined;
}

describe('M03 — createAssignment cross-org project IDOR guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryAll.mockResolvedValue([]);
    mockQueryRun.mockResolvedValue({ rowCount: 1 });
    mockQueryOne.mockResolvedValue(undefined);
  });

  it('an ORG-LEVEL admin cannot assign into a FOREIGN project → 404, nothing written', async () => {
    // Project probe misses: the project is not in the caller's org.
    const res = await callCreateAssignment({
      user: { id: ADMIN_A, role: 'admin', organizationId: ORG_A },
      projectId: FOREIGN_PROJECT,
    });

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ error: 'Project not found' });
    expect(anyWriteRan()).toBe(false);
  });

  it('refuses the same way for SUPERADMIN — the gate is not role-dependent', async () => {
    const res = await callCreateAssignment({
      user: { id: ADMIN_A, role: 'owner', organizationId: ORG_A },
      projectId: FOREIGN_PROJECT,
    });

    expect(res.statusCode).toBe(404);
    expect(anyWriteRan()).toBe(false);
  });

  it('probes `projects` scoped by BOTH id and organization_id, before any role logic', async () => {
    await callCreateAssignment({
      user: { id: ADMIN_A, role: 'admin', organizationId: ORG_A },
      projectId: FOREIGN_PROJECT,
    });

    const call = projectProbeCall();
    expect(call).toBeDefined();
    expect(call![0]).toMatch(/organization_id\s*=\s*\?/i);
    expect(call![1]).toEqual([FOREIGN_PROJECT, ORG_A]);
    // It is the FIRST query the handler issues — no role branch got to run.
    expect(mockQueryOne.mock.calls[0]?.[0]).toMatch(/FROM\s+projects\b/i);
  });

  it('does NOT refuse (and does not probe projects) when no projectId is supplied', async () => {
    const res = await callCreateAssignment({
      user: { id: ADMIN_A, role: 'admin', organizationId: ORG_A },
    });

    expect(projectProbeCall()).toBeUndefined();
    expect(res.body).not.toMatchObject({ error: 'Project not found' });
  });

  it('passes the gate when the project IS in the caller org', async () => {
    mockQueryOne.mockImplementation(async (sql: string) => {
      if (/FROM\s+projects\b/i.test(String(sql))) return { id: OWN_PROJECT };
      return undefined;
    });

    const res = await callCreateAssignment({
      user: { id: ADMIN_A, role: 'admin', organizationId: ORG_A },
      projectId: OWN_PROJECT,
    });

    expect(projectProbeCall()).toBeDefined();
    // Whatever happens downstream, it is no longer the project refusal.
    expect(res.body).not.toMatchObject({ error: 'Project not found' });
  });
});
