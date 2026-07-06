/**
 * Sheet / Workbook — cell edit + reload persistence.
 *
 * Route identity: /my-work/sheets/:workspaceId/tables/:tableId is a redirect
 * shell (MyWorkSheetsDeepLinkRedirect, AppRoutes.tsx:495-516) that immediately
 * navigates to the SAME table-platform grid Ideas Table uses:
 *   /my-work/ideas/:workspaceId/workspace/table?tpTable=:tableId
 * i.e. "Sheet/Workbook" and "Ideas Table" share one grid implementation
 * (GridView.tsx, data-testid="table-grid" / "table-row-{id}"). This spec
 * drives that canonical route directly (equivalent coverage, avoids an extra
 * client-side redirect hop).
 *
 * Editable surface used here: the toolbar "Add blank row" action (title
 * attribute, proven stable in m08-table-acceptance.spec.ts S05/S16) is the
 * most reliable cross-run mutation -- inline cell text editing in this grid
 * has no data-testid on individual cells, so row-count is the deterministic
 * persistence probe (same approach as the existing M08 S16 test).
 */
import { expect, Page, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

async function createIdea(page: Page, token: string, title: string) {
  const res = await page.request.post(`${API_BASE_URL}/api/my-work/my-ideas`, {
    headers: authHeaders(token),
    data: { title, body: `E2E sheet seed for ${title}`, tags: ['e2e', 'sheet'] },
  });
  if (!res.ok()) throw new Error(`createIdea failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as { id: string };
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

function byTitle(page: Page, title: string) {
  return page.locator(`[title="${title}"]`).first();
}

test.describe('Sheet / Workbook (table-platform grid) — edit persistence [@module:sheets]', () => {
  test.setTimeout(90000);

  test('adding a row persists across a full reload', async ({ page }) => {
    const { token, userId } = readTestSupportState();
    await page.addInitScript((uid: string) => {
      try {
        if (uid) localStorage.setItem(`consultify_onboarding_done:${uid}`, 'true');
      } catch {
        /* ignore */
      }
    }, userId);

    const idea = await createIdea(page, token, `E2E Sheet ${Date.now()}`);
    await gotoTable(page, idea.id);
    await dismissOnboarding(page);

    await expect(
      page.getByRole('region', { name: /Idea map workspace|Obszar roboczy mapy idei/ })
    ).toBeVisible({ timeout: 30000 });

    const rowLocator = page.locator('[data-testid^="table-row-"]');
    const rowCountBefore = await rowLocator.count();

    const addBlankRow = byTitle(page, 'Add blank row');
    await expect(addBlankRow).toBeVisible({ timeout: 30000 });
    await addBlankRow.click({ force: true });

    await expect(page.getByText(/Coś poszło nie tak|Something went wrong/i)).toHaveCount(0);
    await expect(rowLocator).toHaveCount(rowCountBefore + 1, { timeout: 10000 });

    // Give the map-sync optimistic write time to flush before reload (matches
    // the proven S16 pattern in tests/e2e/smoke/m08-table-acceptance.spec.ts).
    await page.waitForTimeout(2500);

    await gotoTable(page, idea.id);
    await dismissOnboarding(page);
    await expect(
      page.getByRole('region', { name: /Idea map workspace|Obszar roboczy mapy idei/ })
    ).toBeVisible({ timeout: 30000 });

    // KEY ASSERT: the added row survived the reload.
    await expect(page.locator('[data-testid^="table-row-"]')).toHaveCount(rowCountBefore + 1, {
      timeout: 15000,
    });
  });
});
