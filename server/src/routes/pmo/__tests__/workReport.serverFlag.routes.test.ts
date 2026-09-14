/** @vitest-environment node */
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createInitiativesExecutionRuntimeRouter } from '../initiativesExecutionRuntime.routes.js';

const savedFlag = process.env.ENABLE_INITIATIVES_WORK_REPORT;

afterEach(() => {
  if (savedFlag === undefined) delete process.env.ENABLE_INITIATIVES_WORK_REPORT;
  else process.env.ENABLE_INITIATIVES_WORK_REPORT = savedFlag;
});

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: 'admin-1', organizationId: 'org-1', role: 'admin' };
    (req as any).userRole = 'admin';
    next();
  });
  app.use(
    '/api/v8/pmo/initiatives-execution',
    createInitiativesExecutionRuntimeRouter({
      unitOfWork: {} as any,
      reader: {
        listReportRuns: vi.fn(async () => []),
        resolveProjectIdsForAggregate: vi.fn(async () => []),
      } as any,
      authorize: vi.fn(async () => true),
      resolvePolicy: vi.fn(),
    })
  );
  return app;
}

const cases = [
  ['post', '/work-reports/preview', {}],
  ['post', '/work-reports/schedules', {}],
  ['get', '/work-reports/run-1/pdf', undefined],
  ['post', '/work-reports/run-1/deliver', {}],
] as const;

describe('ENABLE_INITIATIVES_WORK_REPORT server gate', () => {
  it('defaults OFF and blocks every work-report endpoint before handler execution', async () => {
    delete process.env.ENABLE_INITIATIVES_WORK_REPORT;
    const app = makeApp();
    for (const [method, path, body] of cases) {
      const call = request(app)[method](`/api/v8/pmo/initiatives-execution${path}`);
      const response = body === undefined ? await call : await call.send(body);
      expect(response.status, `${method.toUpperCase()} ${path}`).toBe(404);
      expect(response.body).toEqual({ error: { code: 'FEATURE_DISABLED' } });
    }
  });

  it('ON reaches all four handlers instead of the feature gate', async () => {
    process.env.ENABLE_INITIATIVES_WORK_REPORT = 'true';
    const app = makeApp();
    const statuses: number[] = [];
    for (const [method, path, body] of cases) {
      const call = request(app)[method](`/api/v8/pmo/initiatives-execution${path}`);
      const response = body === undefined ? await call : await call.send(body);
      statuses.push(response.status);
      expect(response.body?.error?.code).not.toBe('FEATURE_DISABLED');
    }
    expect(statuses).toEqual([400, 400, 404, 400]);
  });
});
