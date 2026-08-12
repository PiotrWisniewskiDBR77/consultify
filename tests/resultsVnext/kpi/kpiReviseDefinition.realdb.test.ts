/**
 * RN_G6_P0A — `reviseDefinition` coverage against a REAL Postgres.
 *
 * Contract: docs/product/results-vnext/RN_G6_P0A_KPI_REVISION_CONTRACT.md §5
 * ("Testy obowiązkowe", 18 numbered points). This file implements every one
 * of them, numbered to match the contract 1:1 (`// [N]` comments below).
 *
 * Drives the REAL command layer end to end (`createKpiDraft` ->
 * `submitDefinition` -> `rejectDefinitionVersion` -> `reviseDefinition` ->
 * `editDraft` -> `submitDefinition` -> `approveDefinitionVersion`) — never a
 * mock, never a hand-inserted "already rejected" row for the happy path
 * (points 1-11), so the whole lifecycle this defect broke is proven
 * end-to-end through the same code path a real HTTP request would take
 * (`kpi.routes.ts` is a thin pass-through over these exact functions).
 *
 * SKIP POLICY (same convention as
 * tests/resultsVnext/kpi/deviationCaseIdempotency.realdb.test.ts): if no
 * database is configured (no DATABASE_URL/DB_HOST), every scenario below is
 * a silent no-op and this file reports green — that is expected in
 * environments without a Postgres available and is NOT evidence the
 * behavior works. If a database IS configured but unreachable, `beforeAll`
 * throws so this run is never silently green.
 *
 * HOW TO RUN FOR REAL: point DATABASE_URL (or DB_HOST/DB_PORT/DB_NAME/
 * DB_USER/DB_PASSWORD) at a Postgres 16/17 that already has the full
 * `rvn_platform_*`/`rvn_kpi_*` schema applied (server/migrations/
 * 20260809_rvn_platform_*.sql, 20260810_rvn_kpi_core.sql) before importing
 * this file — env vars are read once, at `server/src/config/DatabaseConfig.ts`'s
 * module-load time, so they must be set before ANY transitive import of it.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function buildClientConfig(): ClientConfig | null {
  const raw = process.env.DATABASE_URL;
  const url = typeof raw === 'string' && raw.trim() && !raw.includes('${{') ? raw.trim() : null;
  if (url) {
    return { connectionString: url, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `kpi-p0a-it-org-${tag}`;
const OTHER_ORG_ID = `kpi-p0a-it-other-org-${tag}`;
const OWNER = `kpi-p0a-it-owner-${tag}`;
const REVIEWER = `kpi-p0a-it-reviewer-${tag}`;
const OUTSIDER = `kpi-p0a-it-outsider-${tag}`; // no capability, no ownership relation

let client: Client;
let reachable = false;

type CommandsModule = typeof import('../../../server/src/services/resultsVnext/kpi/kpiDefinitionCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');
type AtomicWriteModule = typeof import('../../../server/src/services/resultsVnext/platform/atomicWrite.js');
type CapabilityGuardModule =
  typeof import('../../../server/src/services/resultsVnext/platform/commandCapabilityGuard.js');

let createKpiDraft: CommandsModule['createKpiDraft'];
let submitDefinition: CommandsModule['submitDefinition'];
let rejectDefinitionVersion: CommandsModule['rejectDefinitionVersion'];
let approveDefinitionVersion: CommandsModule['approveDefinitionVersion'];
let editDraft: CommandsModule['editDraft'];
let reviseDefinition: CommandsModule['reviseDefinition'];
let SelfApprovalDeniedError: CommandsModule['SelfApprovalDeniedError'];
let KpiDefinitionValidationError: CommandsModule['KpiDefinitionValidationError'];
let AtomicWriteConflictError: AtomicWriteModule['AtomicWriteConflictError'];
let AtomicWriteAggregateNotFoundError: AtomicWriteModule['AtomicWriteAggregateNotFoundError'];
let CommandCapabilityDeniedError: CapabilityGuardModule['CommandCapabilityDeniedError'];
let closePgPool: (() => Promise<void>) | undefined;

// Full RBAC (owner/reviewer act with the platform wildcard — this suite is
// about reviseDefinition's OWN domain contract, not the RN-G5 capability
// catalog) — same convention `approveDefinitionVersion.test.ts` uses.
const FULL_ACCESS = { capabilities: ['*'], platformRole: null } as const;
// No wildcard, no baseline grant — used for the "unauthorized actor" case
// (point 12). `evaluateCommandAccess` still ALLOWs via `responsibleUserIds`
// for the owner/creator themselves even with this access object, which is
// exactly why point 12 uses OUTSIDER (neither owner nor created_by) rather
// than OWNER with this access value.
const NO_ACCESS = { capabilities: [], platformRole: null } as const;

async function insertVisibilityPolicy(organizationId: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, 'kpi', 1, 'OPEN_ORG', true, $2)`,
    [organizationId, OWNER]
  );
}

let kpiCodeSeq = 0;
function nextKpiCode(): string {
  kpiCodeSeq += 1;
  return `P0A-${tag}-${kpiCodeSeq}`;
}

/** Drives the real command layer through create -> submit -> reject, ending
 * with exactly one REJECTED version — the starting point every scenario
 * below needs. Returns the rejected version's DTO (defines `expectedVersion`
 * for `reviseDefinition`) and the KPI id. */
