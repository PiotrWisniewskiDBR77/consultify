/**
 * M10 Wywiad — cross-org reassign IDOR contract test for
 * InterviewController.updateAssignment.
 *
 * Adversarial sweep finding (Londyn): updateAssignment let a manager reassign an
 * interview by writing the request body `assigneeUserId` straight into
 * `assignee_user_id` WITHOUT re-validating that the new assignee is a member of
 * the caller's organization — unlike createAssignment's V-A org guard. A manager
 * in org A could therefore reassign an interview to a user id from org B.
 *
 * Fix: before the reassign UPDATE, look up the new assignee in
 * organization_members for the caller's org; reject with 404
 * (code ASSIGNEE_NOT_IN_ORG) when they are not a member, and never run the UPDATE.
 *
 * These tests exercise the handler directly with a mocked queryHelpers (mirrors
 * interview-template-question-idor.test.ts), so no network/DB is required.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── queryHelpers mock (the only DB surface the handler touches) ──────────────
const mockQueryOne = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../utils/queryHelpers.js', () => ({
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  queryFirst: (...a: unknown[]) => mockQueryOne(...a),
  queryAll: (...a: unknown[]) => mockQueryAll(...a),
  queryRun: (...a: unknown[]) => mockQueryRun(...a),
}));

// ── Heavy service imports the controller pulls at module load — stub them ────
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
const USER_A = 'user-a-111';
const IN_ORG_ASSIGNEE = 'user-a-222';
const FOREIGN_ASSIGNEE = 'user-b-999';

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

async function callUpdateAssignment(opts: {
  user: { id: string; role: string; organizationId: string };
  assignmentId: string;
  assigneeUserId: string;
}) {
  const { InterviewController } = await import('../../controllers/InterviewController.js');
  const req: any = {
    user: opts.user,
    params: { id: opts.assignmentId },
    body: { assigneeUserId: opts.assigneeUserId },
  };
  const res = makeRes();
  await (InterviewController as any).updateAssignment(req, res, vi.fn());
  return res;
}

function reassignUpdateRan(): boolean {
  return mockQueryRun.mock.calls.some((c) =>
    /UPDATE\s+interview_assignments\s+SET[\s\S]*assignee_user_id\s*=/i.test(String(c?.[0]))
  );
}

describe('M10 — updateAssignment cross-org reassign IDOR guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryAll.mockResolvedValue([]);
    mockQueryRun.mockResolvedValue({ success: true, changes: 1 });
  });

  it('rejects reassigning to a FOREIGN-ORG user id → 404, no reassign UPDATE', async () => {
    // 1st queryOne: existing assignment (org-scoped, status 'assigned').
    mockQueryOne.mockResolvedValueOnce({
      id: 'asg-1',
      organization_id: ORG_A,
      status: 'assigned',
      task_id: null,
    });
    // 2nd queryOne: org-membership lookup for the foreign assignee → NOT a member.
    mockQueryOne.mockResolvedValueOnce(null);

    const res = await callUpdateAssignment({
      user: { id: USER_A, role: 'admin', organizationId: ORG_A },
      assignmentId: 'asg-1',
      assigneeUserId: FOREIGN_ASSIGNEE,
    });

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: 'ASSIGNEE_NOT_IN_ORG' });
    // The forbidden reassign UPDATE must NOT have run.
    expect(reassignUpdateRan()).toBe(false);
  });

  it('allows reassigning to an IN-ORG member → reassign UPDATE runs', async () => {
    // 1st queryOne: existing assignment (org-scoped, status 'assigned').
    mockQueryOne.mockResolvedValueOnce({
      id: 'asg-1',
      organization_id: ORG_A,
      status: 'assigned',
      task_id: null,
    });
    // 2nd queryOne: org-membership lookup → assignee IS a member of caller's org.
    mockQueryOne.mockResolvedValueOnce({ user_id: IN_ORG_ASSIGNEE });
    // 3rd queryOne: the post-update re-read of the assignment row.
    mockQueryOne.mockResolvedValueOnce({
      id: 'asg-1',
      organization_id: ORG_A,
      status: 'assigned',
      assignee_user_id: IN_ORG_ASSIGNEE,
    });

    const res = await callUpdateAssignment({
      user: { id: USER_A, role: 'admin', organizationId: ORG_A },
      assignmentId: 'asg-1',
      assigneeUserId: IN_ORG_ASSIGNEE,
    });

    expect(res.statusCode).toBe(200);
    expect(reassignUpdateRan()).toBe(true);
    // The membership lookup was scoped to the caller's org.
    const memberCheck = mockQueryOne.mock.calls.find((c) =>
      /FROM\s+organization_members\s+WHERE\s+organization_id\s*=\s*\?\s+AND\s+user_id\s*=\s*\?/i.test(
        String(c?.[0])
      )
    );
    expect(memberCheck).toBeTruthy();
    expect(memberCheck?.[1]).toEqual([ORG_A, IN_ORG_ASSIGNEE]);
  });

  it('rejects an empty assigneeUserId reassign → 400, no reassign UPDATE', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'asg-1',
      organization_id: ORG_A,
      status: 'assigned',
      task_id: null,
    });

    const res = await callUpdateAssignment({
      user: { id: USER_A, role: 'admin', organizationId: ORG_A },
      assignmentId: 'asg-1',
      assigneeUserId: '   ',
    });

    expect(res.statusCode).toBe(400);
    expect(reassignUpdateRan()).toBe(false);
  });
});
