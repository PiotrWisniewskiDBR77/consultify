/**
 * Plan Limits Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Set env vars for integration test BEFORE any imports
// Using vi.hoisted to ensure these run before imports
vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.TEST_TYPE = 'integration';
  process.env.MOCK_DB = 'false';
  process.env.JWT_SECRET = 'test-secret-key-for-testing-only-min-32-chars';

  // Use a fixed path string to avoid ReferenceError with path import
  process.env.SQLITE_PATH = './test-plan-limits-shared.db';
});

const FIXED_TEST_DB_PATH = './test-plan-limits-shared.db';

// Import app and database after setting env vars
import app from '../../../server/src/index.js';
import { getDatabaseAsync } from '../../../server/src/database/Database.js';
import * as DbPromise from '../../../server/src/utils/DbPromise.js';
import { TEST_SCHEMA } from '../../utils/testSchema.js';

describe('Plan Limits Integration', () => {
  let authToken;
  let userId;
  let orgId;
  let db;

  beforeAll(async () => {
    // Ensure the directory exists
    const dir = path.dirname(FIXED_TEST_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = await getDatabaseAsync();

    // Initialize schema
    console.log('[Test] Initializing schema on file:', FIXED_TEST_DB_PATH);
    for (const sql of TEST_SCHEMA) {
      try {
        await DbPromise.run(db, sql);
      } catch (err) {
        // Ignore "table already exists" errors
        if (!err.message.includes('already exists')) {
          throw err;
        }
      }
    }

    // Setup usage of a fresh DB or clean tables
    await DbPromise.run(db, 'DELETE FROM projects');
    await DbPromise.run(db, 'DELETE FROM users');
    await DbPromise.run(db, 'DELETE FROM organizations');

    // Create Org (Free Plan)
    orgId = uuidv4();
    userId = uuidv4();

    // Insert organization
    await DbPromise.run(
      db,
      `INSERT INTO organizations (id, name, plan, status, billing_status, token_balance, is_active) 
             VALUES (?, ?, ?, ?, 'TRIAL', 0, 1)`,
      [orgId, 'Test Org', 'free', 'active']
    );

    // Create User
    await DbPromise.run(
      db,
      `INSERT INTO users (id, email, password, organization_id, role, status) 
             VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
      [userId, 'test@example.com', 'hashedpass', orgId, 'ADMIN']
    );

    // Generate Token
    authToken = jwt.sign(
      { id: userId, organizationId: orgId, role: 'ADMIN' },
      process.env.JWT_SECRET
    );
    console.log('[Test] Setup complete.');
  });

  afterAll(async () => {
    // Close DB and delete file
    if (db && db.close) {
      await new Promise((resolve) => db.close(resolve));
    }
    // Wait a bit to ensure file is not locked
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (fs.existsSync(FIXED_TEST_DB_PATH)) {
      try {
        fs.unlinkSync(FIXED_TEST_DB_PATH);
      } catch (e) {
        console.warn('[Test] Failed to delete test DB file:', e.message);
      }
    }
  });

  it('fails closed without a resolvable access policy and writes no project', async () => {
    // Free plan limit is 1

    // 1. Create first project - Should Succeed
    const res1 = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Project 1', description: 'Desc 1' });

    if (res1.status !== 201) {
      console.error(
        '[Test Error] Project 1 creation failed. Status:',
        res1.status,
        'Body:',
        res1.body
      );
    }
    expect(res1.status).toBe(429);
    expect(res1.body.errorCode).toBe('ACCESS_POLICY_UNAVAILABLE');

    // DEBUG: Check if project exists in DB
    const checkCount = await DbPromise.get(
      db,
      'SELECT COUNT(*) as count FROM projects WHERE organization_id = ?',
      [orgId]
    );
    console.log('[Test Debug] Project count in DB after res1:', checkCount);
    expect(Number(checkCount.count)).toBe(0);

    // 2. Create second project - Should Fail
    const res2 = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Project 2', description: 'Desc 2' });

    if (res2.status !== 403) {
      console.error(
        '[Test Error] Project 2 should have failed with 403. Status:',
        res2.status,
        'Body:',
        res2.body
      );
    }
    expect(res2.status).toBe(429);
    expect(res2.body.errorCode).toBe('ACCESS_POLICY_UNAVAILABLE');
  });

  it('does not infer access from a legacy plan column after upgrade', async () => {
    // Upgrade to Pro
    await DbPromise.run(db, `UPDATE organizations SET plan = 'pro' WHERE id = ?`, [orgId]);

    // 3. Create second project - Should Succeed now
    const res3 = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Project 2 (Pro)', description: 'Desc 2 Pro' });

    if (res3.status !== 201) {
      console.error(
        '[Test Error] Project 2 Pro creation failed. Status:',
        res3.status,
        'Body:',
        res3.body
      );
    }
    expect(res3.status).toBe(429);
    expect(res3.body.errorCode).toBe('ACCESS_POLICY_UNAVAILABLE');
  });
});
