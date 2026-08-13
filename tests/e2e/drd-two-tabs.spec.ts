/**
 * drd-two-tabs.spec.ts — real two-browser-context CAS (compare-and-swap)
 * conflict on the SAME DRD session (S1/S1B, 2026-08-13).
 *
 * ★ The session-version CAS in this system is enforced at the
 * `transition()`/`freeze()` boundary (`expectedVersion` in the request body,
 * checked both at the HTTP route layer and again atomically inside
 * `MethodSessionService.transition()` — `server/src/routes/method-core.routes.ts`
 * and `server/src/method-core/MethodSessionService.ts`, neither owned by
 * this agent, read-only). Plain event appends (`recordAnswer`/
 * `recordEvidence`) are NOT version-gated in this system (append-only, never
 * overwrite anything) — so this scenario uses "Wyślij do przeglądu"
 * (`transition('in_review')`), the one write on this screen that actually
 * carries a session version and can genuinely 409.
 *
 * ★ Setup-only, out-of-band step (disclosed, not part of the tested
 * interaction): the demo identity (`ENABLE_TEST_AUTH_BYPASS` ->
 * `test-user-id`) only auto-holds `owner` on a freshly created session, and
 * `in_review` requires `lead_assessor`/`assessor`
 * (`TRANSITION_AUTHORITY['in_review']`). This spec self-grants
 * `lead_assessor` to `test-user-id` via the REAL S2 endpoint
 * `POST /api/method/sessions/:id/roles` (server/src/routes/method-core-roles.routes.ts)
 * — a genuine HTTP call, not a raw SQL insert — before either tab attempts a
 * transition. This grant is a PREREQUISITE so the SAME demo user can drive
 * both tabs (there is no second seeded identity for this environment); it
 * has no bearing on the CAS mechanism itself, which both tabs exercise for
 * real afterwards.
 *
 * ★ Measured pitfall (fixed, kept as a comment so it doesn't recur): Tab B
 * must resume the session WITHOUT re-seeding. `dev-render/drd-workspace-main.tsx`
 * (not owned by this agent) maps `screen=http-server` to `seedTo:'interview'`
 * UNCONDITIONALLY — passing `demoSessionId` on THAT same screen key still
 * re-runs `seedHttpSession()` (real `transition('prepared')` +
 * `transition('active')` + more real answer/evidence writes) on top of the
 * already-active session. A first draft of this spec did exactly that and
 * Tab A's OWN transition ended up 409-conflicting against a version Tab B's
 * phantom re-seed had silently bumped out from under it — proven via the
 * server access log (`POST .../transition` firing 3 times instead of 1
 * between the role grant and Tab A's real click) and the resulting
 * CONFLICT screen reporting versions that don't match either tab's own
 * actions. Fix: Tab B resumes via `screen=http-resume` — an
 * intentionally-unmapped key (`isHttpScreen` only checks the `http-`
 * prefix; neither `HTTP_SEED_BY_SCREEN` nor `HTTP_FORCE_STATE_BY_SCREEN`
 * has an entry for it, so `seedTo`/`forceState` both resolve to `undefined`
 * and `boot()` skips both blocks) — an already-supported harness behaviour,
 * not a code change.
 *
 * Scenario:
 *   Tab A: create + seed a real session (state='active', version=vN).
 *   Tab B: opens the SAME session while it is still 'active', version=vN —
 *          caches that belief locally and does NOT refresh again.
 *   Tab A: "Wyślij do przeglądu" -> transition('in_review') succeeds for
 *          real -> version=vN+1, state='in_review'.
 *   Tab B: "Wyślij do przeglądu" (still enabled — client-side gate is only
 *          `session.state==='active'`, which Tab B's stale local copy still
 *          says) -> transition('in_review') with expectedVersion=vN ->
 *          server has vN+1 -> REAL 409 version_conflict -> CONFLICT badge,
 *          diff shown, NOTHING overwritten.
 *   Tab B: "Wczytaj wersję serwera" -> refresh() -> real GET -> SERVER
 *          badge, now showing the true state (in_review, vN+1).
 *   SQL:   method_sessions.version === vN+1 EXACTLY (not vN, not vN+2) —
 *          proves Tab A's write landed once and Tab B's write never landed.
 *
 * 06-tab-b-conflict.png / 07-tab-b-resolved.png ->
 * docs/qa/offline-real-2026-08-13/
 */
import { expect, test } from '@playwright/test';

import {
  closeDb,
  captureCreatedSessionId,
  db,
  drdHttpUrl,
  fetchSession,
  FRONTEND_URL,
  HAR_DIR,
  maskAuthorizationInHar,
  ORG_ID,
  SCREENSHOT_DIR,
  USER_ID,
  waitForBadge,
} from './fixtures/offlineHarness';

