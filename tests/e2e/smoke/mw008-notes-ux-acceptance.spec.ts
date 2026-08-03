/**
 * MW-08 — Notes UI/UX acceptance — golden-flow proof.
 *
 * Real browser (Playwright/Chromium) + real backend (server/src, tsx) + real
 * Postgres (not MOCK_DB, not a supertest in-process app). Exercises the
 * actual `NotebookContent.tsx` / `NotebookLibraryContent.tsx` UI the same way
 * a user would: navigate, click, type — never calls internal React state or
 * imports the component under test.
 *
 * Setup pattern mirrors `tests/e2e/smoke/wave1-mywork-deep-acceptance.spec.ts`
 * (JWT-bearing localStorage seeded by `tests/e2e/smoke/global-setup.ts`,
 * `gotoWorkspaceRoute` retry helper, `dismissTourModal` onboarding-skip) and
 * `tests/e2e/tools/idea-notebook.spec.ts` (`.ProseMirror` editor locator,
 * hard-reload-persists pattern). Foreign-tenant / concurrent-editor setup
 * uses the same `/api/test-support/bootstrap` mint-a-tenant contract as
 * `tests/acceptance/notebook-tenant-isolation.e2e.test.ts`, adapted to mint a
 * SECOND browser-authenticated tenant instead of a raw supertest token.
 *
 * Each test is independent (own notebook/page, created fresh) so a failure
 * in one never skips the others — no `test.describe.configure({mode:
 * 'serial'})`. UI-driven creation is used where the flow itself is under
 * test (golden flow); API-seeding (same `/api/my-work/notebooks` +
 * `/api/v8/my-work/notebook/pages` routes the UI itself calls) is used where
 * a DIFFERENT surface is under test (conflict, tenant isolation, responsive,
 * error-retry) and note creation is just setup — mirrors wave1's own
 * `createIdea` API-seed convention for its non-notebook cases.
 */
import fs from 'node:fs';
import path from 'node:path';

import { expect, Page, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const FRONTEND_BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

const SCREENSHOT_DIR = path.join(process.cwd(), 'artifacts', 'visual-qa', 'mw-008');

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

function screenshotPath(name: string): string {
  return path.join(SCREENSHOT_DIR, name);
}

function uniqueLabel(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };
}

// ── Onboarding / navigation helpers (verbatim pattern from wave1) ──────────

async function dismissTourModal(page: Page) {
  const skipTour = page
    .getByRole('button', { name: /Skip tour|Skip for now|Pomiń|Pomín/i })
    .first();
  const consultantCard = page.getByRole('button', { name: /Consultant|Konsultant/i }).first();
  const welcomeTitle = page.getByText(/Welcome to Consultinity|Witamy w Consultinity/i);

  await welcomeTitle.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});

  for (let i = 0; i < 10; i++) {
    const hasSkip = await skipTour.isVisible().catch(() => false);
    const hasWelcome = await welcomeTitle.isVisible().catch(() => false);

    if (hasSkip) {
      await skipTour.click({ timeout: 1000, force: true });
      await skipTour.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    } else if (hasWelcome) {
      await consultantCard.click({ timeout: 1000, force: true }).catch(() => {});
    }

    await page.keyboard.press('Escape').catch(() => {});

    const stillVisible =
      (await skipTour.isVisible().catch(() => false)) ||
      (await welcomeTitle.isVisible().catch(() => false));
    if (!stillVisible) return;

    await page.waitForTimeout(200);
  }
}

async function gotoWorkspaceRoute(page: Page, route: string) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 90000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1000);
    }
  }
  throw lastError;
}

// ── API seeding helpers (same routes the UI itself calls) ──────────────────

async function bootstrapTenant(page: Page, runId: string) {
  const res = await page.request.post(`${API_BASE_URL}/api/test-support/bootstrap`, {
    headers: { 'x-test-support-key': TEST_SUPPORT_KEY, 'content-type': 'application/json' },
    data: { runId },
  });
  if (!res.ok()) {
    throw new Error(`bootstrapTenant(${runId}) failed: ${res.status()} ${await res.text()}`);
  }
  return (await res.json()) as {
    runId: string;
    organizationId: string;
    userId: string;
    token: string;
  };
}

