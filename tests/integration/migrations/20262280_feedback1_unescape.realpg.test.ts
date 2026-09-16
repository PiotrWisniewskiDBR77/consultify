/** @vitest-environment node */
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const rootUrl = process.env.FEEDBACK_20262280_PG_URL;
const suffix = `${process.pid}_${Date.now()}`;
const databaseNames = {
  fresh: `feedback_20262280_fresh_${suffix}`,
  fixture: `feedback_20262280_fixture_${suffix}`,
  noPk: `feedback_20262280_nopk_${suffix}`,
  jsonKey: `feedback_20262280_jsonkey_${suffix}`,
  structural: `feedback_20262280_structural_${suffix}`,
  conflict: `feedback_20262280_conflict_${suffix}`,
  mixed: `feedback_20262280_mixed_${suffix}`,
  gate: `feedback_20262280_gate_${suffix}`,
};

const migrationSql = fs.readFileSync(
  path.resolve(process.cwd(), 'server/migrations/20262280_feedback1_unescape_entities.sql'),
  'utf8'
);
const rollbackSql = fs.readFileSync(
  path.resolve(
    process.cwd(),
    'server/migrations/rollback/20262280_feedback1_unescape_entities.down.sql'
  ),
  'utf8'
);
function transactionalMigration(expectedManifestDigest?: string): string {
  const override = expectedManifestDigest === undefined
    ? ''
    : `SET LOCAL consultify.feedback_20262280_expected_manifest = '${expectedManifestDigest}';\n`;
  return `BEGIN;\n${override}${migrationSql}\nCOMMIT;`;
}

