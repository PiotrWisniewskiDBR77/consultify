import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const getDatabaseAsync = vi.fn();

vi.mock('../../../server/src/database/index.js', () => ({
  getDatabaseAsync: (...args: any[]) => getDatabaseAsync(...args),
}));

describe('System health routes (REAL integration)', () => {
  let canListen = true;
  let router: any;

  beforeAll(async () => {
    canListen = await canBindEphemeralPort();
    router = (await import('../../../server/src/routes/system-health.routes.ts')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/system', router });

  it('GET /api/system/health returns checks and overall status', async function () {
    if (!canListen) this.skip();

    const db = {
      query: vi.fn(async (sql: string, params: any[]) => {
        if (sql.includes('SELECT 1')) return { rows: [{ ok: 1 }] };
        if (sql.includes('sqlite_master') && params?.[0]) return { rows: [{ name: params[0] }] };
        if (sql.includes('COUNT(*) as count FROM users')) return { rows: [{ count: 2 }] };
        if (sql.includes("role IN ('ADMIN', 'SUPERADMIN')"))
          return { rows: [{ email: 'a', role: 'ADMIN' }] };
        if (sql.includes('FROM users WHERE email')) return { rows: [] }; // default login missing => warning
        if (sql.includes("name='llm_providers'")) return { rows: [] }; // missing providers table => warning
        return { rows: [] };
      }),
    };

    getDatabaseAsync.mockResolvedValueOnce(db);

    const res = await request(makeApp()).get('/api/system/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        overall: expect.stringMatching(/healthy|warning|error/),
        timestamp: expect.any(String),
        checks: expect.any(Array),
        autoRepairsApplied: 0,
      })
    );
    expect(Array.isArray(res.body.checks)).toBe(true);
  });
});
