/**
 * UI-CANON G4 — safety contract for the tenant feature-flag fixture.
 *
 * The contract is stronger than "restored afterwards": a production flag
 * definition must be **byte-identical before, during and after** a fixture run,
 * including while two runs overlap. The fixture therefore never touches
 * `feature_flags` at all — it writes per-organization rows to
 * `g4_test_flag_overrides`, which the runtime endpoint merges last and only
 * when the test-support gate is open.
 *
 * Everything below goes through the real HTTP endpoints against the real
 * database. Nothing is stubbed, no DDL is issued, and no row is deleted
 * globally.
 */

import fs from 'node:fs';
import path from 'node:path';

import { expect, request as apiRequest, test } from '@playwright/test';

const API = process.env.E2E_API_URL || 'http://127.0.0.1:3951';
const KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
const FLAG = 'auditsFiveSurfacesV1';
const EVIDENCE_DIR = path.resolve(
  process.cwd(),
  'docs/program/evidence/closure/ui-g4/AUD-UI-CANON-001'
);

async function support() {
  return apiRequest.newContext({ baseURL: API, extraHTTPHeaders: { 'x-test-support-key': KEY } });
}

async function readRow(flagKey: string) {
  const ctx = await support();
  const res = await ctx.post('/api/test-support/feature-flag-row', { data: { flagKey } });
  const body = res.ok() ? await res.json() : null;
  await ctx.dispose();
  return body?.row ?? null;
}

async function enableFor(organizationId: string, runId: string, flagKey = FLAG) {
  const ctx = await support();
  const res = await ctx.post('/api/test-support/org-feature-flag', {
    data: { flagKey, organizationId, runId, enabled: true },
  });
  const body = await res.json();
  await ctx.dispose();
  return { status: res.status(), body };
}

async function cleanupFor(runId: string, organizationIds: string[]) {
  const ctx = await support();
  const res = await ctx.post('/api/test-support/rbac-fixture/cleanup', {
    data: { runId, organizationIds, flagKeys: [FLAG] },
    timeout: 180000,
  });
  const body = await res.json();
  await ctx.dispose();
  return body;
}

async function residue(organizationIds: string[]) {
  const ctx = await support();
  const res = await ctx.post('/api/test-support/fixture-residue', { data: { organizationIds } });
  const body = await res.json();
  await ctx.dispose();
  return body.counts as Record<string, number>;
}

async function makeFixture(runId: string) {
  const ctx = await support();
  const res = await ctx.post('/api/test-support/rbac-fixture', { data: { runId } });
  expect(res.status(), `rbac-fixture ${runId}`).toBe(201);
  const body = await res.json();
  await ctx.dispose();
  return body as { runId: string; primaryOrgId: string; foreignOrgId: string };
}

