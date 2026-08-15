import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
const dbRun = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', async () => {
  const actual = (await vi.importActual('../../../server/src/middleware/auth.middleware.js')) as object;
  return {
    ...actual,
    verifyToken: (req: any, _res: any, next: any) => {
      req.user = { id: 'user-1', organizationId: 'org-1', role: 'ADMIN' };
      next();
    },
  };
});

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => dbAll(...args),
  run: (...args: unknown[]) => dbRun(...args),
}));

const { default: organizationContextStoreRouter } = await import(
  '../../../server/src/routes/organization-context-store.routes.ts'
);

describe('organization context store ownership boundary', () => {
  const makeApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/organization-context-store', organizationContextStoreRouter);
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dbRun.mockResolvedValue({ changes: 1 });
  });

  it('persists context sections but ignores a legacy profile payload', async () => {
    const response = await request(makeApp()).put('/api/organization-context-store').send({
      goals: { primaryObjective: 'Grow' },
      challenges: { declaredChallenges: [] },
      synthesis: { selectedScenarioId: 'balanced' },
      companyProfile: { name: 'must-not-be-written-here' },
    });

    expect(response.status).toBe(200);
    expect(dbRun).toHaveBeenCalledTimes(1);
    const [sql, params] = dbRun.mock.calls[0];
    expect(sql).not.toContain('company_profile_json = EXCLUDED.company_profile_json');
    expect(params).toEqual([
      'org-1',
      JSON.stringify({ primaryObjective: 'Grow' }),
      JSON.stringify({ declaredChallenges: [] }),
      JSON.stringify({ selectedScenarioId: 'balanced' }),
      'user-1',
    ]);
    expect(JSON.stringify(params)).not.toContain('must-not-be-written-here');
  });
});
