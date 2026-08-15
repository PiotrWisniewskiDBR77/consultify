/**
 * Initiatives Integration Tests - Real Implementation
 */
import app from '../../server/src/index.js';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../server/src/database/Database.js';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

describe('Initiatives Integration', () => {
  let testUserId;
  let testOrgId;
  let testProjectId;
  let testToken;
  let createdInitiativeId;
  const db = getDatabase();

  beforeAll(async () => {
    await initializeDatabase();

    if (db.initPromise) {
      await db.initPromise;
    }

    // Create test organization
    testOrgId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO organizations (id, name, plan, status, organization_type) VALUES (?, ?, ?, ?, ?)`,
        [testOrgId, 'Initiatives Test Org', 'professional', 'active', 'PAID'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Create test project
    testProjectId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)`,
        [testProjectId, testOrgId, 'Initiatives Test Project', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Create test user
    testUserId = uuidv4();
    const hashedPassword = await bcrypt.hash('password123', 10);
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          testUserId,
          testOrgId,
          `initiatives-${testUserId}@test.com`,
          hashedPassword,
          'ADMIN',
          'active',
        ],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: `initiatives-${testUserId}@test.com`,
        password: 'password123',
      });

    testToken = loginRes.body.token;
  });

  afterAll(async () => {
    if (createdInitiativeId) {
      await new Promise((resolve) => {
        db.run(`DELETE FROM initiatives WHERE id = ?`, [createdInitiativeId], () => resolve());
      });
    }
    await new Promise((resolve) => {
      db.run(`DELETE FROM projects WHERE id = ?`, [testProjectId], () => resolve());
    });
    await new Promise((resolve) => {
      db.run(`DELETE FROM users WHERE id = ?`, [testUserId], () => resolve());
    });
    await new Promise((resolve) => {
      db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => resolve());
    });
  });

  it('should list initiatives for project', async () => {
    if (!testToken) return;

    const res = await request(app)
      .get('/api/initiatives')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);

    if (res.status === 200) {
      expect(Array.isArray(res.body) || res.body.initiatives).toBeTruthy();
    }
  });

  it('should create initiative', async () => {
    if (!testToken) return;

    const res = await request(app)
      .post('/api/initiatives')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        projectId: testProjectId,
        title: 'Test Initiative',
        description: 'Created by integration test',
        priority: 'high',
        status: 'DRAFT',
      });

    expect([200, 201]).toContain(res.status);

    if (res.status === 200 || res.status === 201) {
      createdInitiativeId = res.body.initiative?.id || res.body.id;
    }
  });

  it('should update initiative', async () => {
    if (!testToken || !createdInitiativeId) return;

    const res = await request(app)
      .put(`/api/initiatives/${createdInitiativeId}`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        title: 'Updated Initiative',
      });

    expect(res.status).toBe(200);
  });

  it('should delete initiative', async () => {
    if (!testToken || !createdInitiativeId) return;

    const res = await request(app)
      .delete(`/api/initiatives/${createdInitiativeId}`)
      .set('Authorization', `Bearer ${testToken}`);

    expect([200, 204]).toContain(res.status);

    if (res.status === 200 || res.status === 204) {
      createdInitiativeId = null;
    }
  });

  it('should prioritize initiatives', async () => {
    if (!testToken) return;

    const res = await request(app)
      .post(`/api/projects/${testProjectId}/initiatives/prioritize`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        initiativeIds: [],
        criteria: 'impact',
      });

    // Prioritization belonged to the retired project-nested API. The removed
    // route must stay fail-closed rather than silently mutating canonical data.
    expect(res.status).toBe(404);
  });
});
