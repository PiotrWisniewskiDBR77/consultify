/**
 * M16 integrity fix (07-15 audit) — `getModel()` org-scope regression.
 *
 * Finding: `server/src/routes/v8/finance.routes.ts` called
 * `financialModelingService.getModel(modelId)` WITHOUT an organizationId across
 * 16 call sites, relying solely on a post-fetch
 * `model.organization_id !== organizationId → 404` check for cross-org
 * isolation. The legacy `financial-modeling.routes.ts` path scopes the SQL
 * itself (`WHERE id = ? AND organization_id = ?`). This test pins the SQL-level
 * contract of `getModel()` directly (no route/HTTP layer) so a future refactor
 * cannot silently drop the org filter while still "passing" because the
 * post-fetch check happens to catch it in the common case.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = vi.hoisted(() => ({
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', async () => {
  const actual = await vi.importActual<any>('../../../../server/src/utils/DbPromise.js');
  return {
    ...actual,
    get: mockDb.get,
    all: mockDb.all,
    run: mockDb.run,
  };
});

describe('financialModelingService.getModel — M16 org-scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scopes the SQL query to organization_id when orgId is provided', async () => {
    const { getModel } = await import(
      '../../../../server/src/services/financialModelingService.js'
    );
    mockDb.get.mockResolvedValueOnce({
      id: 'model-1',
      organization_id: 'org-A',
      assumptions_json: '{}',
    });

    await getModel('model-1', 'org-A');

    expect(mockDb.get).toHaveBeenCalledTimes(1);
    const [sql, params] = mockDb.get.mock.calls[0];
    expect(String(sql)).toMatch(/WHERE id = \? AND organization_id = \?/i);
    expect(params).toEqual(['model-1', 'org-A']);
  });

  it('a cross-org lookup never reaches the application layer with another org\'s row — the SQL filters it out', async () => {
    const { getModel } = await import(
      '../../../../server/src/services/financialModelingService.js'
    );
    // Simulate what a real org-scoped SQL WHERE clause does for a model that
    // belongs to a different organization: zero rows, not org-B's model.
    mockDb.get.mockResolvedValueOnce(undefined);

    const result = await getModel('model-owned-by-org-B', 'org-A');

    expect(result).toBeNull();
    const [sql, params] = mockDb.get.mock.calls[0];
    expect(String(sql)).toMatch(/AND organization_id = \?/i);
    expect(params).toEqual(['model-owned-by-org-B', 'org-A']);
  });

  it('falls back to an unscoped query only when orgId is omitted (internal callers that verify separately)', async () => {
    const { getModel } = await import(
      '../../../../server/src/services/financialModelingService.js'
    );
    mockDb.get.mockResolvedValueOnce({
      id: 'model-1',
      organization_id: 'org-A',
      assumptions_json: '{}',
    });

    await getModel('model-1');

    const [sql, params] = mockDb.get.mock.calls[0];
    expect(String(sql)).not.toMatch(/organization_id/i);
    expect(params).toEqual(['model-1']);
  });
});
