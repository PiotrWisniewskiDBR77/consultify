/**
 * Resource Management Routes (SuperAdmin)
 * Endpoints for managing subscription plans and organization resources
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireSuperAdmin } from '../middleware/superadmin.middleware.js';
import { getDatabase } from '../database/Database.js';
import { budgetTrackingService } from '../services/budgetTrackingService.js';
import logger from '../utils/Logger.js';

const router = express.Router();
const db = getDatabase();

// ==========================================
// SUBSCRIPTION PLANS MANAGEMENT
// ==========================================

/**
 * GET /api/superadmin/subscription-plans
 * List all subscription plans
 */
router.get('/subscription-plans', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const plans = await db.all(`
            SELECT id, name, price_monthly, token_limit, storage_limit_gb, 
                   memory_limit_mb, cpu_quota_percent, max_concurrent_ai_jobs,
                   token_overage_rate, storage_overage_rate, stripe_price_id, 
                   is_active, created_at
            FROM subscription_plans
            ORDER BY price_monthly ASC
        `);

    res.json({ success: true, plans });
  } catch (error) {
    logger.error('[SuperAdmin] Error fetching subscription plans:', error);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

/**
 * POST /api/superadmin/subscription-plans
 * Create new subscription plan
 */
router.post('/subscription-plans', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const {
      name,
      priceMonthly,
      tokenLimit,
      storageLimitGb,
      memoryLimitMb,
      cpuQuotaPercent,
      maxConcurrentAiJobs,
      tokenOverageRate,
      storageOverageRate,
      stripePriceId,
    } = req.body;

    const id = `plan_${Date.now()}`;

    await db.run(
      `INSERT INTO subscription_plans (
                id, name, price_monthly, token_limit, storage_limit_gb,
                memory_limit_mb, cpu_quota_percent, max_concurrent_ai_jobs,
                token_overage_rate, storage_overage_rate, stripe_price_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        priceMonthly,
        tokenLimit,
        storageLimitGb,
        memoryLimitMb,
        cpuQuotaPercent,
        maxConcurrentAiJobs,
        tokenOverageRate,
        storageOverageRate,
        stripePriceId,
      ]
    );

    logger.info(`[SuperAdmin] Created subscription plan: ${name} (${id})`);

    res.json({ success: true, planId: id });
  } catch (error) {
    logger.error('[SuperAdmin] Error creating subscription plan:', error);
    res.status(500).json({ error: 'Failed to create subscription plan' });
  }
});

/**
 * PUT /api/superadmin/subscription-plans/:id
 * Update subscription plan
 */
router.put('/subscription-plans/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      priceMonthly,
      tokenLimit,
      storageLimitGb,
      memoryLimitMb,
      cpuQuotaPercent,
      maxConcurrentAiJobs,
      tokenOverageRate,
      storageOverageRate,
      stripePriceId,
      isActive,
    } = req.body;

    await db.run(
      `UPDATE subscription_plans 
             SET name = ?, price_monthly = ?, token_limit = ?, storage_limit_gb = ?,
                 memory_limit_mb = ?, cpu_quota_percent = ?, max_concurrent_ai_jobs = ?,
                 token_overage_rate = ?, storage_overage_rate = ?, stripe_price_id = ?,
                 is_active = ?
             WHERE id = ?`,
      [
        name,
        priceMonthly,
        tokenLimit,
        storageLimitGb,
        memoryLimitMb,
        cpuQuotaPercent,
        maxConcurrentAiJobs,
        tokenOverageRate,
        storageOverageRate,
        stripePriceId,
        isActive ? 1 : 0,
        id,
      ]
    );

    logger.info(`[SuperAdmin] Updated subscription plan: ${id}`);

    res.json({ success: true });
  } catch (error) {
    logger.error('[SuperAdmin] Error updating subscription plan:', error);
    res.status(500).json({ error: 'Failed to update subscription plan' });
  }
});

/**
 * DELETE /api/superadmin/subscription-plans/:id
 * Delete subscription plan
 */
router.delete('/subscription-plans/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if any organizations are using this plan
    const usage = await db.get(
      'SELECT COUNT(*) as count FROM organization_billing WHERE subscription_plan_id = ?',
      [id]
    );

    if (usage && usage.count > 0) {
      return res.status(400).json({
        error: 'Cannot delete plan in use',
        organizationsUsing: usage.count,
      });
    }

    await db.run('DELETE FROM subscription_plans WHERE id = ?', [id]);

    logger.info(`[SuperAdmin] Deleted subscription plan: ${id}`);

    res.json({ success: true });
  } catch (error) {
    logger.error('[SuperAdmin] Error deleting subscription plan:', error);
    res.status(500).json({ error: 'Failed to delete subscription plan' });
  }
});

// ==========================================
// ORGANIZATION RESOURCE MANAGEMENT
// ==========================================

/**
 * GET /api/superadmin/organizations/:id/resources
 * Get organization resource usage and limits
 */
router.get(
  '/organizations/:id/resources',
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      const org = await db.get(
        `SELECT o.id, o.name, o.monthly_budget_usd, o.budget_spent_current_period,
                    o.budget_alert_threshold, o.budget_period_start,
                    o.memory_usage_mb_current, o.cpu_usage_percent_avg,
                    o.token_balance, o.billing_status,
                    ob.subscription_plan_id,
                    sp.name as plan_name, sp.memory_limit_mb, sp.cpu_quota_percent,
                    sp.max_concurrent_ai_jobs, sp.token_limit, sp.storage_limit_gb
             FROM organizations o
             LEFT JOIN organization_billing ob ON o.id = ob.organization_id
             LEFT JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
             WHERE o.id = ?`,
        [id]
      );

      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      // Get budget status
      const budgetStatus = await budgetTrackingService.getBudgetStatus(id);

      // Get recent expenses
      const expenses = await budgetTrackingService.getExpenseHistory(id, { limit: 10 });

      res.json({
        success: true,
        organization: org,
        budget: budgetStatus,
        recentExpenses: expenses,
      });
    } catch (error) {
      logger.error('[SuperAdmin] Error fetching organization resources:', error);
      res.status(500).json({ error: 'Failed to fetch organization resources' });
    }
  }
);

/**
 * PUT /api/superadmin/organizations/:id/budget
 * Update organization budget
 */
router.put('/organizations/:id/budget', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { monthlyBudgetUsd, alertThreshold } = req.body;

    await budgetTrackingService.initializeBudget({
      organizationId: id,
      monthlyBudgetUsd,
      alertThreshold,
    });

    logger.info(`[SuperAdmin] Updated budget for org ${id}: $${monthlyBudgetUsd}/month`);

    res.json({ success: true });
  } catch (error) {
    logger.error('[SuperAdmin] Error updating organization budget:', error);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

/**
 * PUT /api/superadmin/organizations/:id/quotas
 * Update organization resource quotas (override plan limits)
 */
router.put('/organizations/:id/quotas', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { memoryLimitMb, cpuQuotaPercent, tokenBalance } = req.body;

    // Update direct organization limits (overrides plan)
    const updates: string[] = [];
    const params: any[] = [];

    if (memoryLimitMb !== undefined) {
      updates.push('memory_limit_mb_override = ?');
      params.push(memoryLimitMb);
    }
    if (cpuQuotaPercent !== undefined) {
      updates.push('cpu_quota_percent_override = ?');
      params.push(cpuQuotaPercent);
    }
    if (tokenBalance !== undefined) {
      updates.push('token_balance = ?');
      params.push(tokenBalance);
    }

    if (updates.length > 0) {
      params.push(id);
      await db.run(`UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    logger.info(`[SuperAdmin] Updated quotas for org ${id}`);

    res.json({ success: true });
  } catch (error) {
    logger.error('[SuperAdmin] Error updating organization quotas:', error);
    res.status(500).json({ error: 'Failed to update quotas' });
  }
});

