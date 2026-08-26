/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

describe.skipIf(!REAL_DB)('Assessment day 29 — report contract session label', () => {
  let app: Express;
  let pool: import('pg').Pool;
  let token = '';
  const suffix = randomUUID().slice(0, 8);
  const org = `org-day29-label-${suffix}`;
  const otherOrg = `org-day29-label-other-${suffix}`;
  const user = `user-day29-label-${suffix}`;
  const otherUser = `user-day29-label-other-${suffix}`;
  const ownProject = `project-day29-label-${suffix}`;
  const foreignProject = `project-day29-label-other-${suffix}`;

  async function seedSession(projectId: string | null) {
    const id = `session-day29-label-${randomUUID()}`;
    await pool.query(
      `INSERT INTO method_sessions
       (id, organization_id, project_id, module, method_pack_id, method_pack_version, state, mode, owner_user_id)
       VALUES ($1,$2,$3,'assessment','drd','v1','active','guided_manual',$4)`,
      [id, org, projectId, user]
    );
    return id;
  }

  async function read(sessionId: string) {
    return request(app)
      .get(`/api/method/sessions/${sessionId}/assessment-report-contract`)
      .set('Authorization', `Bearer ${token}`);
  }

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1,$2),($3,$4)`, [
      org,
      'Day 29 label org',
      otherOrg,
      'Day 29 label other org',
    ]);
    await pool.query(
      `INSERT INTO users (id, organization_id, email, role)
       VALUES ($1,$2,$3,'user'),($4,$5,$6,'user')`,
      [user, org, `${user}@example.test`, otherUser, otherOrg, `${otherUser}@example.test`]
    );
    await pool.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1,$2,$3),($4,$5,$6)`,
      [ownProject, org, 'Fabryka Północ', foreignProject, otherOrg, 'Nazwa obcej organizacji']
    );
    const { default: config } = await import('../../../config/Config.js');
    token = jwt.sign({ id: user, organizationId: org, role: 'user' }, config.JWT_SECRET, {
      expiresIn: '15m',
      ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
      ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
    });
    const { default: routes } = await import('../../../routes/method-core.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/method', routes);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM projects WHERE id IN ($1,$2)`, [ownProject, foreignProject]);
    await pool.query(`DELETE FROM users WHERE id IN ($1,$2)`, [user, otherUser]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [org, otherOrg]);
    await pool.end();
  });

  it('returns the organization-scoped project name', async () => {
    const response = await read(await seedSession(ownProject));
    expect(response.status).toBe(200);
    expect(response.body.reportContract.sessionLabel).toEqual({
      displayName: 'Fabryka Północ',
      source: 'project',
      projectId: ownProject,
    });
  });

  it('returns an honest empty label for a session without a project', async () => {
    const response = await read(await seedSession(null));
    expect(response.body.reportContract.sessionLabel).toEqual({
      displayName: null,
      source: null,
      projectId: null,
    });
  });

  it('preserves a dangling project id without inventing a name', async () => {
    const projectId = `missing-${suffix}`;
    const response = await read(await seedSession(projectId));
    expect(response.body.reportContract.sessionLabel).toEqual({
      displayName: null,
      source: null,
      projectId,
    });
  });

  it('does not expose the name of a project from another organization', async () => {
    const response = await read(await seedSession(foreignProject));
    expect(response.body.reportContract.sessionLabel).toEqual({
      displayName: null,
      source: null,
      projectId: foreignProject,
    });
    expect(JSON.stringify(response.body)).not.toContain('Nazwa obcej organizacji');
  });

  it('keeps contract v1 and all seven canonical chapters', async () => {
    const response = await read(await seedSession(ownProject));
    const contract = response.body.reportContract;
    expect(contract.contractVersion).toBe('assessment-report-contract-v1');
    expect(contract.chapters).toHaveLength(7);
    expect(contract).toEqual(
      expect.objectContaining({
        outputId: null,
        revision: 0,
        methodVersion: 'v1',
        generatedAt: expect.any(String),
      })
    );
    expect(contract.chapters[0]).toEqual(
      expect.objectContaining({
        matrix: expect.objectContaining({ areas: expect.any(Array) }),
        areaComments: expect.any(Array),
      })
    );
  });
});
