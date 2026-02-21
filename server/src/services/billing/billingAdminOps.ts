/**
 * SuperAdmin Billing Operations (T109)
 * Guardrails + reason + audit for billing admin actions.
 */
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export interface BillingAdminAction {
  action: string;
  organizationId: string;
  performedBy: string;
  reason: string;
  details?: Record<string, unknown>;
}

export async function logBillingAdminAction(entry: BillingAdminAction): Promise<void> {
  try {
    await dbRun(
      `INSERT INTO billing_admin_audit_log (id, action, organization_id, performed_by, reason, details_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        `baa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        entry.action,
        entry.organizationId,
        entry.performedBy,
        entry.reason,
        JSON.stringify(entry.details || {}),
      ]
    );
  } catch {
    logger.warn('[BillingAdminOps] Failed to log audit — table may not exist yet');
  }
}

export async function changePlanWithGuardrails(
  organizationId: string,
  newPlanId: string,
  performedBy: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  if (!reason || reason.trim().length < 5) {
    return { success: false, message: 'Reason is required (min 5 chars)' };
  }

  const current = (await dbGet(
    `SELECT subscription_plan_id, status FROM organization_billing WHERE organization_id = ? LIMIT 1`,
    [organizationId]
  )) as { subscription_plan_id?: string; status?: string } | undefined;

  const fromPlan = current?.subscription_plan_id || 'none';

  const plan = (await dbGet(`SELECT id, name FROM subscription_plans WHERE id = ? LIMIT 1`, [
    newPlanId,
  ])) as { id: string; name: string } | undefined;

  if (!plan) {
    return { success: false, message: `Plan ${newPlanId} not found` };
  }

  try {
    let changed = false;
    try {
      const billingModule = await import('../BillingService.js');
      if (billingModule.changePlan) {
        await billingModule.changePlan(organizationId, newPlanId);
        changed = true;
      }
    } catch {
      // BillingService may not be available
    }
    if (!changed) {
      await dbRun(
        `UPDATE organization_billing SET subscription_plan_id = ?, updated_at = datetime('now') WHERE organization_id = ?`,
        [newPlanId, organizationId]
      );
    }

    await logBillingAdminAction({
      action: 'change_plan',
      organizationId,
      performedBy,
      reason,
      details: { fromPlan, toPlan: newPlanId, planName: plan.name },
    });

    logger.info(
      `[BillingAdminOps] Plan changed for org ${organizationId}: ${fromPlan} → ${newPlanId} by ${performedBy}`
    );
    return { success: true, message: `Plan changed to ${plan.name}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[BillingAdminOps] changePlan failed: ${msg}`);
    return { success: false, message: msg };
  }
}

export async function grantGracePeriod(
  organizationId: string,
  days: number,
  performedBy: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  if (!reason || reason.trim().length < 5) {
    return { success: false, message: 'Reason is required (min 5 chars)' };
  }
  if (days < 1 || days > 90) {
    return { success: false, message: 'Grace period must be 1-90 days' };
  }

  try {
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
    await dbRun(
      `UPDATE organization_billing SET grace_period_ends_at = ?, updated_at = datetime('now') WHERE organization_id = ?`,
      [expiresAt, organizationId]
    );

    await logBillingAdminAction({
      action: 'grant_grace_period',
      organizationId,
      performedBy,
      reason,
      details: { days, expiresAt },
    });

    return { success: true, message: `Grace period of ${days} days granted` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}

export async function getBillingOverview(organizationId: string): Promise<Record<string, unknown>> {
  const billing = (await dbGet(
    `SELECT * FROM organization_billing WHERE organization_id = ? LIMIT 1`,
    [organizationId]
  )) as Record<string, unknown> | undefined;

  const plan = billing?.subscription_plan_id
    ? ((await dbGet(
        `SELECT id, name, price_monthly, price_yearly FROM subscription_plans WHERE id = ?`,
        [billing.subscription_plan_id]
      )) as Record<string, unknown> | undefined)
    : null;

  let dunningStatus = null;
  try {
    const dunningModule = await import('../dunningService.js');
    const dunningService = dunningModule.default || dunningModule;
    if (dunningService?.getDunningStatus) {
      dunningStatus = await dunningService.getDunningStatus(organizationId);
    }
  } catch {
    // dunning service may not be available
  }

  return {
    billing: billing || null,
    plan: plan || null,
    dunningStatus,
  };
}

export default {
  logBillingAdminAction,
  changePlanWithGuardrails,
  grantGracePeriod,
  getBillingOverview,
};