async function buildRejectedFixture(organizationId = ORG_ID): Promise<{
  kpiId: string;
  rejected: Awaited<ReturnType<typeof createKpiDraft>>['result']['definitionVersion'];
}> {
  const created = await createKpiDraft({
    organizationId,
    kpiCode: nextKpiCode(),
    name: 'Wskaźnik dostępności linii A',
    description: 'Pierwotny opis KPI.',
    unit: '%',
    targetGeometry: 'threshold_min',
    targetValue: 95,
    warningLow: 90,
    criticalLow: 80,
    ownerUserId: OWNER,
    createdBy: OWNER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `create-${randomUUID()}`,
    access: FULL_ACCESS,
  });
  expect(created.outcome).toBe('applied');
  const kpiId = created.result.kpi.kpiId;
  const v1 = created.result.definitionVersion;

  const submitted = await submitDefinition({
    definitionVersionId: v1.definitionVersionId,
    organizationId,
    expectedVersion: v1.rowVersion,
    actorUserId: OWNER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `submit-${randomUUID()}`,
    access: FULL_ACCESS,
  });
  expect(submitted.outcome).toBe('applied');

  const rejected = await rejectDefinitionVersion({
    definitionVersionId: v1.definitionVersionId,
    organizationId,
    expectedVersion: submitted.result.rowVersion,
    rejectedBy: REVIEWER,
    rejectionReason: 'Wartość progowa zbyt wysoka — do przeliczenia z operacjami.',
    actorEffectiveRole: 'consultant',
    idempotencyKey: `reject-${randomUUID()}`,
    access: FULL_ACCESS,
  });
  expect(rejected.outcome).toBe('applied');
  expect(rejected.result.approvalStatus).toBe('rejected');

  return { kpiId, rejected: rejected.result };
}

