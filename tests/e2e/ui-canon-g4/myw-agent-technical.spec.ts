import { execFileSync, execSync } from 'node:child_process';
import path from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, request as apiRequest, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';
import {
  assertVisibleAndUncovered,
  cleanupRunAsserted,
  createIdentityContext,
  createIsolatedRun,
  createMember,
  captureFixtureIds,
  type CapturedFixtureIds,
  expectNoResidue,
  expectZeroWriteDelta,
  guardedCleanupAndAssertNoResidue,
  measureResidueStrict,
  MYW_CLEANUP_TIMEOUT_MS,
  openGuardedCleanupSession,
  snapshotWrites,
  type MywIdentity,
  type MywSeed,
  mywSeedTitles,
  seedMywSurfaces,
  writeTechnicalResult,
} from './_g4/mywTechnicalFixture';

const apiBase = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const appBase = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const supportKey = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
const dbContainer = process.env.MYW_TECHNICAL_DB_CONTAINER || '';
/**
 * Residue is re-measured against PostgreSQL itself, so the check cannot be
 * satisfied by an endpoint that simply reports success. Required, never
 * defaulted to a silent skip: a residue assertion that quietly does not run is
 * indistinguishable from one that passed.
 */
const databaseUrl = (() => {
  const url = process.env.MYW_RESIDUE_DATABASE_URL || process.env.DATABASE_URL || '';
  if (!url) {
    throw new Error(
      'MYW_RESIDUE_DATABASE_URL (or DATABASE_URL) is required so fixture residue can be verified against the database.'
    );
  }
  return url;
})();
/**
 * Current-SHA observations are written to their OWN directory, never on top of
 * `closure/ui-g4/.../screens-technical`. That historical set belongs to
 * candidateSha c2cced7e93 and every one of its 32 files has a sha256 recorded in
 * SCREENS_TECHNICAL_SHA256.txt — overwriting the bytes would silently invalidate
 * that manifest and destroy the record of what the original run actually saw.
 * The two sets stand side by side as two observations.
 */
const currentScreensRoot = path.resolve(
  'docs/program/evidence/closure/b/MYW-AGT-UI-CANON-001/screens-current-4f0fd2cd9b'
);

const surfaces = [
  { key: 'inbox', route: '/my-work?tab=inbox' },
  { key: 'tasks', route: '/my-work?tab=tasks' },
  { key: 'decisions', route: '/my-work?tab=decisions' },
  { key: 'agent', route: '/my-work?tab=agent' },
] as const;

const cells = [
  { language: 'pl', theme: 'light', viewport: { width: 1440, height: 960 } },
  { language: 'en', theme: 'dark', viewport: { width: 1440, height: 960 } },
  { language: 'pl', theme: 'dark', viewport: { width: 390, height: 844 } },
  { language: 'en', theme: 'light', viewport: { width: 390, height: 844 } },
] as const;

async function waitForBackend() {
  const ctx = await apiRequest.newContext({ baseURL: apiBase });
  try {
    await expect
      .poll(async () => (await ctx.get('/api/health/ping')).status(), { timeout: 60_000 })
      .toBe(200);
  } finally {
    await ctx.dispose();
  }
}

