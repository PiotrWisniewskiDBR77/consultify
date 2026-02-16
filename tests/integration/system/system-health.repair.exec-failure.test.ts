import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const getDatabaseAsync = vi.fn();

vi.mock('../../../server/src/database/index.js', () => ({
  getDatabaseAsync: (...args: any[]) => getDatabaseAsync(...args),
}));

vi.mock('child_process', () => ({
  exec: Object.assign(
    (cmd: string, _opts: any, cb: any) => cb(new Error(`exec failed: ${cmd}`), '', ''),
    {
      [Symbol.for('nodejs.util.promisify.custom')]: async (cmd: string) => {
        throw new Error(`exec failed: ${cmd}`);
      },
    }
  ),
}));

describe('System health: /repair exec failure (REAL integration)', () => {
  let canListen = true;
  let router: any;

  beforeAll(async () => {
    canListen = await canBindEphemeralPort();
    router = (await import('../../../server/src/routes/system-health.routes.ts')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getDatabaseAsync.mockResolvedValue({
      query: vi.fn(async () => ({ rows: [] })),
    });
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/system', router });

  it('POST /api/system/repair returns 500 on exec failure', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).post('/api/system/repair').send({});
    expect(res.status).toBe(500);
    expect(res.body).toEqual(
      expect.objectContaining({ overall: 'error', error: expect.any(String) })
    );
  });
});