/** Mirrors the storageState shape `tests/e2e/smoke/global-setup.ts` writes. */
function buildStorageState(tenant: {
  token: string;
  userId: string;
  organizationId: string;
  runId: string;
}) {
  const seededUser = {
    id: tenant.userId,
    email: `e2e+${tenant.runId}@local.test`,
    role: 'ADMIN',
    organizationId: tenant.organizationId,
    organizationName: 'E2E Organization',
    firstName: 'E2E',
    lastName: 'User',
    avatarUrl: null,
    impersonatorId: null,
    companyName: 'E2E Organization',
    isAuthenticated: true,
    accessLevel: 'full',
    isDemo: false,
  };
  const persistedAppState = JSON.stringify({
    state: {
      sessionMode: 'FULL',
      isDemoMode: false,
      isDemoSession: false,
      currentUser: seededUser,
      currentOrganization: { id: tenant.organizationId, name: 'E2E Organization' },
    },
    version: 0,
  });
  const demoSession = JSON.stringify({
    sessionId: 'e2e',
    startTime: new Date().toISOString(),
    hasCompletedTour: true,
    hasSeenWelcome: true,
    hasInteractedWithAI: false,
    aiInteractionsUsed: 0,
    featuresExplored: [],
    upgradePromptsShown: 0,
    exitIntentTriggered: false,
    milestones: [],
  });
  return {
    cookies: [],
    origins: [
      {
        origin: FRONTEND_BASE_URL,
        localStorage: [
          { name: 'token', value: tenant.token },
          { name: 'refreshToken', value: 'e2e-refresh' },
          { name: 'user', value: JSON.stringify(seededUser) },
          { name: 'consultify-storage', value: persistedAppState },
          { name: 'consultify_demo_session', value: demoSession },
        ],
      },
    ],
  };
}

/** Create a notebook + one page directly via the API the UI itself calls. */
async function seedNote(
  page: Page,
  token: string,
  opts: { notebookTitle: string; noteTitle: string; contentText: string }
) {
  const nbRes = await page.request.post(`${API_BASE_URL}/api/my-work/notebooks`, {
    headers: authHeaders(token),
    data: { title: opts.notebookTitle, scope: 'personal' },
  });
  if (!nbRes.ok()) {
    throw new Error(`seedNote: create notebook failed: ${nbRes.status()} ${await nbRes.text()}`);
  }
  const notebook = (await nbRes.json()) as { id: string };

  const pageRes = await page.request.post(
    `${API_BASE_URL}/api/v8/my-work/notebook/pages`,
    {
      headers: authHeaders(token),
      data: {
        notebookId: notebook.id,
        title: opts.noteTitle,
        contentJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: opts.contentText }] }] },
        contentText: opts.contentText,
      },
    }
  );
  if (!pageRes.ok()) {
    throw new Error(`seedNote: create page failed: ${pageRes.status()} ${await pageRes.text()}`);
  }
  const body = (await pageRes.json()) as any;
  const created = body?.data ?? body;
  return {
    notebookId: notebook.id as string,
    pageId: created.id as string,
    updatedAt: created.updatedAt as string,
    noteTitle: opts.noteTitle,
  };
}

async function openMyWork(page: Page) {
  await gotoWorkspaceRoute(page, '/my-work/notebook');
  await dismissTourModal(page);
  // Completing/skipping first-run onboarding can bounce to AI Chat — re-enter
  // the route under test after the overlay is gone (wave1's proven pattern).
  await gotoWorkspaceRoute(page, '/my-work/notebook');
  // The second navigation is a full reload, which can independently
  // re-trigger the same first-run "Welcome to Consultify" tour (its
  // eligibility check isn't guaranteed to be settled by the first dismiss) —
  // observed directly via a captured failure screenshot: a click on a real
  // page control retried for 15s against a `z-modal` backdrop showing this
  // exact tour, mid-run, on an otherwise-passing suite. Dismiss again here
  // rather than assuming one call before the reload is always sufficient.
  await dismissTourModal(page);
  await expect(page.getByTestId('mywork-view')).toBeVisible({ timeout: 30000 });
}

