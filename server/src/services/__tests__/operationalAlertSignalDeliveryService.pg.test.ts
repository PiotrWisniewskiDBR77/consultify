/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { createServer, request as httpRequest } from 'node:http';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  acknowledgeRecoveredTenantAlert,
  claimOperationalAlertDeliveries,
  completeOperationalAlertDelivery,
  deliverOperationalAlerts,
  evaluateOperationalAlertWindows,
  failOperationalAlertDelivery,
  recordOperationalAlertSignal,
} from '../operationalAlertSignalDeliveryService.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_PG = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && DATABASE_URL.startsWith('postgres');
const prefix = `ops-${randomUUID()}`;
const org = `${prefix}-org`;
const otherOrg = `${prefix}-foreign`;
const thresholdOrg = `${prefix}-threshold`;
const now = '2026-08-17T06:00:00.000Z';

const realLocalFetch: typeof fetch = async (input, init) => new Promise<Response>((resolve, reject) => {
  const request = httpRequest(String(input), { method: init?.method, headers: init?.headers as Record<string, string> }, (response) => {
    let body = ''; response.setEncoding('utf8'); response.on('data', (chunk) => { body += chunk; });
    response.on('end', () => resolve(new Response(body, { status: response.statusCode ?? 500 })));
  });
  request.on('error', reject); if (init?.body) request.write(String(init.body)); request.end();
});

function signal(overrides: Record<string, unknown> = {}) {
  return { organizationId: org, actorId: `${prefix}-actor`, correlationId: `${prefix}-corr`, sourceType: 'test-outbox', sourceId: `${prefix}-source`, kind: 'WRITE_FAILURE_RATE' as const, outcome: 'FAILURE' as const, occurredAt: now, idempotencyKey: `${prefix}-same`, ...overrides };
}

