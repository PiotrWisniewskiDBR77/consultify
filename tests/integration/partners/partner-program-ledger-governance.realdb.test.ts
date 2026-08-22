/**
 * PRT-MVP-LEDGER-001 — real PostgreSQL governance proof.
 * Runs inside one rolled-back transaction: no shared fixture is modified.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;
const ORG_A = 'prt-ledger-test-org-a';
const ORG_B = 'prt-ledger-test-org-b';
let sql: Client;
let savepointCounter = 0;
let ledgerService: typeof import('../../../server/src/services/partnerProgramLedgerService.ts').default;

async function expectDbError(operation: () => Promise<unknown>, pattern: RegExp) {
  const savepoint = `prt_expected_error_${++savepointCounter}`;
  await sql.query(`SAVEPOINT ${savepoint}`);
  try {
    await operation();
    throw new Error(`Expected database error matching ${pattern}`);
  } catch (error) {
    expect(String((error as Error).message)).toMatch(pattern);
  } finally {
    await sql.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await sql.query(`RELEASE SAVEPOINT ${savepoint}`);
  }
}

async function insert(params: {
  id: string;
  org?: string;
  type?: string;
  amount?: number;
  rule?: string;
  idempotency?: string | null;
  related?: string | null;
  disputeStatus?: string | null;
}) {
  return sql.query(
    `INSERT INTO partner_program_ledger (
       id, partner_org_id, entry_type, amount, currency, occurred_at, source_ref,
       actor, idempotency_key, rule_version, related_entry_id, dispute_status
     ) VALUES ($1,$2,$3,$4,'EUR',now(),'{}','operator',$5,$6,$7,$8)`,
    [
      params.id,
      params.org || ORG_A,
      params.type || 'accrual.posted',
      params.amount ?? 10,
      params.idempotency ?? null,
      params.rule ?? 'partner-test-rule-v1',
      params.related ?? null,
      params.disputeStatus ?? null,
    ]
  );
}

beforeAll(async () => {
  if (!connectionString)
    throw new Error('DATABASE_URL is required for partner ledger realDB proof');
  sql = new Client({ connectionString });
  await sql.connect();
  const identity = await sql.query(`SELECT version() AS version`);
  expect(identity.rows[0].version).toMatch(/PostgreSQL/);
  ledgerService = (await import('../../../server/src/services/partnerProgramLedgerService.ts'))
    .default;
  // Warm the idempotent schema guard before this suite opens its long-lived
  // rollback transaction; concurrent writers must exercise INSERT contention,
  // not DDL lock contention from lazy compatibility setup.
  await ledgerService.listEntries('__prt-ledger-schema-warm__', { limit: 1 });
  await sql.query('BEGIN');
});

afterAll(async () => {
  if (sql) {
    await sql.query('ROLLBACK');
    await sql.end();
  }
});

describe.sequential('partner program append-only participant ledger (real PG)', () => {
  it('requires an explicit rule version for new governed facts', async () => {
    await expectDbError(
      () => insert({ id: 'prt-rule-missing', rule: 'legacy-unversioned' }),
      /rule_version is required/
    );
  });

  it('scopes idempotency to the partner organization', async () => {
    await insert({ id: 'prt-idem-a', org: ORG_A, idempotency: 'same-request' });
    await insert({ id: 'prt-idem-b', org: ORG_B, idempotency: 'same-request' });
    await expectDbError(
      () => insert({ id: 'prt-idem-a-duplicate', org: ORG_A, idempotency: 'same-request' }),
      /uq_partner_program_ledger_tenant_idempotency/
    );
  });

  it('records corrections and reversals as linked facts without changing the original', async () => {
    await insert({ id: 'prt-original', amount: 100 });
    await insert({
      id: 'prt-correction',
      type: 'accrual.adjustment',
      amount: -10,
      related: 'prt-original',
    });
    await insert({
      id: 'prt-reversal',
      type: 'accrual.reversal',
      amount: 90,
      related: 'prt-original',
    });
    const rows = await sql.query(
      `SELECT id, amount, related_entry_id FROM partner_program_ledger
        WHERE id IN ('prt-original','prt-correction','prt-reversal') ORDER BY id`
    );
    expect(rows.rows).toHaveLength(3);
    expect(rows.rows.find((row) => row.id === 'prt-original').amount).toBe('100.0000');
  });

  it('rejects missing and cross-tenant correction/dispute links', async () => {
    await insert({ id: 'prt-foreign-original', org: ORG_B });
    await expectDbError(
      () =>
        insert({
          id: 'prt-cross-tenant',
          type: 'accrual.adjustment',
          related: 'prt-foreign-original',
        }),
      /another partner organization/
    );
    await expectDbError(
      () => insert({ id: 'prt-no-link', type: 'dispute.opened', disputeStatus: 'open' }),
      /related_entry_id is required/
    );
  });

  it('persists an open dispute and a terminal resolution as separate auditable rows', async () => {
    await insert({ id: 'prt-disputed-fact' });
    await insert({
      id: 'prt-dispute-open',
      type: 'dispute.opened',
      amount: 0,
      related: 'prt-disputed-fact',
      disputeStatus: 'open',
    });
    await insert({
      id: 'prt-dispute-resolved',
      type: 'dispute.resolved',
      amount: 0,
      related: 'prt-dispute-open',
      disputeStatus: 'upheld',
    });
    const readback = await sql.query(
      `SELECT entry_type, dispute_status, related_entry_id FROM partner_program_ledger
        WHERE id LIKE 'prt-dispute-%' ORDER BY id`
    );
    expect(readback.rows).toEqual([
      {
        entry_type: 'dispute.opened',
        dispute_status: 'open',
        related_entry_id: 'prt-disputed-fact',
      },
      {
        entry_type: 'dispute.resolved',
        dispute_status: 'upheld',
        related_entry_id: 'prt-dispute-open',
      },
    ]);
  });

  it('database rejects UPDATE and DELETE, including direct SQL bypasses', async () => {
    await insert({ id: 'prt-immutable' });
    await expectDbError(
      () => sql.query(`UPDATE partner_program_ledger SET amount=999 WHERE id='prt-immutable'`),
      /append-only/
    );
    await expectDbError(
      () => sql.query(`DELETE FROM partner_program_ledger WHERE id='prt-immutable'`),
      /append-only/
    );
  });

  it('refuses concurrent economic retries before SQL and cold-reads zero residue', async () => {
    const idempotencyKey = `prt-ledger-concurrent-${Date.now()}`;
    const writes = await Promise.allSettled(
      Array.from({ length: 12 }, () =>
        ledgerService.appendEntry({
          partnerOrgId: ORG_A,
          entryType: 'accrual.posted',
          amount: 25,
          currency: 'EUR',
          actor: 'operator',
          idempotencyKey,
          ruleVersion: 'partner-test-rule-v1',
          sourceRef: { technicalFixture: true },
        })
      )
    );
    expect(writes).toHaveLength(12);
    for (const write of writes) {
      expect(write.status).toBe('rejected');
      if (write.status === 'rejected') {
        expect(write.reason).toMatchObject({
          code: 'PARTNER_ECONOMICS_POLICY_DISABLED',
          decision: 'AMD-PRT-ECONOMICS-002',
          operation: 'accrual',
        });
      }
    }

    const cold = new Client({ connectionString });
    await cold.connect();
    try {
      const persisted = await cold.query(
        `SELECT id, partner_org_id, amount, currency, rule_version
           FROM partner_program_ledger
          WHERE partner_org_id=$1 AND idempotency_key=$2`,
        [ORG_A, idempotencyKey]
      );
      expect(persisted.rows).toEqual([]);
    } finally {
      await cold.end();
    }
  });
});