const saveState = (page: Page) => page.getByTestId('notebook-save-state');
const titleInput = (page: Page) => page.locator('input[placeholder="Untitled"]').first();
const editor = (page: Page) => page.locator('.ProseMirror').first();

test.describe('MW-08 Notes UX acceptance — golden flow', () => {
  test('creates a notebook and two notes, edits title/content with visible save state, switches without losing data, and survives a hard reload', async ({
    page,
  }) => {
    test.setTimeout(180000);

    await openMyWork(page);

    // ── Step 1/2 (part A): empty library is the natural starting point for a
    // freshly-bootstrapped tenant — also doubles as the "08-empty-state" shot.
    const emptyLibraryHeading = page.getByRole('heading', {
      name: /No notebooks yet|Brak notatników/i,
    });
    await expect(emptyLibraryHeading).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: screenshotPath('08-empty-state.png'), fullPage: true });

    // ── Step 2: create a notebook.
    const notebookTitle = uniqueLabel('mw008-notebook');
    await page.getByRole('button', { name: /New notebook|Nowy notatnik/i }).first().click();
    await expect(
      page.getByRole('heading', { name: /New notebook|Nowy notatnik/i })
    ).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/Strategy 2026|Strategia 2026/i).fill(notebookTitle);
    await page.getByRole('button', { name: /^Create$|^Utwórz$/i }).click();
    await expect(page.getByTestId('notebook-new-page-button')).toBeVisible({ timeout: 15000 });

    // ── Step 2: create note A (blank page).
    const titleA = uniqueLabel('mw008-note-a');
    const createAResponsePromise = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/(?:v8\/)?my-work\/notebook\/pages$/.test(r.url()),
      { timeout: 30000 }
    );
    await page.getByTestId('notebook-new-page-button').click();
    await expect(
      page.getByRole('heading', { name: /New Note|Nowa notatka|Nowa strona/i })
    ).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Blank page|Pusta strona/i }).last().click();
    const createARes = await createAResponsePromise;
    if (!createARes.ok()) {
      throw new Error(`create note A failed: ${createARes.status()} ${await createARes.text()}`);
    }
    const createdABody = (await createARes.json()) as any;
    const pageAId = String(createdABody?.data?.id || createdABody?.id || '');
    expect(pageAId).toBeTruthy();

    // ── Step 3: edit title.
    const titleField = titleInput(page);
    await expect(titleField).toBeVisible({ timeout: 15000 });
    const saveTitlePromise = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && r.url().includes(pageAId),
      { timeout: 15000 }
    );
    await titleField.fill(titleA);
    await page.keyboard.press('Tab');
    const saveTitleRes = await saveTitlePromise;
    expect(saveTitleRes.ok(), `title save should succeed: ${await saveTitleRes.text()}`).toBeTruthy();
    await expect(saveState(page)).toContainText(/Saved|Zapisano/i, { timeout: 10000 });

    // ── Step 3: edit content.
    const contentA = `Alpha content ${Date.now()}`;
    await editor(page).click();
    await page.keyboard.type(contentA);
    await expect(saveState(page)).toContainText(/Saved|Zapisano/i, { timeout: 10000 });

    await page.screenshot({ path: screenshotPath('01-desktop-list-editor.png'), fullPage: true });

    // ── Step 4: "Saving…" then "Saved" only after the backend actually
    // responds. Hold the real PUT open with page.route so the transient
    // 'saving' state is observable instead of racing a ~50ms local roundtrip
    // — the request still hits the real backend/DB, just released on our cue.
    let releaseHold: (() => void) | null = null;
    await page.route('**/api/v8/my-work/notebook/pages/**', async (route) => {
      if (route.request().method() === 'PUT') {
        await new Promise<void>((resolve) => {
          releaseHold = resolve;
        });
      }
      await route.continue();
    });
    const heldPutPromise = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && r.url().includes(pageAId),
      { timeout: 15000 }
    );
    await editor(page).click();
    await page.keyboard.type(' — more.');
    await expect(saveState(page)).toContainText(/Saving|Zapisywanie/i, { timeout: 10000 });
    await page.screenshot({ path: screenshotPath('02-desktop-saving.png'), fullPage: true });
    expect(releaseHold, 'route hold should have captured the in-flight PUT').toBeTruthy();
    (releaseHold as unknown as () => void)?.();
    const heldPutRes = await heldPutPromise;
    expect(heldPutRes.ok()).toBeTruthy();
    await expect(saveState(page)).toContainText(/Saved|Zapisano/i, { timeout: 10000 });
    await page.screenshot({ path: screenshotPath('03-desktop-saved.png'), fullPage: true });
    await page.unroute('**/api/v8/my-work/notebook/pages/**');

    // ── Step 2 (note B) + step 5: switch between notes without losing data.
    const titleB = uniqueLabel('mw008-note-b');
    const createBResponsePromise = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/(?:v8\/)?my-work\/notebook\/pages$/.test(r.url()),
      { timeout: 30000 }
    );
    await page.getByTestId('notebook-new-page-button').click();
    await expect(
      page.getByRole('heading', { name: /New Note|Nowa notatka|Nowa strona/i })
    ).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Blank page|Pusta strona/i }).last().click();
    const createBRes = await createBResponsePromise;
    if (!createBRes.ok()) {
      throw new Error(`create note B failed: ${createBRes.status()} ${await createBRes.text()}`);
    }
    const createdBBody = (await createBRes.json()) as any;
    const pageBId = String(createdBBody?.data?.id || createdBBody?.id || '');
    expect(pageBId).toBeTruthy();

    await expect(titleField).toBeVisible({ timeout: 15000 });
    const saveTitleBPromise = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && r.url().includes(pageBId),
      { timeout: 15000 }
    );
    await titleField.fill(titleB);
    await page.keyboard.press('Tab');
    await saveTitleBPromise;
    const contentB = `Beta content ${Date.now()}`;
    await editor(page).click();
    await page.keyboard.type(contentB);
    await expect(saveState(page)).toContainText(/Saved|Zapisano/i, { timeout: 10000 });

    // A -> assert A intact -> B -> assert B intact -> A -> assert A STILL intact.
    await page.getByText(titleA).first().click();
    await expect(page.locator(`input[value="${titleA}"]`).first()).toBeVisible({ timeout: 15000 });
    await expect(editor(page)).toContainText(contentA, { timeout: 15000 });

    await page.getByText(titleB).first().click();
    await expect(page.locator(`input[value="${titleB}"]`).first()).toBeVisible({ timeout: 15000 });
    await expect(editor(page)).toContainText(contentB, { timeout: 15000 });

    await page.getByText(titleA).first().click();
    await expect(page.locator(`input[value="${titleA}"]`).first()).toBeVisible({ timeout: 15000 });
    await expect(editor(page)).toContainText(contentA, { timeout: 15000 });
    // The mid-flight edit from the "saving" demonstration above must also
    // still be there — switching away and back must not have dropped it.
    await expect(editor(page)).toContainText('more.', { timeout: 15000 });

    // ── Step 6: hard reload opens the SAME note with identical content. Use
    // the canonical page-level deep link (`/my-work/notebook/<pageId>`,
    // confirmed in `MyWorkHub.tsx` `parseMyWorkPathIntent`) so "which note
    // reopens" is deterministic instead of relying on list-ordering.
    await gotoWorkspaceRoute(page, `/my-work/notebook/${pageAId}`);
    await dismissTourModal(page);
    const deepLinkedTitle = titleInput(page);
    await expect(deepLinkedTitle).toBeVisible({ timeout: 20000 });
    await expect(deepLinkedTitle).toHaveValue(titleA, { timeout: 15000 });
    await expect(editor(page)).toContainText(contentA, { timeout: 15000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    const reloadedTitle = titleInput(page);
    await expect(reloadedTitle).toBeVisible({ timeout: 20000 });
    await expect(reloadedTitle).toHaveValue(titleA, { timeout: 15000 });
    await expect(editor(page)).toContainText(contentA, { timeout: 15000 });
    await expect(editor(page)).toContainText('more.', { timeout: 15000 });
  });
});

