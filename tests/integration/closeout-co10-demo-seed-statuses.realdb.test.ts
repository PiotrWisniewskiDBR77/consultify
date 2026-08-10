/**
 * CLOSEOUT-10 — demo seed scripts must write CANONICAL initiative statuses.
 *
 * DEFEKT (realny, zmierzony):
 *   Pięć skryptów seedujących demo zapisywało do `initiatives.status` wartości
 *   ze starego słownika lejka DRD:
 *     server/seed/seed_demo_organization.js      'step3', 'step4_pilot', 'step5_full'
 *     server/seed/seed_legolex_demo_v3.js        'step2_assess', 'step3_list', 'step4_pilot', 'step5_full'
 *     server/seed/seed_technolex_demo_v3.js      j.w.
 *     server/scripts/seedLegolexDemoOrg.js       'step3_list', 'step4_pilot', 'step5_full'
 *     server/scripts/seed-archilex-demo-org.js   'step2_assessment', 'step3_list', 'step4_pilot',
 *                                                'step5_full' + małoliterowe 'cancelled'
 *   Na w pełni zmigrowanej bazie KAŻDA z tych siedmiu wartości odbija się od
 *   `initiatives_status_check`, więc seed demo pada.
 *
 * WAŻNE — CHECK JEST ŚCIŚLE WIELKOLITEROWY:
 *   Na świeżej bazie obowiązuje wersja `status IN (...)` z
 *   `000_z_core_baseline.sql` / `20260802_mvp_core_schema_parity.sql`,
 *   a NIE tolerancyjna `UPPER(status) IN (...)` z `20260624`. Dlatego
 *   małoliterowe 'cancelled' też jest odrzucane — to nie jest kosmetyka.
 *
 * MAPOWANIE NIE JEST ZGADYWANE:
 *   Źródłem jest `docs/demo/ARCHILEX_STORY.md` — specyfikacja seeda archilex,
 *   która nazywa docelowy status per inicjatywa. Stąd:
 *     step2_assess / step2_assessment -> DRAFT
 *     step3_list                      -> PLANNING
 *     step4_pilot                     -> EXECUTING
 *     step5_full                      -> DONE
 *     'cancelled'                     -> 'CANCELLED'
 *
 * KONTROLA NEGATYWNA (scenariusz 4):
 *   Testy „wszystko wchodzi" są bezwartościowe na bazie BEZ constraintu —
 *   przeszłyby także przed naprawą. Dlatego scenariusz 4 wymaga, żeby stare
 *   literały nadal BYŁY ODRZUCANE. Jeśli constraint zniknie, test czerwienieje
 *   zamiast cicho przepuścić regresję.
 *
 * SSOT: server/src/constants/initiativeStatuses.ts (enum InitiativeStatus).
 */
import fs from 'node:fs';
import path from 'node:path';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
}

const PROBE_TIMEOUT_MS = 10_000;
const REPO_ROOT = path.resolve(__dirname, '../..');

/** SSOT: server/src/constants/initiativeStatuses.ts (enum InitiativeStatus). */
const CANONICAL_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'REVIEW',
  'PROMOTED',
  'PLANNING',
  'APPROVED',
  'SCHEDULED',
  'EXECUTING',
  'BLOCKED',
  'DONE',
  'TRACKING',
  'CANCELLED',
  'ARCHIVED',
] as const;

/** Wszystkie skrypty seedujące demo, które piszą do `initiatives.status`. */
const SEED_FILES = [
  'server/seed/seed_demo_organization.js',
  'server/seed/seed_legolex_demo_v3.js',
  'server/seed/seed_technolex_demo_v3.js',
  'server/scripts/seedLegolexDemoOrg.js',
  'server/scripts/seed-archilex-demo-org.js',
] as const;

/** Dokładnie te literały odbijały się od constraintu przed naprawą. */
const LEGACY_LITERALS = [
  'step3',
  'step3_list',
  'step4_pilot',
  'step5_full',
  'step2_assess',
  'step2_assessment',
  'cancelled',
] as const;

const ARCHILEX_SEED = 'server/scripts/seed-archilex-demo-org.js';
const ARCHILEX_STORY = 'docs/demo/ARCHILEX_STORY.md';

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

/**
 * Usuwa komentarze przed skanowaniem. Bez tego test łapie własne komentarze
 * wyjaśniające (które CYTUJĄ stare literały) i czerwienieje na opisie zamiast
 * na kodzie. Skanujemy tylko to, co faktycznie trafia do bazy.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** `{ id: IDS.INIT_H1, ..., status: 'EXECUTING', ... }` -> Map('H1' -> 'EXECUTING'). */
function archilexSeedStatuses(): Map<string, string> {
  const out = new Map<string, string>();
  const src = read(ARCHILEX_SEED);
  const re = /\{\s*id:\s*IDS\.INIT_([A-Z0-9]+)\b[^}]*?status:\s*'([^']+)'/g;
  for (const m of src.matchAll(re)) out.set(m[1], m[2]);
  return out;
}

