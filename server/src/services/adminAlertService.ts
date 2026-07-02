/**
 * Admin Alert Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/services/adminAlertService.js (CommonJS) to TypeScript (ES Modules)
 * Handles advanced alerting for billing anomalies, cost spikes, and budget issues
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

type AlertType = 'cost_spike' | 'usage_anomaly' | 'budget_exceeded' | 'seat_limit_reached';
type Severity = 'low' | 'medium' | 'high' | 'critical';
type AlertFrequency = 'once' | 'daily' | 'weekly' | 'monthly';

interface AlertConfig {
  alertType: AlertType;
  severity?: Severity;
  costThresholdUsd?: number | null;
  usageThresholdPercent?: number | null;
  seatThresholdPercent?: number | null;
  notifyAdmins?: boolean;
  notifyBillingContact?: boolean;
  notifySuperadmin?: boolean;
  emailEnabled?: boolean;
  slackWebhookUrl?: string | null;
  webhookUrl?: string | null;
  alertFrequency?: AlertFrequency;
  cooldownHours?: number;
  isActive?: boolean;
}

interface AdminAlert extends AlertConfig {
  id: string;
  organization_id: string;
  trigger_count?: number;
  last_triggered_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface CreateAdminAlertResult {
  id: string;
  alertType: AlertType;
  severity: Severity;
  costThresholdUsd?: number | null;
  usageThresholdPercent?: number | null;
  seatThresholdPercent?: number | null;
  notifyAdmins: boolean;
  notifyBillingContact: boolean;
  notifySuperadmin: boolean;
  emailEnabled: boolean;
  slackWebhookUrl?: string | null;
  webhookUrl?: string | null;
  alertFrequency: AlertFrequency;
  cooldownHours: number;
  isActive: boolean;
}

interface TriggerAlertsResult {
  triggeredCount: number;
  alerts: AdminAlert[];
}

interface TriggerAlertResult {
  triggered: boolean;
  alertId: string;
}

interface SendAlertResult {
  sent: boolean;
}

interface UpdateCooldownResult {
  success: boolean;
}

interface BudgetRow {
  cost_cap_monthly?: number | null;
}

interface CostRow {
  total_cost?: number | null;
}

interface SeatRow {
  seats_used?: number;
  total_seats_available?: number;
}

// ==========================================
// SERVICE
// ==========================================

let db: IDatabase = getDatabase();

/**
 * Set database instance (for testing)
 */
export function setDependencies(newDeps: { db?: IDatabase } = {}): void {
  if (newDeps.db) {
    db = newDeps.db;
  }
}

/**
 * Create admin alert configuration
 */
