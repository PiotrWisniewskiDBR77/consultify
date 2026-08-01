/**
 * FIN-005 — tests for `server/scripts/fin005-seed-atelier-finance.ts`.
 *
 * ===========================================================================
 * TWO LAYERS, ON PURPOSE
 * ===========================================================================
 * 1. STRUCTURAL / REFUSAL tests run everywhere. They prove the guards refuse
 *    before anything is opened, and they prove — by SCANNING THE MODULE'S OWN
 *    SOURCE AND THE SQL ITS BUILDERS PRODUCE, not by reading a comment — that
 *    the command contains no destructive statement and can never delete a
 *    tenant.
 *
 * 2. DATABASE tests run against a REAL local PostgreSQL and are the only way
 *    to prove "a dry run mutates nothing" and "`--write` is idempotent": both
 *    are claims about what the database contains before and after, and an
 *    in-memory fake would only re-assert the code's own assumptions. They
 *    compare FULL ROW SNAPSHOTS (`SELECT *`, every column, including
 *    `updated_at`), so a no-op re-run that silently touched a timestamp fails.
 *
 * ===========================================================================
 * HOW TO RUN
 * ===========================================================================
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/fin005_b \
 *   npx vitest run --retry=0 server/src/scripts/__tests__/fin005SeedAtelierFinance.test.ts
 *
 * `NODE_ENV=test` ALONE IS A TRAP: `Database.ts` then hands back an in-memory
 * MOCK and every write becomes a no-op, so the DB suite would pass while
 * touching nothing. `RUN_DB_TESTS=1` and `MOCK_DB=false` force the real driver.
 * Without a reachable database the DB suite SKIPS loudly; the structural suite
 * always runs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  getAtelierFinanceCanonicalIds,
  ATELIER_CANONICAL_MODEL_NAME_EN,
  ATELIER_FINANCE_CURRENCY,
} from '../../services/demo/atelierFinanceSeed.js';
import {
  verifyCanonicalFixture,
  FIN005_APPROVED_DEMO_TARGETS,
  type CanonicalFixtureReadback,
  type DemoTargetFingerprint,
} from '../../services/demo/financeDemoCoherencePolicy.js';
import {
  buildCanonicalModelUpsert,
  buildPriorStateQuery,
  buildRecoveryManifest,
  buildSeedPreflight,
  main,
  probePinnedCapability,
  runFin005AtelierFinanceSeed,
  CANONICAL_TABLES,
  COLUMNS_QUERY,
  CONFIRM_ENV,
  CONFIRM_VALUE,
} from '../../../scripts/fin005-seed-atelier-finance.js';

process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../..');
const MODULE_PATH = path.join(REPO_ROOT, 'server/scripts/fin005-seed-atelier-finance.ts');
const MODULE_SOURCE = fs.readFileSync(MODULE_PATH, 'utf8');

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

async function canReach(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

const REACHABLE = REAL_DB_REQUESTED ? await canReach(CONNECTION_STRING) : false;

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[FIN-005 seed DB suite SKIPPED — clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<reachable postgres>. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

/** Fingerprint of the local scratch database, for the DB suite only. */
function localFingerprint(): { host: string; port: number; database: string } {
  const url = new URL(CONNECTION_STRING || 'postgresql://user@localhost:5432/none');
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    database: url.pathname.replace(/^\/+/, ''),
  };
}

const DEMO_ORG = 'fin005-seed-demo';
const NON_DEMO_ORG = 'fin005-seed-trial';

function allowlistFor(organizationId: string): ReadonlyArray<DemoTargetFingerprint> {
  const local = localFingerprint();
  return [
    {
      railwayProject: 'local-scratch',
      railwayEnvironment: 'scratch',
      railwayService: 'Postgres',
      host: local.host,
      port: local.port,
      database: local.database,
      organizationId,
    },
  ];
}

function argvFor(organizationId: string, extra: string[] = []): string[] {
  const local = localFingerprint();
  return [
    '--demo-org-id',
    organizationId,
    '--locale',
    'en',
    '--railway-project',
    'local-scratch',
    '--railway-environment',
    'scratch',
    '--railway-service',
    'Postgres',
    '--expect-host',
    local.host,
    '--expect-port',
    String(local.port),
    '--expect-database',
    local.database,
    ...extra,
  ];
}