test.describe('feature-flag fixture safety', () => {
  test.setTimeout(10 * 60 * 1000);

  test('a production definition is untouched before, during and after two overlapping runs', async () => {
    const evidence: Record<string, unknown> = {};

    // ── A realistic production row: its own targeting, rules and variants ────
    const seedCtx = await support();
    const seeded = await seedCtx.post('/api/test-support/feature-flag-row', {
      data: {
        flagKey: FLAG,
        write: {
          name: 'Audits five surfaces',
          description: 'Pre-existing production definition',
          enabled: true,
          flag_type: 'targeting',
          rules: JSON.stringify({ legacy: true }),
          targeting_rules: JSON.stringify([
            { type: 'org_id', operator: 'in', values: ['pre-existing-org-1'], enabled: true },
          ]),
          rollout_percentage: 25,
          environment: 'production',
          organization_id: null,
          variants: JSON.stringify([{ key: 'a', weight: 100 }]),
          created_by: 'pre-existing-owner',
        },
      },
    });
    expect(seeded.status(), 'seeding the pre-existing row').toBe(200);
    await seedCtx.dispose();

    const before = await readRow(FLAG);
    expect(before, 'the pre-existing row must be readable').not.toBeNull();
    evidence.rowBefore = before;

    // ── Two runs overlap on the same flag key ───────────────────────────────
    const runA = await makeFixture('flagsafe-A');
    const runB = await makeFixture('flagsafe-B');
    evidence.enableA = await enableFor(runA.primaryOrgId, 'flagsafe-A');
    evidence.enableB = await enableFor(runB.primaryOrgId, 'flagsafe-B');

    // DURING the run the production row must be identical, not merely restored.
    const during = await readRow(FLAG);
    evidence.rowDuring = during;
    expect(during, 'the production row must be unchanged WHILE both runs hold overrides').toEqual(
      before
    );

    // ── One cleanup must not disturb the other run ──────────────────────────
    evidence.cleanupA = await cleanupFor('flagsafe-A', [runA.primaryOrgId, runA.foreignOrgId]);
    const afterA = await residue([runA.primaryOrgId, runB.primaryOrgId]);
    evidence.overridesAfterCleanupA = afterA;
    expect(
      afterA.g4_test_flag_overrides,
      "run B's override must survive run A's cleanup"
    ).toBeGreaterThan(0);
    expect(await readRow(FLAG), 'production row still untouched after the first cleanup').toEqual(
      before
    );

    // Retrying a cleanup must be harmless.
    evidence.cleanupARetry = await cleanupFor('flagsafe-A', [
      runA.primaryOrgId,
      runA.foreignOrgId,
    ]);

    evidence.cleanupB = await cleanupFor('flagsafe-B', [runB.primaryOrgId, runB.foreignOrgId]);

    const after = await readRow(FLAG);
    evidence.rowAfter = after;
    expect(after, 'the production row must be identical after both runs').toEqual(before);

    // ── Residue: nothing left for either run ────────────────────────────────
    const finalResidue = await residue([
      runA.primaryOrgId,
      runA.foreignOrgId,
      runB.primaryOrgId,
      runB.foreignOrgId,
    ]);
    evidence.residue = finalResidue;
    for (const [table, count] of Object.entries(finalResidue)) {
      expect(count, `${table} must have no fixture rows left`).toBe(0);
    }

    // Tidy the deliberately-seeded production row back out of the test database.
    const drop = await support();
    await drop.post('/api/test-support/feature-flag-row', { data: { flagKey: FLAG, delete: true } });
    await drop.dispose();

    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'FLAG_FIXTURE_SAFETY.json'),
      JSON.stringify(evidence, null, 2) + '\n'
    );
  });

  test('overrides are allowlisted, crash-safe, and a partial fixture failure rolls itself back', async () => {
    // Only the flags this gate owns may be overridden.
    const ctx = await support();
    const refused = await ctx.post('/api/test-support/org-feature-flag', {
      data: { flagKey: 'someOtherProductFlag', organizationId: 'whatever', enabled: true },
    });
    expect(refused.status(), 'an arbitrary flagKey must be refused').toBe(400);
    await ctx.dispose();

    // A run that never cleans up (simulated crash) leaves only its own row, and
    // a later cleanup by runId removes it.
    const crashed = await makeFixture('flagsafe-crash');
    await enableFor(crashed.primaryOrgId, 'flagsafe-crash');
    const leftBehind = await residue([crashed.primaryOrgId]);
    expect(leftBehind.g4_test_flag_overrides, 'the crashed run left its own override').toBe(1);

    await cleanupFor('flagsafe-crash', [crashed.primaryOrgId, crashed.foreignOrgId]);
    const cleaned = await residue([crashed.primaryOrgId, crashed.foreignOrgId]);
    for (const [table, count] of Object.entries(cleaned)) {
      expect(count, `${table} after recovery cleanup`).toBe(0);
    }

    // Partial failure: the same runId twice collides on the unique e-mail, so
    // the second call fails midway and must leave nothing behind.
    const dup = await support();
    const first = await dup.post('/api/test-support/rbac-fixture', { data: { runId: 'flagsafe-D' } });
    expect(first.status()).toBe(201);
    const firstBody = await first.json();
    const second = await dup.post('/api/test-support/rbac-fixture', { data: { runId: 'flagsafe-D' } });
    const secondBody = await second.json().catch(() => ({}));
    await dup.dispose();

    expect(second.status(), 'the colliding run must fail loudly').toBe(500);
    expect(secondBody.rolledBack, 'and must report that it rolled itself back').toBe(true);

    await cleanupFor('flagsafe-D', [firstBody.primaryOrgId, firstBody.foreignOrgId]);
  });
});
