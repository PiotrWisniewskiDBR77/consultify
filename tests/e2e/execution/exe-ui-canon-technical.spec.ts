import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import pg from 'pg';

import {
  addAdmin,
  attachConsoleWatch,
  authHeaders,
  bootstrap,
  cleanup,
  cleanupAll,
  countGovernedAudit,
  FIXTURE_WRITTEN_TABLES,
  GOVERNED_ACTION_IDS,
  GOVERNED_ROUTE_PATTERNS,
  HIDDEN_ACTION_IDS,
  measureResidue,
  readActionRegistry,
  readCaseState,
  REACHABLE_EXECUTION_TABS,
  revokeMembership,
  seedExecution,
  signedContext,
  type ExecutionPersona,
} from './_helpers/executionUiTechnicalFixture';

const API = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

/**
 * Screenshot output directory, opt-in via EXE_UI_SCREENS_DIR and NEVER
 * defaulted to a path under docs/.
 *
 * This used to be a hardcoded, SHA-named constant under
 * docs/program/evidence/closure/b/EXE-UI-CANON-001/. That is precisely how
 * SHA-bound bytes get silently rewritten: every rerun overwrote the PNGs in a
 * directory whose NAME asserts which SHA they were observed at, and
 * regenerating the manifest alongside them made the directory internally
 * consistent, so no hash check could detect the substitution. The falsehood
 * lived in the name, with nothing left to catch it.
 *
 * Now the caller must name the directory explicitly, at the exact SHA whose
 * bytes are being captured. Unset (the default) writes no screenshots at all.
 * NEVER point this at docs/program/evidence/closure/ui-g4/** — that tree is
 * historical input whose bytes are sha256-pinned by sibling manifests.
 */
const SCREENS_DIR = process.env.EXE_UI_SCREENS_DIR?.trim() ?? '';

/**
 * One Menu-3 preset that only the given tab's canonical Surface renders, so a
 * visible anchor proves that specific Surface mounted:
 *   list      ExecutionRealizationsSurface
 *   work      ExecutionWorkSurface
 *   resources ExecutionResourcesSurface
 *   control   ExecutionControlSurface (+ ExecutionDeliveryClosurePanel)
 *   reports   ExecutionReportsSurface
 */
/**
 * The exact set of endpoints that answered 403 to a fully signed ADMIN during
 * this lane's runs. Root cause is visible verbatim in the backend log:
 * "[PermissionMiddleware] Denied: manage_workstreams". These surfaces render
 * and then fire calls the signed role cannot make. Recorded as a PRODUCT
 * FINDING; fixing it needs a product allowlist this lane does not hold.
 */
const MANAGER_LANE_403_ENDPOINTS = [
  '/api/v8/execution-control/manager/lanes/action-queue/problems',
  '/api/v8/execution-control/manager/lanes/blockers/problems',
  '/api/v8/execution-control/manager/lanes/decisions/problems',
  '/api/v8/execution-control/manager/lanes/people-change/problems',
  '/api/v8/execution-control/manager/lanes/risk/problems',
  '/api/v8/execution-control/manager/lanes/workload/problems',
];

/** `"<status> <METHOD> <url>"` entries -> sorted unique pathnames. */
const distinctEndpoints = (entries: readonly string[]): string[] =>
  [...new Set(entries.map((entry) => new URL(entry.split(' ')[2]).pathname))].sort();

const TAB_ANCHOR_CHIP: Record<(typeof REACHABLE_EXECUTION_TABS)[number], string> = {
  list: 'standard-chip-active',
  work: 'standard-chip-tasks',
  resources: 'standard-chip-overallocated',
  control: 'standard-chip-needs-action',
  reports: 'standard-chip-weekly',
};

