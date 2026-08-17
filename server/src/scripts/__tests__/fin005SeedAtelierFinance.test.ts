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
 *
 * ===========================================================================
 * THE TWIN CLUSTER — same database NAME, different server
 * ===========================================================================
 * The identity guard exists because Railway's demo and production databases are
 * BOTH called `railway`, so a name comparison proves nothing. Reproducing that
 * needs two clusters serving a database of the SAME name, which a second local
 * database cannot do. Create one (throwaway, no schema needed — the guard fires
 * before any table is read):
 *
 *   export LANG=C LC_ALL=C
 *   initdb -D /private/tmp/fin005-twin -U "$USER" \
 *     --auth-local=trust --auth-host=trust --encoding=UTF8 --locale=C
 *   pg_ctl -D /private/tmp/fin005-twin \
 *     -o "-p 5433 -k /private/tmp/fin005-twin" -l /private/tmp/fin005-twin/server.log -w start
 *   createdb -h 127.0.0.1 -p 5433 -U "$USER" fin005_b     # SAME NAME as the scratch db
 *
 * Then point `FIN005_TWIN_DATABASE_URL` at it:
 *
 *   FIN005_TWIN_DATABASE_URL=postgresql://<user>@127.0.0.1:5433/fin005_b
 *
 * Without it the twin suite SKIPS loudly. `fin005_bdrift` covers the weaker
 * "different database, same cluster" case and needs no extra setup.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildCanonicalModelEventUpsert,
  buildCanonicalModelUpsert,
  buildPriorStateQuery,
  buildRecoveryManifest,
  buildSeedPreflight,
  CANONICAL_MODEL_EVENTS,
  CANONICAL_TABLES,
  canonicalModelEventId,
  canonicalModelEventIds,
  CLEANUP_IMPORTS,
  COLUMNS_QUERY,
  compareConnectionIdentity,
  CONFIRM_ENV,
  CONFIRM_VALUE,
  CONNECTION_IDENTITY_SQL,
  CONNECTION_SYSTEM_IDENTIFIER_SQL,
  type ConnectionIdentity,
  GATEWAY_METHODS_USED,
  main,
  probePinnedCapability,
  probePoolIdentity,
  probeWritePathIdentity,
  READ_PATH_IDENTITY_FIELDS,
  runFin005AtelierFinanceSeed,
  SNAPSHOT_TABLES,
  WRITE_PATH_IDENTITY_FIELDS,
} from '../../../scripts/fin005-seed-atelier-finance.js';
import type { SeedRecoveryManifest } from '../../../scripts/fin005-seed-atelier-finance.js';
import {
  ATELIER_CANONICAL_MODEL_NAME_EN,
  ATELIER_FINANCE_CURRENCY,
  getAtelierFinanceCanonicalIds,
} from '../../services/demo/atelierFinanceSeed.js';
import {
  type CanonicalFixtureReadback,
  type DemoTargetFingerprint,
  FIN005_APPROVED_DEMO_TARGETS,
  verifyCanonicalFixture,
} from '../../services/demo/financeDemoCoherencePolicy.js';

process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../..');
const MODULE_PATH = path.join(REPO_ROOT, 'server/scripts/fin005-seed-atelier-finance.ts');
const MODULE_SOURCE = fs.readFileSync(MODULE_PATH, 'utf8');

/**
 * `process.env.DATABASE_URL` is now the ONE target: `--database-url` is gone, so
 * the tests that used it have to move the environment variable instead. This is
 * exactly how an operator misconfigures the run, which makes it the right shape
 * for the test.
 */
const CONNECTION_STRING = process.env.DATABASE_URL ?? '';

async function withDatabaseUrl<T>(url: string, run: () => Promise<T>): Promise<T> {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = url;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
}

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

/** A second database on the SAME cluster — different name, different OID. */
const DRIFT_CONNECTION_STRING = CONNECTION_STRING.replace(/\/[^/]+$/, '/fin005_bdrift');
const DRIFT_REACHABLE = REACHABLE ? await canReach(DRIFT_CONNECTION_STRING) : false;

