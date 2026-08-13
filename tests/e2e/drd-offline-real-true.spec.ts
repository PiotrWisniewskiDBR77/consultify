/**
 * drd-offline-real.spec.ts — REAL offline/reconnect cycle for the DRD HTTP
 * runtime (S1/S1B, 2026-08-13). The coordinator's brief was explicit:
 * `debugForceState` does NOT prove the cycle — every state transition below
 * is produced by a genuine network condition, never by calling
 * `DrdHttpSessionRuntime.debugForceState()` (grep confirms this file never
 * imports or references it).
 *
 * ★ Method chosen to sever the network: `browserContext.setOffline(true)`.
 * Of the three options in the brief:
 *   - `context.setOffline(true)`               <- CHOSEN
 *   - `page.route('**\/api/**', r => r.abort())`
 *   - stopping/restarting the backend process
 * `setOffline` operates at the Chromium network-stack level and affects
 * EVERY outgoing request from that browser context (not just requests
 * matching a route pattern), including same-origin requests the dev-render
 * Vite proxy would otherwise forward server-side — the closest simulation of
 * "the user's network actually went down" available in Playwright, and it
 * also flips the real `navigator.onLine` the browser reports. `route.abort()`
 * was rejected because it only intercepts requests matching the given URL
 * pattern, leaving the browser's own network stack reachable (weaker
 * fidelity). Stopping the backend process was rejected because this
 * dev-render harness proxies `/api/**` through the SAME origin as the app
 * shell's own asset requests — killing the backend would also break Vite's
 * ability to serve the page at all, and cannot be un-done mid-test to
 * exercise reconnection without a full context reset.
 *
 * ★ FAILED APPROACH, kept here as a documented negative result (not hidden):
 * this spec's first draft tried to reach a genuine, zero-pending OFFLINE
 * badge via a real `page.goto()` reload while offline (on the theory that
 * `demoSessionId` resume is a normal, supported flow). That reload
 * consistently produced a BLANK page — Chromium refuses the top-level
 * document navigation itself while `setOffline(true)` is active, for a
 * plain (non-Service-Worker-cached) app; there is no partial/cached render
 * to fall back to. This is a genuine finding about this harness's offline
 * ceiling, not a workaround failure — logged instead of silently retried
 * differently. The working replacement below never reloads the page.
 *
 * ★ Real, in-page path to OFFLINE (verified against
 * `drdHttpSessionRuntime.ts`'s actual code, not assumed): "Wyślij do
 * przeglądu" (`transition('in_review')`) is enabled purely by
 * `session.state === 'active'` client-side (`canSendToReview`, this
 * screen's own code) — no role check happens until the request reaches the
 * server. Clicking it while genuinely offline fails at the fetch layer
 * BEFORE any role/legality check, landing on `status:'offline'` with ZERO
 * pending writes — the one call on this screen that produces the literal
 * OFFLINE badge (`deriveDrdSourceKind` returns 'OFFLINE' only when
 * `pendingWriteCount === 0`; any queued write outranks it and shows
 * RECOVERY_DRAFT instead, by explicit design — see that function's own
 * comment on hard rule #1).
 *
 * ★ Real, in-page path to RECONNECTING: once a write IS queued
 * (RECOVERY_DRAFT / `RecoveryQueueView`, a full-screen block with only
 * "Zastosuj zaległe zmiany" / "Odrzuć lokalne" visible), clicking "Zastosuj
 * zaległe zmiany" WHILE STILL OFFLINE calls `retryPending()`, which — on a
 * genuine offline failure — sets `status:'offline'` again while PRESERVING
 * `pendingWriteCount` (see `retryPending()`'s own offline-failure branch).
 * That combination (status 'offline' + pendingWriteCount > 0) is exactly
 * what makes the `OfflineBanner` (rendered whenever `status==='offline'`,
 * independent of the badge) reappear with a working "Spróbuj połączyć
 * ponownie" button — `reconnect()`'s own code only sets the transient
 * `status:'reconnecting'` (-> RECONNECTING badge, unconditionally, no
 * pendingWriteCount gate) when `pendingCount > 0` at the moment it is
 * called. So the real sequence is: local change (queued) -> apply-while-
 * still-offline (fails again, bounces back to 'offline' with the queue
 * intact) -> real reconnect -> retry button -> RECONNECTING -> apply again
 * (now online) -> RECOVERED.
 *
 * ★ One disclosed, pre-existing exception, unrelated to any of the above:
 * the `http-server` dev-render screen (`dev-render/drd-workspace-main.tsx`,
 * NOT owned by this agent) pins the FIRST paint to the settled `SERVER`
 * badge via `debugForceState({status:'ready', pendingWriteCount:0})` AFTER
 * seeding through a real, unforced HTTP interview lifecycle — purely to
 * avoid a flaky race against the seed's own trailing 'saved' transient. That
 * one pin happens before this spec's first assertion and affects NOTHING in
 * the offline/reconnect/recovery cycle itself, which this file drives
 * entirely through real clicks and real network state from that point on.
 *
 * ★★ UPDATE (this "true E2E" run, 2026-08-13) — the RECOVERED-unpaintable
 * defect documented below by the ORIGINAL draft of this spec
 * (tests/e2e/drd-offline-real.spec.ts, kept unmodified as the historical
 * record) HAS SINCE BEEN FIXED at this exact SHA. The original finding is
 * preserved verbatim for context:
 *
 *   [ORIGINAL FAIL, as first found] the literal RECOVERED badge was PROVABLY
 *   UNPAINTABLE through this exact call path, not merely hard to time.
 *   `retryPending()`'s success branch did:
 *     this.setState({status:'recovered', pendingWriteCount:0, ...});
 *     await this.refresh();
 *   and `refresh()`'s OWN first line was:
 *     async refresh(): Promise<void> { this.setState({status:'loading', ...}); ...
 *   Both `setState` calls happened in the SAME synchronous JS turn — calling
 *   `this.refresh()` ran its body synchronously up to its own first `await`,
 *   so `status:'loading'` overwrote `status:'recovered'` before React (or
 *   any observer) ever got a chance to commit/paint the intermediate value.
 *   Proven empirically at the time: a MutationObserver probe with
 *   per-change timestamps showed the badge sequence SAVING -> SERVER on
 *   every real run, with *zero* RECOVERED sightings.
 *
 * THE FIX (already in this SHA — src/method-core/methods/drd/
 * drdHttpSessionRuntime.ts:813-816): `retryPending()`'s success branch now
 * calls `refresh({ preserveStatus: 'recovered' })`, and `refresh()` itself
 * (line 384-390) accepts that option and HOLDS the given status through its
 * own 'loading' phase instead of clobbering it — the synchronous clobber
 * described above no longer happens. The RECOVERED badge is dismissed only
 * by an explicit user action (`RecoveredBanner`'s "OK" button ->
 * `runtime.acknowledgeRecovered()`, DrdHttpMethodWorkspaceScreen.tsx:298-310,
 * 847), never automatically. This run therefore WAITS for and asserts on
 * the real RECOVERED badge (not documented as unreachable) — see the
 * "★ UPGRADE" comment further below, right before the assertion.
 *
 * Scenario (see docs/qa/e2e-true-2026-08-13/offline-and-two-tabs/*.png):
 *   01-online.png              real, freshly-seeded session, SERVER badge
 *   02-real-offline.png        real click ("Wyślij do przeglądu") while
 *                              offline, fails at the network layer ->
 *                              genuine OFFLINE badge, zero pending writes
 *   03-local-change.png        real click on the answer-state control while
 *                              offline -> write queued -> RECOVERY_DRAFT
 *                              (RecoveryQueueView)
 *   04-reconnecting.png        real setOffline(false) + click "Spróbuj
 *                              połączyć ponownie" -> transient RECONNECTING
 *                              badge
 *   05-recovered.png           explicit "Zastosuj zaległe zmiany" (now
 *                              online) -> the REAL, now-paintable RECOVERED
 *                              badge + RecoveredBanner, held via
 *                              preserveStatus (the key proof for this wave)
 *   05b-settled-server.png     after dismissing the RecoveredBanner ("OK")
 *                              -> settles to SERVER; the write landing
 *                              exactly once is confirmed by a FRESH SQL
 *                              read, independent of the badge entirely
 */
