import { describe, expect, it, vi } from 'vitest';

vi.mock('jsonwebtoken', async () => {
  const actual = await vi.importActual('jsonwebtoken');
  return {
    ...actual,
    default: {
      ...actual.default,
      sign: () => 'signed-access-token',
    },
    sign: () => 'signed-access-token',
  };
});

let RefreshTokenService;
async function load() {
  if (RefreshTokenService) return;
  const mod = await import('../../../server/src/services/RefreshTokenService.ts');
  RefreshTokenService = mod.RefreshTokenService;
}

function createFakeDb() {
  return {
    get: vi.fn((sql, params, cb) => cb(null, { count: 0 })),
    all: vi.fn((sql, params, cb) => cb(null, [])),
    run: vi.fn((sql, params, cb) => cb.call({ lastID: undefined, changes: 1 }, null)),
    exec: vi.fn((sql, cb) => cb(null)),
  };
}

describe('RefreshTokenService (server/src/services/RefreshTokenService.ts)', () => {
  it('generates a token pair and stores refresh token hash', async () => {
    await load();
    const db = createFakeDb();
    const svc = new RefreshTokenService(db);

    const pair = await svc.generateTokenPair(
      { id: 'u-1', email: 'u@example.com', role: 'USER', organization_id: 'org-1' },
      { deviceInfo: 'TestDevice' }
    );

    expect(pair.accessToken).toBe('signed-access-token');
    expect(typeof pair.refreshToken).toBe('string');
    expect(pair.refreshToken.length).toBeGreaterThan(60);
    expect(pair.expiresIn).toBeGreaterThan(0);

    // Should have inserted into refresh_tokens at least once
    expect(db.run).toHaveBeenCalled();
    const calls = db.run.mock.calls.map((c) => String(c[0]));
    expect(calls.some((sql) => sql.includes('INSERT INTO refresh_tokens'))).toBe(true);
  });
});