/**
 * POST /api/superadmin/organizations/:id/charge-resource-change
 * Charge organization for resource limit increase
 */
router.post(
  '/organizations/:id/charge-resource-change',
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { changeType, oldValue, newValue, chargeAmount, description } = req.body;

      // Record the expense
      await budgetTrackingService.recordExpense(id, {
        amount: chargeAmount,
        category: 'OTHER',
        description: `Resource change: ${description}`,
        metadata: {
          changeType,
          oldValue,
          newValue,
          changedBy: req.user?.userId,
          changedAt: new Date().toISOString(),
        },
      });

      // TODO: Create Stripe invoice if needed
      // await createStripeInvoice(id, chargeAmount, description);

      logger.info(
        `[SuperAdmin] Charged org ${id} $${chargeAmount} for resource change: ${description}`
      );

      res.json({ success: true, chargedAmount: chargeAmount });
    } catch (error) {
      logger.error('[SuperAdmin] Error charging for resource change:', error);
      res.status(500).json({ error: 'Failed to charge for resource change' });
    }
  }
);

// ==========================================
// ADMIN ENDPOINTS (Organization-scoped)
// ==========================================

/**
 * GET /api/admin/budget
 * Get current organization's budget status
 */
router.get('/admin/budget', authenticateToken, async (req, res) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(403).json({ error: 'No organization found' });
    }

    const budgetStatus = await budgetTrackingService.getBudgetStatus(orgId);

    res.json({ success: true, budget: budgetStatus });
  } catch (error) {
    logger.error('[Admin] Error fetching budget:', error);
    res.status(500).json({ error: 'Failed to fetch budget' });
  }
});

/**
 * GET /api/admin/budget/expenses
 * Get organization expense history
 */
router.get('/admin/budget/expenses', authenticateToken, async (req, res) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(403).json({ error: 'No organization found' });
    }

    const { limit = 50, offset = 0, category } = req.query;

    const expenses = await budgetTrackingService.getExpenseHistory(orgId, {
      limit: Number(limit),
      offset: Number(offset),
      category: category as string,
    });

    res.json({ success: true, expenses });
  } catch (error) {
    logger.error('[Admin] Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

export default router;
