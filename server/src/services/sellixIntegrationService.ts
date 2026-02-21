/**
 * Sellix integration (T115)
 * - Outbound: readiness signals (idempotent + cooldown)
 * - Inbound: Sellix conversion events webhook (handled in routes/webhooks/sellix.routes.ts)
 *
 * This implementation is env-driven (minimal V2) and logs deliveries to DB.
 * If not configured, it is a no-op with an explicit reason.
 */
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import type { TransactionReadinessSnapshot } from './transactionReadinessService.js';

type OutboundStatus = 'success' | 'failed' | 'skipped';

let ensured = false;
async function ensureSellixTables(): Promise<void> {
  if (ensured) return;
  await dbRun(`
    CREATE TABLE IF NOT EXISTS sellix_events (
      id TEXT PRIMARY KEY,
      event_id TEXT UNIQUE NOT NULL,
      event_type TEXT NOT NULL,
      organization_id TEXT,
      payload_json JSON,
      received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      processed_at TIMESTAMP,
      status TEXT DEFAULT 'received',
      error_message TEXT
    )
  `);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_sellix_events_type ON sellix_events(event_type)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_sellix_events_org ON sellix_events(organization_id)`);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS sellix_outbound_deliveries (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      dedupe_key TEXT UNIQUE NOT NULL,
      payload_json JSON,
      status TEXT DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      response_code INTEGER,
      response_body TEXT,
      last_error TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      delivered_at TIMESTAMP
    )
  `);
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_sellix_outbound_org_created ON sellix_outbound_deliveries(organization_id, created_at)`
  );
  ensured = true;
}

function isEnabled(): { enabled: boolean; reason?: string } {
  const enabled = String(process.env.SELLIX_ENABLED || '').toLowerCase() === 'true';
  const url = (process.env.SELLIX_OUTBOUND_URL || '').trim();
  const secret = (process.env.SELLIX_OUTBOUND_SECRET || '').trim();
  if (!enabled) return { enabled: false, reason: 'SELLIX_ENABLED is not true' };
  if (!url) return { enabled: false, reason: 'SELLIX_OUTBOUND_URL not configured' };
  if (!secret) return { enabled: false, reason: 'SELLIX_OUTBOUND_SECRET not configured' };
  return { enabled: true };
}

function getCooldownDays(): number {
  const v = Number(process.env.SELLIX_COOLDOWN_DAYS || 7);
  return Number.isFinite(v) ? Math.max(1, Math.min(60, v)) : 7;
}

function sign(timestamp: string, body: string, secret: string): string {
  // Consultinity-style signature: sha256 HMAC over `${ts}.${body}`
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

function buildDedupeKey(snapshot: TransactionReadinessSnapshot): string {
  // "exactly once per crossing" (v2 minimal): daily key per org+tier+version
  const day = snapshot.computedAt.slice(0, 10);
  return `${snapshot.organizationId}:${snapshot.tier}:${snapshot.algorithmVersion}:${day}`;
}

async function lastSuccessfulDeliveryAt(
  organizationId: string,
  eventType: string
): Promise<string | null> {
  await ensureSellixTables();
  try {
    const row = await dbGet<{ delivered_at?: string | null }>(
      `SELECT delivered_at FROM sellix_outbound_deliveries
       WHERE organization_id = ? AND event_type = ? AND status = 'success'
       ORDER BY delivered_at DESC
       LIMIT 1`,
      [organizationId, eventType]
    );
    return row?.delivered_at || null;
  } catch {
    return null;
  }
}

async function shouldCooldownBlock(organizationId: string, eventType: string): Promise<boolean> {
  const last = await lastSuccessfulDeliveryAt(organizationId, eventType);
  if (!last) return false;
  const ms = Date.now() - new Date(last).getTime();
  const days = ms / (24 * 60 * 60 * 1000);
  return days < getCooldownDays();
}

async function recordOutboundDelivery(opts: {
  organizationId: string;
  eventType: string;
  dedupeKey: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  await ensureSellixTables();
  const id = uuidv4();
  try {
    await dbRun(
      `INSERT INTO sellix_outbound_deliveries (id, organization_id, event_type, dedupe_key, payload_json, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)`,
      [id, opts.organizationId, opts.eventType, opts.dedupeKey, JSON.stringify(opts.payload)]
    );
  } catch (err: any) {
    // If dedupe key already exists, treat as already delivered/skipped.
    const msg = err?.message || String(err);
    logger.debug('[Sellix] delivery record insert failed:', msg);
  }
  return id;
}

async function updateDelivery(
  id: string,
  patch: {
    status: OutboundStatus;
    responseCode?: number | null;
    responseBody?: string | null;
    lastError?: string | null;
  }
): Promise<void> {
  await ensureSellixTables();
  try {
    await dbRun(
      `UPDATE sellix_outbound_deliveries
       SET status = ?,
           attempts = attempts + 1,
           response_code = COALESCE(?, response_code),
           response_body = COALESCE(?, response_body),
           last_error = COALESCE(?, last_error),
           delivered_at = CASE WHEN ? = 'success' THEN CURRENT_TIMESTAMP ELSE delivered_at END
       WHERE id = ?`,
      [
        patch.status,
        patch.responseCode ?? null,
        patch.responseBody ?? null,
        patch.lastError ?? null,
        patch.status,
        id,
      ]
    );
  } catch {
    // ignore
  }
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>
) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => '');
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    bodyText: text.slice(0, 2000),
  };
}

export async function emitReadinessSignal(snapshot: TransactionReadinessSnapshot): Promise<{
  attempted: boolean;
  status: OutboundStatus;
  reason?: string;
}> {
  await ensureSellixTables();
  const cfg = isEnabled();
  if (!cfg.enabled) return { attempted: false, status: 'skipped', reason: cfg.reason };

  // Block rules
  if (
    snapshot.flags.includes('BLOCKED_BY_BILLING') ||
    snapshot.flags.includes('BLOCKED_BY_COMPLIANCE')
  ) {
    return { attempted: false, status: 'skipped', reason: 'blocked' };
  }

  const eventType =
    snapshot.tier === 'READY'
      ? 'transaction_readiness.ready'
      : 'transaction_readiness.tier_changed';
  if (await shouldCooldownBlock(snapshot.organizationId, eventType)) {
    return { attempted: false, status: 'skipped', reason: 'cooldown' };
  }

  const url = String(process.env.SELLIX_OUTBOUND_URL || '').trim();
  const secret = String(process.env.SELLIX_OUTBOUND_SECRET || '').trim();

  const payload = {
    organizationId: snapshot.organizationId,
    readinessScore: snapshot.score,
    readinessTier: snapshot.tier,
    algorithmVersion: snapshot.algorithmVersion,
    topBlockers: snapshot.blockers.slice(0, 3),
    recommendedNextSteps: snapshot.blockers.slice(0, 3),
    flags: snapshot.flags,
    computedAt: snapshot.computedAt,
  };

  const dedupeKey = buildDedupeKey(snapshot);
  const deliveryId = await recordOutboundDelivery({
    organizationId: snapshot.organizationId,
    eventType,
    dedupeKey,
    payload,
  });

  const ts = String(Date.now());
  const bodyStr = JSON.stringify({ event: eventType, timestamp: ts, data: payload });
  const signature = sign(ts, bodyStr, secret);

  try {
    const result = await postJson(
      url,
      {
        'X-Consultinity-Event': eventType,
        'X-Consultinity-Timestamp': ts,
        'X-Consultinity-Signature': signature,
        'User-Agent': 'Consultinity-Sellix/1.0',
      },
      { event: eventType, timestamp: ts, data: payload }
    );

    if (!result.ok) {
      await updateDelivery(deliveryId, {
        status: 'failed',
        responseCode: result.status,
        responseBody: result.bodyText,
        lastError: `${result.status} ${result.statusText}`,
      });
      return { attempted: true, status: 'failed', reason: `http_${result.status}` };
    }

    await updateDelivery(deliveryId, {
      status: 'success',
      responseCode: result.status,
      responseBody: result.bodyText,
    });
    return { attempted: true, status: 'success' };
  } catch (err: any) {
    await updateDelivery(deliveryId, { status: 'failed', lastError: err?.message || String(err) });
    return { attempted: true, status: 'failed', reason: 'network' };
  }
}

export async function maybeEmitSellixSignalsForSnapshot(
  snapshot: TransactionReadinessSnapshot
): Promise<void> {
  // V2 minimal: only trigger on READY (no spam).
  if (snapshot.tier !== 'READY') return;
  const res = await emitReadinessSignal(snapshot);
  if (res.attempted) {
    logger.info(`[Sellix] readiness signal: ${res.status} (org=${snapshot.organizationId})`);
  } else {
    logger.debug(`[Sellix] readiness signal skipped: ${res.reason}`);
  }
}

export async function getSellixStatus(): Promise<Record<string, unknown>> {
  await ensureSellixTables();
  const cfg = isEnabled();
  const last = await dbGet<Record<string, unknown>>(
    `SELECT * FROM sellix_outbound_deliveries ORDER BY created_at DESC LIMIT 1`,
    []
  );
  return {
    enabled: cfg.enabled,
    reason: cfg.reason,
    cooldownDays: getCooldownDays(),
    lastDelivery: last || null,
  };
}

export function verifySellixInboundSignature(opts: {
  timestamp: string;
  rawBody: string;
  signature: string;
}): boolean {
  const secret = String(
    process.env.SELLIX_INBOUND_SECRET || process.env.SELLIX_OUTBOUND_SECRET || ''
  ).trim();
  if (!secret) return false;
  const expected = sign(opts.timestamp, opts.rawBody, secret);
  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(opts.signature));
  } catch {
    return false;
  }
}

export async function recordSellixInboundEvent(opts: {
  eventId: string;
  eventType: string;
  organizationId?: string | null;
  payload: Record<string, unknown>;
}): Promise<{ deduped: boolean }> {
  await ensureSellixTables();
  try {
    await dbRun(
      `INSERT INTO sellix_events (id, event_id, event_type, organization_id, payload_json, received_at, status)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'received')`,
      [
        uuidv4(),
        opts.eventId,
        opts.eventType,
        opts.organizationId || null,
        JSON.stringify(opts.payload),
      ]
    );
    return { deduped: false };
  } catch {
    return { deduped: true };
  }
}

export async function markSellixInboundProcessed(opts: { eventId: string }): Promise<void> {
  await ensureSellixTables();
  try {
    await dbRun(
      `UPDATE sellix_events SET status = 'processed', processed_at = CURRENT_TIMESTAMP WHERE event_id = ?`,
      [opts.eventId]
    );
  } catch {
    // ignore
  }
}
