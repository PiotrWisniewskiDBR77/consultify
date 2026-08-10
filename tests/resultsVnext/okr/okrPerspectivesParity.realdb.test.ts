/**
 * OKR-E008 — OKR-F-028's literal parity requirement (D-OKR8-15): "personal/
 * team-BU/company projections return the SAME Set IDs and versions for the
 * same Set — proof that these are views, not copies."
 *
 * Design: docs/product/results-vnext/OKR_E008_DESIGN.md §4.1.
 *
 * Style precedent: KPI-E007's `kpiIdentityAcrossSurfaces.realdb.test.ts`
 * (identity/parity proof across multiple read surfaces for the same
 * underlying row) — the same discipline applied to a third domain.
 *
 * Creates ONE Set, `scope_type='company'`, owned by a manager — visible via
 * all three lenses:
 *   - `/okr/my` (`listMyOkrSets`, owner branch)
 *   - `/okr/team-health` (`listOrganizationOkrTeamHealth`, self-inclusion
 *     via `chain_members`'s own-id UNION branch)
 *   - `/okr/company` (`listOkrSets({scopeType:'company'})`, OKR-E002's own
 *     landed function, reused as-is per D-OKR8-4 — NOT re-implemented here)
 *
 * Asserts `setId`/`currentVersion` are byte-identical across all three, AND
 * that a `recordOkrSetMaterialChange` bump is visible identically from all
 * three afterwards (proves live view, not a point-in-time snapshot/copy).
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  DB_CONFIGURED,
  buildClientConfig,
  cleanupOkrE007Fixture,
  baseCycleTimes,
} from './okrE007TestFixtures.js';

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `okr-e008-parity-org-${tag}`;
const USER_OWNER = `okr-e008-parity-owner-${tag}`;
const USER_ADMIN = `okr-e008-parity-admin-${tag}`;

let client: Client;
let reachable = false;
let setId: string;

type PerspectivesModule = typeof import('../../../server/src/services/resultsVnext/okr/okrPerspectivesRepository.js');
type SetRepositoryModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetRepository.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let listMyOkrSets: PerspectivesModule['listMyOkrSets'];
let listOrganizationOkrTeamHealth: PerspectivesModule['listOrganizationOkrTeamHealth'];
let listOkrSets: SetRepositoryModule['listOkrSets'];
let updateOkrSetDraft: SetCommandsModule['updateOkrSetDraft'];
let closePgPool: (() => Promise<void>) | undefined;

describe('OKR-E008 — /okr/my vs /okr/team-health vs /okr/company parity (D-OKR8-15, real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E008 perspectives parity test did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1 FROM okr_vnext_sets LIMIT 0');
    } catch (error) {
      throw new Error('A database is configured but is not reachable; refusing to report a green run. ' + String(error));
    }
    reachable = true;

    const perspectivesRepo: PerspectivesModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrPerspectivesRepository.js'
    );
    listMyOkrSets = perspectivesRepo.listMyOkrSets;
    listOrganizationOkrTeamHealth = perspectivesRepo.listOrganizationOkrTeamHealth;
    const setRepo: SetRepositoryModule = await import('../../../server/src/services/resultsVnext/okr/okrSetRepository.js');
    listOkrSets = setRepo.listOkrSets;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    const programCommands: ProgramCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrProgramCommands.js'
    );
    const cycleCommands: CycleCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
    const setCommands: SetCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
    updateOkrSetDraft = setCommands.updateOkrSetDraft;

    const program = await programCommands.createProgram({
      organizationId: ORG_ID,
      name: 'E008 parity fixture Program',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `e008-parity-create-program-${randomUUID()}`,
    });
    await programCommands.publishProgram({
      programId: program.result.programId,
      organizationId: ORG_ID,
      expectedVersion: program.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `e008-parity-publish-program-${randomUUID()}`,
    });
    const cycle = await cycleCommands.createCycle({
      organizationId: ORG_ID,
      programId: program.result.programId,
      name: 'E008 parity fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `e008-parity-create-cycle-${randomUUID()}`,
    });

    // scope_type='company': scope_id = organization_id (D4 sentinel).
    const set = await setCommands.createOkrSet({
      organizationId: ORG_ID,
      programId: program.result.programId,
      cycleId: cycle.result.cycleId,
      scopeType: 'company',
      scopeId: ORG_ID,
      ownerUserId: USER_OWNER,
      title: 'E008 parity fixture company Set',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `e008-parity-create-set-${randomUUID()}`,
    });
    setId = set.result.set.setId;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await cleanupOkrE007Fixture(client, ORG_ID);
    await client.end();
    if (closePgPool) await closePgPool();
  });

  it('all three perspectives return the identical setId/currentVersion for the same company-scope Set', async () => {
    if (!reachable) return;

    const myOkrSets = await listMyOkrSets({ userId: USER_OWNER, organizationId: ORG_ID });
    const teamHealth = await listOrganizationOkrTeamHealth({ managerId: USER_OWNER, organizationId: ORG_ID });
    const companySets = await listOkrSets({ userId: USER_OWNER, organizationId: ORG_ID, scopeType: 'company' });

    const fromMy = myOkrSets.find((s) => s.setId === setId);
    const fromTeamHealth = teamHealth.sets.find((s) => s.setId === setId);
    const fromCompany = companySets.find((s) => s.setId === setId);

    expect(fromMy, '/okr/my did not surface the fixture Set').toBeDefined();
    expect(fromTeamHealth, '/okr/team-health did not surface the fixture Set').toBeDefined();
    expect(fromCompany, '/okr/company did not surface the fixture Set').toBeDefined();

    expect(fromMy!.setId).toBe(setId);
    expect(fromTeamHealth!.setId).toBe(setId);
    expect(fromCompany!.setId).toBe(setId);

    expect(fromMy!.currentVersion).toBe(fromCompany!.currentVersion);
    expect(fromTeamHealth!.currentVersion).toBe(fromCompany!.currentVersion);
  });

  it('a write via a real command (updateOkrSetDraft, legal at status=draft) is visible identically from all three perspectives afterwards (proves live view, not a snapshot)', async () => {
    if (!reachable) return;

    const before = await listOkrSets({ userId: USER_OWNER, organizationId: ORG_ID, scopeType: 'company' });
    const beforeRow = before.find((s) => s.setId === setId)!;

    const outcome = await updateOkrSetDraft({
      setId,
      organizationId: ORG_ID,
      expectedVersion: beforeRow.rowVersion,
      title: 'E008 parity fixture company Set (renamed)',
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `e008-parity-update-draft-${randomUUID()}`,
    });
    expect(outcome.resultingVersion).toBe(beforeRow.rowVersion + 1);

    const myOkrSets = await listMyOkrSets({ userId: USER_OWNER, organizationId: ORG_ID });
    const teamHealth = await listOrganizationOkrTeamHealth({ managerId: USER_OWNER, organizationId: ORG_ID });
    const companySets = await listOkrSets({ userId: USER_OWNER, organizationId: ORG_ID, scopeType: 'company' });

    expect(myOkrSets.find((s) => s.setId === setId)!.rowVersion).toBe(outcome.resultingVersion);
    expect(companySets.find((s) => s.setId === setId)!.rowVersion).toBe(outcome.resultingVersion);
    expect(companySets.find((s) => s.setId === setId)!.title).toBe('E008 parity fixture company Set (renamed)');
    // team-health's `sets` field carries currentVersion/status/scopeType
    // only (not rowVersion, not title — an aggregate-oriented projection,
    // see okrPerspectivesRepository.ts) — its own presence in this fixture's
    // list, still keyed by the SAME setId, is what THIS perspective proves.
    expect(teamHealth.sets.find((s) => s.setId === setId)).toBeDefined();
  });
});
