/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import express, { type Request } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  createInitiativesExecutionRuntimeRouter,
  type InitiativesExecutionRuntimeDependencies,
} from '../initiativesExecutionRuntime.routes';

describe('A-1 card review HTTP authorization', () => {
  it('returns a named 403 body for a visible initiative when review capability is missing', async () => {
    const authorize = vi.fn().mockResolvedValue(false);
    const deps = {
      reader: {
        findById: vi.fn().mockResolvedValue({
          version: 4,
          initiative: { initiativeId: 'initiative-a1', projectId: 'project-a1' },
        }),
      },
      authorize,
    } as unknown as InitiativesExecutionRuntimeDependencies;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as Request & { user: Record<string, string> }).user = {
        id: 'viewer-a1',
        organizationId: 'organization-a1',
        role: 'MEMBER',
      };
      next();
    });
    app.use('/api/initiatives/runtime-v1', createInitiativesExecutionRuntimeRouter(deps));

    const response = await request(app)
      .post('/api/initiatives/runtime-v1/initiatives/initiative-a1/cards/summary-scope/reviews')
      .send({
        expectedVersion: 4,
        expectedCardVersion: 1,
        clientRequestId: randomUUID(),
        outcome: 'ACCEPTED',
        rationale: 'Looks complete',
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: { code: 'INITIATIVE_REVIEW_FORBIDDEN' } });
    expect(authorize).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'viewer-a1', organizationId: 'organization-a1' }),
      'project-a1',
      'initiative.review'
    );
  });
});
