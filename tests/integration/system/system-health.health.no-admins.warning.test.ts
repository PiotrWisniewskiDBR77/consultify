import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const getDatabaseAsync = vi.fn();

vi.mock('../../../server/src/database/index.js', () => ({
  getDatabaseAsync: (...args: any[]) => getDatabaseAsync(...args),
}));

describe('System health: warns when no admins (REAL integration)', () => {
  let canListen = true;
  let router: any;

  beforeAll(async () => {
    canListen = await canBindEphemeralPort();
    router = (await import('../../../server/src/routes/system-health.routes.ts')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getDatabaseAsync.mockResolvedValue({
      query: vi.fn(async (sql: string, params: any[]) => {
        if (sql.includes('SELECT 1')) return { rows: [{ ok: 1 }] };
        if (sql.includes('sqlite_master') && sql.includes("name='users'"))
          return { rows: [{ name: 'users' }] };
        if (sql.includes('sqlite_master') && params?.[0]) return { rows: [{ name: params[0] }] };
        if (sql.includes('COUNT(*) as count FROM users')) return { rows: [{ count: 2 }] };
        if (sql.includes("role IN ('ADMIN', 'SUPERADMIN')")) return { rows: [] }; // no admins
        if (sql.includes('FROM users WHERE email')) return { rows: [] };
        if (sql.includes("name='llm_providers'")) return { rows: [] };
        return { rows: [] };
      }),
    });
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/system', router });

  it('GET /api/system/health returns overall warning', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).get('/api/system/health');
    expect(res.status).toBe(200);
    expect(res.body.overall).toBe('warning');
    expect(res.body.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'User Accounts', status: 'warning' }),
      ])
    );
  });
});
