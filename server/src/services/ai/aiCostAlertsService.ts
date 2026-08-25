import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { SlackServiceClass } from '../slackService.js';

type Threshold = 80 | 90 | 100;

function resolveCostSlackWebhookUrl(): string {
  const direct = String(process.env.AI_COST_SLACK_WEBHOOK_URL || '').trim();
  if (direct) return direct;
  // Fallback: send to AI alerts channel if cost-specific channel not set
  const ai = String(process.env.AI_SLACK_WEBHOOK_URL || '').trim();
  if (ai) return ai;
  // Final fallback: default slack webhook
  const envName = String(process.env.APP_ENV || process.env.NODE_ENV || 'development')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
  return (
    String(process.env[`SLACK_WEBHOOK_URL_${envName}`] || '').trim() ||
    String(process.env.SLACK_WEBHOOK_URL || '').trim()
  );
}

async function sendSlackCostAlert(params: {
  orgId: string;
  threshold: Threshold;
  usedUsd: number;
  capUsd: number;
}): Promise<void> {
  try {
    const url = resolveCostSlackWebhookUrl();
    if (!url) return;

    const slack = new SlackServiceClass({ webhookUrl: url });
    const org = await dbGet<{ name: string }>(
      `SELECT name FROM organizations WHERE id = ?`,
      [params.orgId],
      { fallback: true } as any
    );

    await slack.sendSystemAlert(
      `AI Cost budget: ${org?.name || params.orgId}`,
      `Reached ${params.threshold}% of monthly AI budget. Used: $${params.usedUsd.toFixed(2)} / $${params.capUsd.toFixed(2)}.`,
      params.threshold >= 100 ? 'CRITICAL' : 'WARNING'
    );
  } catch (e: any) {
    logger.warn('[AICostAlerts] slack send failed', { error: e?.message || e });
  }
}

async function ensureTables(): Promise<void> {
  try {
    await dbRun(
      `CREATE TABLE IF NOT EXISTS ai_cost_alerts_sent (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        threshold INTEGER NOT NULL,
        period_start TEXT NOT NULL,
        sent_at TEXT NOT NULL,
        UNIQUE(organization_id, threshold, period_start)
      )`,
      [],
      { fallback: true } as any
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_ai_cost_alerts_sent_org_period ON ai_cost_alerts_sent(organization_id, period_start)`,
      [],
      { fallback: true } as any
    );
  } catch {
    /* ignore */
  }
}

function monthStartIso(d = new Date()): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
  return x.toISOString();
}

async function getOrgMonthlyCostCapUsd(orgId: string): Promise<number | null> {
  // Prefer organizations.monthly_budget_usd if present (already used by resourceQuota middleware).
  try {
    const row = await dbGet(
      `SELECT monthly_budget_usd FROM organizations WHERE id = ? LIMIT 1`,
      [orgId],
      { fallback: true } as any
    );
    const v = Number((row as any)?.monthly_budget_usd);
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

async function getOrgMonthToDateCostUsd(orgId: string): Promise<number> {
  try {
    const row = await dbGet(
      `SELECT COALESCE(SUM(estimated_cost_usd), 0) as cost
       FROM ai_usage_logs
       WHERE organization_id = ?
         AND status = 'success'
         AND created_at >= date('now', 'start of month')`,
      [orgId],
      { fallback: true } as any
    );
    const v = Number((row as any)?.cost || 0);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

async function alreadySent(
  orgId: string,
  threshold: Threshold,
  periodStart: string
): Promise<boolean> {
  try {
    const row = await dbGet(
      `SELECT id FROM ai_cost_alerts_sent WHERE organization_id = ? AND threshold = ? AND period_start = ? LIMIT 1`,
      [orgId, threshold, periodStart],
      { fallback: true } as any
    );
    return !!row;
  } catch {
    return false;
  }
}

async function markSent(orgId: string, threshold: Threshold, periodStart: string): Promise<void> {
  try {
    await dbRun(
      `INSERT INTO ai_cost_alerts_sent (id, organization_id, threshold, period_start, sent_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        `cost-alert-${orgId}-${threshold}-${Date.now()}`,
        orgId,
        threshold,
        periodStart,
        new Date().toISOString(),
      ],
      { fallback: true } as any
    );
  } catch {
    /* ignore */
  }
}

/**
 * N2 (DEC-2026-08-25-21): routed through the notification engine instead of
 * a direct EmailService.send() call (notyfikacje-audyt.md §1C). `ai_cost_budget_alert`
 * did not exist in the notification_types registry, so migration 960 adds
 * it with `default_channels: ["email"]` — matching this function's exact
 * prior behavior (admin email only, no in-app row) so the migration itself
 * changes nothing observable; only the redirect below makes preferences
 * start being respected.
 */
async function sendEmailToOrgAdmins(params: {
  orgId: string;
  threshold: Threshold;
  usedUsd: number;
  capUsd: number;
}): Promise<void> {
  try {
    const admins = await dbAll<{ id: string; email: string; first_name: string }>(
      `SELECT id, email, first_name FROM users WHERE organization_id = ? AND role IN ('ADMIN', 'SUPERADMIN')`,
      [params.orgId],
      { fallback: true } as any
    );
    if (!admins?.length) return;
    const org = await dbGet<{ name: string }>(
      `SELECT name FROM organizations WHERE id = ?`,
      [params.orgId],
      { fallback: true } as any
    );

    const { send: sendNotification } = await import('../notificationService.js');
    const title = `⚠️ AI cost budget: ${params.threshold}% reached`;
    const body = `${org?.name || 'Organization'} reached ${params.threshold}% of the monthly AI cost budget (used $${params.usedUsd.toFixed(2)} of $${params.capUsd.toFixed(2)}).`;

    for (const a of admins) {
      await sendNotification({
        userId: a.id,
        organizationId: params.orgId,
        type: 'ai_cost_budget_alert',
        title,
        body,
        priority: params.threshold >= 100 ? 'critical' : params.threshold >= 90 ? 'urgent' : 'high',
        entityType: 'ai_budget',
        dedupe: false,
        data: { threshold: params.threshold, usedUsd: params.usedUsd, capUsd: params.capUsd },
      });
    }
  } catch (e: any) {
    logger.warn('[AICostAlerts] notification send failed', { error: e?.message || e });
  }
}

export async function runAiCostBudgetAlerts(): Promise<{ processed: number; sent: number }> {
  await ensureTables();

  const orgIds = await dbAll<{ id: string }>(`SELECT id FROM organizations`, [], {
    fallback: true,
  } as any);
  const periodStart = monthStartIso();

  let processed = 0;
  let sent = 0;

  for (const o of orgIds || []) {
    const orgId = String(o.id || '').trim();
    if (!orgId) continue;
    processed += 1;

    const capUsd = await getOrgMonthlyCostCapUsd(orgId);
    if (!capUsd) continue;

    const usedUsd = await getOrgMonthToDateCostUsd(orgId);
    const pct = capUsd > 0 ? (usedUsd / capUsd) * 100 : 0;

    const threshold: Threshold | null = pct >= 100 ? 100 : pct >= 90 ? 90 : pct >= 80 ? 80 : null;
    if (!threshold) continue;

    const wasSent = await alreadySent(orgId, threshold, periodStart);
    if (wasSent) continue;

    await markSent(orgId, threshold, periodStart);
    await sendEmailToOrgAdmins({ orgId, threshold, usedUsd, capUsd });
    await sendSlackCostAlert({ orgId, threshold, usedUsd, capUsd });
    sent += 1;
  }

  return { processed, sent };
}

export default { runAiCostBudgetAlerts };
