/**
 * Case Workspace — Case Artifact Link service, proved against a REAL
 * PostgreSQL (CW-P09, EPIC E10 "Artifacts, evidence and deliverables").
 * Exercises
 * server/src/services/caseWorkspace/artifactLinkService.ts against the
 * schema in
 * server/migrations/20260809_case_workspace_artifact_links.sql.
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * Same convention as caseCoreService.pg.test.ts (CW-P01) and
 * caseHistoryService.pg.test.ts (CW-P07): `NODE_ENV=test` ALONE is a trap —
 * `Database.ts`'s `getDatabase()`/`createDatabase()` hand back an in-memory
 * MOCK whenever `RUN_DB_TESTS !== '1'` (or `MOCK_DB` isn't explicitly
 * `'false'`), and every write silently becomes a no-op. This file follows
 * the `*.pg.test.ts` convention: gate on
 * `RUN_DB_TESTS === '1' && MOCK_DB === 'false'`, probe reachability AND that
 * the migrated schema is actually present before deciding, and SKIP LOUDLY
 * (never silently pass) when either is missing.
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/artifactLinkService.pg.test.ts
 *
 * ===========================================================================
 * ISOLATION — every test owns its own case(s) via caseCoreService.createCase
 * ===========================================================================
 * `case_workspace_artifact_links.case_id` DOES carry a real FK into
 * `case_core(case_id)` (see the migration's header — unlike
 * case_workspace_history_events' deliberately FK-less case_id), so every
 * test here bundles a fresh organization + project + real case_core row via
 * `seedOrgProjectCase()`, exactly like caseHistoryService.pg.test.ts's own
 * value-measurement tests do. Every test seeds its own fixture(s) inside the
 * test body (never a shared beforeEach) and tears them down itself in a
 * `finally`, so no test can observe, reset, or race another test's rows.
 *
 * All assertions read the actual `case_workspace_artifact_links` rows back
 * out of Postgres through a dedicated, out-of-band `pg.Pool` (`control`) —
 * never the service function's return value alone — because the return
 * value only proves what the service THINKS it wrote, not what actually
 * landed.
 *
 * ===========================================================================
 * AUTHORIZATION (CW-P12 retrofit) — every actor is a real, membered user
 * ===========================================================================
 * artifactLinkService.ts now gates every method through
 * caseWorkspaceAuthContext.ts's requireCaseAccess. Every actor id used below
 * is a real `users` row with a matching ACTIVE `organization_members` row
 * for the Case's org, seeded via seedMemberedUser() — a test-fixture-only
 * direct insert on the out-of-band pool.
 *
 * ===========================================================================
 * STRUCTURAL no-DELETE check (test 6) runs UNCONDITIONALLY, not gated
 * ===========================================================================
 * "There is no SQL DELETE against case_workspace_artifact_links anywhere in
 * artifactLinkService.ts" is a static fact about the source file, not a
 * behavior of a live database — asserted in its own top-level `describe`
 * block, outside the `REACHABLE`-gated suite, so it still runs (and still
 * protects CW-RT-025's "unlinking never deletes the artifact" invariant)
 * even in environments with no Postgres available. Same structural-regex
 * idea as caseHistoryService.pg.test.ts's own test 5.
 */

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import * as artifactLinkService from '../artifactLinkService.js';
import * as caseCoreService from '../caseCoreService.js';

/**
 * ===========================================================================
 * ROLLBACK HARNESS — how "a forced failure after the mutation leaves NO
 * outbox row" is proved without touching shared schema
 * ===========================================================================
 * EVENT_TAXONOMY §6.6 requires each command's realDB suite to prove both
 * directions of the atomicity claim: one outbox row on success, and ZERO
 * after a forced failure. Proving the second direction needs a failure that
 * lands strictly AFTER the aggregate write AND after the outbox INSERT —
 * anything failing earlier proves nothing, because the outbox would then be
 * empty for the trivial reason that publishEvent never ran.
 *
 * The mechanism is a pass-through module mock: `publishEvent` calls the REAL
 * implementation on the service's own transaction client (a genuine outbox
 * row really is inserted inside the transaction), and only then, when armed,
 * throws. withPgTransaction's catch issues ROLLBACK, and the assertions —
 * made afterwards on a SEPARATE out-of-band connection — are that Postgres
 * holds neither the event nor the mutation.
 *
 * A Postgres trigger on `case_workspace_event_outbox` would prove the same
 * thing, but that table is shared with every other suite running against this
 * database and CREATE TRIGGER takes an ACCESS EXCLUSIVE lock on it. The mock
 * is process-local and can never affect another suite; the wrapper is inert
 * (`armed === false`) for every other test in this file.
 */
const outboxBoom = vi.hoisted(() => ({ armed: false }));

