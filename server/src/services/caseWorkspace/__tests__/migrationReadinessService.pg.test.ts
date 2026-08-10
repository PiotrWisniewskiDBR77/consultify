/**
 * Case Workspace — Migration & Legacy Retirement Readiness service, proved
 * against a REAL PostgreSQL (CW-P11, EPIC E13 "Migration and legacy
 * retirement readiness"). Exercises
 * server/src/services/caseWorkspace/migrationReadinessService.ts against the
 * schema in
 * server/migrations/20260809_case_workspace_migration_readiness.sql.
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * Same convention as executionGraphService.pg.test.ts (CW-P10),
 * caseHistoryService.pg.test.ts (CW-P07) and runBindingService.pg.test.ts
 * (CW-P04): `NODE_ENV=test` ALONE is a trap — `Database.ts`'s
 * `getDatabase()`/`createDatabase()` hand back an in-memory MOCK whenever
 * `RUN_DB_TESTS !== '1'` (or `MOCK_DB` isn't explicitly `'false'`), and every
 * write silently becomes a no-op. This file follows the `*.pg.test.ts`
 * convention: gate on `RUN_DB_TESTS === '1' && MOCK_DB === 'false'`, probe
 * reachability AND that the migrated schema is actually present before
 * deciding, and SKIP LOUDLY (never silently pass) when either is missing.
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/migrationReadinessService.pg.test.ts
 *
 * ===========================================================================
 * ISOLATION — no case_core/project fixture chain needed, but a REAL
 * organizations row is now required for every org id used (CW-P12)
 * ===========================================================================
 * Unlike executionGraphService.pg.test.ts/runBindingService.pg.test.ts, none
 * of the three tables this packet added
 * (case_workspace_feature_flag_definitions, case_workspace_feature_flags,
 * case_workspace_legacy_quarantine) are FK'd to case_core — see the
 * migration file's own header ("flags and quarantine records are not FK'd to
 * case_core"). Flag/rehearsal-run identifiers are still plain,
 * uniquely-`randomUUID()`-suffixed strings. BUT the CW-P12 auth retrofit
 * gates every method through caseWorkspaceAuthContext.ts's
 * requireOrgMember/requireOrgRole, which reads a REAL `organization_members`
 * row (FK'd to a REAL `organizations` row) — so every orgId used below now
 * gets a real `organizations` row via `seedOrg()`, and every actor gets a
 * real `users` row + `organization_members` row via `seedMemberedUser()`.
 * The one real FK inside this packet's own schema is
 * case_workspace_feature_flags.flag_key ->
 * case_workspace_feature_flag_definitions.flag_key (plus
 * parent_flag_key's self-reference on the definitions table) — every test
 * that writes a case_workspace_feature_flags row first registers its own
 * flag_key(s) via registerFlagDefinition(), and teardown always deletes
 * case_workspace_feature_flags rows before case_workspace_feature_flag_definitions
 * rows (children-before-parents on the self-referencing chain too, since
 * that FK has no ON DELETE clause either).
 *
 * DB-CHECK-constraint assertions are proved with a raw SQL INSERT issued
 * directly against the out-of-band `pg.Pool` (`control`), NOT through the
 * service — this proves the constraint exists independently of application
 * logic (registerFlagDefinition()'s own input type has no field to set
 * default_enabled at all, so the service path can never even attempt this;
 * only a raw INSERT can exercise the DB's own line of defense). Per this
 * task's own instruction and the NAMEDATALEN 63-byte truncation caveat
 * documented in executionGraphService.pg.test.ts (Postgres truncates
 * identifiers over 63 bytes), the constraint's name is fetched from
 * `pg_catalog` at runtime and asserted against — never hardcoded/assumed —
 * even though `case_workspace_feature_flag_definitions_default_off` (51
 * bytes) happens to be short enough to survive untruncated here.
 *
 * All assertions read the actual rows back out of Postgres through `control`
 * — never the service function's return value alone — because the return
 * value only proves what the service THINKS it wrote, not what actually
 * landed.
 *
 * ===========================================================================
 * AUTHORIZATION (CW-P12 retrofit)
 * ===========================================================================
 * registerFlagDefinition/setOrgFlagState/rollbackFlag (mutation class) are
 * gated at requireOrgRole(actor, organizationId, 'ADMIN') — every actor
 * exercising those below is seeded at ADMIN role. getCurrentOrgFlagState/
 * listFlagDescendants/findSmallestEnabledDescendant (read class) need only
 * requireOrgMember, but reuse the same ADMIN-role actor for simplicity where
 * both classes are exercised in one test. recordQuarantinedLegacyRecord
 * (create class) is gated at plain requireOrgMember (coordinator decision:
 * case_workspace_legacy_quarantine's real organization_id column is used
 * directly, not ADMIN-gated) — exercised with a plain MEMBER-role actor to
 * prove that.
 */

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as migrationReadinessService from '../migrationReadinessService.js';
import type { FeatureFlagState } from '../migrationReadinessService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

/** Reachability AND schema presence are decided once, before the suite is declared. */
const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const definitionsResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_feature_flag_definitions'
          AND column_name IN ('flag_key', 'parent_flag_key', 'description', 'default_enabled',
                               'created_at', 'created_by')`
    );
    const definitionsOk = Number(definitionsResult.rows[0]?.present ?? 0) === 6;

    const flagsResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_feature_flags'
          AND column_name IN ('flag_id', 'organization_id', 'flag_key', 'enabled', 'cohort',
                               'rollout_percentage', 'allow_list_json', 'updated_at', 'updated_by')`
    );
    const flagsOk = Number(flagsResult.rows[0]?.present ?? 0) === 9;

    const quarantineResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_legacy_quarantine'
          AND column_name IN ('quarantine_id', 'organization_id', 'rehearsal_run_id',
                               'source_system', 'source_table', 'source_id', 'attempted_case_id',
                               'quarantine_reason_code', 'quarantine_reason_detail',
                               'recovery_path_ref', 'source_record_snapshot', 'detected_at',
                               'recorded_at', 'dedupe_key')`
    );
    const quarantineOk = Number(quarantineResult.rows[0]?.present ?? 0) === 14;

    const orgMembersResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organization_members'
          AND column_name IN ('organization_id', 'user_id', 'role', 'status')`
    );
    const orgMembersOk = Number(orgMembersResult.rows[0]?.present ?? 0) === 4;

    // Every mutating command here now publishes a domain event on the SAME
    // transaction as its write (EVENT_TAXONOMY.md §2), so a missing outbox
    // table would fail all of them. Probed here so that is a LOUD SKIP rather
    // than a mysterious red suite.
    const outboxResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_event_outbox'
          AND column_name IN ('event_id', 'event_type', 'organization_id', 'aggregate_type',
                               'aggregate_id', 'aggregate_version', 'actor_user_id',
                               'correlation_id', 'redacted_summary', 'payload_ref')`
    );
    const outboxOk = Number(outboxResult.rows[0]?.present ?? 0) === 10;

    return definitionsOk && flagsOk && quarantineOk && orgMembersOk && outboxOk;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[migrationReadinessService pg suite SKIPPED — this is a clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `20260809_case_workspace_migration_readiness.sql migration applied. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