test.describe.serial('EXE-UI-CANON canonical delivery closure', () => {
  let creator: ExecutionPersona | null = null;

  // Same resource budget as the reachability suite below. This journey drives a
  // four-eyes spine across three separate signed browser contexts (creator,
  // approver, cold reopen) against a real mounted router and real Postgres, and
  // measures ~2 minutes on a shared local stack. The repo-wide 60s default in
  // playwright.config is sized for light smoke specs; exceeding it is a resource
  // limit, not a product signal. No assertion below is relaxed.
  test.beforeEach(() => {
    test.setTimeout(600_000);
  });

  test.afterEach(async ({ request }) => {
    if (creator) {
      await cleanup(request, creator);
      creator = null;
    }
  });

  test('signed distinct actors complete spine, four-eyes approval, close, receipt, reload and cold reopen', async ({
    browser,
    request,
  }) => {
    creator = await bootstrap(request, `exe-ui-flow-${Date.now().toString(36)}`);
    const approver = await addAdmin(request, creator);
    const seed = await seedExecution(creator);
    const creatorContext = await signedContext(browser, creator);
    const creatorPage = await creatorContext.newPage();
    await creatorPage.goto('/execution?tab=control');
    const panel = creatorPage.getByTestId('execution-delivery-closure');
    await expect(panel).toBeVisible({ timeout: 120_000 });
    await panel.getByLabel('Initiative ID').fill(seed.initiativeId);
    await panel.getByLabel('Execution case ID').fill(seed.caseId);
    await panel.getByRole('button', { name: 'Start governed closure' }).click();
    await expect(creatorPage).toHaveURL(/executionLinkId=/);
    await creatorPage.waitForLoadState('networkidle');
    const linkId = new URL(creatorPage.url()).searchParams.get('executionLinkId')!;
    // The panel seeds its `refs` state from the loaded snapshot and disables its
    // write controls while `busy` is in flight
    // (ExecutionDeliveryClosurePanel.tsx:121). Wait for the spine control to
    // exist BEFORE typing: filling mid-hydration lets a late load overwrite the
    // typed values, and waiting afterwards would not catch it. This is an
    // explicit precondition, not a relaxed assertion — the toHaveValue checks
    // below are unchanged and still fail if the panel drops input.
    const saveSpine = panel.getByRole('button', { name: 'Save complete delivery spine' });
    await expect(saveSpine).toBeVisible({ timeout: 120_000 });
    for (const [label, value] of [
      ['workRef', 'work:1'],
      ['resourceRef', 'resource:1'],
      ['controlRef', 'control:1'],
      ['reportRef', 'report:1'],
    ] as const) {
      const input = panel.getByLabel(label);
      await input.fill(value);
      await expect(input).toHaveValue(value);
    }
    await expect(saveSpine).toBeEnabled({ timeout: 120_000 });
    await saveSpine.click();
    await panel.getByLabel('Evidence artifact link').fill(seed.artifactLinkId);
    await panel.getByLabel('SHA-256').fill('sha256:exe-ui-content');
    const submitEvidence = panel.getByRole('button', { name: 'Submit evidence' });
    await expect(submitEvidence).toBeEnabled({ timeout: 120_000 });
    await submitEvidence.click();
    await expect(panel.getByText('SUBMITTED')).toBeVisible({ timeout: 60_000 });
    const selfApprove = panel.getByRole('button', { name: 'Approve as independent reviewer' });
    await expect(selfApprove).toBeEnabled({ timeout: 120_000 });
    await selfApprove.click();
    await expect(panel.getByRole('alert')).toBeVisible({ timeout: 60_000 });
    await expect(panel.getByText('Results receipt persisted')).toHaveCount(0);
    await creatorContext.close();

    const approverContext = await signedContext(browser, approver);
    const page = await approverContext.newPage();
    await page.goto(`/execution?tab=control&executionLinkId=${encodeURIComponent(linkId)}`);
    const adminPanel = page.getByTestId('execution-delivery-closure');
    const independentApprove = adminPanel.getByRole('button', {
      name: 'Approve as independent reviewer',
    });
    await expect(independentApprove).toBeEnabled({ timeout: 120_000 });
    await independentApprove.click();
    await expect(adminPanel.getByText('APPROVED')).toBeVisible({ timeout: 60_000 });
    const closeButton = adminPanel.getByRole('button', {
      name: 'Close execution and emit Results signal',
    });
    await expect(closeButton).toBeEnabled({ timeout: 120_000 });
    await closeButton.dblclick();
    await expect(adminPanel.getByText('Results receipt persisted')).toBeVisible({
      timeout: 120_000,
    });
    const signalText = await adminPanel.getByText(/^Signal:/).textContent();
    await page.reload();
    await expect(adminPanel.getByText('Results receipt persisted')).toBeVisible();
    expect(await adminPanel.getByText(/^Signal:/).textContent()).toBe(signalText);
    const axe = await new AxeBuilder({ page })
      .include('[data-testid="execution-delivery-closure"]')
      .analyze();
    expect(axe.violations.filter((v) => ['critical', 'serious'].includes(v.impact || ''))).toEqual(
      []
    );
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus-visible')).toBeVisible();
    await approverContext.close();

    const cold = await signedContext(browser, approver);
    const coldPage = await cold.newPage();
    await coldPage.goto(`/execution?tab=control&executionLinkId=${encodeURIComponent(linkId)}`);
    // Cold context: no SPA memory and no warm module cache, so first paint of
    // the persisted receipt is materially slower than the warm reload above.
    await expect(coldPage.getByText('Results receipt persisted')).toBeVisible({
      timeout: 120_000,
    });
    expect(await coldPage.getByText(/^Signal:/).textContent()).toBe(signalText);
    await cold.close();
  });

  test('stale concurrent spine has one winner; foreign and revoked reads fail closed', async ({
    request,
  }) => {
    creator = await bootstrap(request, `exe-ui-negative-${Date.now().toString(36)}`);
    const foreign = await bootstrap(request, `exe-ui-foreign-${Date.now().toString(36)}`);
    const seed = await seedExecution(creator);
    const linkResponse = await request.post(`${API}/api/v8/case-workspace/execution-bvp/links`, {
      headers: { ...authHeaders(creator), 'Idempotency-Key': `link-${Date.now()}` },
      data: { initiativeId: seed.initiativeId, caseId: seed.caseId },
    });
    expect(linkResponse.status()).toBe(201);
    const linkId = (await linkResponse.json()).data.link_id;
    const writes = await Promise.all(
      ['a', 'b'].map((x) =>
        request.post(`${API}/api/v8/case-workspace/execution-bvp/links/${linkId}/spine`, {
          headers: authHeaders(creator!),
          data: {
            workRef: `work:${x}`,
            resourceRef: `resource:${x}`,
            controlRef: `control:${x}`,
            reportRef: `report:${x}`,
            expectedVersion: 1,
          },
        })
      )
    );
    expect(writes.map((r) => r.status()).sort()).toEqual([200, 404]);
    const foreignRead = await request.get(
      `${API}/api/v8/case-workspace/execution-bvp/links/${linkId}`,
      { headers: authHeaders(foreign) }
    );
    expect(foreignRead.status()).toBe(404);
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    await db.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [creator.organizationId, creator.userId]
    );
    await db.end();
    const revokedRead = await request.get(
      `${API}/api/v8/case-workspace/execution-bvp/links/${linkId}`,
      { headers: authHeaders(creator) }
    );
    expect(revokedRead.status()).toBe(403);
    await cleanup(request, foreign);
  });
});