vi.mock('../eventOutboxService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../eventOutboxService.js')>();
  return {
    ...actual,
    publishEvent: async (
      client: Parameters<typeof actual.publishEvent>[0],
      envelope: Parameters<typeof actual.publishEvent>[1]
    ) => {
      const published = await actual.publishEvent(client, envelope);
      if (outboxBoom.armed) throw new Error('cw_test_forced_failure_after_publish');
      return published;
    },
  };
});

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
    const columnsResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_artifact_links'
          AND column_name IN (
            'link_id', 'case_id', 'artifact_type', 'artifact_id', 'relation',
            'link_status', 'revision_pin_history', 'is_stale', 'dedupe_key', 'version'
          )`
    );
    const columnsOk = Number(columnsResult.rows[0]?.present ?? 0) === 10;

    const indexResult = await probe.query(
      `SELECT count(*)::int AS present FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'case_workspace_artifact_links'
          AND indexname = 'uq_case_workspace_artifact_links_active_tuple'`
    );
    const indexOk = Number(indexResult.rows[0]?.present ?? 0) === 1;

    const orgMembersResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organization_members'
          AND column_name IN ('organization_id', 'user_id', 'role', 'status')`
    );
    const orgMembersOk = Number(orgMembersResult.rows[0]?.present ?? 0) === 4;

    return columnsOk && indexOk && orgMembersOk;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[artifactLinkService pg suite SKIPPED — this is a clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `20260809_case_workspace_artifact_links.sql migration applied (on top of ` +
      `20260809_case_workspace_case_core.sql). requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

interface CaseWorkspaceArtifactLinkDbRow {
  link_id: string;
  organization_id: string;
  project_id: string | null;
  case_id: string;
  artifact_type: string;
  artifact_id: string;
  artifact_revision: string | null;
  revision_pin_history: string;
  relation: string;
  link_status: string;
  is_stale: boolean;
  stale_marked_at: string | null;
  stale_marked_by_actor_id: string | null;
  stale_reason: string | null;
  unlinked_at: string | null;
  unlinked_by_actor_id: string | null;
  unlink_reason: string | null;
  unavailable_marked_at: string | null;
  unavailable_marked_by_actor_id: string | null;
  unavailable_reason: string | null;
  linked_by_actor_id: string;
  linked_at: string;
  dedupe_key: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

/** One `case_workspace_event_outbox` row, read back out-of-band. */
interface OutboxDbRow {
  event_id: string;
  event_type: string;
  schema_version: number;
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
  delivered_at: string | null;
}

suite(
  'artifactLinkService — Case Artifact Links against a real PostgreSQL (CW-P09, E10)',
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

    /** A fresh users row, unattached to organization_members unless seedMember() is also called for it. */
    async function seedUser(orgId: string, label: string): Promise<string> {
      const userId = `case-alink-user-${label}-${randomUUID()}`;
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
        [`case-alink-member-${randomUUID()}`, orgId, userId, role, status]
      );
    }

    /** Convenience: seed a user AND an ACTIVE membership at MEMBER role in one call. */
    async function seedMemberedUser(orgId: string, label: string): Promise<string> {
      const userId = await seedUser(orgId, label);
      await seedMember(orgId, userId, 'MEMBER');
      return userId;
    }

    /**
     * A fresh organization + project + real case_core row, plus a real
     * membered actor to create the Case with — exactly like
     * caseHistoryService.pg.test.ts's own seedOrgProjectCase(). Required
     * because case_workspace_artifact_links.case_id DOES FK into
     * case_core(case_id).
     */
    async function seedOrgProjectCase(
      label: string
    ): Promise<{ orgId: string; projectId: string; caseId: string; actorId: string }> {
      const suffix = randomUUID();
      const orgId = `case-alink-org-${label}-${suffix}`;
      const projectId = `case-alink-project-${label}-${suffix}`;
      await control.query(
        `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        [orgId, `Artifact Link test org (${label})`]
      );
      await control.query(
        `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)
           ON CONFLICT (id) DO NOTHING`,
        [projectId, orgId, `Artifact Link test project (${label})`]
      );
      const actorId = await seedMemberedUser(orgId, label);
      const created = await caseCoreService.createCase({
        projectId,
        organizationId: orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        createdByActorId: actorId,
      });
      return { orgId, projectId, caseId: created.caseId, actorId };
    }

    /** Teardown: links first (FK into case_core), then users, then case_core, project, org. */
    async function teardownCase(
      orgId: string,
      projectId: string,
      caseId: string,
      userIds: string[] = []
    ): Promise<void> {
      await control
        .query(`DELETE FROM case_workspace_artifact_links WHERE case_id = $1`, [caseId])
        .catch(() => undefined);
      for (const userId of userIds) {
        await control.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
      }
      await control.query(`DELETE FROM case_core WHERE case_id = $1`, [caseId]).catch(() => undefined);
      await control.query(`DELETE FROM projects WHERE id = $1`, [projectId]).catch(() => undefined);
      // The outbox has no FK to organizations, so nothing cascades it away.
      // Every event this suite emits is org-scoped, so deleting by
      // organization_id removes exactly this test's rows and nothing else.
      await control
        .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
        .catch(() => undefined);
      await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
    }

    async function readLinkRow(linkId: string): Promise<CaseWorkspaceArtifactLinkDbRow | undefined> {
      const result = await control.query<CaseWorkspaceArtifactLinkDbRow>(
        `SELECT * FROM case_workspace_artifact_links WHERE link_id = $1`,
        [linkId]
      );
      return result.rows[0];
    }

    /**
     * Outbox rows for one aggregate, read on the out-of-band `control` pool —
     * NEVER from publishEvent's return value, which only proves what the
     * service THINKS it wrote. Scoped by aggregate_id (never a global count):
     * this database is shared with other suites that write the same table.
     */
    async function readOutboxRowsForAggregate(aggregateId: string): Promise<OutboxDbRow[]> {
      const result = await control.query<OutboxDbRow>(
        `SELECT event_id, event_type, schema_version, organization_id, project_id,
                aggregate_type, aggregate_id, aggregate_version, case_id,
                actor_user_id, correlation_id, causation_id, redacted_summary,
                payload_ref, delivered_at
           FROM case_workspace_event_outbox
          WHERE aggregate_id = $1
          ORDER BY aggregate_version ASC NULLS LAST, created_at ASC`,
        [aggregateId]
      );
      return result.rows;
    }

    async function readLinkRowsForTuple(
      caseId: string,
      artifactType: string,
      artifactId: string,
      relation: string
    ): Promise<CaseWorkspaceArtifactLinkDbRow[]> {
      const result = await control.query<CaseWorkspaceArtifactLinkDbRow>(
        `SELECT * FROM case_workspace_artifact_links
           WHERE case_id = $1 AND artifact_type = $2 AND artifact_id = $3 AND relation = $4
           ORDER BY linked_at ASC`,
        [caseId, artifactType, artifactId, relation]
      );
      return result.rows;
    }

    // -------------------------------------------------------------------------
    // 1. Duplicate ACTIVE link for the same tuple is rejected; only one
    //    ACTIVE row exists afterward.
    // -------------------------------------------------------------------------
    it('linkArtifactToCase creates an ACTIVE row; a second linkArtifactToCase for the same (case_id, artifact_type, artifact_id, relation) while the first is still ACTIVE is rejected, leaving only one ACTIVE row', async () => {
      const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('dup');
      const artifactType = 'document';
      const artifactId = `doc-dup-${randomUUID()}`;
      try {
        const first = await artifactLinkService.linkArtifactToCase({
          caseId,
          artifactType,
          artifactId,
          relation: 'EVIDENCE',
          linkedByActorId: actorId,
        });

        expect(first.linkStatus).toBe('ACTIVE');
        expect(first.caseId).toBe(caseId);

        const firstRow = await readLinkRow(first.linkId);
        expect(firstRow?.link_status).toBe('ACTIVE');

        // A second linkArtifactToCase for the identical tuple, while the
        // first is still ACTIVE, must be rejected — the partial unique
        // index uq_case_workspace_artifact_links_active_tuple (WHERE
        // link_status='ACTIVE') is the ultimate enforcement per CW-01-029;
        // the service does not pre-check it (per its own doc comment), so
        // the rejection surfaces as a real Postgres unique-violation
        // propagating out of the second call.
        let secondCallError: unknown;
        try {
          await artifactLinkService.linkArtifactToCase({
            caseId,
            artifactType,
            artifactId,
            relation: 'EVIDENCE',
            linkedByActorId: actorId,
          });
        } catch (err) {
          secondCallError = err;
        }
        expect(secondCallError).toBeDefined();
        expect(String((secondCallError as { message?: string } | undefined)?.message ?? '')).toMatch(
          /duplicate key|unique constraint|uq_case_workspace_artifact_links_active_tuple/i
        );

        // Only ONE ACTIVE row exists for the tuple afterward.
        const rowsForTuple = await readLinkRowsForTuple(caseId, artifactType, artifactId, 'EVIDENCE');
        const activeRows = rowsForTuple.filter((r) => r.link_status === 'ACTIVE');
        expect(activeRows).toHaveLength(1);
        expect(activeRows[0].link_id).toBe(first.linkId);
        expect(rowsForTuple).toHaveLength(1);
      } finally {
        await teardownCase(orgId, projectId, caseId, [actorId]);
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 2. unlinkArtifactFromCase never deletes; a fresh link for the same
    //    tuple creates a new row, old row survives untouched as history.
    // -------------------------------------------------------------------------
    it('unlinkArtifactFromCase sets link_status=UNLINKED but the row still exists (proving CW-RT-025); a fresh linkArtifactToCase for the same tuple then succeeds, creating a new ACTIVE row while the old UNLINKED row is untouched', async () => {
      const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('unlink');
      const artifactType = 'decision';
      const artifactId = `dec-unlink-${randomUUID()}`;
      try {
        const original = await artifactLinkService.linkArtifactToCase({
          caseId,
          artifactType,
          artifactId,
          relation: 'DECISION_BASIS',
          linkedByActorId: actorId,
        });

        const unlinked = await artifactLinkService.unlinkArtifactFromCase(
          original.linkId,
          { actorUserId: actorId },
          'no longer relevant'
        );

        expect(unlinked.linkStatus).toBe('UNLINKED');
        expect(unlinked.unlinkedAt).not.toBeNull();
        expect(unlinked.unlinkedByActorId).toBe(actorId);
        expect(unlinked.unlinkReason).toBe('no longer relevant');

        // The row still EXISTS (SELECT count still 1) — unlinking never
        // deletes the artifact link record (CW-RT-025).
        const rowsAfterUnlink = await readLinkRowsForTuple(caseId, artifactType, artifactId, 'DECISION_BASIS');
        expect(rowsAfterUnlink).toHaveLength(1);
        expect(rowsAfterUnlink[0].link_id).toBe(original.linkId);
        expect(rowsAfterUnlink[0].link_status).toBe('UNLINKED');
        expect(rowsAfterUnlink[0].unlinked_at).not.toBeNull();
        expect(rowsAfterUnlink[0].unlinked_by_actor_id).toBe(actorId);

        // A FRESH linkArtifactToCase for the SAME tuple now succeeds
        // (allowed because the old row is no longer ACTIVE, so it falls
        // outside the partial unique index).
        const relinked = await artifactLinkService.linkArtifactToCase({
          caseId,
          artifactType,
          artifactId,
          relation: 'DECISION_BASIS',
          linkedByActorId: actorId,
        });
        expect(relinked.linkId).not.toBe(original.linkId);
        expect(relinked.linkStatus).toBe('ACTIVE');

        // Second row now exists; the first row is preserved, untouched, as
        // UNLINKED history.
        const rowsAfterRelink = await readLinkRowsForTuple(caseId, artifactType, artifactId, 'DECISION_BASIS');
        expect(rowsAfterRelink).toHaveLength(2);

        const oldRow = rowsAfterRelink.find((r) => r.link_id === original.linkId);
        const newRow = rowsAfterRelink.find((r) => r.link_id === relinked.linkId);
        expect(oldRow).toBeDefined();
        expect(newRow).toBeDefined();

        // Old row untouched: still UNLINKED, same unlink metadata as read
        // right after the unlink call.
        expect(oldRow?.link_status).toBe('UNLINKED');
        expect(oldRow?.unlinked_at).toBe(rowsAfterUnlink[0].unlinked_at);
        expect(oldRow?.unlinked_by_actor_id).toBe(actorId);
        expect(oldRow?.unlink_reason).toBe('no longer relevant');

        // New row is a genuinely fresh ACTIVE row.
        expect(newRow?.link_status).toBe('ACTIVE');
        expect(newRow?.unlinked_at).toBeNull();
      } finally {
        await teardownCase(orgId, projectId, caseId, [actorId]);
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 3. pinArtifactRevision appends to revision_pin_history (append-only,
    //    survives across calls, in order) and clears is_stale on re-pin.
    // -------------------------------------------------------------------------
    it('pinArtifactRevision appends an entry to revision_pin_history and updates artifact_revision; called twice, both entries survive in order; calling it after markLinkStale clears is_stale back to false', async () => {
      const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('pin');
      const artifactType = 'kpi';
      const artifactId = `kpi-pin-${randomUUID()}`;
      try {
        const link = await artifactLinkService.linkArtifactToCase({
          caseId,
          artifactType,
          artifactId,
          relation: 'OUTCOME_MEASUREMENT',
          linkedByActorId: actorId,
          // no artifactRevision at link time — revision_pin_history starts empty
        });
        expect(link.revisionPinHistory).toHaveLength(0);
        expect(link.artifactRevision).toBeNull();

        const pinned1 = await artifactLinkService.pinArtifactRevision(
          link.linkId,
          'rev-1',
          { actorUserId: actorId },
          'first pin'
        );
        expect(pinned1.artifactRevision).toBe('rev-1');
        expect(pinned1.revisionPinHistory).toHaveLength(1);
        expect(pinned1.revisionPinHistory[0]).toMatchObject({
          revision: 'rev-1',
          pinnedByActorId: actorId,
          reason: 'first pin',
        });

        const pinned2 = await artifactLinkService.pinArtifactRevision(
          link.linkId,
          'rev-2',
          { actorUserId: actorId },
          'second pin'
        );
        expect(pinned2.artifactRevision).toBe('rev-2');
        // Array grew by exactly one — append-only, prior entry preserved.
        expect(pinned2.revisionPinHistory).toHaveLength(2);
        expect(pinned2.revisionPinHistory[0]).toMatchObject({ revision: 'rev-1', pinnedByActorId: actorId });
        expect(pinned2.revisionPinHistory[1]).toMatchObject({ revision: 'rev-2', pinnedByActorId: actorId });

        // Independently, out-of-band, confirm both entries survive in
        // order and artifact_revision reflects the latest pin.
        const rowAfterTwoPins = await readLinkRow(link.linkId);
        const historyAfterTwoPins = JSON.parse(rowAfterTwoPins?.revision_pin_history ?? '[]');
        expect(historyAfterTwoPins).toHaveLength(2);
        expect(historyAfterTwoPins.map((h: { revision: string }) => h.revision)).toEqual(['rev-1', 'rev-2']);
        expect(rowAfterTwoPins?.artifact_revision).toBe('rev-2');

        // Mark stale, then pin again — is_stale must clear back to false.
        const staled = await artifactLinkService.markLinkStale(
          link.linkId,
          { actorUserId: actorId },
          'upstream moved'
        );
        expect(staled.isStale).toBe(true);

        const pinned3 = await artifactLinkService.pinArtifactRevision(
          link.linkId,
          'rev-3',
          { actorUserId: actorId },
          'resolves staleness'
        );
        expect(pinned3.isStale).toBe(false);
        expect(pinned3.staleMarkedAt).toBeNull();
        expect(pinned3.staleMarkedByActorId).toBeNull();
        expect(pinned3.staleReason).toBeNull();
        // Third entry appended — all three survive, in order.
        expect(pinned3.revisionPinHistory).toHaveLength(3);
        expect(pinned3.revisionPinHistory.map((h) => h.revision)).toEqual(['rev-1', 'rev-2', 'rev-3']);

        const rowAfterThirdPin = await readLinkRow(link.linkId);
        expect(rowAfterThirdPin?.is_stale).toBe(false);
        const historyAfterThirdPin = JSON.parse(rowAfterThirdPin?.revision_pin_history ?? '[]');
        expect(historyAfterThirdPin.map((h: { revision: string }) => h.revision)).toEqual([
          'rev-1',
          'rev-2',
          'rev-3',
        ]);
      } finally {
        await teardownCase(orgId, projectId, caseId, [actorId]);
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 4. markLinkStale touches ONLY the staleness fields — artifact_revision
    //    and revision_pin_history are untouched.
    // -------------------------------------------------------------------------
    it('markLinkStale sets is_stale=true plus stale_marked_at/stale_marked_by_actor_id/stale_reason, WITHOUT touching artifact_revision or revision_pin_history', async () => {
      const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('stale');
      const artifactType = 'initiative';
      const artifactId = `init-stale-${randomUUID()}`;
      try {
        const link = await artifactLinkService.linkArtifactToCase({
          caseId,
          artifactType,
          artifactId,
          artifactRevision: 'rev-baseline',
          relation: 'INPUT',
          linkedByActorId: actorId,
          pinReason: 'seeded at link time',
        });
        expect(link.artifactRevision).toBe('rev-baseline');
        expect(link.revisionPinHistory).toHaveLength(1);
        expect(link.isStale).toBe(false);

        const before = await readLinkRow(link.linkId);
        expect(before?.is_stale).toBe(false);
        expect(before?.stale_marked_at).toBeNull();

        const staled = await artifactLinkService.markLinkStale(
          link.linkId,
          { actorUserId: actorId },
          'source moved to a newer revision'
        );

        expect(staled.isStale).toBe(true);
        expect(staled.staleMarkedAt).not.toBeNull();
        expect(staled.staleMarkedByActorId).toBe(actorId);
        expect(staled.staleReason).toBe('source moved to a newer revision');

        const after = await readLinkRow(link.linkId);
        expect(after?.is_stale).toBe(true);
        expect(after?.stale_marked_at).not.toBeNull();
        expect(after?.stale_marked_by_actor_id).toBe(actorId);
        expect(after?.stale_reason).toBe('source moved to a newer revision');

        // ONLY the staleness fields changed — artifact_revision and
        // revision_pin_history are byte-for-byte identical before/after.
        expect(after?.artifact_revision).toBe(before?.artifact_revision);
        expect(after?.artifact_revision).toBe('rev-baseline');
        expect(after?.revision_pin_history).toBe(before?.revision_pin_history);
        const historyAfter = JSON.parse(after?.revision_pin_history ?? '[]');
        expect(historyAfter).toHaveLength(1);
        expect(historyAfter[0].revision).toBe('rev-baseline');
      } finally {
        await teardownCase(orgId, projectId, caseId, [actorId]);
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 5. computeArtifactLinkSetDigest changes on this case's own ACTIVE-link
    //    mutations, and is unaffected by another case's link activity.
    // -------------------------------------------------------------------------
    it('computeArtifactLinkSetDigest changes after a new ACTIVE link is added or an existing link is re-pinned, but is unchanged by activity on a different case\'s links', async () => {
      const caseA = await seedOrgProjectCase('digest-a');
      const caseB = await seedOrgProjectCase('digest-b');
      try {
        const artifactTypeA = 'document';
        const artifactIdA1 = `doc-digest-a1-${randomUUID()}`;
        const artifactIdA2 = `doc-digest-a2-${randomUUID()}`;
        const artifactTypeB = 'document';
        const artifactIdB1 = `doc-digest-b1-${randomUUID()}`;

        // Seed one ACTIVE link on each case first, so both digests start
        // non-trivial (not just the empty-set digest).
        const linkA1 = await artifactLinkService.linkArtifactToCase({
          caseId: caseA.caseId,
          artifactType: artifactTypeA,
          artifactId: artifactIdA1,
          relation: 'EVIDENCE',
          linkedByActorId: caseA.actorId,
        });
        await artifactLinkService.linkArtifactToCase({
          caseId: caseB.caseId,
          artifactType: artifactTypeB,
          artifactId: artifactIdB1,
          relation: 'EVIDENCE',
          linkedByActorId: caseB.actorId,
        });

        const digestA1 = await artifactLinkService.computeArtifactLinkSetDigest(caseA.caseId, caseA.actorId);
        const digestB1 = await artifactLinkService.computeArtifactLinkSetDigest(caseB.caseId, caseB.actorId);
        expect(digestA1.caseId).toBe(caseA.caseId);
        expect(digestA1.linkCount).toBe(1);
        expect(digestB1.linkCount).toBe(1);

        // Mutate ONLY case A: add a second ACTIVE link.
        await artifactLinkService.linkArtifactToCase({
          caseId: caseA.caseId,
          artifactType: artifactTypeA,
          artifactId: artifactIdA2,
          relation: 'OUTPUT',
          linkedByActorId: caseA.actorId,
        });

        const digestA2 = await artifactLinkService.computeArtifactLinkSetDigest(caseA.caseId, caseA.actorId);
        const digestB2 = await artifactLinkService.computeArtifactLinkSetDigest(caseB.caseId, caseB.actorId);

        expect(digestA2.digest).not.toBe(digestA1.digest);
        expect(digestA2.linkCount).toBe(2);
        // Case B is completely unaffected by case A's mutation.
        expect(digestB2.digest).toBe(digestB1.digest);
        expect(digestB2.linkCount).toBe(1);

        // Mutate ONLY case A again: re-pin an existing link's revision.
        await artifactLinkService.pinArtifactRevision(
          linkA1.linkId,
          'rev-repin',
          { actorUserId: caseA.actorId },
          'repin for digest test'
        );

        const digestA3 = await artifactLinkService.computeArtifactLinkSetDigest(caseA.caseId, caseA.actorId);
        const digestB3 = await artifactLinkService.computeArtifactLinkSetDigest(caseB.caseId, caseB.actorId);

        expect(digestA3.digest).not.toBe(digestA2.digest);
        // Case B's digest is still unchanged, across both of case A's
        // mutations.
        expect(digestB3.digest).toBe(digestB1.digest);
      } finally {
        await teardownCase(caseA.orgId, caseA.projectId, caseA.caseId, [caseA.actorId]);
        await teardownCase(caseB.orgId, caseB.projectId, caseB.caseId, [caseB.actorId]);
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 7. AUTHORIZATION (CW-P12) — linkArtifactToCase (link class) and
    //    getArtifactLink (read class, SEC-009 hardening).
    // -------------------------------------------------------------------------
    it('linkArtifactToCase rejects an actor with no membership; getArtifactLink returns null for both a nonexistent link and one the actor cannot access', async () => {
      const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('auth');
      const noMembershipActor = await seedUser(orgId, 'auth-outsider');
      try {
        await expect(
          artifactLinkService.linkArtifactToCase({
            caseId,
            artifactType: 'document',
            artifactId: `doc-auth-${randomUUID()}`,
            relation: 'EVIDENCE',
            linkedByActorId: noMembershipActor,
          })
        ).rejects.toMatchObject({ code: 'case_access_denied' });

        const link = await artifactLinkService.linkArtifactToCase({
          caseId,
          artifactType: 'document',
          artifactId: `doc-auth-ok-${randomUUID()}`,
          relation: 'EVIDENCE',
          linkedByActorId: actorId,
        });

        const missing = await artifactLinkService.getArtifactLink(`cwlink-${randomUUID()}`, noMembershipActor);
        const denied = await artifactLinkService.getArtifactLink(link.linkId, noMembershipActor);
        expect(missing).toBeNull();
        expect(denied).toBeNull();

        const allowed = await artifactLinkService.getArtifactLink(link.linkId, actorId);
        expect(allowed?.linkId).toBe(link.linkId);
      } finally {
        await teardownCase(orgId, projectId, caseId, [actorId, noMembershipActor]);
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 8. resolveArtifactLinkOpen (CW-P09 packet B5, Deliverable Open/Return) —
    //    all four explicit states, the SEC-009 unauthorized/nonexistent
    //    collapse, and the deterministic relation -> resultsGroup mapping.
    // -------------------------------------------------------------------------
    it('resolveArtifactLinkOpen returns AVAILABLE with a populated deepLink for a fresh ACTIVE, non-stale link, and the returnContext carries caseId/casePhase/resultsGroup/linkId/relation', async () => {
      const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('open-available');
      const artifactType = 'decision';
      const artifactId = `dec-open-available-${randomUUID()}`;
      try {
        const link = await artifactLinkService.linkArtifactToCase({
          caseId,
          artifactType,
          artifactId,
          artifactRevision: 'rev-1',
          relation: 'DECISION_BASIS',
          linkedByActorId: actorId,
        });

        const resolution = await artifactLinkService.resolveArtifactLinkOpen(link.linkId, actorId);
        expect(resolution).not.toBeNull();
        expect(resolution?.state).toBe('AVAILABLE');
        expect(resolution?.linkId).toBe(link.linkId);
        expect(resolution?.caseId).toBe(caseId);
        expect(resolution?.relation).toBe('DECISION_BASIS');
        expect(resolution?.isStale).toBe(false);
        expect(resolution?.deepLink).toEqual({
          artifactType,
          artifactId,
          artifactRevision: 'rev-1',
        });
        expect(resolution?.unavailableReason).toBeNull();
        expect(resolution?.unlinkReason).toBeNull();
        // returnContext: doc 03 §5's "same Case phase and selected step" —
        // casePhase from case_core.case_status (DRAFT immediately after
        // createCase), resultsGroup deterministic from DECISION_BASIS.
        expect(resolution?.returnContext).toEqual({
          caseId,
          casePhase: 'DRAFT',
          resultsGroup: 'DECISIONS',
          linkId: link.linkId,
          relation: 'DECISION_BASIS',
        });
        expect(typeof resolution?.resolvedAt).toBe('string');
        expect(String(resolution?.resolvedAt)).not.toHaveLength(0);
      } finally {
        await teardownCase(orgId, projectId, caseId, [actorId]);
      }
    }, 30_000);

    it('resolveArtifactLinkOpen returns STALE with deepLink STILL populated for an ACTIVE link marked stale, carrying staleReason/staleMarkedAt', async () => {
      const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('open-stale');
      const artifactType = 'kpi';
      const artifactId = `kpi-open-stale-${randomUUID()}`;
      try {
        const link = await artifactLinkService.linkArtifactToCase({
          caseId,
          artifactType,
          artifactId,
          artifactRevision: 'rev-1',
          relation: 'OUTCOME_MEASUREMENT',
          linkedByActorId: actorId,
        });
        await artifactLinkService.markLinkStale(link.linkId, { actorUserId: actorId }, 'upstream KPI recomputed');

        const resolution = await artifactLinkService.resolveArtifactLinkOpen(link.linkId, actorId);
        expect(resolution?.state).toBe('STALE');
        expect(resolution?.isStale).toBe(true);
        expect(resolution?.staleReason).toBe('upstream KPI recomputed');
        expect(resolution?.staleMarkedAt).not.toBeNull();
        // A stale link is still openable — the pinned revision is behind,
        // not gone — so deepLink stays populated, distinct from UNAVAILABLE/DELETED.
        expect(resolution?.deepLink).toEqual({
          artifactType,
          artifactId,
          artifactRevision: 'rev-1',
        });
        expect(resolution?.returnContext.resultsGroup).toBe('EFFECT_AND_VALUE');
      } finally {
        await teardownCase(orgId, projectId, caseId, [actorId]);
      }
    }, 30_000);

    it('resolveArtifactLinkOpen returns UNAVAILABLE with a null deepLink for a link the module marked unavailable, carrying unavailableReason/unavailableMarkedAt', async () => {
      const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('open-unavailable');
      const artifactType = 'document';
      const artifactId = `doc-open-unavailable-${randomUUID()}`;
      try {
        const link = await artifactLinkService.linkArtifactToCase({
          caseId,
          artifactType,
          artifactId,
          relation: 'EVIDENCE',
          linkedByActorId: actorId,
        });
        await artifactLinkService.markLinkArtifactUnavailable(
          link.linkId,
          { actorUserId: actorId },
          'source document deleted in Documents module'
        );

        const resolution = await artifactLinkService.resolveArtifactLinkOpen(link.linkId, actorId);
        expect(resolution?.state).toBe('UNAVAILABLE');
        expect(resolution?.deepLink).toBeNull();
        expect(resolution?.unavailableReason).toBe('source document deleted in Documents module');
        expect(resolution?.unavailableMarkedAt).not.toBeNull();
        expect(resolution?.returnContext.resultsGroup).toBe('EVIDENCE_AND_LINEAGE');
      } finally {
        await teardownCase(orgId, projectId, caseId, [actorId]);
      }
    }, 30_000);

    it('resolveArtifactLinkOpen returns DELETED with a null deepLink for an unlinked (Case-side removed) link, carrying unlinkReason/unlinkedAt', async () => {
      const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('open-deleted');
      const artifactType = 'initiative';
      const artifactId = `init-open-deleted-${randomUUID()}`;
      try {
        const link = await artifactLinkService.linkArtifactToCase({
          caseId,
          artifactType,
          artifactId,
          relation: 'OUTPUT',
          linkedByActorId: actorId,
        });
        await artifactLinkService.unlinkArtifactFromCase(link.linkId, { actorUserId: actorId }, 'no longer relevant');

        const resolution = await artifactLinkService.resolveArtifactLinkOpen(link.linkId, actorId);
        expect(resolution?.state).toBe('DELETED');
        expect(resolution?.deepLink).toBeNull();
        expect(resolution?.unlinkReason).toBe('no longer relevant');
        expect(resolution?.unlinkedAt).not.toBeNull();
        expect(resolution?.returnContext.resultsGroup).toBe('KEY_FINDINGS_AND_RECOMMENDATIONS');
      } finally {
        await teardownCase(orgId, projectId, caseId, [actorId]);
      }
    }, 30_000);

    it('resolveArtifactLinkOpen returns null (never throws) for both a nonexistent linkId and a linkId a non-member actor cannot access — the SEC-009 unauthorized/nonexistent collapse', async () => {
      const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('open-auth');
      const noMembershipActor = await seedUser(orgId, 'open-auth-outsider');
      try {
        const link = await artifactLinkService.linkArtifactToCase({
          caseId,
          artifactType: 'document',
          artifactId: `doc-open-auth-${randomUUID()}`,
          relation: 'EVIDENCE',
          linkedByActorId: actorId,
        });

        const missing = await artifactLinkService.resolveArtifactLinkOpen(`cwlink-${randomUUID()}`, actorId);
        const deniedByOtherOrgActor = await artifactLinkService.resolveArtifactLinkOpen(
          link.linkId,
          noMembershipActor
        );
        expect(missing).toBeNull();
        expect(deniedByOtherOrgActor).toBeNull();

        // Negative control: the SAME link, resolved by the actual owning
        // actor, succeeds — proving the two nulls above are a genuine
        // access/existence outcome, not a wiring bug that always returns null.
        const allowed = await artifactLinkService.resolveArtifactLinkOpen(link.linkId, actorId);
        expect(allowed?.state).toBe('AVAILABLE');
      } finally {
        await teardownCase(orgId, projectId, caseId, [actorId, noMembershipActor]);
      }
    }, 30_000);

    // -----------------------------------------------------------------------
    // EVENT OUTBOX (EVENT_TAXONOMY §6.6) — each of the five mutating commands
    // publishes exactly one event, inside its own transaction, and publishes
    // nothing when that transaction rolls back.
    //
    // `case_workspace_artifact_links` HAS a version column, so every event
    // must carry the POST-mutation version (§3). Asserting the exact
    // 1,2,3,4 ladder over one link is what proves the events were taken from
    // the RETURNING row and not from a re-read or from the pre-image.
    // -----------------------------------------------------------------------

    it('linkArtifactToCase, pinArtifactRevision, markLinkStale and markLinkArtifactUnavailable each publish exactly one outbox row, in order, with the post-mutation version and full identity', async () => {
      const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('outbox-lifecycle');
      const artifactType = 'document';
      const artifactId = `doc-outbox-${randomUUID()}`;
      try {
        const link = await artifactLinkService.linkArtifactToCase({
          caseId,
          artifactType,
          artifactId,
          relation: 'EVIDENCE',
          linkedByActorId: actorId,
        });

        const afterLink = await readOutboxRowsForAggregate(link.linkId);
        expect(afterLink).toHaveLength(1);
        const linkedEvent = afterLink[0];
        expect(linkedEvent.event_type).toBe('artifact.linked_to_case');
        expect(linkedEvent.aggregate_type).toBe('ARTIFACT_LINK');
        expect(linkedEvent.aggregate_id).toBe(link.linkId);
        expect(linkedEvent.aggregate_version).toBe(1);
        expect(linkedEvent.organization_id).toBe(orgId);
        expect(linkedEvent.project_id).toBe(projectId);
        expect(linkedEvent.case_id).toBe(caseId);
        expect(linkedEvent.actor_user_id).toBe(actorId);
        expect(String(linkedEvent.correlation_id ?? '').length).toBeGreaterThan(0);
        expect(linkedEvent.causation_id).toBeNull();
        expect(linkedEvent.schema_version).toBe(1);
        expect(linkedEvent.delivered_at).toBeNull();
        expect(linkedEvent.redacted_summary.artifactId).toBe(artifactId);
        expect(linkedEvent.redacted_summary.relation).toBe('EVIDENCE');
        expect(linkedEvent.payload_ref).toBe(`case_workspace_artifact_links:${link.linkId}`);

        const pinned = await artifactLinkService.pinArtifactRevision(
          link.linkId,
          'rev-7',
          { actorUserId: actorId },
          'evidence for the closure memo'
        );
        expect(pinned.version).toBe(2);

        const afterPin = await readOutboxRowsForAggregate(link.linkId);
        expect(afterPin).toHaveLength(2);
        const pinnedEvent = afterPin[1];
        expect(pinnedEvent.event_type).toBe('evidence.pinned');
        // The post-mutation version, taken from RETURNING — not the pre-image.
        expect(pinnedEvent.aggregate_version).toBe(2);
        expect(pinnedEvent.aggregate_id).toBe(link.linkId);
        expect(pinnedEvent.organization_id).toBe(orgId);
        expect(pinnedEvent.case_id).toBe(caseId);
        expect(pinnedEvent.actor_user_id).toBe(actorId);
        expect(pinnedEvent.redacted_summary.pinnedRevision).toBe('rev-7');

        const staled = await artifactLinkService.markLinkStale(
          link.linkId,
          { actorUserId: actorId },
          'upstream document moved past rev-7'
        );
        expect(staled.version).toBe(3);

        const afterStale = await readOutboxRowsForAggregate(link.linkId);
        expect(afterStale).toHaveLength(3);
        const staleEvent = afterStale[2];
        expect(staleEvent.event_type).toBe('artifact_link.marked_stale');
        expect(staleEvent.aggregate_version).toBe(3);
        expect(staleEvent.actor_user_id).toBe(actorId);
        expect(staleEvent.redacted_summary.staleReason).toBe('upstream document moved past rev-7');

        const unavailable = await artifactLinkService.markLinkArtifactUnavailable(
          link.linkId,
          { actorUserId: actorId },
          'source deleted in its own module'
        );
        expect(unavailable.version).toBe(4);

        const afterUnavailable = await readOutboxRowsForAggregate(link.linkId);
        expect(afterUnavailable).toHaveLength(4);
        const unavailableEvent = afterUnavailable[3];
        expect(unavailableEvent.event_type).toBe('artifact_link.marked_unavailable');
        expect(unavailableEvent.aggregate_version).toBe(4);
        expect(unavailableEvent.organization_id).toBe(orgId);
        expect(unavailableEvent.case_id).toBe(caseId);
        expect(unavailableEvent.actor_user_id).toBe(actorId);
        // CW-03-017: unavailable is NOT removal from lineage.
        expect(unavailableEvent.redacted_summary.linkStatusFrom).toBe('ACTIVE');
        expect(unavailableEvent.redacted_summary.linkStatusTo).toBe('UNAVAILABLE');
        expect(unavailableEvent.redacted_summary.lineageRetained).toBe(true);

        // The full ordered event_type ladder for one aggregate — the sequence
        // itself is the replay contract, so it is asserted literally.
        expect(afterUnavailable.map((row) => row.event_type)).toEqual([
          'artifact.linked_to_case',
          'evidence.pinned',
          'artifact_link.marked_stale',
          'artifact_link.marked_unavailable',
        ]);
        // Every event_id is distinct: four facts, never one fact repeated.
        expect(new Set(afterUnavailable.map((row) => row.event_id)).size).toBe(4);
      } finally {
        await teardownCase(orgId, projectId, caseId, [actorId]);
      }
    }, 30_000);

    it('unlinkArtifactFromCase publishes exactly one artifact.unlinked_from_case outbox row recording the status flip, not a deletion', async () => {
      const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('outbox-unlink');
      const artifactType = 'document';
      const artifactId = `doc-outbox-unlink-${randomUUID()}`;
      try {
        const link = await artifactLinkService.linkArtifactToCase({
          caseId,
          artifactType,
          artifactId,
          relation: 'INPUT',
          linkedByActorId: actorId,
        });

        const unlinked = await artifactLinkService.unlinkArtifactFromCase(
          link.linkId,
          { actorUserId: actorId },
          'no longer referenced by the Case'
        );
        expect(unlinked.version).toBe(2);

        const events = await readOutboxRowsForAggregate(link.linkId);
        expect(events).toHaveLength(2);
        expect(events.map((row) => row.event_type)).toEqual([
          'artifact.linked_to_case',
          'artifact.unlinked_from_case',
        ]);

        const unlinkEvent = events[1];
        expect(unlinkEvent.aggregate_type).toBe('ARTIFACT_LINK');
        expect(unlinkEvent.aggregate_id).toBe(link.linkId);
        expect(unlinkEvent.aggregate_version).toBe(2);
        expect(unlinkEvent.organization_id).toBe(orgId);
        expect(unlinkEvent.project_id).toBe(projectId);
        expect(unlinkEvent.case_id).toBe(caseId);
        expect(unlinkEvent.actor_user_id).toBe(actorId);
        expect(String(unlinkEvent.correlation_id ?? '').length).toBeGreaterThan(0);
        expect(unlinkEvent.causation_id).toBeNull();
        expect(unlinkEvent.redacted_summary.linkStatusFrom).toBe('ACTIVE');
        expect(unlinkEvent.redacted_summary.linkStatusTo).toBe('UNLINKED');
        // CW-RT-025: the module keeps owning the artifact.
        expect(unlinkEvent.redacted_summary.artifactDeleted).toBe(false);
        expect(unlinkEvent.payload_ref).toBe(`case_workspace_artifact_links:${link.linkId}`);

        // The link row itself still exists — the event describes a status
        // flip, and the row it points at is still there to be read.
        const row = await readLinkRow(link.linkId);
        expect(row?.link_status).toBe('UNLINKED');
      } finally {
        await teardownCase(orgId, projectId, caseId, [actorId]);
      }
    }, 30_000);

    it('a failure raised AFTER the event is published rolls both back: pinArtifactRevision leaves neither a new outbox row nor a bumped link row', async () => {
      const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('outbox-rollback');
      const artifactType = 'document';
      const artifactId = `doc-outbox-rollback-${randomUUID()}`;
      try {
        const link = await artifactLinkService.linkArtifactToCase({
          caseId,
          artifactType,
          artifactId,
          relation: 'EVIDENCE',
          artifactRevision: 'rev-1',
          linkedByActorId: actorId,
        });
        expect(await readOutboxRowsForAggregate(link.linkId)).toHaveLength(1);

        outboxBoom.armed = true;
        try {
          await expect(
            artifactLinkService.pinArtifactRevision(link.linkId, 'rev-2', { actorUserId: actorId }, 'doomed')
          ).rejects.toThrow(/cw_test_forced_failure_after_publish/);
        } finally {
          outboxBoom.armed = false;
        }

        // No second event...
        const afterFailure = await readOutboxRowsForAggregate(link.linkId);
        expect(afterFailure).toHaveLength(1);
        expect(afterFailure[0].event_type).toBe('artifact.linked_to_case');

        // ...and no mutation either: version and revision are untouched. This
        // is what "atomic", rather than "logged after the fact", means.
        const row = await readLinkRow(link.linkId);
        expect(Number(row?.version)).toBe(1);
        expect(row?.artifact_revision).toBe('rev-1');

        // Negative control: disarmed, the very same call succeeds and DOES
        // add exactly one event. Without this, a wiring that never publishes
        // anything would pass the assertions above.
        const pinned = await artifactLinkService.pinArtifactRevision(
          link.linkId,
          'rev-2',
          { actorUserId: actorId },
          'retried'
        );
        expect(pinned.version).toBe(2);
        const afterRetry = await readOutboxRowsForAggregate(link.linkId);
        expect(afterRetry).toHaveLength(2);
        expect(afterRetry[1].event_type).toBe('evidence.pinned');
        expect(afterRetry[1].aggregate_version).toBe(2);
      } finally {
        await teardownCase(orgId, projectId, caseId, [actorId]);
      }
    }, 30_000);
  }
);

// ---------------------------------------------------------------------------
// 6. Structural no-DELETE check — runs UNCONDITIONALLY (no DB needed).
// ---------------------------------------------------------------------------
describe('artifactLinkService — structural no-DELETE guarantee (static source check)', () => {
  const serviceSourcePath = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'artifactLinkService.ts'
  );
  const serviceSource = readFileSync(serviceSourcePath, 'utf8');

  it('contains no SQL DELETE statement against case_workspace_artifact_links anywhere in the file', () => {
    expect(serviceSource).not.toMatch(/DELETE\s+FROM\s+case_workspace_artifact_links/i);
  });

  it('unlinkArtifactFromCase() and markLinkArtifactUnavailable() are UPDATEs to link_status, not DELETEs (CW-RT-025 — unlinking never deletes the artifact link record)', () => {
    expect(serviceSource).toMatch(/SET\s+link_status\s*=\s*'UNLINKED'/i);
    expect(serviceSource).toMatch(/SET\s+link_status\s*=\s*'UNAVAILABLE'/i);
    expect(serviceSource).not.toMatch(/DELETE\s+FROM\s+case_workspace_artifact_links/i);
  });
});
