import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = {
  query: vi.fn(),
};

vi.mock('../../../../../server/src/database/Database.js', () => ({
  getDatabase: () => mockDb,
}));

vi.mock('../../../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Regression: table-platform.routes.ts destructures requireRole off the default
// export (const { requireRole } = PermissionsService). Any `this.` inside the
// service breaks under that call style ("Cannot read properties of undefined
// (reading 'getUserRole')"), which silently disabled field-permission masking
// for every record read.
describe('PermissionsService.requireRole (destructured call style)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadDestructured() {
    const { default: PermissionsService } = await import(
      '../../../../../server/src/services/tablePlatform/PermissionsService.js'
    );
    const { requireRole } = PermissionsService;
    return requireRole;
  }

  it('resolves an explicit member role without throwing', async () => {
    const requireRole = await loadDestructured();
    mockDb.query.mockResolvedValueOnce({ rows: [{ role: 'viewer' }] });

    const result = await requireRole('base-1', 'user-1', 'org-1', [
      'base_owner',
      'viewer',
    ]);

    expect(result).toEqual({ allowed: true, role: 'viewer' });
  });

  it('falls back to base_owner via org access for a fresh org with no tp_base_members rows', async () => {
    const requireRole = await loadDestructured();
    // getUserRole: no membership row
    mockDb.query.mockResolvedValueOnce({ rows: [] });
    // canAccessBase: base belongs to the caller's org
    mockDb.query.mockResolvedValueOnce({
      rows: [{ organization_id: 'org-1', created_by: 'someone-else' }],
    });

    const result = await requireRole('base-1', 'user-1', 'org-1', ['base_owner']);

    expect(result).toEqual({ allowed: true, role: 'base_owner' });
  });

  it('denies when there is no membership and no org/creator access', async () => {
    const requireRole = await loadDestructured();
    mockDb.query.mockResolvedValueOnce({ rows: [] });
    mockDb.query.mockResolvedValueOnce({
      rows: [{ organization_id: 'other-org', created_by: 'someone-else' }],
    });

    const result = await requireRole('base-1', 'user-1', 'org-1', ['base_owner']);

    expect(result).toEqual({ allowed: false, role: null });
  });
});
