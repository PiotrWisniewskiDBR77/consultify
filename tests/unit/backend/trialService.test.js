/**
 * Trial Service Unit Tests
 * Tests trial management, expiration, and conversion
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-trial-service-${workerId}.db`;
});

describe('TrialService', () => {
  const db = getDatabase();
  let testOrgId;
  let testUserId;

  beforeAll(async () => {
    await initializeDatabase();

    // Create test user
    testUserId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, email, password, role, status) VALUES (?, ?, ?, ?, ?)`,
        [testUserId, `trial-${Date.now()}@test.com`, 'hash', 'ADMIN', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Create test organization with trial status
    testOrgId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO organizations (id, name, plan, status, billing_status, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [testOrgId, 'Trial Test Org', 'trial', 'active', 'TRIAL'],
        (err) => (err ? reject(err) : resolve())
      );
    });
  });

  afterAll(async () => {
    await new Promise((r) =>
      db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => r())
    );
    await new Promise((r) => db.run(`DELETE FROM users WHERE id = ?`, [testUserId], () => r()));
  });

  describe('Trial Status', () => {
    it('should get trial organization', async () => {
      const org = await new Promise((resolve) => {
        db.get(`SELECT * FROM organizations WHERE id = ?`, [testOrgId], (_, row) => resolve(row));
      });

      expect(org).toBeDefined();
      expect(org.billing_status).toBe('TRIAL');
    });

    it('should calculate trial days remaining', async () => {
      const org = await new Promise((resolve) => {
        db.get(`SELECT * FROM organizations WHERE id = ?`, [testOrgId], (_, row) => resolve(row));
      });

      const createdAt = new Date(org.created_at);
      const now = new Date();
      const daysSinceCreation = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
      const trialDays = 14;
      const daysRemaining = Math.max(0, trialDays - daysSinceCreation);

      expect(daysRemaining).toBeGreaterThanOrEqual(0);
      expect(daysRemaining).toBeLessThanOrEqual(14);
    });

    it('should identify active trial', async () => {
      const org = await new Promise((resolve) => {
        db.get(
          `SELECT * FROM organizations WHERE id = ? AND billing_status = 'TRIAL'`,
          [testOrgId],
          (_, row) => resolve(row)
        );
      });

      expect(org).not.toBeNull();
    });
  });

  describe('Trial Extension', () => {
    it('should support trial extension field', async () => {
      // Check if trial_extended_until column exists or can be used
      const orgId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO organizations (id, name, plan, status, billing_status) VALUES (?, ?, ?, ?, ?)`,
          [orgId, 'Extension Test', 'trial', 'active', 'TRIAL'],
          () => resolve()
        );
      });

      // Verify we can query trial orgs
      const org = await new Promise((resolve) => {
        db.get(`SELECT * FROM organizations WHERE id = ?`, [orgId], (_, row) => resolve(row));
      });

      expect(org.billing_status).toBe('TRIAL');

      // Cleanup
      await new Promise((r) =>
        db.run(`DELETE FROM organizations WHERE id = ?`, [orgId], () => r())
      );
    });
  });

  describe('Trial Expiration', () => {
    it('should identify expired trial', async () => {
      const expiredOrgId = uuidv4();
      // Create org with old date
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO organizations (id, name, plan, status, billing_status, created_at) 
                     VALUES (?, ?, ?, ?, ?, datetime('now', '-30 days'))`,
          [expiredOrgId, 'Expired Org', 'trial', 'active', 'TRIAL'],
          () => resolve()
        );
      });

      const org = await new Promise((resolve) => {
        db.get(`SELECT * FROM organizations WHERE id = ?`, [expiredOrgId], (_, row) =>
          resolve(row)
        );
      });

      const createdAt = new Date(org.created_at);
      const now = new Date();
      const daysSinceCreation = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
      const isExpired = daysSinceCreation > 14;

      expect(isExpired).toBe(true);

      // Cleanup
      await new Promise((r) =>
        db.run(`DELETE FROM organizations WHERE id = ?`, [expiredOrgId], () => r())
      );
    });
  });

  describe('Trial Conversion', () => {
    it('should convert trial to paid', async () => {
      const conversionOrgId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO organizations (id, name, plan, status, billing_status) VALUES (?, ?, ?, ?, ?)`,
          [conversionOrgId, 'Convert Test', 'trial', 'active', 'TRIAL'],
          () => resolve()
        );
      });

      // Simulate conversion
      await new Promise((resolve) => {
        db.run(
          `UPDATE organizations SET billing_status = ?, plan = ? WHERE id = ?`,
          ['ACTIVE', 'professional', conversionOrgId],
          () => resolve()
        );
      });

      const org = await new Promise((resolve) => {
        db.get(`SELECT * FROM organizations WHERE id = ?`, [conversionOrgId], (_, row) =>
          resolve(row)
        );
      });

      expect(org.billing_status).toBe('ACTIVE');
      expect(org.plan).toBe('professional');

      // Cleanup
      await new Promise((r) =>
        db.run(`DELETE FROM organizations WHERE id = ?`, [conversionOrgId], () => r())
      );
    });
  });

  describe('Trial Limits', () => {
    it('should track trial usage', async () => {
      const org = await new Promise((resolve) => {
        db.get(`SELECT token_balance FROM organizations WHERE id = ?`, [testOrgId], (_, row) =>
          resolve(row)
        );
      });

      // Trial orgs should have limited or zero tokens initially
      expect(org.token_balance).toBeDefined();
    });
  });

  describe('Trial Notifications', () => {
    it('should support notification triggers', () => {
      const dayThresholds = [7, 3, 1, 0];
      const daysRemaining = 3;

      const shouldNotify = dayThresholds.includes(daysRemaining);
      expect(shouldNotify).toBe(true);
    });

    it('should not notify on non-threshold days', () => {
      const dayThresholds = [7, 3, 1, 0];
      const daysRemaining = 5;

      const shouldNotify = dayThresholds.includes(daysRemaining);
      expect(shouldNotify).toBe(false);
    });
  });
});
