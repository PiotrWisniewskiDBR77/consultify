import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ORGANIZATION_EXPORT_TABLES } from '../organizationExportContract.js';
import { exportOrganizationData } from '../organizationExportService.js';
import { writeOrganizationExportArchiveStreaming } from '../organizationExportArchiveService.js';
import { withOrganizationExportSnapshot } from '../organizationExportSnapshot.js';

const databaseUrl = process.env.DATABASE_URL || '';
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const organizationIds: string[] = [];
const outputPaths: string[] = [];
const execFileAsync = promisify(execFile);

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
  await Promise.all(outputPaths.map((output) => fs.rm(output, { force: true })));
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
      expect(result.securityManifest.excludedTables.length).toBe(405);
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

  it('streams a resumable archive in bounded pages and proves manifest hashes and tenant counts', async () => {
    const a = randomUUID();
    const b = randomUUID();
    organizationIds.push(a, b);
    await pool.query('INSERT INTO organizations(id,name) VALUES ($1,$2),($3,$4)', [a, `Stream A ${a}`, b, `Stream B ${b}`]);
    const publicA = `stream-public-a-${a}`;
    const publicB = `stream-public-b-${b}`;
    const v8A = `stream-v8-a-${a}`;
    const v8B = `stream-v8-b-${b}`;
    await pool.query(
      `INSERT INTO public.v8_feature_flags(flag_id,organization_id,module,enabled,updated_at)
       VALUES ($1,$2,$3,1,$4),($5,$6,$7,1,$8)`,
      [randomUUID(), a, publicA, new Date().toISOString(), randomUUID(), b, publicB, new Date().toISOString()]
    );
    await pool.query(
      `INSERT INTO public.v8_feature_flags(flag_id,organization_id,module,enabled,updated_at)
       SELECT $1 || '-' || series.sequence::text,$2,$3 || '-' || series.sequence::text,1,$4
         FROM generate_series(1,20001) AS series(sequence)`,
      [`e1-bulk-${a}`, a, `stream-bulk-${a}`, new Date().toISOString()]
    );
    await pool.query(
      `INSERT INTO v8.v8_feature_flags(flag_id,organization_id,module,enabled,updated_at)
       VALUES ($1,$2,$3,1,$4),($5,$6,$7,1,$8)`,
      [randomUUID(), a, v8A, new Date().toISOString(), randomUUID(), b, v8B, new Date().toISOString()]
    );
    const output = path.join(os.tmpdir(), `e1-stream-${randomUUID()}.zip`);
    outputPaths.push(output);
    const progress: Array<{ completedTables: number; totalTables: number; rows: number }> = [];
    const client = await pool.connect();
    const manifest = await withOrganizationExportSnapshot(client, a, (snapshot) =>
      writeOrganizationExportArchiveStreaming(snapshot, a, output, {
        batchSize: 500,
        onProgress: (event) => progress.push(event),
      })
    );
    expect(progress.at(-1)).toMatchObject({ completedTables: 1524, totalTables: 1524 });
    expect(manifest.files).toHaveLength(3048);
    expect(manifest.rowCounts.v8_feature_flags).toBe(20002);
    expect(manifest.rowCounts['v8.v8_feature_flags']).toBe(1);
    expect(Number.isNaN(Date.parse(manifest.asOf))).toBe(false);

    const readZipEntry = async (entry: string) =>
      (await execFileAsync('unzip', ['-p', output, entry], { maxBuffer: 32 * 1024 * 1024 })).stdout;
    const publicRows = JSON.parse(await readZipEntry('json/public.v8_feature_flags.json'));
    const v8Rows = JSON.parse(await readZipEntry('json/v8.v8_feature_flags.json'));
    expect(publicRows).toHaveLength(20002);
    expect(publicRows).toEqual(expect.arrayContaining([expect.objectContaining({ organization_id: a, module: publicA })]));
    expect(v8Rows).toEqual([expect.objectContaining({ organization_id: a, module: v8A })]);
    expect(JSON.stringify({ publicRows, v8Rows })).not.toContain(publicB);
    expect(JSON.stringify({ publicRows, v8Rows })).not.toContain(v8B);

    for (const entry of ['json/public.v8_feature_flags.json', 'json/v8.v8_feature_flags.json']) {
      const bytes = Buffer.from(await readZipEntry(entry));
      const receipt = manifest.files.find((file) => file.path === entry)!;
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(receipt.sha256);
      expect(receipt.rows).toBe(entry.startsWith('json/public.') ? 20002 : 1);
    }
  }, 180000);

  it('keeps a 20k+ DEC-493 personal-content family page-bounded and removes person identity', async () => {
    const client = await pool.connect();
    const orgId = randomUUID();
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO organizations(id,name) VALUES ($1,$2)', [orgId, 'Privacy paging probe']);
      await client.query(`CREATE TABLE public.e1_privacy_page_probe (
        id text PRIMARY KEY,
        organization_id text NOT NULL,
        title text,
        created_by text
      )`);
      await client.query(
        `INSERT INTO public.e1_privacy_page_probe(id,organization_id,title,created_by)
         SELECT 'privacy-'||series::text,$1,'business-'||series::text,'person-secret'
           FROM generate_series(1,20001) series`,
        [orgId]
      );
      const probe = {
        schema: 'public' as const,
        table: 'e1_privacy_page_probe',
        category: 'EXPORT' as const,
        columnTypes: { id: 'text', organization_id: 'text', title: 'text', created_by: 'text' },
        primaryKey: ['id'],
        foreignKeys: [],
        personalTaskPrivacy: true,
        ownerColumn: 'organization_id',
        counterpartyColumns: [],
        projection: ['id', 'organization_id', 'title', 'created_by'],
        excludedColumns: [],
        source: 'RealPG disposable DEC-493 bounded-memory probe',
      };
      let rows = 0;
      let maxPage = 0;
      let leakedIdentity = false;
      const beforeRss = process.memoryUsage().rss;
      const result = await exportOrganizationData(
        client,
        orgId,
        [...ORGANIZATION_EXPORT_TABLES, probe],
        {
          stream: {
            batchSize: 500,
            writeTable: async (chunk) => {
              if (chunk.identity !== 'e1_privacy_page_probe') return;
              rows += chunk.rows.length;
              maxPage = Math.max(maxPage, chunk.rows.length);
              leakedIdentity ||= chunk.rows.some((row) => 'created_by' in row || JSON.stringify(row).includes('person-secret'));
            },
          },
        }
      );
      const rssDeltaMb = (process.memoryUsage().rss - beforeRss) / (1024 * 1024);
      expect(result.rowCounts.e1_privacy_page_probe).toBe(20001);
      expect(rows).toBe(20001);
      expect(maxPage).toBeLessThanOrEqual(500);
      expect(leakedIdentity).toBe(false);
      expect(rssDeltaMb).toBeLessThan(64);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }, 180000);

  it('keeps receipt hashing and ZIP finalization bounded for a wide 20k+ archive relation', async () => {
    const orgId = randomUUID();
    organizationIds.push(orgId);
    await pool.query('INSERT INTO organizations(id,name) VALUES ($1,$2)', [orgId, 'Wide archive RSS probe']);
    await pool.query(
      `INSERT INTO public.v8_feature_flags(flag_id,organization_id,module,enabled,updated_at)
       SELECT $1 || '-' || series.sequence::text,$2,
              'wide-' || series.sequence::text || '-' || repeat('x',4096),1,$3
         FROM generate_series(1,20001) AS series(sequence)`,
      [`e1-wide-${orgId}`, orgId, new Date().toISOString()]
    );
    const output = path.join(os.tmpdir(), `e1-wide-rss-${randomUUID()}.zip`);
    outputPaths.push(output);
    const baselineRss = process.memoryUsage().rss;
    let peakRss = baselineRss;
    const sampler = setInterval(() => {
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
    }, 10);
    sampler.unref();
    try {
      const client = await pool.connect();
      const archive = await withOrganizationExportSnapshot(client, orgId, (snapshot) =>
        writeOrganizationExportArchiveStreaming(snapshot, orgId, output, { batchSize: 500 })
      );
      expect(archive.rowCounts.v8_feature_flags).toBe(20001);
      expect(archive.files.find((file) => file.path === 'json/public.v8_feature_flags.json')?.bytes)
        .toBeGreaterThan(80 * 1024 * 1024);
      expect(archive.files.find((file) => file.path === 'csv/public.v8_feature_flags.csv')?.bytes)
        .toBeGreaterThan(80 * 1024 * 1024);
    } finally {
      clearInterval(sampler);
    }
    const peakDeltaMb = (peakRss - baselineRss) / (1024 * 1024);
    console.log(`E1_WIDE_ARCHIVE_RSS peak_delta_mb=${peakDeltaMb.toFixed(2)} rows=20001 width=4096`);
    // The two uncompressed table artifacts exceed 160 MiB together. The ceiling
    // defends a finite production envelope while the unit mutation guard separately
    // rejects reintroducing a whole-file receipt Buffer.
    expect(peakDeltaMb).toBeLessThan(320);
  }, 240000);
});
