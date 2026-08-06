import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryOne = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryFirst: (...args: unknown[]) => mockQueryOne(...args),
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

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
  getTableColumns: vi.fn().mockResolvedValue(new Set(['is_anonymous'])),
}));

const ORG_A = 'org-a';
const ADMIN_A = 'admin-a';
const OWNER_B = 'owner-b';

function makeResponse() {
  const res: any = { statusCode: 200, body: undefined };
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

async function getNotes(role = 'ADMIN') {
  const { InterviewController } = await import('../../controllers/InterviewController.js');
  const req: any = {
    user: { id: ADMIN_A, role, organizationId: ORG_A },
    params: { sessionId: 'session-1' },
  };
  const res = makeResponse();
  await (InterviewController as any).getNotes(req, res, vi.fn());
  return res;
}

describe('Interview elevated read access is tenant-scoped and fail-closed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryAll.mockResolvedValue([]);
    mockQueryRun.mockResolvedValue({ rowCount: 0 });
  });

  it('allows an org admin to read an identified session in the same organization', async () => {
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'session-1',
        assignment_id: null,
        owner_id: OWNER_B,
        is_anonymous: false,
      })
      .mockResolvedValueOnce({ owner_id: OWNER_B, is_anonymous: false });

    const res = await getNotes();

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
    expect(String(mockQueryOne.mock.calls[0]?.[0])).toMatch(/organization_id/);
    expect(mockQueryOne.mock.calls[0]?.[1]).toEqual(['session-1', ORG_A, ORG_A]);
  });

  it('denies elevated access to an anonymous session', async () => {
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'session-1',
        assignment_id: null,
        owner_id: OWNER_B,
        is_anonymous: true,
      })
      .mockResolvedValueOnce({ id: 'session-1' });

    const res = await getNotes();

    expect(res.statusCode).toBe(403);
    expect(mockQueryAll).not.toHaveBeenCalled();
  });

  it('returns not found when the tenant-scoped session lookup has no row', async () => {
    mockQueryOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    const res = await getNotes();

    expect(res.statusCode).toBe(404);
    expect(mockQueryAll).not.toHaveBeenCalled();
  });

  it('fails closed when the tenant-scoped session lookup errors', async () => {
    mockQueryOne.mockRejectedValue(new Error('database unavailable'));

    const res = await getNotes();

    expect(res.statusCode).toBe(403);
    expect(mockQueryAll).not.toHaveBeenCalled();
  });
});
