import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../../_helpers/testApp';

function base64UrlEncodeJson(obj: any): string {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeE2EToken(payload: Record<string, unknown>): string {
  const header = base64UrlEncodeJson({ alg: 'none', typ: 'JWT' });
  const body = base64UrlEncodeJson(payload);
  return `${header}.${body}.x`;
}

describe('Projects AI role + regulatory mode (real, DB-backed)', () => {
  const basePath = '/api/pmo/projects';

  const orgId = '11111111-1111-1111-1111-111111111111';
  const userId = '22222222-2222-2222-2222-222222222222';
  const projectId = '33333333-3333-3333-3333-333333333333';

  const token = makeE2EToken({
    e2e: true,
    id: userId,
    organizationId: orgId,
    role: 'ADMIN',
  });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.SKIP_STARTUP_VALIDATOR = 'true';
    process.env.DISABLE_SCHEDULER = 'true';
    process.env.E2E_MODE = 'true';
    vi.resetModules();

    const workerId = process.env.VITEST_WORKER_ID || '0';
    process.env.SQLITE_PATH = `/tmp/consultify-project-ai-${workerId}.db`;

    const { initializeDatabase } = await import(
      '../../../../server/src/database/DatabaseInitializer.js'
    );
    await initializeDatabase();

    const { run } = await import('../../../../server/src/utils/DbPromise.js');
    await run(
      `INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
      [orgId, 'E2E Org', 'enterprise', 'active']
    );
    await run(`INSERT OR IGNORE INTO users (id, email, organization_id) VALUES (?, ?, ?)`, [
      userId,
      'e2e-admin@example.com',
      orgId,
    ]);
    await run(
      `INSERT OR IGNORE INTO projects (id, organization_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [projectId, orgId, 'E2E Project', 'active']
    );
  });

  const mount = async () => {
    const router = (await import('../../../../server/src/routes/pmo/projects.routes.ts')).default;
    return makeTestApp({ mountPath: basePath, router });
  };

  it('PUT /:id/ai-role persists role and GET returns config', async () => {
    const putRes = await request(await mount())
      .put(`${basePath}/${projectId}/ai-role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ aiRole: 'MANAGER', justification: 'test' });
    expect(putRes.status).toBe(200);
    expect(putRes.body).toEqual(expect.objectContaining({ success: true, projectId }));

    const getRes = await request(await mount())
      .get(`${basePath}/${projectId}/ai-role`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual(
      expect.objectContaining({
        projectId,
        aiRole: 'MANAGER',
        capabilities: expect.any(Object),
        description: expect.any(String),
      })
    );
  });

  it('PUT /:id/regulatory-mode persists enabled=true and GET returns status', async () => {
    const putRes = await request(await mount())
      .put(`${basePath}/${projectId}/regulatory-mode`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true, justification: 'test' });
    expect(putRes.status).toBe(200);
    expect(putRes.body).toEqual(expect.objectContaining({ success: true, projectId }));

    const getRes = await request(await mount())
      .get(`${basePath}/${projectId}/regulatory-mode`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual(
      expect.objectContaining({
        projectId,
        enabled: true,
        prompt: expect.any(String),
      })
    );
  });
});
