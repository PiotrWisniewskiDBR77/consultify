/**
 * OKR-E005 — OKR-F-017-AC-01's cross-visibility isolation, against a REAL
 * Postgres: `okrAlignmentRepository.ts` joins the visibility CTE TWICE
 * (once per Objective endpoint, via each Objective's own `set_id` — IO-1
 * divergence note: NOT a nonexistent `'okr_objective'` resource type, see
 * that file's own header) and BOTH endpoints must independently pass for
 * an edge to appear at all — "absent, not redacted"
 * (`04_OKR_IMPLEMENTATION_PLAN.md` §7.4).
 *
 * Design: docs/product/results-vnext/OKR_E005_DESIGN.md §E/§F/§G.
 *
 * `rvn_platform_resource_visibility.resource_id` is TEXT;
 * `okr_vnext_objectives.set_id` is UUID — every join casts `::text`. This
 * exact cast has already been missed 7 times in one KPI epic (this
 * program's single most-repeated real bug) — a dedicated regression test,
 * mirroring `okrSetVisibilityJoin.realdb.test.ts` (E002) and
 * `okrObjectiveVisibilityJoin.realdb.test.ts` (E003)'s own rationale.
 *
 * Break-glass Auditor branch: NOT exercised here — same precedent
 * `okrSetVisibilityJoin.realdb.test.ts` already established (its own
 * `USER_OUTSIDER` comment: "no ACL, no owner, no RBAC override"). Break-glass
 * audit-event emission is not built anywhere in this platform yet
 * (`visibilityScopedQuery.ts`'s own header: "break-glass emission is not
 * built yet, so this branch fails closed"), so there is no real fixture to
 * build against — restated here, not silently worked around.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
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
const ORG_PREFIX = `okr-e005-visjoin-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e005-visjoin-admin-${tag}`;
const USER_OWNER = `okr-e005-visjoin-owner-${tag}`;
const USER_VIEWER = `okr-e005-visjoin-viewer-${tag}`; // no ACL, not the owner, no RBAC override

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ObjectiveCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type AlignmentCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrAlignmentCommands.js');
type AlignmentRepositoryModule = typeof import('../../../server/src/services/resultsVnext/okr/okrAlignmentRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let narrowOkrSetVisibility: SetCommandsModule['narrowOkrSetVisibility'];
let createObjective: ObjectiveCommandsModule['createObjective'];
let proposeAlignment: AlignmentCommandsModule['proposeAlignment'];
let acceptAlignment: AlignmentCommandsModule['acceptAlignment'];
let listAlignmentsForObjective: AlignmentRepositoryModule['listAlignmentsForObjective'];
let getAlignmentTreeUnderObjective: AlignmentRepositoryModule['getAlignmentTreeUnderObjective'];
let closePgPool: (() => Promise<void>) | undefined;

function baseCycleTimes() {
  return {
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    draftOpenAt: '2025-12-15T00:00:00.000Z',
    submissionDueAt: '2025-12-28T00:00:00.000Z',
    activeStartAt: '2026-01-01T00:00:00.000Z',
    finalUpdateDueAt: '2026-03-20T00:00:00.000Z',
    reviewOpenAt: '2026-03-21T00:00:00.000Z',
    reflectionDueAt: '2026-03-25T00:00:00.000Z',
    closeAt: '2026-03-31T00:00:00.000Z',
  };
}

describe('OKR-E005 — Alignment ::text cast + cross-visibility isolation (real Postgres)', () => {
  let organizationId: string;
  let visibleSetId: string;
  let hiddenSetId: string;
  let objVA: string; // visible
  let objVB: string; // visible
  let objHA: string; // hidden (RESTRICTED_ACL, no grant to VIEWER)
  let objHB: string; // hidden
  let objHC: string; // hidden

  let edgeBothVisible: string; // VA -> VB
  let edgeSourceHidden: string; // HA -> VB
  let edgeTargetHidden: string; // VA -> HB
  let edgeBothHidden: string; // HA -> HC

  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR Alignment visibility-join realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_alignments LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR Alignment schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const programCommands: ProgramCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrProgramCommands.js'
    );
    createProgram = programCommands.createProgram;
    publishProgram = programCommands.publishProgram;

    const cycleCommands: CycleCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrCycleCommands.js'
    );
    createCycle = cycleCommands.createCycle;

    const setCommands: SetCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
    createOkrSet = setCommands.createOkrSet;
    narrowOkrSetVisibility = setCommands.narrowOkrSetVisibility;

    const objectiveCommands: ObjectiveCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js'
    );
    createObjective = objectiveCommands.createObjective;

    const alignmentCommands: AlignmentCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrAlignmentCommands.js'
    );
    proposeAlignment = alignmentCommands.proposeAlignment;
    acceptAlignment = alignmentCommands.acceptAlignment;

    const alignmentRepository: AlignmentRepositoryModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrAlignmentRepository.js'
    );
    listAlignmentsForObjective = alignmentRepository.listAlignmentsForObjective;
    getAlignmentTreeUnderObjective = alignmentRepository.getAlignmentTreeUnderObjective;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    if (!reachable) return;

    organizationId = freshOrgId();
    const program = await createProgram({
      organizationId,
      name: 'Alignment-visibility fixture Program',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-program-${randomUUID()}`,
    });
    await publishProgram({
      programId: program.result.programId,
      organizationId,
      expectedVersion: program.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `publish-program-${randomUUID()}`,
    });
    const cycle = await createCycle({
      organizationId,
      programId: program.result.programId,
      name: 'Alignment-visibility fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-${randomUUID()}`,
    });

    // Set #1: default OPEN_ORG visibility (createOkrSet's own default,
    // per the org's active domain='okr' policy — publishProgram's own P3).
    const visibleSet = await createOkrSet({
      organizationId,
      programId: program.result.programId,
      cycleId: cycle.result.cycleId,
      scopeType: 'company',
      scopeId: organizationId,
      ownerUserId: USER_OWNER,
      title: 'Alignment-visibility fixture Set (visible)',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-set-visible-${randomUUID()}`,
    });
    visibleSetId = visibleSet.result.set.setId;

    // Set #2: narrowed to RESTRICTED_ACL, no ACL grant to USER_VIEWER
    // (only USER_OWNER, via createOkrSet's own owner-grant, can see it).
    const hiddenSet = await createOkrSet({
      organizationId,
      programId: program.result.programId,
      cycleId: cycle.result.cycleId,
      scopeType: 'individual',
      scopeId: USER_OWNER,
      ownerUserId: USER_OWNER,
      title: 'Alignment-visibility fixture Set (hidden)',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-set-hidden-${randomUUID()}`,
    });
    hiddenSetId = hiddenSet.result.set.setId;
    await narrowOkrSetVisibility({
      setId: hiddenSetId,
      organizationId,
      expectedVersion: hiddenSet.result.set.rowVersion,
      visibilityMode: 'RESTRICTED_ACL',
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `narrow-hidden-set-${randomUUID()}`,
    });

    async function makeObjective(setId: string, title: string): Promise<string> {
      const objective = await createObjective({
        setId,
        organizationId,
        ownerUserId: USER_OWNER,
        title,
        createdBy: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `create-obj-${randomUUID()}`,
      });
      return objective.result.objectiveId;
    }

    objVA = await makeObjective(visibleSetId, 'VA (visible)');
    objVB = await makeObjective(visibleSetId, 'VB (visible)');
    objHA = await makeObjective(hiddenSetId, 'HA (hidden)');
    objHB = await makeObjective(hiddenSetId, 'HB (hidden)');
    objHC = await makeObjective(hiddenSetId, 'HC (hidden)');

    // USER_OWNER proposes+accepts every edge — the OWNER themselves always
    // has visibility into both Sets (their own ACL 'contribute' grant, via
    // createOkrSet's own owner-grant), so propose-time visibility checks
    // never block fixture setup here; the isolation under test is purely
    // about what USER_VIEWER (a third party) sees on READ.
    async function proposeAndAccept(sourceObjectiveId: string, targetObjectiveId: string): Promise<string> {
      const propose = await proposeAlignment({
        organizationId,
        sourceObjectiveId,
        targetObjectiveId,
        proposedBy: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `propose-${randomUUID()}`,
      });
      await acceptAlignment({
        alignmentId: propose.result.alignment.alignmentId,
        organizationId,
        expectedVersion: propose.result.alignment.rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `accept-${randomUUID()}`,
      });
      return propose.result.alignment.alignmentId;
    }

    edgeBothVisible = await proposeAndAccept(objVA, objVB);
    edgeSourceHidden = await proposeAndAccept(objHA, objVB);
    edgeTargetHidden = await proposeAndAccept(objVA, objHB);
    edgeBothHidden = await proposeAndAccept(objHA, objHC);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    const orgLike = `${ORG_PREFIX}%`;
    await client.query(`DELETE FROM okr_vnext_alignments WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_objectives WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(
      `DELETE FROM rvn_platform_resource_acl WHERE resource_id IN (SELECT set_id::text FROM okr_vnext_sets WHERE organization_id LIKE $1)`,
      [orgLike]
    );
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id LIKE $1 AND resource_type = 'okr_set'`, [
      orgLike,
    ]);
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_sets WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_cycles WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`UPDATE okr_vnext_programs SET active_policy_version_id = NULL WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_program_policy_versions WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_programs WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id LIKE $1)`,
      [orgLike]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id LIKE $1`, [orgLike]);
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

  itDB('both-visible: VIEWER sees the VA -> VB edge via listAlignmentsForObjective (outgoing from VA, incoming to VB)', async () => {
    const outgoing = await listAlignmentsForObjective({
      userId: USER_VIEWER,
      organizationId,
      objectiveId: objVA,
      direction: 'outgoing',
    });
    expect(outgoing.map((a) => a.alignmentId)).toContain(edgeBothVisible);

    const incoming = await listAlignmentsForObjective({
      userId: USER_VIEWER,
      organizationId,
      objectiveId: objVB,
      direction: 'incoming',
    });
    expect(incoming.map((a) => a.alignmentId)).toContain(edgeBothVisible);
  });

  itDB('source-hidden: VIEWER does NOT see the HA -> VB edge from either endpoint — absent, not redacted', async () => {
    const incoming = await listAlignmentsForObjective({
      userId: USER_VIEWER,
      organizationId,
      objectiveId: objVB,
      direction: 'incoming',
    });
    expect(incoming.map((a) => a.alignmentId)).not.toContain(edgeSourceHidden);

    // Querying FROM the hidden root itself also returns nothing (HA is not
    // visible to VIEWER at all).
    const outgoingFromHidden = await listAlignmentsForObjective({
      userId: USER_VIEWER,
      organizationId,
      objectiveId: objHA,
      direction: 'outgoing',
    });
    expect(outgoingFromHidden).toEqual([]);
  });

  itDB('target-hidden: VIEWER does NOT see the VA -> HB edge from either endpoint — absent, not redacted', async () => {
    const outgoing = await listAlignmentsForObjective({
      userId: USER_VIEWER,
      organizationId,
      objectiveId: objVA,
      direction: 'outgoing',
    });
    expect(outgoing.map((a) => a.alignmentId)).not.toContain(edgeTargetHidden);

    const incomingToHidden = await listAlignmentsForObjective({
      userId: USER_VIEWER,
      organizationId,
      objectiveId: objHB,
      direction: 'incoming',
    });
    expect(incomingToHidden).toEqual([]);
  });

  itDB('both-hidden: VIEWER sees nothing for the HA -> HC edge', async () => {
    const outgoingFromHidden = await listAlignmentsForObjective({
      userId: USER_VIEWER,
      organizationId,
      objectiveId: objHA,
      direction: 'outgoing',
    });
    expect(outgoingFromHidden.map((a) => a.alignmentId)).not.toContain(edgeBothHidden);
  });

  itDB('the OWNER themselves (who has visibility into both Sets) sees ALL four edges via listAlignmentsForObjective', async () => {
    const outgoingFromVA = await listAlignmentsForObjective({
      userId: USER_OWNER,
      organizationId,
      objectiveId: objVA,
      direction: 'outgoing',
    });
    expect(outgoingFromVA.map((a) => a.alignmentId).sort()).toEqual([edgeBothVisible, edgeTargetHidden].sort());

    const outgoingFromHA = await listAlignmentsForObjective({
      userId: USER_OWNER,
      organizationId,
      objectiveId: objHA,
      direction: 'outgoing',
    });
    expect(outgoingFromHA.map((a) => a.alignmentId).sort()).toEqual([edgeSourceHidden, edgeBothHidden].sort());
  });

  itDB(
    'getAlignmentTreeUnderObjective: VIEWER walking up from VB sees only the both-visible edge — the walk STOPS at the hidden HA node, it does not skip past it',
    async () => {
      const nodes = await getAlignmentTreeUnderObjective({ userId: USER_VIEWER, organizationId, rootObjectiveId: objVB });
      expect(nodes.map((n) => n.alignment.alignmentId)).toEqual([edgeBothVisible]);
    }
  );

  itDB('getAlignmentTreeUnderObjective: OWNER walking up from VB sees both the visible AND hidden contributing edges', async () => {
    const nodes = await getAlignmentTreeUnderObjective({ userId: USER_OWNER, organizationId, rootObjectiveId: objVB });
    expect(nodes.map((n) => n.alignment.alignmentId).sort()).toEqual([edgeBothVisible, edgeSourceHidden].sort());
  });

  itDB(
    'direct proof: the double visibility-join predicate is TEXT=TEXT (::text cast present) — removing it would compare TEXT against UUID and fail to plan/execute',
    async () => {
      // okr_vnext_objectives.set_id is UUID; rvn_platform_resource_visibility.resource_id
      // is TEXT. A join predicate WITHOUT the cast is a type mismatch
      // Postgres rejects outright — proving the repository's actual
      // queries (already exercised by every test above returning
      // non-empty/correctly-filtered results) MUST be using the cast.
      await expect(
        client.query(
          `SELECT o.objective_id
             FROM okr_vnext_objectives o
             JOIN rvn_platform_resource_visibility rv
               ON rv.resource_type = 'okr_set' AND rv.resource_id = o.set_id
            WHERE o.objective_id = $1`,
          [objVA]
        )
      ).rejects.toThrow(/operator does not exist|cannot be matched/i);

      const casted = await client.query(
        `SELECT o.objective_id
           FROM okr_vnext_objectives o
           JOIN rvn_platform_resource_visibility rv
             ON rv.resource_type = 'okr_set' AND rv.resource_id = o.set_id::text
          WHERE o.objective_id = $1`,
        [objVA]
      );
      expect(casted.rowCount).toBe(1);
    }
  );

  itDB('a caller in the WRONG organization sees nothing at all (universal negative case)', async () => {
    const outgoing = await listAlignmentsForObjective({
      userId: USER_VIEWER,
      organizationId: `${organizationId}-does-not-exist`,
      objectiveId: objVA,
      direction: 'outgoing',
    });
    expect(outgoing).toEqual([]);
  });
});
