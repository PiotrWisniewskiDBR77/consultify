/**
 * Multiplayer collaboration — Ideas Table, two real browser contexts.
 *
 * Two independent Playwright BrowserContexts (two separate users, same org via
 * bootstrap/register-demo -- both land in the seeded E2E organization under
 * MOCK_DB) open the SAME idea's Table workspace. User A adds a row; User B
 * reloads and must see it.
 *
 * Why this is a valid proof under E2E_MOCK_DB=true: the mock database
 * (server/src/database/Database.ts:158-176, createMockDatabase) is a SINGLE
 * module-level object cached on `globalThis`/`process` (setToGlobal,
 * Database.ts:59-61) holding `Map`-backed tables. Because playwright.config.ts
 * runs ONE backend process for the whole run (`webServer` in
 * playwright.config.ts, MOCK_DB=true, reuseExistingServer per test file), both
 * browser contexts' HTTP requests land on the SAME Node process and therefore
 * the SAME mock store -- state genuinely crosses contexts, this is not a
 * simulated/faked cross-user proof.
 *
 * We assert via reload (not push), because the realtime channel for this grid
 * is Socket.IO (`/table-platform` namespace, useTableRealtime.ts) and this
 * suite does not attempt to drive a live push assertion (see
 * collab-realtime-note.spec.ts for why: flaky under headless timing without a
 * dedicated wait-for-socket-event hook). Reload-based persistence is the
 * honest, deterministic proof available here.
 */
import { expect, Page, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

async function secondUserToken(page: Page): Promise<string> {
  const runId = `collab-b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const bootstrap = await page.request
    .post(`${API_BASE_URL}/api/test-support/bootstrap`, {
      headers: { 'x-test-support-key': TEST_SUPPORT_KEY, 'content-type': 'application/json' },
      data: { runId },
    })
    .catch(() => null);
  if (bootstrap && bootstrap.ok()) {
    const payload = (await bootstrap.json()) as { token?: string };
    if (payload?.token) return String(payload.token);
  }
  const reg = await page.request
    .post(`${API_BASE_URL}/api/auth/register-demo`, {
      data: { email: `e2e+${runId}@local.test`, password: 'Playwright#123', firstName: 'Member' },
    })
    .catch(() => null);
  if (reg && reg.ok()) {
    const payload = (await reg.json()) as any;
    return String(payload?.token || payload?.accessToken || '');
  }
  return '';
}

async function seedAuthForToken(page: Page, token: string, label: string) {
  await page.addInitScript(
    ({ t, l }: { t: string; l: string }) => {
      localStorage.setItem('token', t);
      localStorage.setItem('refreshToken', 'e2e-refresh');
      const user = {
        id: `e2e-${l}`,
        email: `e2e-${l}@local.test`,
        role: 'ADMIN',
        organizationId: 'e2e-org-id',
        organizationName: 'E2E Organization',
        firstName: l,
        lastName: 'User',
        isAuthenticated: true,
        accessLevel: 'full',
      };
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem(
        'consultinity-storage',
        JSON.stringify({
          state: {
            sessionMode: 'FULL',
            currentUser: user,
            currentOrganization: { id: 'e2e-org-id', name: 'E2E Organization' },
          },
          version: 0,
        })
      );
      localStorage.setItem(`consultify_onboarding_done:e2e-${l}`, 'true');
    },
    { t: token, l: label }
  );
}

async function dismissOnboarding(page: Page) {
  for (let i = 0; i < 6; i += 1) {
    let acted = false;
    for (const re of [
      /Skip for now|Pomiń na razie|Pomiń/i,
      /Skip tour|Pomiń wycieczkę/i,
      /Get started|Zaczynaj|Rozpocznij/i,
    ]) {
      const btn = page.getByRole('button', { name: re }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 1000, force: true }).catch(() => {});
        acted = true;
      }
    }
    await page.keyboard.press('Escape').catch(() => {});
    if (!acted) break;
    await page.waitForTimeout(250);
  }
}

async function gotoTable(page: Page, ideaId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(`/my-work/ideas/${ideaId}/workspace/table`, {
        waitUntil: 'domcontentloaded',
        timeout: 90000,
      });
      return;
    } catch {
      await page.waitForTimeout(1000);
    }
  }
}

function byTitle(page: Page, title: string) {
  return page.locator(`[title="${title}"]`).first();
}

test.describe('Collab — Ideas Table, two users same org [@module:collab]', () => {
  test.setTimeout(120000);

  test('user A adds a row; user B sees it after reload (shared mock-DB proof)', async ({
    browser,
  }) => {
    const ownerState = readTestSupportState();

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await seedAuthForToken(pageA, ownerState.token, 'owner');

    // Seed the shared idea via API (owner token) BEFORE either UI session opens it.
    const createRes = await pageA.request.post(`${API_BASE_URL}/api/my-work/my-ideas`, {
      headers: authHeaders(ownerState.token),
      data: { title: `E2E Collab Table ${Date.now()}`, body: 'two-user collab seed', tags: ['e2e', 'collab'] },
    });
    expect(createRes.ok(), `create idea -> ${createRes.status()}`).toBe(true);
    const idea = (await createRes.json()) as { id: string };

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    const memberToken = await secondUserToken(pageB);
    test.skip(!memberToken, 'Could not acquire a second user token (test-support/register-demo unavailable).');
    await seedAuthForToken(pageB, memberToken, 'member');

    // Both users open the same table workspace.
    await gotoTable(pageA, idea.id);
    await dismissOnboarding(pageA);
    await expect(
      pageA.getByRole('region', { name: /Idea map workspace|Obszar roboczy mapy idei/ })
    ).toBeVisible({ timeout: 30000 });

    await gotoTable(pageB, idea.id);
    await dismissOnboarding(pageB);
    await expect(
      pageB.getByRole('region', { name: /Idea map workspace|Obszar roboczy mapy idei/ })
    ).toBeVisible({ timeout: 30000 });

    const rowsB = pageB.locator('[data-testid^="table-row-"]');
    const rowCountBefore = await rowsB.count();

    // User A mutates: add a blank row.
    const addBlankRow = byTitle(pageA, 'Add blank row');
    await expect(addBlankRow).toBeVisible({ timeout: 30000 });
    await addBlankRow.click({ force: true });
    await expect(pageA.getByText(/Coś poszło nie tak|Something went wrong/i)).toHaveCount(0);

    // Give the map-sync write time to land on the shared mock-DB store.
    await pageA.waitForTimeout(2500);

    // User B reloads and must see the new row -- proves the mutation reached
    // shared backend state, not just user A's local React state.
    await gotoTable(pageB, idea.id);
    await dismissOnboarding(pageB);
    await expect(
      pageB.getByRole('region', { name: /Idea map workspace|Obszar roboczy mapy idei/ })
    ).toBeVisible({ timeout: 30000 });

    await expect(pageB.locator('[data-testid^="table-row-"]')).toHaveCount(rowCountBefore + 1, {
      timeout: 15000,
    });

    await contextA.close();
    await contextB.close();
  });
});
