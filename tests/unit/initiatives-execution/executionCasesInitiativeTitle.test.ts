/**
 * EXE-1 (G14 05-08, 2026-09-03): GET /execution-cases used to return raw
 * executionCaseId/initiativeId only — the "Wybierz realizację" dropdown in
 * ExecutionReportsSurface.tsx then rendered the raw executionCaseId as its
 * option text on real (non-demo) data, since the initiative name was never
 * sent to the client at all (`REJESTR_SUROWE_ID_20260902.md` pozycja #6).
 *
 * The route already loaded the initiative (`deps.reader.findById`) to run
 * the `initiative.view` authorization check — this test proves the fix:
 * that already-loaded title is now attached to each visible case as
 * `initiativeTitle` instead of being discarded.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createInitiativesExecutionRuntimeRouter } from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes';

function buildApp(): Express {
  const reader = {
    listExecutionCases: vi.fn(async (_organizationId: string) => [
      {
        executionCaseId: 'exec-case-1',
        version: 1,
        initiativeId: 'init-1',
        state: 'ACTIVE',
        executionManagerId: 'user-1',
        handoffPackageId: 'handoff-1',
        updatedAt: '2026-09-03T00:00:00.000Z',
      },
    ]),
    findById: vi.fn(async (_organizationId: string, initiativeId: string) => {
      if (initiativeId !== 'init-1') return null;
      return {
        version: 1,
        initiative: {
          initiativeId: 'init-1',
          title: 'Automatyzacja raportowania DRD',
          projectId: 'proj-1',
        },
        updatedAt: '2026-09-03T00:00:00.000Z',
      };
    }),
  };
  const deps = {
    unitOfWork: {} as never,
    reader: reader as never,
    authorize: vi.fn(async () => true),
    resolvePolicy: vi.fn(async () => ({ policyId: 'p', version: 1 }) as never),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { user: Record<string, unknown> }).user = {
      id: 'user-1',
      organizationId: 'org-1',
      role: 'ADMIN',
    };
    next();
  });
  app.use('/api/initiatives/runtime-v1', createInitiativesExecutionRuntimeRouter(deps as never));
  return app;
}

describe('GET /execution-cases attaches initiativeTitle (EXE-1)', () => {
  it('returns initiativeTitle alongside the raw executionCaseId/initiativeId', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/initiatives/runtime-v1/execution-cases');
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.cases).toHaveLength(1);
    expect(res.body.cases[0]).toMatchObject({
      executionCaseId: 'exec-case-1',
      initiativeId: 'init-1',
      initiativeTitle: 'Automatyzacja raportowania DRD',
    });
  });
});
