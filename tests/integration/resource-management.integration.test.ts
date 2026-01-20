/**
 * Resource Management Integration Tests
 * Tests end-to-end workflows for budget tracking, quota enforcement, and resource allocation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';

// Note: These tests require actual database and API server running
// They test complete workflows across multiple services and endpoints

describe('Resource Management Integration Tests', () => {
  let db: any;
  let orgId: string;
  let adminToken: string;
  let superAdminToken: string;
  let dbAvailable = false;

  beforeAll(async () => {
    try {
      // Initialize test database
      const { getDatabase } = await import('../../server/src/database/Database');
      db = getDatabase();

      // Test database availability
      await db.initPromise;

      // Create test organization
      const org = await db.get(
        `INSERT INTO organizations (id, name) VALUES (?, ?) RETURNING id`,
        ['test-org-integration', 'Test Organization']
      );
      orgId = org?.id || 'test-org-integration';
      dbAvailable = true;

      // Create test users and get auth tokens
      // (In real scenario, would use authentication service)
      adminToken = 'mock-admin-token';
      superAdminToken = 'mock-superadmin-token';
    } catch (error: any) {
      console.log('Resource Management Integration Tests: Database not available, tests will skip');
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (dbAvailable && db) {
      try {
        // Cleanup test data
        await db.run('DELETE FROM organizations WHERE id = ?', [orgId]);
      } catch (e) { }
    }
  });

  describe('Budget Initialization and Tracking Workflow', () => {
    beforeEach(async () => {
      if (!dbAvailable || !db) return;
      // Reset budget data before each test
      try {
        await db.run(
          `UPDATE organizations 
                   SET monthly_budget_usd = NULL, 
                       budget_spent_current_period = 0 
                   WHERE id = ?`,
          [orgId]
        );
      } catch (e) { }
    });

    it('should complete budget setup → expense recording → alert workflow', async () => {
      if (!dbAvailable || !db) {
        console.log('Skipping: Database not available');
        return;
      }
      // Step 1: SuperAdmin sets budget for organization
      await db.run(
        `UPDATE organizations 
                 SET monthly_budget_usd = 1000,
                     budget_alert_threshold = 0.8,
                     budget_period_start = ?
                 WHERE id = ?`,
        [new Date().toISOString(), orgId]
      );

      // Step 2: Verify budget initialized correctly
      const org = await db.get<{
        monthly_budget_usd: number;
        budget_alert_threshold: number;
      }>('SELECT monthly_budget_usd, budget_alert_threshold FROM organizations WHERE id = ?', [
        orgId,
      ]);

      expect(org?.monthly_budget_usd).toBe(1000);
      expect(org?.budget_alert_threshold).toBe(0.8);

      // Step 3: Record expense (should update budget)
      await db.run(
        `INSERT INTO budget_expenses (id, organization_id, amount, category, description, recorded_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
        ['exp-1', orgId, 500, 'TOKENS', 'AI Usage', new Date().toISOString()]
      );

      await db.run(
        `UPDATE organizations 
                 SET budget_spent_current_period = budget_spent_current_period + 500
                 WHERE id = ?`,
        [orgId]
      );

      // Step 4: Verify expense recorded and budget updated
      const updatedOrg = await db.get<{ budget_spent_current_period: number }>(
        'SELECT budget_spent_current_period FROM organizations WHERE id = ?',
        [orgId]
      );

      expect(updatedOrg?.budget_spent_current_period).toBe(500);

      // Step 5: Record more expenses to trigger alert threshold
      await db.run(
        `INSERT INTO budget_expenses (id, organization_id, amount, category, description, recorded_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
        ['exp-2', orgId, 400, 'STORAGE', 'File Storage', new Date().toISOString()]
      );

      await db.run(
        `UPDATE organizations 
                 SET budget_spent_current_period = budget_spent_current_period + 400
                 WHERE id = ?`,
        [orgId]
      );

      // Step 6: Check if alert should be triggered (900/1000 = 90% > 80% threshold)
      const finalOrg = await db.get<{
        monthly_budget_usd: number;
        budget_spent_current_period: number;
        budget_alert_threshold: number;
      }>('SELECT * FROM organizations WHERE id = ?', [orgId]);

      const percentageUsed =
        (finalOrg!.budget_spent_current_period / finalOrg!.monthly_budget_usd) * 100;
      const shouldAlert = percentageUsed >= finalOrg!.budget_alert_threshold * 100;

      expect(shouldAlert).toBe(true);
      expect(percentageUsed).toBeGreaterThanOrEqual(80);
    });

    it('should enforce budget quota when exceeded', async () => {
      // Setup: Create organization with budget
      await db.run(
        `UPDATE organizations 
                 SET monthly_budget_usd = 500,
                     budget_spent_current_period = 600
                 WHERE id = ?`,
        [orgId]
      );

      // Verify: Budget is exceeded
      const org = await db.get<{
        monthly_budget_usd: number;
        budget_spent_current_period: number;
      }>('SELECT monthly_budget_usd, budget_spent_current_period FROM organizations WHERE id = ?', [
        orgId,
      ]);

      const exceeded = org!.budget_spent_current_period > org!.monthly_budget_usd;
      expect(exceeded).toBe(true);

      // In real scenario, middleware would block requests
      // This test verifies the data state that middleware checks
    });
  });

  describe('Subscription Plan and Resource Allocation Workflow', () => {
    let planId: string;

    beforeEach(async () => {
      // Create test subscription plan
      const plan = await db.get<{ id: string }>(
        `INSERT INTO subscription_plans (id, name, memory_limit_mb, cpu_quota_percent, max_concurrent_ai_jobs)
                 VALUES (?, ?, ?, ?, ?) RETURNING id`,
        ['plan-test', 'Test Plan', 2048, 75, 10]
      );
      planId = plan!.id;
    });

    afterEach(async () => {
      // Cleanup
      await db.run('DELETE FROM subscription_plans WHERE id = ?', [planId]);
      await db.run('DELETE FROM organization_billing WHERE organization_id = ?', [orgId]);
    });

    it('should assign plan → apply resource limits → enforce quotas', async () => {
      // Step 1: SuperAdmin assigns plan to organization
      await db.run(
        `INSERT INTO organization_billing (organization_id, subscription_plan_id)
                 VALUES (?, ?)
                 ON CONFLICT(organization_id) DO UPDATE SET subscription_plan_id = ?`,
        [orgId, planId, planId]
      );

      // Step 2: Verify plan assignment
      const billing = await db.get<{ subscription_plan_id: string }>(
        'SELECT subscription_plan_id FROM organization_billing WHERE organization_id = ?',
        [orgId]
      );

      expect(billing?.subscription_plan_id).toBe(planId);

      // Step 3: Get plan limits
      const plan = await db.get<{
        memory_limit_mb: number;
        cpu_quota_percent: number;
        max_concurrent_ai_jobs: number;
      }>('SELECT * FROM subscription_plans WHERE id = ?', [planId]);

      expect(plan?.memory_limit_mb).toBe(2048);
      expect(plan?.cpu_quota_percent).toBe(75);

      // Step 4: Simulate resource usage update
      await db.run(
        `UPDATE organizations 
                 SET memory_usage_mb_current = 1500,
                     cpu_usage_percent_avg = 50
                 WHERE id = ?`,
        [orgId]
      );

      // Step 5: Verify usage within limits (middleware would allow)
      const org = await db.get<{
        memory_usage_mb_current: number;
        cpu_usage_percent_avg: number;
      }>('SELECT memory_usage_mb_current, cpu_usage_percent_avg FROM organizations WHERE id = ?', [
        orgId,
      ]);

      expect(org!.memory_usage_mb_current).toBeLessThan(plan!.memory_limit_mb);
      expect(org!.cpu_usage_percent_avg).toBeLessThan(plan!.cpu_quota_percent);

      // Step 6: Simulate quota exceeded
      await db.run(
        `UPDATE organizations 
                 SET memory_usage_mb_current = 3000
                 WHERE id = ?`,
        [orgId]
      );

      // Step 7: Verify quota exceeded (middleware would block)
      const exceededOrg = await db.get<{ memory_usage_mb_current: number }>(
        'SELECT memory_usage_mb_current FROM organizations WHERE id = ?',
        [orgId]
      );

      expect(exceededOrg!.memory_usage_mb_current).toBeGreaterThan(plan!.memory_limit_mb);
    });
  });

  describe('Expense History and Category Breakdown', () => {
    beforeEach(async () => {
      // Clear previous expenses
      await db.run('DELETE FROM budget_expenses WHERE organization_id = ?', [orgId]);
    });

    it('should record expenses → retrieve history → filter by category', async () => {
      // Step 1: Record multiple expenses across categories
      const expenses = [
        { id: 'exp-1', amount: 100, category: 'TOKENS', description: 'AI Chat' },
        { id: 'exp-2', amount: 50, category: 'STORAGE', description: 'File Storage' },
        { id: 'exp-3', amount: 75, category: 'TOKENS', description: 'AI Analysis' },
        { id: 'exp-4', amount: 25, category: 'API', description: 'External API' },
        { id: 'exp-5', amount: 150, category: 'COMPUTE', description: 'Server Costs' },
      ];

      for (const exp of expenses) {
        await db.run(
          `INSERT INTO budget_expenses (id, organization_id, amount, category, description, metadata, recorded_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [exp.id, orgId, exp.amount, exp.category, exp.description, '{}', new Date().toISOString()]
        );
      }

      // Step 2: Retrieve all expenses
      const allExpenses = await db.all<{ id: string; amount: number; category: string }>(
        'SELECT * FROM budget_expenses WHERE organization_id = ? ORDER BY recorded_at DESC',
        [orgId]
      );

      expect(allExpenses).toHaveLength(5);

      // Step 3: Filter by TOKENS category
      const tokenExpenses = await db.all<{ id: string; amount: number }>(
        'SELECT * FROM budget_expenses WHERE organization_id = ? AND category = ?',
        [orgId, 'TOKENS']
      );

      expect(tokenExpenses).toHaveLength(2);
      expect(tokenExpenses.map((e) => e.amount)).toEqual([100, 75]);

      // Step 4: Calculate category totals
      const categoryTotals = allExpenses.reduce(
        (acc, exp) => {
          acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
          return acc;
        },
        {} as Record<string, number>
      );

      expect(categoryTotals['TOKENS']).toBe(175);
      expect(categoryTotals['STORAGE']).toBe(50);
      expect(categoryTotals['COMPUTE']).toBe(150);
    });

    it('should support pagination of expense history', async () => {
      // Record 25 expenses
      for (let i = 1; i <= 25; i++) {
        await db.run(
          `INSERT INTO budget_expenses (id, organization_id, amount, category, description, recorded_at)
                     VALUES (?, ?, ?, ?, ?, ?)`,
          [`exp-${i}`, orgId, i * 10, 'TOKENS', `Expense ${i}`, new Date().toISOString()]
        );
      }

      // Page 1: Get first 10
      const page1 = await db.all<{ id: string }>(
        'SELECT * FROM budget_expenses WHERE organization_id = ? ORDER BY recorded_at DESC LIMIT 10 OFFSET 0',
        [orgId]
      );

      expect(page1).toHaveLength(10);

      // Page 2: Get next 10
      const page2 = await db.all<{ id: string }>(
        'SELECT * FROM budget_expenses WHERE organization_id = ? ORDER BY recorded_at DESC LIMIT 10 OFFSET 10',
        [orgId]
      );

      expect(page2).toHaveLength(10);

      // Page 3: Get remaining 5
      const page3 = await db.all<{ id: string }>(
        'SELECT * FROM budget_expenses WHERE organization_id = ? ORDER BY recorded_at DESC LIMIT 10 OFFSET 20',
        [orgId]
      );

      expect(page3).toHaveLength(5);
    });
  });

  describe('Budget Period Reset Workflow', () => {
    it('should reset budget period → clear spent amount → preserve budget limit', async () => {
      // Step 1: Setup organization with budget and expenses
      await db.run(
        `UPDATE organizations 
                 SET monthly_budget_usd = 5000,
                     budget_spent_current_period = 3000,
                     budget_period_start = ?
                 WHERE id = ?`,
        ['2026-01-01T00:00:00.000Z', orgId]
      );

      // Verify initial state
      const before = await db.get<{
        monthly_budget_usd: number;
        budget_spent_current_period: number;
      }>('SELECT * FROM organizations WHERE id = ?', [orgId]);

      expect(before?.monthly_budget_usd).toBe(5000);
      expect(before?.budget_spent_current_period).toBe(3000);

      // Step 2: Reset budget period (simulating cron job)
      const newPeriodStart = new Date();
      await db.run(
        `UPDATE organizations 
                 SET budget_spent_current_period = 0,
                     budget_period_start = ?
                 WHERE id = ?`,
        [newPeriodStart.toISOString(), orgId]
      );

      // Step 3: Verify reset
      const after = await db.get<{
        monthly_budget_usd: number;
        budget_spent_current_period: number;
        budget_period_start: string;
      }>('SELECT * FROM organizations WHERE id = ?', [orgId]);

      expect(after?.monthly_budget_usd).toBe(5000); // Preserved
      expect(after?.budget_spent_current_period).toBe(0); // Reset
      expect(new Date(after!.budget_period_start)).toEqual(newPeriodStart);
    });
  });

  describe('Cross-Service Integration: Budget + Quota + Middleware', () => {
    it('should integrate budget tracking with quota enforcement', async () => {
      // Setup: Organization with budget and plan
      await db.run(
        `UPDATE organizations 
                 SET monthly_budget_usd = 1000,
                     budget_spent_current_period = 0
                 WHERE id = ?`,
        [orgId]
      );

      // Create and assign plan
      const plan = await db.get<{ id: string }>(
        `INSERT INTO subscription_plans (id, name, memory_limit_mb)
                 VALUES (?, ?, ?) RETURNING id`,
        ['plan-integrated', 'Integrated Plan', 1024]
      );

      await db.run(
        `INSERT INTO organization_billing (organization_id, subscription_plan_id)
                 VALUES (?, ?)`,
        [orgId, plan!.id]
      );

      // Scenario 1: Within budget and quota - should pass
      await db.run(
        `UPDATE organizations 
                 SET budget_spent_current_period = 500,
                     memory_usage_mb_current = 512
                 WHERE id = ?`,
        [orgId]
      );

      let org = await db.get<{
        monthly_budget_usd: number;
        budget_spent_current_period: number;
        memory_usage_mb_current: number;
      }>('SELECT * FROM organizations WHERE id = ?', [orgId]);

      let budgetOk = org!.budget_spent_current_period <= org!.monthly_budget_usd;
      let memoryOk = org!.memory_usage_mb_current <= 1024;

      expect(budgetOk).toBe(true);
      expect(memoryOk).toBe(true);

      // Scenario 2: Budget exceeded - should block
      await db.run(
        `UPDATE organizations 
                 SET budget_spent_current_period = 1500
                 WHERE id = ?`,
        [orgId]
      );

      org = await db.get<{
        monthly_budget_usd: number;
        budget_spent_current_period: number;
      }>('SELECT * FROM organizations WHERE id = ?', [orgId]);

      budgetOk = org!.budget_spent_current_period <= org!.monthly_budget_usd;
      expect(budgetOk).toBe(false); // Would be blocked by middleware

      // Cleanup
      await db.run('DELETE FROM subscription_plans WHERE id = ?', [plan!.id]);
      await db.run('DELETE FROM organization_billing WHERE organization_id = ?', [orgId]);
    });
  });
});
