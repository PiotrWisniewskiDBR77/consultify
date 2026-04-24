/**
 * SuperAdmin Billing Operations (T109)
 * Guardrails + reason + audit for billing admin actions.
 */
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { DEFAULT_PAID_LIMITS } from '../access/AccessTypes.js';

export interface BillingAdminAction {
  action: string;
  organizationId: string;
  performedBy: string;
  reason: string;
  details?: Record<string, unknown>;
}

export interface ManualContractInput {
  organizationId: string;
  subscriptionPlanId: string;
  contractType?: string;
  billingRail?: 'manual_invoice' | 'hybrid_usage_invoice';
  contractStatus?: 'active' | 'renewal_due' | 'grace' | 'suspended' | 'expired' | 'canceled';
  startAt?: string | null;
  renewalAt?: string | null;
  graceUntil?: string | null;
  accessExpiresAt?: string | null;
  billingEmail?: string | null;
  externalInvoiceRef?: string | null;
  notes?: string | null;
  managedByUserId?: string | null;
  limitsOverride?: {
    maxProjects?: number | null;
    maxUsers?: number | null;
    maxAICallsPerDay?: number | null;
    maxInitiatives?: number | null;
    maxStorageMb?: number | null;
    maxTotalTokens?: number | null;
    aiRolesEnabled?: string[] | null;
  } | null;
}

function normalizeLimitNumber(value: unknown, fallback: number): number {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    const next = value.map((item) => String(item).trim()).filter(Boolean);
    return next.length > 0 ? next : fallback;
  }
  if (typeof value === 'string') {
    const next = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return next.length > 0 ? next : fallback;
  }
  return fallback;
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
    const { default: dunningService } = await import('../dunningService.js');
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

