/**
 * E2E smoke test for the Consultify governance loop.
 *
 * Drives a static, dependency-free harness through 4 scenario steps:
 *   1. Watchlist receives a `BLOCKED_P0` deck.
 *   2. Worker dry-run produces an alert dispatch (`dispatched` counter).
 *   3. Ops-health rollup picks up the dispatch as `sent`.
 *   4. Audit log surfaces the matching `governance_alert_dispatched` row.
 *
 * The harness is loaded via `file://` so no Vite/backend boot is needed.
 * This keeps the test deterministic and fast (~8s for 4 tests).
 */

import { expect, test } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const harness = pathToFileURL(resolve(here, 'fixtures/governance-loop-harness.html')).toString();

test.describe('Presentations governance loop smoke', () => {
  test('deck BLOCKED_P0 → worker dispatch → ops-health → audit row', async ({ page }) => {
    await page.goto(harness);

    await expect(page.locator('#watchlist-body tr')).toHaveCount(0);
    await expect(page.locator('#alerts-sent')).toHaveText('0');
    await expect(page.locator('#audit-list li')).toHaveCount(0);

    await page.evaluate(() => (window as unknown as { runScenario: (n: number) => void }).runScenario(1));
    await expect(page.locator('#watchlist-body tr')).toHaveCount(1);
    const row = page.locator('#watchlist-body tr[data-deck-id="deck_p0"]');
    await expect(row).toBeVisible();
    await expect(row.locator('.verdict-pill')).toHaveText('BLOCKED_P0');

    await page.evaluate(() => (window as unknown as { runScenario: (n: number) => void }).runScenario(2));
    await expect(page.locator('#alerts-dispatched')).toHaveText('1');

    await page.evaluate(() => (window as unknown as { runScenario: (n: number) => void }).runScenario(3));
    await expect(page.locator('#alerts-sent')).toHaveText('1');

    await page.evaluate(() => (window as unknown as { runScenario: (n: number) => void }).runScenario(4));
    await expect(
      page.locator('#audit-list li[data-action="governance_alert_dispatched"]')
    ).toHaveCount(1);
    await expect(
      page.locator('#audit-list li[data-action="governance_alert_dispatched"]')
    ).toHaveText(/deck_p0/);

    await expect(page.locator('#watchlist-body tr[data-deck-id="deck_p0"]')).toBeVisible();
    await expect(page.locator('#alerts-sent')).not.toHaveText('0');
  });

  test('audit row format includes governance_alert_dispatched action and deck id', async ({
    page,
  }) => {
    await page.goto(harness);
    await page.evaluate(() => {
      const w = window as unknown as { runScenario: (n: number) => void };
      w.runScenario(1);
      w.runScenario(4);
    });
    const li = page.locator('#audit-list li').first();
    await expect(li).toHaveAttribute('data-action', 'governance_alert_dispatched');
    await expect(li).toHaveAttribute('data-deck-id', 'deck_p0');
  });

  test('worker dry-run does not advance ops-health "sent" counter', async ({ page }) => {
    await page.goto(harness);
    await page.evaluate(() => (window as unknown as { runScenario: (n: number) => void }).runScenario(2));
    await expect(page.locator('#alerts-dispatched')).toHaveText('1');
    await expect(page.locator('#alerts-sent')).toHaveText('0');
  });

  test('mock API surface exposes governance + ops-health + audit endpoints', async ({ page }) => {
    await page.goto(harness);
    const keys = await page.evaluate(() =>
      Object.keys((window as unknown as { __mockApi: Record<string, unknown> }).__mockApi).sort()
    );
    expect(keys).toEqual([
      '/api/presentations/decks/deck_p0/audit-log',
      '/api/presentations/governance/alerts/dry-run',
      '/api/presentations/governance/watchlist',
      '/api/presentations/operations/health',
    ]);
  });
});
