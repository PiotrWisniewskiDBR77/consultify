/**
 * TESTY_M06 §1 — Routing, gating i ładowanie modułu.
 * Reference spec proving the M06 manual-gate harness end-to-end.
 *
 * Reconciliation vs spec (post Harvard 2, verified 2026-06-20):
 *  - §1.1 beta: MYWORK_IDEAS is now 'open' (betaAccess.ts) — tab is reachable,
 *    not 'closed'. We assert the tab loads + API is reachable.
 */
import { expect, test } from '@playwright/test';

import { CANVAS_LABEL, bootstrap, createIdea, openMindmap, shot } from './_m06';

test.describe('M06 §1 — Routing, gating, ładowanie', () => {
  test('1.1 Beta gate — Ideas tab reachable (MYWORK_IDEAS open) + API reachable', async ({ page }) => {
    const { token } = await bootstrap(page);

    // API reachable regardless of front-end beta gate.
    const apiResp = await page.request.get('/api/my-work/my-ideas', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(apiResp.ok(), `GET /my-ideas HTTP ${apiResp.status()}`).toBeTruthy();

    await page.goto('/my-work/ideas', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await expect(page.getByRole('button', { name: /Ideas|Pomysły/i }).first()).toBeVisible({
      timeout: 30000,
    });
    await shot(page, '1.1-beta-gate-ideas-tab');
  });

  test('1.2 Routing do workspace — open idea → mindmap canvas', async ({ page }) => {
    const { token } = await bootstrap(page);
    const ideaId = await createIdea(page, token, `M06 §1.2 ${Date.now()}`);
    await openMindmap(page, ideaId);
    expect(page.url()).toContain('mindmap');
    await shot(page, '1.2-routing-workspace');
  });

  test('1.3 Stan ładowania mapy — GET /map 200 + starter graph hydrates', async ({ page }) => {
    const { token } = await bootstrap(page);
    const ideaId = await createIdea(page, token, `M06 §1.3 ${Date.now()}`);

    // §1.3: GET map returns 200 and a hydratable graph.
    const mapResp = await page.request.get(`/api/my-work/my-ideas/${ideaId}/map?language=en`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(mapResp.ok(), `GET /map HTTP ${mapResp.status()}`).toBeTruthy();

    await openMindmap(page, ideaId);
    // Starter graph: at least the root node renders on the canvas.
    await expect(page.getByLabel(CANVAS_LABEL)).toBeVisible();
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 30000 });
    await shot(page, '1.3-map-load-starter-graph');
  });
});
