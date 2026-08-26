/** @vitest-environment node */

/**
 * Day 14 S.2 — ROI `q` filter (`listRoiCases`), against a REAL Postgres.
 *
 * DEC-93 (supervisor decision, second licensed extension to the DEC-77
 * dozbrojenie task): closes out the route/repository wiring the first
 * extension's validator-only commit (resultsVnextRoi.validators.ts)
 * deliberately left unwired, and the earlier day-14 report flagged as
 * "STOP — S.2 ROI validator poza Z17". `roiRepository.ts`'s `listRoiCases`
 * now applies `q` via the shared `resultsTextMatchPattern`/
 * `resultsTextMatchSql` (textMatch.ts) inside its existing
 * visibility-scoped CTE — same shape `kpiRepository.ts`'s `listKpis` and
 * `okrSetRepository.ts`'s `listOkrSets` already use. This file is the real
 * database proof requested alongside that wiring: hit, miss, escaping
 * (`%`/`_`), and cross-tenant isolation.
 *
 * Reuses the CANONICAL ROI realdb fixture helpers
 * (`tests/resultsVnext/roi/roiRealdbOrgFixture.ts`) rather than hand-
 * rolling visibility setup — `roiRealdbOrgFixtureHelper.realdb.test.ts`'s
 * own header comment documents exactly why a hand-rolled
 * `insertVisibilityPolicy('roi', <mode>, actor)` is the wrong shape for
 * ROI specifically (silently stamps the wrong `visibility_mode`, or skips
 * `rvn_roi_visibility_governance` entirely — both defeat
 * AMD-FLOW-ROI-VISIBILITY-002 in ways that look unrelated to the real
 * cause). `createRoiCase` itself is gated by
 * `resolveRoiGovernedVisibility` (same-tenant ACTIVE OWNER/ADMIN), so the
 * canonical helper is not optional plumbing here — it is a real
 * precondition for the fixture to even build.
 *
 * SKIP GATE: `RUN_DB_TESTS=1` (explicit opt-in, same convention this
 * task's own K.1 realpg suite uses) AND a reachable, schema-complete
 * database — `beforeAll` throws (never silently green) on a configured-
 * but-unreachable database.
 *
 * HOW TO RUN FOR REAL (identical recipe to kpiTrend.realpg.test.ts):
 *   docker run -d --name cx-day14-pg -e POSTGRES_PASSWORD=postgres \
 *     -e POSTGRES_DB=consultify_test -p 4321:5432 pgvector/pgvector:pg16
 *   NODE_ENV=test DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:4321/consultify_test \
 *     DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts
 *   RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
 *     DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:4321/consultify_test \
 *     npx vitest run tests/resultsVnext/roi/roiCasesQFilter.realpg.test.ts
 *   docker rm -f cx-day14-pg && docker volume prune -f
 *
 * NEVER hard-deletes `rvn_roi_visibility_governance` / the legacy
 * `rvn_platform_visibility_policies` governance rows (append-only by
 * trigger, same documented shape every other ROI-governed-visibility
 * realdb suite relies on) — every id in this file is unique per run
 * (`tag`), so residue never collides with a later run.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ensureRoiFixtureMembership,
  ensureRoiFixtureOrganization,
  ensureRoiGovernedVisibility,
} from './roiRealdbOrgFixture.js';

function buildClientConfig(): ClientConfig | null {
  const raw = process.env.DATABASE_URL;
  const url = typeof raw === 'string' && raw.trim() && !raw.includes('${{') ? raw.trim() : null;
  if (!url) return null;
  return { connectionString: url, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 };
}

const DB_CONFIGURED = buildClientConfig() !== null;
const real = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB !== 'true' && DB_CONFIGURED;

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_A = `s2-roi-q-org-a-${tag}`;
const ORG_B = `s2-roi-q-org-b-${tag}`;
const OWNER_A = `s2-roi-q-owner-a-${tag}`;
const OWNER_B = `s2-roi-q-owner-b-${tag}`;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type RoiRepoModule = typeof import('../../../server/src/services/resultsVnext/roi/roiRepository.js');

let createRoiCase: CaseCommandsModule['createRoiCase'];
let listRoiCases: RoiRepoModule['listRoiCases'];

let client: Client;
let reachable = false;

async function insertInitiative(initiativeId: string, organizationId: string, name: string): Promise<void> {
  await client.query(
    `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, 'EXECUTING')`,
    [initiativeId, organizationId, name]
  );
}

let caseSeq = 0;
async function makeCase(organizationId: string, ownerUserId: string, title: string) {
  caseSeq += 1;
  const initiativeId = `${tag}-init-${caseSeq}`;
  await insertInitiative(initiativeId, organizationId, `${title} — initiative`);
  const created = await createRoiCase({
    organizationId,
    initiativeId,
    title,
    ownerUserId,
    currency: 'USD',
    createdBy: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${tag}-create-${caseSeq}-${randomUUID()}`,
  });
  expect(created.outcome).toBe('applied');
  return created.result.case;
}

describe('Day 14 S.2 — ROI listRoiCases q filter (real Postgres)', () => {
  beforeAll(async () => {
    if (!real) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] RUN_DB_TESTS!=1 or no reachable Postgres configured — S.2 ROI q-filter real-PG tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_cases LIMIT 0');
      await client.query('SELECT 1 FROM rvn_roi_visibility_governance LIMIT 0');
    } catch (error) {
      throw new Error(
        'RUN_DB_TESTS=1 but the configured database is unreachable (or missing the ROI/platform-visibility schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const caseCommands: CaseCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCaseCommands.js'
    );
    createRoiCase = caseCommands.createRoiCase;
    const roiRepo: RoiRepoModule = await import('../../../server/src/services/resultsVnext/roi/roiRepository.js');
    listRoiCases = roiRepo.listRoiCases;

    await ensureRoiFixtureOrganization(client, ORG_A, 'S.2 ROI q-filter org A');
    await ensureRoiFixtureOrganization(client, ORG_B, 'S.2 ROI q-filter org B');
    await ensureRoiFixtureMembership(client, { organizationId: ORG_A, userId: OWNER_A, role: 'OWNER' });
    await ensureRoiFixtureMembership(client, { organizationId: ORG_B, userId: OWNER_B, role: 'OWNER' });
    await ensureRoiGovernedVisibility({
      organizationId: ORG_A,
      actorUserId: OWNER_A,
      idempotencyKey: `${tag}-governance-a`,
    });
    await ensureRoiGovernedVisibility({
      organizationId: ORG_B,
      actorUserId: OWNER_B,
      idempotencyKey: `${tag}-governance-b`,
    });
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    // rvn_roi_visibility_governance (append-only by trigger) carries a real
    // FK to organizations(id) — confirmed empirically here (a first draft
    // of this afterAll tried `DELETE FROM organizations` last and hit
    // 23503 "still referenced from table rvn_roi_visibility_governance").
    // The organizations row for a governed org is therefore PERMANENT
    // residue by construction, same documented shape
    // `roiRealdbOrgFixtureHelper.realdb.test.ts` and
    // `legacyIsolation.realdb.test.ts` both accept for the same reason —
    // every id in this file is unique per run (`tag`) specifically so that
    // residue never collides with a later run. Everything that CAN be
    // deleted (cases/initiatives/members/users and their own dependents)
    // still is, to keep the actually-avoidable footprint at zero.
    for (const org of [ORG_A, ORG_B]) {
      await client.query(
        `DELETE FROM rvn_platform_resource_acl WHERE resource_type = 'roi_case' AND resource_id IN (
           SELECT case_id::text FROM rvn_roi_cases WHERE organization_id = $1)`,
        [org]
      );
      await client.query(
        `DELETE FROM rvn_platform_resource_visibility WHERE resource_type = 'roi_case' AND organization_id = $1`,
        [org]
      );
      await client.query(
        `DELETE FROM rvn_platform_outbox WHERE event_id IN (
           SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
        [org]
      );
      await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [org]);
      await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [org]);
      await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [org]);
      await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id = $1`, [org]);
      await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [org]);
      await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [org]);
      await client.query(`DELETE FROM users WHERE organization_id = $1`, [org]);
      // organizations row intentionally NOT deleted — see comment above.
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

  itDB('hit: q matches the one case whose title contains it, case-insensitively, and no other', async () => {
    const alpha = await makeCase(ORG_A, OWNER_A, `${tag} Renewal Alpha Study`);
    await makeCase(ORG_A, OWNER_A, `${tag} Beta Standard Study`);

    const hits = await listRoiCases({ userId: OWNER_A, organizationId: ORG_A, q: 'renewal alpha' });

    expect(hits.map((c) => c.caseId)).toEqual([alpha.caseId]);
  });

  itDB('miss: a q matching nothing returns an empty array, not an error', async () => {
    const results = await listRoiCases({
      userId: OWNER_A,
      organizationId: ORG_A,
      q: `${tag}-definitely-not-a-real-title`,
    });

    expect(results).toEqual([]);
  });

  itDB(
    'escaping: a literal underscore in q matches only the case whose title has that literal underscore, never a same-shaped title with a different character in that position (proves _ is NOT treated as a SQL wildcard)',
    async () => {
      const real_ = await makeCase(ORG_A, OWNER_A, `${tag} Underscore_Case_Real`);
      await makeCase(ORG_A, OWNER_A, `${tag} UnderscoreXCaseXReal`);

      const hits = await listRoiCases({ userId: OWNER_A, organizationId: ORG_A, q: 'Underscore_Case_Real' });

      expect(hits.map((c) => c.caseId)).toEqual([real_.caseId]);
    }
  );

  itDB(
    'escaping: a literal percent sign in q matches only the case whose title has that literal percent, never a same-shaped title with different trailing characters (proves % is NOT treated as a SQL wildcard)',
    async () => {
      const real_ = await makeCase(ORG_A, OWNER_A, `${tag} Budget 100% Done`);
      await makeCase(ORG_A, OWNER_A, `${tag} Budget 100XX Done`);

      const hits = await listRoiCases({ userId: OWNER_A, organizationId: ORG_A, q: '100% Done' });

      expect(hits.map((c) => c.caseId)).toEqual([real_.caseId]);
    }
  );

  itDB(
    'negative tenant: a q that matches an identically-titled case in ANOTHER org returns only the caller\'s own org\'s case — the organization_id = $1 filter, not q, is what isolates tenants',
    async () => {
      const ownCase = await makeCase(ORG_A, OWNER_A, `${tag} Cross Tenant Probe`);
      const foreignCase = await makeCase(ORG_B, OWNER_B, `${tag} Cross Tenant Probe`);
      expect(ownCase.caseId).not.toBe(foreignCase.caseId);

      const fromOrgA = await listRoiCases({ userId: OWNER_A, organizationId: ORG_A, q: 'Cross Tenant Probe' });
      expect(fromOrgA.map((c) => c.caseId)).toEqual([ownCase.caseId]);

      const fromOrgB = await listRoiCases({ userId: OWNER_B, organizationId: ORG_B, q: 'Cross Tenant Probe' });
      expect(fromOrgB.map((c) => c.caseId)).toEqual([foreignCase.caseId]);
    }
  );

  itDB('omitting q returns the same rows as before this field existed (DEC-65 backward compatibility, spot-checked against real data)', async () => {
    const withQ = await listRoiCases({ userId: OWNER_A, organizationId: ORG_A, q: 'Renewal Alpha' });
    const withoutQ = await listRoiCases({ userId: OWNER_A, organizationId: ORG_A });

    expect(withQ.length).toBeGreaterThan(0);
    expect(withoutQ.length).toBeGreaterThanOrEqual(withQ.length);
    expect(withoutQ.some((c) => c.caseId === withQ[0].caseId)).toBe(true);
  });
});
