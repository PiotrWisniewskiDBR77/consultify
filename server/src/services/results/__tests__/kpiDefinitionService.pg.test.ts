/**
 * RES-02 — kpiDefinitionService proved against a REAL PostgreSQL.
 *
 * This is the canonical KPI definition owner: create/update (CAS via
 * expectedVersion)/archive against `initiative_kpis` + the immutable
 * `kpi_definition_versions` ledger, all inside one pinned pg connection. A
 * mocked DB cannot prove the CAS guard (row-lock serialization under real
 * concurrent transactions) or true atomic rollback (a version-insert or
 * audit-insert failure must roll back EVERYTHING, including the
 * already-issued UPDATE on `initiative_kpis`) — both require a real
 * database honoring its own transaction semantics.
 *
 * HOW TO RUN:
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:<port>/<db> \
 *   npx vitest run --retry=0 server/src/services/results/__tests__/kpiDefinitionService.pg.test.ts
 *
 * The target database must already have the RES-02 migration applied
 * (server/migrations/20260803_res002_kpi_definition_versions.sql) on top of
 * the standard migration chain. Without a reachable, RES-02-migrated
 * Postgres the whole suite SKIPS loudly rather than failing a machine with
 * no local Postgres.
 *
 * TENANCY: every test owns its own organization id (orgFor(key)) so tests
 * never observe each other's rows and can run in any order.
 */
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';

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

async function hasResOwnerSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const result = await probe.query(
      `SELECT to_regclass('public.kpi_definition_versions') IS NOT NULL AS present`
    );
    return Boolean(result.rows[0]?.present);
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

const REACHABLE = REAL_DB_REQUESTED ? await canReach(CONNECTION_STRING) : false;
const HAS_SCHEMA = REACHABLE ? await hasResOwnerSchema(CONNECTION_STRING) : false;

if (!REACHABLE || !HAS_SCHEMA) {
  // eslint-disable-next-line no-console
  console.warn(
    `[RES-02 kpiDefinitionService suite SKIPPED — this is a clean skip, not a failure] ` +
      `needs DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<reachable, RES-02-migrated postgres>. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE} hasSchema=${HAS_SCHEMA}`
  );
}

const suite = REACHABLE && HAS_SCHEMA ? describe.sequential : describe.skip;

const ORG_PREFIX = 'res002-kpidef';
const orgFor = (key: string): string => `${ORG_PREFIX}-${key}-${Date.now().toString(36)}`;

