import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const DB_PREFIX = process.env.RESULTS_OBSERVATION_MIGRATION_DB_PREFIX ?? '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  process.env.RESULTS_OBSERVATION_MIGRATION_CLEANUP === '1' &&
  DATABASE_URL.startsWith('postgres') &&
  DB_PREFIX.length > 0;

const suite = enabled ? describe : describe.skip;

suite.sequential('Results14 observability migration — exact late-safe contract', () => {
  let pool: pg.Pool;
  let migrationSql: string;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
    const db = await pool.query<{ db: string }>('SELECT current_database() AS db');
    if (!String(db.rows[0]?.db ?? '').startsWith(DB_PREFIX)) {
      throw new Error('RESULTS14_DISPOSABLE_DB_MISMATCH');
    }
    migrationSql = await readFile(
      'server/migrations/20261014_results_writer_observability_ledger.sql',
      'utf8'
    );
  });

  afterAll(async () => {
    await pool?.end();
  });

  function sqlForSchema(schema: string): string {
    return migrationSql
      .replaceAll("'public.results_writer_observations'", `'${schema}.results_writer_observations'`)
      .replaceAll(
        "'public.uq_results_writer_observation_tenant_correlated_op'",
        `'${schema}.uq_results_writer_observation_tenant_correlated_op'`
      )
      .replaceAll(
        "'public.uq_results_writer_observation_correlated_op'",
        `'${schema}.uq_results_writer_observation_correlated_op'`
      )
      .replaceAll("table_schema = 'public'", `table_schema = '${schema}'`)
      .replaceAll(
        'public.uq_results_writer_observation_correlated_op',
        `${schema}.uq_results_writer_observation_correlated_op`
      );
  }

  const correctCheck = `CHECK(writer_family IN ('legacy_kpi_crud','kpi_reports','vnext_kpi','execution_results','results_finance'))`;
  const rowValues = `('obs-1','org-a','actor','legacy_kpi_crud','create','/x','corr-1',now())`;

  async function inSchema(
    name: string,
    run: (client: pg.PoolClient, schema: string) => Promise<void>
  ): Promise<void> {
    const schema = `results14_${name}_${randomUUID().replace(/-/g, '').slice(0, 7)}`;
    const client = await pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock($1)', [20261014]);
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema},public`);
      await run(client, schema);
    } finally {
      await client.query('SET search_path TO public').catch(() => {});
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
      await client.query('SELECT pg_advisory_unlock($1)', [20261014]).catch(() => {});
      client.release();
    }
  }

  async function expectFailBeforeMutation(
    name: string,
    ddl: string,
    expected: RegExp
  ): Promise<void> {
    await inSchema(name, async (client, schema) => {
      await client.query(ddl);
      const beforeColumns = await client.query(
        `SELECT column_name,data_type,is_nullable,column_default
           FROM information_schema.columns
          WHERE table_schema=$1 AND table_name='results_writer_observations'
          ORDER BY ordinal_position`,
        [schema]
      );
      const beforeRows = await client.query(
        'SELECT row_to_json(t)::text AS row FROM results_writer_observations t ORDER BY 1'
      );
      await expect(client.query(sqlForSchema(schema))).rejects.toThrow(expected);
      expect(
        (
          await client.query(
            `SELECT column_name,data_type,is_nullable,column_default
               FROM information_schema.columns
              WHERE table_schema=$1 AND table_name='results_writer_observations'
              ORDER BY ordinal_position`,
            [schema]
          )
        ).rows
      ).toEqual(beforeColumns.rows);
      expect(
        (
          await client.query(
            'SELECT row_to_json(t)::text AS row FROM results_writer_observations t ORDER BY 1'
          )
        ).rows
      ).toEqual(beforeRows.rows);
    });
  }

  it('rejects wrong PK, wrong type and non-unique observation ids before mutation', async () => {
    const columns = `(observation_id text,organization_id text,actor_user_id text,writer_family text,operation text,endpoint text,correlation_id text,created_at timestamptz)`;
    await expectFailBeforeMutation(
      'wrong_pk',
      `CREATE TABLE results_writer_observations ${columns}; ALTER TABLE results_writer_observations ADD PRIMARY KEY(correlation_id); INSERT INTO results_writer_observations VALUES ${rowValues}`,
      /PRIMARY KEY is over/
    );
    await expectFailBeforeMutation(
      'wrong_type',
      `CREATE TABLE results_writer_observations(observation_id text primary key,organization_id text,actor_user_id text,writer_family integer,operation text,endpoint text,correlation_id text,created_at timestamptz); INSERT INTO results_writer_observations VALUES('obs-1','org-a','actor',1,'create','\/x','corr-1',now())`,
      /wrong column type/
    );
    await expectFailBeforeMutation(
      'nonunique_id',
      `CREATE TABLE results_writer_observations ${columns}; INSERT INTO results_writer_observations VALUES ${rowValues},('obs-1','org-b','actor','legacy_kpi_crud','create','/x','corr-2',now())`,
      /no PRIMARY KEY/
    );
  });

  it('rejects wrong-order and partial target indexes before mutation', async () => {
    const base = `CREATE TABLE results_writer_observations(observation_id text primary key,organization_id text,actor_user_id text,writer_family text,operation text,endpoint text,correlation_id text,created_at timestamptz,CONSTRAINT results_writer_observations_writer_family_check ${correctCheck}); INSERT INTO results_writer_observations VALUES ${rowValues};`;
    await expectFailBeforeMutation(
      'wrong_order',
      `${base} CREATE UNIQUE INDEX uq_results_writer_observation_tenant_correlated_op ON results_writer_observations(correlation_id,organization_id,writer_family,operation)`,
      /tenant-scoped index is over/
    );
    await expectFailBeforeMutation(
      'partial',
      `${base} CREATE UNIQUE INDEX uq_results_writer_observation_tenant_correlated_op ON results_writer_observations(organization_id,correlation_id,writer_family,operation) WHERE organization_id='org-a'`,
      /PARTIAL/
    );
  });

  it('rejects OR-true and extra-family CHECKs before mutation', async () => {
    const table = (check: string) =>
      `CREATE TABLE results_writer_observations(observation_id text primary key,organization_id text,actor_user_id text,writer_family text,operation text,endpoint text,correlation_id text,created_at timestamptz,CONSTRAINT results_writer_observations_writer_family_check ${check}); INSERT INTO results_writer_observations VALUES ${rowValues}`;
    await expectFailBeforeMutation(
      'or_true',
      table(
        `CHECK(writer_family IN ('legacy_kpi_crud','kpi_reports','vnext_kpi','execution_results','results_finance') OR true)`
      ),
      /CHECK has an unexpected definition/
    );
    await expectFailBeforeMutation(
      'extra_family',
      table(
        `CHECK(writer_family IN ('legacy_kpi_crud','kpi_reports','vnext_kpi','execution_results','results_finance','extra'))`
      ),
      /CHECK has an unexpected definition/
    );
  });

  it('rejects duplicate target-key rows before adding any column or index', async () => {
    await expectFailBeforeMutation(
      'duplicate_key',
      `CREATE TABLE results_writer_observations(observation_id text primary key,organization_id text,actor_user_id text,writer_family text,operation text,endpoint text,correlation_id text,created_at timestamptz,CONSTRAINT results_writer_observations_writer_family_check ${correctCheck}); INSERT INTO results_writer_observations VALUES ${rowValues},('obs-2','org-a','actor','legacy_kpi_crud','create','/y','corr-1',now())`,
      /duplicate rows exist under the target tenant-scoped key/
    );
  });

  it('converges a valid non-empty late table and preserves its row exactly', async () => {
    await inSchema('valid_late', async (client, schema) => {
      await client.query(`CREATE TABLE results_writer_observations(
        observation_id text primary key,organization_id text,writer_family text,operation text,
        endpoint text,correlation_id text,CONSTRAINT results_writer_observations_writer_family_check ${correctCheck})`);
      await client.query(
        `INSERT INTO results_writer_observations VALUES('obs-late','org-a','legacy_kpi_crud','create','/x','corr-late')`
      );
      await client.query(sqlForSchema(schema));
      const row = await client.query(
        `SELECT observation_id,organization_id,writer_family,operation,endpoint,correlation_id
           FROM results_writer_observations`
      );
      expect(row.rows).toEqual([
        {
          observation_id: 'obs-late',
          organization_id: 'org-a',
          writer_family: 'legacy_kpi_crud',
          operation: 'create',
          endpoint: '/x',
          correlation_id: 'corr-late',
        },
      ]);
      expect(
        (
          await client.query(
            `SELECT indexdef FROM pg_indexes WHERE schemaname=$1 AND indexname='uq_results_writer_observation_tenant_correlated_op'`,
            [schema]
          )
        ).rows
      ).toHaveLength(1);
    });
  });
});
