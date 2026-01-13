/**
 * Test Authentication Helper
 *
 * Provides utilities for creating authenticated test requests.
 * This solves the 403 Forbidden issues in integration tests.
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../server/database.js');
const app = require('../../server/index.js');

// Sleep helper for DB sync
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Create a test user and organization, return auth token
 * @param {string} prefix - Unique prefix for test isolation
 * @param {string} role - User role (default: ADMIN)
 * @returns {Promise<{token: string, userId: string, orgId: string, email: string}>}
 */
export async function createTestUserAndGetToken(prefix = 'test', role = 'ADMIN') {
  const testId = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const orgId = `org-${testId}`;
  const userId = `user-${testId}`;
  const email = `${testId}@test.dbr77.com`;
  const password = 'testpassword123';

  // Wait for DB initialization
  if (db.initPromise) {
    await db.initPromise;
  }

  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync(password, 8);

  // Create organization and user
  await new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(
        'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
        [orgId, `Test Org ${testId}`, 'free', 'active'],
        (err) => {
          if (err) console.warn('Org insert warning:', err.message);
        }
      );

      db.run(
        'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, orgId, email, hash, 'TestUser', role],
        (err) => {
          if (err) {
            console.warn('User insert warning:', err.message);
          }
          resolve();
        }
      );
    });
  });

  await sleep(100);

  // Login to get token
  const request = (await import('supertest')).default;
  const loginRes = await request(app).post('/api/auth/login').send({ email, password });

  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${loginRes.status} - ${JSON.stringify(loginRes.body)}`);
  }

  return {
    token: loginRes.body.token,
    userId,
    orgId,
    email,
    app,
  };
}

/**
 * Create authenticated request helper
 * @param {object} app - Express app instance
 * @param {string} token - Auth token
 * @param {string} orgId - Organization ID
 * @returns {object} Request helper with pre-set auth headers
 */
export function createAuthenticatedRequest(app, token, orgId) {
  const request = require('supertest');

  return {
    get: (url) =>
      request(app).get(url).set('Authorization', `Bearer ${token}`).set('X-Organization-Id', orgId),

    post: (url) =>
      request(app)
        .post(url)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Organization-Id', orgId),

    put: (url) =>
      request(app).put(url).set('Authorization', `Bearer ${token}`).set('X-Organization-Id', orgId),

    patch: (url) =>
      request(app)
        .patch(url)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Organization-Id', orgId),

    delete: (url) =>
      request(app)
        .delete(url)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Organization-Id', orgId),
  };
}

/**
 * Create a test project for authenticated user
 * @param {string} orgId - Organization ID
 * @param {string} name - Project name
 * @returns {Promise<string>} Project ID
 */
export async function createTestProject(orgId, name = 'Test Project') {
  const projectId = `project-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  await new Promise((resolve) => {
    db.run(
      'INSERT INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)',
      [projectId, orgId, name, 'active'],
      resolve
    );
  });

  await sleep(50);
  return projectId;
}

/**
 * Cleanup test data
 * @param {string[]} userIds - User IDs to delete
 * @param {string[]} orgIds - Organization IDs to delete
 * @param {string[]} projectIds - Project IDs to delete
 */
export async function cleanupTestData(userIds = [], orgIds = [], projectIds = []) {
  // Delete in correct order to respect FK constraints
  for (const projectId of projectIds) {
    await new Promise((resolve) => {
      db.run('DELETE FROM projects WHERE id = ?', [projectId], resolve);
    });
  }

  for (const userId of userIds) {
    await new Promise((resolve) => {
      db.run('DELETE FROM users WHERE id = ?', [userId], resolve);
    });
  }

  for (const orgId of orgIds) {
    await new Promise((resolve) => {
      db.run('DELETE FROM organizations WHERE id = ?', [orgId], resolve);
    });
  }
}

export { app, db };