describe.skipIf(!REAL_PG)('OPS-OBS tenant signal delivery (real PostgreSQL)', () => {
  beforeAll(() => { process.env.OPERATIONAL_ALERT_DURABLE_ENABLED = 'true'; });
  afterAll(async () => {
    delete process.env.OPERATIONAL_ALERT_DURABLE_ENABLED;
    const db = new Client({ connectionString: DATABASE_URL }); await db.connect();
    // Test DB only: disable immutable guards solely while removing this test's unique fixtures.
    await db.query(`ALTER TABLE operational_alert_delivery_receipts DISABLE TRIGGER trg_operational_alert_receipts_immutable`);
    await db.query(`DELETE FROM operational_alert_delivery_receipts WHERE organization_id IN ($1,$2,$3)`, [org, otherOrg, thresholdOrg]);
    await db.query(`ALTER TABLE operational_alert_delivery_receipts ENABLE TRIGGER trg_operational_alert_receipts_immutable`);
    await db.query(`DELETE FROM operational_alert_delivery_outbox WHERE organization_id IN ($1,$2,$3)`, [org, otherOrg, thresholdOrg]);
    await db.query(`DELETE FROM operational_alert_tenant_states WHERE organization_id IN ($1,$2,$3)`, [org, otherOrg, thresholdOrg]);
    await db.query(`ALTER TABLE operational_alert_signals DISABLE TRIGGER trg_operational_alert_signals_immutable`);
    await db.query(`DELETE FROM operational_alert_signals WHERE organization_id IN ($1,$2,$3)`, [org, otherOrg, thresholdOrg]);
    await db.query(`ALTER TABLE operational_alert_signals ENABLE TRIGGER trg_operational_alert_signals_immutable`);
    await db.end();
  });

  it('serializes 8-way idempotency, rejects collision/secret metadata, and isolates tenants', async () => {
    const rows = await Promise.all(Array.from({ length: 8 }, () => recordOperationalAlertSignal(signal())));
    expect(new Set(rows.map((row) => row.signal_id)).size).toBe(1);
    await expect(recordOperationalAlertSignal(signal({ outcome: 'SUCCESS' }))).rejects.toThrow('OPS_ALERT_IDEMPOTENCY_COLLISION');
    await expect(recordOperationalAlertSignal(signal({ idempotencyKey: `${prefix}-secret`, metadata: { authorization: 'Bearer no' } }))).rejects.toThrow('OPS_ALERT_METADATA_UNSAFE');
    await recordOperationalAlertSignal(signal({ organizationId: otherOrg, idempotencyKey: `${prefix}-foreign` }));
    const db = new Client({ connectionString: DATABASE_URL }); await db.connect();
    expect((await db.query(`SELECT count(*)::int n FROM operational_alert_signals WHERE organization_id=$1`, [org])).rows[0].n).toBe(1);
    expect((await db.query(`SELECT count(*)::int n FROM operational_alert_signals WHERE organization_id=$1`, [otherOrg])).rows[0].n).toBe(1);
    await expect(db.query(`UPDATE operational_alert_signals SET observed_value=2 WHERE organization_id=$1`, [org])).rejects.toThrow(/OPS_ALERT_APPEND_ONLY/);
    await expect(db.query(`DELETE FROM operational_alert_signals WHERE organization_id=$1`, [org])).rejects.toThrow(/OPS_ALERT_APPEND_ONLY/);
    await db.end();
  });

  it('detects and recovers transactionally and permits ack only after recovery', async () => {
    const detected = await evaluateOperationalAlertWindows({ organizationId: org, evaluatorId: `${prefix}-eval`, now });
    expect(detected.find((s) => s.kind === 'WRITE_FAILURE_RATE')).toMatchObject({ status: 'ACTIVE', version: 1 });
    await expect(acknowledgeRecoveredTenantAlert({ organizationId: org, kind: 'WRITE_FAILURE_RATE', evaluatorId: `${prefix}-ack` })).rejects.toThrow('OPS_ALERT_INCIDENT_STILL_ACTIVE');
    const recoveredAt = '2026-08-17T06:06:00.000Z';
    const recovered = await evaluateOperationalAlertWindows({ organizationId: org, evaluatorId: `${prefix}-eval2`, now: recoveredAt });
    expect(recovered.find((s) => s.kind === 'WRITE_FAILURE_RATE')).toMatchObject({ status: 'RECOVERED', version: 2 });
    expect((await acknowledgeRecoveredTenantAlert({ organizationId: org, kind: 'WRITE_FAILURE_RATE', evaluatorId: `${prefix}-ack` })).status).toBe('ACKNOWLEDGED');
    const db = new Client({ connectionString: DATABASE_URL }); await db.connect();
    const transitions = await db.query(`SELECT transition FROM operational_alert_delivery_outbox WHERE organization_id=$1 AND kind='WRITE_FAILURE_RATE' ORDER BY state_version`, [org]);
    expect(transitions.rows.map((r) => r.transition)).toEqual(['DETECTED', 'RECOVERED']);
    await db.end();
  });

  it('uses clock-controlled 10m/5m windows for saturation, outbox age and auth denial', async () => {
    const samples = [
      { kind: 'DB_SATURATION' as const, outcome: 'SAMPLE' as const, observedValue: 85, occurredAt: '2026-08-17T05:50:01.000Z', suffix: 'db-old' },
      { kind: 'DB_SATURATION' as const, outcome: 'SAMPLE' as const, observedValue: 88, occurredAt: now, suffix: 'db-new' },
      { kind: 'OUTBOX_OLDEST_AGE' as const, outcome: 'SAMPLE' as const, observedValue: 300001, occurredAt: now, suffix: 'age' },
      ...Array.from({ length: 5 }, (_, index) => ({ kind: 'REPEATED_AUTH_DENIALS' as const, outcome: 'DENIAL' as const, observedValue: 1, occurredAt: now, suffix: `denial-${index}` })),
    ];
    for (const sample of samples) await recordOperationalAlertSignal(signal({ organizationId: thresholdOrg, idempotencyKey: `${prefix}-${sample.suffix}`, correlationId: `${prefix}-${sample.suffix}`, ...sample }));
    await recordOperationalAlertSignal(signal({ organizationId: thresholdOrg, outcome: 'SUCCESS', observedValue: 999, idempotencyKey: `${prefix}-weighted-success`, correlationId: `${prefix}-weighted-success` }));
    await recordOperationalAlertSignal(signal({ organizationId: thresholdOrg, outcome: 'FAILURE', observedValue: 1, idempotencyKey: `${prefix}-weighted-failure`, correlationId: `${prefix}-weighted-failure` }));
    const states = await evaluateOperationalAlertWindows({ organizationId: thresholdOrg, evaluatorId: `${prefix}-threshold-eval`, now });
    const weighted = states.find((state) => state.kind === 'WRITE_FAILURE_RATE');
    expect(weighted.status).toBe('INACTIVE'); expect(Number(weighted.latest_value)).toBe(0.001);
    expect(states.filter((state) => ['DB_SATURATION','OUTBOX_OLDEST_AGE','REPEATED_AUTH_DENIALS'].includes(state.kind)).map((state) => state.status)).toEqual(['ACTIVE','ACTIVE','ACTIVE']);
  });

  it('reclaims leases, creates immutable receipt exactly once, and has bounded retry/dead-letter', async () => {
    const first = (await claimOperationalAlertDeliveries({ workerId: `${prefix}-worker-a`, limit: 1, leaseMs: -1 }))[0];
    const reclaimed = (await claimOperationalAlertDeliveries({ workerId: `${prefix}-worker-b`, limit: 1 }))[0];
    expect(reclaimed.delivery_id).toBe(first.delivery_id);
    await completeOperationalAlertDelivery({ deliveryId: reclaimed.delivery_id, workerId: `${prefix}-worker-b`, responseStatus: 200, responseBody: 'ok' });
    const second = (await claimOperationalAlertDeliveries({ workerId: `${prefix}-worker-c`, limit: 1 }))[0];
    let row = second;
    for (let attempt = 0; attempt < 5; attempt++) {
      row = await failOperationalAlertDelivery({ deliveryId: row.delivery_id, workerId: `${prefix}-worker-c`, error: 'transport down', now: '2026-08-17T07:00:00.000Z' });
      if (row.status !== 'DEAD_LETTER') {
        const db = new Client({ connectionString: DATABASE_URL }); await db.connect(); await db.query(`UPDATE operational_alert_delivery_outbox SET available_at=now() WHERE delivery_id=$1`, [row.delivery_id]); await db.end();
        row = (await claimOperationalAlertDeliveries({ workerId: `${prefix}-worker-c`, limit: 1 }))[0];
      }
    }
    expect(row.status).toBe('DEAD_LETTER');
    const cold = new Client({ connectionString: DATABASE_URL }); await cold.connect();
    const receipt = await cold.query(`SELECT * FROM operational_alert_delivery_receipts WHERE delivery_id=$1`, [first.delivery_id]); expect(receipt.rows).toHaveLength(1);
    await expect(cold.query(`DELETE FROM operational_alert_delivery_receipts WHERE delivery_id=$1`, [first.delivery_id])).rejects.toThrow(/OPS_ALERT_APPEND_ONLY/);
    expect((await cold.query(`SELECT count(*)::int n FROM operational_alert_delivery_receipts WHERE delivery_id=$1`, [first.delivery_id])).rows[0].n).toBe(1);
    await cold.end();
  });

  it('keeps transport default-off and retries a local receiver without false success', async () => {
    const deliveryOrg = `${org}-http`;
    await recordOperationalAlertSignal(signal({ organizationId: deliveryOrg, idempotencyKey: `${prefix}-http`, correlationId: `${prefix}-http-corr` }));
    await evaluateOperationalAlertWindows({ organizationId: deliveryOrg, evaluatorId: `${prefix}-http-eval`, now });
    delete process.env.OPERATIONAL_ALERT_DELIVERY_ENABLED;
    expect(await deliverOperationalAlerts({ workerId: `${prefix}-http-worker` })).toEqual({ disabled: true, delivered: 0, failed: 0 });
    process.env.OPERATIONAL_ALERT_DELIVERY_ENABLED = 'true';
    for (const forbidden of ['https://alerts.example.com/hook', 'http://user:pass@127.0.0.1:9999/hook', 'http://[::1]:9999/hook', 'http://localhost.evil.test:9999/hook']) {
      await expect(deliverOperationalAlerts({ endpoint: forbidden, workerId: `${prefix}-http-worker` })).rejects.toThrow('OPS_ALERT_TRANSPORT_NOT_AUTHORIZED');
    }
    let calls = 0;
    const ids: string[] = [];
    const server = createServer((request, response) => {
      calls++; ids.push(String(request.headers['x-ops-delivery-id']));
      response.statusCode = 200; response.end('accepted');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('local receiver unavailable');
    const endpoint = `http://127.0.0.1:${address.port}/ops-alerts`;
    const unavailableReceiver: typeof fetch = async (...args) => {
      await realLocalFetch(...args);
      throw new Error('receiver unavailable after accept-before-ack crash window');
    };
    expect(await deliverOperationalAlerts({ endpoint, workerId: `${prefix}-http-worker`, organizationId: deliveryOrg, limit: 1, fetchImpl: unavailableReceiver })).toMatchObject({ delivered: 0, failed: 1 });
    const db = new Client({ connectionString: DATABASE_URL }); await db.connect();
    await db.query(`UPDATE operational_alert_delivery_outbox SET available_at=now() WHERE organization_id=$1 AND status='FAILED'`, [deliveryOrg]); await db.end();
    expect(await deliverOperationalAlerts({ endpoint, workerId: `${prefix}-http-worker`, organizationId: deliveryOrg, limit: 1, fetchImpl: realLocalFetch })).toMatchObject({ delivered: 1, failed: 0 });
    expect(calls).toBeGreaterThanOrEqual(2); expect(new Set(ids).size).toBe(1);
    delete process.env.OPERATIONAL_ALERT_DELIVERY_ENABLED;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const cleanup = new Client({ connectionString: DATABASE_URL }); await cleanup.connect();
    await cleanup.query(`ALTER TABLE operational_alert_delivery_receipts DISABLE TRIGGER trg_operational_alert_receipts_immutable`);
    await cleanup.query(`DELETE FROM operational_alert_delivery_receipts WHERE organization_id=$1`, [deliveryOrg]);
    await cleanup.query(`ALTER TABLE operational_alert_delivery_receipts ENABLE TRIGGER trg_operational_alert_receipts_immutable`);
    await cleanup.query(`DELETE FROM operational_alert_delivery_outbox WHERE organization_id=$1`, [deliveryOrg]);
    await cleanup.query(`DELETE FROM operational_alert_tenant_states WHERE organization_id=$1`, [deliveryOrg]);
    await cleanup.query(`ALTER TABLE operational_alert_signals DISABLE TRIGGER trg_operational_alert_signals_immutable`);
    await cleanup.query(`DELETE FROM operational_alert_signals WHERE organization_id=$1`, [deliveryOrg]);
    await cleanup.query(`ALTER TABLE operational_alert_signals ENABLE TRIGGER trg_operational_alert_signals_immutable`);
    await cleanup.end();
  });
});