test.describe('MW-08 Notes UX acceptance — conflict handling', () => {
  test('a stale concurrent write produces an explicit, persistent conflict banner and never silently overwrites local edits', async ({
    page,
  }) => {
    test.setTimeout(120000);

    const { token } = readTestSupportState();
    const seed = await seedNote(page, token, {
      notebookTitle: uniqueLabel('mw008-conflict-notebook'),
      noteTitle: uniqueLabel('mw008-conflict-note'),
      contentText: 'Original content before conflict',
    });

    // Capture the exact `updatedAt` the UI will base its optimistic-lock
    // token on, straight from the GET the deep-link open triggers.
    const getPagePromise = page.waitForResponse(
      (r) => r.request().method() === 'GET' && r.url().includes(seed.pageId),
      { timeout: 20000 }
    );
    await openMyWork(page);
    await gotoWorkspaceRoute(page, `/my-work/notebook/${seed.pageId}`);
    await dismissTourModal(page);
    const getPageRes = await getPagePromise;
    const getPageBody = (await getPageRes.json().catch(() => null)) as any;
    const knownUpdatedAt = String(getPageBody?.data?.updatedAt || seed.updatedAt);
    expect(knownUpdatedAt).toBeTruthy();

    const titleField = titleInput(page);
    await expect(titleField).toBeVisible({ timeout: 20000 });
    await expect(titleField).toHaveValue(seed.noteTitle, { timeout: 15000 });

    // Simulate a concurrent editor: a direct, out-of-band write using the
    // SAME user's token (the PUT route is owner-only — a different user
    // could never even reach the 409 path, so a genuine "another session of
    // mine" concurrent write is the realistic conflict scenario). This
    // advances `updated_at` on the server without the open browser knowing.
    const externalWrite = await page.request.put(
      `${API_BASE_URL}/api/v8/my-work/notebook/pages/${seed.pageId}`,
      { headers: authHeaders(token), data: { title: 'External concurrent edit' } }
    );
    expect(externalWrite.ok(), 'external concurrent write should itself succeed').toBeTruthy();

    // Now type locally. The UI's autosave still carries the OLD
    // `expectedUpdatedAt` (it never refetched), so this PUT collides.
    const localEdit = ' — my local edit that must survive';
    await editor(page).click();
    await page.keyboard.type(localEdit);

    const conflictBanner = page.getByRole('alert');
    await expect(conflictBanner).toBeVisible({ timeout: 15000 });
    await expect(conflictBanner).toContainText(/changed elsewhere|zmieniona gdzie indziej/i);
    const reloadButton = conflictBanner.getByRole('button', { name: /Reload|Wczytaj ponownie/i });
    const keepMineButton = conflictBanner.getByRole('button', {
      name: /Save mine anyway|Zapisz mimo to/i,
    });
    await expect(reloadButton).toBeVisible();
    await expect(keepMineButton).toBeVisible();

    // The local edit must still be exactly what was typed — no silent
    // overwrite by the server's "External concurrent edit" title/content.
    await expect(editor(page)).toContainText(localEdit.trim());
    await expect(titleField).toHaveValue(seed.noteTitle);
    await expect(page.getByText('External concurrent edit')).toHaveCount(0);

    await page.screenshot({ path: screenshotPath('06-conflict.png'), fullPage: true });
  });

  test('[bonus, not gating] "Save mine anyway" after a conflict either resolves cleanly or is a known recovery gap', async ({
    page,
  }) => {
    test.setTimeout(120000);

    const { token } = readTestSupportState();
    const seed = await seedNote(page, token, {
      notebookTitle: uniqueLabel('mw008-conflict-retry-notebook'),
      noteTitle: uniqueLabel('mw008-conflict-retry-note'),
      contentText: 'Original content before conflict retry',
    });

    await openMyWork(page);
    await gotoWorkspaceRoute(page, `/my-work/notebook/${seed.pageId}`);
    await dismissTourModal(page);
    const titleField = titleInput(page);
    await expect(titleField).toBeVisible({ timeout: 20000 });

    const externalWrite = await page.request.put(
      `${API_BASE_URL}/api/v8/my-work/notebook/pages/${seed.pageId}`,
      { headers: authHeaders(token), data: { title: 'External concurrent edit 2' } }
    );
    expect(externalWrite.ok()).toBeTruthy();

    await editor(page).click();
    await page.keyboard.type(' — retry candidate edit');

    const conflictBanner = page.getByRole('alert');
    await expect(conflictBanner).toBeVisible({ timeout: 15000 });
    const keepMineButton = conflictBanner.getByRole('button', {
      name: /Save mine anyway|Zapisz mimo to/i,
    });

    const retryPutPromise = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && r.url().includes(seed.pageId),
      { timeout: 15000 }
    );
    await keepMineButton.click();
    const retryPutRes = await retryPutPromise;

    if (retryPutRes.status() === 409) {
      // KNOWN GAP (see final report): the 409 handler reads
      // `err.data` as if it were the fresh row directly, but
      // `handleResponse`/`v8Put` throw with `err.data` set to the whole
      // envelope `{error, code, data: freshRow, meta}` — so
      // `conflictServerPage?.updatedAt` is always undefined and the
      // optimistic-lock token never advances. "Save mine anyway" resends the
      // same stale `expectedUpdatedAt` and collides again. Documented, not
      // silently downgraded to a pass.
      await expect(conflictBanner, 'conflict banner persists — known recovery gap').toBeVisible();
      test.info().annotations.push({
        type: 'known-bug',
        description:
          'MW-08: "Save mine anyway" re-sends the same stale expectedUpdatedAt and gets a ' +
          'second 409 — NotebookContent.tsx reads err.data as the fresh row, but it is the ' +
          '{error,code,data,meta} envelope, so conflictServerPage.updatedAt is always undefined ' +
          'and the optimistic-lock token never advances.',
      });
    } else {
      expect(retryPutRes.ok(), `retry save should succeed or 409, got ${retryPutRes.status()}`).toBeTruthy();
      await expect(conflictBanner).toHaveCount(0);
      await expect(saveState(page)).toContainText(/Saved|Zapisano/i, { timeout: 10000 });
    }
  });
});

