/**
 * M10 Wywiad — cross-org / privilege IDOR contract test for the interview
 * template-question delete path.
 *
 * Adversarial sweep finding (Londyn): InterviewController.deleteTemplateQuestion
 * deleted a question by (questionId, templateId) WITHOUT first loading the parent
 * template and enforcing canManageTemplate — unlike its siblings addTemplateQuestion
 * and updateTemplateQuestion. INTERVIEW_TEMPLATE_MANAGE is org-local, so a manager
 * in org B could delete questions from org A's template, or from a SYSTEM template,
 * by passing its id. Fix loads the template and gates on canManageTemplate.
 *
 * These tests exercise the handler directly with a mocked queryHelpers (mirrors the
 * "assert org-scoped lookup ran + forbidden mutation did NOT run" style of
 * cross-org-idor.test.ts), so no network/DB is required.
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
const ORG_B = 'bbb00000-0000-4000-8000-000000000002';
const USER_A = 'user-a-111';

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

async function callDeleteTemplateQuestion(opts: {
  user: { id: string; role: string; organizationId: string };
  templateId: string;
  questionId: string;
}) {
  const { InterviewController } = await import('../../controllers/InterviewController.js');
  const req: any = {
    user: opts.user,
    params: { id: opts.templateId, questionId: opts.questionId },
    body: {},
  };
  const res = makeRes();
  await (InterviewController as any).deleteTemplateQuestion(req, res, vi.fn());
  return res;
}

describe('M10 — deleteTemplateQuestion cross-org / system IDOR guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryAll.mockResolvedValue([]);
    mockQueryRun.mockResolvedValue({ rowCount: 0 });
  });

  it('rejects deleting a question from a FOREIGN-ORG template → 404, no DELETE', async () => {
    // Parent template belongs to ORG_B; caller is in ORG_A.
    mockQueryOne.mockResolvedValueOnce({
      id: 'tpl-org-b',
      organization_id: ORG_B,
      template_scope: 'organization',
      created_by: 'someone-else',
    });

    const res = await callDeleteTemplateQuestion({
      user: { id: USER_A, role: 'admin', organizationId: ORG_A },
      templateId: 'tpl-org-b',
      questionId: 'q-from-org-b',
    });

    expect(res.statusCode).toBe(404);
    // The forbidden DELETE must NOT have run.
    const del = mockQueryRun.mock.calls.find((c) =>
      /DELETE\s+FROM\s+interview_library_template_questions/i.test(String(c?.[0]))
    );
    expect(del).toBeFalsy();
  });

  it('rejects deleting a question from a SYSTEM template (non-superadmin) → 404, no DELETE', async () => {
    // System template (organization_id NULL); a regular org admin cannot manage it.
    mockQueryOne.mockResolvedValueOnce({
      id: 'tpl-system',
      organization_id: null,
      template_scope: 'system',
      created_by: null,
    });

    const res = await callDeleteTemplateQuestion({
      user: { id: USER_A, role: 'admin', organizationId: ORG_A },
      templateId: 'tpl-system',
      questionId: 'q-system',
    });

    expect(res.statusCode).toBe(404);
    const del = mockQueryRun.mock.calls.find((c) =>
      /DELETE\s+FROM\s+interview_library_template_questions/i.test(String(c?.[0]))
    );
    expect(del).toBeFalsy();
  });

  it('allows deleting a question from an OWNED org template → DELETE runs', async () => {
    // 1st queryOne: parent template (owned by caller's org).
    mockQueryOne.mockResolvedValueOnce({
      id: 'tpl-owned',
      organization_id: ORG_A,
      template_scope: 'organization',
      created_by: USER_A,
    });
    // 2nd queryOne: the question existence check (belongs to the template).
    mockQueryOne.mockResolvedValueOnce({ id: 'q-owned' });

    const res = await callDeleteTemplateQuestion({
      user: { id: USER_A, role: 'admin', organizationId: ORG_A },
      templateId: 'tpl-owned',
      questionId: 'q-owned',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    const del = mockQueryRun.mock.calls.find((c) =>
      /DELETE\s+FROM\s+interview_library_template_questions/i.test(String(c?.[0]))
    );
    expect(del).toBeTruthy();
    expect(del?.[1]).toEqual(['q-owned']);
  });
});