/** A different CLUSTER serving a database of the SAME NAME — the Railway case. */
const TWIN_CONNECTION_STRING = process.env.FIN005_TWIN_DATABASE_URL ?? '';
const TWIN_REACHABLE =
  REACHABLE && TWIN_CONNECTION_STRING.startsWith('postgres')
    ? await canReach(TWIN_CONNECTION_STRING)
    : false;

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[FIN-005 seed DB suite SKIPPED — clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<reachable postgres>. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}
if (REACHABLE && !TWIN_REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[FIN-005 twin-cluster suite SKIPPED — clean skip, not a failure] needs ` +
      `FIN005_TWIN_DATABASE_URL pointing at a SECOND PostgreSQL cluster serving a database with the ` +
      `SAME NAME as DATABASE_URL. Recipe in this file's header. This is the suite that proves a NAME ` +
      `comparison is not enough.`
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
  const SOME_URL = CONNECTION_STRING || 'postgresql://u@localhost:5432/x';

  it('1. refuses when the target is not declared — nothing is defaulted', async () => {
    // A locale and a database URL are present; the fingerprint fields are not.
    await expect(
      withDatabaseUrl(SOME_URL, () =>
        runFin005AtelierFinanceSeed({ argv: ['--locale', 'en'], log: silent })
      )
    ).rejects.toThrow(/must be declared explicitly, no defaults/);
  });

  it('1b. refuses a partially declared target', async () => {
    await expect(
      withDatabaseUrl(SOME_URL, () =>
        runFin005AtelierFinanceSeed({
          argv: ['--locale', 'en', '--railway-project', 'consultify', '--demo-org-id', 'demo-org'],
          log: silent,
        })
      )
    ).rejects.toThrow(/Missing: railwayEnvironment, railwayService, host, port, database/);
  });

  it('1e. refuses --database-url — it was the one way to split the guards from the writes', async () => {
    // The flag is not "ignored"; it is a hard error, so a runbook or a shell
    // alias that still carries it stops instead of silently doing the old thing.
    await expect(
      withDatabaseUrl(SOME_URL, () =>
        runFin005AtelierFinanceSeed({
          argv: ['--locale', 'en', '--database-url', 'postgresql://u@localhost:5432/anything'],
          log: silent,
        })
      )
    ).rejects.toThrow(/--database-url does not exist/);

    // It refuses BEFORE the target is even parsed, so no partially-guarded run
    // can exist, and the message names the actual failure mode.
    await expect(
      withDatabaseUrl(SOME_URL, () =>
        runFin005AtelierFinanceSeed({
          argv: ['--database-url', 'postgresql://u@localhost:5432/anything'],
          log: silent,
        })
      )
    ).rejects.toThrow(/writes through DbPromise, which resolves DATABASE_URL on its own/);

    // And nothing in the module reads a URL from anywhere but DATABASE_URL.
    const code = MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).toMatch(/databaseUrl: process\.env\.DATABASE_URL/);
    expect(code).not.toMatch(/args\[['"]database-url['"]\]\s*\|\|/);
  });

  it('1c. refuses when the locale is not declared — it decides customer-visible titles', async () => {
    await expect(
      runFin005AtelierFinanceSeed({ argv: ['--demo-org-id', 'demo-org'], log: silent })
    ).rejects.toThrow(/--locale must be declared explicitly/);
  });

  it('1d. has no escape hatch', async () => {
    for (const flag of [
      '--force',
      '--force-org',
      '--force-target',
      '--skip-preflight',
      '--rebuild',
    ]) {
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
      withDatabaseUrl('postgresql://u:p@evil.example.com:28146/railway', () => main(declared))
    ).rejects.toThrow(
      /declared host "trolley\.proxy\.rlwy\.net" but the connection resolves to "evil\.example\.com"/
    );

    await expect(
      withDatabaseUrl('postgresql://u:p@trolley.proxy.rlwy.net:28146/other_db', () =>
        main(declared)
      )
    ).rejects.toThrow(/declared database "railway" but the connection resolves to "other_db"/);

    // No port in the URL is a refusal, never "the default port".
    await expect(
      withDatabaseUrl('postgresql://u:p@trolley.proxy.rlwy.net/railway', () => main(declared))
    ).rejects.toThrow(/carries no port/);

    // A declaration that is internally consistent but not on the allowlist.
    await expect(
      withDatabaseUrl('postgresql://u:p@trolley.proxy.rlwy.net:28146/railway', () =>
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
        ])
      )
    ).rejects.toThrow(/is not on the FIN-005 allowlist/);
  });

  it('4b. refuses a production-looking target before consulting anything else', async () => {
    await expect(
      withDatabaseUrl('postgresql://u:p@centerbeam.proxy.rlwy.net:37823/railway', () =>
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
        ])
      )
    ).rejects.toThrow(/matches a forbidden production/);
  });

  it('4c. the CLI cannot substitute an allowlist — main() never forwards one', () => {
    // `allowlist` is a parameter of the exported runner, reachable only from a
    // test. Nothing reads it from argv or the environment.
    expect(MODULE_SOURCE).not.toMatch(/args\[['"]allowlist['"]\]/);
    expect(MODULE_SOURCE).not.toMatch(/FIN005_[A-Z_]*ALLOWLIST/);
    expect(MODULE_SOURCE).toMatch(
      /export async function main\([^)]*\)[^{]*\{\s*await runFin005AtelierFinanceSeed\(\{ argv \}\);/
    );
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

  it('3b2. reaches nothing destructive THROUGH the cleanup script it imports', () => {
    // Scanning this module's own text is not enough: it imports
    // `finance-demo-coherence-cleanup.ts`, whose gateway exposes
    // `withTransaction` and a destructive transaction type. What keeps that out
    // of reach is not the absence of the word DELETE here — it is WHICH
    // bindings are imported and WHICH methods are called. Assert both, so a
    // future `gateway.withTransaction(...)` fails this test.
    const code = MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    // 1. The import list from the cleanup script, exactly.
    const importBlock = code.match(
      /import\s*\{([^}]*)\}\s*from\s*'\.\/finance-demo-coherence-cleanup\.js'/
    );
    expect(importBlock, 'the cleanup-script import must be a named import list').not.toBeNull();
    const imported = (importBlock as RegExpMatchArray)[1]
      .split(',')
      .map((entry) => entry.replace(/\btype\b/, '').trim())
      .filter(Boolean)
      .sort();
    expect(imported).toEqual([...CLEANUP_IMPORTS].sort());
    expect(imported).not.toContain('withTransaction');
    expect(imported).not.toContain('CleanupTransaction');

    // 2. The gateway METHODS actually called, exactly. `CleanupGateway` is a
    //    type here, so the only way to reach a destructive path is a call site.
    const called = Array.from(code.matchAll(/\bgateway\.([A-Za-z_$][\w$]*)\s*\(/g))
      .map((match) => match[1])
      .sort();
    expect(Array.from(new Set(called))).toEqual([...GATEWAY_METHODS_USED].sort());
    expect(called).not.toContain('withTransaction');

    // 3. And no mutating member of either interface appears as a call site on
    //    ANYTHING in this module, however it is aliased.
    for (const member of [
      'withTransaction',
      'moveRows',
      'restoreRow',
      'lockRows',
      'lockCanonicalFixture',
      'ensureQuarantineOrganization',
    ]) {
      expect(code, `${member} must not be called from this module`).not.toMatch(
        new RegExp(`\\.${member}\\s*\\(`)
      );
    }

    // 4. The surface being guarded against really does exist — otherwise
    //    assertions 1-3 would be checking nothing, and would quietly stop
    //    meaning anything the moment the gateway were refactored.
    const cleanupSource = fs.readFileSync(
      path.join(REPO_ROOT, 'server/scripts/finance-demo-coherence-cleanup.ts'),
      'utf8'
    );
    expect(cleanupSource, 'the gateway must still expose withTransaction').toMatch(
      /withTransaction<T>\(/
    );
    expect(cleanupSource, 'the transaction type must still be able to mutate').toMatch(
      /interface CleanupTransaction \{[\s\S]*?moveRows\(/
    );
    expect(cleanupSource).toMatch(/UPDATE "\$\{?|`UPDATE /);
  });

  it('3c. the only writing statements it can build are the model and event upserts', () => {
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

    // The event upserts are the same shape: guarded, fully parameterised.
    for (const event of CANONICAL_MODEL_EVENTS) {
      const eventUpsert = buildCanonicalModelEventUpsert({
        organizationId: DEMO_ORG,
        modelId: `${DEMO_ORG}--financial-model--transformation-2015-roi`,
        event,
        locale: 'en',
        createdBy: null,
        presentColumns: new Set([
          'id',
          'model_id',
          'event_type',
          'name',
          'amount',
          'currency',
          'period_start',
          'recurrence',
          'growth_rate',
          'cf_classification',
          'posting_rules',
          'sort_order',
          'is_active',
          'created_by',
          'updated_at',
        ]),
      });
      expect(eventUpsert.sql).toMatch(/^INSERT INTO financial_model_events /);
      expect(eventUpsert.sql).not.toMatch(/\bDELETE\b|\bDROP\b|\bTRUNCATE\b|\bALTER\b/i);
      expect(eventUpsert.sql).toMatch(/WHERE .*IS DISTINCT FROM/);
      expect(eventUpsert.sql.match(/\$\d+/g)?.length).toBe(eventUpsert.params.length);
    }

    // The read helpers are read-only by construction.
    for (const table of SNAPSHOT_TABLES) {
      expect(buildPriorStateQuery(table)).toMatch(/^SELECT \* FROM "/);
    }
    expect(() => buildPriorStateQuery('organizations')).toThrow(
      /not a canonical FIN-005 Finance table/
    );
    expect(COLUMNS_QUERY).toMatch(/^SELECT column_name FROM information_schema\.columns/);
    expect(CONNECTION_IDENTITY_SQL).toMatch(/^SELECT current_database\(\)/);
    expect(CONNECTION_SYSTEM_IDENTIFIER_SQL).toMatch(/^SELECT system_identifier/);
  });

  it('3f. refuses to build an event upsert when the schema cannot hold the economics', () => {
    expect(() =>
      buildCanonicalModelEventUpsert({
        organizationId: DEMO_ORG,
        modelId: 'm',
        event: CANONICAL_MODEL_EVENTS[0],
        locale: 'en',
        createdBy: null,
        presentColumns: new Set(['id', 'model_id', 'name']),
      })
    ).toThrow(/missing required column\(s\) event_type, amount, cf_classification/);
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
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')
    ) as {
      scripts?: Record<string, string>;
    };
    const scripts = packageJson.scripts || {};

    // The generic entry point really exists (otherwise the next assertion would
    // be checking a missing key against `undefined` and proving nothing) …
    expect(scripts['db:seed:atelier'], 'the generic demo-seed script must exist').toMatch(
      /build-demo-dataset\.ts/
    );
    // … and it must not chain the FIN-005 command into the full rebuild.
    expect(scripts['db:seed:atelier']).not.toMatch(/fin005-seed-atelier-finance/);

    // No npm script references the FIN-005 command at all today: it is run by
    // hand from the runbook, with an explicitly declared target. Pinning the
    // list (rather than filtering it, which asserts nothing over an empty set)
    // means adding one becomes a deliberate, visible change — and if one is
    // ever added it must be a STANDALONE invocation, never `&&`-chained behind
    // something that has its own confirmation token.
    const referencing = Object.entries(scripts).filter(([, body]) =>
      body.includes('fin005-seed-atelier-finance')
    );
    expect(referencing.map(([name]) => name)).toEqual([]);
    for (const [name, body] of referencing) {
      expect(body, `${name} must not chain the FIN-005 seed with another command`).not.toMatch(
        /&&|\|\||;/
      );
    }
  });
});

describe('FIN-005 seed — the ROI model economics are transcribed, not invented', () => {
  /** `upsertAtelierRoiFinancialModel`'s body, as the full dataset writes it. */
  const roiSeederSource = (() => {
    const source = fs.readFileSync(
      path.join(REPO_ROOT, 'server/src/services/demo/demoSeedService.ts'),
      'utf8'
    );
    const start = source.indexOf('async function upsertAtelierRoiFinancialModel(');
    expect(start, 'upsertAtelierRoiFinancialModel must exist in demoSeedService').toBeGreaterThan(
      -1
    );
    const end = source.indexOf('\nasync function ', start + 1);
    return source.slice(start, end === -1 ? undefined : end);
  })();

  it('every event field matches the full dataset, field by field', () => {
    // The two writers of `financial_model_events` for this model must agree, or
    // a tenant's economics depend on which command last ran. Read the numbers
    // out of the other writer rather than restating them in a second comment.
    expect(CANONICAL_MODEL_EVENTS).toHaveLength(3);
    for (const event of CANONICAL_MODEL_EVENTS) {
      expect(roiSeederSource, `slug ${event.slug}`).toContain(`slug: '${event.slug}'`);
      expect(roiSeederSource, `type of ${event.slug}`).toContain(`type: '${event.eventType}'`);
      expect(roiSeederSource, `nameEn of ${event.slug}`).toContain(`nameEn: '${event.nameEn}'`);
      expect(roiSeederSource, `namePl of ${event.slug}`).toContain(`namePl: '${event.namePl}'`);
      expect(roiSeederSource, `recurrence of ${event.slug}`).toContain(
        `recurrence: '${event.recurrence}'`
      );
      expect(roiSeederSource, `cfClass of ${event.slug}`).toContain(
        `cfClass: '${event.cfClassification}'`
      );
      expect(roiSeederSource, `sortOrder of ${event.slug}`).toContain(
        `sortOrder: ${event.sortOrder}`
      );
      // Amounts are written with numeric separators in the seeder.
      const amount = Math.abs(event.amount)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, '_');
      expect(roiSeederSource, `amount of ${event.slug}`).toContain(
        `amount: ${event.amount < 0 ? '-' : ''}${amount}`
      );
      expect(roiSeederSource, `growthRate of ${event.slug}`).toContain(
        `growthRate: ${event.growthRate}`
      );
      expect(roiSeederSource, `periodStart of ${event.slug}`).toContain(
        `periodStart: '${event.periodStart}'`
      );
    }
  });

  it('uses the same currency and the same id convention as the full dataset', () => {
    expect(roiSeederSource).toContain('ATELIER_FINANCE_CURRENCY');
    expect(roiSeederSource).toContain(
      "makeId(organizationId, 'financial-model-event', event.slug)"
    );
    // `makeId` is `${orgId}--${entity}--${slug}`, so the ids must line up.
    expect(canonicalModelEventId('org-x', 'revenue-uplift')).toBe(
      'org-x--financial-model-event--revenue-uplift'
    );
  });

  it("FIN-005 round 9: assumptions_json now carries ONLY Piotr's explicitly-decided keys — nothing else invented", () => {
    // Superseded premise (rounds 5-8): "the canonical fixture has no
    // assumptions_json, so writing one would be an invention." Piotr's round-9
    // decision explicitly asked for the opposite: the discount/hurdle rate and
    // the missing-implementation-lag marker must be DATA, not a bare TS
    // constant — "wartość musi być jawna, odczytywalna i testowana." So the
    // full dataset (demoSeedService.ts) now DOES write assumptions_json. What
    // this test still guards: the write is an ALLOWLIST of exactly the keys
    // Piotr decided on, not an open door to invent baseline economics
    // (initialCash, initialEquity, a fabricated `baseline` P&L ratio set,
    // etc. — none of those were asked for and none should appear here).
    expect(roiSeederSource, 'assumptions_json must now be written').toContain('assumptions_json');
    expect(roiSeederSource, 'discountRatePct').toContain('discountRatePct');
    expect(roiSeederSource, 'hurdleRatePct').toContain('hurdleRatePct');
    expect(roiSeederSource, 'implementationLagMonths').toContain('implementationLagMonths');
    expect(roiSeederSource, 'implementationLagAssumptionStatus').toContain(
      'implementationLagAssumptionStatus'
    );
    // The lag is recorded as an explicit UNKNOWN, never a number — "nie dodawaj
    // arbitralnego przesunięcia."
    expect(roiSeederSource, 'implementationLagMonths must stay null, never a number').toMatch(
      /implementationLagMonths:\s*null/
    );
    expect(
      roiSeederSource,
      'implementationLagAssumptionStatus must flag this as a real open decision'
    ).toContain("'NEEDS_PRODUCT_DECISION'");

    // Nothing beyond that allowlist. `computeModel()` (financialModelingService.ts)
    // reads `initialCash`/`initialEquity`/`initialDebt`/`initialPPE`/`initialAR`/
    // `initialInventory`/`initialAP`/`baseline` off assumptions_json for P&L
    // extrapolation — none of those are part of Piotr's decision, so none may
    // appear here; if one does, someone started inventing balance-sheet
    // assumptions nobody asked for.
    const uninventedKeys = [
      'initialCash',
      'initialEquity',
      'initialDebt',
      'initialPPE',
      'initialAR',
      'initialInventory',
      'initialAP',
      'baseline',
    ];
    for (const key of uninventedKeys) {
      expect(roiSeederSource, `${key} must not be invented`).not.toContain(key);
    }

    // The narrow FIN-005 CLI seed command (server/scripts/fin005-seed-atelier-finance.ts)
    // is untouched by this decision — it seeds the statement/analysis/pack leg,
    // never the model, so it still has no reason to mention assumptions_json.
    expect(MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain("'assumptions_json'");
  });

  it('does not import the only writer of financial_model_outputs — it deletes', () => {
    // The canonical modeling module performs `DELETE FROM
    // financial_model_outputs`, so importing it would put a destructive
    // statement inside a command whose whole contract is that it has none.
    // Prove the premise, then the abstention.
    //
    // The premise is checked against the WHOLE module rather than a fixed
    // character window under `persistComputeResult`: which function inside
    // this module physically holds the DELETE is an implementation detail
    // (it legitimately moves when the write path is refactored, e.g. to
    // share one transaction with approveModel), whereas "this module is the
    // destructive writer" is the property this test actually depends on.
    const modelingSource = fs.readFileSync(
      path.join(REPO_ROOT, 'server/src/services/financialModelingService.ts'),
      'utf8'
    );
    expect(modelingSource).toMatch(/DELETE FROM financial_model_outputs/);
    // Comments stripped: the module's prose EXPLAINS why it abstains, and must
    // be allowed to name what it abstains from.
    const code = MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/from\s*'[^']*financialModelingService/);
    expect(code).not.toMatch(/\bpersistComputeResult\s*\(|\bcomputeModel\s*\(/);
    expect(code).not.toMatch(/INSERT INTO financial_model_outputs/);
    expect(code).not.toMatch(/INSERT INTO financial_model_validations/);
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
    const preflight = buildSeedPreflight(emptyReadback, DEMO_ORG, []);
    expect(preflight.fixtureReady).toBe(false);
    expect(preflight.economicsReady).toBe(false);
    expect(preflight.summary.create).toBe(
      1 +
        canonical.statementIds.length +
        canonical.statementValueIds.length +
        1 +
        1 +
        CANONICAL_MODEL_EVENTS.length
    );
    expect(preflight.summary.unchanged).toBe(0);
    expect(preflight.rows.every((row) => row.action === 'create')).toBe(true);
  });

  it('reports the ROI model events it would restate, field by field', () => {
    const modelEvents = CANONICAL_MODEL_EVENTS.map((event, index) => ({
      id: canonicalModelEventId(DEMO_ORG, event.slug),
      modelId: canonical.modelId,
      // The first event carries a stale amount and the app-default currency —
      // the exact drift a tenant seeded before FIN-005 standardised on EUR has.
      name: event.nameEn,
      amount: index === 0 ? 1 : event.amount,
      currency: index === 0 ? 'PLN' : ATELIER_FINANCE_CURRENCY,
      isActive: true,
    }));
    const preflight = buildSeedPreflight(emptyReadback, DEMO_ORG, modelEvents);
    const drifted = preflight.rows.find(
      (row) => row.id === canonicalModelEventId(DEMO_ORG, CANONICAL_MODEL_EVENTS[0].slug)
    );
    expect(drifted?.action).toBe('restate');
    expect(drifted?.detail).toContain('amount=1');
    expect(drifted?.detail).toContain('currency=PLN');
    expect(preflight.summary.restate).toBe(1);
    expect(preflight.economicsReady).toBe(false);

    // Canonical values, in either locale, are "unchanged".
    for (const locale of ['en', 'pl'] as const) {
      const canonicalEvents = CANONICAL_MODEL_EVENTS.map((event) => ({
        id: canonicalModelEventId(DEMO_ORG, event.slug),
        modelId: canonical.modelId,
        name: locale === 'pl' ? event.namePl : event.nameEn,
        amount: event.amount,
        currency: ATELIER_FINANCE_CURRENCY,
        isActive: true,
      }));
      expect(buildSeedPreflight(emptyReadback, DEMO_ORG, canonicalEvents).economicsReady).toBe(
        true
      );
    }
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
    const preflight = buildSeedPreflight(readback, DEMO_ORG, []);
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
      priorRows: Object.fromEntries(SNAPSHOT_TABLES.map((table) => [table, []])),
      plan: buildSeedPreflight(emptyReadback, DEMO_ORG, []).rows,
      identity: {
        systemIdentifier: '7610146894575327780',
        database: 'fin005_b',
        databaseOid: '533481',
        serverAddr: '::1',
        serverPort: '5432',
        postmasterStartEpoch: '1',
        backendPid: '1',
      },
    });
    expect(manifest.status).toBe('PREPARED');
    expect(manifest.absentBefore.financial_statement_packs).toEqual([canonical.packId]);
    expect(manifest.absentBefore.financial_models).toEqual([canonical.modelId]);
    expect(manifest.absentBefore.financial_model_events).toEqual(canonicalModelEventIds(DEMO_ORG));
    expect(manifest.target.organizationId).toBe(DEMO_ORG);
    // The evidence that the write connection was the authorised one, kept.
    expect(manifest.target.systemIdentifier).toBe('7610146894575327780');
    expect(manifest.target.databaseOid).toBe('533481');
    expect(manifest.priorFixtureDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// The identity comparison — pure, so it can state the rule without a database
// ---------------------------------------------------------------------------

describe('FIN-005 seed — connection identity comparison', () => {
  const base: ConnectionIdentity = {
    systemIdentifier: '7610146894575327780',
    database: 'railway',
    databaseOid: '16384',
    serverAddr: '10.0.0.1',
    serverPort: '28146',
    postmasterStartEpoch: '1785000000.123456',
    backendPid: '4242',
  };

  it('the NAME matching is exactly what used to pass — identity refuses it', () => {
    // Both Railway databases are called `railway`. This is the production
    // database's identity, with demo's name.
    const production: ConnectionIdentity = {
      ...base,
      systemIdentifier: '7669010021664630220',
      databaseOid: '16385',
      serverAddr: '10.0.9.9',
      serverPort: '37823',
      postmasterStartEpoch: '1784000000.000001',
    };
    expect(production.database).toBe(base.database); // the old check, and it passes

    const verdict = compareConnectionIdentity({
      authorised: base,
      observed: production,
      fields: WRITE_PATH_IDENTITY_FIELDS,
      role: 'write-path',
    });
    expect(verdict.proven).toBe(false);
    expect(verdict.differences.some((line) => line.startsWith('systemIdentifier:'))).toBe(true);
    expect(verdict.differences.some((line) => line.startsWith('serverPort:'))).toBe(true);
  });

  it('an identical connection is proven', () => {
    // A different backend pid is not a difference — it is a different session
    // on the same server, which is what a second checkout always is.
    const verdict = compareConnectionIdentity({
      authorised: base,
      observed: { ...base, backendPid: '9999' },
      fields: WRITE_PATH_IDENTITY_FIELDS,
      role: 'write-path',
    });
    expect(verdict).toEqual({ proven: true, differences: [], reason: expect.any(String) });
  });

  it('tolerates a physical standby on the READ path only', () => {
    // A streaming standby shares system_identifier, database name and database
    // OID with its primary, and legitimately differs on address, port and
    // postmaster start time.
    const standby: ConnectionIdentity = {
      ...base,
      serverAddr: '10.0.0.2',
      serverPort: '28147',
      postmasterStartEpoch: '1785000900.000000',
      backendPid: '77',
    };
    expect(
      compareConnectionIdentity({
        authorised: base,
        observed: standby,
        fields: READ_PATH_IDENTITY_FIELDS,
        role: 'read-path',
      }).proven
    ).toBe(true);
    // …but the same connection is NOT acceptable as the write path.
    expect(
      compareConnectionIdentity({
        authorised: base,
        observed: standby,
        fields: WRITE_PATH_IDENTITY_FIELDS,
        role: 'write-path',
      }).proven
    ).toBe(false);
  });

  it('refuses when system_identifier is unreadable — on one side or on both', () => {
    // One side only: different privileges, and the strongest discriminator is
    // missing on a connection we are being asked to trust.
    expect(
      compareConnectionIdentity({
        authorised: base,
        observed: { ...base, systemIdentifier: null },
        fields: WRITE_PATH_IDENTITY_FIELDS,
        role: 'write-path',
      }).proven
    ).toBe(false);

    // Both sides: everything else agrees, and it is still not proof. Two fresh
    // clusters hand out database OID 16384 for their first user database, so
    // the remaining fields can agree between genuinely different servers.
    const verdict = compareConnectionIdentity({
      authorised: { ...base, systemIdentifier: null },
      observed: { ...base, systemIdentifier: null },
      fields: WRITE_PATH_IDENTITY_FIELDS,
      role: 'write-path',
    });
    expect(verdict.proven).toBe(false);
    expect(verdict.differences.join(' ')).toMatch(/unreadable on BOTH connections/);
    expect(verdict.differences.join(' ')).toMatch(/grant EXECUTE/);
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
    for (const table of SNAPSHOT_TABLES) {
      const idsForTable =
        table === 'financial_model_events'
          ? canonicalModelEventIds(organizationId)
          : ids.byTable[table] || [];
      const result = await control.query(
        `SELECT * FROM "${table}" WHERE id = ANY($1::text[]) ORDER BY id`,
        [idsForTable]
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
      'financial_model_events',
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
      // Use the exported manifest contract instead of a hand-rolled subset that
      // omitted `target` (read a few lines below).
      const manifest = JSON.parse(
        fs.readFileSync(first.manifestPath as string, 'utf8')
      ) as SeedRecoveryManifest;
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

      // The write connection was PROVEN, not assumed, and the proof is kept.
      expect(first.identity.proven).toBe(true);
      expect(first.identity.authorised?.systemIdentifier).toMatch(/^\d+$/);
      expect(first.identity.writePath?.systemIdentifier).toBe(
        first.identity.authorised?.systemIdentifier
      );
      expect(manifest.target.systemIdentifier).toBe(first.identity.authorised?.systemIdentifier);

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

      // ---- the ROI model has economics, not just a name --------------------
      // This is the state the runbook's Models check missed: an `approved`
      // model with no forecast events can never get any, because compute is
      // blocked in demo and `reseedModelFromSource` refuses approved models.
      const events = await control.query(
        `SELECT id, model_id, event_type, name, amount, currency, period_start, recurrence,
                growth_rate, cf_classification, sort_order, is_active
           FROM financial_model_events WHERE id = ANY($1::text[]) ORDER BY sort_order`,
        [canonicalModelEventIds(DEMO_ORG)]
      );
      expect(events.rowCount).toBe(CANONICAL_MODEL_EVENTS.length);
      for (const [index, expected] of CANONICAL_MODEL_EVENTS.entries()) {
        const row = events.rows[index];
        expect(row.id).toBe(canonicalModelEventId(DEMO_ORG, expected.slug));
        expect(row.model_id).toBe(getAtelierFinanceCanonicalIds(DEMO_ORG).modelId);
        expect(row.event_type).toBe(expected.eventType);
        expect(row.name).toBe(expected.nameEn);
        expect(Number(row.amount)).toBe(expected.amount);
        expect(row.currency).toBe(ATELIER_FINANCE_CURRENCY);
        expect(row.recurrence).toBe(expected.recurrence);
        expect(row.cf_classification).toBe(expected.cfClassification);
        expect(Number(row.sort_order)).toBe(expected.sortOrder);
        expect(row.is_active).toBe(true);
      }
      // The business case the demo run-sheet quotes: 2.4M uplift, 800k capex,
      // 400k opex reduction. Asserted as a total so a silent sign flip fails.
      expect(
        events.rows.reduce((sum: number, row: { amount: unknown }) => sum + Number(row.amount), 0)
      ).toBe(2_400_000 + 800_000 - 400_000);
      expect(first.preflight.economicsReady).toBe(false); // it was NOT ready before

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
      for (const table of SNAPSHOT_TABLES) {
        const before = (afterFirst[table] as Array<Record<string, unknown>>).map(
          (row) => row.updated_at
        );
        const after = (afterSecond[table] as Array<Record<string, unknown>>).map(
          (row) => row.updated_at
        );
        expect(after, `${table}.updated_at churned on a no-op re-run`).toEqual(before);
      }

      // A dry run on the ready fixture reports nothing to do.
      const third = await runFin005AtelierFinanceSeed({
        argv: argvFor(DEMO_ORG),
        allowlist: allowlistFor(DEMO_ORG),
        log: silent,
      });
      expect(third.preflight.fixtureReady).toBe(true);
      expect(third.preflight.economicsReady).toBe(true);
      expect(third.preflight.summary.create).toBe(0);
      expect(third.preflight.summary.promote).toBe(0);
      expect(third.preflight.summary.relink).toBe(0);
      expect(third.preflight.summary.restate).toBe(0);
      expect(await snapshot(DEMO_ORG)).toEqual(afterSecond);
    } finally {
      if (previous === undefined) delete process.env[CONFIRM_ENV];
      else process.env[CONFIRM_ENV] = previous;
    }
  }, 300_000);

  it('7b. restates drifted ROI event economics without touching anything else', async () => {
    const previous = process.env[CONFIRM_ENV];
    process.env[CONFIRM_ENV] = CONFIRM_VALUE;
    try {
      // Precondition: the fixture is already seeded by test 7 above.
      const driftedId = canonicalModelEventId(DEMO_ORG, CANONICAL_MODEL_EVENTS[0].slug);
      await control.query(
        `UPDATE financial_model_events SET amount = 1, currency = 'PLN', is_active = FALSE WHERE id = $1`,
        [driftedId]
      );

      const dry = await runFin005AtelierFinanceSeed({
        argv: argvFor(DEMO_ORG),
        allowlist: allowlistFor(DEMO_ORG),
        log: silent,
      });
      expect(dry.preflight.fixtureReady).toBe(true);
      expect(dry.preflight.economicsReady).toBe(false);
      expect(dry.preflight.summary.restate).toBe(1);
      const planned = dry.preflight.rows.find((row) => row.id === driftedId);
      expect(planned?.action).toBe('restate');
      expect(planned?.detail).toContain('amount=1');

      const written = await runFin005AtelierFinanceSeed({
        argv: argvFor(DEMO_ORG, ['--write']),
        allowlist: allowlistFor(DEMO_ORG),
        log: silent,
      });
      expect(written.dryRun).toBe(false);

      const after = await runFin005AtelierFinanceSeed({
        argv: argvFor(DEMO_ORG),
        allowlist: allowlistFor(DEMO_ORG),
        log: silent,
      });
      expect(after.preflight.economicsReady).toBe(true);
      expect(after.preflight.summary.restate).toBe(0);

      const row = await control.query(
        'SELECT amount, currency, is_active FROM financial_model_events WHERE id = $1',
        [driftedId]
      );
      expect(Number(row.rows[0].amount)).toBe(CANONICAL_MODEL_EVENTS[0].amount);
      expect(row.rows[0].currency).toBe(ATELIER_FINANCE_CURRENCY);
      expect(row.rows[0].is_active).toBe(true);
    } finally {
      if (previous === undefined) delete process.env[CONFIRM_ENV];
      else process.env[CONFIRM_ENV] = previous;
    }
  }, 300_000);
});

// ---------------------------------------------------------------------------
// 8, 9. The identity guard, against real servers
// ---------------------------------------------------------------------------
//
// HOW THE SPLIT IS CONSTRUCTED, without any injection point. `DatabaseConfig`
// memoises `getDatabaseConfig()` on first access and `PostgresDatabase` builds
// its pool from that, so the WRITE connection is fixed by the value
// `DATABASE_URL` had the first time the seed's own database module was touched.
// `beforeAll` below touches it deliberately, on the APPROVED database. Moving
// `process.env.DATABASE_URL` afterwards therefore moves only the GUARD pool,
// which this command builds fresh per run — the exact shape of the real hazard,
// where `DATABASE_URL` and `--database-url` disagreed.

const identitySuite = REACHABLE && DRIFT_REACHABLE ? describe.sequential : describe.skip;

if (REACHABLE && !DRIFT_REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[FIN-005 identity suite SKIPPED — clean skip, not a failure] needs a second scratch database at ` +
      `${DRIFT_CONNECTION_STRING}.`
  );
}

identitySuite('FIN-005 seed — the write connection must be the authorised connection', () => {
  beforeAll(async () => {
    // Pin the seed's own database module to the APPROVED target, exactly as a
    // real run does on its first query. Everything after this is a guard-pool
    // change only.
    const identity = await probeWritePathIdentity();
    expect(identity.database).toBe(new URL(CONNECTION_STRING).pathname.replace(/^\/+/, ''));
    expect(
      identity.systemIdentifier,
      'pg_control_system() must be readable on the scratch cluster'
    ).toMatch(/^\d+$/);
  }, 60_000);

  function fingerprintOf(connectionString: string): {
    host: string;
    port: number;
    database: string;
  } {
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 5432,
      database: url.pathname.replace(/^\/+/, ''),
    };
  }

  function argvForTarget(
    organizationId: string,
    target: { host: string; port: number; database: string },
    extra: string[] = []
  ): string[] {
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
      target.host,
      '--expect-port',
      String(target.port),
      '--expect-database',
      target.database,
      ...extra,
    ];
  }

  function allowlistForTarget(
    organizationId: string,
    target: { host: string; port: number; database: string }
  ): ReadonlyArray<DemoTargetFingerprint> {
    return [
      {
        railwayProject: 'local-scratch',
        railwayEnvironment: 'scratch',
        railwayService: 'Postgres',
        host: target.host,
        port: target.port,
        database: target.database,
        organizationId,
      },
    ];
  }

  it('8. refuses when the guards would read a DIFFERENT database than the writes', async () => {
    const drift = fingerprintOf(DRIFT_CONNECTION_STRING);
    // Every declared field is internally consistent and on the allowlist; the
    // ONLY thing wrong is that DbPromise is already pinned elsewhere.
    await expect(
      withDatabaseUrl(DRIFT_CONNECTION_STRING, () =>
        runFin005AtelierFinanceSeed({
          argv: argvForTarget(DEMO_ORG, drift, ['--write']),
          allowlist: allowlistForTarget(DEMO_ORG, drift),
          log: silent,
        })
      )
    ).rejects.toThrow(/write-path.*is NOT the authorised connection/s);
  }, 120_000);

  it('8b. refuses in a DRY RUN too — a preflight on the wrong server is not a preflight', async () => {
    const drift = fingerprintOf(DRIFT_CONNECTION_STRING);
    await expect(
      withDatabaseUrl(DRIFT_CONNECTION_STRING, () =>
        runFin005AtelierFinanceSeed({
          argv: argvForTarget(DEMO_ORG, drift),
          allowlist: allowlistForTarget(DEMO_ORG, drift),
          log: silent,
        })
      )
    ).rejects.toThrow(/is NOT the authorised connection/);
  }, 120_000);

  const twinSuite = TWIN_REACHABLE ? it : it.skip;

  twinSuite(
    '9. refuses a DIFFERENT CLUSTER serving a database of the SAME NAME — the Railway case',
    async () => {
      const twin = fingerprintOf(TWIN_CONNECTION_STRING);
      const approved = fingerprintOf(CONNECTION_STRING);

      // The premise: this is precisely `trolley…/railway` vs `centerbeam…/railway`.
      expect(twin.database).toBe(approved.database);
      expect(`${twin.host}:${twin.port}`).not.toBe(`${approved.host}:${approved.port}`);

      // And the two really are different clusters, by the id the guard uses.
      const twinPool = new Pool({ connectionString: TWIN_CONNECTION_STRING, max: 1 });
      const approvedPool = new Pool({ connectionString: CONNECTION_STRING, max: 1 });
      try {
        const twinIdentity = await probePoolIdentity(twinPool);
        const approvedIdentity = await probePoolIdentity(approvedPool);
        expect(twinIdentity.database).toBe(approvedIdentity.database); // the OLD check passes
        expect(twinIdentity.systemIdentifier).not.toBeNull();
        expect(twinIdentity.systemIdentifier).not.toBe(approvedIdentity.systemIdentifier);
      } finally {
        await twinPool.end().catch(() => undefined);
        await approvedPool.end().catch(() => undefined);
      }

      // Now the whole command: guards on the twin, writes still on the approved
      // cluster. `gateway.currentDatabase()` agrees, the allowlist agrees, the
      // production denylist agrees — and it still refuses.
      await expect(
        withDatabaseUrl(TWIN_CONNECTION_STRING, () =>
          runFin005AtelierFinanceSeed({
            argv: argvForTarget(DEMO_ORG, twin, ['--write']),
            allowlist: allowlistForTarget(DEMO_ORG, twin),
            log: silent,
          })
        )
      ).rejects.toThrow(/is NOT the authorised connection/);

      // …naming the field that actually caught it.
      await expect(
        withDatabaseUrl(TWIN_CONNECTION_STRING, () =>
          runFin005AtelierFinanceSeed({
            argv: argvForTarget(DEMO_ORG, twin, ['--write']),
            allowlist: allowlistForTarget(DEMO_ORG, twin),
            log: silent,
          })
        )
      ).rejects.toThrow(/systemIdentifier: authorised=/);
    },
    120_000
  );
});