function databaseUrl(databaseName: string): string {
  const url = new URL(rootUrl!);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function withDatabase<T>(
  databaseName: string,
  run: (client: Client) => Promise<T>
): Promise<T> {
  const client = new Client({ connectionString: databaseUrl(databaseName), ssl: false });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

async function queryOnNewConnection<T = Record<string, unknown>>(
  databaseName: string,
  sql: string
): Promise<{ rows: T[]; backendPid: number }> {
  const client = new Client({ connectionString: databaseUrl(databaseName), ssl: false });
  await client.connect();
  try {
    const pid = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
    const result = await client.query<T>(sql);
    return { rows: result.rows, backendPid: pid.rows[0].pid };
  } finally {
    await client.end();
  }
}

describe('20262280 FEEDBACK-1 entity repair on real PostgreSQL', () => {
  let root: Client;

  beforeAll(async () => {
    if (!rootUrl) {
      throw new Error('FEEDBACK_20262280_PG_URL is required; RealPG evidence must never be skipped');
    }
    root = new Client({ connectionString: rootUrl, ssl: false });
    await root.connect();
    for (const databaseName of Object.values(databaseNames)) {
      await root.query(`CREATE DATABASE ${databaseName}`);
    }
  });

  afterAll(async () => {
    if (!root) return;
    for (const databaseName of Object.values(databaseNames)) {
      await root.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
    }
    await root.end();
  });

  it('is a strict no-op on a fresh database and remains a no-op on replay', async () => {
    await withDatabase(databaseNames.fresh, async (client) => {
      await client.query(transactionalMigration());
      await client.query(transactionalMigration());
      const run = await client.query(
        `SELECT state, columns_before, backup_count, changed_count
           FROM z_feedback_20262280_runs WHERE run_id = '20262280'`
      );
      expect(run.rows).toEqual([
        { state: 'APPLIED', columns_before: '0', backup_count: '0', changed_count: '0' },
      ]);
    });
  });

  it('repairs six tokens in plain/composite-PK and JSON values, replays with zero delta, and rolls back exactly', async () => {
    await withDatabase(databaseNames.fixture, async (client) => {
      await client.query(`
        CREATE TABLE repair_plain (
          org_id text NOT NULL,
          item_id integer NOT NULL,
          body text NOT NULL,
          title varchar(255) NOT NULL,
          PRIMARY KEY (org_id, item_id)
        );
        CREATE TABLE repair_json (
          id text PRIMARY KEY,
          payload jsonb NOT NULL,
          payload_json text NOT NULL,
          content text NOT NULL
        );
        INSERT INTO repair_plain VALUES
          ('org-a', 1, 'R&amp;D &quot;yes&quot; &#39;a&#x27; &#x60;b&#96; &lt;safe&gt; &amp;lt;script&amp;gt;', 'Q&amp;A'),
          ('org-a', 2, 'clean', 'M&amp;A');
        INSERT INTO repair_json VALUES
          ('j1',
           '{"message":"R&amp;D &quot;yes&quot;","nested":["&#39;ok&#x27;",7,true],"&lt;key&gt;":"kept"}',
           '{"message":"M&amp;A &#x60;go&#96;","&lt;key&gt;":"kept"}',
           '{"neutral":"generic R&amp;D","count":7,"enabled":true}');
      `);

      const applyBackend = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      const notices: string[] = [];
      client.on('notice', (notice) => notices.push(notice.message));

      const before = await client.query(
        `SELECT md5(jsonb_build_object(
                  'plain', (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.org_id, p.item_id) FROM repair_plain p),
                  'json', (SELECT jsonb_agg(to_jsonb(j) ORDER BY j.id) FROM repair_json j)
                )::text) AS digest`
      );

      await client.query(transactionalMigration());
      const plain = await queryOnNewConnection<{
        org_id: string; item_id: number; body: string; title: string;
      }>(databaseNames.fixture,
        `SELECT org_id, item_id, body, title FROM repair_plain ORDER BY item_id`
      );
      expect(plain.backendPid).not.toBe(applyBackend.rows[0].pid);
      expect(plain.rows).toEqual([
        {
          org_id: 'org-a',
          item_id: 1,
          body: 'R&D "yes" \'a\' `b` &lt;safe&gt; &#38;lt;script&#38;gt;',
          title: 'Q&A',
        },
        { org_id: 'org-a', item_id: 2, body: 'clean', title: 'M&A' },
      ]);

      const json = await queryOnNewConnection<{
        payload: Record<string, unknown>;
        payload_json: Record<string, unknown>;
        content: Record<string, unknown>;
      }>(databaseNames.fixture,
        `SELECT payload, payload_json::jsonb AS payload_json, content::jsonb AS content FROM repair_json`
      );
      expect(json.rows[0].payload).toEqual({
        message: 'R&D "yes"',
        nested: ["'ok'", 7, true],
        '&lt;key&gt;': 'kept',
      });
      expect(json.rows[0].payload_json).toEqual({
        message: 'M&A `go`',
        '&lt;key&gt;': 'kept',
      });
      expect(json.rows[0].content).toEqual({ neutral: 'generic R&D', count: 7, enabled: true });
      expect(notices).toEqual(expect.arrayContaining([
        expect.stringMatching(/repair_json\.content: before rows=1, before occurrences=1, after rows=0, after occurrences=0/),
        expect.stringMatching(/repair_plain\.body: before rows=1, before occurrences=9, after rows=0, after occurrences=0/),
      ]));
      const coldRescan = await queryOnNewConnection<{ remaining: string }>(
        databaseNames.fixture,
        `SELECT (
           SELECT count(*) FROM repair_plain
            WHERE body LIKE ANY (ARRAY['%&amp;%','%&quot;%','%&#39;%','%&#x27;%','%&#x60;%','%&#96;%'])
               OR title LIKE ANY (ARRAY['%&amp;%','%&quot;%','%&#39;%','%&#x27;%','%&#x60;%','%&#96;%'])
         ) + (
           SELECT count(*) FROM repair_json
            WHERE payload::text LIKE ANY (ARRAY['%&amp;%','%&quot;%','%&#39;%','%&#x27;%','%&#x60;%','%&#96;%'])
               OR payload_json LIKE ANY (ARRAY['%&amp;%','%&quot;%','%&#39;%','%&#x27;%','%&#x60;%','%&#96;%'])
               OR content LIKE ANY (ARRAY['%&amp;%','%&quot;%','%&#39;%','%&#x27;%','%&#x60;%','%&#96;%'])
         ) AS remaining`
      );
      expect(coldRescan.rows[0].remaining).toBe('0');

      const firstRun = await client.query(
        `SELECT state, columns_before, row_column_pairs_before, occurrences_before,
                backup_count, changed_count, columns_after, occurrences_after,
                raw_angle_delimiters_before, raw_angle_delimiters_after
           FROM z_feedback_20262280_runs WHERE run_id = '20262280'`
      );
      expect(firstRun.rows[0]).toMatchObject({
        state: 'APPLIED',
        columns_before: '5',
        row_column_pairs_before: '6',
        occurrences_before: '20',
        backup_count: '6',
        changed_count: '6',
        columns_after: '0',
        occurrences_after: '0',
        raw_angle_delimiters_before: '0',
        raw_angle_delimiters_after: '0',
      });

      await client.query(transactionalMigration());
      const replay = await client.query(
        `SELECT backup_count, changed_count, backup_digest
           FROM z_feedback_20262280_runs WHERE run_id = '20262280'`
      );
      expect(replay.rows[0]).toEqual({
        backup_count: '6',
        changed_count: '6',
        backup_digest: expect.any(String),
      });

      await client.query(rollbackSql);
      const after = await queryOnNewConnection<{ digest: string }>(databaseNames.fixture,
        `SELECT md5(jsonb_build_object(
                  'plain', (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.org_id, p.item_id) FROM repair_plain p),
                  'json', (SELECT jsonb_agg(to_jsonb(j) ORDER BY j.id) FROM repair_json j)
                )::text) AS digest`
      );
      expect(after.backendPid).not.toBe(applyBackend.rows[0].pid);
      expect(after.rows[0].digest).toBe(before.rows[0].digest);
      const rolledBack = await queryOnNewConnection<{ state: string }>(databaseNames.fixture,
        `SELECT state FROM z_feedback_20262280_runs WHERE run_id = '20262280'`
      );
      expect(rolledBack.rows[0].state).toBe('ROLLED_BACK');
    });
  });

  it('fails closed before writes when an affected table has no primary key', async () => {
    await withDatabase(databaseNames.noPk, async (client) => {
      await client.query(
        `CREATE TABLE unsafe_no_pk (body text); INSERT INTO unsafe_no_pk VALUES ('R&amp;D')`
      );
      await expect(client.query(transactionalMigration())).rejects.toThrow(
        /table has no primary key/i
      );
      await client.query('ROLLBACK');
      const proof = await client.query(
        `SELECT body, to_regclass('z_feedback_20262280_runs') AS manifest FROM unsafe_no_pk`
      );
      expect(proof.rows).toEqual([{ body: 'R&amp;D', manifest: null }]);
    });
  });

  it('fails closed when a target token occurs in a JSON object key', async () => {
    await withDatabase(databaseNames.jsonKey, async (client) => {
      await client.query(
        `CREATE TABLE unsafe_json_key (id text PRIMARY KEY, payload jsonb NOT NULL);
         INSERT INTO unsafe_json_key VALUES ('1', '{"R&amp;D":"unchanged"}')`
      );
      await expect(client.query(transactionalMigration())).rejects.toThrow(/JSON object key/i);
      await client.query('ROLLBACK');
      const proof = await client.query(`SELECT payload FROM unsafe_json_key`);
      expect(proof.rows[0].payload).toEqual({ 'R&amp;D': 'unchanged' });
    });
  });

  it('fails closed for an affected PK or generated column', async () => {
    await withDatabase(databaseNames.structural, async (client) => {
      await client.query(`
        CREATE TABLE unsafe_pk (id text PRIMARY KEY);
        INSERT INTO unsafe_pk VALUES ('R&amp;D');
        CREATE TABLE unsafe_generated (
          id integer PRIMARY KEY,
          source text NOT NULL,
          derived text GENERATED ALWAYS AS (source || '&amp;') STORED
        );
        INSERT INTO unsafe_generated (id, source) VALUES (1, 'generated');
      `);
      await expect(client.query(transactionalMigration())).rejects.toThrow(
        /primary key|generated or identity/i
      );
      await client.query('ROLLBACK');
      const pkProof = await client.query(`SELECT id FROM unsafe_pk`);
      const generatedProof = await client.query(`SELECT derived FROM unsafe_generated`);
      expect(pkProof.rows[0].id).toBe('R&amp;D');
      expect(generatedProof.rows[0].derived).toBe('generated&amp;');
    });
  });

  it('rollback conflict preflight preserves a later user edit and restores nothing', async () => {
    await withDatabase(databaseNames.conflict, async (client) => {
      await client.query(
        `CREATE TABLE conflict_fixture (id text PRIMARY KEY, body text NOT NULL, note text NOT NULL);
         INSERT INTO conflict_fixture VALUES ('1', 'R&amp;D', 'Q&amp;A')`
      );
      await client.query(transactionalMigration());
      await client.query(`UPDATE conflict_fixture SET body = 'later user edit' WHERE id = '1'`);
      await expect(client.query(rollbackSql)).rejects.toThrow(/rollback conflict/i);
      await client.query('ROLLBACK');
      const proof = await client.query(`SELECT body, note FROM conflict_fixture WHERE id = '1'`);
      expect(proof.rows[0]).toEqual({ body: 'later user edit', note: 'Q&A' });
    });
  });

  it('classifies mixed JSON/plain text per value across three columns and reaches a 21-layer fixed point', async () => {
    await withDatabase(databaseNames.mixed, async (client) => {
      const deep = `&${'amp;'.repeat(20)}quot;`;
      await client.query(`
        CREATE TABLE mixed_content (
          id text PRIMARY KEY,
          content_a text NOT NULL,
          content_b text NOT NULL,
          content_c text NOT NULL
        )
      `);
      await client.query(`
        INSERT INTO mixed_content VALUES
          ('json', '{"message":"R&amp;D"}', '{"message":"Q&amp;A"}', '{"message":"M&amp;A"}'),
          ('plain', 'M&amp;A', 'Q&amp;A', $1)
      `, [deep]);
      await client.query(transactionalMigration());
      const proof = await client.query(
        `SELECT id, content_a, content_b, content_c FROM mixed_content ORDER BY id`
      );
      expect(proof.rows).toEqual([
        {
          id: 'json',
          content_a: '{"message": "R&D"}',
          content_b: '{"message": "Q&A"}',
          content_c: '{"message": "M&A"}',
        },
        { id: 'plain', content_a: 'M&A', content_b: 'Q&A', content_c: '"' },
      ]);
      const manifest = await client.query(
        `SELECT columns_before, row_column_pairs_before, columns_after,
                row_column_pairs_after, occurrences_after
           FROM z_feedback_20262280_runs WHERE run_id = '20262280'`
      );
      expect(manifest.rows[0]).toEqual({
        columns_before: '3',
        row_column_pairs_before: '6',
        columns_after: '0',
        row_column_pairs_after: '0',
        occurrences_after: '0',
      });
    });
  });

  it('builds a dynamic manifest for more than 120 affected columns without a hard-coded count gate', async () => {
    await withDatabase(databaseNames.gate, async (client) => {
      const columnNames = Array.from({ length: 121 }, (_, index) => `content_${index + 1}`);
      const definitions = columnNames.map((name) => `${name} text NOT NULL`).join(', ');
      const values = columnNames.map(() => `'R&amp;D'`).join(', ');
      await client.query(
        `CREATE TABLE dynamic_manifest_fixture (id text PRIMARY KEY, ${definitions});
         INSERT INTO dynamic_manifest_fixture VALUES ('1', ${values});`
      );
      await client.query(transactionalMigration('deliberately-different-digest'));
      const manifest = await client.query(
        `SELECT columns_before, manifest_columns, backup_count, changed_count,
                columns_after, row_column_pairs_after, occurrences_after,
                expected_manifest_digest, manifest_drift
           FROM z_feedback_20262280_runs WHERE run_id = '20262280'`
      );
      expect(manifest.rows[0]).toEqual({
        columns_before: '121',
        manifest_columns: '121',
        backup_count: '121',
        changed_count: '121',
        columns_after: '0',
        row_column_pairs_after: '0',
        occurrences_after: '0',
        expected_manifest_digest: 'deliberately-different-digest',
        manifest_drift: 'WARN: dynamic manifest differs from optional expected digest',
      });
      const proof = await client.query(
        `SELECT ${columnNames.join(', ')} FROM dynamic_manifest_fixture WHERE id = '1'`
      );
      expect(Object.values(proof.rows[0])).toEqual(Array(121).fill('R&D'));
    });
  });
});
