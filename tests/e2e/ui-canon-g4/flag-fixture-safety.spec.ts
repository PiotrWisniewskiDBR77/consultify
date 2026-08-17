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
  try {
    const res = await ctx.post('/api/test-support/feature-flag-row', { data: { flagKey } });
    const body = res.ok() ? await res.json() : null;
    return body?.row ?? null;
  } finally {
    await ctx.dispose();
  }
}

async function enableFor(organizationId: string, runId: string, flagKey = FLAG) {
  const ctx = await support();
  try {
    const res = await ctx.post('/api/test-support/org-feature-flag', {
      data: { flagKey, organizationId, runId, enabled: true },
    });
    const body = await res.json();
    return { status: res.status(), body };
  } finally {
    await ctx.dispose();
  }
}

async function cleanupFor(runId: string, organizationIds: string[]) {
  const ctx = await support();
  try {
    const res = await ctx.post('/api/test-support/rbac-fixture/cleanup', {
      data: { runId, organizationIds, flagKeys: [FLAG] },
      timeout: 180000,
    });
    return await res.json();
  } finally {
    await ctx.dispose();
  }
}

async function residue(organizationIds: string[]) {
  const ctx = await support();
  try {
    const res = await ctx.post('/api/test-support/fixture-residue', { data: { organizationIds } });
    const body = await res.json();
    return body.counts as Record<string, number>;
  } finally {
    await ctx.dispose();
  }
}

async function makeFixture(runId: string) {
  const ctx = await support();
  try {
    const res = await ctx.post('/api/test-support/rbac-fixture', { data: { runId } });
    expect(res.status(), `rbac-fixture ${runId}`).toBe(201);
    return (await res.json()) as { runId: string; primaryOrgId: string; foreignOrgId: string };
  } finally {
    await ctx.dispose();
  }
}