/** `| H1 | Name | executing | ... |` -> Map('H1' -> 'EXECUTING'). */
function archilexStoryStatuses(): Map<string, string> {
  const out = new Map<string, string>();
  const md = read(ARCHILEX_STORY);
  const re = /^\|\s*([HECBF]\d)\s*\|\s*[^|]+\|\s*([a-zA-Z_]+)\s*\|/gm;
  for (const m of md.matchAll(re)) out.set(m[1], m[2].trim().toUpperCase());
  return out;
}

function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('${{')) return null;
  return trimmed;
}

function buildClientConfig(): ClientConfig | null {
  const databaseUrl = readDatabaseUrl();
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      connectionTimeoutMillis: PROBE_TIMEOUT_MS,
      statement_timeout: 30_000,
    };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    statement_timeout: 30_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

const tag = Date.now().toString(36);
const ORG_ID = `co10-seed-org-${tag}`;

let client: Client;
let reachable = false;

beforeAll(async () => {
  if (!DB_CONFIGURED) return;
  const config = buildClientConfig();
  if (!config) return;
  client = new Client(config);
  try {
    await client.connect();
    await client.query('SELECT 1');
    reachable = true;
  } catch (error) {
    throw new Error(
      `Postgres is configured but unreachable — refusing to pass vacuously: ${String(error)}`
    );
  }
  await client.query(
    `INSERT INTO organizations (id, name, plan, status)
     VALUES ($1, $2, 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [ORG_ID, 'CLOSEOUT-CO10 seed-status org']
  );
}, 60_000);

afterAll(async () => {
  if (!reachable) return;
  // Probe'y sprzątają po sobie — dane demo są twarzą produktu.
  try {
    await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
  } finally {
    await client.end();
  }
});

describe('CLOSEOUT-10 — demo seeds write canonical initiative statuses', () => {
  // --------------------------------------------------------------------
  // Część statyczna — działa BEZ bazy, bo to ona pilnuje regresji w kodzie.
  // --------------------------------------------------------------------

  it.each(SEED_FILES)('scenario 1: %s carries no legacy funnel status', (rel) => {
    const src = stripComments(read(rel));
    const legacy = [...src.matchAll(/'(step\d_[a-z]+|step3)'/g)].map((m) => m[1]);
    expect(legacy, `${rel} still writes legacy funnel statuses: ${legacy.join(', ')}`).toEqual([]);
  });

  it('scenario 2: archilex seed matches its own spec (ARCHILEX_STORY.md), 15/15', () => {
    const seed = archilexSeedStatuses();
    const story = archilexStoryStatuses();

    expect(seed.size, 'expected 15 initiatives in the archilex seed').toBe(15);
    expect(story.size, 'expected 15 initiatives in ARCHILEX_STORY.md').toBe(15);

    for (const [id, storyStatus] of story) {
      expect(seed.get(id), `initiative ${id}: seed must match ARCHILEX_STORY.md`).toBe(storyStatus);
    }
  });

  it('scenario 3: every archilex status is canonical and UPPERCASE', () => {
    for (const [id, status] of archilexSeedStatuses()) {
      expect(CANONICAL_STATUSES, `initiative ${id} has non-canonical status '${status}'`).toContain(
        status
      );
    }
  });

  // --------------------------------------------------------------------
  // Część realdb — dowód na ŻYWEJ, zmigrowanej bazie.
  // --------------------------------------------------------------------

  it('scenario 4 (negative control): legacy literals are still REJECTED', async () => {
    if (!reachable) return;

    // Bez tego scenariusza scenario 5 przeszedłby także na bazie bez
    // constraintu — czyli udowodniłby nic.
    for (const [i, bad] of LEGACY_LITERALS.entries()) {
      await expect(
        client.query(
          `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, $4)`,
          [`co10-neg-${i}-${tag}`, ORG_ID, `CO10 negative ${bad}`, bad]
        ),
        `'${bad}' must be rejected by initiatives_status_check`
      ).rejects.toThrow(/initiatives_status_check/);
    }
  }, 60_000);

  it('scenario 5: every status the seeds now write is ACCEPTED', async () => {
    if (!reachable) return;

    // Wartości faktycznie wypisywane przez seedy po naprawie.
    const seeded = [...new Set(archilexSeedStatuses().values())].sort();
    expect(seeded.length).toBeGreaterThan(0);

    for (const [i, status] of seeded.entries()) {
      await expect(
        client.query(
          `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, $4)`,
          [`co10-pos-${i}-${tag}`, ORG_ID, `CO10 positive ${status}`, status]
        ),
        `'${status}' must satisfy initiatives_status_check`
      ).resolves.toBeTruthy();
    }

    const { rows } = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM initiatives
        WHERE organization_id = $1
          AND status <> ALL($2::text[])`,
      [ORG_ID, [...CANONICAL_STATUSES]]
    );
    expect(rows[0]?.count, 'no non-canonical row may survive').toBe('0');
  }, 60_000);
});
