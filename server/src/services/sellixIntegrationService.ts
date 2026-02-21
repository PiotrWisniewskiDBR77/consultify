import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export interface SellixConfig {
  id: string;
  enabled: boolean;
  thresholdScore: number;
  cooldownHours: number;
  webhookSecret: string | null;
  sellixEndpoint: string | null;
  defaultPathway: string;
  updatedAt: string;
}

export interface OutboundPayload {
  organizationId: string;
  readinessScore: number;
  readinessTier: string;
  algorithmVersion: string;
  topBlockers: string[];
  recommendedNextSteps: string[];
  organizationType: string;
  billingStatus: string;
  pathway: string;
  timestamp: string;
}

export interface InboundSellixEvent {
  eventId: string;
  eventType: string;
  organizationId?: string;
  data?: Record<string, unknown>;
}

export async function getConfig(): Promise<SellixConfig | null> {
  const row: any = await dbGet(`SELECT * FROM sellix_config LIMIT 1`, []);
  if (!row) return null;
  return {
    id: row.id,
    enabled: row.enabled,
    thresholdScore: row.threshold_score,
    cooldownHours: row.cooldown_hours,
    webhookSecret: row.webhook_secret,
    sellixEndpoint: row.sellix_endpoint,
    defaultPathway: row.default_pathway,
    updatedAt: row.updated_at,
  };
}

export async function upsertConfig(
  patch: Partial<Omit<SellixConfig, 'id' | 'updatedAt'>>,
  adminId: string
): Promise<SellixConfig> {
  const existing = await getConfig();
  if (existing) {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (patch.enabled !== undefined) {
      fields.push(`enabled = $${i++}`);
      values.push(patch.enabled);
    }
    if (patch.thresholdScore !== undefined) {
      fields.push(`threshold_score = $${i++}`);
      values.push(patch.thresholdScore);
    }
    if (patch.cooldownHours !== undefined) {
      fields.push(`cooldown_hours = $${i++}`);
      values.push(patch.cooldownHours);
    }
    if (patch.webhookSecret !== undefined) {
      fields.push(`webhook_secret = $${i++}`);
      values.push(patch.webhookSecret);
    }
    if (patch.sellixEndpoint !== undefined) {
      fields.push(`sellix_endpoint = $${i++}`);
      values.push(patch.sellixEndpoint);
    }
    if (patch.defaultPathway !== undefined) {
      fields.push(`default_pathway = $${i++}`);
      values.push(patch.defaultPathway);
    }
    fields.push(`updated_by = $${i++}`);
    values.push(adminId);
    fields.push(`updated_at = NOW()`);
    values.push(existing.id);
    await dbRun(`UPDATE sellix_config SET ${fields.join(', ')} WHERE id = $${i}`, values);
  } else {
    await dbRun(
      `INSERT INTO sellix_config (id, enabled, threshold_score, cooldown_hours, webhook_secret, sellix_endpoint, default_pathway, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        uuidv4(),
        patch.enabled ?? false,
        patch.thresholdScore ?? 80,
        patch.cooldownHours ?? 24,
        patch.webhookSecret ?? null,
        patch.sellixEndpoint ?? null,
        patch.defaultPathway ?? 'TRIAL_UPGRADE_EMAIL_1',
        adminId,
      ]
    );
  }
  return (await getConfig())!;
}

export function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = signPayload(payload, secret);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function sendReadinessSignal(
  orgId: string,
  score: number,
  tier: string,
  blockers: string[],
  algoVersion: string
): Promise<{ sent: boolean; reason?: string }> {
  const config = await getConfig();
  if (!config?.enabled) return { sent: false, reason: 'Sellix integration disabled' };
  if (!config.sellixEndpoint) return { sent: false, reason: 'No Sellix endpoint configured' };
  if (score < config.thresholdScore)
    return { sent: false, reason: `Score ${score} below threshold ${config.thresholdScore}` };
  const cooldownOk = await checkCooldown(orgId, config.cooldownHours);
  if (!cooldownOk) return { sent: false, reason: 'Cooldown active' };
  const org: any = await dbGet(`SELECT plan, status FROM organizations WHERE id = $1`, [orgId]);
  const payload: OutboundPayload = {
    organizationId: orgId,
    readinessScore: score,
    readinessTier: tier,
    algorithmVersion: algoVersion,
    topBlockers: blockers.slice(0, 3),
    recommendedNextSteps: deriveNextSteps(tier, blockers),
    organizationType: org?.plan === 'trial' ? 'TRIAL' : 'PAID',
    billingStatus: org?.status || 'unknown',
    pathway: config.defaultPathway,
    timestamp: new Date().toISOString(),
  };
  const body = JSON.stringify(payload);
  const signature = config.webhookSecret ? signPayload(body, config.webhookSecret) : '';
  const deliveryId = uuidv4();
  try {
    const resp = await fetch(config.sellixEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Consultify-Signature': signature,
        'X-Consultify-Event': 'transaction_readiness.ready',
        'X-Consultify-Timestamp': new Date().toISOString(),
        'X-Consultify-Delivery-Id': deliveryId,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });
    await logDelivery(
      orgId,
      'transaction_readiness.ready',
      body,
      resp.status,
      resp.ok,
      await resp.text().catch(() => '')
    );
    return { sent: resp.ok };
  } catch (err: any) {
    await logDelivery(orgId, 'transaction_readiness.ready', body, 0, false, err.message);
    logger.error('[Sellix] Outbound delivery failed', { orgId, err: err.message });
    return { sent: false, reason: err.message };
  }
}

async function checkCooldown(orgId: string, cooldownHours: number): Promise<boolean> {
  const last: any = await dbGet(
    `SELECT created_at FROM sellix_delivery_log WHERE organization_id = $1 AND success = TRUE ORDER BY created_at DESC LIMIT 1`,
    [orgId]
  );
  if (!last) return true;
  const hoursAgo = (Date.now() - new Date(last.created_at).getTime()) / 3600000;
  return hoursAgo >= cooldownHours;
}

async function logDelivery(
  orgId: string,
  eventType: string,
  body: string,
  status: number,
  success: boolean,
  responseBody: string
): Promise<void> {
  try {
    await dbRun(
      `INSERT INTO sellix_delivery_log (id, organization_id, event_type, payload_hash, response_status, response_body, success) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        uuidv4(),
        orgId,
        eventType,
        crypto.createHash('sha256').update(body).digest('hex').substring(0, 16),
        status,
        (responseBody || '').substring(0, 500),
        success,
      ]
    );
  } catch (err) {
    logger.error('[Sellix] Failed to log delivery', { err });
  }
}

