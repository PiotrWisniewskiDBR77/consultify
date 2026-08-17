import crypto from 'node:crypto';
import { type PgTransactionClient, withPgTransaction } from '../utils/queryHelpers.js';
import type { OperationalAlertKind } from './operationalAlertService.js';

const SAFE_ID = /^[A-Za-z0-9._:@/-]{1,160}$/;
const SECRET_KEY = /(authorization|cookie|password|secret|token|api.?key)/i;
export type SignalOutcome = 'SUCCESS' | 'FAILURE' | 'SAMPLE' | 'DENIAL';

/** Internal trusted-producer gate. This service is not a public authentication API. */
export function durableOperationalAlertsEnabled(): boolean {
  return process.env.OPERATIONAL_ALERT_LEDGER_ENABLED !== 'false' &&
    process.env.OPERATIONAL_ALERT_DURABLE_ENABLED === 'true';
}

function required(value: string, code: string): string {
  const normalized = value?.trim();
  if (!SAFE_ID.test(normalized)) throw new Error(code);
  return normalized;
}
function safeMetadata(input: Record<string, unknown> = {}): Record<string, unknown> {
  for (const [key, value] of Object.entries(input)) {
    if (SECRET_KEY.test(key) || (typeof value === 'string' && value.length > 512)) {
      throw new Error('OPS_ALERT_METADATA_UNSAFE');
    }
  }
  return input;
}
function fingerprint(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export interface OperationalAlertSignalInput {
  organizationId: string; actorId: string; correlationId: string;
  sourceType: string; sourceId: string; kind: OperationalAlertKind;
  outcome: SignalOutcome; observedValue?: number; occurredAt?: string;
  idempotencyKey: string; metadata?: Record<string, unknown>;
  operatorOverride?: boolean;
}

export async function recordOperationalAlertSignal(input: OperationalAlertSignalInput) {
  if (!durableOperationalAlertsEnabled()) {
    if (!(input.operatorOverride === true && input.sourceType === 'operator_positive_control' && input.metadata?.synthetic === true)) {
      throw new Error('OPS_ALERT_DURABLE_DISABLED');
    }
  }
  const normalized = {
    organizationId: required(input.organizationId, 'OPS_ALERT_ORGANIZATION_INVALID'),
    actorId: required(input.actorId, 'OPS_ALERT_ACTOR_INVALID'),
    correlationId: required(input.correlationId, 'OPS_ALERT_CORRELATION_INVALID'),
    sourceType: required(input.sourceType, 'OPS_ALERT_SOURCE_TYPE_INVALID'),
    sourceId: required(input.sourceId, 'OPS_ALERT_SOURCE_ID_INVALID'),
    kind: input.kind,
    outcome: input.outcome,
    observedValue: input.observedValue ?? 1,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    idempotencyKey: required(input.idempotencyKey, 'OPS_ALERT_IDEMPOTENCY_INVALID'),
    metadata: safeMetadata(input.metadata),
  };
  if (!Number.isFinite(normalized.observedValue)) throw new Error('OPS_ALERT_VALUE_INVALID');
  const hash = fingerprint(normalized);
  return withPgTransaction(async (tx) => {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext(?))`, [`ops-signal:${normalized.organizationId}:${normalized.idempotencyKey}`]);
    const found = await tx.query<any>(`SELECT * FROM operational_alert_signals WHERE organization_id=? AND idempotency_key=?`, [normalized.organizationId, normalized.idempotencyKey]);
    if (found.rows[0]) {
      if (found.rows[0].input_fingerprint !== hash) throw new Error('OPS_ALERT_IDEMPOTENCY_COLLISION');
      return found.rows[0];
    }
    const inserted = await tx.query<any>(`INSERT INTO operational_alert_signals
      (organization_id,actor_id,correlation_id,source_type,source_id,kind,outcome,observed_value,occurred_at,idempotency_key,input_fingerprint,metadata_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?::jsonb) RETURNING *`, [normalized.organizationId, normalized.actorId, normalized.correlationId, normalized.sourceType, normalized.sourceId, normalized.kind, normalized.outcome, normalized.observedValue, normalized.occurredAt, normalized.idempotencyKey, hash, JSON.stringify(normalized.metadata)]);
    return inserted.rows[0];
  });
}

const SPECS: Record<OperationalAlertKind, { windowMs: number; threshold: number }> = {
  WRITE_FAILURE_RATE: { windowMs: 300000, threshold: 0.01 },
  OUTBOX_OLDEST_AGE: { windowMs: 300000, threshold: 300000 },
  DB_SATURATION: { windowMs: 600000, threshold: 80 },
  REPEATED_AUTH_DENIALS: { windowMs: 300000, threshold: 5 },
};

async function measure(tx: PgTransactionClient, org: string, kind: OperationalAlertKind, now: string) {
  const spec = SPECS[kind];
  const result = await tx.query<any>(`SELECT
    COALESCE(sum(observed_value) FILTER (WHERE outcome IN ('SUCCESS','FAILURE')),0)::float8 AS total,
    count(*)::int AS sample_count,
    COALESCE(sum(observed_value) FILTER (WHERE outcome='FAILURE'),0)::float8 AS failures,
    COALESCE(sum(observed_value) FILTER (WHERE outcome='DENIAL'),0)::float8 AS denials,
    max(observed_value)::float8 AS max_value,
    min(observed_value)::float8 AS min_value,
    min(occurred_at) AS first_at,
    (array_agg(correlation_id ORDER BY occurred_at DESC))[1] AS correlation_id
    FROM operational_alert_signals WHERE organization_id=? AND kind=?
      AND occurred_at > ?::timestamptz - (? * interval '1 millisecond') AND occurred_at <= ?::timestamptz`, [org, kind, now, spec.windowMs, now]);
  const row = result.rows[0];
  if (kind === 'WRITE_FAILURE_RATE') return { active: row.total > 0 && row.failures / row.total >= spec.threshold, value: row.total ? row.failures / row.total : 0, correlationId: row.correlation_id };
  if (kind === 'REPEATED_AUTH_DENIALS') return { active: row.denials >= spec.threshold, value: row.denials, correlationId: row.correlation_id };
  if (kind === 'DB_SATURATION') return { active: row.sample_count > 1 && Number(row.min_value) >= spec.threshold && new Date(row.first_at).getTime() <= new Date(now).getTime() - spec.windowMs + 1000, value: Number(row.max_value ?? 0), correlationId: row.correlation_id };
  return { active: Number(row.max_value ?? 0) >= spec.threshold, value: Number(row.max_value ?? 0), correlationId: row.correlation_id };
}

export async function evaluateOperationalAlertWindows(params: { organizationId: string; evaluatorId: string; now?: string }) {
  const org = required(params.organizationId, 'OPS_ALERT_ORGANIZATION_INVALID');
  const evaluator = required(params.evaluatorId, 'OPS_ALERT_EVALUATOR_ID_INVALID');
  const now = params.now ?? new Date().toISOString();
  return withPgTransaction(async (tx) => {
    const output: any[] = [];
    for (const kind of Object.keys(SPECS) as OperationalAlertKind[]) {
      await tx.query(`SELECT pg_advisory_xact_lock(hashtext(?))`, [`ops-eval:${org}:${kind}`]);
      const metric = await measure(tx, org, kind, now);
      const selected = await tx.query<any>(`SELECT * FROM operational_alert_tenant_states WHERE organization_id=? AND kind=? FOR UPDATE`, [org, kind]);
      const old = selected.rows[0];
      const wasActive = old?.status === 'ACTIVE';
      const transition = metric.active && !wasActive ? 'DETECTED' : !metric.active && wasActive ? 'RECOVERED' : null;
      const nextStatus = metric.active ? 'ACTIVE' : transition === 'RECOVERED' ? 'RECOVERED' : old?.status ?? 'INACTIVE';
      const version = transition ? Number(old?.version ?? 0) + 1 : Number(old?.version ?? 0);
      const correlationId = metric.correlationId || `ops-eval:${org}:${kind}:${new Date(now).toISOString()}`;
      const state = await tx.query<any>(`INSERT INTO operational_alert_tenant_states
        (organization_id,kind,status,detected_at,recovered_at,latest_value,threshold,correlation_id,evaluator_id,version,updated_at)
        VALUES(?,?,?,CASE WHEN ?='DETECTED' THEN ?::timestamptz END,CASE WHEN ?='RECOVERED' THEN ?::timestamptz END,?,?,?,?,?,?::timestamptz)
        ON CONFLICT(organization_id,kind) DO UPDATE SET status=excluded.status,
          detected_at=CASE WHEN ?='DETECTED' THEN ?::timestamptz ELSE operational_alert_tenant_states.detected_at END,
          recovered_at=CASE WHEN ?='RECOVERED' THEN ?::timestamptz WHEN ?='DETECTED' THEN NULL ELSE operational_alert_tenant_states.recovered_at END,
          latest_value=excluded.latest_value,threshold=excluded.threshold,correlation_id=excluded.correlation_id,evaluator_id=excluded.evaluator_id,version=excluded.version,updated_at=excluded.updated_at RETURNING *`,
        [org, kind, nextStatus, transition, now, transition, now, metric.value, SPECS[kind].threshold, correlationId, evaluator, version, now, transition, now, transition, now, transition]);
      if (transition) await tx.query(`INSERT INTO operational_alert_delivery_outbox
        (organization_id,kind,transition,state_version,correlation_id,payload_json)
        VALUES(?,?,?,?,?,?::jsonb) ON CONFLICT DO NOTHING`, [org, kind, transition, version, correlationId, JSON.stringify({ version: 1, organizationId: org, kind, transition, stateVersion: version, correlationId, value: metric.value, threshold: SPECS[kind].threshold, occurredAt: now })]);
      output.push(state.rows[0]);
    }
    return output;
  });
}

export async function evaluateAllOperationalAlertOrganizations(params: { evaluatorId: string; now?: string }) {
  const organizations = await withPgTransaction(async (tx) => (await tx.query<{ organization_id: string }>(`SELECT DISTINCT organization_id FROM operational_alert_signals WHERE occurred_at > COALESCE(?::timestamptz,now()) - interval '24 hours'`, [params.now ?? null])).rows);
  const result = [];
  for (const row of organizations) result.push(...await evaluateOperationalAlertWindows({ organizationId: row.organization_id, evaluatorId: params.evaluatorId, now: params.now }));
  return result;
}

export async function listOperationalAlertDeliveryState(params: { organizationId?: string } = {}) {
  return withPgTransaction(async (tx) => {
    const where = params.organizationId ? 'WHERE organization_id=?' : '';
    const values = params.organizationId ? [required(params.organizationId, 'OPS_ALERT_ORGANIZATION_INVALID')] : [];
    const states = await tx.query<any>(`SELECT * FROM operational_alert_tenant_states ${where} ORDER BY organization_id,kind`, values);
    const deliveries = await tx.query<any>(`SELECT delivery_id,organization_id,kind,transition,state_version,status,attempt_count,max_attempts,available_at,delivered_at,last_error FROM operational_alert_delivery_outbox ${where} ORDER BY created_at DESC LIMIT 200`, values);
    return { states: states.rows, deliveries: deliveries.rows };
  });
}

export async function acknowledgeRecoveredTenantAlert(params: { organizationId: string; kind: OperationalAlertKind; evaluatorId: string }) {
  return withPgTransaction(async (tx) => {
    const selected = await tx.query<any>(`SELECT * FROM operational_alert_tenant_states WHERE organization_id=? AND kind=? FOR UPDATE`, [required(params.organizationId, 'OPS_ALERT_ORGANIZATION_INVALID'), params.kind]);
    if (!selected.rows[0]) throw new Error('OPS_ALERT_STATE_NOT_FOUND');
    if (selected.rows[0].status === 'ACTIVE') throw new Error('OPS_ALERT_INCIDENT_STILL_ACTIVE');
    if (selected.rows[0].status !== 'RECOVERED' && selected.rows[0].status !== 'ACKNOWLEDGED') throw new Error('OPS_ALERT_INCIDENT_NOT_RECOVERED');
    if (selected.rows[0].status === 'ACKNOWLEDGED') return selected.rows[0];
    const updated = await tx.query<any>(`UPDATE operational_alert_tenant_states SET status='ACKNOWLEDGED',acknowledged_at=now(),evaluator_id=?,version=version+1,updated_at=now() WHERE organization_id=? AND kind=? RETURNING *`, [required(params.evaluatorId, 'OPS_ALERT_EVALUATOR_ID_INVALID'), params.organizationId, params.kind]);
    return updated.rows[0];
  });
}

export async function claimOperationalAlertDeliveries(params: { workerId: string; organizationId?: string; limit?: number; leaseMs?: number }) {
  const organizationClause = params.organizationId ? 'AND organization_id=?' : '';
  const values: unknown[] = params.organizationId ? [required(params.organizationId, 'OPS_ALERT_ORGANIZATION_INVALID')] : [];
  values.push(params.limit ?? 20, required(params.workerId, 'OPS_ALERT_WORKER_INVALID'), params.leaseMs ?? 30000);
  return withPgTransaction(async (tx) => (await tx.query<any>(`WITH candidates AS (
    SELECT delivery_id FROM operational_alert_delivery_outbox WHERE
      ((status IN ('PENDING','FAILED') AND available_at<=now()) OR (status='PROCESSING' AND lease_expires_at<now()))
      AND attempt_count < max_attempts ${organizationClause} ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT ?)
    UPDATE operational_alert_delivery_outbox o SET status='PROCESSING',lease_owner=?,lease_expires_at=now()+(? * interval '1 millisecond'),updated_at=now()
    FROM candidates c WHERE o.delivery_id=c.delivery_id RETURNING o.*`, values)).rows);
}

export async function completeOperationalAlertDelivery(params: { deliveryId: string; workerId: string; responseStatus: number; responseBody?: string }) {
  return withPgTransaction(async (tx) => {
    const selected = await tx.query<any>(`SELECT * FROM operational_alert_delivery_outbox WHERE delivery_id=? AND status='PROCESSING' AND lease_owner=? FOR UPDATE`, [params.deliveryId, params.workerId]);
    if (!selected.rows[0]) throw new Error('OPS_ALERT_DELIVERY_LEASE_LOST');
    const digest = fingerprint(params.responseBody ?? '');
    await tx.query(`INSERT INTO operational_alert_delivery_receipts(delivery_id,organization_id,response_status,response_digest) VALUES(?,?,?,?) ON CONFLICT(delivery_id) DO NOTHING`, [params.deliveryId, selected.rows[0].organization_id, params.responseStatus, digest]);
    return (await tx.query<any>(`UPDATE operational_alert_delivery_outbox SET status='DELIVERED',delivered_at=now(),lease_owner=NULL,lease_expires_at=NULL,updated_at=now() WHERE delivery_id=? RETURNING *`, [params.deliveryId])).rows[0];
  });
}

export async function failOperationalAlertDelivery(params: { deliveryId: string; workerId: string; error: string; now?: string }) {
  const safeError = params.error.replace(/[^A-Za-z0-9 ._:-]/g, '').slice(0, 240);
  return withPgTransaction(async (tx) => {
    const selected = await tx.query<any>(`SELECT * FROM operational_alert_delivery_outbox WHERE delivery_id=? AND status='PROCESSING' AND lease_owner=? FOR UPDATE`, [params.deliveryId, params.workerId]);
    if (!selected.rows[0]) throw new Error('OPS_ALERT_DELIVERY_LEASE_LOST');
    const attempts = Number(selected.rows[0].attempt_count) + 1;
    const dead = attempts >= Number(selected.rows[0].max_attempts);
    return (await tx.query<any>(`UPDATE operational_alert_delivery_outbox SET status=?,attempt_count=?,available_at=?::timestamptz+(LEAST(300000,1000*power(2,?))*interval '1 millisecond'),last_error=?,lease_owner=NULL,lease_expires_at=NULL,updated_at=now() WHERE delivery_id=? RETURNING *`, [dead ? 'DEAD_LETTER' : 'FAILED', attempts, params.now ?? new Date().toISOString(), attempts - 1, safeError, params.deliveryId])).rows[0];
  });
}

export async function deliverOperationalAlerts(params: { endpoint?: string; workerId: string; organizationId?: string; fetchImpl?: typeof fetch; limit?: number }) {
  if (!durableOperationalAlertsEnabled() || process.env.OPERATIONAL_ALERT_DELIVERY_ENABLED !== 'true') return { disabled: true, delivered: 0, failed: 0 };
  const endpoint = params.endpoint ?? process.env.OPERATIONAL_ALERT_DELIVERY_ENDPOINT;
  let target: URL;
  try { target = new URL(endpoint ?? ''); } catch { throw new Error('OPS_ALERT_TRANSPORT_NOT_AUTHORIZED'); }
  if (target.protocol !== 'http:' || target.username || target.password || !['127.0.0.1', 'localhost'].includes(target.hostname) || !target.port) throw new Error('OPS_ALERT_TRANSPORT_NOT_AUTHORIZED');
  const claimed = await claimOperationalAlertDeliveries(params);
  let delivered = 0, failed = 0;
  for (const row of claimed) {
    try {
      const response = await (params.fetchImpl ?? fetch)(target, { method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json', 'x-ops-delivery-id': row.delivery_id }, body: JSON.stringify(row.payload_json) });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      await completeOperationalAlertDelivery({ deliveryId: row.delivery_id, workerId: params.workerId, responseStatus: response.status, responseBody: await response.text() }); delivered++;
    } catch (error) { await failOperationalAlertDelivery({ deliveryId: row.delivery_id, workerId: params.workerId, error: error instanceof Error ? error.message : 'DELIVERY_FAILED' }); failed++; }
  }
  return { disabled: false, delivered, failed };
}