export async function upsertManualContract(
  input: ManualContractInput,
  performedBy: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  if (!reason || reason.trim().length < 5) {
    return { success: false, message: 'Reason is required (min 5 chars)' };
  }
  if (!input.organizationId || !input.subscriptionPlanId) {
    return { success: false, message: 'organizationId and subscriptionPlanId are required' };
  }

  const org = (await dbGet(`SELECT id, name FROM organizations WHERE id = ? LIMIT 1`, [
    input.organizationId,
  ])) as { id?: string; name?: string } | undefined;
  if (!org?.id) {
    return { success: false, message: 'Organization not found' };
  }

  const plan = (await dbGet(
    `SELECT id, name, limits, token_limit, storage_limit_gb FROM subscription_plans WHERE id = ? LIMIT 1`,
    [input.subscriptionPlanId]
  )) as
    | {
        id?: string;
        name?: string;
        limits?: string | null;
        token_limit?: number | null;
        storage_limit_gb?: number | null;
      }
    | undefined;
  if (!plan?.id) {
    return { success: false, message: 'Subscription plan not found' };
  }

  const billingRail = input.billingRail || 'manual_invoice';
  const contractStatus = input.contractStatus || 'active';
  const startAt = input.startAt || new Date().toISOString();
  const parsedPlanLimits = (() => {
    try {
      return plan.limits ? JSON.parse(plan.limits) : {};
    } catch {
      return {};
    }
  })();
  const aiRolesEnabled = normalizeStringArray(
    input.limitsOverride?.aiRolesEnabled ?? parsedPlanLimits.aiRolesEnabled,
    JSON.parse(DEFAULT_PAID_LIMITS.ai_roles_enabled_json)
  );
  const resolvedLimits = {
    maxProjects: normalizeLimitNumber(
      input.limitsOverride?.maxProjects ??
        parsedPlanLimits.maxProjects ??
        parsedPlanLimits.max_projects,
      DEFAULT_PAID_LIMITS.max_projects
    ),
    maxUsers: normalizeLimitNumber(
      input.limitsOverride?.maxUsers ?? parsedPlanLimits.maxUsers ?? parsedPlanLimits.max_users,
      DEFAULT_PAID_LIMITS.max_users
    ),
    maxAICallsPerDay: normalizeLimitNumber(
      input.limitsOverride?.maxAICallsPerDay ??
        parsedPlanLimits.maxAICallsPerDay ??
        parsedPlanLimits.max_ai_calls_per_day,
      DEFAULT_PAID_LIMITS.max_ai_calls_per_day
    ),
    maxInitiatives: normalizeLimitNumber(
      input.limitsOverride?.maxInitiatives ??
        parsedPlanLimits.maxInitiatives ??
        parsedPlanLimits.max_initiatives,
      DEFAULT_PAID_LIMITS.max_initiatives
    ),
    maxStorageMb: normalizeLimitNumber(
      input.limitsOverride?.maxStorageMb ??
        (typeof parsedPlanLimits.storage_gb === 'number'
          ? Math.round(parsedPlanLimits.storage_gb * 1024)
          : null) ??
        (typeof plan.storage_limit_gb === 'number'
          ? Math.round(plan.storage_limit_gb * 1024)
          : null),
      DEFAULT_PAID_LIMITS.max_storage_mb
    ),
    maxTotalTokens: normalizeLimitNumber(
      input.limitsOverride?.maxTotalTokens ??
        parsedPlanLimits.tokens ??
        parsedPlanLimits.maxTotalTokens ??
        parsedPlanLimits.max_total_tokens ??
        plan.token_limit,
      DEFAULT_PAID_LIMITS.max_total_tokens
    ),
    aiRolesEnabled,
  };

  try {
    await dbRun(
      `INSERT INTO organization_billing (
         id, organization_id, subscription_plan_id, billing_rail, contract_status, contract_type,
         current_period_start, renewal_at, grace_until, access_expires_at, billing_email,
         external_invoice_ref, notes, managed_by_user_id, is_manual_override, status, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))
       ON CONFLICT(organization_id) DO UPDATE SET
         subscription_plan_id = excluded.subscription_plan_id,
         billing_rail = excluded.billing_rail,
         contract_status = excluded.contract_status,
         contract_type = excluded.contract_type,
         current_period_start = COALESCE(excluded.current_period_start, organization_billing.current_period_start),
         renewal_at = excluded.renewal_at,
         grace_until = excluded.grace_until,
         access_expires_at = excluded.access_expires_at,
         billing_email = COALESCE(excluded.billing_email, organization_billing.billing_email),
         external_invoice_ref = excluded.external_invoice_ref,
         notes = excluded.notes,
         managed_by_user_id = COALESCE(excluded.managed_by_user_id, organization_billing.managed_by_user_id),
         is_manual_override = 1,
         status = excluded.status,
         updated_at = datetime('now')`,
      [
        `billing_manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        input.organizationId,
        input.subscriptionPlanId,
        billingRail,
        contractStatus,
        input.contractType || 'invoice',
        startAt,
        input.renewalAt || null,
        input.graceUntil || null,
        input.accessExpiresAt || null,
        input.billingEmail || null,
        input.externalInvoiceRef || null,
        input.notes || null,
        input.managedByUserId || performedBy,
        contractStatus === 'suspended' ? 'past_due' : 'active',
      ]
    );

    await dbRun(
      `UPDATE organizations
       SET organization_type = 'PAID', status = CASE WHEN ? = 'suspended' THEN 'suspended' ELSE 'active' END, updated_at = datetime('now')
       WHERE id = ?`,
      [contractStatus, input.organizationId]
    );

    await dbRun(
      `INSERT INTO organization_limits (
         id, organization_id, max_projects, max_users, max_ai_calls_per_day,
         max_initiatives, max_storage_mb, max_total_tokens, ai_roles_enabled_json
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(organization_id) DO UPDATE SET
         max_projects = excluded.max_projects,
         max_users = excluded.max_users,
         max_ai_calls_per_day = excluded.max_ai_calls_per_day,
         max_initiatives = excluded.max_initiatives,
         max_storage_mb = excluded.max_storage_mb,
         max_total_tokens = excluded.max_total_tokens,
         ai_roles_enabled_json = excluded.ai_roles_enabled_json`,
      [
        `limit_manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        input.organizationId,
        resolvedLimits.maxProjects,
        resolvedLimits.maxUsers,
        resolvedLimits.maxAICallsPerDay,
        resolvedLimits.maxInitiatives,
        resolvedLimits.maxStorageMb,
        resolvedLimits.maxTotalTokens,
        JSON.stringify(resolvedLimits.aiRolesEnabled),
      ]
    );

    await logBillingAdminAction({
      action: 'manual_contract_upserted',
      organizationId: input.organizationId,
      performedBy,
      reason,
      details: {
        planId: input.subscriptionPlanId,
        planName: plan.name,
        billingRail,
        contractStatus,
        renewalAt: input.renewalAt || null,
        limits: resolvedLimits,
      },
    });

    return {
      success: true,
      message: `Manual contract updated for ${org.name || input.organizationId}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[BillingAdminOps] upsertManualContract failed: ${msg}`);
    return { success: false, message: msg };
  }
}

export async function listManagedContracts(): Promise<Record<string, unknown>[]> {
  const all = (await dbAll(
    `SELECT ob.organization_id, o.name as organization_name, ob.subscription_plan_id, sp.name as plan_name,
            ob.billing_rail, ob.contract_status, ob.contract_type, ob.renewal_at, ob.grace_until,
            ob.access_expires_at, ob.external_invoice_ref, ob.notes, ob.managed_by_user_id,
            ob.billing_email, ob.status, ob.updated_at,
            ol.max_projects, ol.max_users, ol.max_ai_calls_per_day, ol.max_initiatives,
            ol.max_storage_mb, ol.max_total_tokens, ol.ai_roles_enabled_json
     FROM organization_billing ob
     LEFT JOIN organizations o ON o.id = ob.organization_id
     LEFT JOIN subscription_plans sp ON sp.id = ob.subscription_plan_id
     LEFT JOIN organization_limits ol ON ol.organization_id = ob.organization_id
     WHERE ob.billing_rail IN ('manual_invoice','hybrid_usage_invoice')
     ORDER BY COALESCE(ob.renewal_at, ob.updated_at) ASC`,
    []
  )) as Record<string, unknown>[];
  return all || [];
}

export default {
  logBillingAdminAction,
  changePlanWithGuardrails,
  grantGracePeriod,
  getBillingOverview,
  upsertManualContract,
  listManagedContracts,
};
