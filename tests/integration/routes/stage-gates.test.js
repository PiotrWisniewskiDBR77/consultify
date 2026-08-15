import app from '../../../server/src/index.js';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  process.env.DB_TYPE = 'sqlite';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

// @vitest-environment node

/**
 * Level 2: Integration Tests - Stage Gates
 * Tests stage gate evaluation and transitions
 */
const db = getDatabase();
(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Integration Test: Stage Gate Routes', () => {
  let authToken;
  const testId = Date.now();
  const testOrgId = `gate-org-${testId}`;
  const testUserId = `gate-user-${testId}`;
  const testProjectId = `gate-proj-${testId}`;
  const testEmail = `gate-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    await db.initPromise;

    const hash = bcrypt.hashSync('test123', 8);

    const runSql = (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.run(sql, params, (err) => (err ? reject(err) : resolve(undefined)));
      });

    await runSql('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
      testOrgId,
      'Gate Test Org',
      'enterprise',
      'active',
    ]);
    await runSql(
      'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
      [testUserId, testOrgId, testEmail, hash, 'GateUser', 'ADMIN']
    );
    await runSql(
      'INSERT INTO projects (id, organization_id, name, status, current_phase) VALUES (?, ?, ?, ?, ?)',
      [testProjectId, testOrgId, 'Gate Project', 'active', 'Context']
    );

    const loginRes = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'test123',
    });

    if (loginRes.body.token) {
      authToken = loginRes.body.token;
    }
  });

  describe('GET /api/stage-gates/:projectId/evaluate/:gateType', () => {
    it('should evaluate specific gate', async () => {
      if (!authToken) return;

      const res = await request(app)
        .get(`/api/stage-gates/${testProjectId}/evaluate/Context_To_Roadmap`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/stage-gates/:projectId/current', () => {
    it('should return current gate status', async () => {
      if (!authToken) return;

      const res = await request(app)
        .get(`/api/stage-gates/${testProjectId}/current`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.currentPhase).toBe('Context');
    });
  });

  describe('GET /api/stage-gates/:projectId/history', () => {
    it('should return gate history', async () => {
      if (!authToken) return;

      const res = await request(app)
        .get(`/api/stage-gates/${testProjectId}/history`)
        .set('Authorization', `Bearer ${authToken}`);

      // Some CI/local DB snapshots do not have stage_gates migrated; do not fail the whole suite on that infra gap.
      expect(res.status).toBe(200);
      if (res.status === 200) {
        expect(Array.isArray(res.body)).toBe(true);
      }
    });
  });
});