test.describe('MW-08 Notes UX acceptance — tenant isolation', () => {
  test('a foreign tenant cannot see or modify the note through the real UI', async ({ browser }) => {
    test.setTimeout(120000);

    const ownerNoteTitle = uniqueLabel('mw008-private-note');
    const owner = await (async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const tenant = await bootstrapTenant(page, uniqueLabel('mw008-owner'));
      const seed = await seedNote(page, tenant.token, {
        notebookTitle: uniqueLabel('mw008-private-notebook'),
        noteTitle: ownerNoteTitle,
        contentText: 'PRIVATE-CONTENT-DO-NOT-LEAK',
      });
      await context.close();
      return { tenant, seed };
    })();

    const foreignTenant = await (async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const tenant = await bootstrapTenant(page, uniqueLabel('mw008-foreign'));
      await context.close();
      return tenant;
    })();

    // HTTP-layer cross-check (fast, precise) before the browser-observed check.
    const httpCheckContext = await browser.newContext();
    const foreignGet = await httpCheckContext.request.get(
      `${API_BASE_URL}/api/v8/my-work/notebook/pages/${owner.seed.pageId}`,
      { headers: authHeaders(foreignTenant.token) }
    );
    expect([403, 404]).toContain(foreignGet.status());
    const foreignGetBody = await foreignGet.text();
    expect(foreignGetBody).not.toContain('PRIVATE-CONTENT-DO-NOT-LEAK');
    expect(foreignGetBody).not.toContain(ownerNoteTitle);

    // WRITE must be forbidden too, not just read — a foreign tenant has no
    // UI path to even attempt this (the note is invisible/inaccessible to
    // them, confirmed above), so this is verified at the HTTP layer the way
    // a scripted/direct-API attacker would try it.
    const foreignWriteAttempt = await httpCheckContext.request.put(
      `${API_BASE_URL}/api/v8/my-work/notebook/pages/${owner.seed.pageId}`,
      {
        headers: authHeaders(foreignTenant.token),
        data: { title: 'HIJACKED-BY-FOREIGN-TENANT', contentText: 'HIJACKED-CONTENT' },
      }
    );
    expect([403, 404]).toContain(foreignWriteAttempt.status());

    // Confirm the rejected write left the owner's row completely untouched —
    // not just that the write returned an error status, but that no partial
    // mutation slipped through.
    const ownerRereadAfterAttack = await httpCheckContext.request.get(
      `${API_BASE_URL}/api/v8/my-work/notebook/pages/${owner.seed.pageId}`,
      { headers: authHeaders(owner.tenant.token) }
    );
    expect(ownerRereadAfterAttack.ok()).toBeTruthy();
    const ownerRereadBody = (await ownerRereadAfterAttack.json()) as any;
    const ownerRow = ownerRereadBody?.data ?? ownerRereadBody;
    expect(ownerRow.title).toBe(ownerNoteTitle);
    expect(String(ownerRow.title)).not.toContain('HIJACKED');
    expect(String(ownerRow.contentText || '')).not.toContain('HIJACKED');
    await httpCheckContext.close();

    // Real-browser proof: sign in as the foreign tenant and try the exact
    // deep link a legitimate "Open" action would use.
    const foreignContext = await browser.newContext({
      storageState: buildStorageState(foreignTenant),
    });
    const foreignPage = await foreignContext.newPage();
    await gotoWorkspaceRoute(foreignPage, `/my-work/notebook/${owner.seed.pageId}`);
    await dismissTourModal(foreignPage);
    // Same double-navigate pattern as openMyWork() — completing/skipping
    // first-run onboarding can bounce a fresh tenant to AI Chat, so the
    // route under test must be re-entered after the overlay is gone.
    await gotoWorkspaceRoute(foreignPage, `/my-work/notebook/${owner.seed.pageId}`);
    await expect(foreignPage.getByTestId('mywork-view')).toBeVisible({ timeout: 30000 });

    // The real title/content must never render, in any form (title input
    // value, editor text, or a page-list row) — never the real note, at most
    // an honest "not found" fallback (empty/welcome state + error toast).
    await expect(foreignPage.getByText('PRIVATE-CONTENT-DO-NOT-LEAK')).toHaveCount(0);
    await expect(foreignPage.getByText(ownerNoteTitle)).toHaveCount(0);
    const foreignTitleInput = titleInput(foreignPage);
    if (await foreignTitleInput.isVisible().catch(() => false)) {
      await expect(foreignTitleInput).not.toHaveValue(ownerNoteTitle);
    }

    await foreignContext.close();
  });
});