test('two tabs, one session: Tab A writes and wins, Tab B is refused 409 and never overwrites, SQL confirms exactly one increment', async ({
  browser,
}, testInfo) => {
  const harPathA = `${HAR_DIR}/drd-two-tabs-A.har`;
  const harPathB = `${HAR_DIR}/drd-two-tabs-B.har`;
  const contextA = await browser.newContext({ recordHar: { path: harPathA, mode: 'full' } });
  const contextB = await browser.newContext({ recordHar: { path: harPathB, mode: 'full' } });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    // -----------------------------------------------------------------
    // Tab A: real session creation + real seed.
    // -----------------------------------------------------------------
    const sessionIdPromise = captureCreatedSessionId(pageA);
    await pageA.goto(drdHttpUrl('http-server'));
    const sessionId = await sessionIdPromise;
    await waitForBadge(pageA, 'SERVER', 30_000);

    const before = await fetchSession(sessionId);
    expect(before).not.toBeNull();
    expect(before!.state).toBe('active');
    const versionN = before!.version;

    // -----------------------------------------------------------------
    // Setup-only (disclosed above): self-grant lead_assessor via the REAL
    // S2 role-grant endpoint — a genuine HTTP call, over the same
    // ENABLE_TEST_AUTH_BYPASS identity both tabs already use.
    // -----------------------------------------------------------------
    const grantRes = await pageA.request.post(`${FRONTEND_URL}/api/method/sessions/${sessionId}/roles`, {
      data: { userId: USER_ID, role: 'lead_assessor' },
    });
    expect(grantRes.ok(), `role grant failed: ${grantRes.status()} ${await grantRes.text()}`).toBeTruthy();

    // -----------------------------------------------------------------
    // Tab B: resumes the SAME session while it is still 'active'/vN, then
    // deliberately does nothing further — its local copy goes stale the
    // moment Tab A writes.
    // -----------------------------------------------------------------
    await pageB.goto(drdHttpUrl('http-resume', { demoSessionId: sessionId }));
    await waitForBadge(pageB, 'SERVER', 30_000);
    const canSendBBefore = await pageB.getByRole('button', { name: 'Wyślij do przeglądu' }).isEnabled();
    expect(canSendBBefore, "Tab B's local view believes the session is still 'active'").toBe(true);

    // -----------------------------------------------------------------
    // Tab A writes for real: transition('in_review') -> version vN+1.
    // -----------------------------------------------------------------
    await pageA.getByRole('button', { name: 'Wyślij do przeglądu' }).click();
    // Same synchronous-clobber shape documented in drd-offline-real.spec.ts:
    // transition()'s `setState({status:'saved'})` is immediately followed
    // by `await this.refresh()`, whose own first line resets to 'loading'
    // in the same JS turn — 'saved' is never independently paintable here
    // either. Wait for the real settled outcome (SERVER) directly.
    await waitForBadge(pageA, 'SERVER', 20_000);

    const afterA = await fetchSession(sessionId);
    expect(afterA!.state).toBe('in_review');
    expect(afterA!.version).toBe(versionN + 1);

    // -----------------------------------------------------------------
    // Tab B writes on its STALE belief -> real 409 version_conflict.
    // -----------------------------------------------------------------
    await pageB.getByRole('button', { name: 'Wyślij do przeglądu' }).click();
    await waitForBadge(pageB, 'CONFLICT', 15_000);
    await expect(pageB.getByTestId('drd-http-conflict-view')).toBeVisible();
    await expect(pageB.getByTestId('conflict-diff')).toBeVisible();
    await pageB.screenshot({ path: `${SCREENSHOT_DIR}/06-tab-b-conflict.png`, fullPage: true });

    // The session must NOT have moved past vN+1 — Tab B's conflicting write
    // never landed, not even partially.
    const afterConflict = await fetchSession(sessionId);
    expect(afterConflict!.version, "Tab B's refused write must not have incremented the version further").toBe(
      versionN + 1
    );
    expect(afterConflict!.state).toBe('in_review');

    // -----------------------------------------------------------------
    // Tab B resolves: "Wczytaj wersję serwera" -> real refresh() -> SERVER,
    // now showing the true (in_review, vN+1) state — never overwritten.
    // -----------------------------------------------------------------
    await pageB.getByTestId('conflict-load-server').click();
    await waitForBadge(pageB, 'SERVER', 15_000);
    await pageB.screenshot({ path: `${SCREENSHOT_DIR}/07-tab-b-resolved.png`, fullPage: true });

    // -----------------------------------------------------------------
    // Final SQL proof — one writer wins, the loser never overwrites,
    // nothing is duplicated: version is EXACTLY vN+1, one row, one state.
    // -----------------------------------------------------------------
    const final = await fetchSession(sessionId);
    expect(final!.version).toBe(versionN + 1);
    expect(final!.state).toBe('in_review');

    const rowCount = await db().query(`SELECT count(*)::int AS n FROM method_sessions WHERE id = $1`, [
      sessionId,
    ]);
    expect(rowCount.rows[0].n).toBe(1); // no phantom duplicate row from either tab's write

    // Sanity: session really is scoped to the seeded org (tenant isolation
    // wasn't accidentally bypassed by resuming via demoSessionId).
    const orgRow = await db().query(`SELECT organization_id FROM method_sessions WHERE id = $1`, [sessionId]);
    expect(orgRow.rows[0].organization_id).toBe(ORG_ID);
  } finally {
    await contextA.close();
    await contextB.close();
    maskAuthorizationInHar(harPathA);
    maskAuthorizationInHar(harPathB);
    await testInfo.attach('two-tabs-A.har', { path: harPathA, contentType: 'application/json' });
    await testInfo.attach('two-tabs-B.har', { path: harPathB, contentType: 'application/json' });
  }
});

test.afterAll(async () => {
  await closeDb();
});
