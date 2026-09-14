import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ORGANIZATION_EXPORT_TABLES } from '../organizationExportContract.js';
import { exportOrganizationData } from '../organizationExportService.js';

const databaseUrl = process.env.DATABASE_URL || '';
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const organizationIds: string[] = [];

beforeAll(async () => {
  const identity = await pool.query(
    `SELECT current_database() AS database, inet_server_addr()::text AS host, inet_server_port() AS port`
  );
  expect(identity.rows[0].database).toBe('f2e_e1');
  expect(Number(identity.rows[0].port)).toBe(5432);
});

afterAll(async () => {
  await pool.query('DELETE FROM public.v8_feature_flags WHERE organization_id=ANY($1::text[])', [
    organizationIds,
  ]);
  await pool.query('DELETE FROM v8.v8_feature_flags WHERE organization_id=ANY($1::text[])', [
    organizationIds,
  ]);
  await pool.query('DELETE FROM organizations WHERE id=ANY($1::text[])', [organizationIds]);
  await pool.end();
});

describe('F2-E exact full-schema runtime contract on staging-schema PostgreSQL', () => {
  it('contains one exact policy per live public/v8 relation and no UNRESOLVED category', async () => {
    const live = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname IN ('public','v8')`
    );
    expect(Number(live.rows[0].count)).toBe(1930);
    expect(ORGANIZATION_EXPORT_TABLES).toHaveLength(1930);
    expect(new Set(ORGANIZATION_EXPORT_TABLES.map((row) => `${row.schema}.${row.table}`)).size).toBe(1930);
    expect(ORGANIZATION_EXPORT_TABLES.filter((row) => row.category === 'UNRESOLVED')).toHaveLength(0);
    expect(
      ORGANIZATION_EXPORT_TABLES.filter((row) => row.schema === 'v8' && row.category === 'EXPORT').map(
        (row) => row.table
      )
    ).toEqual(['v8_feature_flags', 'v8_shadow_comparisons']);
    expect(
      ORGANIZATION_EXPORT_TABLES.filter(
        (row) => row.schema === 'v8' && row.category === 'EXCLUDE_SECURITY'
      )
    ).toHaveLength(119);
  });

  it('exports an empty synthetic tenant without querying excluded material or leaking another tenant', async () => {
    const a = randomUUID();
    const b = randomUUID();
    organizationIds.push(a, b);
    await pool.query('INSERT INTO organizations(id,name) VALUES ($1,$2),($3,$4)', [
      a,
      `E1 tenant A ${a}`,
      b,
      `E1 tenant B ${b}`,
    ]);
    const client = await pool.connect();
    try {
      const result = await exportOrganizationData(client, a);
      expect(result.organization?.id).toBe(a);
      expect(JSON.stringify(result)).not.toContain(b);
      expect(result.securityManifest.unresolvedTables).toEqual([]);
      expect(result.securityManifest.excludedTables.length).toBe(550);
      expect(result.securityManifest.derivedTables).toHaveLength(1);
      expect(result.securityManifest.notIncluded?.map((item) => item.scope)).toContain(
        'portable_methodology_ip_package'
      );
    } finally {
      client.release();
    }
  }, 120000);

  it('keeps non-empty public and v8 physical mirrors separate and tenant scoped', async () => {
    const a = randomUUID();
    const b = randomUUID();
    organizationIds.push(a, b);
    await pool.query('INSERT INTO organizations(id,name) VALUES ($1,$2),($3,$4)', [
      a,
      `E1 collision tenant A ${a}`,
      b,
      `E1 collision tenant B ${b}`,
    ]);
    const publicA = `public-a-${a}`;
    const publicB = `public-b-${b}`;
    const v8A = `v8-a-${a}`;
    const v8B = `v8-b-${b}`;
    await pool.query(
      `INSERT INTO public.v8_feature_flags(flag_id,organization_id,module,enabled,updated_at)
       VALUES ($1,$2,$3,1,$4),($5,$6,$7,1,$8)`,
      [randomUUID(), a, publicA, new Date().toISOString(), randomUUID(), b, publicB, new Date().toISOString()]
    );
    await pool.query(
      `INSERT INTO v8.v8_feature_flags(flag_id,organization_id,module,enabled,updated_at)
       VALUES ($1,$2,$3,1,$4),($5,$6,$7,1,$8)`,
      [randomUUID(), a, v8A, new Date().toISOString(), randomUUID(), b, v8B, new Date().toISOString()]
    );
    const client = await pool.connect();
    try {
      const result = await exportOrganizationData(client, a);
      expect(result.tables.v8_feature_flags).toEqual(
        expect.arrayContaining([expect.objectContaining({ organization_id: a, module: publicA })])
      );
      expect(result.tables['v8.v8_feature_flags']).toEqual(
        expect.arrayContaining([expect.objectContaining({ organization_id: a, module: v8A })])
      );
      expect(JSON.stringify(result)).not.toContain(publicB);
      expect(JSON.stringify(result)).not.toContain(v8B);
    } finally {
      client.release();
    }
  }, 120000);
});