test.describe('feature-flag fixture safety', () => {
  test.setTimeout(10 * 60 * 1000);

  test('a production definition is untouched before, during and after two overlapping runs', async () => {
    const evidence: Record<string, unknown> = {};
    const suffix = `${process.pid}-${Date.now()}`;
    const runAId = `flagsafe-A-${suffix}`;
    const runBId = `flagsafe-B-${suffix}`;
    let runA: Awaited<ReturnType<typeof makeFixture>> | null = null;
    let runB: Awaited<ReturnType<typeof makeFixture>> | null = null;
    let seededByTest = false;
    const original = await readRow(FLAG);

    try {
      // ── A realistic production row: its own targeting, rules and variants ────
      // Never overwrite an existing row: generated columns cannot be reconstructed
      // byte-for-byte by the test-support writer. If one exists, use it as-is.
      if (!original) {
        const seedCtx = await support();
        try {
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
          seededByTest = true;
        } finally {
          await seedCtx.dispose();
        }
      }

      const before = await readRow(FLAG);
      expect(before, 'the pre-existing row must be readable').not.toBeNull();
      evidence.rowBefore = before;

      // ── Two runs overlap on the same flag key ───────────────────────────────
      runA = await makeFixture(runAId);
      runB = await makeFixture(runBId);
      evidence.enableA = await enableFor(runA.primaryOrgId, runAId);
      evidence.enableB = await enableFor(runB.primaryOrgId, runBId);

      // DURING the run the production row must be identical, not merely restored.
      const during = await readRow(FLAG);
      evidence.rowDuring = during;
      expect(during, 'the production row must be unchanged WHILE both runs hold overrides').toEqual(
        before
      );

      // ── One cleanup must not disturb the other run ──────────────────────────
      evidence.cleanupA = await cleanupFor(runAId, [runA.primaryOrgId, runA.foreignOrgId]);
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
      evidence.cleanupARetry = await cleanupFor(runAId, [runA.primaryOrgId, runA.foreignOrgId]);

      evidence.cleanupB = await cleanupFor(runBId, [runB.primaryOrgId, runB.foreignOrgId]);

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

      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(EVIDENCE_DIR, 'FLAG_FIXTURE_SAFETY.json'),
        JSON.stringify(evidence, null, 2) + '\n'
      );
    } finally {
      const ownedOrganizations: string[] = [];
      for (const [runId, fixture] of [
        [runAId, runA],
        [runBId, runB],
      ] as const) {
        const organizationIds = fixture ? [fixture.primaryOrgId, fixture.foreignOrgId] : [];
        ownedOrganizations.push(...organizationIds);
        // runId-only cleanup recovers a fixture whose HTTP response was lost
        // after the server registered it but before the client captured org IDs.
        await cleanupFor(runId, organizationIds);
      }
      if (ownedOrganizations.length) {
        const finalResidue = await residue(ownedOrganizations);
        for (const [table, count] of Object.entries(finalResidue)) {
          expect(count, `${table} after failure-safe cleanup`).toBe(0);
        }
      }
      if (seededByTest) {
        const drop = await support();
        try {
          const removed = await drop.post('/api/test-support/feature-flag-row', {
            data: { flagKey: FLAG, delete: true },
          });
          expect(removed.ok(), 'remove only the row seeded by this test').toBe(true);
        } finally {
          await drop.dispose();
        }
      }
      expect(await readRow(FLAG), 'pre-existing production row restored exactly').toEqual(original);
    }
  });

  test('overrides are allowlisted, crash-safe, and a partial fixture failure rolls itself back', async () => {
    const suffix = `${process.pid}-${Date.now()}`;
    const crashRunId = `flagsafe-crash-${suffix}`;
    const duplicateRunId = `flagsafe-D-${suffix}`;
    let crashed: Awaited<ReturnType<typeof makeFixture>> | null = null;
    let duplicate: Awaited<ReturnType<typeof makeFixture>> | null = null;
    try {
      // Only the flags this gate owns may be overridden.
      const ctx = await support();
      try {
        const refused = await ctx.post('/api/test-support/org-feature-flag', {
          data: { flagKey: 'someOtherProductFlag', organizationId: 'whatever', enabled: true },
        });
        expect(refused.status(), 'an arbitrary flagKey must be refused').toBe(400);
      } finally {
        await ctx.dispose();
      }

      // A run that never cleans up (simulated crash) leaves only its own row, and
      // a later cleanup by runId removes it.
      crashed = await makeFixture(crashRunId);
      await enableFor(crashed.primaryOrgId, crashRunId);
      const leftBehind = await residue([crashed.primaryOrgId]);
      expect(leftBehind.g4_test_flag_overrides, 'the crashed run left its own override').toBe(1);

      await cleanupFor(crashRunId, [crashed.primaryOrgId, crashed.foreignOrgId]);
      const cleaned = await residue([crashed.primaryOrgId, crashed.foreignOrgId]);
      for (const [table, count] of Object.entries(cleaned)) {
        expect(count, `${table} after recovery cleanup`).toBe(0);
      }

      // Partial failure: the same runId twice collides on the unique e-mail, so
      // the second call fails midway and must leave nothing behind.
      const dup = await support();
      try {
        const first = await dup.post('/api/test-support/rbac-fixture', {
          data: { runId: duplicateRunId },
        });
        expect(first.status()).toBe(201);
        duplicate = await first.json();
        const second = await dup.post('/api/test-support/rbac-fixture', {
          data: { runId: duplicateRunId },
        });
        const secondBody = await second.json().catch(() => ({}));

        expect(second.status(), 'the colliding run must fail loudly').toBe(500);
        expect(secondBody.rolledBack, 'and must report that it rolled itself back').toBe(true);
      } finally {
        await dup.dispose();
      }

      await cleanupFor(duplicateRunId, [duplicate.primaryOrgId, duplicate.foreignOrgId]);
    } finally {
      for (const [runId, fixture] of [
        [crashRunId, crashed],
        [duplicateRunId, duplicate],
      ] as const) {
        const organizationIds = fixture ? [fixture.primaryOrgId, fixture.foreignOrgId] : [];
        await cleanupFor(runId, organizationIds);
        if (!organizationIds.length) continue;
        const finalResidue = await residue(organizationIds);
        for (const [table, count] of Object.entries(finalResidue)) {
          expect(count, `${table} after failure-safe cleanup`).toBe(0);
        }
      }
    }
  });
});