const silent = () => undefined;

// ---------------------------------------------------------------------------
// 1-4. Structural and refusal tests — no database required
// ---------------------------------------------------------------------------

describe('FIN-005 seed — target authority', () => {
  it('1. refuses when the target is not declared — nothing is defaulted', async () => {
    // A locale and a database URL are present; the fingerprint fields are not.
    await expect(
      runFin005AtelierFinanceSeed({
        argv: ['--locale', 'en', '--database-url', CONNECTION_STRING || 'postgresql://u@localhost:5432/x'],
        log: silent,
      })
    ).rejects.toThrow(/must be declared explicitly, no defaults/);
  });

  it('1b. refuses a partially declared target', async () => {
    await expect(
      runFin005AtelierFinanceSeed({
        argv: [
          '--locale',
          'en',
          '--database-url',
          CONNECTION_STRING || 'postgresql://u@localhost:5432/x',
          '--railway-project',
          'consultify',
          '--demo-org-id',
          'demo-org',
        ],
        log: silent,
      })
    ).rejects.toThrow(/Missing: railwayEnvironment, railwayService, host, port, database/);
  });

  it('1c. refuses when the locale is not declared — it decides customer-visible titles', async () => {
    await expect(
      runFin005AtelierFinanceSeed({ argv: ['--demo-org-id', 'demo-org'], log: silent })
    ).rejects.toThrow(/--locale must be declared explicitly/);
  });

  it('1d. has no escape hatch', async () => {
    for (const flag of ['--force', '--force-org', '--force-target', '--skip-preflight', '--rebuild']) {
      await expect(
        runFin005AtelierFinanceSeed({ argv: ['--locale', 'en', flag], log: silent })
      ).rejects.toThrow(/does not exist. This command has no override/);
    }
  });

  it('4. refuses a host or database that is not the approved one', async () => {
    const declared = [
      '--demo-org-id',
      'demo-org',
      '--locale',
      'en',
      '--railway-project',
      'consultify',
      '--railway-environment',
      'demo',
      '--railway-service',
      'Postgres',
      '--expect-host',
      'trolley.proxy.rlwy.net',
      '--expect-port',
      '28146',
      '--expect-database',
      'railway',
    ];

    // The connection resolves somewhere else than the declaration claims.
    await expect(
      main([...declared, '--database-url', 'postgresql://u:p@evil.example.com:28146/railway'])
    ).rejects.toThrow(/declared host "trolley\.proxy\.rlwy\.net" but the connection resolves to "evil\.example\.com"/);

    await expect(
      main([...declared, '--database-url', 'postgresql://u:p@trolley.proxy.rlwy.net:28146/other_db'])
    ).rejects.toThrow(/declared database "railway" but the connection resolves to "other_db"/);

    // No port in the URL is a refusal, never "the default port".
    await expect(
      main([...declared, '--database-url', 'postgresql://u:p@trolley.proxy.rlwy.net/railway'])
    ).rejects.toThrow(/carries no port/);

    // A declaration that is internally consistent but not on the allowlist.
    await expect(
      main([
        '--demo-org-id',
        'demo-org',
        '--locale',
        'en',
        '--railway-project',
        'consultify',
        '--railway-environment',
        'staging',
        '--railway-service',
        'Postgres',
        '--expect-host',
        'trolley.proxy.rlwy.net',
        '--expect-port',
        '28146',
        '--expect-database',
        'railway',
        '--database-url',
        'postgresql://u:p@trolley.proxy.rlwy.net:28146/railway',
      ])
    ).rejects.toThrow(/is not on the FIN-005 allowlist/);
  });

  it('4b. refuses a production-looking target before consulting anything else', async () => {
    await expect(
      main([
        '--demo-org-id',
        'demo-org',
        '--locale',
        'en',
        '--railway-project',
        'consultify',
        '--railway-environment',
        'production',
        '--railway-service',
        'Postgres',
        '--expect-host',
        'centerbeam.proxy.rlwy.net',
        '--expect-port',
        '37823',
        '--expect-database',
        'railway',
        '--database-url',
        'postgresql://u:p@centerbeam.proxy.rlwy.net:37823/railway',
      ])
    ).rejects.toThrow(/matches a forbidden production/);
  });

  it('4c. the CLI cannot substitute an allowlist — main() never forwards one', () => {
    // `allowlist` is a parameter of the exported runner, reachable only from a
    // test. Nothing reads it from argv or the environment.
    expect(MODULE_SOURCE).not.toMatch(/args\[['"]allowlist['"]\]/);
    expect(MODULE_SOURCE).not.toMatch(/FIN005_[A-Z_]*ALLOWLIST/);
    expect(MODULE_SOURCE).toMatch(/export async function main\([^)]*\)[^{]*\{\s*await runFin005AtelierFinanceSeed\(\{ argv \}\);/);
    // The real allowlist is the module-level constant, used by default.
    expect(FIN005_APPROVED_DEMO_TARGETS.length).toBeGreaterThan(0);
  });
});

describe('FIN-005 seed — structural non-destructiveness', () => {
  it('3. contains no destructive SQL anywhere in its own source', () => {
    // Strip comments first, so the prose above ("DELETE nothing", "no DROP")
    // cannot make this test pass OR fail for the wrong reason.
    const code = MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const keyword of [
      /\bDELETE\s+FROM\b/i,
      /\bDROP\s+(TABLE|DATABASE|SCHEMA|COLUMN|INDEX)\b/i,
      /\bTRUNCATE\b/i,
      /\bALTER\s+TABLE\b/i,
      /\bCREATE\s+TABLE\b/i,
    ]) {
      expect(code, `destructive statement matched ${keyword}`).not.toMatch(keyword);
    }
  });

  it('3b. never writes to the organizations table — the SQL it produces cannot name it', () => {
    const code = MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // Not "the word never appears" (the guard messages talk about organizations)
    // — the assertion is that no SQL VERB in this module is followed by the
    // organizations table.
    expect(code).not.toMatch(/\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|FROM)\s+"?organizations"?\b/i);
  });

  it('3c. the only writing statement it can build is the canonical model upsert', () => {
    const upsert = buildCanonicalModelUpsert({
      organizationId: DEMO_ORG,
      packId: `${DEMO_ORG}--statement-pack--x`,
      modelId: `${DEMO_ORG}--financial-model--transformation-2015-roi`,
      locale: 'en',
      projectId: null,
      createdBy: null,
      presentColumns: new Set([
        'id',
        'organization_id',
        'project_id',
        'name',
        'description',
        'currency',
        'horizon_months',
        'start_date',
        'granularity',
        'scenario',
        'status',
        'created_by',
        'source_statement_pack_id',
        'updated_at',
      ]),
    });

    expect(upsert.sql).toMatch(/^INSERT INTO financial_models /);
    expect(upsert.sql).not.toMatch(/\bDELETE\b|\bDROP\b|\bTRUNCATE\b|\bALTER\b/i);
    expect(upsert.sql).not.toMatch(/organizations/);
    // The guarded update is what keeps a no-op re-run from touching updated_at.
    expect(upsert.sql).toMatch(/WHERE .*IS DISTINCT FROM/);
    // Every value is a bound parameter — no inline literals.
    expect(upsert.sql.match(/\$\d+/g)?.length).toBe(upsert.params.length);

    // The read helpers are read-only by construction.
    for (const table of CANONICAL_TABLES) {
      expect(buildPriorStateQuery(table)).toMatch(/^SELECT \* FROM "/);
    }
    expect(() => buildPriorStateQuery('organizations')).toThrow(/not a canonical FIN-005 Finance table/);
    expect(COLUMNS_QUERY).toMatch(/^SELECT column_name FROM information_schema\.columns/);
  });

  it('3d. refuses to build the model upsert when the pack binding column is missing', () => {
    expect(() =>
      buildCanonicalModelUpsert({
        organizationId: DEMO_ORG,
        packId: 'p',
        modelId: 'm',
        locale: 'en',
        projectId: null,
        createdBy: null,
        presentColumns: new Set(['id', 'organization_id', 'name', 'currency', 'status']),
      })
    ).toThrow(/no source_statement_pack_id column/);
  });

  it('3e. is not reachable through the generic demo-seed entry point', () => {
    const generic = [
      'server/scripts/build-demo-dataset.ts',
      'server/src/services/demo/demoSeedService.ts',
    ];
    for (const relative of generic) {
      const source = fs.readFileSync(path.join(REPO_ROOT, relative), 'utf8');
      expect(source, `${relative} must not import the FIN-005 seed command`).not.toMatch(
        /fin005-seed-atelier-finance/
      );
    }
    const packageJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const chained = Object.entries(packageJson.scripts || {}).filter(
      ([name, body]) => body.includes('fin005-seed-atelier-finance') && name !== 'fin005:seed:atelier'
    );
    expect(chained).toEqual([]);
  });
});

describe('FIN-005 seed — preflight and manifest shape', () => {
  const canonical = getAtelierFinanceCanonicalIds(DEMO_ORG);

  const emptyReadback: CanonicalFixtureReadback = {
    packs: [],
    statements: [],
    values: [],
    analyses: [],
    models: [],
  };

  it('reports every canonical row as "create" on an empty tenant', () => {
    const preflight = buildSeedPreflight(emptyReadback, DEMO_ORG);
    expect(preflight.fixtureReady).toBe(false);
    expect(preflight.summary.create).toBe(
      1 + canonical.statementIds.length + canonical.statementValueIds.length + 1 + 1
    );
    expect(preflight.summary.unchanged).toBe(0);
    expect(preflight.rows.every((row) => row.action === 'create')).toBe(true);
  });

  it('distinguishes "present but not promoted" from "absent"', () => {
    const readback: CanonicalFixtureReadback = {
      ...emptyReadback,
      packs: [
        {
          id: canonical.packId,
          organizationId: DEMO_ORG,
          packStatus: 'draft',
          packReadinessStatus: 'pending',
        },
      ],
    };
    const preflight = buildSeedPreflight(readback, DEMO_ORG);
    const packRow = preflight.rows.find((row) => row.id === canonical.packId);
    expect(packRow?.action).toBe('promote');
    expect(packRow?.detail).toContain('pack_status=draft');
  });

  it('the recovery manifest records the prior state and what did not exist yet', () => {
    const manifest = buildRecoveryManifest({
      runId: 'run-1',
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      approved: allowlistFor(DEMO_ORG)[0],
      locale: 'en',
      priorFixture: emptyReadback,
      priorRows: Object.fromEntries(CANONICAL_TABLES.map((table) => [table, []])),
      plan: buildSeedPreflight(emptyReadback, DEMO_ORG).rows,
    });
    expect(manifest.status).toBe('PREPARED');
    expect(manifest.absentBefore.financial_statement_packs).toEqual([canonical.packId]);
    expect(manifest.absentBefore.financial_models).toEqual([canonical.modelId]);
    expect(manifest.target.organizationId).toBe(DEMO_ORG);
    expect(manifest.priorFixtureDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// 2, 5, 6, 7. Against a REAL local PostgreSQL
// ---------------------------------------------------------------------------

const dbSuite = REACHABLE ? describe.sequential : describe.skip;

dbSuite('FIN-005 seed — against a real local PostgreSQL', () => {
  let control: Pool;

  /** Full row snapshot of every canonical Finance table, every column. */
  async function snapshot(organizationId: string): Promise<Record<string, unknown[]>> {
    const ids = getAtelierFinanceCanonicalIds(organizationId);
    const out: Record<string, unknown[]> = {};
    for (const table of CANONICAL_TABLES) {
      const result = await control.query(
        `SELECT * FROM "${table}" WHERE id = ANY($1::text[]) ORDER BY id`,
        [ids.byTable[table] || []]
      );
      out[table] = result.rows;
    }
    // Also snapshot the tenant row itself: the command must never touch it.
    const org = await control.query('SELECT * FROM organizations WHERE id = $1', [organizationId]);
    out.__organization = org.rows;
    return out;
  }

  async function readFixture(organizationId: string): Promise<CanonicalFixtureReadback> {
    const ids = getAtelierFinanceCanonicalIds(organizationId);
    const pick = async (sql: string, values: string[]) =>
      values.length ? (await control.query(sql, [values, organizationId])).rows : [];
    const packs = await pick(
      `SELECT id::text AS id, organization_id::text AS organization_id,
              pack_status::text AS pack_status, pack_readiness_status::text AS pack_readiness_status
         FROM financial_statement_packs WHERE id = ANY($1::text[]) AND organization_id = $2`,
      [ids.packId]
    );
    const statements = await pick(
      `SELECT id::text AS id, organization_id::text AS organization_id,
              statement_pack_id::text AS statement_pack_id, status::text AS status,
              readiness_status::text AS readiness_status
         FROM financial_statements WHERE id = ANY($1::text[]) AND organization_id = $2`,
      ids.statementIds
    );
    const values = ids.statementValueIds.length
      ? (
          await control.query(
            `SELECT id::text AS id, statement_id::text AS statement_id
               FROM financial_statement_values WHERE id = ANY($1::text[])`,
            [ids.statementValueIds]
          )
        ).rows
      : [];
    const analyses = await pick(
      `SELECT id::text AS id, organization_id::text AS organization_id,
              source_statement_pack_id::text AS source_statement_pack_id,
              source_statement_ids, status::text AS status
         FROM financial_analyses WHERE id = ANY($1::text[]) AND organization_id = $2`,
      [ids.analysisId]
    );
    const models = await pick(
      `SELECT id::text AS id, organization_id::text AS organization_id,
              source_statement_pack_id::text AS source_statement_pack_id
         FROM financial_models WHERE id = ANY($1::text[]) AND organization_id = $2`,
      [ids.modelId]
    );
    const parseIds = (raw: unknown): string[] => {
      if (Array.isArray(raw)) return raw.map(String);
      try {
        const parsed = JSON.parse(String(raw ?? '[]'));
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    };
    return {
      packs: packs.map((row) => ({
        id: String(row.id),
        organizationId: String(row.organization_id),
        packStatus: row.pack_status ?? null,
        packReadinessStatus: row.pack_readiness_status ?? null,
      })),
      statements: statements.map((row) => ({
        id: String(row.id),
        organizationId: String(row.organization_id),
        statementPackId: row.statement_pack_id ?? null,
        status: row.status ?? null,
        readinessStatus: row.readiness_status ?? null,
      })),
      values: values.map((row) => ({ id: String(row.id), statementId: String(row.statement_id) })),
      analyses: analyses.map((row) => ({
        id: String(row.id),
        organizationId: String(row.organization_id),
        sourceStatementPackId: row.source_statement_pack_id ?? null,
        sourceStatementIds: parseIds(row.source_statement_ids),
        status: row.status ?? null,
      })),
      models: models.map((row) => ({
        id: String(row.id),
        organizationId: String(row.organization_id),
        sourceStatementPackId: row.source_statement_pack_id ?? null,
      })),
    };
  }

  async function removeFixtureRows(organizationId: string): Promise<void> {
    // Harness-only teardown. This is the TEST cleaning up after itself; the
    // command under test contains no statement like it (see test 3).
    for (const table of [
      'financial_statement_values',
      'financial_statement_ingest_runs',
      'financial_statements',
      'financial_analyses',
      'financial_models',
      'financial_statement_packs',
    ]) {
      await control.query(`DELETE FROM "${table}" WHERE id LIKE $1`, [`${organizationId}--%`]);
    }
  }

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 4 });
    for (const [id, type, name] of [
      [DEMO_ORG, 'DEMO', 'FIN-005 seed demo tenant'],
      [NON_DEMO_ORG, 'TRIAL', 'FIN-005 seed non-demo tenant'],
    ] as const) {
      await control.query(
        `INSERT INTO organizations (id, name, organization_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET organization_type = excluded.organization_type`,
        [id, name, type]
      );
    }
    await removeFixtureRows(DEMO_ORG);
    await removeFixtureRows(NON_DEMO_ORG);
  }, 120_000);

  afterAll(async () => {
    if (!control) return;
    await removeFixtureRows(DEMO_ORG).catch(() => undefined);
    await removeFixtureRows(NON_DEMO_ORG).catch(() => undefined);
    await control
      .query('DELETE FROM organizations WHERE id = ANY($1::text[])', [[DEMO_ORG, NON_DEMO_ORG]])
      .catch(() => undefined);
    await control.end().catch(() => undefined);
    const { default: db } = await import('../../database/PostgresDatabase.js');
    await (db as unknown as { close: () => Promise<void> }).close().catch(() => undefined);
  }, 120_000);

  it('5. refuses a tenant whose organization_type is not exactly DEMO', async () => {
    const before = await snapshot(NON_DEMO_ORG);
    await expect(
      runFin005AtelierFinanceSeed({
        argv: argvFor(NON_DEMO_ORG, ['--write']),
        allowlist: allowlistFor(NON_DEMO_ORG),
        log: silent,
      })
    ).rejects.toThrow(/organization_type is "TRIAL", expected exactly "DEMO"/);
    expect(await snapshot(NON_DEMO_ORG)).toEqual(before);
  }, 60_000);

  it('5b. refuses a tenant that does not exist — and never creates one', async () => {
    const missing = 'fin005-seed-does-not-exist';
    await expect(
      runFin005AtelierFinanceSeed({
        argv: argvFor(missing, ['--write']),
        allowlist: allowlistFor(missing),
        log: silent,
      })
    ).rejects.toThrow(/does not exist in the target database. This command never creates/);
    const org = await control.query('SELECT id FROM organizations WHERE id = $1', [missing]);
    expect(org.rowCount).toBe(0);
  }, 60_000);

  it('pinned capability is proved by a real BEGIN/ROLLBACK, not by the driver probe alone', async () => {
    const local = localFingerprint();

    // The happy path: a real pinned connection on the approved database.
    const ok = await probePinnedCapability(control, local.database);
    expect(ok.supported).toBe(true);
    expect(ok.reason).toMatch(/BEGIN\/ROLLBACK proved on a pinned connection/);

    // A connection that answers, but on a DIFFERENT database than approved.
    const mismatched = await probePinnedCapability(control, 'some_other_database');
    expect(mismatched.supported).toBe(false);
    expect(mismatched.reason).toMatch(/not the approved "some_other_database"/);

    // A pool that cannot hand out a client at all.
    const dead = new Pool({
      connectionString: 'postgresql://nobody@127.0.0.1:1/none',
      max: 1,
      connectionTimeoutMillis: 1000,
    });
    try {
      const verdict = await probePinnedCapability(dead, local.database);
      expect(verdict.supported).toBe(false);
      expect(verdict.reason).toMatch(/could not check out a pinned connection/);
    } finally {
      await dead.end().catch(() => undefined);
    }
  }, 60_000);

  it('6. a dry run mutates nothing — full row snapshots are identical', async () => {
    const before = await snapshot(DEMO_ORG);
    const outcome = await runFin005AtelierFinanceSeed({
      argv: argvFor(DEMO_ORG),
      allowlist: allowlistFor(DEMO_ORG),
      log: silent,
    });
    expect(outcome.dryRun).toBe(true);
    expect(outcome.preflight.fixtureReady).toBe(false);
    expect(outcome.preflight.summary.create).toBeGreaterThan(0);
    expect(outcome.manifestPath).toBeUndefined();
    expect(fs.existsSync(outcome.reportPath)).toBe(true);
    expect(await snapshot(DEMO_ORG)).toEqual(before);
  }, 120_000);

  it('2. --write without the confirmation token refuses and writes nothing', async () => {
    const previous = process.env[CONFIRM_ENV];
    delete process.env[CONFIRM_ENV];
    const before = await snapshot(DEMO_ORG);
    try {
      await expect(
        runFin005AtelierFinanceSeed({
          argv: argvFor(DEMO_ORG, ['--write']),
          allowlist: allowlistFor(DEMO_ORG),
          log: silent,
        })
      ).rejects.toThrow(new RegExp(`Confirmation required. Set ${CONFIRM_ENV}=${CONFIRM_VALUE}`));

      // The quarantine token must NOT authorise a seed.
      process.env[CONFIRM_ENV] = 'QUARANTINE_FOREIGN_FINANCE';
      await expect(
        runFin005AtelierFinanceSeed({
          argv: argvFor(DEMO_ORG, ['--write']),
          allowlist: allowlistFor(DEMO_ORG),
          log: silent,
        })
      ).rejects.toThrow(/Confirmation required/);
    } finally {
      if (previous === undefined) delete process.env[CONFIRM_ENV];
      else process.env[CONFIRM_ENV] = previous;
    }
    expect(await snapshot(DEMO_ORG)).toEqual(before);
  }, 120_000);

  it('7. --write materializes the canonical fixture and is idempotent on a second run', async () => {
    const previous = process.env[CONFIRM_ENV];
    process.env[CONFIRM_ENV] = CONFIRM_VALUE;
    try {
      const first = await runFin005AtelierFinanceSeed({
        argv: argvFor(DEMO_ORG, ['--write']),
        allowlist: allowlistFor(DEMO_ORG),
        log: silent,
      });

      expect(first.dryRun).toBe(false);
      expect(first.pinned.supported).toBe(true);
      expect(first.manifestPath).toBeDefined();
      expect(first.fixtureDigestAfter).toMatch(/^[0-9a-f]{64}$/);

      // The recovery manifest exists, was written before the first mutation and
      // records the tenant as empty beforehand.
      const manifest = JSON.parse(fs.readFileSync(first.manifestPath as string, 'utf8')) as {
        status: string;
        absentBefore: Record<string, string[]>;
        priorRows: Record<string, unknown[]>;
        postFixtureDigest?: string;
      };
      expect(manifest.status).toBe('COMPLETED');
      expect(manifest.postFixtureDigest).toBe(first.fixtureDigestAfter);
      expect(manifest.priorRows.financial_statement_packs).toEqual([]);
      expect(manifest.absentBefore.financial_models).toEqual([
        getAtelierFinanceCanonicalIds(DEMO_ORG).modelId,
      ]);

      // The fixture is READY by the same rule the quarantine applies.
      const fixture = await readFixture(DEMO_ORG);
      const verdict = verifyCanonicalFixture(fixture, DEMO_ORG);
      expect(verdict.violations).toEqual([]);
      expect(verdict.ok).toBe(true);

      // The canonical model carries the canonical name, EUR and the pack binding.
      const model = await control.query(
        'SELECT name, currency, status, source_statement_pack_id FROM financial_models WHERE id = $1',
        [getAtelierFinanceCanonicalIds(DEMO_ORG).modelId]
      );
      expect(model.rows[0].name).toBe(ATELIER_CANONICAL_MODEL_NAME_EN);
      expect(model.rows[0].currency).toBe(ATELIER_FINANCE_CURRENCY);
      expect(model.rows[0].status).toBe('approved');
      expect(model.rows[0].source_statement_pack_id).toBe(
        getAtelierFinanceCanonicalIds(DEMO_ORG).packId
      );

      // ---- idempotence: byte-identical rows, no updated_at churn -----------
      const afterFirst = await snapshot(DEMO_ORG);
      const second = await runFin005AtelierFinanceSeed({
        argv: argvFor(DEMO_ORG, ['--write']),
        allowlist: allowlistFor(DEMO_ORG),
        log: silent,
      });
      const afterSecond = await snapshot(DEMO_ORG);

      expect(second.fixtureDigestAfter).toBe(first.fixtureDigestAfter);
      expect(afterSecond).toEqual(afterFirst);
      // Belt and braces: the timestamps specifically.
      for (const table of CANONICAL_TABLES) {
        const before = (afterFirst[table] as Array<Record<string, unknown>>).map((row) => row.updated_at);
        const after = (afterSecond[table] as Array<Record<string, unknown>>).map((row) => row.updated_at);
        expect(after, `${table}.updated_at churned on a no-op re-run`).toEqual(before);
      }

      // A dry run on the ready fixture reports nothing to do.
      const third = await runFin005AtelierFinanceSeed({
        argv: argvFor(DEMO_ORG),
        allowlist: allowlistFor(DEMO_ORG),
        log: silent,
      });
      expect(third.preflight.fixtureReady).toBe(true);
      expect(third.preflight.summary.create).toBe(0);
      expect(third.preflight.summary.promote).toBe(0);
      expect(third.preflight.summary.relink).toBe(0);
      expect(await snapshot(DEMO_ORG)).toEqual(afterSecond);
    } finally {
      if (previous === undefined) delete process.env[CONFIRM_ENV];
      else process.env[CONFIRM_ENV] = previous;
    }
  }, 300_000);
});