export async function createAdminAlert(
  orgId: string,
  alertConfig: AlertConfig
): Promise<CreateAdminAlertResult> {
  const id = `alert-${uuidv4()}`;

  await DbPromise.run(
    db,
    `INSERT INTO admin_billing_alerts(
            id, organization_id, alert_type, severity, cost_threshold_usd,
            usage_threshold_percent, seat_threshold_percent, notify_admins,
            notify_billing_contact, notify_superadmin, email_enabled,
            slack_webhook_url, webhook_url, alert_frequency, cooldown_hours, is_active
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      orgId,
      alertConfig.alertType,
      alertConfig.severity || 'medium',
      alertConfig.costThresholdUsd || null,
      alertConfig.usageThresholdPercent || null,
      alertConfig.seatThresholdPercent || null,
      alertConfig.notifyAdmins !== false ? 1 : 0,
      alertConfig.notifyBillingContact !== false ? 1 : 0,
      alertConfig.notifySuperadmin ? 1 : 0,
      alertConfig.emailEnabled !== false ? 1 : 0,
      alertConfig.slackWebhookUrl || null,
      alertConfig.webhookUrl || null,
      alertConfig.alertFrequency || 'once',
      alertConfig.cooldownHours || 24,
      alertConfig.isActive !== false ? 1 : 0,
    ]
  );

  return {
    id,
    ...alertConfig,
    severity: alertConfig.severity || 'medium',
    notifyAdmins: alertConfig.notifyAdmins !== false,
    notifyBillingContact: alertConfig.notifyBillingContact !== false,
    notifySuperadmin: alertConfig.notifySuperadmin || false,
    emailEnabled: alertConfig.emailEnabled !== false,
    alertFrequency: alertConfig.alertFrequency || 'once',
    cooldownHours: alertConfig.cooldownHours || 24,
    isActive: alertConfig.isActive !== false,
  };
}

/**
 * Check and trigger alerts
 */
export async function checkAndTriggerAlerts(orgId: string): Promise<TriggerAlertsResult> {
  // Get all active alerts for organization
  const alerts = await DbPromise.all<AdminAlert>(
    db,
    `SELECT * FROM admin_billing_alerts WHERE organization_id = ? AND is_active = 1`,
    [orgId]
  );

  const triggeredAlerts: AdminAlert[] = [];

  await Promise.all(
    alerts.map(async (alert) => {
      const shouldTrigger = await checkAlert(alert);
      if (shouldTrigger) {
        await triggerAlert(alert.id);
        triggeredAlerts.push(alert);
      }
    })
  );

  return {
    triggeredCount: triggeredAlerts.length,
    alerts: triggeredAlerts,
  };
}

/**
 * Check if an alert should be triggered
 */
async function checkAlert(alert: AdminAlert): Promise<boolean> {
  const now = new Date();
  const lastTriggered = alert.last_triggered_at ? new Date(alert.last_triggered_at) : null;
  const cooldownMs = (alert.cooldownHours || 24) * 60 * 60 * 1000;

  // Check cooldown
  if (lastTriggered && now.getTime() - lastTriggered.getTime() < cooldownMs) {
    return false;
  }

  // Check alert type and conditions
  switch (alert.alertType) {
    case 'cost_spike':
      return await checkCostSpike(alert);
    case 'usage_anomaly':
      return await checkUsageAnomaly(alert);
    case 'budget_exceeded':
      return await checkBudgetExceeded(alert);
    case 'seat_limit_reached':
      return await checkSeatLimit(alert);
    default:
      return false;
  }
}

/**
 * Check for cost spike
 */
async function checkCostSpike(alert: AdminAlert): Promise<boolean> {
  if (!alert.costThresholdUsd) {
    return false;
  }

  // Get current period cost
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const row = await DbPromise.get<CostRow>(
    db,
    `SELECT SUM(total_cost) as total_cost
         FROM pay_as_you_go_usage
         WHERE organization_id = ?
           AND billing_period_start >= ?
           AND invoiced = 0`,
    [alert.organization_id, periodStart.toISOString()]
  );

  const currentCost = row?.total_cost || 0;
  return currentCost >= (alert.costThresholdUsd || 0);
}

/**
 * Check for usage anomaly
 */
async function checkUsageAnomaly(alert: AdminAlert): Promise<boolean> {
  if (!alert.usageThresholdPercent) {
    return false;
  }

  // Get current usage vs previous period
  const now = new Date();
  const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [currentCostRow, previousCostRow] = await Promise.all([
    DbPromise.get<CostRow>(
      db,
      `SELECT SUM(total_cost) as total_cost
             FROM pay_as_you_go_usage
             WHERE organization_id = ?
               AND billing_period_start >= ?`,
      [alert.organization_id, currentPeriodStart.toISOString()]
    ),
    DbPromise.get<CostRow>(
      db,
      `SELECT SUM(total_cost) as total_cost
             FROM pay_as_you_go_usage
             WHERE organization_id = ?
               AND billing_period_start >= ?
               AND billing_period_end <= ?`,
      [alert.organization_id, previousPeriodStart.toISOString(), previousPeriodEnd.toISOString()]
    ),
  ]);

  const currentCost = currentCostRow?.total_cost || 0;
  const previousCost = previousCostRow?.total_cost || 0;

  if (previousCost === 0) {
    return false;
  }

  const increasePercent = ((currentCost - previousCost) / previousCost) * 100;
  return increasePercent >= (alert.usageThresholdPercent || 0);
}

/**
 * Check if budget exceeded
 */
async function checkBudgetExceeded(alert: AdminAlert): Promise<boolean> {
  // Check org budget
  const budget = await DbPromise.get<BudgetRow>(
    db,
    `SELECT cost_cap_monthly FROM billing_alerts WHERE organization_id = ?`,
    [alert.organization_id]
  );

  if (!budget || !budget.cost_cap_monthly) {
    return false;
  }

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const row = await DbPromise.get<CostRow>(
    db,
    `SELECT SUM(total_cost) as total_cost
         FROM pay_as_you_go_usage
         WHERE organization_id = ?
           AND billing_period_start >= ?
           AND invoiced = 0`,
    [alert.organization_id, periodStart.toISOString()]
  );

  const currentCost = row?.total_cost || 0;
  return currentCost >= (budget.cost_cap_monthly || 0);
}

/**
 * Check if seat limit reached
 */
async function checkSeatLimit(alert: AdminAlert): Promise<boolean> {
  if (!alert.seatThresholdPercent) {
    return false;
  }

  const row = await DbPromise.get<SeatRow>(
    db,
    `SELECT seats_used, total_seats_available FROM organization_seats WHERE organization_id = ?`,
    [alert.organization_id]
  );

  if (!row || !row.total_seats_available || row.total_seats_available === 0) {
    return false;
  }

  const utilizationPercent = ((row.seats_used || 0) / row.total_seats_available) * 100;
  return utilizationPercent >= (alert.seatThresholdPercent || 0);
}

/**
 * Trigger an alert
 */
export async function triggerAlert(alertId: string): Promise<TriggerAlertResult> {
  // Get alert details
  const alert = await DbPromise.get<AdminAlert>(
    db,
    `SELECT * FROM admin_billing_alerts WHERE id = ?`,
    [alertId]
  );

  if (!alert) {
    throw new Error(`Alert ${alertId} not found`);
  }

  // Update trigger count and last triggered
  await DbPromise.run(
    db,
    `UPDATE admin_billing_alerts SET
            trigger_count = trigger_count + 1,
            last_triggered_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?`,
    [alertId]
  );

  // Send alert via configured channels
  await sendAlert(alert);

  return { triggered: true, alertId };
}

interface OrgAdminRow {
  id: string;
}

/**
 * Send alert via configured channels.
 *
 * Filar 5 (Slack Command Center): previously a log-only stub. Now emits:
 *  (1) Slack via the central slackRouter (#alerts channel), and
 *  (2) in-app notifications to org admins via NotificationService (when
 *      notify_admins is set), mirroring feedback.routes' escalation pattern.
 * Fully fail-soft: never throws; always returns { sent: true } so trigger
 * bookkeeping is not rolled back by a downstream notification failure.
 */
export async function sendAlert(alert: AdminAlert): Promise<SendAlertResult> {
  logger.info(`[Admin Alert] ${alert.alertType} triggered for org ${alert.organization_id}`);

  const severityMap: Record<Severity, 'INFO' | 'WARNING' | 'CRITICAL'> = {
    low: 'INFO',
    medium: 'WARNING',
    high: 'WARNING',
    critical: 'CRITICAL',
  };
  const severity = severityMap[alert.severity || 'medium'] || 'WARNING';
  const title = `Billing alert: ${alert.alertType}`;
  const body = `Alert "${alert.alertType}" (severity ${alert.severity || 'medium'}) triggered for organization ${alert.organization_id}.`;

  // (1) Slack — central router, fail-soft.
  try {
    const { routeToSlack } = await import('./slack/slackRouter.js');
    await routeToSlack({
      channel: 'alerts',
      severity,
      title,
      text: `*${title}*\n${body}`,
      dedupeKey: `admin-alert:${alert.id}:${alert.alertType}`,
    });
  } catch (err) {
    logger.warn(
      '[AdminAlertService] Slack routing failed (fail-soft):',
      err instanceof Error ? err.message : String(err)
    );
  }

  // (2) In-app notifications to org admins, mirroring feedback.routes pattern.
  if (alert.notifyAdmins !== false && alert.organization_id) {
    try {
      const { default: NotificationService } = await import('./notificationService.js');
      const admins = await DbPromise.all<OrgAdminRow>(
        db,
        `SELECT id FROM users
          WHERE organization_id = ?
            AND lower(coalesce(role, '')) IN ('admin', 'owner', 'org_admin', 'superadmin', 'super_admin')`,
        [alert.organization_id]
      );

      await Promise.allSettled(
        (admins || []).map((admin) =>
          NotificationService.send({
            userId: String(admin.id),
            organizationId: alert.organization_id,
            type: 'AI_RISK',
            severity,
            title,
            body,
            message: body,
            relatedObjectType: 'BILLING_ALERT',
            relatedObjectId: alert.id,
            isActionable: false,
            channels: ['in_app'],
            bypassPreferences: true,
            bypassQuietHours: true,
          })
        )
      );
    } catch (err) {
      logger.warn(
        '[AdminAlertService] In-app notification failed (fail-soft):',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  return { sent: true };
}

/**
 * Get alert history
 */
export async function getAlertHistory(orgId: string, limit: number = 50): Promise<AdminAlert[]> {
  const rows = await DbPromise.all<AdminAlert>(
    db,
    `SELECT * FROM admin_billing_alerts
         WHERE organization_id = ?
         ORDER BY last_triggered_at DESC, created_at DESC
         LIMIT ?`,
    [orgId, limit]
  );

  return rows || [];
}

/**
 * Update alert cooldown
 */
export async function updateAlertCooldown(
  alertId: string,
  cooldownHours: number
): Promise<UpdateCooldownResult> {
  await DbPromise.run(
    db,
    `UPDATE admin_billing_alerts SET
            cooldown_hours = ?,
            updated_at = datetime('now')
        WHERE id = ?`,
    [cooldownHours, alertId]
  );

  return { success: true };
}

// Default export for backward compatibility
const adminAlertService = {
  setDependencies,
  createAdminAlert,
  checkAndTriggerAlerts,
  sendAlert,
  getAlertHistory,
  updateAlertCooldown,
};

export default adminAlertService;
