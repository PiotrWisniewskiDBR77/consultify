/**
 * OKR-E008 — Half B (Perspectives), `listMyOkrSets`/`listOrganizationOkrTeamHealth`
 * against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E008_DESIGN.md §4.
 *
 * Reuses OKR-E007's own shared fixture (`okrE007TestFixtures.ts`) for the
 * Program->Cycle->Set->Objective->KeyResult->submit->approve->activate
 * boilerplate, same as every other post-E002 realdb test file in this
 * domain.
 *
 * Two-layer scoping proof mirrors `okrAttentionQueue.realdb.test.ts`'s own
 * (OKR-E006) manager-isolation approach: a manager-owned Set is visible via
 * `chain_members`'s `UNION SELECT $managerId` self-inclusion branch (no
 * `rvn_platform_management_chain_closure` seeding needed to prove that
 * path); a Set owned by a completely unrelated user with no chain
 * relationship proves isolation (T3 non-leak).
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  DB_CONFIGURED,
  buildClientConfig,
  buildActiveOkrSetFixture,
  cleanupOkrE007Fixture,
  type OkrE007Fixture,
} from './okrE007TestFixtures.js';

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `okr-e008-perspectives-org-${tag}`;
const USER_OWNER = `okr-e008-perspectives-owner-${tag}`;
const USER_REVIEWER = `okr-e008-perspectives-reviewer-${tag}`;
const USER_ADMIN = `okr-e008-perspectives-admin-${tag}`;
const USER_UNRELATED_MANAGER = `okr-e008-perspectives-unrelated-mgr-${tag}`;

let client: Client;
let reachable = false;
let fixture: OkrE007Fixture;

type PerspectivesModule = typeof import('../../../server/src/services/resultsVnext/okr/okrPerspectivesRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let listMyOkrSets: PerspectivesModule['listMyOkrSets'];
let listOrganizationOkrTeamHealth: PerspectivesModule['listOrganizationOkrTeamHealth'];
let closePgPool: (() => Promise<void>) | undefined;

describe('OKR-E008 Perspectives — listMyOkrSets / listOrganizationOkrTeamHealth (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E008 perspectives tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1 FROM okr_vnext_sets LIMIT 0');
    } catch (error) {
      throw new Error('A database is configured but is not reachable (or missing the OKR schema); refusing to report a green run. ' + String(error));
    }
    reachable = true;

    const perspectivesRepo: PerspectivesModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrPerspectivesRepository.js'
    );
    listMyOkrSets = perspectivesRepo.listMyOkrSets;
    listOrganizationOkrTeamHealth = perspectivesRepo.listOrganizationOkrTeamHealth;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    fixture = await buildActiveOkrSetFixture({
      organizationId: ORG_ID,
      adminUserId: USER_ADMIN,
      ownerUserId: USER_OWNER,
      reviewerUserId: USER_REVIEWER,
    });
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await cleanupOkrE007Fixture(client, ORG_ID);
    await client.end();
    if (closePgPool) await closePgPool();
  });

  it('listMyOkrSets returns the Set for its owner', async () => {
    if (!reachable) return;
    const sets = await listMyOkrSets({ userId: USER_OWNER, organizationId: ORG_ID });
    expect(sets.some((s) => s.setId === fixture.setId)).toBe(true);
  });

  it('listMyOkrSets returns the Set for its reviewer (D-OKR8-12: owner OR reviewer)', async () => {
    if (!reachable) return;
    const sets = await listMyOkrSets({ userId: USER_REVIEWER, organizationId: ORG_ID });
    expect(sets.some((s) => s.setId === fixture.setId)).toBe(true);
  });

  it('listMyOkrSets does NOT return the Set for an unrelated user (neither owner nor reviewer)', async () => {
    if (!reachable) return;
    const sets = await listMyOkrSets({ userId: USER_UNRELATED_MANAGER, organizationId: ORG_ID });
    expect(sets.some((s) => s.setId === fixture.setId)).toBe(false);
  });

  it('listMyOkrSets returns the real, non-fabricated setId/currentVersion (matches direct SQL)', async () => {
    if (!reachable) return;
    const sets = await listMyOkrSets({ userId: USER_OWNER, organizationId: ORG_ID });
    const found = sets.find((s) => s.setId === fixture.setId);
    expect(found).toBeDefined();
    const direct = await client.query<{ current_version: number }>(
      `SELECT current_version FROM okr_vnext_sets WHERE set_id = $1`,
      [fixture.setId]
    );
    expect(found!.currentVersion).toBe(direct.rows[0]!.current_version);
  });

  it('listOrganizationOkrTeamHealth includes the manager\'s own Set (self-inclusion via chain_members UNION)', async () => {
    if (!reachable) return;
    const teamHealth = await listOrganizationOkrTeamHealth({ managerId: USER_OWNER, organizationId: ORG_ID });
    expect(teamHealth.sets.some((s) => s.setId === fixture.setId)).toBe(true);
    const statusRow = teamHealth.countsByStatus.find((r) => r.status === 'active');
    expect(statusRow).toBeDefined();
    expect(statusRow!.count).toBeGreaterThanOrEqual(1);
    const scopeRow = teamHealth.countsByScopeType.find((r) => r.scopeType === 'individual');
    expect(scopeRow).toBeDefined();
  });

  it('listOrganizationOkrTeamHealth does NOT include the Set for a manager with no chain relationship to the owner (T3 non-leak)', async () => {
    if (!reachable) return;
    const teamHealth = await listOrganizationOkrTeamHealth({ managerId: USER_UNRELATED_MANAGER, organizationId: ORG_ID });
    expect(teamHealth.sets.some((s) => s.setId === fixture.setId)).toBe(false);
  });

  it('listOrganizationOkrTeamHealth returns real setId/currentVersion (matches direct SQL) — same identity as listMyOkrSets', async () => {
    if (!reachable) return;
    const myOkrSets = await listMyOkrSets({ userId: USER_OWNER, organizationId: ORG_ID });
    const teamHealth = await listOrganizationOkrTeamHealth({ managerId: USER_OWNER, organizationId: ORG_ID });
    const fromMy = myOkrSets.find((s) => s.setId === fixture.setId)!;
    const fromTeamHealth = teamHealth.sets.find((s) => s.setId === fixture.setId)!;
    expect(fromTeamHealth.currentVersion).toBe(fromMy.currentVersion);
    expect(fromTeamHealth.status).toBe(fromMy.status);
  });
});