function deriveNextSteps(tier: string, blockers: string[]): string[] {
  const steps: string[] = [];
  if (blockers.includes('BLOCKED_BY_BILLING')) steps.push('Add payment method');
  if (blockers.includes('BLOCKED_BY_COMPLIANCE')) steps.push('Accept terms of service');
  if (tier === 'HIGH') steps.push('Schedule onboarding call');
  if (tier === 'READY') steps.push('Activate upgrade pathway');
  return steps;
}

export async function processInboundEvent(
  event: InboundSellixEvent
): Promise<{ ok: boolean; duplicate?: boolean }> {
  const existing: any = await dbGet(`SELECT id FROM sellix_events WHERE event_id = $1`, [
    event.eventId,
  ]);
  if (existing) return { ok: true, duplicate: true };
  await dbRun(
    `INSERT INTO sellix_events (id, event_id, event_type, organization_id, payload, signature_valid, processing_status, processed_at) VALUES ($1, $2, $3, $4, $5, TRUE, 'processed', NOW())`,
    [
      uuidv4(),
      event.eventId,
      event.eventType,
      event.organizationId || null,
      JSON.stringify(event.data || {}),
    ]
  );
  if (event.organizationId && event.eventType) {
    try {
      await dbRun(
        `INSERT INTO journey_events (id, organization_id, event_name, stage, metadata, created_at) VALUES ($1, $2, $3, 'conversion', $4, NOW())`,
        [
          uuidv4(),
          event.organizationId,
          `sellix.${event.eventType}`,
          JSON.stringify({ source: 'sellix', eventId: event.eventId }),
        ]
      );
    } catch (err) {
      logger.warn('[Sellix] Failed to write journey event', { err });
    }
  }
  return { ok: true, duplicate: false };
}

export async function getDeliveryStatus(limit = 20): Promise<any[]> {
  return dbAll(
    `SELECT id, organization_id, event_type, response_status, success, error_message, created_at FROM sellix_delivery_log ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
}

export async function getRecentInboundEvents(limit = 20): Promise<any[]> {
  return dbAll(
    `SELECT id, event_id, event_type, organization_id, processing_status, created_at FROM sellix_events ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
}