describe('RN_G6_P0A — reviseDefinition (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — RN_G6_P0A reviseDefinition tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_kpi_definition_versions LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the KPI schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    await insertVisibilityPolicy(ORG_ID);
    await insertVisibilityPolicy(OTHER_ORG_ID);

    const commands: CommandsModule = await import(
      '../../../server/src/services/resultsVnext/kpi/kpiDefinitionCommands.js'
    );
    createKpiDraft = commands.createKpiDraft;
    submitDefinition = commands.submitDefinition;
    rejectDefinitionVersion = commands.rejectDefinitionVersion;
    approveDefinitionVersion = commands.approveDefinitionVersion;
    editDraft = commands.editDraft;
    reviseDefinition = commands.reviseDefinition;
    SelfApprovalDeniedError = commands.SelfApprovalDeniedError;
    KpiDefinitionValidationError = commands.KpiDefinitionValidationError;

    const atomicWrite: AtomicWriteModule = await import(
      '../../../server/src/services/resultsVnext/platform/atomicWrite.js'
    );
    AtomicWriteConflictError = atomicWrite.AtomicWriteConflictError;
    AtomicWriteAggregateNotFoundError = atomicWrite.AtomicWriteAggregateNotFoundError;

    const guard: CapabilityGuardModule = await import(
      '../../../server/src/services/resultsVnext/platform/commandCapabilityGuard.js'
    );
    CommandCapabilityDeniedError = guard.CommandCapabilityDeniedError;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    for (const org of [ORG_ID, OTHER_ORG_ID]) {
      await client.query(`DELETE FROM rvn_platform_outbox WHERE event_id IN (
                            SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`, [org]);
      await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [org]);
      await client.query(
        `UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1`,
        [org]
      );
      await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1`, [org]);
      await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [org]);
      await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = $1`, [org]);
      await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [org]);
    }
    await client.end();
    if (closePgPool) await closePgPool();
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

  // ==========================================================
  // [1]-[11] — the full happy-path lifecycle, one KPI, driven end to end.
  // ==========================================================
  itDB(
    '[1-11] full lifecycle: v1 rejected -> revise -> v2 edited -> submitted -> approved; v1 stays byte-identical; registry/history show correct states',
    async () => {
      // [1] utworzenie KPI + wersji 1 · [2] zgłoszenie wersji 1 · [3] odrzucenie wersji 1.
      const { kpiId, rejected: v1 } = await buildRejectedFixture();

      // Full raw-row snapshot of v1 taken immediately after rejection — the
      // baseline for [9]'s byte-identical comparison.
      const v1RowBeforeRevise = (
        await client.query(`SELECT * FROM rvn_kpi_definition_versions WHERE definition_version_id = $1`, [
          v1.definitionVersionId,
        ])
      ).rows[0];
      expect(v1RowBeforeRevise).toBeTruthy();

      const versionCountBefore = Number(
        (
          await client.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM rvn_kpi_definition_versions WHERE kpi_id = $1`,
            [kpiId]
          )
        ).rows[0]?.count ?? '0'
      );
      expect(versionCountBefore).toBe(1);

      // [4] właściciel tworzy wersję 2 — INSERT, nie UPDATE.
      const revised = await reviseDefinition({
        definitionVersionId: v1.definitionVersionId,
        organizationId: ORG_ID,
        expectedVersion: v1.rowVersion,
        actorUserId: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `revise-${randomUUID()}`,
        access: FULL_ACCESS,
      });
      expect(revised.outcome).toBe('applied');
      const v2 = revised.result;
      expect(v2.definitionVersionId).not.toBe(v1.definitionVersionId);
      expect(v2.versionNumber).toBe(2);
      expect(v2.approvalStatus).toBe('draft');

      const versionCountAfterRevise = Number(
        (
          await client.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM rvn_kpi_definition_versions WHERE kpi_id = $1`,
            [kpiId]
          )
        ).rows[0]?.count ?? '0'
      );
      expect(versionCountAfterRevise).toBe(2); // exactly one new row — an INSERT, not an in-place UPDATE.

      // [5] wersja 2 ma pola skopiowane z wersji 1.
      expect(v2.name).toBe(v1.name);
      expect(v2.description).toBe(v1.description);
      expect(v2.unit).toBe(v1.unit);
      expect(v2.targetGeometry).toBe(v1.targetGeometry);
      expect(v2.targetValue).toBe(v1.targetValue);
      expect(v2.warningLow).toBe(v1.warningLow);
      expect(v2.criticalLow).toBe(v1.criticalLow);
      expect(v2.binarySuccessValue).toBe(v1.binarySuccessValue);
      // Audit trail reset, not copied.
      expect(v2.createdBy).toBe(OWNER);
      expect(v2.submittedBy).toBeNull();
      expect(v2.approvedBy).toBeNull();
      expect(v2.rejectedBy).toBeNull();
      expect(v2.rejectedAt).toBeNull();
      expect(v2.rejectionReason).toBeNull();
      expect(v2.rowVersion).toBe(1);

      // [6] właściciel edytuje wersję 2 (normal editDraft — proves the new
      // version is a REAL, actionable draft, not a locked artifact).
      const edited = await editDraft({
        definitionVersionId: v2.definitionVersionId,
        organizationId: ORG_ID,
        expectedVersion: v2.rowVersion,
        targetValue: 88,
        reason: 'Obniżono próg po konsultacji z operacjami.',
        actorUserId: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `edit-${randomUUID()}`,
        access: FULL_ACCESS,
      });
      expect(edited.outcome).toBe('applied');
      expect(edited.result.targetValue).toBe(88);

      // [7] właściciel zgłasza wersję 2.
      const submittedV2 = await submitDefinition({
        definitionVersionId: v2.definitionVersionId,
        organizationId: ORG_ID,
        expectedVersion: edited.result.rowVersion,
        actorUserId: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `submit2-${randomUUID()}`,
        access: FULL_ACCESS,
      });
      expect(submittedV2.outcome).toBe('applied');
      expect(submittedV2.result.approvalStatus).toBe('submitted');

      // [8] recenzent zatwierdza wersję 2 (REVIEWER — distinct from OWNER,
      // who both created AND submitted v2 — maker-checker still applies,
      // see [14] below for the denial case).
      const approvedV2 = await approveDefinitionVersion({
        definitionVersionId: v2.definitionVersionId,
        organizationId: ORG_ID,
        expectedVersion: submittedV2.result.rowVersion,
        approverId: REVIEWER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `approve2-${randomUUID()}`,
        access: FULL_ACCESS,
      });
      expect(approvedV2.outcome).toBe('applied');

      // [10] wersja 2 approved.
      expect(approvedV2.result.approvalStatus).toBe('approved');

      // [9] wersja 1 nadal 'rejected' i BAJTOWO niezmieniona — full-row
      // comparison, not just the status column, taken AFTER every
      // subsequent write (edit/submit/approve of v2) to prove none of them
      // touched v1 either.
      const v1RowAfter = (
        await client.query(`SELECT * FROM rvn_kpi_definition_versions WHERE definition_version_id = $1`, [
          v1.definitionVersionId,
        ])
      ).rows[0];
      expect(v1RowAfter).toEqual(v1RowBeforeRevise);
      expect(v1RowAfter.approval_status).toBe('rejected');

      // [11] rejestr/szczegóły/historia pokazują poprawne stany.
      const history = await client.query<{ version_number: number; approval_status: string }>(
        `SELECT version_number, approval_status FROM rvn_kpi_definition_versions
          WHERE kpi_id = $1 ORDER BY version_number ASC`,
        [kpiId]
      );
      expect(history.rows).toEqual([
        { version_number: 1, approval_status: 'rejected' },
        { version_number: 2, approval_status: 'approved' },
      ]);
      const rootRow = (
        await client.query<{ current_definition_version_id: string }>(
          `SELECT current_definition_version_id FROM rvn_kpi_definitions WHERE kpi_id = $1`,
          [kpiId]
        )
      ).rows[0];
      // current_definition_version_id — cited plik:linia in the report —
      // follows the version reviseDefinition/createKpiDraft just produced
      // (createKpiDraft: kpiDefinitionCommands.ts:413-418), then
      // approveDefinitionVersion re-points it to whichever version was
      // actually approved (same code path both times here: v2).
      expect(rootRow?.current_definition_version_id).toBe(v2.definitionVersionId);
    }
  );

  // ==========================================================
  // [12] aktor bez uprawnień NIE tworzy wersji 2 — 403, generyczny powód.
  // ==========================================================
  itDB('[12] an actor with no capability and no ownership relation is denied (403, generic)', async () => {
    const { kpiId, rejected: v1 } = await buildRejectedFixture();

    await expect(
      reviseDefinition({
        definitionVersionId: v1.definitionVersionId,
        organizationId: ORG_ID,
        expectedVersion: v1.rowVersion,
        actorUserId: OUTSIDER,
        actorEffectiveRole: 'member',
        idempotencyKey: `revise-denied-${randomUUID()}`,
        access: NO_ACCESS,
      })
    ).rejects.toBeInstanceOf(CommandCapabilityDeniedError);

    // No version 2 was created — the denial happened before any write.
    const count = Number(
      (
        await client.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM rvn_kpi_definition_versions WHERE kpi_id = $1`,
          [kpiId]
        )
      ).rows[0]?.count ?? '0'
    );
    expect(count).toBe(1);
  });

  // ==========================================================
  // [13] aktor z innej organizacji nie dostaje niczego.
  // ==========================================================
  itDB('[13] an actor scoped to a DIFFERENT organizationId gets nothing (not found, not a leak)', async () => {
    const { kpiId, rejected: v1 } = await buildRejectedFixture(ORG_ID);

    await expect(
      reviseDefinition({
        definitionVersionId: v1.definitionVersionId,
        // Same version id, WRONG org — loadDefinitionVersionForUpdate scopes
        // by (definitionVersionId, organizationId) together, so this must
        // behave exactly like the version does not exist, never leak its
        // rejected content across the tenant boundary.
        organizationId: OTHER_ORG_ID,
        expectedVersion: v1.rowVersion,
        actorUserId: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `revise-wrong-org-${randomUUID()}`,
        access: FULL_ACCESS,
      })
    ).rejects.toBeInstanceOf(AtomicWriteAggregateNotFoundError);

    // Every row for this kpiId is still scoped to ORG_ID — nothing was
    // written under OTHER_ORG_ID.
    const rows = await client.query<{ organization_id: string }>(
      `SELECT organization_id FROM rvn_kpi_definition_versions WHERE kpi_id = $1`,
      [kpiId]
    );
    expect(rows.rows.length).toBeGreaterThan(0);
    for (const row of rows.rows) {
      expect(row.organization_id).toBe(ORG_ID);
    }
    const otherOrgCount = Number(
      (
        await client.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM rvn_kpi_definition_versions WHERE organization_id = $1`,
          [OTHER_ORG_ID]
        )
      ).rows[0]?.count ?? '0'
    );
    expect(otherOrgCount).toBe(0);
  });

  // ==========================================================
  // Bonus (contract §3 point 3, not separately numbered in the 18-item
  // list): a stale `expectedVersion` against the REJECTED version yields the
  // ORDINARY typed conflict every other command in this file already
  // throws — not a bespoke new error type.
  // ==========================================================
  itDB('[bonus §3.3] a stale expectedVersion on the rejected version is the ordinary STALE_VERSION conflict', async () => {
    const { rejected: v1 } = await buildRejectedFixture();

    await expect(
      reviseDefinition({
        definitionVersionId: v1.definitionVersionId,
        organizationId: ORG_ID,
        expectedVersion: v1.rowVersion + 41, // deliberately wrong.
        actorUserId: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `revise-stale-${randomUUID()}`,
        access: FULL_ACCESS,
      })
    ).rejects.toBeInstanceOf(AtomicWriteConflictError);

    let caught: unknown;
    try {
      await reviseDefinition({
        definitionVersionId: v1.definitionVersionId,
        organizationId: ORG_ID,
        expectedVersion: v1.rowVersion + 41,
        actorUserId: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `revise-stale-2-${randomUUID()}`,
        access: FULL_ACCESS,
      });
    } catch (err) {
      caught = err;
    }
    expect((caught as InstanceType<typeof AtomicWriteConflictError>).code).toBe('STALE_VERSION');
  });

  // ==========================================================
  // [14] samo-zatwierdzenie wersji 2 nadal zabronione.
  // ==========================================================
  itDB('[14] self-approval of the REVISED version 2 is still denied (maker-checker applies to v2 too)', async () => {
    const { rejected: v1 } = await buildRejectedFixture();
    const revised = await reviseDefinition({
      definitionVersionId: v1.definitionVersionId,
      organizationId: ORG_ID,
      expectedVersion: v1.rowVersion,
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `revise-selfcheck-${randomUUID()}`,
      access: FULL_ACCESS,
    });
    const v2 = revised.result;
    const submitted = await submitDefinition({
      definitionVersionId: v2.definitionVersionId,
      organizationId: ORG_ID,
      expectedVersion: v2.rowVersion,
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `submit-selfcheck-${randomUUID()}`,
      access: FULL_ACCESS,
    });

    // OWNER created AND submitted v2 — approving it themselves must be denied.
    await expect(
      approveDefinitionVersion({
        definitionVersionId: v2.definitionVersionId,
        organizationId: ORG_ID,
        expectedVersion: submitted.result.rowVersion,
        approverId: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `approve-selfcheck-${randomUUID()}`,
        access: FULL_ACCESS,
      })
    ).rejects.toBeInstanceOf(SelfApprovalDeniedError);

    const stillSubmitted = await client.query<{ approval_status: string }>(
      `SELECT approval_status FROM rvn_kpi_definition_versions WHERE definition_version_id = $1`,
      [v2.definitionVersionId]
    );
    expect(stillSubmitted.rows[0]?.approval_status).toBe('submitted');
  });

  // ==========================================================
  // [15] próba reviseDefinition na wersji approved / draft / submitted —
  // odmowa, każda osobno.
  // ==========================================================
  describe('[15] revising a non-rejected version is denied per-status', () => {
    itDB('an APPROVED version -> CANNOT_REVISE_APPROVED', async () => {
      const created = await createKpiDraft({
        organizationId: ORG_ID,
        kpiCode: nextKpiCode(),
        name: 'KPI zatwierdzony',
        targetGeometry: 'threshold_min',
        targetValue: 50,
        ownerUserId: OWNER,
        createdBy: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `create-approved-${randomUUID()}`,
        access: FULL_ACCESS,
      });
      const v1 = created.result.definitionVersion;
      const submitted = await submitDefinition({
        definitionVersionId: v1.definitionVersionId,
        organizationId: ORG_ID,
        expectedVersion: v1.rowVersion,
        actorUserId: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `submit-approved-${randomUUID()}`,
        access: FULL_ACCESS,
      });
      const approved = await approveDefinitionVersion({
        definitionVersionId: v1.definitionVersionId,
        organizationId: ORG_ID,
        expectedVersion: submitted.result.rowVersion,
        approverId: REVIEWER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `approve-approved-${randomUUID()}`,
        access: FULL_ACCESS,
      });

      let caught: unknown;
      try {
        await reviseDefinition({
          definitionVersionId: v1.definitionVersionId,
          organizationId: ORG_ID,
          expectedVersion: approved.result.rowVersion,
          actorUserId: OWNER,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `revise-approved-${randomUUID()}`,
          access: FULL_ACCESS,
        });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(KpiDefinitionValidationError);
      expect((caught as InstanceType<typeof KpiDefinitionValidationError>).code).toBe('CANNOT_REVISE_APPROVED');
    });

    itDB('a DRAFT version -> CANNOT_REVISE_DRAFT', async () => {
      const created = await createKpiDraft({
        organizationId: ORG_ID,
        kpiCode: nextKpiCode(),
        name: 'KPI szkic',
        targetGeometry: 'threshold_min',
        targetValue: 50,
        ownerUserId: OWNER,
        createdBy: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `create-draft-${randomUUID()}`,
        access: FULL_ACCESS,
      });
      const v1 = created.result.definitionVersion;

      let caught: unknown;
      try {
        await reviseDefinition({
          definitionVersionId: v1.definitionVersionId,
          organizationId: ORG_ID,
          expectedVersion: v1.rowVersion,
          actorUserId: OWNER,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `revise-draft-${randomUUID()}`,
          access: FULL_ACCESS,
        });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(KpiDefinitionValidationError);
      expect((caught as InstanceType<typeof KpiDefinitionValidationError>).code).toBe('CANNOT_REVISE_DRAFT');
    });

    itDB('a SUBMITTED version -> CANNOT_REVISE_SUBMITTED', async () => {
      const created = await createKpiDraft({
        organizationId: ORG_ID,
        kpiCode: nextKpiCode(),
        name: 'KPI zgłoszony',
        targetGeometry: 'threshold_min',
        targetValue: 50,
        ownerUserId: OWNER,
        createdBy: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `create-submitted-${randomUUID()}`,
        access: FULL_ACCESS,
      });
      const v1 = created.result.definitionVersion;
      const submitted = await submitDefinition({
        definitionVersionId: v1.definitionVersionId,
        organizationId: ORG_ID,
        expectedVersion: v1.rowVersion,
        actorUserId: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `submit-submitted-${randomUUID()}`,
        access: FULL_ACCESS,
      });

      let caught: unknown;
      try {
        await reviseDefinition({
          definitionVersionId: v1.definitionVersionId,
          organizationId: ORG_ID,
          expectedVersion: submitted.result.rowVersion,
          actorUserId: OWNER,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `revise-submitted-${randomUUID()}`,
          access: FULL_ACCESS,
        });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(KpiDefinitionValidationError);
      expect((caught as InstanceType<typeof KpiDefinitionValidationError>).code).toBe('CANNOT_REVISE_SUBMITTED');
    });
  });

  // ==========================================================
  // [16] podwójne wywołanie z tym samym kluczem idempotencji tworzy JEDNĄ wersję.
  // ==========================================================
  itDB('[16] two calls with the SAME idempotency key create exactly ONE version', async () => {
    const { kpiId, rejected: v1 } = await buildRejectedFixture();
    const idempotencyKey = `revise-idem-${randomUUID()}`;

    const first = await reviseDefinition({
      definitionVersionId: v1.definitionVersionId,
      organizationId: ORG_ID,
      expectedVersion: v1.rowVersion,
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey,
      access: FULL_ACCESS,
    });
    expect(first.outcome).toBe('applied');

    const second = await reviseDefinition({
      definitionVersionId: v1.definitionVersionId,
      organizationId: ORG_ID,
      expectedVersion: v1.rowVersion,
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey, // SAME key — a simulated double-click retry.
      access: FULL_ACCESS,
    });
    expect(second.outcome).toBe('duplicate');
    expect(second.eventId).toBe(first.eventId);

    const count = Number(
      (
        await client.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM rvn_kpi_definition_versions WHERE kpi_id = $1`,
          [kpiId]
        )
      ).rows[0]?.count ?? '0'
    );
    expect(count).toBe(2); // v1 (rejected) + exactly one v2 — never a v3.
  });

  // ==========================================================
  // [17] dwa równoległe wywołania nie łamią UNIQUE (kpi_id, version_number).
  // ==========================================================
  itDB('[17] two CONCURRENT revise calls (different idempotency keys) never collide on version_number', async () => {
    const { kpiId, rejected: v1 } = await buildRejectedFixture();

    // Two genuinely independent "actors" both revising the SAME rejected
    // version at once, different idempotency keys (unlike [16] — this is
    // not a double-click retry, it is two real concurrent callers).
    const [a, b] = await Promise.all([
      reviseDefinition({
        definitionVersionId: v1.definitionVersionId,
        organizationId: ORG_ID,
        expectedVersion: v1.rowVersion,
        actorUserId: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `revise-race-a-${randomUUID()}`,
        access: FULL_ACCESS,
      }),
      reviseDefinition({
        definitionVersionId: v1.definitionVersionId,
        organizationId: ORG_ID,
        expectedVersion: v1.rowVersion,
        actorUserId: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `revise-race-b-${randomUUID()}`,
        access: FULL_ACCESS,
      }),
    ]);

    // Neither call is allowed to throw a raw 23505 unique-violation — the
    // parent-row lock inside reviseDefinition's own applyMutation must
    // serialize the version_number computation.
    expect(a.outcome).toBe('applied');
    expect(b.outcome).toBe('applied');
    expect(a.result.definitionVersionId).not.toBe(b.result.definitionVersionId);

    const numbers = await client.query<{ version_number: number }>(
      `SELECT version_number FROM rvn_kpi_definition_versions WHERE kpi_id = $1 ORDER BY version_number ASC`,
      [kpiId]
    );
    const values = numbers.rows.map((r) => r.version_number);
    expect(values).toEqual([1, 2, 3]); // v1 + two distinct new versions, no gap/duplicate.
    expect(new Set(values).size).toBe(values.length); // UNIQUE (kpi_id, version_number) never violated.
  });

  // ==========================================================
  // [18] zimne otwarcie (świeży klient) zachowuje wynik.
  // ==========================================================
  itDB('[18] a COLD read from a brand-new client connection sees the durably committed result', async () => {
    const { kpiId, rejected: v1 } = await buildRejectedFixture();
    const revised = await reviseDefinition({
      definitionVersionId: v1.definitionVersionId,
      organizationId: ORG_ID,
      expectedVersion: v1.rowVersion,
      actorUserId: OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `revise-cold-${randomUUID()}`,
      access: FULL_ACCESS,
    });
    const v2 = revised.result;

    // A FRESH connection — never touched by this process's writes above —
    // proves the result was actually COMMITTED, not just visible on the
    // same session/transaction.
    const coldClient = new Client(buildClientConfig() as ClientConfig);
    await coldClient.connect();
    try {
      const coldRows = await coldClient.query<{ version_number: number; approval_status: string }>(
        `SELECT version_number, approval_status FROM rvn_kpi_definition_versions
          WHERE kpi_id = $1 ORDER BY version_number ASC`,
        [kpiId]
      );
      expect(coldRows.rows).toEqual([
        { version_number: 1, approval_status: 'rejected' },
        { version_number: 2, approval_status: 'draft' },
      ]);
      const coldRoot = await coldClient.query<{ current_definition_version_id: string }>(
        `SELECT current_definition_version_id FROM rvn_kpi_definitions WHERE kpi_id = $1`,
        [kpiId]
      );
      expect(coldRoot.rows[0]?.current_definition_version_id).toBe(v2.definitionVersionId);
    } finally {
      await coldClient.end();
    }
  });
});
