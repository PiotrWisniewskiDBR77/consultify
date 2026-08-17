/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  completeLegacyCutoverIntent,
  registerLegacyCutoverIntent,
  repairAbandonedLegacyCutoverIntents,
} from '../legacyCutoverIntentService.js';

const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
const url = process.env.DATABASE_URL || '';
const prefix = `b1-intent-${randomUUID()}`;
const org = `${prefix}-org`;
const base = (requestId: string) => ({
  domain: 'finance', writerId: 'FIN-W02', organizationId: org,
  tenantResolution: 'resolved' as const, requestId, userId: `${prefix}-user`, method: 'POST',
  routePath: '/api/financial-modeling/models/x/approve',
  accessKind: 'legacy_uncovered_writer' as const, successorPath: '/api/v8/finance',
  legacyTable: null, legacyId: null, canonicalArtifactId: null,
  canonicalBusinessVersionId: null, canonicalWorkingRevisionId: null,
  identityStatus: 'not_applicable' as const,
});
let db: Client;

describe.skipIf(!enabled)('B1 durable legacy intent lifecycle realPG', () => {
  beforeAll(async () => { db = new Client({ connectionString: url }); await db.connect(); });
  afterAll(async () => {
    await db.query(`DELETE FROM legacy_cutover_signal_intents WHERE organization_id=$1`, [org]);
    await db.end();
  });

  it('registers durably before terminal completion and completes the same intent', async () => {
    const registered = await registerLegacyCutoverIntent(base(`${prefix}-complete`), 'key-1');
    const cold = await db.query(`SELECT status,terminal_result FROM legacy_cutover_signal_intents WHERE intent_id=$1`, [registered.intentId]);
    expect(cold.rows[0]).toMatchObject({ status: 'REGISTERED', terminal_result: null });
    expect(await completeLegacyCutoverIntent({ intentId: registered.intentId, terminalStatus: 201, terminalResult: 'passed', source: 'finish' })).toBe(true);
    expect(await completeLegacyCutoverIntent({ intentId: registered.intentId, terminalStatus: 201, terminalResult: 'passed', source: 'close' })).toBe(false);
    const terminal = await db.query(`SELECT status,terminal_status,terminal_result FROM legacy_cutover_signal_intents WHERE intent_id=$1`, [registered.intentId]);
    expect(terminal.rows[0]).toMatchObject({ status: 'COMPLETED', terminal_status: 201, terminal_result: 'passed' });
  });

  it('deduplicates an exact request and rejects a fingerprint collision', async () => {
    const input = base(`${prefix}-dedupe`);
    const first = await registerLegacyCutoverIntent(input, 'key-2');
    expect((await registerLegacyCutoverIntent(input, 'key-2')).intentId).toBe(first.intentId);
    await expect(registerLegacyCutoverIntent({ ...input, routePath: '/different' }, 'key-2'))
      .rejects.toThrow('LEGACY_CUTOVER_INTENT_COLLISION');
  });

  it('repairs abandoned registered work conservatively, never as passed', async () => {
    const row = await registerLegacyCutoverIntent(base(`${prefix}-repair`), null);
    await db.query(`UPDATE legacy_cutover_signal_intents SET created_at=now()-interval '2 hours' WHERE intent_id=$1`, [row.intentId]);
    expect(await repairAbandonedLegacyCutoverIntents(60, 10)).toBeGreaterThanOrEqual(1);
    const repaired = await db.query(`SELECT status,terminal_result,completion_source FROM legacy_cutover_signal_intents WHERE intent_id=$1`, [row.intentId]);
    expect(repaired.rows[0]).toEqual({ status: 'ABORTED_UNKNOWN', terminal_result: 'aborted_unknown', completion_source: 'repair' });
  });

  it('fences concurrent repair workers to one terminal transition', async () => {
    const row = await registerLegacyCutoverIntent(base(`${prefix}-repair-race`), null);
    await db.query(`UPDATE legacy_cutover_signal_intents SET created_at=now()-interval '2 hours' WHERE intent_id=$1`, [row.intentId]);
    const counts = await Promise.all([
      repairAbandonedLegacyCutoverIntents(60, 1),
      repairAbandonedLegacyCutoverIntents(60, 1),
    ]);
    expect(counts.reduce((sum, n) => sum + n, 0)).toBe(1);
    const terminal = await db.query(`SELECT status,fencing_version FROM legacy_cutover_signal_intents WHERE intent_id=$1`, [row.intentId]);
    expect(terminal.rows[0]).toEqual({ status: 'ABORTED_UNKNOWN', fencing_version: 1 });
  });

  it('rejects direct SQL mutation of a terminal intent', async () => {
    const row = await registerLegacyCutoverIntent(base(`${prefix}-immutable`), null);
    await completeLegacyCutoverIntent({ intentId: row.intentId, terminalStatus: 200, terminalResult: 'passed', source: 'finish' });
    await expect(db.query(`UPDATE legacy_cutover_signal_intents SET status='REGISTERED',terminal_result=NULL,completed_at=NULL WHERE intent_id=$1`, [row.intentId]))
      .rejects.toThrow('LEGACY_CUTOVER_INTENT_TERMINAL_IMMUTABLE');
  });
});