interface FeatureFlagDefinitionDbRow {
  flag_key: string;
  parent_flag_key: string | null;
  description: string;
  default_enabled: boolean;
  created_at: string;
  created_by: string;
}

interface FeatureFlagDbRow {
  flag_id: string;
  organization_id: string;
  flag_key: string;
  enabled: boolean;
  cohort: string | null;
  rollout_percentage: number;
  allow_list_json: string;
  updated_at: string;
  updated_by: string | null;
}

interface LegacyQuarantineDbRow {
  quarantine_id: string;
  organization_id: string;
  rehearsal_run_id: string;
  source_system: string;
  source_table: string;
  source_id: string;
  attempted_case_id: string | null;
  quarantine_reason_code: string;
  quarantine_reason_detail: string;
  recovery_path_ref: string;
  source_record_snapshot: string;
  detected_at: string;
  recorded_at: string;
  dedupe_key: string | null;
}

/** One `case_workspace_event_outbox` row, as stored (snake_case, straight from Postgres). */
interface EventOutboxDbRow {
  event_id: string;
  event_type: string;
  organization_id: string;
  project_id: string | null;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: number | null;
  case_id: string | null;
  actor_user_id: string;
  correlation_id: string;
  causation_id: string | null;
  redacted_summary: Record<string, unknown>;
  payload_ref: string | null;
}

