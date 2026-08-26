import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import type { InitiativeReadModel } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { createInitiativesExecutionRuntimeRouter } from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes';

const row = (index: number, projectId: string): InitiativeReadModel => ({
  version: 1,
  initiative: {
    initiativeId: `initiative-${index}`,
    lifecycleState: 'REGISTERED_DRAFT',
    title: `Initiative ${index}`,
    problem: 'Problem',
    proposedOutcome: null,
    projectId,
    initiativeOwnerId: 'owner-1',
    visibility: 'PROJECT',
    readiness: 'NOT_EVALUATED',
    source: {
      proposalId: 'proposal-1',
      proposalVersion: 1,
      sourceType: 'MANUAL_HUB',
      sourceId: 'manual-1',
      sourceVersion: 1,
    },
  },
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const build = (rows: InitiativeReadModel[], authorize = vi.fn(async () => true)) => {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).user = { id: 'user-1', organizationId: 'org-1', role: 'USER' };
    next();
  });
  app.use(
    '/runtime-v1',
    createInitiativesExecutionRuntimeRouter({
      unitOfWork: {} as any,
      reader: {
        listInitiativesPage: vi.fn(async () => ({ initiatives: rows, nextCursor: null })),
      } as any,
      authorize,
      resolvePolicy: vi.fn() as any,
    })
  );
  return { app, authorize };
};

describe('GET /initiatives request-local authorization deduplication', () => {
  it('authorizes 50 rows from one project exactly once', async () => {
    const { app, authorize } = build(Array.from({ length: 50 }, (_, index) => row(index, 'p1')));
    const response = await request(app).get('/runtime-v1/initiatives');
    expect(response.status).toBe(200);
    expect(response.body.initiatives).toHaveLength(50);
    expect(authorize).toHaveBeenCalledTimes(1);
  });

  it('authorizes 50 rows from three projects exactly three times', async () => {
    const { app, authorize } = build(
      Array.from({ length: 50 }, (_, index) => row(index, `p${(index % 3) + 1}`))
    );
    await request(app).get('/runtime-v1/initiatives');
    expect(authorize).toHaveBeenCalledTimes(3);
  });

  it('does not authorize an empty list', async () => {
    const { app, authorize } = build([]);
    const response = await request(app).get('/runtime-v1/initiatives');
    expect(response.status).toBe(200);
    expect(response.body.initiatives).toEqual([]);
    expect(authorize).not.toHaveBeenCalled();
  });

  it('filters only the denied project instead of hiding every row', async () => {
    const authorize = vi.fn(async (_actor, projectId: string) => projectId !== 'denied');
    const { app } = build([row(1, 'allowed'), row(2, 'denied')], authorize);
    const response = await request(app).get('/runtime-v1/initiatives');
    expect(response.body.initiatives.map((item: any) => item.initiative.projectId)).toEqual([
      'allowed',
    ]);
    expect(authorize).toHaveBeenCalledTimes(2);
  });
});