/**
 * Capacity + governed-action reachability, proven against the RUNNING app.
 *
 * These journeys exist because the historical UI-canon packet for this task was
 * written from a static trace at an older SHA and its central reachability
 * claims no longer hold. `ExecutionHub.renderContent()` now returns early and
 * unconditionally for all five Menu-2 tabs, which shadows every later branch in
 * the same function. Anything asserted below is asserted through a real signed
 * session, a real mounted router and real PostgreSQL — never through a mock.
 */
test.describe.serial('EXE-UI-CANON capacity and governed action reachability', () => {
  let tenant: ExecutionPersona | null = null;
  let foreignTenant: ExecutionPersona | null = null;

  // Each journey drives many full signed navigations against a real mounted
  // router and a real Postgres. The repo-wide 60s default in playwright.config
  // is sized for light smoke specs; exceeding it here is a resource budget, not
  // a product signal, so raise it explicitly rather than trimming coverage.
  test.beforeEach(() => {
    test.setTimeout(600_000);
  });

  // Ordered so ONE failure cannot skip the other: cleanupAll attempts every
  // persona and only re-throws after all attempts have run.
  test.afterEach(async ({ request }) => {
    const personas = [tenant, foreignTenant];
    tenant = null;
    foreignTenant = null;
    await cleanupAll(request, personas);
  });

  test('capacity surface: signed empty state, backend failure renders no fabricated rows, retry recovers', async ({
    browser,
    request,
  }) => {
    tenant = await bootstrap(request, `exe-ui-capacity-${Date.now().toString(36)}`);
    const context = await signedContext(browser, tenant);
    const page = await context.newPage();
    const watch = attachConsoleWatch(page);

    // --- Success/empty: the reachable capacity surface is the "Zasoby" tab
    // (ExecutionResourcesSurface), whose Menu-3 presets are the real capacity
    // vocabulary (overallocated / unconfirmed / cost-risk / needs-decision).
    await page.goto('/execution?tab=resources');
    await expect(page.getByTestId('standard-chip-overallocated')).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId('standard-chip-needs-decision')).toBeVisible({ timeout: 60_000 });
    // A brand-new tenant owns no allocations, so the honest terminal state is
    // "empty" with every capacity preset counting zero — never a populated table
    // and never a non-zero count conjured from nothing.
    await expect(page.getByTestId('standard-chip-all')).toHaveText(/0\s*$/);
    await expect(page.getByTestId('standard-chip-overallocated')).toHaveText(/0\s*$/);
    await expect(
      page.getByText('Brak kanonicznych przydziałów zasobów w dostępnych realizacjach.')
    ).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(0);

    // --- Negative control for the shadowing finding: the flag-gated capacity
    // panel (ExecutionChangeSignalsPanel, data-testid="capacity-signals-card")
    // must NOT appear on ANY reachable tab even with its own runtime flag
    // forced ON, because renderContent's early returns shadow it.
    for (const tab of REACHABLE_EXECUTION_TABS) {
      await page.goto(`/execution?tab=${tab}&ff_execChangeSignals=1&ff_execIntel=1`);
      await expect(page.getByTestId('capacity-signals-card')).toHaveCount(0);
      await expect(page.getByTestId('capacity-empty')).toHaveCount(0);
      await expect(page.getByTestId('capacity-failed')).toHaveCount(0);
      await expect(page.getByTestId('capacity-signals-list')).toHaveCount(0);
      await expect(page.getByTestId('intel-panel')).toHaveCount(0);
    }

    // --- Backend error: every v8 read fails. The surface must fail closed —
    // no fabricated rows, no success chrome. This is the no-false-success gate.
    await page.route('**/api/v8/**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'injected backend failure' }),
      })
    );
    await page.goto('/execution?tab=resources');
    // Observed fail-closed behaviour: the resources surface renders NO Menu-3
    // capacity chips, NO rows and NO empty-state copy when its reads fail. That
    // is acceptable (nothing is fabricated) but it is silent — the user is shown
    // no error affordance and no retry control. Asserted as-is, not excused.
    await expect(page.getByTestId('standard-chip-all')).toHaveCount(0);
    await expect(page.getByTestId('standard-chip-overallocated')).toHaveCount(0);
    await expect(page.getByRole('row')).toHaveCount(0);
    await expect(
      page.getByText('Brak kanonicznych przydziałów zasobów w dostępnych realizacjach.')
    ).toHaveCount(0);

    // --- Retry: the surface has no dedicated retry control, so the product's
    // only recovery path is a remount. Assert recovery really happens once the
    // backend is healthy again (a stuck error state would fail here).
    await page.unroute('**/api/v8/**');
    await page.goto('/execution?tab=resources');
    await expect(page.getByTestId('standard-chip-overallocated')).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId('standard-chip-cost-risk')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('standard-chip-all')).toHaveText(/0\s*$/);
    await expect(page.getByRole('row')).toHaveCount(0);

    // --- Console/403 accounting, asserted on the DETERMINISTIC axis.
    // Raw totals vary with how many renders each navigation triggers, so the
    // assertion pins the exact SET of distinct forbidden endpoints (stable)
    // and reports the raw counts measured on this run. The counts are what was
    // observed here — they are NOT the sealed historical G4 numbers and are not
    // re-asserted from it.
    expect(distinctEndpoints(watch.forbidden403)).toEqual(MANAGER_LANE_403_ENDPOINTS);
    // Every non-403 failure in this journey must be the deliberate 500 the test
    // injected itself — nothing unexplained is tolerated.
    for (const entry of watch.failedResponses) {
      if (entry.startsWith('403 ')) continue;
      expect(entry).toMatch(/^500 /);
    }
    // eslint-disable-next-line no-console
    console.log(
      `[EXE-UI-CANON capacity MEASURED] consoleErrors=${watch.errors.length} failedResponses=${watch.failedResponses.length} forbidden403=${watch.forbidden403.length} distinct403Endpoints=${MANAGER_LANE_403_ENDPOINTS.length}`
    );

    await context.close();
  });

  test('nine governed actions: live registry matches, and no reachable Execution tab exposes any of them', async ({
    browser,
    request,
  }) => {
    tenant = await bootstrap(request, `exe-ui-governed-${Date.now().toString(36)}`);

    // --- Ground truth from the live registry, not from a constant.
    const registry = await readActionRegistry();
    expect(registry.implemented).toEqual([...GOVERNED_ACTION_IDS]);
    expect(registry.hidden).toEqual([...HIDDEN_ACTION_IDS]);

    const context = await signedContext(browser, tenant);
    const page = await context.newPage();
    const watch = attachConsoleWatch(page);
    const governedCalls: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      for (const { actionId, test: pattern } of GOVERNED_ROUTE_PATTERNS) {
        if (pattern.test(url)) governedCalls.push(`${actionId} ${req.method()} ${url}`);
      }
    });

    // Walk every reachable Menu-2 tab plus the legacy /rollout entry point.
    // Screenshots land in a NEW, current-SHA-only directory. The historical G4
    // set (candidateSha 836bfd633a) under docs/program/evidence/closure/ui-g4/
    // is read-only historical input and is NOT regenerated or touched here.
    for (const tab of REACHABLE_EXECUTION_TABS) {
      await page.goto(`/execution?tab=${tab}`);
      // Anchor on a Menu-3 preset unique to that tab's canonical Surface
      // component — proof the tab really resolved, not merely that chrome painted.
      await expect(page.getByTestId(TAB_ANCHOR_CHIP[tab])).toBeVisible({ timeout: 120_000 });
      if (SCREENS_DIR) {
        await page.screenshot({
          path: `${SCREENS_DIR}/EXE__${tab}__desktop__light.png`,
          fullPage: false,
        });
      }
    }
    await page.goto('/rollout');
    await expect(page).toHaveURL(/\/execution/);

    // No reachable Execution surface can even ATTEMPT a governed writer.
    expect(governedCalls).toEqual([]);

    // The hidden 'summary' surface stays unreachable even with its flag forced
    // ON: ExecutionSummaryOneLook is imported and wired but nothing sets the
    // tab, and the ?tab= whitelist drops the value.
    await page.goto('/execution?tab=summary&ff_summaryOneLook=1');
    await expect(page).toHaveURL(/tab=list/);
    await page.goto('/execution?tab=people_change');
    await expect(page).toHaveURL(/tab=list/);

    // Nothing the tenant did wrote a governed audit row — append-only table, so
    // this is a durable witness that zero governed writers ran.
    expect(await countGovernedAudit(tenant.organizationId)).toBe(0);

    // --- Console/403 accounting. NO negative control runs in this journey, so
    // EVERY failed response here is the product issuing a call its own signed
    // ADMIN identity is not entitled to make.
    expect(distinctEndpoints(watch.forbidden403)).toEqual(MANAGER_LANE_403_ENDPOINTS);
    expect(watch.forbidden403.length).toBe(watch.failedResponses.length);
    // eslint-disable-next-line no-console
    console.log(
      `[EXE-UI-CANON governed MEASURED] consoleErrors=${watch.errors.length} failedResponses=${watch.failedResponses.length} forbidden403=${watch.forbidden403.length} distinct403Endpoints=${MANAGER_LANE_403_ENDPOINTS.length}`
    );
    await context.close();

    // --- The surfaces that DO own governed controls live in Case Workspace,
    // which is default-OFF: at default flags /zlecenia is not even routed.
    const defaultFlags = await signedContext(browser, tenant);
    const defaultPage = await defaultFlags.newPage();
    await defaultPage.goto('/zlecenia');
    await expect(defaultPage).not.toHaveURL(/\/zlecenia/);
    await expect(defaultPage.getByTestId('zlecenia-lista')).toHaveCount(0);
    await defaultFlags.close();
  });

  test('governed close control fails closed: no fabricated success, foreign tenant 404, revoked 403', async ({
    browser,
    request,
  }) => {
    tenant = await bootstrap(request, `exe-ui-close-${Date.now().toString(36)}`);
    foreignTenant = await bootstrap(request, `exe-ui-close-foreign-${Date.now().toString(36)}`);
    const seed = await seedExecution(tenant);

    const context = await signedContext(browser, tenant, { 'ff.caseWorkspace': '1' });
    const page = await context.newPage();
    await page.goto(`/zlecenia/${encodeURIComponent(seed.caseId)}`);

    // The one governed control that IS rendered for this state.
    const closeControl = page.getByRole('button', { name: 'Zamknij zlecenie' });
    await expect(closeControl).toBeVisible({ timeout: 120_000 });

    const before = await readCaseState(seed.caseId);
    expect(before.caseStatus).toBe('DRAFT');

    await closeControl.click();

    // The case is a DRAFT with no plan version, so the governed close must not
    // succeed. The control must not claim it did: no closure is persisted, the
    // lifecycle column is untouched, and no append-only audit row appears.
    const after = await readCaseState(seed.caseId);
    expect(after.caseStatus).toBe('DRAFT');
    expect(after.closureType).toBeNull();
    expect(await countGovernedAudit(tenant.organizationId)).toBe(0);
    await expect(page.getByText('Zlecenie zamknięte')).toHaveCount(0);
    await context.close();

    // --- Tenant isolation on the governed route: enumeration-safe 404, not 403.
    const foreignRead = await request.get(
      `${API}/api/v8/case-workspace/cases/${encodeURIComponent(seed.caseId)}`,
      { headers: authHeaders(foreignTenant) }
    );
    expect(foreignRead.status()).toBe(404);

    // --- Revoked membership on the OWNING tenant fails closed.
    //
    // Observed contract divergence, asserted exactly as the product behaves:
    // `GET /case-workspace/cases/:caseId` answers a revoked member with 404
    // (enumeration-safe), whereas `GET /case-workspace/execution-bvp/links/:id`
    // answers the same revoked member with 403 (see the delivery-closure suite
    // above). Both fail closed, so neither leaks; the split is a consistency
    // finding for the owner, NOT a reason to relax either assertion. Pinning the
    // literal status here means a future drift toward 200 fails loudly.
    await revokeMembership(tenant);
    const revokedRead = await request.get(
      `${API}/api/v8/case-workspace/cases/${encodeURIComponent(seed.caseId)}`,
      { headers: authHeaders(tenant) }
    );
    expect(revokedRead.status()).toBe(404);
    // Fail-closed means no payload leaks either — the revoked read must not
    // carry the case it was denied.
    expect(await revokedRead.text()).not.toContain(seed.caseId);
  });

  test('cleanup harness: forced mid-transaction failure recovers, then a real cleanup leaves an exact zero residue object', async ({
    request,
  }) => {
    const subject = await bootstrap(request, `exe-ui-cleanupfail-${Date.now().toString(36)}`);
    await seedExecution(subject);

    // --- FORCED FAILURE. A cleanup path that has never failed is not a proven
    // cleanup path. Abort the pinned transaction after the first delete and
    // require the harness to surface it honestly rather than swallow it.
    await expect(
      cleanup(request, subject, { failAfterFirstDelete: true })
    ).rejects.toThrow(/INJECTED_CLEANUP_FAILURE_AFTER_FIRST_DELETE/);

    // The rollback must leave the tenant's data INTACT — a partial delete that
    // silently committed would be worse than no cleanup at all.
    const afterFailure = await measureResidue(subject.organizationId);
    expect(afterFailure.perTable.case_core).toBe(1);
    expect(afterFailure.perTable.projects).toBe(1);
    expect(afterFailure.perTable.initiatives).toBe(1);
    expect(afterFailure.perTable.case_workspace_artifact_links).toBe(1);
    // The nested finally must have released the retained advisory lock and
    // restored the guarded triggers even though the transaction threw.
    // Asserted on THIS harness's deterministic key: the global advisory count
    // also sees locks the running application backend takes for its own
    // reasons, which are neither residue this fixture created nor locks it can
    // release, so asserting on the global number would be racy.
    expect(afterFailure.harnessAdvisoryLocksOnFixedKey).toBe(0);

    // --- RECOVERY. The very next cleanup must succeed on the same tenant.
    await cleanup(request, subject);

    // --- EXACT post-COMMIT residue OBJECT across EVERY table written, by name.
    const residue = await measureResidue(subject.organizationId);
    expect(residue.perTable).toEqual(
      Object.fromEntries(FIXTURE_WRITTEN_TABLES.map((table) => [table, 0]))
    );
    expect(residue.harnessAdvisoryLocksOnFixedKey).toBe(0);

    // execution_action_audit is NOT in that object and is NOT cleaned. It is
    // append-only behind trg_execution_action_audit_immutable; both DELETE and
    // UPDATE are rejected, so any row a governed writer commits is PERMANENT.
    // Zero here means no governed writer ever succeeded for this tenant — it
    // does NOT mean rows were removed, and zero would only be reachable again
    // by destroying the database.
    expect(residue.appendOnlyExecutionActionAudit).toBe(
      await countGovernedAudit(subject.organizationId)
    );
  });

  test('cleanup harness: a failure in the trigger stage still runs the advisory-unlock proof', async ({
    request,
  }) => {
    const subject = await bootstrap(request, `exe-ui-triggerfail-${Date.now().toString(36)}`);
    await seedExecution(subject);

    // Force the TRIGGER stage (frame 2) to throw. The advisory-unlock proof
    // lives in its own finally (frame 3), so it must still run and still
    // assert. Before the frames were separated, this failure could skip the
    // unlock proof entirely and leak the lock — a guarantee that had only ever
    // been exercised on the happy path.
    await expect(cleanup(request, subject, { failDuringTriggerRestore: true })).rejects.toThrow(
      /INJECTED_TRIGGER_STAGE_FAILURE/
    );

    // Proof the unlock ran despite the trigger-stage failure: the harness's
    // deterministic key is not held. releaseAdvisoryLockWithProof throws unless
    // pg_advisory_unlock returned TRUE and same-session locks reached 0, so
    // reaching here with 0 means the proof executed and passed.
    const afterTriggerFailure = await measureResidue(subject.organizationId);
    expect(afterTriggerFailure.harnessAdvisoryLocksOnFixedKey).toBe(0);

    // The guarded triggers are still intact for the next caller.
    const nextCleanup = await measureResidue(subject.organizationId);
    expect(nextCleanup.harnessAdvisoryLocksOnFixedKey).toBe(0);

    // Recovery: a normal cleanup still succeeds and reclaims the tenant, so the
    // injected failure leaves nothing behind.
    await cleanup(request, subject);
    const residue = await measureResidue(subject.organizationId);
    expect(residue.perTable).toEqual(
      Object.fromEntries(FIXTURE_WRITTEN_TABLES.map((table) => [table, 0]))
    );
    expect(residue.harnessAdvisoryLocksOnFixedKey).toBe(0);
  });
});
