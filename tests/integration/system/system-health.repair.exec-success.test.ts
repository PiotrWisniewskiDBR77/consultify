import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const getDatabaseAsync = vi.fn();

vi.mock('../../../server/src/database/index.js', () => ({
  getDatabaseAsync: (...args: any[]) => getDatabaseAsync(...args),
}));

vi.mock('child_process', () => ({
  exec: Object.assign((_cmd: string, _opts: any, cb: any) => cb(null, 'ok', ''), {
    [Symbol.for('nodejs.util.promisify.custom')]: async () => ({ stdout: 'ok', stderr: '' }),
  }),
}));

describe('System health: /repair exec success (REAL integration)', () => {
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
        if (sql.includes('sqlite_master') && params?.[0]) return { rows: [{ name: params[0] }] };
        if (sql.includes('COUNT(*) as count FROM users')) return { rows: [{ count: 1 }] };
        if (sql.includes("role IN ('ADMIN', 'SUPERADMIN')"))
          return { rows: [{ email: 'a', role: 'ADMIN' }] };
        if (sql.includes('FROM users WHERE email')) return { rows: [] };
        return { rows: [] };
      }),
    });
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/system', router });

  it('POST /api/system/repair returns overall payload and repairOutput', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).post('/api/system/repair').send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        overall: expect.any(String),
        timestamp: expect.any(String),
        checks: expect.any(Array),
        autoRepairsApplied: 1,
        repairOutput: 'ok',
      })
    );
  });
});
