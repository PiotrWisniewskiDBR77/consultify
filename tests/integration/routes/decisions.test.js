// Note: app import removed - not used after test restructure
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import {
  getDatabase,
  getDatabaseInstance,
  resetConnection,
} from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import * as DbPromise from '../../../server/src/utils/DbPromise.js';
import { initTestDb } from '../../helpers/dbHelper.cjs';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  // Use unique DB per worker to avoid concurrency issues
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

/**
 * Decisions Routes Integration Tests
 */

describe.sequential('Decisions Routes', () => {
  let db;
  let rawDb;

  // Worker-specific IDs
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const orgId = `org-decisions-${workerId}`;
  const userId = `user-decisions-${workerId}`;
  const projectId = `project-decisions-${workerId}`;

  beforeAll(async () => {
    await resetConnection();
    await initTestDb();
    db = getDatabase();
    rawDb = getDatabaseInstance();

    // Force reset and re-init once for this worker
    process.env.RESET_DB = 'true';
    await initializeDatabase();
    process.env.RESET_DB = 'false';
  }, 180000); // 180 second timeout for initialization

  let testApp;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Clean only this fixture's tenant graph. Broad table deletion can damage
    // canonical migration seed rows and makes retries non-deterministic.
    await DbPromise.run(db, 'DELETE FROM decisions WHERE organization_id = ?', [orgId]);
    await DbPromise.run(db, 'DELETE FROM projects WHERE id = ?', [projectId]);
    await DbPromise.run(db, 'DELETE FROM users WHERE id = ?', [userId]);
    await DbPromise.run(db, 'DELETE FROM organizations WHERE id = ?', [orgId]);

    // Seed parent records with unique IDs based on worker
    await DbPromise.run(
      db,
      'INSERT INTO organizations (id, name, status, organization_type) VALUES (?, ?, ?, ?)',
      [orgId, 'Test Org', 'active', 'PAID']
    );
    await DbPromise.run(
      db,
      'INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, orgId, `admin-${workerId}@test.com`, 'hash', 'ADMIN', 'active']
    );
    await DbPromise.run(
      db,
      'INSERT INTO projects (id, organization_id, name, status, owner_id) VALUES (?, ?, ?, ?, ?)',
      [projectId, orgId, 'Test Project', 'active', userId]
    );

    process.env.NODE_ENV = 'test';
    process.env.TEST_ORG_ID = orgId;
    process.env.TEST_USER_ID = userId;

    testApp = express();
    testApp.use(express.json());

    // Mock authentication middleware
    testApp.use((req, res, next) => {
      req.user = { id: userId, organizationId: orgId, role: 'ADMIN' };
      req.can = () => true;
      next();
    });

    const decisionsRouter = (await import('../../../server/src/routes/pmo/decisions.routes.ts'))
      .default;
    testApp.use('/api/decisions', decisionsRouter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/decisions', () => {
    it('returns list of decisions', async () => {
      const decId1 = `decision-1-${workerId}`;
      const decId2 = `decision-2-${workerId}`;

      // Seed database
      await DbPromise.run(
        db,
        'INSERT INTO decisions (id, organization_id, project_id, title, status) VALUES (?, ?, ?, ?, ?)',
        [decId1, orgId, projectId, 'Approve budget increase', 'PENDING']
      );
      await DbPromise.run(
        db,
        'INSERT INTO decisions (id, organization_id, project_id, title, status) VALUES (?, ?, ?, ?, ?)',
        [decId2, orgId, projectId, 'Change scope', 'APPROVED']
      );

      const response = await request(testApp)
        .get('/api/decisions')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.map((d) => d.title)).toContain('Approve budget increase');
    });

    it('filters by projectId', async () => {
      const response = await request(testApp)
        .get(`/api/decisions?projectId=${projectId}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('handles database errors gracefully', async () => {
      // Mock rawDb.all to return error
      vi.spyOn(rawDb, 'all').mockImplementation((sql, params, callback) => {
        const cb = typeof params === 'function' ? params : callback;
        if (cb) cb(new Error('Database error'), null);
      });

      const response = await request(testApp).get('/api/decisions');

      // rawDb.all is mocked to error; asyncHandler surfaces it as a 500.
      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/decisions/:id', () => {
    it('returns single decision', async () => {
      const decId = `single-decision-${workerId}`;

      await DbPromise.run(
        db,
        'INSERT INTO decisions (id, organization_id, project_id, title, status) VALUES (?, ?, ?, ?, ?)',
        [decId, orgId, projectId, 'Approve budget', 'PENDING']
      );

      const response = await request(testApp).get(`/api/decisions/${decId}`).expect(200);

      expect(response.body.id).toBe(decId);
      expect(response.body.title).toBe('Approve budget');
    });

    it('returns 404 for non-existent decision', async () => {
      const nonExistentId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
      const response = await request(testApp).get(`/api/decisions/${nonExistentId}`).expect(404);

      expect(response.body.error).toBe('Decision not found');
    });
  });

  describe('POST /api/decisions', () => {
    it('rejects a forged Initiative relation without writing a decision', async () => {
      const workerId = process.env.VITEST_WORKER_ID || '0';
      const projectId = `project-decisions-${workerId}`;

      const newDecision = {
        projectId: projectId,
        pmoDomain: 'GOVERNANCE_DECISION_MAKING',
        relatedObjectType: 'initiative',
        relatedObjectId: `initiative-${workerId}`,
        title: 'New budget decision',
        description: 'Need more money',
      };

      const response = await request(testApp).post('/api/decisions').send(newDecision);

      if (response.status !== 201) {
        console.log('[DEBUG] Create Decision Error:', response.body);
      }

      expect(response.status).toBe(400);
      expect(response.body.field).toBe('initiativeId');
      expect(response.body.id).toBeUndefined();
    });
  });
});
