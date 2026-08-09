/**
 * Case Workspace — Capability Registry service, proved against a REAL
 * PostgreSQL (CW-P03, EPIC E3 "Capability Registry and native module
 * commands"). Exercises
 * server/src/services/caseWorkspace/capabilityRegistryService.ts against the
 * schema in
 * server/migrations/20260809_case_workspace_capability_registry.sql.
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * Same convention as caseCoreService.pg.test.ts (CW-P01) and
 * casePlanVersionService.pg.test.ts (CW-P02): `NODE_ENV=test` ALONE is a
 * trap — `Database.ts`'s `getDatabase()`/`createDatabase()` hand back an
 * in-memory MOCK whenever `RUN_DB_TESTS !== '1'` (or `MOCK_DB` isn't
 * explicitly `'false'`), and every write silently becomes a no-op. This file
 * follows the `*.pg.test.ts` convention: gate on
 * `RUN_DB_TESTS === '1' && MOCK_DB === 'false'`, probe reachability AND that
 * the migrated schema is actually present before deciding, and SKIP LOUDLY
 * (never silently pass) when either is missing.
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/capabilityRegistryService.pg.test.ts
 *
 * ===========================================================================
 * ISOLATION — every test registers its own uniquely-named capability
 * ===========================================================================
 * Unlike caseCoreService/casePlanVersionService, this registry is
 * platform-global (no org_id/case_id FK — see the service's and migration's
 * "Scope/tenancy note"), so there is no org/project/case seed helper here.
 * Each test mints its own random tag and builds capability_id/owner_module
 * values namespaced with that tag, so concurrent/sequential test runs never
 * collide with each other or with rows left by unrelated code. Every test
 * seeds its own fixture inside the test body (never a shared beforeEach) and
 * deletes exactly the rows it created itself in a `finally`
 * (case_workspace_capability_idempotency_keys rows cascade off
 * case_workspace_capabilities via ON DELETE CASCADE, so deleting the
 * capability row is enough to clean up both tables).
 *
 * All assertions read the actual `case_workspace_capabilities`/
 * `case_workspace_capability_idempotency_keys` rows back out of Postgres
 * through a dedicated, out-of-band `pg.Pool` (`control`) — never the service
 * function's return value alone — because the return value only proves what
 * the service THINKS it wrote, not what actually landed.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as capabilityRegistryService from '../capabilityRegistryService.js';
import type {
  CapabilityHealth,
  CapabilityLifecycle,
  RegisterCapabilityInput,
} from '../capabilityRegistryService.js';

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
    const capabilitiesResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_capabilities'
          AND column_name IN ('capability_registry_id', 'capability_id', 'capability_version',
                               'owner_module', 'health', 'health_detail', 'health_checked_at',
                               'lifecycle', 'version')`
    );
    const capabilitiesOk = Number(capabilitiesResult.rows[0]?.present ?? 0) === 9;

    const idempotencyResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_capability_idempotency_keys'
          AND column_name IN ('idempotency_record_id', 'capability_registry_id', 'idempotency_key',
                               'actor_id', 'request_digest')`
    );
    const idempotencyOk = Number(idempotencyResult.rows[0]?.present ?? 0) === 5;

    return capabilitiesOk && idempotencyOk;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[capabilityRegistryService pg suite SKIPPED — this is a clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `20260809_case_workspace_capability_registry.sql migration applied. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

interface CapabilityRegistryDbRow {
  capability_registry_id: string;
  capability_id: string;
  capability_version: string;
  owner_module: string;
  operation: string;
  health: string;
  health_detail: string | null;
  health_checked_at: string | null;
  lifecycle: string;
  version: number;
}

interface IdempotencyKeyDbRow {
  idempotency_record_id: string;
  capability_registry_id: string;
  idempotency_key: string;
  actor_id: string;
  request_digest: string;
  created_at: string;
}

suite('capabilityRegistryService — Capability Registry against a real PostgreSQL (CW-P03, E3)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Fixture helpers — every test calls these itself, never a shared hook.
  // -------------------------------------------------------------------------

  /**
   * A minimal, valid RegisterCapabilityInput namespaced by `tag` so
   * concurrent/sequential tests never collide on (capability_id,
   * capability_version) or owner_module. Every field required by the service
   * (and by the migration's NOT NULL/CHECK constraints) is filled in; callers
   * pass `overrides` for the fields the test itself needs to control.
   */
  function buildRegisterInput(
    tag: string,
    overrides: Partial<RegisterCapabilityInput> = {}
  ): RegisterCapabilityInput {
    return {
      capabilityId: `test.capability.${tag}`,
      capabilityVersion: '1.0.0',
      ownerModule: `test-module-${tag}`,
      providerType: 'INTERNAL',
      operation: `test.operation.${tag}`,
      owningCommandRef: `test.command.${tag}`,
      inputSchemaRef: `schema://test/${tag}/input`,
      outputSchemaRef: `schema://test/${tag}/output`,
      operationClass: 'READ',
      effectClass: 'SAFE_ADDITIVE',
      dataClassification: 'internal',
      idempotencyStrategy: 'none',
      reversibility: 'not_applicable',
      approvalRecommendation: 'auto_executable',
      createdByActorId: `actor-${tag}`,
      ...overrides,
    };
  }

  /**
   * Deletes exactly the capability_registry_id rows this test created.
   * case_workspace_capability_idempotency_keys rows cascade off this via
   * ON DELETE CASCADE, so no separate idempotency-table cleanup is needed.
   */
  async function teardownCapabilities(capabilityRegistryIds: string[]): Promise<void> {
    if (capabilityRegistryIds.length === 0) return;
    await control
      .query(`DELETE FROM case_workspace_capabilities WHERE capability_registry_id = ANY($1)`, [
        capabilityRegistryIds,
      ])
      .catch(() => undefined);
  }

  async function readCapabilityRow(capabilityRegistryId: string): Promise<CapabilityRegistryDbRow | null> {
    const result = await control.query<CapabilityRegistryDbRow>(
      `SELECT * FROM case_workspace_capabilities WHERE capability_registry_id = $1`,
      [capabilityRegistryId]
    );
    return result.rows[0] ?? null;
  }

  // -------------------------------------------------------------------------
  // 1. registerCapability -> retrievable by getCapabilityByRegistryId and by
  //    getCapabilityVersion (CW-GR-015, CW-GR-029, CW-DOD-C1, MIG-016).
  // -------------------------------------------------------------------------
  it('registerCapability creates a row retrievable by getCapabilityByRegistryId and by getCapabilityVersion, both matching data read from Postgres', async () => {
    const tag = randomUUID();
    const capabilityId = `test.capability.lookup.${tag}`;
    const capabilityVersion = '1.0.0';
    const createdIds: string[] = [];
    try {
      const registered = await capabilityRegistryService.registerCapability(
        buildRegisterInput(tag, { capabilityId, capabilityVersion })
      );
      createdIds.push(registered.capabilityRegistryId);
      expect(registered.capabilityId).toBe(capabilityId);
      expect(registered.capabilityVersion).toBe(capabilityVersion);
      expect(registered.version).toBe(1);
      expect(registered.lifecycle).toBe('UNAVAILABLE');
      expect(registered.health).toBe('UNKNOWN');

      const byRegistryId = await capabilityRegistryService.getCapabilityByRegistryId(
        registered.capabilityRegistryId
      );
      expect(byRegistryId).not.toBeNull();
      expect(byRegistryId).toMatchObject({
        capabilityRegistryId: registered.capabilityRegistryId,
        capabilityId,
        capabilityVersion,
        ownerModule: registered.ownerModule,
        operation: registered.operation,
      });

      const byVersion = await capabilityRegistryService.getCapabilityVersion(capabilityId, capabilityVersion);
      expect(byVersion).not.toBeNull();
      expect(byVersion).toMatchObject({
        capabilityRegistryId: registered.capabilityRegistryId,
        capabilityId,
        capabilityVersion,
      });

      // Out-of-band read: what actually landed in Postgres, not just what
      // the service claims.
      const dbRow = await readCapabilityRow(registered.capabilityRegistryId);
      expect(dbRow).not.toBeNull();
      expect(dbRow?.capability_id).toBe(capabilityId);
      expect(dbRow?.capability_version).toBe(capabilityVersion);
      expect(dbRow?.owner_module).toBe(registered.ownerModule);
      expect(dbRow?.operation).toBe(registered.operation);
      expect(Number(dbRow?.version)).toBe(1);
    } finally {
      await teardownCapabilities(createdIds);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 2. Immutability: registering the same (capability_id, capability_version)
  //    pair twice is rejected (CW-DOD-C1, migration's UNIQUE constraint).
  // -------------------------------------------------------------------------
  it('registering the same (capability_id, capability_version) pair twice is rejected: the row count for that pair stays 1 and the original row is untouched', async () => {
    const tag = randomUUID();
    const capabilityId = `test.capability.duplicate.${tag}`;
    const capabilityVersion = '1.0.0';
    const createdIds: string[] = [];
    try {
      const first = await capabilityRegistryService.registerCapability(
        buildRegisterInput(tag, { capabilityId, capabilityVersion, operation: 'op.original' })
      );
      createdIds.push(first.capabilityRegistryId);

      // Second registration attempt for the SAME (capability_id,
      // capability_version) pair, with deliberately different other fields —
      // it must be rejected before it can overwrite anything.
      await expect(
        capabilityRegistryService.registerCapability(
          buildRegisterInput(`${tag}-dup-attempt`, {
            capabilityId,
            capabilityVersion,
            operation: 'op.should-not-land',
            ownerModule: 'owner-should-not-land',
          })
        )
      ).rejects.toThrow(/capability_already_registered/);

      const rows = await control.query<CapabilityRegistryDbRow>(
        `SELECT * FROM case_workspace_capabilities WHERE capability_id = $1 AND capability_version = $2`,
        [capabilityId, capabilityVersion]
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0].capability_registry_id).toBe(first.capabilityRegistryId);
      expect(rows.rows[0].operation).toBe('op.original');
      expect(rows.rows[0].owner_module).toBe(first.ownerModule);
      expect(Number(rows.rows[0].version)).toBe(1);
    } finally {
      await teardownCapabilities(createdIds);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 3. markCapabilityHealth — OCC update of health/health_detail/
  //    health_checked_at only; stale expectedVersion rejected, row unchanged
  //    (CW-GR-015, CW-GR-016, CW-GR-047, CW-RT-044).
  // -------------------------------------------------------------------------
  it('markCapabilityHealth updates health/health_detail/health_checked_at and bumps the OCC version by exactly 1; a stale expectedVersion is rejected and the DB row is unchanged', async () => {
    const tag = randomUUID();
    const createdIds: string[] = [];
    try {
      const registered = await capabilityRegistryService.registerCapability(
        buildRegisterInput(tag, { health: 'UNKNOWN' })
      );
      createdIds.push(registered.capabilityRegistryId);
      expect(registered.health).toBe('UNKNOWN');
      expect(registered.version).toBe(1);

      const updated = await capabilityRegistryService.markCapabilityHealth(
        registered.capabilityRegistryId,
        'HEALTHY',
        { actorUserId: `actor-health-${tag}` },
        'synthetic probe passed',
        1
      );
      expect(updated.health).toBe('HEALTHY');
      expect(updated.healthDetail).toBe('synthetic probe passed');
      expect(updated.healthCheckedAt).toBeTruthy();
      expect(updated.version).toBe(2);

      const rowAfterUpdate = await readCapabilityRow(registered.capabilityRegistryId);
      expect(rowAfterUpdate?.health).toBe('HEALTHY');
      expect(rowAfterUpdate?.health_detail).toBe('synthetic probe passed');
      expect(rowAfterUpdate?.health_checked_at).toBeTruthy();
      expect(Number(rowAfterUpdate?.version)).toBe(2);

      // Stale expectedVersion: the row is now at version=2, but this call
      // still asserts version=1 — must be rejected with no partial write.
      await expect(
        capabilityRegistryService.markCapabilityHealth(
          registered.capabilityRegistryId,
          'DEGRADED',
          { actorUserId: `actor-health-${tag}` },
          'should-not-land',
          1
        )
      ).rejects.toThrow(/capability_version_conflict/);

      const rowAfterRejected = await readCapabilityRow(registered.capabilityRegistryId);
      expect(rowAfterRejected?.health).toBe('HEALTHY');
      expect(rowAfterRejected?.health_detail).toBe('synthetic probe passed');
      expect(rowAfterRejected?.health_checked_at).toBe(rowAfterUpdate?.health_checked_at);
      expect(Number(rowAfterRejected?.version)).toBe(2);
    } finally {
      await teardownCapabilities(createdIds);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 4. listActiveCapabilities — lifecycle='ACTIVE' AND health<>'UNHEALTHY'
  //    only (CW-GR-016 registry-side gate, CW-GR-046, MIG-016).
  // -------------------------------------------------------------------------
  it('listActiveCapabilities only returns rows with lifecycle=ACTIVE AND health<>UNHEALTHY', async () => {
    const tag = randomUUID();
    const ownerModule = `test-owner-active-${tag}`;
    const createdIds: string[] = [];
    try {
      // A: ACTIVE + HEALTHY -> must appear in the list.
      const healthyActive = await capabilityRegistryService.registerCapability(
        buildRegisterInput(`${tag}-healthy`, { ownerModule, lifecycle: 'ACTIVE', health: 'HEALTHY' })
      );
      createdIds.push(healthyActive.capabilityRegistryId);

      // B: registered ACTIVE + HEALTHY, then marked UNHEALTHY -> must be
      // excluded despite lifecycle still being ACTIVE.
      const unhealthyActive = await capabilityRegistryService.registerCapability(
        buildRegisterInput(`${tag}-unhealthy`, { ownerModule, lifecycle: 'ACTIVE', health: 'HEALTHY' })
      );
      createdIds.push(unhealthyActive.capabilityRegistryId);
      const markedUnhealthy = await capabilityRegistryService.markCapabilityHealth(
        unhealthyActive.capabilityRegistryId,
        'UNHEALTHY',
        { actorUserId: `actor-active-${tag}` },
        'synthetic failure',
        unhealthyActive.version
      );
      expect(markedUnhealthy.health).toBe('UNHEALTHY');

      // C: DEPRECATED + HEALTHY -> must be excluded, lifecycle isn't ACTIVE.
      const deprecatedHealthy = await capabilityRegistryService.registerCapability(
        buildRegisterInput(`${tag}-deprecated`, { ownerModule, lifecycle: 'DEPRECATED', health: 'HEALTHY' })
      );
      createdIds.push(deprecatedHealthy.capabilityRegistryId);

      const active = await capabilityRegistryService.listActiveCapabilities({ ownerModule });
      const activeIds = active.map((entry) => entry.capabilityRegistryId);

      expect(activeIds).toContain(healthyActive.capabilityRegistryId);
      expect(activeIds).not.toContain(unhealthyActive.capabilityRegistryId);
      expect(activeIds).not.toContain(deprecatedHealthy.capabilityRegistryId);
      expect(active).toHaveLength(1);
      expect(active.every((entry) => entry.lifecycle === 'ACTIVE' && entry.health !== 'UNHEALTHY')).toBe(true);

      // Cross-check directly against Postgres for the same ownerModule scope.
      const dbRows = await control.query<{ lifecycle: CapabilityLifecycle; health: CapabilityHealth }>(
        `SELECT lifecycle, health FROM case_workspace_capabilities
          WHERE owner_module = $1 AND lifecycle = 'ACTIVE' AND health <> 'UNHEALTHY'`,
        [ownerModule]
      );
      expect(dbRows.rows).toHaveLength(1);
    } finally {
      await teardownCapabilities(createdIds);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 5. recordIdempotencyKeyCheck — first-seen succeeds, mismatched-payload
  //    replay fails closed, matching-payload replay is a safe no-error retry
  //    (CW-GR-019, CW-GR-021, CW-DOD-C3).
  // -------------------------------------------------------------------------
  it('recordIdempotencyKeyCheck: first call succeeds; same key with a different payload is rejected with a conflict; same key with the same payload does not error', async () => {
    const tag = randomUUID();
    const createdIds: string[] = [];
    try {
      const registered = await capabilityRegistryService.registerCapability(buildRegisterInput(tag));
      createdIds.push(registered.capabilityRegistryId);

      const idempotencyKey = `idem-${tag}`;
      const payload = { action: 'do-thing', amount: 42, nested: { ok: true } };
      const actorId = `actor-idem-${tag}`;

      const first = await capabilityRegistryService.recordIdempotencyKeyCheck({
        capabilityRegistryId: registered.capabilityRegistryId,
        idempotencyKey,
        requestPayload: payload,
        actorId,
      });
      expect(first.isDuplicate).toBe(false);
      expect(first.recordedAt).toBeTruthy();

      // Same key, DIFFERENT payload -> rejected, fails closed.
      const differentPayload = { action: 'do-thing', amount: 999, nested: { ok: true } };
      await expect(
        capabilityRegistryService.recordIdempotencyKeyCheck({
          capabilityRegistryId: registered.capabilityRegistryId,
          idempotencyKey,
          requestPayload: differentPayload,
          actorId,
        })
      ).rejects.toThrow(/idempotency_key_conflict/);

      // Same key, SAME payload (even with keys in a different declaration
      // order — computeRequestDigest canonicalizes before hashing) -> safe
      // retry, no error, isDuplicate=true, same recordedAt as the first call.
      const sameShapeDifferentKeyOrder = { nested: { ok: true }, amount: 42, action: 'do-thing' };
      const safeRetry = await capabilityRegistryService.recordIdempotencyKeyCheck({
        capabilityRegistryId: registered.capabilityRegistryId,
        idempotencyKey,
        requestPayload: sameShapeDifferentKeyOrder,
        actorId,
      });
      expect(safeRetry.isDuplicate).toBe(true);
      expect(safeRetry.recordedAt).toBe(first.recordedAt);

      // Out-of-band read: exactly one idempotency row for this key, carrying
      // the digest of the ORIGINAL payload (the conflicting attempt never
      // landed a second row, and the digest was never overwritten).
      const rows = await control.query<IdempotencyKeyDbRow>(
        `SELECT * FROM case_workspace_capability_idempotency_keys
          WHERE capability_registry_id = $1 AND idempotency_key = $2`,
        [registered.capabilityRegistryId, idempotencyKey]
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0].request_digest).toBe(capabilityRegistryService.computeRequestDigest(payload));
      expect(rows.rows[0].actor_id).toBe(actorId);
    } finally {
      await teardownCapabilities(createdIds);
    }
  }, 30_000);
});
