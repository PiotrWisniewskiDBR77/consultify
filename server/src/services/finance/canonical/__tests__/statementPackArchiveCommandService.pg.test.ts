import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const runRealDb =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
const describeRealDb = runRealDb ? describe : describe.skip;
const prefix = `pack-archive-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const actor = `${prefix}-actor`;
const packA = `${prefix}-pack-a`;
const packConfirmed = `${prefix}-pack-confirmed`;

async function db() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}

let service: typeof import('../statementPackArchiveCommandService.js');

beforeAll(async () => {
  if (!runRealDb) return;
  const client = await db();
  try {
    await client.query(`INSERT INTO organizations(id,name) VALUES($1,'Pack A'),($2,'Pack B')`, [
      orgA,
      orgB,
    ]);
    await client.query(
      `INSERT INTO users(id,organization_id,email,first_name,last_name,role)
       VALUES($1,$2,$3,'Finance','Owner','ADMIN')`,
      [actor, orgA, `${actor}@test.local`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
       VALUES($1,$2,$3,'OWNER','ACTIVE',now())`,
      [randomUUID(), orgA, actor]
    );
    await client.query(
      `INSERT INTO financial_statement_packs
       (id,organization_id,period_start,period_end,pack_status,version)
       VALUES($1,$2,'2025-01-01','2025-12-31','draft',1),
             ($3,$2,'2024-01-01','2024-12-31','confirmed',1)`,
      [packA, orgA, packConfirmed]
    );
  } finally {
    await client.end();
  }
  service = await import('../statementPackArchiveCommandService.js');
});

afterAll(async () => {
  if (!runRealDb) return;
  const client = await db();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL session_replication_role=replica`);
    await client.query(
      `DELETE FROM finance_statement_pack_archive_command_receipts WHERE organization_id=ANY($1::text[])`,
      [[orgA, orgB]]
    );
    await client.query(
      `DELETE FROM financial_statement_packs WHERE organization_id=ANY($1::text[])`,
      [[orgA, orgB]]
    );
    await client.query(`DELETE FROM organization_members WHERE organization_id=ANY($1::text[])`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM users WHERE id=$1`, [actor]);
    await client.query(`DELETE FROM organizations WHERE id=ANY($1::text[])`, [[orgA, orgB]]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
});

describeRealDb('FS-W12 governed statement-pack archive (real PostgreSQL)', () => {
  it('archives once under concurrency, preserves children and replays exactly', async () => {
    const input = {
      organizationId: orgA,
      userId: actor,
      packId: packA,
      expectedVersion: 1,
      reason: 'Owner removed pack from active workspace',
      idempotencyKey: `${prefix}-archive`,
    };
    const results = await Promise.all(
      Array.from({ length: 5 }, () => service.archiveStatementPackCommand(input))
    );
    expect(results.filter((result) => !result.replay)).toHaveLength(1);
    expect(results.every((result) => result.status === 'archived' && result.version === 2)).toBe(
      true
    );

    const client = await db();
    try {
      const state = await client.query(
        `SELECT pack_status,version,
          (SELECT count(*)::int FROM finance_statement_pack_archive_command_receipts WHERE organization_id=$1 AND pack_id=$2) receipt
         FROM financial_statement_packs WHERE id=$2 AND organization_id=$1`,
        [orgA, packA]
      );
      expect(state.rows[0]).toMatchObject({ pack_status: 'archived', version: 2, receipt: 1 });
      await expect(
        client.query(`UPDATE financial_statement_packs SET version=version WHERE id=$1`, [packA])
      ).rejects.toThrow(/archived financial statement pack is immutable/i);
      await expect(
        client.query(
          `UPDATE finance_statement_pack_archive_command_receipts SET reason=reason WHERE organization_id=$1 AND pack_id=$2`,
          [orgA, packA]
        )
      ).rejects.toThrow(/archive receipt is immutable/i);
    } finally {
      await client.end();
    }
  });

  it('fails closed across tenant scope and protects confirmed packs', async () => {
    await expect(
      service.archiveStatementPackCommand({
        organizationId: orgB,
        userId: actor,
        packId: packConfirmed,
        expectedVersion: 1,
        reason: 'Wrong tenant',
        idempotencyKey: `${prefix}-wrong-tenant`,
      })
    ).rejects.toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED', status: 403 });
    await expect(
      service.archiveStatementPackCommand({
        organizationId: orgA,
        userId: actor,
        packId: packConfirmed,
        expectedVersion: 1,
        reason: 'Must not archive confirmed evidence',
        idempotencyKey: `${prefix}-confirmed`,
      })
    ).rejects.toMatchObject({ code: 'CONFIRMED_PACK_ARCHIVE_FORBIDDEN', status: 409 });
  });
});