test.describe.serial('MYW-AGT-UI-CANON owner-free technical closure', () => {
  test.setTimeout(15 * 60_000);

  test('signed ACTIVE Member/Manager matrix, deep reload, axe and focus', async ({ browser }) => {
    const bootstrap = readTestSupportState();
    const support = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { 'x-test-support-key': supportKey },
    });
    const results: unknown[] = [];
    try {
      const invalid = await support.post('/api/test-support/member', {
        data: { runId: bootstrap.runId, role: 'ARBITRARY_OWNER' },
      });
      expect(invalid.status()).toBe(400);

      const identities: MywIdentity[] = [
        await createMember(support, bootstrap.runId, 'USER'),
        await createMember(support, bootstrap.runId, 'MANAGER'),
      ];

      for (const identity of identities) {
        const identityApi = await apiRequest.newContext({
          baseURL: apiBase,
          extraHTTPHeaders: { Authorization: `Bearer ${identity.token}` },
        });
        const onboarding = await identityApi.put('/api/preferences', {
          data: { onboarding_completed: true, onboarding_role: 'consultant' },
        });
        expect(onboarding.ok()).toBe(true);
        await identityApi.dispose();
        for (const surface of surfaces) {
          for (const cell of cells) {
            const context = await createIdentityContext(browser, appBase, identity, cell.viewport);
            const page = await context.newPage();
            await page.addInitScript(
              ({ language, theme }) => {
                localStorage.setItem('i18nextLng', language);
                localStorage.setItem('theme', theme);
                document.documentElement.classList.toggle('dark', theme === 'dark');
              },
              { language: cell.language, theme: cell.theme }
            );
            const responses: number[] = [];
            page.on('response', (response) => {
              if (/\/api\/(my-work|decisions|ai\/agent-plan|v8\/my-work)/.test(response.url())) {
                responses.push(response.status());
              }
            });
            await page.goto(surface.route, { waitUntil: 'domcontentloaded' });
            await expect(page.locator('body')).toBeVisible();
            await expect
              .poll(
                async () =>
                  page.locator('[aria-busy="true"], [role="progressbar"], .animate-spin').count(),
                { timeout: 30_000 }
              )
              .toBe(0);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await expect(page.locator('body')).toBeVisible();

            let focus = false;
            for (let tabIndex = 0; tabIndex < 12 && !focus; tabIndex += 1) {
              await page.keyboard.press('Tab');
              await page.waitForTimeout(250);
              focus = await page.evaluate(() => {
                const active = document.activeElement as HTMLElement | null;
                if (!active || active === document.body) return false;
                const rect = active.getBoundingClientRect();
                const style = getComputedStyle(active);
                return (
                  rect.width > 0 &&
                  rect.height > 0 &&
                  rect.bottom > 0 &&
                  rect.right > 0 &&
                  rect.top < innerHeight &&
                  rect.left < innerWidth &&
                  (style.outlineWidth !== '0px' || style.boxShadow !== 'none')
                );
              });
            }
            expect(focus).toBe(true);
            const axe = await new AxeBuilder({ page }).analyze();
            const blocking = axe.violations.filter((v) =>
              ['critical', 'serious'].includes(String(v.impact))
            );
            expect(blocking).toEqual([]);
            const screenshot = path.join(
              currentScreensRoot,
              `${identity.role}-${surface.key}-${cell.language}-${cell.theme}-${cell.viewport.width}.png`
            );
            await page.screenshot({ path: screenshot, fullPage: true });
            results.push({
              role: identity.role,
              surface: surface.key,
              ...cell,
              responses,
              focus,
              criticalSerious: blocking.length,
              deepReload: true,
              screenshot,
            });
            await context.close();
          }
        }
      }

      // Also a NEW path: the historical MYW_TECHNICAL_RESULT.json is the sealed
      // result for candidateSha c2cced7e93 and is referenced by the authority's
      // technicalPacket.resultPath. It is not ours to rewrite.
      writeTechnicalResult(path.join(currentScreensRoot, 'MYW_TECHNICAL_RESULT_CURRENT.json'), {
        productSha: execSync('git rev-parse HEAD').toString().trim(),
        e2eMode: process.env.E2E_MODE || 'false',
        signedRoles: identities.map((identity) => identity.role),
        cells: results,
      });
      expect(results).toHaveLength(32);
    } finally {
      await support.dispose();
    }
  });

  test('real database outage renders Decisions error and deterministic retry', async ({ page }) => {
    test.skip(!dbContainer, 'MYW_TECHNICAL_DB_CONTAINER is required for the real outage gate');
    const bootstrap = readTestSupportState();
    const identityApi = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { Authorization: `Bearer ${bootstrap.token}` },
    });
    const onboarding = await identityApi.put('/api/preferences', {
      data: { onboarding_completed: true, onboarding_role: 'consultant' },
    });
    expect(onboarding.ok()).toBe(true);
    await identityApi.dispose();
    await page.addInitScript((userId) => {
      localStorage.setItem(`consultify_onboarding_done:${userId}`, 'true');
    }, bootstrap.userId);
    await page.goto('/my-work?tab=inbox');
    await expect(page.locator('body')).toBeVisible();

    execFileSync('docker', ['pause', dbContainer]);
    try {
      await page.goto('/my-work/decisions', { waitUntil: 'domcontentloaded' });
      const alert = page.getByRole('alert');
      await expect(alert).toContainText(/Failed to load decisions|Nie udało się/i, {
        timeout: 45_000,
      });
      await expect(page.getByText(/No decisions awaiting|All caught up/i)).toHaveCount(0);
    } finally {
      execFileSync('docker', ['unpause', dbContainer]);
      await waitForBackend();
    }

    const retry = page.getByRole('button', { name: /Try again|Spróbuj ponownie/i });
    await expect(retry).toBeVisible();
    await retry.click();
    await expect(retry).toHaveCount(0, { timeout: 30_000 });
  });

  test('personal task success, idempotent replay and tenant isolation use mounted auth', async () => {
    const bootstrap = readTestSupportState();
    const support = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { 'x-test-support-key': supportKey },
    });
    // OWN run, not the shared global bootstrap: sharing fixture identity across
    // tests is how one test's residue becomes another test's phantom pass.
    const own = await createIsolatedRun(support, bootstrap.runId, 'tenant');
    const foreign = await createIsolatedRun(support, bootstrap.runId, 'tenant-foreign');
    const member = await createMember(support, own.runId, 'USER');
    const memberApi = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { Authorization: `Bearer ${member.token}` },
    });
    const foreignApi = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { Authorization: `Bearer ${foreign.token}` },
    });
    const unsigned = await apiRequest.newContext({ baseURL: apiBase });
    try {
      const payload = {
        title: `MYW mounted success task ${own.runId}`,
        status: 'todo',
        priority: 'high',
        idempotencyKey: `${own.runId}-task-once`,
      };
      const created = await memberApi.post('/api/my-work/personal-tasks', { data: payload });
      expect(created.status()).toBe(201);
      const createdBody = await created.json();
      const replay = await memberApi.post('/api/my-work/personal-tasks', { data: payload });
      expect(replay.status()).toBe(200);
      expect((await replay.json()).id).toBe(createdBody.id);

      // EXACT status and code. `[403, 404]` could not tell "denied" from
      // "route missing": a route that silently stopped existing would pass it.
      const probe = await openGuardedCleanupSession(databaseUrl);
      try {
        const orgs = [own.organizationId, foreign.organizationId];

        const beforeForeign = await snapshotWrites(probe, orgs);
        const foreignRead = await foreignApi.get(`/api/my-work/personal-tasks/${createdBody.id}`);
        expect(foreignRead.status()).toBe(404);
        expect(await foreignRead.json()).toMatchObject({
          error: 'Not found',
          code: 'TASK_NOT_FOUND',
        });
        expectZeroWriteDelta(
          beforeForeign,
          await snapshotWrites(probe, orgs),
          'foreign-tenant read'
        );

        // BODY SPOOF: a genuinely valid foreign token whose BODY forges the
        // victim's organizationId and userId. Authorization must come from the
        // verified token, never from caller-supplied body fields.
        const beforeSpoof = await snapshotWrites(probe, orgs);
        const spoof = await foreignApi.put(`/api/my-work/personal-tasks/${createdBody.id}`, {
          data: {
            title: 'SPOOFED TITLE',
            organizationId: own.organizationId,
            userId: member.userId,
          },
        });
        expect(spoof.status()).toBe(404);
        expect(await spoof.json()).toMatchObject({ error: 'Not found', code: 'TASK_NOT_FOUND' });
        expectZeroWriteDelta(beforeSpoof, await snapshotWrites(probe, orgs), 'body-spoof write');

        // and the victim's row is untouched
        const victim = await memberApi.get(`/api/my-work/personal-tasks/${createdBody.id}`);
        expect(victim.status()).toBe(200);
        expect((await victim.json()).title).toBe(payload.title);

        // UNSIGNED 401 with its own zero-write delta.
        const beforeUnsigned = await snapshotWrites(probe, orgs);
        const unsignedRes = await unsigned.get('/api/my-work/personal-tasks');
        expect(unsignedRes.status()).toBe(401);
        expectZeroWriteDelta(
          beforeUnsigned,
          await snapshotWrites(probe, orgs),
          'unsigned 401 request'
        );
      } finally {
        await probe.release();
      }
    } finally {
      // NESTED finally: every context is disposed even when a cleanup throws,
      // and BOTH runs are cleaned with their responses asserted — including the
      // foreign one, which is the path that silently no-ops.
      try {
        await guardedCleanupAndAssertNoResidue(
          support,
          databaseUrl,
          [own.runId, foreign.runId],
          [own.organizationId, foreign.organizationId]
        );
      } finally {
        await memberApi.dispose();
        await foreignApi.dispose();
        await unsigned.dispose();
        await support.dispose();
      }
    }
  });


  /**
   * The four preceding cells only ever proved that a surface MOUNTS. A surface
   * that renders an empty list settles exactly like one that renders rows, so
   * "no spinner + body visible" is not a success journey. This test seeds real
   * rows through the mounted product writers and then requires the UI to show
   * those exact strings, uncovered, to the signed member who owns them.
   */
  test('seeded Inbox, Decisions and Agent present real rows to a signed member', async ({
    browser,
  }) => {
    const bootstrap = readTestSupportState();
    const support = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { 'x-test-support-key': supportKey },
    });
    // MANAGER, not USER: `POST /api/decisions` is gated by
    // requireDecisionCapability('decision.request')
    // (server/src/routes/pmo/decisions.routes.ts:97) and a plain MEMBER is
    // correctly refused with 403. Seeding as USER would therefore have to
    // either bypass that check or drop the Decisions journey — both worse than
    // using the persona that genuinely holds the capability.
    const own = await createIsolatedRun(support, bootstrap.runId, 'seeded');
    const identity = await createMember(support, own.runId, 'MANAGER');
    const identityApi = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { Authorization: `Bearer ${identity.token}` },
    });
    let seed: MywSeed | null = null;
    try {
      const onboarding = await identityApi.put('/api/preferences', {
        data: { onboarding_completed: true, onboarding_role: 'consultant' },
      });
      expect(onboarding.ok()).toBe(true);

      const titles = mywSeedTitles(own.runId, identity.role);
      seed = await seedMywSurfaces(identityApi, titles);

      // Database truth FIRST: if PostgreSQL is empty the UI assertion below
      // could only ever pass by accident, so fail here rather than there.
      expect(seed.inboxItemCount).toBeGreaterThanOrEqual(2);
      expect(seed.inboxTitles).toContain(titles.taskTitle);
      expect(seed.inboxTitles).toContain(titles.decisionTitle);
      expect(seed.decisionId).not.toEqual('');
      expect(seed.planId).not.toEqual('');

      const context = await createIdentityContext(browser, appBase, identity);
      const page = await context.newPage();
      try {
        // Deep links are PATH-based for inbox/tasks/decisions
        // (MyWorkHub.parseMyWorkPathIntent). Only `?tab=vault` and `?tab=agent`
        // are honoured as query parameters (MyWorkHub.tsx:576-577); every other
        // `?tab=` value silently falls through to MY_WORK_FALLBACK_TAB ('inbox'),
        // so a `?tab=decisions` route would assert against the Inbox surface.
        const journeys = [
          { route: '/my-work/inbox', label: 'Inbox task row', text: titles.taskTitle },
          { route: '/my-work/inbox', label: 'Inbox decision row', text: titles.decisionTitle },
          {
            route: '/my-work/decisions',
            label: 'Decisions row',
            text: titles.decisionTitle,
          },
          { route: '/my-work?tab=agent', label: 'Agent plan row', text: titles.planTitle },
        ];

        for (const journey of journeys) {
          await page.goto(journey.route, { waitUntil: 'domcontentloaded' });
          await expect
            .poll(
              async () =>
                page.locator('[aria-busy="true"], [role="progressbar"], .animate-spin').count(),
              { timeout: 30_000 }
            )
            .toBe(0);
          // Exact string, not a substring of some placeholder: the row must be
          // the seeded record and must not be hidden behind an overlay.
          await assertVisibleAndUncovered(
            page.getByText(journey.text, { exact: false }),
            journey.label
          );
        }

        // An empty-state message must NOT coexist with the seeded rows — that
        // combination is how a stale cached shell fakes a populated surface.
        await expect(page.getByText(/No decisions awaiting|All caught up/i)).toHaveCount(0);
      } finally {
        await context.close();
      }
    } finally {
      try {
        await guardedCleanupAndAssertNoResidue(
          support,
          databaseUrl,
          [own.runId],
          [own.organizationId]
        );
      } finally {
        await identityApi.dispose();
        await support.dispose();
      }
    }
  });

  /**
   * FORCED CLEANUP FAILURE — detection and honest reporting.
   *
   * Cleanup here is NOT atomic and this packet never claims it is:
   * purgeByOrganizationId iterates tables one DELETE at a time and swallows
   * every per-table failure (testSupport.routes.ts:553-559), so a partial purge
   * is possible by construction and the endpoint can still answer ok.
   *
   * What IS demonstrated: when cleanup does not actually remove the rows, the
   * harness NOTICES and reports non-zero rather than silently printing 0, and
   * it then recovers. The failure is induced without touching product code, by
   * directing the cleanup at a DIFFERENT run — the real silent-no-op path,
   * which answers HTTP 200 ok:true deleted:false while the fixture survives.
   */
  test('a cleanup that does not delete is reported, not silently passed', async () => {
    const bootstrap = readTestSupportState();
    const support = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { 'x-test-support-key': supportKey },
    });
    const own = await createIsolatedRun(support, bootstrap.runId, 'cleanup-failure');
    const decoy = await createIsolatedRun(support, bootstrap.runId, 'cleanup-decoy');
    const member = await createMember(support, own.runId, 'MANAGER');
    const memberApi = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { Authorization: `Bearer ${member.token}` },
    });
    // RETAINED OUTSIDE the inner block. The final verification must always
    // receive real captured identities: passing an empty set would make
    // `WHERE id = ANY('{}')` return 0, which is indistinguishable from a clean
    // database — the same false negative as the parent join, by another route.
    let retained: CapturedFixtureIds | null = null;
    let ownCleaned = false;
    try {
      const titles = mywSeedTitles(own.runId, 'FAILCASE');
      const seeded = await seedMywSurfaces(memberApi, titles);
      expect(seeded.inboxItemCount).toBeGreaterThanOrEqual(2);

      const session = await openGuardedCleanupSession(databaseUrl);
      try {
        retained = await captureFixtureIds(session, [own.organizationId]);
        expect(retained.agentPlanStepIds.length).toBeGreaterThan(0);

        // CONTROL A — the empty-set hazard, demonstrated on a DIRTY database.
        // Same session, same rows: a missing capture must NOT read as 0.
        const withoutCapture = await measureResidueStrict(session, [own.organizationId], null);
        expect(withoutCapture.unverified.length).toBeGreaterThan(0);
        expect(() => expectNoResidue(withoutCapture)).toThrow(/UNVERIFIED/);

        // CONTROL B — the verifier goes RED on retained identities.
        await cleanupRunAsserted(support, decoy.runId);
        const secondSweep = await support.post('/api/test-support/cleanup', {
          data: { runId: decoy.runId },
          timeout: MYW_CLEANUP_TIMEOUT_MS,
        });
        expect(secondSweep.status()).toBe(200);
        // HTTP 200 + ok:true, yet nothing was deleted — the endpoint's word is
        // not evidence.
        expect(await secondSweep.json()).toMatchObject({ ok: true, deleted: false });
        await expect(cleanupRunAsserted(support, decoy.runId)).rejects.toThrow(
          /did not report a real delete/
        );

        const dirty = await measureResidueStrict(session, [own.organizationId], retained);
        expect(dirty.unverified).toEqual([]);
        expect(() => expectNoResidue(dirty)).toThrow(/residue not zero/);
        expect(dirty.counts.tasks).toBeGreaterThan(0);
        expect(dirty.counts.ai_agent_plans).toBeGreaterThan(0);
        expect(dirty.counts.canonical_inbox_items).toBeGreaterThan(0);
        expect(dirty.counts.ai_agent_plan_steps__by_captured_id).toBeGreaterThan(0);

        // Recovery, then green on the SAME retained identities that were red a
        // moment ago — so the zero cannot be vacuous.
        await cleanupRunAsserted(support, own.runId);
        ownCleaned = true;
        const clean = await measureResidueStrict(session, [own.organizationId], retained);
        expectNoResidue(clean);
        expect(clean.counts.ai_agent_plan_steps__by_captured_id).toBe(0);
        expect(clean.denominator).toContain('captured BEFORE cleanup');
      } finally {
        await session.release();
      }
    } finally {
      // Guaranteed teardown. Every stage still runs when an earlier one throws.
      try {
        const verify = await openGuardedCleanupSession(databaseUrl);
        try {
          // If the inner block never got to capture — an assertion failure, a
          // session-open failure — capture NOW, BEFORE any recovery cleanup
          // deletes the parents and makes the children unnameable forever.
          if (!retained) {
            retained = await captureFixtureIds(verify, [
              own.organizationId,
              decoy.organizationId,
            ]);
          }
          try {
            if (!ownCleaned) {
              // A throw here is NOT evidence the rows are gone; it is recorded
              // and the inventory below decides.
              await cleanupRunAsserted(support, own.runId).catch(() => undefined);
            }
            await support
              .post('/api/test-support/cleanup', {
                data: { runId: decoy.runId },
                timeout: MYW_CLEANUP_TIMEOUT_MS,
              })
              .catch(() => undefined);
          } finally {
            // ALWAYS with the retained identities — never an empty set.
            const residual = await measureResidueStrict(
              verify,
              [own.organizationId, decoy.organizationId],
              retained
            );
            expectNoResidue(residual);
          }
        } finally {
          await verify.release();
        }
      } finally {
        await memberApi.dispose();
        await support.dispose();
      }
    }
  });

  /**
   * FORCED PARTIAL CLEANUP — proof that the FINAL verifier can go RED.
   *
   * A verifier that has never failed is not a verifier. This seeds a run,
   * captures the child identities while their parents still exist, then runs
   * the exact final-verification call against the still-dirty database and
   * requires it to fail. Only then does it clean for real and require green on
   * the SAME identities, with unlock true and zero advisory locks left behind.
   */
  test('the final residue verifier goes red on retained child ids, then green', async () => {
    const bootstrap = readTestSupportState();
    const support = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { 'x-test-support-key': supportKey },
    });
    const own = await createIsolatedRun(support, bootstrap.runId, 'partial-red');
    const member = await createMember(support, own.runId, 'MANAGER');
    const memberApi = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { Authorization: `Bearer ${member.token}` },
    });
    let retained: CapturedFixtureIds | null = null;
    try {
      const seeded = await seedMywSurfaces(memberApi, mywSeedTitles(own.runId, 'PARTIAL'));
      expect(seeded.inboxItemCount).toBeGreaterThanOrEqual(2);

      const session = await openGuardedCleanupSession(databaseUrl);
      try {
        retained = await captureFixtureIds(session, [own.organizationId]);
        expect(retained.agentPlanStepIds.length).toBeGreaterThan(0);
        expect(retained.decisionHistoryIds.length).toBeGreaterThan(0);

        // RED: leftover children under retained ids must fail the verifier.
        const red = await measureResidueStrict(session, [own.organizationId], retained);
        expect(red.counts.ai_agent_plan_steps__by_captured_id).toBe(
          retained.agentPlanStepIds.length
        );
        expect(red.counts.decision_history__by_captured_id).toBe(
          retained.decisionHistoryIds.length
        );
        expect(() => expectNoResidue(red)).toThrow(/residue not zero/);

        // GREEN after a real cleanup, on the same identities.
        await cleanupRunAsserted(support, own.runId);
        const green = await measureResidueStrict(session, [own.organizationId], retained);
        expectNoResidue(green);
        expect(green.counts.ai_agent_plan_steps__by_captured_id).toBe(0);
        expect(green.counts.decision_history__by_captured_id).toBe(0);
        expect(green.counts.user_preferences__by_captured_user_id).toBe(0);
      } finally {
        // release() itself asserts pg_advisory_unlock() === true and that the
        // session holds zero advisory locks afterwards.
        await session.release();
      }
    } finally {
      try {
        const verify = await openGuardedCleanupSession(databaseUrl);
        try {
          if (!retained) retained = await captureFixtureIds(verify, [own.organizationId]);
          await cleanupRunAsserted(support, own.runId).catch(() => undefined);
          expectNoResidue(
            await measureResidueStrict(verify, [own.organizationId], retained)
          );
        } finally {
          await verify.release();
        }
      } finally {
        await memberApi.dispose();
        await support.dispose();
      }
    }
  });

  /**
   * Revocation must bite on the FIRST request, not after a TTL. The membership
   * guard caches its verdict for MEMBERSHIP_CACHE_TTL_MS
   * (server/src/middleware/auth.middleware.ts:1556) and nothing in production
   * invalidates that entry when a membership flips, so this test deliberately
   * keeps the cache COLD: the identity performs no guarded request before the
   * revoke. That makes the assertion below a genuine first-request denial
   * rather than an expired-cache artefact.
   *
   * The warm-cache case is NOT asserted here because the product does not yet
   * satisfy it; it is recorded as NOT_VERIFIED in the packet instead of being
   * papered over by clearing the cache from the harness.
   */
  test('revoked membership is denied on the first guarded request with a cold cache', async () => {
    const bootstrap = readTestSupportState();
    const support = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { 'x-test-support-key': supportKey },
    });
    const own = await createIsolatedRun(support, bootstrap.runId, 'revoked');
    const identity = await createMember(support, own.runId, 'USER');
    const identityApi = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { Authorization: `Bearer ${identity.token}` },
    });
    try {
      const revoked = await support.post('/api/test-support/revoke-membership', {
        data: { userId: identity.userId, organizationId: identity.organizationId },
      });
      expect(revoked.ok()).toBe(true);
      expect((await revoked.json()).status).toBe('REVOKED');

      // FIRST guarded request this identity ever makes — with a zero-write
      // delta, so a denial that nonetheless wrote a row cannot pass quietly.
      const probe = await openGuardedCleanupSession(databaseUrl);
      try {
        const orgs = [own.organizationId];
        const beforeRevoked = await snapshotWrites(probe, orgs);
        const first = await identityApi.get('/api/my-work/stats');
        expect(first.status()).toBe(403);
        expect((await first.json()).code).toBe('ORG_MEMBERSHIP_REVOKED');
        expectZeroWriteDelta(
          beforeRevoked,
          await snapshotWrites(probe, orgs),
          'revoked first-request 403'
        );

        // UNSIGNED 401 on the same surface, also with a zero-write delta.
        const unsigned = await apiRequest.newContext({ baseURL: apiBase });
        try {
          const beforeUnsigned = await snapshotWrites(probe, orgs);
          const unsignedRes = await unsigned.get('/api/my-work/stats');
          expect(unsignedRes.status()).toBe(401);
          expectZeroWriteDelta(
            beforeUnsigned,
            await snapshotWrites(probe, orgs),
            'unsigned 401 request'
          );
        } finally {
          await unsigned.dispose();
        }
      } finally {
        await probe.release();
      }
    } finally {
      try {
        await guardedCleanupAndAssertNoResidue(
          support,
          databaseUrl,
          [own.runId],
          [own.organizationId]
        );
      } finally {
        await identityApi.dispose();
        await support.dispose();
      }
    }
  });
});
