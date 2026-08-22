import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const runRealDb =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
const describeRealDb = runRealDb ? describe : describe.skip;
const prefix = `fin-settings-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const actor = `${prefix}-actor`;
let app: Express;

async function db() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}

let service: typeof import('../financeSettingsCommandService.js');

beforeAll(async () => {
  if (!runRealDb) return;
  const databaseName = new URL(DATABASE_URL).pathname.slice(1);
  if (
    process.env.FIN_SETTINGS_ALLOW_IMMUTABLE_FIXTURE_CLEANUP !== '1' ||
    !databaseName.startsWith(process.env.FIN_SETTINGS_DISPOSABLE_DB_PREFIX || 'never-match')
  ) {
    throw new Error('Finance settings proof requires an explicitly guarded disposable database');
  }
  const client = await db();
  try {
    await client.query(
      `INSERT INTO organizations(id,name) VALUES($1,'Settings A'),($2,'Settings B')`,
      [orgA, orgB]
    );
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
      `INSERT INTO organization_settings(organization_id,setting_key,setting_value,updated_at)
       VALUES($1,'finance',$2,now())`,
      [orgA, JSON.stringify({ defaultWacc: 9, defaultCurrency: 'EUR', defaultHorizonYears: 5 })]
    );
  } finally {
    await client.end();
  }
  service = await import('../financeSettingsCommandService.js');
  const financeRouter = (await import('../../../../routes/v8/finance.routes.js')).default;
  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: actor, organizationId: orgA, role: 'OWNER' };
    (req as any).userId = actor;
    (req as any).organizationId = orgA;
    (req as any).v8Context = { organizationId: orgA, userId: actor, userRole: 'OWNER' };
    next();
  });
  app.use('/api/v8/finance', financeRouter);
});

afterAll(async () => {
  if (!runRealDb) return;
  service?.setFinanceSettingsCommandFaultInjectorForTests(null);
  const client = await db();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL session_replication_role=replica`);
    await client.query(
      `DELETE FROM finance_settings_command_receipts WHERE organization_id=ANY($1::text[])`,
      [[orgA, orgB]]
    );
    await client.query(
      `DELETE FROM finance_settings_states WHERE organization_id=ANY($1::text[])`,
      [[orgA, orgB]]
    );
    await client.query(
      `DELETE FROM organization_settings WHERE organization_id=ANY($1::text[]) AND setting_key='finance'`,
      [[orgA, orgB]]
    );
    await client.query(`DELETE FROM organization_members WHERE organization_id=ANY($1::text[])`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM users WHERE id=$1`, [actor]);
    await client.query(`DELETE FROM organizations WHERE id=ANY($1::text[])`, [[orgA, orgB]]);
    await client.query('COMMIT');
    const state = await client.query<{ residue: string; disabled: string }>(
      `SELECT
         ((SELECT count(*) FROM finance_settings_command_receipts WHERE organization_id=ANY($1::text[]))+
          (SELECT count(*) FROM finance_settings_states WHERE organization_id=ANY($1::text[]))+
          (SELECT count(*) FROM organization_settings WHERE organization_id=ANY($1::text[]))+
          (SELECT count(*) FROM organizations WHERE id=ANY($1::text[])))::text residue,
         (SELECT count(*)::text FROM pg_trigger WHERE NOT tgisinternal AND tgenabled <> 'O') disabled`,
      [[orgA, orgB]]
    );
    expect(state.rows[0]).toEqual({ residue: '0', disabled: '0' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
});

describeRealDb('ECO-W42 canonical Finance settings command (real PostgreSQL)', () => {
  it('adopts the existing legacy value at version 0 and atomically writes version 1 plus projection', async () => {
    expect(await service.readCanonicalFinanceSettings(orgA)).toEqual({
      defaultWacc: 9,
      defaultCurrency: 'EUR',
      defaultHorizonYears: 5,
      version: 0,
    });
    const first = await service.updateCanonicalFinanceSettings({
      organizationId: orgA,
      actorId: actor,
      idempotencyKey: `${prefix}-first`,
      expectedVersion: 0,
      patch: { defaultHorizonYears: 7 },
    });
    expect(first).toMatchObject({
      idempotentReplay: false,
      state: {
        defaultWacc: 9,
        defaultCurrency: 'EUR',
        defaultHorizonYears: 7,
        version: 1,
      },
    });
    expect(await service.readCanonicalFinanceSettings(orgA)).toEqual(first.state);
    const client = await db();
    const projection = await client.query<{ setting_value: unknown }>(
      `SELECT setting_value FROM organization_settings
        WHERE organization_id=$1 AND setting_key='finance'`,
      [orgA]
    );
    await client.end();
    const projected =
      typeof projection.rows[0].setting_value === 'string'
        ? JSON.parse(projection.rows[0].setting_value)
        : projection.rows[0].setting_value;
    expect(projected).toMatchObject({
      defaultWacc: 9,
      defaultCurrency: 'EUR',
      defaultHorizonYears: 7,
    });
  });

  it('cold replay returns the same receipt and collisions or stale CAS fail closed', async () => {
    const replay = await service.updateCanonicalFinanceSettings({
      organizationId: orgA,
      actorId: actor,
      idempotencyKey: `${prefix}-first`,
      expectedVersion: 0,
      patch: { defaultHorizonYears: 7 },
    });
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.state.version).toBe(1);
    await expect(
      service.updateCanonicalFinanceSettings({
        organizationId: orgA,
        actorId: actor,
        idempotencyKey: `${prefix}-first`,
        expectedVersion: 0,
        patch: { defaultHorizonYears: 8 },
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_COLLISION', status: 409 });
    await expect(
      service.updateCanonicalFinanceSettings({
        organizationId: orgA,
        actorId: actor,
        idempotencyKey: `${prefix}-stale`,
        expectedVersion: 0,
        patch: { defaultCurrency: 'PLN' },
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT', status: 409 });
  });

  it('serializes concurrent commands so only one expected-version winner commits', async () => {
    const results = await Promise.allSettled(
      ['PLN', 'USD'].map((currency) =>
        service.updateCanonicalFinanceSettings({
          organizationId: orgA,
          actorId: actor,
          idempotencyKey: `${prefix}-race-${currency}`,
          expectedVersion: 1,
          patch: { defaultCurrency: currency },
        })
      )
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await service.readCanonicalFinanceSettings(orgA)).version).toBe(2);
  });

  it('replays an old partial command after later state changes without a false collision', async () => {
    const replay = await service.updateCanonicalFinanceSettings({
      organizationId: orgA,
      actorId: actor,
      idempotencyKey: `${prefix}-first`,
      expectedVersion: 0,
      patch: { defaultHorizonYears: 7 },
    });
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.state).toMatchObject({ version: 1, defaultCurrency: 'EUR' });
  });

  it('rolls back canonical state, compatibility projection and receipt together', async () => {
    service.setFinanceSettingsCommandFaultInjectorForTests(() => {
      throw new Error('forced-settings-receipt-failure');
    });
    await expect(
      service.updateCanonicalFinanceSettings({
        organizationId: orgB,
        actorId: actor,
        idempotencyKey: `${prefix}-rollback`,
        expectedVersion: 0,
        patch: { defaultCurrency: 'USD' },
      })
    ).rejects.toThrow('forced-settings-receipt-failure');
    service.setFinanceSettingsCommandFaultInjectorForTests(null);
    const client = await db();
    const residue = await client.query<{ state: number; projection: number; receipt: number }>(
      `SELECT
        (SELECT count(*)::int FROM finance_settings_states WHERE organization_id=$1) state,
        (SELECT count(*)::int FROM organization_settings WHERE organization_id=$1 AND setting_key='finance') projection,
        (SELECT count(*)::int FROM finance_settings_command_receipts WHERE organization_id=$1) receipt`,
      [orgB]
    );
    await client.end();
    expect(residue.rows[0]).toEqual({ state: 0, projection: 0, receipt: 0 });
  });

  it('keeps receipts append-only and denies foreign or invalid settings', async () => {
    await expect(service.readCanonicalFinanceSettings(`${prefix}-missing`)).rejects.toMatchObject({
      code: 'ORGANIZATION_NOT_FOUND',
      status: 404,
    });
    await expect(
      service.updateCanonicalFinanceSettings({
        organizationId: orgA,
        actorId: actor,
        idempotencyKey: `${prefix}-invalid`,
        expectedVersion: 2,
        patch: { defaultCurrency: 'EURO' },
      })
    ).rejects.toMatchObject({ code: 'FINANCE_SETTINGS_INVALID', status: 400 });
    const client = await db();
    await expect(
      client.query(
        `UPDATE finance_settings_command_receipts SET request_hash=$1 WHERE organization_id=$2`,
        ['f'.repeat(64), orgA]
      )
    ).rejects.toMatchObject({ code: '55000' });
    await client.end();
  });

  it('mounts authenticated GET and Finance-editor PUT with exact HTTP replay semantics', async () => {
    const read = await request(app).get('/api/v8/finance/settings');
    expect(read.status).toBe(200);
    expect(read.body.data.version).toBe(2);
    const key = `${prefix}-http`;
    const first = await request(app)
      .put('/api/v8/finance/settings')
      .set('Idempotency-Key', key)
      .send({
        expectedVersion: 2,
        settings: {
          defaultWacc: 10,
          defaultCurrency: 'GBP',
          defaultHorizonYears: 6,
        },
      });
    expect(first.status).toBe(201);
    expect(first.body.data.state).toMatchObject({ version: 3, defaultCurrency: 'GBP' });
    const replay = await request(app)
      .put('/api/v8/finance/settings')
      .set('Idempotency-Key', key)
      .send({
        expectedVersion: 2,
        settings: {
          defaultWacc: 10,
          defaultCurrency: 'GBP',
          defaultHorizonYears: 6,
        },
      });
    expect(replay.status).toBe(200);
    expect(replay.body.data.receiptId).toBe(first.body.data.receiptId);
    expect(replay.body.data.idempotentReplay).toBe(true);
  });
});
