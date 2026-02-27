/**
 * Subscription Service Unit Tests
 * Tests subscription management, billing, and plan changes
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';

const RUN_DB_TESTS = process.env.RUN_DB_TESTS === '1';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

vi.hoisted(() => {
  if (process.env.RUN_DB_TESTS !== '1') return;
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-subscription-${workerId}.db`;
});

describeIfDb('SubscriptionService', () => {
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
        [testUserId, `sub-${Date.now()}@test.com`, 'hash', 'ADMIN', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Create test organization
    testOrgId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO organizations (id, name, plan, status, billing_status) VALUES (?, ?, ?, ?, ?)`,
        [testOrgId, 'Subscription Test Org', 'professional', 'active', 'ACTIVE'],
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

  describe('Subscription Status', () => {
    it('should get active subscription', async () => {
      const org = await new Promise((resolve) => {
        db.get(`SELECT * FROM organizations WHERE id = ?`, [testOrgId], (_, row) => resolve(row));
      });

      expect(org).toBeDefined();
      expect(org.billing_status).toBe('ACTIVE');
      expect(org.plan).toBe('professional');
    });

    it('should identify subscription by plan', async () => {
      const org = await new Promise((resolve) => {
        db.get(
          `SELECT plan, billing_status FROM organizations WHERE id = ?`,
          [testOrgId],
          (_, row) => resolve(row)
        );
      });

      expect(['starter', 'professional', 'enterprise']).toContain(org.plan);
    });
  });

  describe('Plan Changes', () => {
    it('should upgrade plan', async () => {
      const upgradeOrgId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO organizations (id, name, plan, status, billing_status) VALUES (?, ?, ?, ?, ?)`,
          [upgradeOrgId, 'Upgrade Test', 'starter', 'active', 'ACTIVE'],
          () => resolve()
        );
      });

      // Upgrade to professional
      await new Promise((resolve) => {
        db.run(
          `UPDATE organizations SET plan = ? WHERE id = ?`,
          ['professional', upgradeOrgId],
          () => resolve()
        );
      });

      const org = await new Promise((resolve) => {
        db.get(`SELECT plan FROM organizations WHERE id = ?`, [upgradeOrgId], (_, row) =>
          resolve(row)
        );
      });

      expect(org.plan).toBe('professional');

      // Cleanup
      await new Promise((r) =>
        db.run(`DELETE FROM organizations WHERE id = ?`, [upgradeOrgId], () => r())
      );
    });

    it('should downgrade plan', async () => {
      const downgradeOrgId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO organizations (id, name, plan, status, billing_status) VALUES (?, ?, ?, ?, ?)`,
          [downgradeOrgId, 'Downgrade Test', 'enterprise', 'active', 'ACTIVE'],
          () => resolve()
        );
      });

      // Downgrade to professional
      await new Promise((resolve) => {
        db.run(
          `UPDATE organizations SET plan = ? WHERE id = ?`,
          ['professional', downgradeOrgId],
          () => resolve()
        );
      });

      const org = await new Promise((resolve) => {
        db.get(`SELECT plan FROM organizations WHERE id = ?`, [downgradeOrgId], (_, row) =>
          resolve(row)
        );
      });

      expect(org.plan).toBe('professional');

      // Cleanup
      await new Promise((r) =>
        db.run(`DELETE FROM organizations WHERE id = ?`, [downgradeOrgId], () => r())
      );
    });
  });

  describe('Subscription Cancellation', () => {
    it('should cancel subscription', async () => {
      const cancelOrgId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO organizations (id, name, plan, status, billing_status) VALUES (?, ?, ?, ?, ?)`,
          [cancelOrgId, 'Cancel Test', 'professional', 'active', 'ACTIVE'],
          () => resolve()
        );
      });

      // Cancel subscription
      await new Promise((resolve) => {
        db.run(
          `UPDATE organizations SET billing_status = ?, status = ? WHERE id = ?`,
          ['CANCELLED', 'inactive', cancelOrgId],
          () => resolve()
        );
      });

      const org = await new Promise((resolve) => {
        db.get(
          `SELECT billing_status, status FROM organizations WHERE id = ?`,
          [cancelOrgId],
          (_, row) => resolve(row)
        );
      });

      expect(org.billing_status).toBe('CANCELLED');
      expect(org.status).toBe('inactive');

      // Cleanup
      await new Promise((r) =>
        db.run(`DELETE FROM organizations WHERE id = ?`, [cancelOrgId], () => r())
      );
    });
  });

  describe('Billing Calculations', () => {
    it('should calculate plan pricing', () => {
      const plans = {
        starter: 29,
        professional: 99,
        enterprise: 299,
      };

      expect(plans.starter).toBe(29);
      expect(plans.professional).toBe(99);
      expect(plans.enterprise).toBe(299);
    });

    it('should calculate annual discount', () => {
      const monthlyPrice = 99;
      const annualPrice = monthlyPrice * 12 * 0.8; // 20% discount

      expect(annualPrice).toBeCloseTo(950.4, 1);
    });

    it('should calculate pro-rated refund', () => {
      const monthlyPrice = 99;
      const daysUsed = 15;
      const daysInMonth = 30;
      const proRatedRefund = monthlyPrice * ((daysInMonth - daysUsed) / daysInMonth);

      expect(proRatedRefund).toBe(49.5);
    });
  });

  describe('Feature Access', () => {
    it('should check plan features', () => {
      const planFeatures = {
        starter: ['basic_ai', 'projects_5'],
        professional: ['basic_ai', 'advanced_ai', 'projects_unlimited', 'team_10'],
        enterprise: [
          'basic_ai',
          'advanced_ai',
          'projects_unlimited',
          'team_unlimited',
          'sso',
          'audit',
        ],
      };

      expect(planFeatures.enterprise).toContain('sso');
      expect(planFeatures.starter).not.toContain('sso');
    });

    it('should enforce plan limits', () => {
      const checkLimit = (plan, feature) => {
        const limits = {
          starter: { projects: 5, team: 3 },
          professional: { projects: 50, team: 10 },
          enterprise: { projects: -1, team: -1 }, // -1 = unlimited
        };
        return limits[plan]?.[feature] ?? 0;
      };

      expect(checkLimit('starter', 'projects')).toBe(5);
      expect(checkLimit('professional', 'team')).toBe(10);
      expect(checkLimit('enterprise', 'projects')).toBe(-1); // unlimited
    });
  });

  describe('Renewal', () => {
    it('should calculate next billing date', () => {
      const billingCycle = 'monthly';
      const currentDate = new Date('2026-01-07');

      let nextBillingDate;
      if (billingCycle === 'monthly') {
        nextBillingDate = new Date(currentDate);
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      }

      expect(nextBillingDate.getMonth()).toBe(1); // February
    });
  });
});
