#!/usr/bin/env tsx
import { randomUUID } from 'node:crypto';
import {
  acknowledgeRecoveredTenantAlert,
  evaluateOperationalAlertWindows,
  listOperationalAlertDeliveryState,
  recordOperationalAlertSignal,
} from '../src/services/operationalAlertSignalDeliveryService.js';
import type { OperationalAlertKind } from '../src/services/operationalAlertService.js';
import { listOperationalAlertRepairStatus, redriveOperationalAlertRepairIntent, runOperationalAlertRepairTick } from '../src/services/operationalAlertRepairService.js';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const command = process.argv[2];
  const organizationId = arg('organization');
  if (command === 'repair-status') { console.log(JSON.stringify(await listOperationalAlertRepairStatus(organizationId), null, 2)); return; }
  if (command === 'repair-redrive') { const intentId=arg('intent'); if(!intentId) throw new Error('--intent is required'); console.log(JSON.stringify(await redriveOperationalAlertRepairIntent(intentId), null, 2)); return; }
  if (command === 'repair-tick') { console.log(JSON.stringify(await runOperationalAlertRepairTick({workerId:arg('operator')??'operator-cli'}), null, 2)); return; }
  if (command === 'list') {
    console.log(JSON.stringify(await listOperationalAlertDeliveryState({ organizationId }), null, 2));
    return;
  }
  if (!organizationId) throw new Error('--organization is required');
  const evaluatorId = arg('operator') ?? 'operator-cli';
  if (command === 'ack') {
    const kind = arg('kind') as OperationalAlertKind | undefined;
    if (!kind) throw new Error('--kind is required');
    console.log(JSON.stringify(await acknowledgeRecoveredTenantAlert({ organizationId, kind, evaluatorId }), null, 2));
    return;
  }
  if (command === 'positive-control') {
    const run = randomUUID();
    const now = new Date().toISOString();
    const receipts = [];
    for (let index = 0; index < 5; index++) receipts.push(await recordOperationalAlertSignal({ organizationId, actorId: evaluatorId, correlationId: `positive-control:${run}`, sourceType: 'operator_positive_control', sourceId: `${run}:${index}`, kind: 'REPEATED_AUTH_DENIALS', outcome: 'DENIAL', occurredAt: now, idempotencyKey: `positive-control:${run}:${index}`, metadata: { synthetic: true }, operatorOverride: true }));
    const states = durableOperationalAlertsEnabled() ? await evaluateOperationalAlertWindows({ organizationId, evaluatorId, now }) : [];
    console.log(JSON.stringify({ positiveControlRunId: run, signalReceiptIds: receipts.map((row) => row.signal_id), evaluationDeferred: !durableOperationalAlertsEnabled(), states }, null, 2));
    return;
  }
  throw new Error('usage: operational-alerts.ts list [--organization ID] | ack --organization ID --kind KIND | positive-control --organization ID');
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