suite(
  'migrationReadinessService — Migration & Legacy Retirement Readiness against a real PostgreSQL (CW-P11, E13)',
  () => {
    let control: Pool;

    beforeAll(async () => {
      control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    }, 60_000);

    afterAll(async () => {
      await control?.end().catch(() => undefined);
    }, 60_000);

    // -----------------------------------------------------------------------
    // Fixture helpers — every test calls these itself, never a shared hook.
    // -----------------------------------------------------------------------

    /** A fresh, real organizations row (required now: organization_members.organization_id FKs into it). */
    async function seedOrg(label: string): Promise<string> {
      const orgId = `case-migreadiness-org-${label}-${randomUUID()}`;
      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
        orgId,
        `Migration Readiness test org (${label})`,
      ]);
      return orgId;
    }

    /** A fresh users row, unattached to organization_members unless seedMember() is also called for it. */
    async function seedUser(orgId: string, label: string): Promise<string> {
      const userId = `case-migreadiness-user-${label}-${randomUUID()}`;
      await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
        userId,
        orgId,
        `${userId}@example.test`,
      ]);
      return userId;
    }

    /** An organization_members row for an existing user, at the given role/status. */
    async function seedMember(
      orgId: string,
      userId: string,
      role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT',
      status: 'ACTIVE' | 'REVOKED' | 'SUSPENDED' = 'ACTIVE'
    ): Promise<void> {
      await control.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
           VALUES ($1, $2, $3, $4, $5)`,
        [`case-migreadiness-member-${randomUUID()}`, orgId, userId, role, status]
      );
    }

    /** Convenience: seed a user AND an ACTIVE membership at the given role in one call (default ADMIN — most flows here mutate flag state). */
    async function seedMemberedUser(
      orgId: string,
      label: string,
      role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT' = 'ADMIN'
    ): Promise<string> {
      const userId = await seedUser(orgId, label);
      await seedMember(orgId, userId, role);
      return userId;
    }

    function uniqueFlagKey(label: string): string {
      return `case_workspace.migreadiness.${label}.${randomUUID()}`;
    }

    async function readFeatureFlagRow(
      organizationId: string,
      flagKey: string
    ): Promise<FeatureFlagDbRow | null> {
      const result = await control.query<FeatureFlagDbRow>(
        `SELECT * FROM case_workspace_feature_flags WHERE organization_id = $1 AND flag_key = $2`,
        [organizationId, flagKey]
      );
      return result.rows[0] ?? null;
    }

    async function countScopedRows(params: {
      historyOrgId: string;
      valueOrgId: string;
      caseOrgId: string;
    }): Promise<{ history: number; value: number; caseCore: number }> {
      const [historyResult, valueResult, caseResult] = await Promise.all([
        control.query(`SELECT count(*)::int AS n FROM case_workspace_history_events WHERE organization_id = $1`, [
          params.historyOrgId,
        ]),
        control.query(
          `SELECT count(*)::int AS n FROM case_workspace_value_measurements WHERE organization_id = $1`,
          [params.valueOrgId]
        ),
        control.query(`SELECT count(*)::int AS n FROM case_core WHERE organization_id = $1`, [
          params.caseOrgId,
        ]),
      ]);
      return {
        history: Number(historyResult.rows[0]?.n ?? 0),
        value: Number(valueResult.rows[0]?.n ?? 0),
        caseCore: Number(caseResult.rows[0]?.n ?? 0),
      };
    }

    /**
     * Teardown order matters on the one real FK chain this packet's schema
     * has: case_workspace_feature_flags.flag_key ->
     * case_workspace_feature_flag_definitions.flag_key (no ON DELETE
     * clause), plus definitions' own self-referencing parent_flag_key (also
     * no ON DELETE clause). `flagKeysDeepestFirst` must list child flags
     * before their parents (e.g. [grandchild, child, root]) so each
     * individual DELETE never leaves a dangling parent_flag_key reference.
     * users/organizations are deleted last (organization_members cascades
     * off both via ON DELETE CASCADE).
     */
    async function teardown(params: {
      orgIds: string[];
      flagKeysDeepestFirst: string[];
      rehearsalRunIds?: string[];
      userIds?: string[];
    }): Promise<void> {
      if (params.orgIds.length > 0) {
        await control
          .query(`DELETE FROM case_workspace_feature_flags WHERE organization_id = ANY($1)`, [
            params.orgIds,
          ])
          .catch(() => undefined);
        await control
          .query(`DELETE FROM case_workspace_legacy_quarantine WHERE organization_id = ANY($1)`, [
            params.orgIds,
          ])
          .catch(() => undefined);
      }
      if (params.rehearsalRunIds && params.rehearsalRunIds.length > 0) {
        await control
          .query(`DELETE FROM case_workspace_legacy_quarantine WHERE rehearsal_run_id = ANY($1)`, [
            params.rehearsalRunIds,
          ])
          .catch(() => undefined);
      }
      for (const flagKey of params.flagKeysDeepestFirst) {
        await control
          .query(`DELETE FROM case_workspace_feature_flag_definitions WHERE flag_key = $1`, [flagKey])
          .catch(() => undefined);
      }
      for (const userId of params.userIds ?? []) {
        await control.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
      }
      if (params.orgIds.length > 0) {
        // The outbox has no FK to organizations (append-only log of ids), so it
        // never cascades — each test removes exactly its own rows. §4: the
        // org-less flag-DEFINITION aggregate's event still carries the caller's
        // org, so org-scoping catches those rows too.
        await control
          .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = ANY($1)`, [
            params.orgIds,
          ])
          .catch(() => undefined);
      }
      for (const orgId of params.orgIds) {
        await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
      }
    }

    /**
     * Reads the outbox OUT OF BAND (dedicated `control` pool), never through
     * the service's own return value — the return value only proves what the
     * service THINKS it published.
     */
    async function readOutboxRowsForAggregate(aggregateId: string): Promise<EventOutboxDbRow[]> {
      const result = await control.query<EventOutboxDbRow>(
        `SELECT * FROM case_workspace_event_outbox WHERE aggregate_id = $1 ORDER BY created_at ASC`,
        [aggregateId]
      );
      return result.rows;
    }

    async function readOutboxRowsForOrg(organizationId: string): Promise<EventOutboxDbRow[]> {
      const result = await control.query<EventOutboxDbRow>(
        `SELECT * FROM case_workspace_event_outbox WHERE organization_id = $1 ORDER BY created_at ASC`,
        [organizationId]
      );
      return result.rows;
    }

    /**
     * Forces a failure AFTER the command's mutation AND after its
     * publishEvent, by installing a DEFERRABLE INITIALLY DEFERRED constraint
     * trigger that raises at COMMIT time for exactly one row. That is what
     * makes the rollback test a real atomicity proof rather than a "the insert
     * itself blew up" tautology: both writes have already happened on the
     * transaction's client when the poison fires, so a surviving outbox row
     * would mean the outbox is NOT sharing the command's transaction.
     */
    async function withCommitTimePoison<T>(
      params: {
        table: string;
        matchColumn: string;
        matchValue: string;
        event: 'INSERT' | 'UPDATE';
      },
      fn: () => Promise<T>
    ): Promise<T> {
      const token = randomUUID().replace(/-/g, '');
      const fnName = `cw_test_poison_fn_${token}`;
      const trgName = `cw_test_poison_trg_${token}`;
      const literal = params.matchValue.replace(/'/g, "''");
      await control.query(
        `CREATE FUNCTION ${fnName}() RETURNS trigger LANGUAGE plpgsql AS $poison$
           BEGIN RAISE EXCEPTION 'forced_commit_time_failure_for_atomicity_test'; END
         $poison$`
      );
      await control.query(
        `CREATE CONSTRAINT TRIGGER ${trgName}
           AFTER ${params.event} ON ${params.table}
           DEFERRABLE INITIALLY DEFERRED
           FOR EACH ROW WHEN (NEW.${params.matchColumn} = '${literal}')
           EXECUTE FUNCTION ${fnName}()`
      );
      try {
        return await fn();
      } finally {
        await control
          .query(`DROP TRIGGER IF EXISTS ${trgName} ON ${params.table}`)
          .catch(() => undefined);
        await control.query(`DROP FUNCTION IF EXISTS ${fnName}()`).catch(() => undefined);
      }
    }

    // -------------------------------------------------------------------------
    // 1. DB CHECK: case_workspace_feature_flag_definitions_default_off rejects
    //    a raw INSERT with default_enabled=TRUE. The constraint's actual name
    //    is read from pg_catalog first, never assumed. Raw SQL bypasses the
    //    service entirely, so no actor fixture is needed.
    // -------------------------------------------------------------------------
    it('DB CHECK rejects a raw INSERT into case_workspace_feature_flag_definitions with default_enabled=TRUE, using the constraint name read from pg_catalog', async () => {
      const flagKey = uniqueFlagKey('check-default-off');
      try {
        // Read the ACTUAL constraint name off the live catalog rather than
        // assuming the untruncated migration-file name survived NAMEDATALEN
        // truncation.
        const catalogResult = await control.query<{ conname: string }>(
          `SELECT conname FROM pg_constraint
             WHERE conrelid = 'case_workspace_feature_flag_definitions'::regclass
               AND contype = 'c'
               AND pg_get_constraintdef(oid) ILIKE '%default_enabled%'`
        );
        expect(catalogResult.rows).toHaveLength(1);
        const actualConstraintName = catalogResult.rows[0].conname;
        // Sanity: confirm the (untruncated, 51-byte) name we expect from the
        // migration file is what's actually on disk — NAMEDATALEN=63 does not
        // truncate it, but this is asserted from the catalog read, not assumed.
        expect(actualConstraintName).toBe('case_workspace_feature_flag_definitions_default_off');

        let caught: (Error & { code?: string; constraint?: string }) | null = null;
        try {
          await control.query(
            `INSERT INTO case_workspace_feature_flag_definitions (
               flag_key, parent_flag_key, description, default_enabled, created_at, created_by
             ) VALUES ($1, $2, $3, TRUE, $4, $5)`,
            [flagKey, null, 'raw-insert default_enabled=TRUE must be rejected', new Date().toISOString(), 'actor-raw-check-default']
          );
        } catch (err) {
          caught = err as Error & { code?: string; constraint?: string };
        }
        expect(caught).not.toBeNull();
        expect(caught?.code).toBe('23514'); // Postgres check_violation
        expect(caught?.constraint).toBe(actualConstraintName);

        const rows = await control.query<FeatureFlagDefinitionDbRow>(
          `SELECT * FROM case_workspace_feature_flag_definitions WHERE flag_key = $1`,
          [flagKey]
        );
        expect(rows.rows).toHaveLength(0);
      } finally {
        await teardown({ orgIds: [], flagKeysDeepestFirst: [flagKey] });
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 2. getCurrentOrgFlagState: no implicit-enable fallback for a never-
    //    written (organizationId, flagKey) pair; setOrgFlagState() then flips
    //    it to enabled and a second read observes that.
    // -------------------------------------------------------------------------
    it('getCurrentOrgFlagState reads a never-written pair as disabled (null), with no implicit-enable fallback; setOrgFlagState then creates the row and a second read observes enabled=true', async () => {
      const orgId = await seedOrg('never-written');
      const actorId = await seedMemberedUser(orgId, 'never-written');
      const flagKey = uniqueFlagKey('never-written');
      try {
        await migrationReadinessService.registerFlagDefinition(
          {
            flagKey,
            description: 'Flag for never-written-state test',
            createdBy: actorId,
          },
          orgId
        );

        // No case_workspace_feature_flags row has ever been written for this
        // (organizationId, flagKey) pair -> must read as null/disabled, not
        // fall back to enabled=true the way v8_feature_flags' non-production
        // zero-rows-means-enabled path does.
        const beforeState = await migrationReadinessService.getCurrentOrgFlagState(orgId, flagKey, actorId);
        expect(beforeState).toBeNull();

        const dbRowBefore = await readFeatureFlagRow(orgId, flagKey);
        expect(dbRowBefore).toBeNull();

        const written = await migrationReadinessService.setOrgFlagState({
          organizationId: orgId,
          flagKey,
          enabled: true,
          updatedBy: actorId,
        });
        expect(written.enabled).toBe(true);
        expect(written.organizationId).toBe(orgId);
        expect(written.flagKey).toBe(flagKey);

        const afterState = await migrationReadinessService.getCurrentOrgFlagState(orgId, flagKey, actorId);
        expect(afterState).not.toBeNull();
        expect(afterState?.enabled).toBe(true);
        expect(afterState?.flagId).toBe(written.flagId);

        const dbRowAfter = await readFeatureFlagRow(orgId, flagKey);
        expect(dbRowAfter).not.toBeNull();
        expect(dbRowAfter?.enabled).toBe(true);
      } finally {
        await teardown({ orgIds: [orgId], flagKeysDeepestFirst: [flagKey], userIds: [actorId] });
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 3. findSmallestEnabledDescendant: 3-level hierarchy (root -> child ->
    //    grandchild). All enabled -> grandchild (most specific) wins. Disable
    //    grandchild -> child wins. Disable child too -> root wins.
    // -------------------------------------------------------------------------
    it('findSmallestEnabledDescendant returns the deepest enabled flag in a 3-level hierarchy, and re-evaluates correctly as descendants are disabled one at a time', async () => {
      const orgId = await seedOrg('smallest-descendant');
      const actorId = await seedMemberedUser(orgId, 'smallest-descendant');
      const suffix = randomUUID();
      const rootKey = `case_workspace.migreadiness.hier.root.${suffix}`;
      const childKey = `case_workspace.migreadiness.hier.child.${suffix}`;
      const grandchildKey = `case_workspace.migreadiness.hier.grandchild.${suffix}`;
      try {
        await migrationReadinessService.registerFlagDefinition(
          {
            flagKey: rootKey,
            description: 'Root of 3-level hierarchy',
            createdBy: actorId,
          },
          orgId
        );
        await migrationReadinessService.registerFlagDefinition(
          {
            flagKey: childKey,
            parentFlagKey: rootKey,
            description: 'Child of root',
            createdBy: actorId,
          },
          orgId
        );
        await migrationReadinessService.registerFlagDefinition(
          {
            flagKey: grandchildKey,
            parentFlagKey: childKey,
            description: 'Grandchild of root, child of child',
            createdBy: actorId,
          },
          orgId
        );

        // listFlagDescendants must reflect the real self-referencing FK
        // hierarchy, not a naming convention.
        const descendants = await migrationReadinessService.listFlagDescendants(rootKey, actorId, orgId);
        expect(descendants.map((d) => d.flagKey).sort()).toEqual([childKey, grandchildKey].sort());

        for (const key of [rootKey, childKey, grandchildKey]) {
          await migrationReadinessService.setOrgFlagState({
            organizationId: orgId,
            flagKey: key,
            enabled: true,
            updatedBy: actorId,
          });
        }

        // All three enabled -> grandchild (most specific, deepest) wins;
        // root and child are excluded because each has an enabled child.
        const allEnabledResult = await migrationReadinessService.findSmallestEnabledDescendant(
          orgId,
          rootKey,
          actorId
        );
        expect(allEnabledResult).toHaveLength(1);
        expect(allEnabledResult[0].flagKey).toBe(grandchildKey);
        expect(allEnabledResult[0].depth).toBe(2);

        // Disable the grandchild only -> child becomes the deepest node with
        // no enabled child, so it wins.
        await migrationReadinessService.setOrgFlagState({
          organizationId: orgId,
          flagKey: grandchildKey,
          enabled: false,
          updatedBy: actorId,
        });
        const grandchildDisabledResult = await migrationReadinessService.findSmallestEnabledDescendant(
          orgId,
          rootKey,
          actorId
        );
        expect(grandchildDisabledResult).toHaveLength(1);
        expect(grandchildDisabledResult[0].flagKey).toBe(childKey);
        expect(grandchildDisabledResult[0].depth).toBe(1);

        // Disable the child too -> only root remains enabled, with no
        // enabled child, so it wins.
        await migrationReadinessService.setOrgFlagState({
          organizationId: orgId,
          flagKey: childKey,
          enabled: false,
          updatedBy: actorId,
        });
        const childDisabledResult = await migrationReadinessService.findSmallestEnabledDescendant(
          orgId,
          rootKey,
          actorId
        );
        expect(childDisabledResult).toHaveLength(1);
        expect(childDisabledResult[0].flagKey).toBe(rootKey);
        expect(childDisabledResult[0].depth).toBe(0);
      } finally {
        // Children before parents on the self-referencing parent_flag_key FK.
        await teardown({
          orgIds: [orgId],
          flagKeysDeepestFirst: [grandchildKey, childKey, rootKey],
          userIds: [actorId],
        });
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 4. rollbackFlag: exactly one UPDATE on exactly one (organizationId,
    //    flagKey) row; a sibling flag row is untouched; and
    //    case_workspace_history_events / case_workspace_value_measurements /
    //    case_core (none of which this service ever references) show no
    //    unexpected rows before or after, scoped to this test's own unique
    //    organization id.
    // -------------------------------------------------------------------------
    it('rollbackFlag disables exactly the target flag row, leaves a sibling flag row untouched, and touches no other table', async () => {
      const orgId = await seedOrg('rollback');
      const actorId = await seedMemberedUser(orgId, 'rollback');
      const targetFlagKey = uniqueFlagKey('rollback-target');
      const siblingFlagKey = uniqueFlagKey('rollback-sibling');
      try {
        await migrationReadinessService.registerFlagDefinition(
          {
            flagKey: targetFlagKey,
            description: 'Target flag for rollback test',
            createdBy: actorId,
          },
          orgId
        );
        await migrationReadinessService.registerFlagDefinition(
          {
            flagKey: siblingFlagKey,
            description: 'Sibling flag, must be unaffected by rollback of the target',
            createdBy: actorId,
          },
          orgId
        );

        await migrationReadinessService.setOrgFlagState({
          organizationId: orgId,
          flagKey: targetFlagKey,
          enabled: true,
          cohort: 'internal',
          rolloutPercentage: 42,
          allowList: ['entity-1'],
          updatedBy: actorId,
        });
        const siblingBefore = await migrationReadinessService.setOrgFlagState({
          organizationId: orgId,
          flagKey: siblingFlagKey,
          enabled: true,
          updatedBy: actorId,
        });

        const scopedCountsBefore = await countScopedRows({
          historyOrgId: orgId,
          valueOrgId: orgId,
          caseOrgId: orgId,
        });
        expect(scopedCountsBefore).toEqual({ history: 0, value: 0, caseCore: 0 });

        const rolledBack = await migrationReadinessService.rollbackFlag(orgId, targetFlagKey, actorId);
        expect(rolledBack.enabled).toBe(false);
        expect(rolledBack.flagKey).toBe(targetFlagKey);
        // rollbackFlag carries cohort/rolloutPercentage/allowList through
        // unchanged — it flips only `enabled`.
        expect(rolledBack.cohort).toBe('internal');
        expect(rolledBack.rolloutPercentage).toBe(42);
        expect(rolledBack.allowList).toEqual(['entity-1']);

        const targetRowAfter = await readFeatureFlagRow(orgId, targetFlagKey);
        expect(targetRowAfter).not.toBeNull();
        expect(targetRowAfter?.enabled).toBe(false);

        // The sibling row must be completely untouched — same enabled state,
        // same updated_at, same updated_by as before rollbackFlag() ran.
        const siblingRowAfter = await readFeatureFlagRow(orgId, siblingFlagKey);
        expect(siblingRowAfter).not.toBeNull();
        expect(siblingRowAfter?.enabled).toBe(true);
        expect(siblingRowAfter?.updated_at).toBe(siblingBefore.updatedAt);
        expect(siblingRowAfter?.updated_by).toBe(actorId);

        // Exactly one case_workspace_feature_flags row per flag_key for this
        // org — rollbackFlag never inserts a second row or writes to another
        // flag_key.
        const allFlagRowsForOrg = await control.query<FeatureFlagDbRow>(
          `SELECT * FROM case_workspace_feature_flags WHERE organization_id = $1 ORDER BY flag_key ASC`,
          [orgId]
        );
        expect(allFlagRowsForOrg.rows).toHaveLength(2);

        const scopedCountsAfter = await countScopedRows({
          historyOrgId: orgId,
          valueOrgId: orgId,
          caseOrgId: orgId,
        });
        expect(scopedCountsAfter).toEqual({ history: 0, value: 0, caseCore: 0 });
        expect(scopedCountsAfter).toEqual(scopedCountsBefore);
      } finally {
        await teardown({
          orgIds: [orgId],
          flagKeysDeepestFirst: [targetFlagKey, siblingFlagKey],
          userIds: [actorId],
        });
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 5. isFlagEnabledForEntity: deterministic across repeated calls for a
    //    fixed (state, entityId), and the allow-list force-includes an
    //    entity even at rollout_percentage=0.
    // -------------------------------------------------------------------------
    it('isFlagEnabledForEntity is deterministic across repeated calls, and force-includes an allow-listed entity even at rollout_percentage=0', async () => {
      const orgId = await seedOrg('entity-determinism');
      const actorId = await seedMemberedUser(orgId, 'entity-determinism');
      const flagKey = uniqueFlagKey('entity-determinism');
      const entityId = `entity-${randomUUID()}`;
      try {
        await migrationReadinessService.registerFlagDefinition(
          {
            flagKey,
            description: 'Flag for entity-rollout determinism test',
            createdBy: actorId,
          },
          orgId
        );

        await migrationReadinessService.setOrgFlagState({
          organizationId: orgId,
          flagKey,
          enabled: true,
          rolloutPercentage: 50,
          updatedBy: actorId,
        });
        const state50: FeatureFlagState | null = await migrationReadinessService.getCurrentOrgFlagState(
          orgId,
          flagKey,
          actorId
        );
        expect(state50).not.toBeNull();

        const resultsFor50pct = Array.from({ length: 5 }, () =>
          migrationReadinessService.isFlagEnabledForEntity(state50, entityId)
        );
        expect(new Set(resultsFor50pct).size).toBe(1);
        expect(resultsFor50pct).toEqual([
          resultsFor50pct[0],
          resultsFor50pct[0],
          resultsFor50pct[0],
          resultsFor50pct[0],
          resultsFor50pct[0],
        ]);

        // Force this specific entityId onto the allow-list while dropping
        // rollout_percentage to 0 (nobody qualifies via the percentage
        // rollout) -> the allow-listed entity must still evaluate enabled.
        await migrationReadinessService.setOrgFlagState({
          organizationId: orgId,
          flagKey,
          enabled: true,
          rolloutPercentage: 0,
          allowList: [entityId],
          updatedBy: actorId,
        });
        const stateAllowListed = await migrationReadinessService.getCurrentOrgFlagState(orgId, flagKey, actorId);
        expect(stateAllowListed).not.toBeNull();
        expect(stateAllowListed?.rolloutPercentage).toBe(0);
        expect(stateAllowListed?.allowList).toEqual([entityId]);

        expect(migrationReadinessService.isFlagEnabledForEntity(stateAllowListed, entityId)).toBe(true);

        // A DIFFERENT entity, not on the allow list, at rollout_percentage=0
        // must NOT be enabled — proves the allow-list check is specific to
        // entityId, not a blanket override.
        const otherEntityId = `entity-other-${randomUUID()}`;
        expect(
          migrationReadinessService.isFlagEnabledForEntity(stateAllowListed, otherEntityId)
        ).toBe(false);
      } finally {
        await teardown({ orgIds: [orgId], flagKeysDeepestFirst: [flagKey], userIds: [actorId] });
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 6a. recordQuarantinedLegacyRecord creates a row with the required
    //     reason/detail/recovery-path fields (DB-gated). Gated at plain
    //     requireOrgMember (not ADMIN) — exercised with a plain MEMBER-role
    //     actor to prove that.
    // -------------------------------------------------------------------------
    it('recordQuarantinedLegacyRecord creates a row carrying the required reason/detail/recovery-path fields', async () => {
      const orgId = await seedOrg('quarantine');
      const actorId = await seedMemberedUser(orgId, 'quarantine', 'MEMBER');
      const rehearsalRunId = `rehearsal-${randomUUID()}`;
      try {
        const detectedAt = new Date().toISOString();
        const created = await migrationReadinessService.recordQuarantinedLegacyRecord(
          {
            organizationId: orgId,
            rehearsalRunId,
            sourceSystem: 'legacy_agent_plan',
            sourceTable: 'legacy_plan_steps',
            sourceId: `legacy-row-${randomUUID()}`,
            quarantineReasonCode: 'NO_CASE_MATCH',
            quarantineReasonDetail: 'No case_core row could be matched for this legacy record.',
            recoveryPathRef: 'runbook://migration/manual-reconcile#no-case-match',
            sourceRecordSnapshot: { legacyField: 'value' },
            detectedAt,
          },
          actorId
        );

        expect(created.organizationId).toBe(orgId);
        expect(created.rehearsalRunId).toBe(rehearsalRunId);
        expect(created.quarantineReasonCode).toBe('NO_CASE_MATCH');
        expect(created.quarantineReasonDetail).toBe(
          'No case_core row could be matched for this legacy record.'
        );
        expect(created.recoveryPathRef).toBe('runbook://migration/manual-reconcile#no-case-match');
        expect(created.sourceRecordSnapshot).toEqual({ legacyField: 'value' });

        const dbRows = await control.query<LegacyQuarantineDbRow>(
          `SELECT * FROM case_workspace_legacy_quarantine WHERE quarantine_id = $1`,
          [created.quarantineId]
        );
        expect(dbRows.rows).toHaveLength(1);
        expect(dbRows.rows[0].quarantine_reason_code).toBe('NO_CASE_MATCH');
        expect(dbRows.rows[0].quarantine_reason_detail).toBe(
          'No case_core row could be matched for this legacy record.'
        );
        expect(dbRows.rows[0].recovery_path_ref).toBe(
          'runbook://migration/manual-reconcile#no-case-match'
        );
        expect(dbRows.rows[0].organization_id).toBe(orgId);

        // Missing/blank required fields must be rejected by the service
        // itself, before ever reaching the DB.
        await expect(
          migrationReadinessService.recordQuarantinedLegacyRecord(
            {
              organizationId: orgId,
              rehearsalRunId,
              sourceSystem: 'legacy_agent_plan',
              sourceTable: 'legacy_plan_steps',
              sourceId: `legacy-row-${randomUUID()}`,
              quarantineReasonCode: 'NO_CASE_MATCH',
              quarantineReasonDetail: '   ',
              recoveryPathRef: 'runbook://migration/manual-reconcile#no-case-match',
              detectedAt,
            },
            actorId
          )
        ).rejects.toThrow(/legacy_quarantine_reason_detail_required/);
      } finally {
        await teardown({
          orgIds: [orgId],
          flagKeysDeepestFirst: [],
          rehearsalRunIds: [rehearsalRunId],
          userIds: [actorId],
        });
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 6c. AUTHORIZATION (CW-P12) — registerFlagDefinition/setOrgFlagState
    //     (mutation class): a plain MEMBER-role actor is rejected with
    //     insufficient_org_role; an actor with no membership is rejected with
    //     not_org_member.
    // -------------------------------------------------------------------------
    it('registerFlagDefinition and setOrgFlagState reject a plain MEMBER-role actor with insufficient_org_role, and an actor with no membership with not_org_member', async () => {
      const orgId = await seedOrg('auth-admin-floor');
      const memberActorId = await seedMemberedUser(orgId, 'auth-admin-floor-member', 'MEMBER');
      const noMembershipActorId = await seedUser(orgId, 'auth-admin-floor-outsider');
      const adminActorId = await seedMemberedUser(orgId, 'auth-admin-floor-admin', 'ADMIN');
      const flagKey = uniqueFlagKey('auth-admin-floor');
      try {
        await expect(
          migrationReadinessService.registerFlagDefinition(
            { flagKey, description: 'Should not register (MEMBER)', createdBy: memberActorId },
            orgId
          )
        ).rejects.toMatchObject({ code: 'insufficient_org_role' });

        await expect(
          migrationReadinessService.registerFlagDefinition(
            { flagKey, description: 'Should not register (no membership)', createdBy: noMembershipActorId },
            orgId
          )
        ).rejects.toMatchObject({ code: 'not_org_member' });

        const rows = await control.query<FeatureFlagDefinitionDbRow>(
          `SELECT * FROM case_workspace_feature_flag_definitions WHERE flag_key = $1`,
          [flagKey]
        );
        expect(rows.rows).toHaveLength(0);

        // A real definition, created by the ADMIN actor — now prove
        // setOrgFlagState also rejects the MEMBER-role actor.
        await migrationReadinessService.registerFlagDefinition(
          { flagKey, description: 'Real definition for setOrgFlagState gate test', createdBy: adminActorId },
          orgId
        );

        await expect(
          migrationReadinessService.setOrgFlagState({
            organizationId: orgId,
            flagKey,
            enabled: true,
            updatedBy: memberActorId,
          })
        ).rejects.toMatchObject({ code: 'insufficient_org_role' });

        const flagRow = await readFeatureFlagRow(orgId, flagKey);
        expect(flagRow).toBeNull();
      } finally {
        await teardown({
          orgIds: [orgId],
          flagKeysDeepestFirst: [flagKey],
          userIds: [memberActorId, noMembershipActorId, adminActorId],
        });
      }
    }, 30_000);

    // -----------------------------------------------------------------------
    // 7. DOMAIN EVENT (EVENT_TAXONOMY.md §2 row 1 + §4) —
    //    registerFlagDefinition emits exactly one
    //    `flag.definition_registered` on the org-LESS definition aggregate:
    //    aggregate_id = flag_key, organization_id = the CALLER's org,
    //    aggregate_version = null. The idempotent identical re-registration
    //    mutates nothing and must therefore emit nothing.
    // -----------------------------------------------------------------------
    it('registerFlagDefinition writes exactly one flag.definition_registered outbox row keyed by flag_key with the caller org, and an identical re-registration adds none', async () => {
      const orgId = await seedOrg('outbox-flagdef');
      const actorId = await seedMemberedUser(orgId, 'outbox-flagdef', 'ADMIN');
      const flagKey = uniqueFlagKey('outbox-flagdef');
      try {
        await migrationReadinessService.registerFlagDefinition(
          { flagKey, description: 'outbox definition test', createdBy: actorId },
          orgId
        );

        const events = await readOutboxRowsForAggregate(flagKey);
        expect(events).toHaveLength(1);
        const event = events[0];
        expect(event.event_type).toBe('flag.definition_registered');
        expect(event.aggregate_type).toBe('FEATURE_FLAG_DEFINITION');
        expect(event.aggregate_id).toBe(flagKey);
        // §3: case_workspace_feature_flag_definitions has no version column.
        expect(event.aggregate_version).toBeNull();
        // §4: the aggregate carries no organization_id — the event takes the
        // CALLER's org and says so in the summary.
        expect(event.organization_id).toBe(orgId);
        expect(event.actor_user_id).toBe(actorId);
        expect(String(event.correlation_id ?? '').trim().length).toBeGreaterThan(0);
        expect(event.causation_id).toBeNull();
        expect(event.redacted_summary).toMatchObject({
          // CW-DOD-J1: a definition can never be registered default-ON.
          defaultEnabled: false,
          parentFlagKey: null,
          platformGlobalAggregate: true,
        });

        // Idempotent, identical re-registration returns the existing row
        // WITHOUT writing — so it must not mint a second event.
        await migrationReadinessService.registerFlagDefinition(
          { flagKey, description: 'outbox definition test', createdBy: actorId },
          orgId
        );
        expect(await readOutboxRowsForAggregate(flagKey)).toHaveLength(1);
      } finally {
        await teardown({ orgIds: [orgId], flagKeysDeepestFirst: [flagKey], userIds: [actorId] });
      }
    }, 30_000);

    // -----------------------------------------------------------------------
    // 8. DOMAIN EVENTS (EVENT_TAXONOMY.md §2 rows 2 and 3) — setOrgFlagState
    //    and rollbackFlag share ONE upsert path but must produce DIFFERENT
    //    event types, one row each, on the SAME stable flag_id aggregate.
    //    A rollback emitting `flag.org_state_changed` (or emitting twice)
    //    would be exactly the double-count §5.3 rejects.
    // -----------------------------------------------------------------------
    it('setOrgFlagState emits one flag.org_state_changed and rollbackFlag emits one flag.rolled_back, both on the same stable flag_id aggregate', async () => {
      const orgId = await seedOrg('outbox-flagstate');
      const actorId = await seedMemberedUser(orgId, 'outbox-flagstate', 'ADMIN');
      const flagKey = uniqueFlagKey('outbox-flagstate');
      try {
        await migrationReadinessService.registerFlagDefinition(
          { flagKey, description: 'outbox state test', createdBy: actorId },
          orgId
        );

        const enabled: FeatureFlagState = await migrationReadinessService.setOrgFlagState({
          organizationId: orgId,
          flagKey,
          enabled: true,
          cohort: 'internal',
          rolloutPercentage: 25,
          updatedBy: actorId,
        });

        const flagRow = await readFeatureFlagRow(orgId, flagKey);
        expect(flagRow).not.toBeNull();
        const flagId = flagRow!.flag_id;

        const afterSet = await readOutboxRowsForAggregate(flagId);
        expect(afterSet).toHaveLength(1);
        const setEvent = afterSet[0];
        expect(setEvent.event_type).toBe('flag.org_state_changed');
        expect(setEvent.aggregate_type).toBe('FEATURE_FLAG');
        expect(setEvent.aggregate_id).toBe(flagId);
        expect(setEvent.aggregate_version).toBeNull();
        expect(setEvent.organization_id).toBe(orgId);
        expect(setEvent.actor_user_id).toBe(actorId);
        expect(String(setEvent.correlation_id ?? '').trim().length).toBeGreaterThan(0);
        expect(setEvent.redacted_summary).toMatchObject({
          from: null, // no state row existed before -> read as OFF
          to: true,
          firstStateRow: true,
        });
        expect(enabled.enabled).toBe(true);

        await migrationReadinessService.rollbackFlag(orgId, flagKey, actorId);

        const afterRollback = await readOutboxRowsForAggregate(flagId);
        expect(afterRollback).toHaveLength(2);
        // The ON CONFLICT DO UPDATE branch keeps the EXISTING flag_id, so the
        // aggregate id is stable across every state change of one (org, flag).
        expect(afterRollback.every((row) => row.aggregate_id === flagId)).toBe(true);
        const rollbackEvents = afterRollback.filter((row) => row.event_type === 'flag.rolled_back');
        expect(rollbackEvents).toHaveLength(1);
        expect(rollbackEvents[0].redacted_summary).toMatchObject({ from: true, to: false });
        // And the rollback did NOT also emit the setOrgFlagState type.
        expect(
          afterRollback.filter((row) => row.event_type === 'flag.org_state_changed')
        ).toHaveLength(1);
      } finally {
        await teardown({ orgIds: [orgId], flagKeysDeepestFirst: [flagKey], userIds: [actorId] });
      }
    }, 30_000);

    // -----------------------------------------------------------------------
    // 9. DOMAIN EVENT (EVENT_TAXONOMY.md §2 row 4) —
    //    recordQuarantinedLegacyRecord emits exactly one
    //    `legacy.record_quarantined` carrying the reason CODE and a
    //    payloadRef, never the quarantined payload itself. The dedupe_key
    //    replay path writes nothing and must emit nothing.
    // -----------------------------------------------------------------------
    it('recordQuarantinedLegacyRecord emits one legacy.record_quarantined row with the reason code and a payloadRef, never the quarantined snapshot; a dedupe replay adds none', async () => {
      const orgId = await seedOrg('outbox-quarantine');
      const actorId = await seedMemberedUser(orgId, 'outbox-quarantine', 'MEMBER');
      const rehearsalRunId = `rehearsal-${randomUUID()}`;
      const dedupeKey = `quarantine-outbox-${randomUUID()}`;
      try {
        const created = await migrationReadinessService.recordQuarantinedLegacyRecord(
          {
            organizationId: orgId,
            rehearsalRunId,
            sourceSystem: 'legacy_agent_plan',
            sourceTable: 'legacy_plan_steps',
            sourceId: `legacy-row-${randomUUID()}`,
            quarantineReasonCode: 'NO_CASE_MATCH',
            quarantineReasonDetail: 'No case_core row could be matched for this legacy record.',
            recoveryPathRef: 'runbook://migration/manual-reconcile#no-case-match',
            sourceRecordSnapshot: { legacySecretPayload: 'must-never-be-copied-into-the-event' },
            detectedAt: new Date().toISOString(),
            dedupeKey,
          },
          actorId
        );

        const events = await readOutboxRowsForAggregate(created.quarantineId);
        expect(events).toHaveLength(1);
        const event = events[0];
        expect(event.event_type).toBe('legacy.record_quarantined');
        expect(event.aggregate_type).toBe('LEGACY_RECORD');
        expect(event.aggregate_id).toBe(created.quarantineId);
        expect(event.aggregate_version).toBeNull();
        // §6.2: taken from the row that was written, not from unvalidated input.
        expect(event.organization_id).toBe(orgId);
        expect(event.actor_user_id).toBe(actorId);
        expect(String(event.correlation_id ?? '').trim().length).toBeGreaterThan(0);
        expect(event.redacted_summary).toMatchObject({
          sourceSystem: 'legacy_agent_plan',
          sourceTable: 'legacy_plan_steps',
          quarantineReasonCode: 'NO_CASE_MATCH',
          rehearsalRunId,
        });
        expect(event.payload_ref).toBe(
          `case_workspace_legacy_quarantine:${created.quarantineId}`
        );
        // Reason CODE only — the quarantined payload is referenced, never copied.
        const summaryText = JSON.stringify(event.redacted_summary);
        expect(summaryText).not.toContain('must-never-be-copied-into-the-event');
        expect(summaryText).not.toContain('legacySecretPayload');

        // Same dedupe_key -> the service returns the existing row without
        // inserting; no mutation, therefore no second event.
        const replayed = await migrationReadinessService.recordQuarantinedLegacyRecord(
          {
            organizationId: orgId,
            rehearsalRunId,
            sourceSystem: 'legacy_agent_plan',
            sourceTable: 'legacy_plan_steps',
            sourceId: `legacy-row-${randomUUID()}`,
            quarantineReasonCode: 'NO_CASE_MATCH',
            quarantineReasonDetail: 'Replay of the same quarantine record.',
            recoveryPathRef: 'runbook://migration/manual-reconcile#no-case-match',
            sourceRecordSnapshot: { legacySecretPayload: 'must-never-be-copied-into-the-event' },
            detectedAt: new Date().toISOString(),
            dedupeKey,
          },
          actorId
        );
        expect(replayed.quarantineId).toBe(created.quarantineId);
        expect(await readOutboxRowsForAggregate(created.quarantineId)).toHaveLength(1);
      } finally {
        await teardown({
          orgIds: [orgId],
          flagKeysDeepestFirst: [],
          rehearsalRunIds: [rehearsalRunId],
          userIds: [actorId],
        });
      }
    }, 30_000);

    // -----------------------------------------------------------------------
    // 10. ROLLBACK / ATOMICITY — a failure forced AFTER the flag-state upsert
    //     and AFTER publishEvent (deferred constraint trigger firing at
    //     COMMIT) leaves ZERO flag rows and ZERO `flag.org_state_changed`
    //     rows. If publishEvent ever opened its own connection, the event
    //     would survive here.
    // -----------------------------------------------------------------------
    it('a failure forced at COMMIT time after setOrgFlagState leaves zero feature-flag rows AND zero flag.org_state_changed outbox rows', async () => {
      const orgId = await seedOrg('outbox-rollback');
      const actorId = await seedMemberedUser(orgId, 'outbox-rollback', 'ADMIN');
      const flagKey = uniqueFlagKey('outbox-rollback');
      try {
        await migrationReadinessService.registerFlagDefinition(
          { flagKey, description: 'outbox rollback test', createdBy: actorId },
          orgId
        );
        // The definition's own event is already durable — the rollback below
        // must not remove it, and must not add a flag-state one.
        expect(await readOutboxRowsForAggregate(flagKey)).toHaveLength(1);

        await withCommitTimePoison(
          {
            table: 'case_workspace_feature_flags',
            matchColumn: 'flag_key',
            matchValue: flagKey,
            event: 'INSERT',
          },
          async () => {
            await expect(
              migrationReadinessService.setOrgFlagState({
                organizationId: orgId,
                flagKey,
                enabled: true,
                updatedBy: actorId,
              })
            ).rejects.toThrow(/forced_commit_time_failure_for_atomicity_test/);
          }
        );

        expect(await readFeatureFlagRow(orgId, flagKey)).toBeNull();
        const orgEvents = await readOutboxRowsForOrg(orgId);
        expect(orgEvents.filter((row) => row.event_type === 'flag.org_state_changed')).toHaveLength(
          0
        );
        expect(
          orgEvents.filter((row) => row.event_type === 'flag.definition_registered')
        ).toHaveLength(1);

        // The same command succeeds once the poison is gone — the rollback
        // left no partial state behind.
        await migrationReadinessService.setOrgFlagState({
          organizationId: orgId,
          flagKey,
          enabled: true,
          updatedBy: actorId,
        });
        const flagRow = await readFeatureFlagRow(orgId, flagKey);
        expect(flagRow).not.toBeNull();
        expect(await readOutboxRowsForAggregate(flagRow!.flag_id)).toHaveLength(1);
      } finally {
        await teardown({ orgIds: [orgId], flagKeysDeepestFirst: [flagKey], userIds: [actorId] });
      }
    }, 30_000);
  }
);

// ---------------------------------------------------------------------------
// 6b. Structural check — always runs, regardless of DB availability, since
//     it never touches Postgres: migrationReadinessService.ts's own source
//     must contain no UPDATE/DELETE statement anywhere against
//     case_workspace_legacy_quarantine, proving the table is append-only by
//     structural omission (same convention case_workspace_history_events
//     uses in caseHistoryService.ts).
// ---------------------------------------------------------------------------
describe('migrationReadinessService — source-level structural checks (no DB required)', () => {
  it('contains no UPDATE or DELETE statement anywhere against case_workspace_legacy_quarantine', () => {
    const currentFilePath = fileURLToPath(import.meta.url);
    const serviceFilePath = join(dirname(currentFilePath), '..', 'migrationReadinessService.ts');
    const source = readFileSync(serviceFilePath, 'utf8');

    // Matches `UPDATE case_workspace_legacy_quarantine` or
    // `DELETE FROM case_workspace_legacy_quarantine` (whitespace-tolerant,
    // case-insensitive) anywhere in the file.
    const updateOrDeletePattern =
      /\b(UPDATE\s+case_workspace_legacy_quarantine|DELETE\s+FROM\s+case_workspace_legacy_quarantine)\b/i;

    expect(source).not.toMatch(updateOrDeletePattern);
    // Sanity check that the pattern itself is capable of matching, so a
    // silently-broken regex can't produce a false pass.
    expect('UPDATE case_workspace_legacy_quarantine SET x = 1').toMatch(updateOrDeletePattern);
    expect('DELETE FROM case_workspace_legacy_quarantine WHERE x = 1').toMatch(updateOrDeletePattern);
  });
});
