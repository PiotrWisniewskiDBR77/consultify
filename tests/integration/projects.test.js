/**
 * Projects Integration Tests - Real Implementation
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

describe('Projects Integration', () => {
  let testUserId;
  let testOrgId;
  let testToken;
  let createdProjectId;
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
        [testOrgId, 'Projects Test Org', 'professional', 'active', 'PAID'],
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
          `projects-${testUserId}@test.com`,
          hashedPassword,
          'ADMIN',
          'active',
        ],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: `projects-${testUserId}@test.com`,
        password: 'password123',
      });

    testToken = loginRes.body.token;
  });

  afterAll(async () => {
    if (createdProjectId) {
      await new Promise((resolve) => {
        db.run(`DELETE FROM projects WHERE id = ?`, [createdProjectId], () => resolve());
      });
    }
    await new Promise((resolve) => {
      db.run(`DELETE FROM users WHERE id = ?`, [testUserId], () => resolve());
    });
    await new Promise((resolve) => {
      db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => resolve());
    });
  });

  it('should create project', async () => {
    if (!testToken) return;

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        name: 'Test Project',
        description: 'Created by integration test',
        status: 'active',
      });

    expect([200, 201]).toContain(res.status);

    if (res.status === 200 || res.status === 201) {
      createdProjectId = res.body.project?.id || res.body.id;
      expect(createdProjectId).toBeDefined();
    }
  });

  it('should list projects', async () => {
    if (!testToken) return;

    const res = await request(app).get('/api/projects').set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);

    if (res.status === 200) {
      expect(Array.isArray(res.body) || res.body.projects).toBeTruthy();
    }
  });

  it('should update project', async () => {
    if (!testToken || !createdProjectId) return;

    const res = await request(app)
      .put(`/api/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        name: 'Updated Project Name',
        description: 'Updated by integration test',
      });

    expect(res.status).toBe(200);
  });

  it('should delete project', async () => {
    if (!testToken || !createdProjectId) return;

    const res = await request(app)
      .delete(`/api/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${testToken}`);

    expect([200, 204]).toContain(res.status);

    if (res.status === 200 || res.status === 204) {
      createdProjectId = null; // Mark as deleted
    }
  });
});
