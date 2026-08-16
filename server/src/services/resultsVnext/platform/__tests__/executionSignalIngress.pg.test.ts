import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { consumeNextExecutionSignal } from '../executionSignalIngress.js';

const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_PG = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';

describe.skipIf(!REAL_PG)('RES-FLOW-ADAPTER-001 execution signal ingress', () => {
  const tag = randomUUID();
  const orgA = `res-flow-a-${tag}`;
  const orgB = `res-flow-b-${tag}`;
  const ids: string[] = [];
  let db: Client;

  beforeAll(async () => {
    db = new Client({ connectionString: DATABASE_URL });
    await db.connect();
    for (const [org, suffix] of [
      [orgA, 'a'],
      [orgB, 'b'],
    ] as const) {
      await db.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [org, org]);
      await db.query(`INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$1)`, [
        `p-${tag}-${suffix}`,
        org,
      ]);
      await db.query(
        `INSERT INTO initiatives(id,organization_id,project_id,name) VALUES($1,$2,$3,$1)`,
        [`i-${tag}-${suffix}`, org, `p-${tag}-${suffix}`]
      );
      await db.query(
        `INSERT INTO case_core(case_id,organization_id,project_id,contracted_closure_type,created_by_actor_id,case_name)
         VALUES($1,$2,$3,'DELIVERY_COMPLETED','test',$1)`,
        [`c-${tag}-${suffix}`, org, `p-${tag}-${suffix}`]
      );
      await db.query(
        `INSERT INTO case_workspace_artifact_links
           (link_id,organization_id,project_id,case_id,artifact_type,artifact_id,
            artifact_revision,relation,linked_by_actor_id,linked_at)
         VALUES($1,$2,$3,$4,'document',$5,'r1','DELIVERABLE','test',now()::text)`,
        [
          `artifact-${tag}-${suffix}`,
          org,
          `p-${tag}-${suffix}`,
          `c-${tag}-${suffix}`,
          `document-${tag}-${suffix}`,
        ]
      );
      const link = await db.query<{ link_id: string }>(
        `INSERT INTO execution_case_links(organization_id,initiative_id,case_id,project_id,intake_idempotency_key,status,created_by) VALUES($1,$2,$3,$4,$5,'CLOSED','test') RETURNING link_id`,
        [
          org,
          `i-${tag}-${suffix}`,
          `c-${tag}-${suffix}`,
          `p-${tag}-${suffix}`,
          `intake-${tag}-${suffix}`,
        ]
      );
      const evidence = await db.query<{ evidence_id: string }>(
        `INSERT INTO execution_delivery_evidence(organization_id,execution_link_id,artifact_link_id,artifact_revision,content_digest,approval_status,submitted_by,approved_by,idempotency_key) VALUES($1,$2,$3,'r1','digest','APPROVED','submitter','approver',$4) RETURNING evidence_id`,
        [org, link.rows[0].link_id, `artifact-${tag}-${suffix}`, `evidence-${tag}-${suffix}`]
      );
      const signal = await db.query<{ signal_id: string }>(
        `INSERT INTO execution_results_signal_outbox(organization_id,execution_link_id,initiative_id,case_id,evidence_id,payload_json,idempotency_key) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING signal_id`,
        [
          org,
          link.rows[0].link_id,
          `i-${tag}-${suffix}`,
          `c-${tag}-${suffix}`,
          evidence.rows[0].evidence_id,
          JSON.stringify({ evidenceId: evidence.rows[0].evidence_id }),
          `signal-${tag}-${suffix}`,
        ]
      );
      ids.push(signal.rows[0].signal_id);
    }
  });

  afterAll(async () => {
    if (db) await db.end();
  });

  it('is tenant-scoped and exactly-once under concurrency', async () => {
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () => consumeNextExecutionSignal({ organizationId: orgA }))
    );
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    expect(outcomes.find(Boolean)?.signalId).toBe(ids[0]);
    expect(await consumeNextExecutionSignal({ organizationId: orgA })).toBeNull();
    const rows = await db.query(
      `SELECT * FROM rvn_execution_signal_receipts WHERE organization_id=$1`,
      [orgA]
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].source_signal_id).toBe(ids[0]);
    const other = await db.query(
      `SELECT delivery_status FROM execution_results_signal_outbox WHERE signal_id=$1`,
      [ids[1]]
    );
    expect(other.rows[0].delivery_status).toBe('PENDING');
  });

  it('reclaims a stale lease after restart and preserves one immutable receipt', async () => {
    await db.query(
      `UPDATE execution_results_signal_outbox SET payload_version=99 WHERE signal_id=$1`,
      [ids[1]]
    );
    expect(await consumeNextExecutionSignal({ organizationId: orgB })).toBeNull();
    const rejected = await db.query(
      `SELECT delivery_status,last_error FROM execution_results_signal_outbox WHERE signal_id=$1`,
      [ids[1]]
    );
    expect(rejected.rows[0]).toMatchObject({
      delivery_status: 'FAILED',
      last_error: 'unsupported_execution_signal_payload_version:99',
    });
    await db.query(
      `UPDATE execution_results_signal_outbox SET payload_version=1,delivery_status='PROCESSING',claimed_at=now()-interval '10 minutes' WHERE signal_id=$1`,
      [ids[1]]
    );
    const first = await consumeNextExecutionSignal({ organizationId: orgB });
    expect(first?.signalId).toBe(ids[1]);
    expect(await consumeNextExecutionSignal({ organizationId: orgB })).toBeNull();
    const persisted = await db.query(
      `SELECT r.source_signal_id,s.delivery_status,s.attempt_count FROM rvn_execution_signal_receipts r JOIN execution_results_signal_outbox s ON s.signal_id=r.source_signal_id WHERE r.organization_id=$1`,
      [orgB]
    );
    expect(persisted.rows).toHaveLength(1);
    expect(persisted.rows[0]).toMatchObject({
      source_signal_id: ids[1],
      delivery_status: 'DELIVERED',
      attempt_count: 2,
    });
    await expect(
      db.query(
        `UPDATE rvn_execution_signal_receipts SET signal_type='tampered' WHERE source_signal_id=$1`,
        [ids[1]]
      )
    ).rejects.toThrow(/immutable/);
  });
});
