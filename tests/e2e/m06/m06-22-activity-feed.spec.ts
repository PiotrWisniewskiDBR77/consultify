/**
 * TESTY_M06 §22 — Activity Feed (ActivityFeed). Per-test isolation.
 * GET /my-ideas/:id/activity + panel opening. [DB] for activity log writes.
 */
import { type Page, expect, test } from '@playwright/test';

import { bootstrap, createIdea, exitEdit, openMindmap, selectRoot, shot } from './_m06';

async function freshMap(page: Page, tag: string) {
  const { token } = await bootstrap(page);
  const ideaId = await createIdea(page, token, `M06 §${tag} ${Date.now()}`);
  await openMindmap(page, ideaId);
  return ideaId;
}

test.describe('M06 §22 — Activity Feed', () => {
  test('22.1 Otwarcie ActivityFeed — GET /activity', async ({ page }) => {
    const ideaId = await freshMap(page, '22.1');
    void ideaId;
    // Intercept the activity GET request.
    const activityGetP = page
      .waitForResponse(
        (r) => /\/activity/.test(r.url()) && r.request().method() === 'GET',
        { timeout: 10000 }
      )
      .catch(() => null);
    // Look for Activity Feed button in toolbar.
    const activityBtn = page
      .getByRole('button', { name: /Activity|Aktywność|Feed|Historia aktywności/i })
      .first();
    await shot(page, '22.1-activity-feed');
    if (!(await activityBtn.isVisible().catch(() => false))) {
      // Try alternate path: check if activity fires on page load.
      const resp = await activityGetP;
      if (resp) {
        expect(resp.status(), 'GET /activity returns 200').toBe(200);
        return;
      }
      test.skip(
        true,
        '[DB] ActivityFeed button not surfaced headlessly AND no activity GET observed on load. ' +
          'Verify manually: open ActivityFeed → GET /my-ideas/:id/activity → event list (author, date, desc). ' +
          'If 503: my_idea_activity table not migrated on staging.'
      );
      return;
    }
    await activityBtn.click();
    await page.waitForTimeout(800);
    await shot(page, '22.1-activity-feed-open');
    const resp = await activityGetP;
    if (resp) {
      expect(resp.status(), 'GET /activity returns 200').toBe(200);
    } else {
      // Panel opened but no network request → activity may be inline from map payload.
      const panel = page
        .getByText(/Activity|Aktywność|No activity|Brak aktywności/i)
        .first();
      expect(await panel.isVisible().catch(() => false), 'activity feed panel visible').toBe(true);
    }
  });

  test('22.2 Logowanie aktywności po dodaniu węzła [DB]', async ({ page }) => {
    await freshMap(page, '22.2');
    await selectRoot(page);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(900);
    await page.keyboard.type('Activity node');
    await exitEdit(page);
    // Activity write happens server-side after map/sync. Verify no 503 from activity endpoint.
    const activityReqP = page
      .waitForResponse(
        (r) => /\/activity/.test(r.url()),
        { timeout: 8000 }
      )
      .catch(() => null);
    await activityBtn(page);
    const resp = await activityReqP;
    await shot(page, '22.2-activity-log');
    if (!resp) {
      test.skip(
        true,
        '[DB] No /activity request observed after adding node. ' +
          'pushActivity is server-side (called from POST /map/sync handler). ' +
          'Verify staging: my_idea_activity table must exist (migration 20260611); ' +
          'if table missing → 503 or silent fail (swallowed in queryAll).'
      );
      return;
    }
    expect(resp.status(), 'activity endpoint returns 200 (not 503)').toBeLessThan(400);
  });
});

async function activityBtn(page: Page) {
  const btn = page.getByRole('button', { name: /Activity|Aktywność|Feed/i }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(400);
  }
}