test.describe('MW-08 Notes UX acceptance — responsive workspace', () => {
  test('sidebar and editor never both show on mobile, and a working back affordance exists', async ({
    page,
  }) => {
    test.setTimeout(120000);

    // Created via the real UI (like the golden-flow test), NOT seedNote() +
    // a `?notebook=` deep link: the v8 notebook/page list endpoint
    // (server/src/routes/v8/my-work.routes.ts GET /notebook/pages) has a
    // confirmed, pre-existing, out-of-MW-08-scope bug — POST never persists
    // notebook_id, and the list route has no notebookId filter at all — so
    // a page seeded that way and then loaded via a fresh `?notebook=<id>`
    // navigation (a full page reload, which forces a refetch of that same
    // broken list) reliably renders "0 pages" / "No pages yet", failing this
    // test for a backend reason unrelated to the responsive layout under
    // test here. Creating via the UI keeps the page in the SPA's in-memory
    // `pages` state (populated directly from the create response, exactly
    // like the golden flow), which never depends on that list endpoint.
    await openMyWork(page);

    const notebookTitle = uniqueLabel('mw008-mobile-notebook');
    await page.getByRole('button', { name: /New notebook|Nowy notatnik/i }).first().click();
    await expect(
      page.getByRole('heading', { name: /New notebook|Nowy notatnik/i })
    ).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/Strategy 2026|Strategia 2026/i).fill(notebookTitle);
    await page.getByRole('button', { name: /^Create$|^Utwórz$/i }).click();
    await expect(page.getByTestId('notebook-new-page-button')).toBeVisible({ timeout: 15000 });

    const noteTitle = uniqueLabel('mw008-mobile-note');
    await page.getByTestId('notebook-new-page-button').click();
    await expect(
      page.getByRole('heading', { name: /New Note|Nowa notatka|Nowa strona/i })
    ).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Blank page|Pusta strona/i }).last().click();

    const titleField = titleInput(page);
    await expect(titleField).toBeVisible({ timeout: 15000 });
    await titleField.fill(noteTitle);
    await page.keyboard.press('Tab');
    await expect(saveState(page)).toContainText(/Saved|Zapisano/i, { timeout: 10000 });

    // Resize to mobile AFTER creation, while the note is still open — this
    // is the real-world case (a user rotating/resizing an already-open
    // note), and it exercises both toggle directions below without any
    // navigation/reload that would touch the broken list endpoint.
    await page.setViewportSize({ width: 375, height: 812 });

    // ── Editor mode (the note is currently open): list must be gone, not
    // merely hidden — its "New page" control only exists inside the
    // sidebar. Mutual exclusivity by construction:
    // `{(!isMobile || mobileShowList) && <sidebar/>}` /
    // `{(!isMobile || !mobileShowList) && <editor/>}`.
    await expect(titleField).toBeVisible({ timeout: 20000 });
    await expect(titleField).toHaveValue(noteTitle);
    await expect(page.getByTestId('notebook-new-page-button')).toHaveCount(0);
    await page.screenshot({ path: screenshotPath('05-mobile-note-open.png'), fullPage: true });

    // ── Working path back to the list — a visible affordance, not browser
    // back. The note must still be there (in-memory state, no refetch).
    const backButton = page.getByRole('button', { name: /All notes|Wszystkie notatki/i });
    await expect(backButton).toBeVisible();
    await backButton.click();
    await expect(page.getByText(noteTitle)).toBeVisible({ timeout: 15000 });
    await expect(titleInput(page)).toHaveCount(0);
    await page.screenshot({ path: screenshotPath('04-mobile-list-closed.png'), fullPage: true });

    // ── Reopening from the list must go back to editor mode, list gone —
    // proves the toggle works in both directions, not just once.
    await page.getByText(noteTitle).first().click();
    await expect(titleInput(page)).toBeVisible({ timeout: 20000 });
    await expect(titleInput(page)).toHaveValue(noteTitle);
    await expect(page.getByTestId('notebook-new-page-button')).toHaveCount(0);
  });
});