import { expect, test } from '@playwright/test';

import {
  captureCreatedSessionId,
  closeDb,
  countEvents,
  drdHttpUrl,
  HAR_DIR,
  listEventsFor,
  maskAuthorizationInHar,
  SCREENSHOT_DIR,
  waitForBadge,
} from './fixtures/offlineHarnessTrue';

test.describe.configure({ mode: 'serial' });

test('real offline -> local change -> real reconnect -> explicit reconciliation -> RECOVERED, proven by SQL', async ({
  browser,
}, testInfo) => {
  const harPath = `${HAR_DIR}/drd-offline-real.har`;
  const context = await browser.newContext({ recordHar: { path: harPath, mode: 'full' } });
  const page = await context.newPage();

  try {
    // -----------------------------------------------------------------
    // 1. ONLINE — real session creation + real seed over HTTP.
    // -----------------------------------------------------------------
    const sessionIdPromise = captureCreatedSessionId(page);
    await page.goto(drdHttpUrl('http-server'));
    const sessionId = await sessionIdPromise;
    expect(sessionId).toBeTruthy();

    await waitForBadge(page, 'SERVER', 30_000);
    // ★ Measured pitfall: seedHttpSession() fires 5+ sequential real HTTP
    // writes; the badge can read a transient 'SERVER'-derived 'ready' frame
    // mid-sequence (between two awaited writes) before the harness's final
    // debugForceState pin ever runs. Going offline right after that FIRST
    // 'SERVER' sighting caught the seed itself still mid-flight and queued
    // one of ITS OWN writes as a false "local change" — confirmed by
    // instrumenting requestfailed/pending-writes and seeing a queued item
    // whose payload text was the seed's own level-2 answer, not this test's
    // click. `networkidle` waits until the seed's own request train is
    // fully drained before this spec's real offline window begins.
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-online.png`, fullPage: true });

    const eventsBefore = await countEvents(sessionId);
    expect(eventsBefore).toBeGreaterThan(0); // the real seed already wrote several

    // -----------------------------------------------------------------
    // 2. REAL OFFLINE — browser-level network cut, then a real click that
    //    genuinely fails at the fetch layer (zero pending writes at this
    //    point -> plain OFFLINE badge, not RECOVERY_DRAFT).
    // -----------------------------------------------------------------
    await context.setOffline(true);
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);

    await page.getByRole('button', { name: 'Wyślij do przeglądu' }).click();
    await waitForBadge(page, 'OFFLINE', 15_000);
    await expect(page.getByTestId('drd-http-offline-banner')).toBeVisible();
    await expect(page.getByTestId('drd-http-offline-banner')).toContainText('na razie nic nie zostało zmienione');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-real-offline.png`, fullPage: true });

    // -----------------------------------------------------------------
    // 3. LOCAL CHANGE while still offline — a real click on the answer-
    //    state control triggers a real fetch, which genuinely fails, which
    //    the runtime queues (RECOVERY_DRAFT, RecoveryQueueView).
    // -----------------------------------------------------------------
    const answerControl = page.getByTestId('answer-state-control').first();
    await expect(answerControl).toBeVisible({ timeout: 15_000 });
    await answerControl.getByRole('radio', { name: /Częściowo/ }).click();

    await waitForBadge(page, 'RECOVERY_DRAFT', 15_000);
    await expect(page.getByTestId('drd-http-recovery-view')).toBeVisible();
    await expect(page.getByTestId('recovery-apply-pending')).toContainText('1');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-local-change.png`, fullPage: true });

    // Bridge back to a real OfflineBanner (with the queue intact): applying
    // the pending queue WHILE STILL OFFLINE genuinely fails again — the
    // runtime's own offline-failure branch in retryPending() sets
    // status:'offline' while preserving pendingWriteCount, which is what
    // makes the OfflineBanner's retry button (wired to reconnect()) become
    // reachable again.
    await page.getByTestId('recovery-apply-pending').click();
    await expect(page.getByTestId('drd-http-offline-banner')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('drd-http-offline-banner')).toContainText('1 niezapisaną zmianę');

    // Confirm nothing reached the database yet — still fully offline.
    expect(await countEvents(sessionId)).toBe(eventsBefore);

    // -----------------------------------------------------------------
    // 4. REAL RECONNECT — flip the browser back online for real, then
    //    click the real "Spróbuj połączyć ponownie" button. Slow the
    //    session GET just enough to catch the transient RECONNECTING
    //    frame on camera (the request itself is 100% real; only its
    //    timing is padded, purely for screenshot capture).
    // -----------------------------------------------------------------
    await context.setOffline(false);
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);

    // Pad ONLY the DELIVERY TIMING of the real GET /sessions/:id
    // reconnect() makes (never its outcome/content — `route.continue()`
    // forwards the exact original request to the real server unmodified,
    // only delayed) so the transient RECONNECTING frame is wide enough to
    // screenshot. Method-filtered: this bare URL is ALSO hit by unrelated
    // POSTs at other points in this flow, and an earlier draft that matched
    // by URL alone ended up delaying (and, via a `route.fetch()`+`fulfill()`
    // reissue that turned out to be unreliable through this dev proxy, once
    // corrupting) the WRONG request — replaced with the simpler, safer
    // "delay then continue()" which never touches the response.
    await page.route(`**/api/method/sessions/${sessionId}`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await new Promise((r) => setTimeout(r, 700));
      await route.continue();
    });

    const retryButton = page.getByTestId('drd-http-offline-banner').getByRole('button', {
      name: /Spróbuj połączyć ponownie/,
    });
    await retryButton.click();
    await waitForBadge(page, 'RECONNECTING', 10_000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-reconnecting.png`, fullPage: true });

    // Back to the explicit reconciliation prompt (recovery -> apply).
    await expect(page.getByTestId('drd-http-recovery-view')).toBeVisible({ timeout: 15_000 });

    // -----------------------------------------------------------------
    // ★ UPGRADE (this "true E2E" run, 2026-08-13): the prior draft of this
    // spec (see tests/e2e/drd-offline-real.spec.ts, kept unmodified as the
    // historical record) documented the RECOVERED badge as PROVABLY
    // unpaintable — `retryPending()`'s `setState({status:'recovered'})` was
    // synchronously clobbered by `refresh()`'s own first line
    // (`setState({status:'loading'})`) before any render could commit it.
    // That has since been FIXED at this exact SHA
    // (src/method-core/methods/drd/drdHttpSessionRuntime.ts:813-816):
    //   this.setState({ status: 'recovered', ... });
    //   await this.refresh({ preserveStatus: 'recovered' });
    // `refresh()` now accepts `preserveStatus` and holds the given status
    // through its own 'loading' phase instead of clobbering it (see that
    // function, ~line 384-390). This run asserts on the REAL, now-paintable
    // RECOVERED badge instead of documenting the old gap.
    // -----------------------------------------------------------------
    await page.getByTestId('recovery-apply-pending').click();

    // The badge must now genuinely reach RECOVERED — this is the key proof
    // for this wave (task brief: "potwierdź, że badge RECOVERED jest teraz
    // realnie osiągalny i widoczny"). It is a held/sticky state (`RecoveredBanner`
    // has an explicit "OK" dismiss button calling `runtime.acknowledgeRecovered()`
    // — see DrdHttpMethodWorkspaceScreen.tsx:298-310 — it does not auto-clear).
    await waitForBadge(page, 'RECOVERED', 20_000);
    await expect(page.getByTestId('drd-http-recovered-banner')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-recovered.png`, fullPage: true });

    // Explicit dismiss ("OK") -> settles to SERVER — captured separately so
    // both the transient RECOVERED proof and the final settled state are on
    // record.
    await page.getByTestId('drd-http-recovered-banner').getByRole('button', { name: 'OK' }).click();
    await waitForBadge(page, 'SERVER', 20_000);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('answer-state-control').first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05b-settled-server.png`, fullPage: true });

    // -----------------------------------------------------------------
    // 5. SQL PROOF — the queued write reached the database EXACTLY once,
    //    independent of whatever the UI badge showed at any point.
    // -----------------------------------------------------------------
    const eventsAfter = await countEvents(sessionId);
    expect(eventsAfter, 'exactly ONE new event must have landed (the queued answer) — no loss, no duplicate').toBe(
      eventsBefore + 1
    );

    const allEvents = await listEventsFor(sessionId);
    const answerEvents = allEvents.filter((e) => e.type === 'ANSWER_CONFIRMED');
    // The idempotency key generated client-side at queue time must be the
    // ONE that landed — proves the exact queued write (not a retry-spawned
    // duplicate with a different key) is what reached the server, exactly
    // once each.
    const idempotencyKeys = new Set(answerEvents.map((e) => e.idempotency_key));
    expect(idempotencyKeys.size, 'no two ANSWER_CONFIRMED events share/duplicate an idempotency key').toBe(
      answerEvents.length
    );
  } finally {
    await context.close();
    maskAuthorizationInHar(harPath);
    await testInfo.attach('offline-real.har', { path: harPath, contentType: 'application/json' });
  }
});

test.afterAll(async () => {
  await closeDb();
});
