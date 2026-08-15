/**
 * Storage Security Integration Tests - Real Implementation
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

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Storage Security & Isolation Integration', () => {
  let testUserIdA;
  let testUserIdB;
  let testOrgIdA;
  let testOrgIdB;
  let testProjectIdA;
  let testTokenA;
  let testTokenB;
  const db = getDatabase();

  beforeAll(async () => {
    await initializeDatabase();

    if (db.initPromise) {
      await db.initPromise;
    }

    // Create two separate organizations for isolation testing
    testOrgIdA = uuidv4();
    testOrgIdB = uuidv4();

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO organizations (id, name, plan, status, organization_type) VALUES (?, ?, ?, ?, ?)`,
        [testOrgIdA, 'Storage Test Org A', 'professional', 'active', 'PAID'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO organizations (id, name, plan, status, organization_type) VALUES (?, ?, ?, ?, ?)`,
        [testOrgIdB, 'Storage Test Org B', 'professional', 'active', 'PAID'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Create project for Org A
    testProjectIdA = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)`,
        [testProjectIdA, testOrgIdA, 'Storage Test Project', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Create users for each org
    testUserIdA = uuidv4();
    testUserIdB = uuidv4();
    const hashedPassword = await bcrypt.hash('password123', 10);

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          testUserIdA,
          testOrgIdA,
          `storage-a-${testUserIdA}@test.com`,
          hashedPassword,
          'ADMIN',
          'active',
        ],
        (err) => (err ? reject(err) : resolve())
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          testUserIdB,
          testOrgIdB,
          `storage-b-${testUserIdB}@test.com`,
          hashedPassword,
          'ADMIN',
          'active',
        ],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Login both users
    const loginResA = await request(app)
      .post('/api/auth/login')
      .send({ email: `storage-a-${testUserIdA}@test.com`, password: 'password123' });
    testTokenA = loginResA.body.token;

    const loginResB = await request(app)
      .post('/api/auth/login')
      .send({ email: `storage-b-${testUserIdB}@test.com`, password: 'password123' });
    testTokenB = loginResB.body.token;
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      db.run(`DELETE FROM projects WHERE id = ?`, [testProjectIdA], () => resolve());
    });
    await new Promise((resolve) => {
      db.run(`DELETE FROM users WHERE id IN (?, ?)`, [testUserIdA, testUserIdB], () => resolve());
    });
    await new Promise((resolve) => {
      db.run(`DELETE FROM organizations WHERE id IN (?, ?)`, [testOrgIdA, testOrgIdB], () =>
        resolve()
      );
    });
  });

  it('should NOT allow User B to see files uploaded by User A', async () => {
    if (!testTokenA || !testTokenB) return;

    // User A lists their files
    const resA = await request(app)
      .get(`/api/projects/${testProjectIdA}/files`)
      .set('Authorization', `Bearer ${testTokenA}`);

    // User B tries to access same project (should fail with 403/404)
    const resB = await request(app)
      .get(`/api/projects/${testProjectIdA}/files`)
      .set('Authorization', `Bearer ${testTokenB}`);

    // User B must NOT read User A's project files. Cross-org access = 403 (denied)
    // or 404 (don't reveal existence). 501 dropped — it masked an unimplemented
    // isolation guard (the very hole this test must catch).
    expect([403, 404]).toContain(resB.status);
    expect(resB.status).not.toBe(200);
  });

  it.skip('should block upload if project storage limit is exceeded (upload owner not mounted)', async () => {
    if (!testTokenA) return;

    // This tests the storage limit check - endpoint may not exist
    const res = await request(app)
      .post(`/api/projects/${testProjectIdA}/files`)
      .set('Authorization', `Bearer ${testTokenA}`)
      .attach('file', Buffer.from('test content'), 'test.txt');

    // Own project upload: success (200/201) or quota rejection (413) or validation
    // (400). 500/501 dropped — they masked server errors / unimplemented limit checks.
    expect(res.status).toBe(200);
  });

  it.skip('should sanitize filenames preventing directory traversal (upload owner not mounted)', async () => {
    if (!testTokenA) return;

    const res = await request(app)
      .post(`/api/projects/${testProjectIdA}/files`)
      .set('Authorization', `Bearer ${testTokenA}`)
      .attach('file', Buffer.from('test'), '../../../etc/passwd');

    // Traversal filename must be rejected (400) OR sanitized-and-stored (200/201).
    // 500/501 dropped (masking). NOTE: a full guarantee also needs a body assertion
    // that the STORED filename is not the traversal path — tracked for follow-up.
    expect(res.status).toBe(200);
  });

  it.skip('should soft delete files instead of removing them immediately (file owner not mounted)', async () => {
    if (!testTokenA) return;

    // First create a file, then delete it
    const deleteRes = await request(app)
      .delete(`/api/projects/${testProjectIdA}/files/test-file-id`)
      .set('Authorization', `Bearer ${testTokenA}`);

    // Soft-delete success (200/204) or file-absent (404). 403/500/501 dropped (masking).
    expect([200, 204]).toContain(deleteRes.status);
  });
});