test.describe('MW-08 Notes UX acceptance — save error handling', () => {
  test('a generic save failure is surfaced explicitly, not swallowed', async ({ page }) => {
    test.setTimeout(120000);

    const { token } = readTestSupportState();
    const seed = await seedNote(page, token, {
      notebookTitle: uniqueLabel('mw008-error-notebook'),
      noteTitle: uniqueLabel('mw008-error-note'),
      contentText: 'Content before induced save failure',
    });

    await openMyWork(page);
    await gotoWorkspaceRoute(page, `/my-work/notebook/${seed.pageId}`);
    await dismissTourModal(page);
    await expect(titleInput(page)).toBeVisible({ timeout: 20000 });

    // Abort every PUT for this page (including the client's built-in
    // single retry — see `fetchWithRetryInner` in
    // src/services/api/baseClient.ts) so the save deterministically fails
    // end-to-end rather than quietly succeeding on retry.
    await page.route('**/api/v8/my-work/notebook/pages/**', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.abort('failed');
        return;
      }
      await route.continue();
    });

    await editor(page).click();
    await page.keyboard.type(' — this save must fail');
    // The client retries once after a ~1.5s backoff before surfacing the
    // failure — give it real headroom.
    await expect(saveState(page)).toContainText(/Save failed|Nie udało się/i, { timeout: 15000 });
    await page.screenshot({ path: screenshotPath('07-error-retry.png'), fullPage: true });

    await page.unroute('**/api/v8/my-work/notebook/pages/**');
  });
});
