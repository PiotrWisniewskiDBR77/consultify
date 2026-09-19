/**
 * QD21 (KANAL [D] Wpis 234, numer 20262306 wg Wpisu 237) — RealPG dowód
 * migracji backfillu 3 kanonicznych kart bazowych.
 *
 * DEFECT THIS PINS: 20262271 snapshotuje karty bazowe tylko dla organizacji
 * istniejących w chwili jego zastosowania — org utworzone później (zmierzone
 * na kopii dumpu 2026-09-19: `ateliertoys-demo`, 18.09 01:37) mają 0 z 3
 * kanonicznych linków (luka 36 vs 13*3=39). Migracja 20262306 dopisuje
 * WYŁĄCZNIE brakujące pary (org, źródło): 3 artefakty + 3 linki, deterministyczne
 * ID z wzorca 20262271, bare `ON CONFLICT DO NOTHING`, asercja scoped w bloku DO
 * („per org dokładnie 3 kanoniczne linki"), zero DELETE.
 *
 * Testy czytają migrację Z DYSKU (T1/T2/T4 wykonują plik, nie lustro):
 * usunięcie insertu artefaktów albo linków => T1 RED; osłabienie asercji DO
 * => T5 RED; down kasujący po rodzinie zamiast po znaczniku => T4 RED.
 *
 * FAIL-CLOSED GATE (standard W164b): w CI bez RUN_DB_TESTS plik rzuca przy
 * zbieraniu (RC=1); lokalnie bez RUN_DB_TESTS pomija.
 *
 * Plik wykonuje DOWN (DELETE własnych wierszy), więc odmawia innego hosta
 * niż loopback.
 *
 * Uruchomienie (pula D, kontener qoder-d-pg-9, kopia dumpu stagingu):
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *     DATABASE_URL=postgresql://postgres:<hasło-lokalne>@127.0.0.1:6638/consultify_qd21 \
 *     npx vitest run server/src/routes/v8/__tests__/basecardBackfill20262306.pg.test.ts --retry=0
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(HERE, '../../../../migrations');
const MIGRATION_FILE = '20262306_basecard_backfill_missing_orgs.sql';
const DOWN_FILE = path.join('rollback', '20262306_basecard_backfill_missing_orgs.down.sql');

const ENV_AT_LOAD = {
  RUN_DB_TESTS: process.env.RUN_DB_TESTS,
  DATABASE_URL: process.env.DATABASE_URL,
};

const OPT_OUT = new Set(['', '0', 'false', 'no', 'off']);
const DB_TESTS_DEMANDED =
  ENV_AT_LOAD.RUN_DB_TESTS !== undefined &&
  !OPT_OUT.has(String(ENV_AT_LOAD.RUN_DB_TESTS).trim().toLowerCase());

const IN_CI = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);
if (IN_CI && !DB_TESTS_DEMANDED) {
  throw new Error(
    'RealPG evidence must never be skipped in CI: set RUN_DB_TESTS=1 and DATABASE_URL'
  );
}

const CONNECTION_STRING = ENV_AT_LOAD.DATABASE_URL ?? '';
const REAL_DB =
  DB_TESTS_DEMANDED &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
if (REAL_DB) {
  const host = new URL(CONNECTION_STRING).hostname;
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(
      `basecardBackfill20262306.pg.test.ts executes DELETE — refusing non-loopback host "${host}"`
    );
  }
}

const MARKER = 'migration:20262306_basecard_backfill';
const CANONICAL_PAIRS = [
  ['document_template', 'doc-template-system-en-client_final_report'],
  ['presentation_template', 'dbr77-deck-board'],
  ['sheet_template', '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1'],
] as const;

describe.skipIf(!REAL_DB)('QD21 — backfill kart bazowych 20262306 (real PostgreSQL)', () => {
  let pool: pg.Pool;
  let client: pg.PoolClient;
  let lackingOrg = '';
  let richOrg = '';
  let preArty = 0;
  let preLinki = 0;
  let preMd5 = '';
  let richDocbaseMd5Pre = '';

  const sql = (file: string): string => readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
  const codeOnly = (src: string): string => src.replace(/^\s*--.*$/gm, '');

  const canonicalLinks = async (orgId: string): Promise<number> => {
    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM public.v8_artifact_origin_links l
        WHERE l.organization_id = $1
          AND (l.origin_runtime, l.origin_record_id) IN (
                ('document_template', 'doc-template-system-en-client_final_report'),
                ('presentation_template', 'dbr77-deck-board'),
                ('sheet_template', '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1'))`,
      [orgId]
    );
    return rows[0].n;
  };

  const markerArtifacts = async (): Promise<number> => {
    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM public.v8_output_artifacts WHERE created_by = $1`,
      [MARKER]
    );
    return rows[0].n;
  };

  const fingerprint = async (): Promise<{ arty: number; linki: number; md5: string }> => {
    const { rows } = await client.query(
      `SELECT (SELECT count(*)::int FROM public.v8_output_artifacts) AS arty,
              (SELECT count(*)::int FROM public.v8_artifact_origin_links) AS linki,
              (SELECT md5(string_agg(artifact_id, ',' ORDER BY artifact_id))
                 FROM public.v8_output_artifacts) AS md5`
    );
    return { arty: rows[0].arty, linki: rows[0].linki, md5: rows[0].md5 };
  };

  const docbaseMd5 = async (orgId: string): Promise<string> => {
    const { rows } = await client.query(
      `SELECT md5(string_agg(artifact_id, ',' ORDER BY artifact_id)) AS md5
         FROM public.v8_output_artifacts
        WHERE organization_id = $1 AND template_family_ref = 'DOC-BASE' AND is_draft = 0`,
      [orgId]
    );
    return rows[0].md5;
  };

  const docbaseCount = async (orgId: string): Promise<number> => {
    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM public.v8_output_artifacts
        WHERE organization_id = $1 AND template_family_ref = 'DOC-BASE' AND is_draft = 0`,
      [orgId]
    );
    return rows[0].n;
  };

  const ensurePreState = async (): Promise<void> => {
    if ((await markerArtifacts()) > 0) await client.query(sql(DOWN_FILE));
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: CONNECTION_STRING });
    client = await pool.connect();

    await ensurePreState();

    const { rows: lacking } = await client.query(
      `SELECT o.id FROM organizations o
         WHERE NOT EXISTS (
           SELECT 1 FROM public.v8_artifact_origin_links l
            WHERE l.organization_id = o.id
              AND (l.origin_runtime, l.origin_record_id) IN (
                    ('document_template', 'doc-template-system-en-client_final_report'),
                    ('presentation_template', 'dbr77-deck-board'),
                    ('sheet_template', '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1')))
         ORDER BY o.id`
    );
    // KROK 0 (evidence/qd21-basecard-backfill-20260919): dokładnie JEDNA org bez kart.
    expect(lacking).toHaveLength(1);
    lackingOrg = lacking[0].id;

    const { rows: rich } = await client.query(
      `SELECT organization_id FROM public.v8_output_artifacts
        WHERE template_family_ref = 'DOC-BASE' AND is_draft = 0
        GROUP BY organization_id HAVING count(*) = 21 ORDER BY organization_id LIMIT 1`
    );
    expect(rich.length).toBeGreaterThan(0);
    richOrg = rich[0].organization_id;

    const fp = await fingerprint();
    preArty = fp.arty;
    preLinki = fp.linki;
    preMd5 = fp.md5;
    richDocbaseMd5Pre = await docbaseMd5(richOrg);
  });

  afterAll(async () => {
    if (client) {
      await ensurePreState();
      client.release();
    }
    await pool?.end();
  });

  it('T0 PRE: org bez kart ma 0 kanonicznych linków, znacznik migracji nieobecny, org bogata ma 21 DOC-BASE', async () => {
    expect(await canonicalLinks(lackingOrg)).toBe(0);
    expect(await markerArtifacts()).toBe(0);
    expect(await docbaseCount(richOrg)).toBe(21);
    expect(await canonicalLinks(richOrg)).toBe(3);
  });

  it('T1 UP: org bez kart dostaje dokładnie 3 linki i 3 artefakty ze znacznikiem; org bogata nietknięta', async () => {
    await client.query(sql(MIGRATION_FILE));

    expect(await canonicalLinks(lackingOrg)).toBe(3);
    expect(await markerArtifacts()).toBe(3);

    const { rows } = await client.query(
      `SELECT artifact_id, template_family_ref FROM public.v8_output_artifacts
        WHERE created_by = $1 ORDER BY template_family_ref`,
      [MARKER]
    );
    const familyKey: Record<string, string> = {
      'DOC-BASE': 'docbase',
      'DECK-BASE': 'deckbase',
      'SHEET-BASE': 'sheetbase',
    };
    const sourceOf: Record<string, string> = {
      'DOC-BASE': 'doc-template-system-en-client_final_report',
      'DECK-BASE': 'dbr77-deck-board',
      'SHEET-BASE': '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1',
    };
    for (const row of rows) {
      const { createHash } = await import('node:crypto');
      const want =
        `template-1-${familyKey[row.template_family_ref]}-` +
        createHash('md5').update(`${lackingOrg}:${sourceOf[row.template_family_ref]}`).digest('hex');
      expect(row.artifact_id).toBe(want);
    }

    const fp = await fingerprint();
    expect(fp.arty).toBe(preArty + 3);
    expect(fp.linki).toBe(preLinki + 3);

    expect(await docbaseCount(richOrg)).toBe(21);
    expect(await docbaseMd5(richOrg)).toBe(richDocbaseMd5Pre);
    expect(await canonicalLinks(richOrg)).toBe(3);
  });

  it('T2 idempotencja: ponowny UP nie dopisuje nic', async () => {
    const before = await fingerprint();
    await client.query(sql(MIGRATION_FILE));
    expect(await fingerprint()).toEqual(before);
    expect(await markerArtifacts()).toBe(3);
    expect(await canonicalLinks(lackingOrg)).toBe(3);
  });

  it('T5 asercja scoped w bloku DO: przy org z 2 kanonicznymi linkami migracja rzuca wyjątek', async () => {
    const up = sql(MIGRATION_FILE);
    const doBlock = up.slice(up.indexOf('DO $$'));
    expect(doBlock).toContain('HAVING count(l.link_id) <> 3');

    await client.query('BEGIN');
    try {
      await client.query(
        `DELETE FROM public.v8_artifact_origin_links
          WHERE organization_id = $1 AND origin_runtime = 'document_template'
            AND origin_record_id = 'doc-template-system-en-client_final_report'`,
        [richOrg]
      );
      await expect(client.query(doBlock)).rejects.toThrow(/scoped readback failed/);
    } finally {
      await client.query('ROLLBACK');
    }
    expect(await canonicalLinks(richOrg)).toBe(3);
  });

  it('T3 kontrakt źródła: bare ON CONFLICT DO NOTHING x2, zero DELETE/DROP w UP, public. kwalifikacja, down tylko po znaczniku', async () => {
    const up = codeOnly(sql(MIGRATION_FILE));
    expect(up.match(/ON CONFLICT DO NOTHING/g) ?? []).toHaveLength(2);
    expect(up).not.toMatch(/\bDELETE\b/i);
    expect(up).not.toMatch(/\bDROP\b/i);
    expect(up).not.toMatch(/DO UPDATE/i);
    expect(up).toContain('public.v8_output_artifacts');
    expect(up).toContain('public.v8_artifact_origin_links');
    expect(up).toContain(MARKER);

    const down = codeOnly(sql(DOWN_FILE));
    expect(down).toContain(MARKER);
    expect(down).not.toMatch(/template_family_ref/);
    expect(down).not.toMatch(/DROP\b/i);
    expect(down.match(/DELETE FROM/g) ?? []).toHaveLength(2);
  });

  it('T4 DOWN: znika dokładnie 6 własnych wierszy, odcisk globalny i org bogata wracają do PRE', async () => {
    await client.query(sql(DOWN_FILE));

    expect(await markerArtifacts()).toBe(0);
    expect(await canonicalLinks(lackingOrg)).toBe(0);

    const fp = await fingerprint();
    expect(fp.arty).toBe(preArty);
    expect(fp.linki).toBe(preLinki);
    expect(fp.md5).toBe(preMd5);

    expect(await docbaseCount(richOrg)).toBe(21);
    expect(await docbaseMd5(richOrg)).toBe(richDocbaseMd5Pre);
    expect(await canonicalLinks(richOrg)).toBe(3);
  });
});
