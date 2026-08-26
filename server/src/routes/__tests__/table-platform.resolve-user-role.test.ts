import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression test for the resolveUserRoleForTable bug fixed 2026-08-26:
 *
 * table-platform.routes.ts destructures `requireRole` off the
 * PermissionsService default-export object at module load time:
 *   const { requireRole, ... } = PermissionsService;
 * PermissionsService.requireRole's body calls `this.getUserRole(...)` and
 * `this.canAccessBase(...)`. Once destructured into a bare function, calling
 * it as `requireRole(...)` loses the `this` binding, so `this` is
 * `undefined` inside the call and `this.getUserRole` throws
 * "Cannot read properties of undefined (reading 'getUserRole')". The
 * try/catch in resolveUserRoleForTable swallowed that on every single call
 * and logged a WARN, always returning `undefined` (fail-open, no masking).
 *
 * The fix calls `PermissionsService.requireRole(...)` (the object method,
 * preserving `this`) instead of the destructured binding. This test uses
 * the REAL PermissionsService (not mocked) so the fix is genuinely
 * exercised, and only mocks the DB layer.
 */

const mockQuery = vi.fn();

vi.mock('../../database/Database.js', () => ({
  getDatabase: () => ({ query: (...args: unknown[]) => mockQuery(...args) }),
}));

const mockWarn = vi.fn();
const mockError = vi.fn();

vi.mock('../../utils/Logger.js', () => ({
  default: {
    warn: (...args: unknown[]) => mockWarn(...args),
    error: (...args: unknown[]) => mockError(...args),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// PermissionsService is intentionally left un-mocked — this test exists to
// prove the real requireRole/getUserRole chain works through
// resolveUserRoleForTable's call site.

async function importResolver() {
  const mod = await import('../table-platform.routes.js');
  return mod.resolveUserRoleForTable;
}

describe('resolveUserRoleForTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves the real role for an org member without logging a WARN', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM tp_tables')) {
        return { rows: [{ base_id: 'base-1' }] };
      }
      if (sql.includes('FROM tp_base_members')) {
        return { rows: [{ role: 'data_editor' }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const resolveUserRoleForTable = await importResolver();
    const role = await resolveUserRoleForTable('table-1', 'user-1', 'org-1');

    expect(role).toBe('data_editor');
    expect(mockWarn).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });

  it('falls back to legacy org/creator access and returns base_owner without a WARN', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM tp_tables')) {
        return { rows: [{ base_id: 'base-1' }] };
      }
      if (sql.includes('FROM tp_base_members')) {
        return { rows: [] }; // no explicit membership row
      }
      if (sql.includes('FROM tp_bases')) {
        return { rows: [{ created_by: 'user-1', organization_id: 'org-1' }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const resolveUserRoleForTable = await importResolver();
    const role = await resolveUserRoleForTable('table-1', 'user-1', 'org-1');

    expect(role).toBe('base_owner');
    expect(mockError).not.toHaveBeenCalled();
    // legacy fallback path itself logs a WARN by design (Permissions.ts) —
    // resolveUserRoleForTable's own catch block must not fire on top of it.
    expect(mockWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('resolveUserRoleForTable failed'),
      expect.anything()
    );
  });

  it('returns undefined without throwing when the table has no base_id', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM tp_tables')) {
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const resolveUserRoleForTable = await importResolver();
    const role = await resolveUserRoleForTable('missing-table', 'user-1', 'org-1');

    expect(role).toBeUndefined();
    expect(mockWarn).not.toHaveBeenCalled();
  });
});
