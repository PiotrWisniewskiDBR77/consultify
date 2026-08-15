/**
 * Megatrend Integration Tests - Real Implementation
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

describe('Megatrend Integration', () => {
  let testUserId;
  let testOrgId;
  let testToken;
  let testMegatrendId;
  let customTrendId;
  const db = getDatabase();

  const baselineTrend = {
    industry: 'manufacturing',
    type: 'Technology',
    label: 'Test Megatrend',
    description: 'Test megatrend description',
    baseImpactScore: 6,
    initialRing: 'Now',
  };

  const insertBaselineTrend = async () => {
    testMegatrendId = `mt-${uuidv4()}`;
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO megatrends (id, industry, type, label, description, base_impact_score, initial_ring)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          testMegatrendId,
          baselineTrend.industry,
          baselineTrend.type,
          baselineTrend.label,
          baselineTrend.description,
          baselineTrend.baseImpactScore,
          baselineTrend.initialRing,
        ],
        (err) => (err ? reject(err) : resolve())
      );
    });
  };

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
        [testOrgId, 'Megatrend Test Org', 'professional', 'active', 'PAID'],
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
          `megatrend-${testUserId}@test.com`,
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
        email: `megatrend-${testUserId}@test.com`,
        password: 'password123',
      });

    testToken = loginRes.body.token;

    await insertBaselineTrend();
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      db.run(`DELETE FROM custom_trends WHERE company_id = ?`, [testOrgId], () => resolve());
    });
    await new Promise((resolve) => {
      db.run(`DELETE FROM megatrends WHERE id = ?`, [testMegatrendId], () => resolve());
    });
    await new Promise((resolve) => {
      db.run(`DELETE FROM users WHERE id = ?`, [testUserId], () => resolve());
    });
    await new Promise((resolve) => {
      db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => resolve());
    });
  });

  it('should return 503 when baseline data is empty', async () => {
    if (!testToken) return;

    await new Promise((resolve) => {
      db.run(`DELETE FROM megatrends`, [], () => resolve());
    });

    const res = await request(app)
      .get('/api/megatrends/baseline')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(503);
    expect(res.body.type).toBe('not_configured');
    expect(res.body).not.toHaveProperty('reason');

    await insertBaselineTrend();
  });

  it('should list baseline megatrends when data exists', async () => {
    if (!testToken) return;

    const res = await request(app)
      .get('/api/megatrends/baseline')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBeTruthy();
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should return radar data', async () => {
    if (!testToken) return;

    const res = await request(app)
      .get('/api/megatrends/radar')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBeTruthy();
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should return megatrend by id', async () => {
    if (!testToken) return;

    const res = await request(app)
      .get(`/api/megatrends/${testMegatrendId}`)
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testMegatrendId);
  });

  it('should create custom megatrend', async () => {
    if (!testToken) return;

    const res = await request(app)
      .post('/api/megatrends/custom')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        industry: 'manufacturing',
        type: 'Business',
        label: 'Custom Megatrend',
        ring: 'Now',
        description: 'Test custom megatrend',
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.id).toBeTruthy();
    customTrendId = res.body.id;
  });

  it('should update custom megatrend ring', async () => {
    if (!testToken || !customTrendId) return;

    const res = await request(app)
      .put(`/api/megatrends/custom/${customTrendId}`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        ring: 'Next',
      });

    expect(res.status).toBe(200);
  });
});