let control: Pool;
let kpiDefinitionService: typeof import('../kpiDefinitionService.js');

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await control.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function seedOrgAndInitiative(orgId: string, initiativeId: string): Promise<void> {
  await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING`, [
    orgId,
  ]);
  await control.query(
    `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, 'Test initiative', 'DRAFT')
     ON CONFLICT (id) DO NOTHING`,
    [initiativeId, orgId]
  );
}

suite('kpiDefinitionService — RES-02 canonical KPI definition owner (real PostgreSQL)', () => {
  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    process.env.DB_TYPE = 'postgres';
    process.env.DATABASE_URL = CONNECTION_STRING;
    kpiDefinitionService = await import('../kpiDefinitionService.js');
  }, 60_000);

  afterAll(async () => {
    if (!control) return;
    await control.end().catch(() => undefined);
    const { default: db } = await import('../../../database/PostgresDatabase.js');
    await (db as unknown as { close: () => Promise<void> }).close().catch(() => undefined);
  }, 60_000);

  // ---------------------------------------------------------------------
  // 1-4: create → v1, update → v2, v1 immutable, stale expectedVersion → 409
  // ---------------------------------------------------------------------

  it('1. create() mints a v1 immutable version and sets current_definition_version = 1', async () => {
    const org = orgFor('create-v1');
    const created = await kpiDefinitionService.createDefinition({
      organizationId: org,
      initiativeId: null,
      name: 'Cycle Time',
      unit: 'days',
      baselineValue: 10,
      targetValue: 6,
      measurementFrequency: 'MONTHLY',
    });

    expect(created.currentDefinitionVersion).toBe(1);
    expect(created.fields.name).toBe('Cycle Time');

    const versions = await kpiDefinitionService.listVersions(created.id, org);
    expect(versions).toHaveLength(1);
    expect(versions[0].versionNo).toBe(1);
    expect(versions[0].definition.name).toBe('Cycle Time');

    const row = await withClient((c) =>
      c.query('SELECT current_definition_version FROM initiative_kpis WHERE id = $1', [created.id])
    );
    expect(row.rows[0].current_definition_version).toBe(1);
  });

  it('2. update() with expectedVersion=1 creates v2 and advances the pointer', async () => {
    const org = orgFor('update-v2');
    const created = await kpiDefinitionService.createDefinition({
      organizationId: org,
      initiativeId: null,
      name: 'Cycle Time',
      targetValue: 6,
    });

    const updated = await kpiDefinitionService.updateDefinition({
      organizationId: org,
      kpiId: created.id,
      expectedVersion: 1,
      targetValue: 5,
    });

    expect(updated.currentDefinitionVersion).toBe(2);
    expect(updated.fields.targetValue).toBe(5);
    expect(updated.fields.name).toBe('Cycle Time'); // untouched fields preserved (patch semantics)

    const versions = await kpiDefinitionService.listVersions(created.id, org);
    expect(versions.map((v) => v.versionNo)).toEqual([1, 2]);
  });

  it('3. v1 remains byte-for-byte immutable after v2 is created', async () => {
    const org = orgFor('v1-immutable');
    const created = await kpiDefinitionService.createDefinition({
      organizationId: org,
      initiativeId: null,
      name: 'Defect Rate',
      targetValue: 2,
    });
    const v1Before = await kpiDefinitionService.getVersion(created.id, org, 1);

    await kpiDefinitionService.updateDefinition({
      organizationId: org,
      kpiId: created.id,
      expectedVersion: 1,
      targetValue: 1,
      name: 'Defect Rate (renamed)',
    });

    const v1After = await kpiDefinitionService.getVersion(created.id, org, 1);
    expect(v1After).toEqual(v1Before);
    expect(v1After?.definition.targetValue).toBe(2);
    expect(v1After?.definition.name).toBe('Defect Rate');
  });

  it('4. stale expectedVersion → KpiDefinitionVersionConflictError, no v3 created', async () => {
    const org = orgFor('stale-version');
    const created = await kpiDefinitionService.createDefinition({
      organizationId: org,
      initiativeId: null,
      name: 'NPS',
      targetValue: 40,
    });
    await kpiDefinitionService.updateDefinition({
      organizationId: org,
      kpiId: created.id,
      expectedVersion: 1,
      targetValue: 45,
    });

    await expect(
      kpiDefinitionService.updateDefinition({
        organizationId: org,
        kpiId: created.id,
        expectedVersion: 1, // stale — current is now 2
        targetValue: 50,
      })
    ).rejects.toBeInstanceOf(kpiDefinitionService.KpiDefinitionVersionConflictError);

    const versions = await kpiDefinitionService.listVersions(created.id, org);
    expect(versions).toHaveLength(2);
    const current = await kpiDefinitionService.getCurrentDefinition(created.id, org);
    expect(current?.currentDefinitionVersion).toBe(2);
    expect(current?.fields.targetValue).toBe(45);
  });

  // ---------------------------------------------------------------------
  // 5: 5-way concurrency → exactly one new current version
  // ---------------------------------------------------------------------

  it('5. five concurrent update() calls at expectedVersion=1 produce exactly one v2, four conflicts', async () => {
    const org = orgFor('concurrency-5way');
    const created = await kpiDefinitionService.createDefinition({
      organizationId: org,
      initiativeId: null,
      name: 'Concurrent KPI',
      targetValue: 100,
    });

    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        kpiDefinitionService.updateDefinition({
          organizationId: org,
          kpiId: created.id,
          expectedVersion: 1,
          targetValue: 100 + i,
          reason: `concurrent-attempt-${i}`,
        })
      )
    );

    const fulfilled = attempts.filter((a) => a.status === 'fulfilled');
    const rejected = attempts.filter((a) => a.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    for (const r of rejected as PromiseRejectedResult[]) {
      expect(r.reason).toBeInstanceOf(kpiDefinitionService.KpiDefinitionVersionConflictError);
    }

    // Exactly ONE new current version — never a race of several.
    const versions = await kpiDefinitionService.listVersions(created.id, org);
    expect(versions).toHaveLength(2);
    expect(versions.map((v) => v.versionNo)).toEqual([1, 2]);

    const row = await withClient((c) =>
      c.query('SELECT current_definition_version FROM initiative_kpis WHERE id = $1', [created.id])
    );
    expect(row.rows[0].current_definition_version).toBe(2);
  });

  // ---------------------------------------------------------------------
  // 6: cross-tenant read/write/version access denied
  // ---------------------------------------------------------------------

  it('6. cross-tenant access is denied for reads, writes, and version reads (fail-closed)', async () => {
    const ownerOrg = orgFor('tenant-owner');
    const attackerOrg = orgFor('tenant-attacker');
    const created = await kpiDefinitionService.createDefinition({
      organizationId: ownerOrg,
      initiativeId: null,
      name: 'Tenant-scoped KPI',
      targetValue: 10,
    });

    // Reads: a foreign org gets null, never the real content.
    expect(await kpiDefinitionService.getCurrentDefinition(created.id, attackerOrg)).toBeNull();
    expect(await kpiDefinitionService.getVersion(created.id, attackerOrg, 1)).toBeNull();
    expect(await kpiDefinitionService.listVersions(created.id, attackerOrg)).toEqual([]);

    // Writes: KpiDefinitionNotFoundError, not a leak of existence via a
    // different error shape.
    await expect(
      kpiDefinitionService.updateDefinition({
        organizationId: attackerOrg,
        kpiId: created.id,
        expectedVersion: 1,
        targetValue: 999,
      })
    ).rejects.toBeInstanceOf(kpiDefinitionService.KpiDefinitionNotFoundError);

    await expect(
      kpiDefinitionService.archiveDefinition({
        organizationId: attackerOrg,
        kpiId: created.id,
      })
    ).rejects.toBeInstanceOf(kpiDefinitionService.KpiDefinitionNotFoundError);

    // The owner's data is untouched by the attacker's attempts.
    const stillOwners = await kpiDefinitionService.getCurrentDefinition(created.id, ownerOrg);
    expect(stillOwners?.fields.targetValue).toBe(10);
    expect(stillOwners?.currentDefinitionVersion).toBe(1);
  });

  // ---------------------------------------------------------------------
  // 9-11: archive preserves history; measurement pin (current + historical)
  // ---------------------------------------------------------------------

  it('9. archive() preserves every version and every kpi_time_series row (delete = archive)', async () => {
    const org = orgFor('archive-preserves');
    const created = await kpiDefinitionService.createDefinition({
      organizationId: org,
      initiativeId: null,
      name: 'Archived KPI',
      targetValue: 10,
    });
    await kpiDefinitionService.updateDefinition({
      organizationId: org,
      kpiId: created.id,
      expectedVersion: 1,
      targetValue: 8,
    });
    const v1Id = (await kpiDefinitionService.getVersion(created.id, org, 1))?.id;
    await withClient((c) =>
      c.query(
        `INSERT INTO kpi_time_series (id, kpi_id, organization_id, value, period_start, definition_version_id)
         VALUES (gen_random_uuid()::text, $1, $2, 7, '2026-01-01', $3)`,
        [created.id, org, v1Id]
      )
    );

    const archived = await kpiDefinitionService.archiveDefinition({
      organizationId: org,
      kpiId: created.id,
      reason: 'test-archive',
    });
    expect(archived.alreadyArchived).toBe(false);
    expect(archived.archivedAt).toBeTruthy();

    // Idempotent: archiving again is a no-op success, not an error.
    const archivedAgain = await kpiDefinitionService.archiveDefinition({
      organizationId: org,
      kpiId: created.id,
    });
    expect(archivedAgain.alreadyArchived).toBe(true);

    // History intact: both versions still readable, time series row untouched.
    const versions = await kpiDefinitionService.listVersions(created.id, org);
    expect(versions).toHaveLength(2);
    const ts = await withClient((c) =>
      c.query('SELECT id FROM kpi_time_series WHERE kpi_id = $1', [created.id])
    );
    expect(ts.rows).toHaveLength(1);
    const kpiRow = await withClient((c) =>
      c.query('SELECT id FROM initiative_kpis WHERE id = $1', [created.id])
    );
    expect(kpiRow.rows).toHaveLength(1); // row itself never deleted
  });

  it('10-11. a new measurement pins the CURRENT version; an old measurement keeps pointing at its HISTORICAL version', async () => {
    const org = orgFor('measurement-pin');
    const created = await kpiDefinitionService.createDefinition({
      organizationId: org,
      initiativeId: null,
      name: 'Pin Test KPI',
      targetValue: 10,
    });
    const v1Id = (await kpiDefinitionService.getVersion(created.id, org, 1))?.id;

    // Old measurement: pinned to v1 at insert time (simulates what the
    // rewired route handlers do — resolve current version, store the FK).
    const tsOldId = `${created.id}-ts-old`;
    const tsNewId = `${created.id}-ts-new`;
    await withClient((c) =>
      c.query(
        `INSERT INTO kpi_time_series (id, kpi_id, organization_id, value, period_start, definition_version_id)
         VALUES ($4, $1, $2, 5, '2026-01-01', $3)`,
        [created.id, org, v1Id, tsOldId]
      )
    );

    await kpiDefinitionService.updateDefinition({
      organizationId: org,
      kpiId: created.id,
      expectedVersion: 1,
      targetValue: 9,
    });
    const currentVersionId = await kpiDefinitionService.getCurrentDefinitionVersionId(
      created.id,
      org
    );
    expect(currentVersionId).toBeTruthy(); // must resolve a REAL version id, not null
    expect(currentVersionId).not.toBe(v1Id);

    // New measurement: pinned to the NOW-current v2.
    await withClient((c) =>
      c.query(
        `INSERT INTO kpi_time_series (id, kpi_id, organization_id, value, period_start, definition_version_id)
         VALUES ($4, $1, $2, 6, '2026-02-01', $3)`,
        [created.id, org, currentVersionId, tsNewId]
      )
    );

    const rows = await withClient((c) =>
      c.query(
        'SELECT id, definition_version_id FROM kpi_time_series WHERE kpi_id = $1 ORDER BY id',
        [created.id]
      )
    );
    const byId = Object.fromEntries(rows.rows.map((r: any) => [r.id, r.definition_version_id]));
    expect(byId[tsOldId]).toBe(v1Id);
    expect(byId[tsNewId]).toBe(currentVersionId);
    expect(byId[tsOldId]).not.toBe(byId[tsNewId]);
  });

  // ---------------------------------------------------------------------
  // 12: fresh GET / reopen
  // ---------------------------------------------------------------------

  it('12. a fresh read (new call, no cached state) sees exactly what was committed', async () => {
    const org = orgFor('fresh-reopen');
    const created = await kpiDefinitionService.createDefinition({
      organizationId: org,
      initiativeId: null,
      name: 'Reopen KPI',
      targetValue: 3,
    });
    await kpiDefinitionService.updateDefinition({
      organizationId: org,
      kpiId: created.id,
      expectedVersion: 1,
      targetValue: 4,
    });

    // Simulate "reopen" — a brand-new read with no reference to prior state.
    const reopened = await kpiDefinitionService.getCurrentDefinition(created.id, org);
    expect(reopened?.currentDefinitionVersion).toBe(2);
    expect(reopened?.fields.targetValue).toBe(4);
  });

  // ---------------------------------------------------------------------
  // 14: direct DB counts (woven through — one explicit dedicated check too)
  // ---------------------------------------------------------------------

  it('14. direct DB counts match service-reported state exactly (no undercount/overcount)', async () => {
    const org = orgFor('direct-counts');
    const created = await kpiDefinitionService.createDefinition({
      organizationId: org,
      initiativeId: null,
      name: 'Count KPI',
      targetValue: 1,
    });
    await kpiDefinitionService.updateDefinition({
      organizationId: org,
      kpiId: created.id,
      expectedVersion: 1,
      targetValue: 2,
    });
    await kpiDefinitionService.updateDefinition({
      organizationId: org,
      kpiId: created.id,
      expectedVersion: 2,
      targetValue: 3,
    });

    const directCount = await withClient((c) =>
      c.query('SELECT COUNT(*)::int AS n FROM kpi_definition_versions WHERE kpi_id = $1', [
        created.id,
      ])
    );
    expect(directCount.rows[0].n).toBe(3);

    const directKpiCount = await withClient((c) =>
      c.query('SELECT COUNT(*)::int AS n FROM initiative_kpis WHERE id = $1', [created.id])
    );
    expect(directKpiCount.rows[0].n).toBe(1); // never duplicated by update()
  });

  // ---------------------------------------------------------------------
  // 15-16: version-insert failure and audit-insert failure → full rollback
  // ---------------------------------------------------------------------

  it('15. a version-insert failure rolls back the ENTIRE transaction (no partial UPDATE)', async () => {
    const org = orgFor('rollback-version-fail');
    const created = await kpiDefinitionService.createDefinition({
      organizationId: org,
      initiativeId: null,
      name: 'Rollback KPI (version)',
      targetValue: 1,
    });

    await control.query(`
      CREATE OR REPLACE FUNCTION res002_test_fail_version_insert() RETURNS trigger AS $$
      BEGIN
        IF NEW.reason = 'FORCE_FAIL_VERSION_INSERT' THEN
          RAISE EXCEPTION 'res002 test: forced version insert failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS res002_test_fail_version_insert_trg ON kpi_definition_versions;
      CREATE TRIGGER res002_test_fail_version_insert_trg
        BEFORE INSERT ON kpi_definition_versions
        FOR EACH ROW EXECUTE FUNCTION res002_test_fail_version_insert();
    `);
    try {
      await expect(
        kpiDefinitionService.updateDefinition({
          organizationId: org,
          kpiId: created.id,
          expectedVersion: 1,
          targetValue: 999,
          reason: 'FORCE_FAIL_VERSION_INSERT',
        })
      ).rejects.toThrow(/forced version insert failure/);
    } finally {
      await control.query(
        'DROP TRIGGER IF EXISTS res002_test_fail_version_insert_trg ON kpi_definition_versions'
      );
    }

    // Rolled back completely: still v1, still targetValue=1, no v2 row.
    const current = await kpiDefinitionService.getCurrentDefinition(created.id, org);
    expect(current?.currentDefinitionVersion).toBe(1);
    expect(current?.fields.targetValue).toBe(1);
    const versions = await kpiDefinitionService.listVersions(created.id, org);
    expect(versions).toHaveLength(1);
  });

  it('16. an audit-insert failure rolls back the ENTIRE transaction (no orphaned version)', async () => {
    const org = orgFor('rollback-audit-fail');
    const created = await kpiDefinitionService.createDefinition({
      organizationId: org,
      initiativeId: null,
      name: 'Rollback KPI (audit)',
      targetValue: 1,
    });

    await control.query(`
      CREATE OR REPLACE FUNCTION res002_test_fail_audit_insert() RETURNS trigger AS $$
      BEGIN
        IF NEW.summary LIKE '%FORCE_FAIL_AUDIT_MARKER%' THEN
          RAISE EXCEPTION 'res002 test: forced audit insert failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS res002_test_fail_audit_insert_trg ON kpi_metric_audit_log;
      CREATE TRIGGER res002_test_fail_audit_insert_trg
        BEFORE INSERT ON kpi_metric_audit_log
        FOR EACH ROW EXECUTE FUNCTION res002_test_fail_audit_insert();
    `);
    try {
      await expect(
        kpiDefinitionService.updateDefinition({
          organizationId: org,
          kpiId: created.id,
          expectedVersion: 1,
          targetValue: 999,
          name: 'FORCE_FAIL_AUDIT_MARKER',
        })
      ).rejects.toThrow(/forced audit insert failure/);
    } finally {
      await control.query(
        'DROP TRIGGER IF EXISTS res002_test_fail_audit_insert_trg ON kpi_metric_audit_log'
      );
    }

    // Rolled back completely: the version insert that preceded the audit
    // insert in the SAME transaction must not survive either.
    const current = await kpiDefinitionService.getCurrentDefinition(created.id, org);
    expect(current?.currentDefinitionVersion).toBe(1);
    expect(current?.fields.targetValue).toBe(1);
    expect(current?.fields.name).toBe('Rollback KPI (audit)');
    const versions = await kpiDefinitionService.listVersions(created.id, org);
    expect(versions).toHaveLength(1);
  });

  // ---------------------------------------------------------------------
  // Extra: initiative-linked create (not just library/standalone KPIs)
  // ---------------------------------------------------------------------

  it('creates an initiative-linked definition and resolves its org via the initiative when unset', async () => {
    const org = orgFor('initiative-linked');
    const initiativeId = `init-${org}`;
    await seedOrgAndInitiative(org, initiativeId);

    const created = await kpiDefinitionService.createDefinition({
      organizationId: org,
      initiativeId,
      name: 'Initiative KPI',
      targetValue: 5,
    });
    expect(created.initiativeId).toBe(initiativeId);

    const current = await kpiDefinitionService.getCurrentDefinition(created.id, org);
    expect(current?.initiativeId).toBe(initiativeId);
  });
});

// ===========================================================================
// 8. Zero writers create versions outside kpiDefinitionService (static check)
// ===========================================================================
//
// This does not need a database — it proves the SOURCE never bypasses the
// canonical service. Runs unconditionally (not gated on DB reachability).

describe('RES-02 static check — no writer creates kpi_definition_versions rows outside kpiDefinitionService', () => {
  it('grep: kpi_definition_versions is only ever INSERTed from kpiDefinitionService.ts (or the RES-02 migration/backfill)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const root = path.resolve(process.cwd(), 'src');
    const offenders: string[] = [];

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
          walk(full);
          continue;
        }
        if (!entry.name.endsWith('.ts')) continue;
        if (full.endsWith('kpiDefinitionService.ts')) continue;
        const content = fs.readFileSync(full, 'utf8');
        if (/INSERT\s+INTO\s+kpi_definition_versions/i.test(content)) {
          offenders.push(full);
        }
      }
    }
    walk(root);

    expect(offenders).toEqual([]);
  });
});
