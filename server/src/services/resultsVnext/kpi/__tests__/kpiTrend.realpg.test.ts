/** @vitest-environment node */

/**
 * Day 14 K.1 — KPI trend read model, against a REAL Postgres.
 *
 * DEC-77 dozbrojenie (server-side gap the K.1 landing commit
 * 8a5cb824dbab never closed): `kpiTrend.test.ts` proves `buildKpiTrend()`
 * as a pure function; `kpi.routes.test.ts` (this task, block 1a) proves
 * the HTTP boundary against a MOCKED repository. Neither ever ran the
 * actual `kpiRepository.ts` reads (`getKpiCurrentDefinitionVersion` /
 * `listMeasurements`) against a real database — so the tenant-isolation
 * claim in this file's own header comment ("a caller who cannot see the
 * KPI gets `null` here too, never a row") was asserted, never verified.
 * This file drives the REAL command layer (`createKpiDraft`,
 * `recordMeasurement`) and the REAL repository reads end to end, proving:
 *   (a) a same-org actor gets a correct trend,
 *   (b) a different-org actor gets NOTHING back for that kpiId — not a
 *       403, a `null`/`[]` indistinguishable from "does not exist" (same
 *       generic-404 contract `kpi.routes.ts`'s trend handler relies on).
 *
 * DEC-93 UPDATE: the same-org round-trip test below FIRST ran red against
 * this real database — `kpiTrend.ts:33`'s `.sort()` assumed
 * `periodEnd`/`periodStart` were strings, but a real Postgres TIMESTAMPTZ
 * round-trips through `node-postgres` as a native `Date` (this repo
 * registers no `pg.types.setTypeParser` override anywhere), which
 * `.localeCompare()` cannot handle. Fixed in `kpiTrend.ts`'s
 * `periodEndTime()` helper (DEC-93, licensed follow-up to this same
 * DEC-77 dozbrojenie task) — the comparator now normalizes both a `Date`
 * and an ISO string to epoch milliseconds before comparing, with no
 * change to the response contract. This file is exactly what caught the
 * defect in the first place (neither the pure-unit suite nor the
 * HTTP-mocked route suite ever fed it a real `Date`), so re-running it
 * green here is the actual proof the fix works — not a claim about it.
 *
 * Pattern precedent: tests/resultsVnext/kpi/kpiReviseDefinition.realdb.test.ts
 * (DATABASE_URL-driven `DB_CONFIGURED` skip, `insertVisibilityPolicy`
 * helper, `access: FULL_ACCESS` command-layer injection) — reused
 * unmodified below. Combined with the `RUN_DB_TESTS=1`/`MOCK_DB=false`
 * explicit opt-in convention `kpiRecoveryCards.realpg.test.ts` uses (this
 * file's own name matches that `*.realpg.test.ts` convention), so this
 * suite only ever runs when BOTH a real database is configured AND the
 * caller explicitly asked for DB tests — never accidentally, in a plain
 * `vitest run`.
 *
 * HOW TO RUN FOR REAL (one-off Docker Postgres, this task's own recipe):
 *   docker run -d --name cx-day14-pg -e POSTGRES_PASSWORD=postgres \
 *     -e POSTGRES_DB=consultify_test -p 4321:5432 pgvector/pgvector:pg16
 *   NODE_ENV=test DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:4321/consultify_test \
 *     DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts
 *   RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
 *     DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:4321/consultify_test \
 *     npx vitest run server/src/services/resultsVnext/kpi/__tests__/kpiTrend.realpg.test.ts
 *   docker rm -f cx-day14-pg && docker volume prune -f
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts`/
 * `*.realpg.test.ts` in this program — silent no-op without
 * RUN_DB_TESTS=1 + a reachable database; `beforeAll` throws (never
 * silently green) if a database IS configured but unreachable or missing
 * the KPI/platform-visibility schema.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function buildClientConfig(): ClientConfig | null {
  const raw = process.env.DATABASE_URL;
  const url = typeof raw === 'string' && raw.trim() && !raw.includes('${{') ? raw.trim() : null;
  if (!url) return null;
  return { connectionString: url, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 };
}

const DB_CONFIGURED = buildClientConfig() !== null;
const real = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB !== 'true' && DB_CONFIGURED;

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_A = `k1-trend-org-a-${tag}`;
const ORG_B = `k1-trend-org-b-${tag}`;
const ACTOR_A = `k1-trend-actor-a-${tag}`;
const ACTOR_B = `k1-trend-actor-b-${tag}`;

type CommandsModule = typeof import('../kpiDefinitionCommands.js');
type MeasurementCommandsModule = typeof import('../kpiMeasurementCommands.js');
type RepositoryModule = typeof import('../kpiRepository.js');
type TrendModule = typeof import('../kpiTrend.js');

let createKpiDraft: CommandsModule['createKpiDraft'];
let recordMeasurement: MeasurementCommandsModule['recordMeasurement'];
let getKpiCurrentDefinitionVersion: RepositoryModule['getKpiCurrentDefinitionVersion'];
let listMeasurements: RepositoryModule['listMeasurements'];
let buildKpiTrend: TrendModule['buildKpiTrend'];

let client: Client;
let reachable = false;

// Full RBAC (command-layer capability injection — kpiDefinitionCommands.ts/
// kpiMeasurementCommands.ts read `access` straight from the caller, they do
// NOT hit the DB for it; same convention kpiReviseDefinition.realdb.test.ts
// uses). The REPOSITORY reads below (getKpiCurrentDefinitionVersion,
// listMeasurements) are the ones that hit `resolveEffectiveAccess` for
// real — the tenant-isolation proof below rests on the SQL `organization_id
// = $1` filter and the OPEN_ORG visibility_mode this policy grants, not on
// this constant.
const FULL_ACCESS = { capabilities: ['*'], platformRole: null } as const;

async function insertVisibilityPolicy(organizationId: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, 'kpi', 1, 'OPEN_ORG', true, $2)`,
    [organizationId, ACTOR_A]
  );
}

let kpiCodeSeq = 0;
function nextKpiCode(): string {
  kpiCodeSeq += 1;
  return `K1TREND-${tag}-${kpiCodeSeq}`;
}

describe('Day 14 K.1 — KPI trend read model (real Postgres)', () => {
  beforeAll(async () => {
    if (!real) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] RUN_DB_TESTS!=1 or no reachable Postgres configured — Day 14 K.1 real-PG trend tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_kpi_definition_versions LIMIT 0');
      await client.query('SELECT 1 FROM rvn_platform_resource_visibility LIMIT 0');
    } catch (error) {
      throw new Error(
        'RUN_DB_TESTS=1 but the configured database is unreachable (or missing the KPI/platform-visibility schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    await client.query(`INSERT INTO organizations(id, name) VALUES ($1, $1), ($2, $2)`, [ORG_A, ORG_B]);
    await client.query(
      `INSERT INTO users(id, organization_id, email) VALUES ($1, $2, $3), ($4, $5, $6)`,
      [ACTOR_A, ORG_A, `${ACTOR_A}@k1-trend.local`, ACTOR_B, ORG_B, `${ACTOR_B}@k1-trend.local`]
    );
    await insertVisibilityPolicy(ORG_A);
    await insertVisibilityPolicy(ORG_B);

    const commands: CommandsModule = await import('../kpiDefinitionCommands.js');
    createKpiDraft = commands.createKpiDraft;

    const measurementCommands: MeasurementCommandsModule = await import('../kpiMeasurementCommands.js');
    recordMeasurement = measurementCommands.recordMeasurement;

    const repository: RepositoryModule = await import('../kpiRepository.js');
    getKpiCurrentDefinitionVersion = repository.getKpiCurrentDefinitionVersion;
    listMeasurements = repository.listMeasurements;

    const trend: TrendModule = await import('../kpiTrend.js');
    buildKpiTrend = trend.buildKpiTrend;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    for (const org of [ORG_A, ORG_B]) {
      // recordMeasurement's own write path (openOrEscalateDeviationCase,
      // kpiMeasurementCommands.ts) opens a real rvn_kpi_deviation_cases row
      // for any 'warning'/'critical' measurement, and every write below the
      // executeAtomicCreate/executeAtomicCommand layer (atomicWrite.ts)
      // always leaves an rvn_platform_events/outbox row — both must go
      // before the rows they reference (deviation cases -> measurements;
      // outbox -> events) or the DELETEs below fail on FK constraints, same
      // ordering kpiRecoveryCards.realpg.test.ts's own afterAll uses for
      // its (different) recovery-card tables.
      await client.query(`DELETE FROM rvn_kpi_deviation_cases WHERE organization_id = $1`, [org]);
      await client.query(
        `DELETE FROM rvn_platform_obligations WHERE source_event_id IN (
           SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
        [org]
      );
      await client.query(
        `DELETE FROM rvn_platform_outbox WHERE event_id IN (
           SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
        [org]
      );
      await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [org]);
      await client.query(
        `DELETE FROM rvn_kpi_measurements WHERE organization_id = $1`,
        [org]
      );
      await client.query(
        `UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1`,
        [org]
      );
      await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1`, [org]);
      await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [org]);
      await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = $1`, [org]);
      await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [org]);
      await client.query(`DELETE FROM users WHERE organization_id = $1`, [org]);
      await client.query(`DELETE FROM organizations WHERE id = $1`, [org]);
    }
    await client.end();
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 30_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  itDB(
    'same-org actor: getKpiCurrentDefinitionVersion + listMeasurements round-trip through buildKpiTrend produces the correct direction',
    async () => {
      const created = await createKpiDraft({
        organizationId: ORG_A,
        kpiCode: nextKpiCode(),
        name: 'Availability — line A',
        targetGeometry: 'threshold_min',
        targetValue: 80,
        warningLow: 70,
        ownerUserId: ACTOR_A,
        createdBy: ACTOR_A,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `create-${randomUUID()}`,
        access: FULL_ACCESS,
      });
      expect(created.outcome).toBe('applied');
      const kpiId = created.result.kpi.kpiId;
      const definitionVersionId = created.result.definitionVersion.definitionVersionId;

      // Two measurements, both below target(80) but the gap shrinks
      // (70 -> 75) — IMPROVING, same semantics kpiTrend.test.ts's pure-unit
      // suite already proves for buildKpiTrend() in isolation.
      for (const [value, day] of [
        [70, 1],
        [75, 2],
      ] as const) {
        const outcome = await recordMeasurement({
          kpiId,
          definitionVersionId,
          organizationId: ORG_A,
          periodStart: `2026-01-${day.toString().padStart(2, '0')}T00:00:00.000Z`,
          periodEnd: `2026-01-${day.toString().padStart(2, '0')}T23:00:00.000Z`,
          actualValue: value,
          performanceStatus: 'on_target', // recomputed server-side, not trusted
          source: 'manual',
          recordedBy: ACTOR_A,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `measure-${day}-${randomUUID()}`,
        });
        expect(outcome.outcome).toBe('applied');
      }

      const version = await getKpiCurrentDefinitionVersion({
        userId: ACTOR_A,
        organizationId: ORG_A,
        kpiId,
      });
      expect(version).not.toBeNull();

      const measurements = await listMeasurements({
        userId: ACTOR_A,
        organizationId: ORG_A,
        kpiId,
        limit: 12,
      });
      expect(measurements).toHaveLength(2);

      // DEC-93 FIX VERIFIED HERE (previously a confirmed, documented DEC-77
      // finding — this call used to THROW against a real Postgres).
      // `rvn_kpi_measurements.period_start`/`period_end` are TIMESTAMPTZ;
      // `node-postgres` decodes TIMESTAMPTZ into native JS `Date` objects
      // by default, and this repo registers NO `pg.types.setTypeParser`
      // override anywhere (verified: `grep -rn setTypeParser server/src`).
      // `toKpiMeasurement()` (kpiTypes.ts) passes `period_end` straight
      // through with no `.toISOString()`, so the `KpiMeasurement` TS
      // type's `periodEnd: string` was always a lie at this exact
      // boundary — at runtime it is a `Date`. `buildKpiTrend()`
      // (kpiTrend.ts) used to `.sort((a, b) =>
      // a.periodEnd.localeCompare(b.periodEnd))`, which required a string
      // and crashed on a `Date`: GET /api/vnext/results/kpi/:kpiId/trend
      // 500'd in production for every KPI with 2+ measurements (a single
      // measurement never reaches the comparator, which is why this was
      // invisible to any test that stopped at 0-1 real rows). Neither
      // `kpiTrend.test.ts` (pure unit, hand-written string dates) nor
      // `kpi.routes.test.ts`'s block-1a HTTP suite (repository MOCKED with
      // string-date fixtures) could ever have caught this — only a real
      // Postgres round-trip could, which is exactly what this test is.
      // DEC-93 fixed it in `kpiTrend.ts`'s `periodEndTime()` helper
      // (normalizes both `Date` and ISO string to epoch millis before
      // comparing, no response-contract change) — this assertion is the
      // real, re-run proof that fix actually works end to end.
      const trend = buildKpiTrend({ kpiId, version: version!, measurements, calculatedAt: 'now' });
      expect(trend.points).toHaveLength(2);
      expect(trend.direction).toBe('IMPROVING');
    }
  );

  itDB(
    'cross-org actor: a different org (real membership + real OPEN_ORG policy of its OWN) gets null/empty for the other org\'s kpiId — not 403, indistinguishable from "does not exist" (D06 generic-404 contract)',
    async () => {
      const created = await createKpiDraft({
        organizationId: ORG_A,
        kpiCode: nextKpiCode(),
        name: 'Foreign-tenant probe KPI',
        targetGeometry: 'threshold_min',
        targetValue: 80,
        ownerUserId: ACTOR_A,
        createdBy: ACTOR_A,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `create-${randomUUID()}`,
        access: FULL_ACCESS,
      });
      expect(created.outcome).toBe('applied');
      const kpiId = created.result.kpi.kpiId;
      const definitionVersionId = created.result.definitionVersion.definitionVersionId;

      await recordMeasurement({
        kpiId,
        definitionVersionId,
        organizationId: ORG_A,
        periodStart: '2026-02-01T00:00:00.000Z',
        periodEnd: '2026-02-01T23:00:00.000Z',
        actualValue: 85,
        performanceStatus: 'on_target',
        source: 'manual',
        recordedBy: ACTOR_A,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `measure-foreign-${randomUUID()}`,
      });

      // ACTOR_B, querying with THEIR OWN org (ORG_B) — the real shape a
      // hijacked/guessed kpiId attack takes: a valid actor, a valid
      // same-org token, a foreign kpiId. `kd.organization_id = $1` in
      // kpiRepository.ts's own WHERE clause is the only thing standing
      // between this and a cross-tenant read — proven here against real
      // SQL, not a mock that could silently drift from the real query.
      const foreignVersion = await getKpiCurrentDefinitionVersion({
        userId: ACTOR_B,
        organizationId: ORG_B,
        kpiId,
      });
      expect(foreignVersion).toBeNull();

      const foreignMeasurements = await listMeasurements({
        userId: ACTOR_B,
        organizationId: ORG_B,
        kpiId,
      });
      expect(foreignMeasurements).toEqual([]);

      // Sanity: the SAME kpiId, queried by the rightful org, still works —
      // proves the null/[] above is tenant isolation, not a broken fixture.
      const ownVersion = await getKpiCurrentDefinitionVersion({
        userId: ACTOR_A,
        organizationId: ORG_A,
        kpiId,
      });
      expect(ownVersion).not.toBeNull();
    }
  );
});
