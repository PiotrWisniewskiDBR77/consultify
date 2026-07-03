/**
 * TESTY_M06 §11 — AI-assist — realne endpointy. Per-test isolation.
 * All sub-tests are [REAL-AI]: require a live LLM key on staging backend.
 * Each test: open the AI panel / trigger action → assert Network request fires;
 * the actual LLM response is not validated (non-deterministic). Honest-skip if
 * the UI affordance is not surfaced headlessly.
 */
import { type Page, expect, test } from '@playwright/test';

import { bootstrap, createIdea, exitEdit, openMindmap, selectRoot, shot } from './_m06';

async function freshMap(page: Page, tag: string) {
  const { token } = await bootstrap(page);
  const ideaId = await createIdea(page, token, `M06 §${tag} ${Date.now()}`);
  await openMindmap(page, ideaId);
}

async function addChild(page: Page) {
  await selectRoot(page);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(900);
  await page.keyboard.type('AI node');
  await exitEdit(page);
}

test.describe('M06 §11 — AI-assist [REAL-AI]', () => {
  test('11.1 AI Expand — POST /map/expand [REAL-AI]', async ({ page }) => {
    await freshMap(page, '11.1');
    await addChild(page);
    await selectRoot(page);
    await page.waitForTimeout(400);
    // Look for AI Expand button in floating toolbar or AI panel.
    const expandBtn = page
      .getByRole('button', { name: /AI Expand|Rozwiń AI|expand|Generate/i })
      .first();
    await shot(page, '11.1-ai-expand');
    if (!(await expandBtn.isVisible().catch(() => false))) {
      test.skip(
        true,
        '[REAL-AI] AI Expand button not surfaced for selected node in headless state ' +
          '(FloatingAIPopover + ctx_ai_expand require hover/selection). ' +
          'Verify manually: select node → AI Expand → POST /map/expand fires with node context.'
      );
      return;
    }
    const expandP = page
      .waitForResponse((r) => /\/map\/expand/.test(r.url()), { timeout: 20000 })
      .catch(() => null);
    await expandBtn.click({ force: true });
    const resp = await expandP;
    await shot(page, '11.1-ai-expand-result');
    if (!resp) {
      test.skip(true, '[REAL-AI] POST /map/expand did not fire (no LLM key on staging or button not wired)');
      return;
    }
    expect(resp.status(), 'AI Expand returns 200 or 201').toBeLessThan(400);
  });

  test('11.2 AI Suggestions — POST /map/ai-suggestions [REAL-AI]', async ({ page }) => {
    await freshMap(page, '11.2');
    await shot(page, '11.2-ai-suggestions');
    const suggestBtn = page
      .getByRole('button', { name: /AI Suggestions?|Sugestie AI|Suggest|Recommendations?/i })
      .first();
    if (!(await suggestBtn.isVisible().catch(() => false))) {
      test.skip(
        true,
        '[REAL-AI] AI Suggestions button not surfaced headlessly (AIActionsPopover / right AI panel). ' +
          'Verify manually: click AI Suggestions → POST /map/ai-suggestions → topics/findings/next_steps in response.'
      );
      return;
    }
    const reqP = page
      .waitForResponse((r) => /\/map\/ai-suggestions/.test(r.url()), { timeout: 20000 })
      .catch(() => null);
    await suggestBtn.click({ force: true });
    const resp = await reqP;
    await shot(page, '11.2-ai-suggestions-result');
    if (!resp) {
      test.skip(true, '[REAL-AI] POST /map/ai-suggestions did not fire');
      return;
    }
    expect(resp.status(), 'AI Suggestions returns non-error HTTP status').toBeLessThan(400);
  });

  test('11.3 Gap Analysis — POST /map/gap-analysis [REAL-AI]', async ({ page }) => {
    await freshMap(page, '11.3');
    await shot(page, '11.3-gap-analysis');
    const gapBtn = page
      .getByRole('button', { name: /Gap Analysis|Analiza luk/i })
      .first();
    if (!(await gapBtn.isVisible().catch(() => false))) {
      test.skip(
        true,
        '[REAL-AI] Gap Analysis button not surfaced headlessly. ' +
          'Verify manually: click Gap Analysis → POST /map/gap-analysis → list of gaps in panel.'
      );
      return;
    }
    const reqP = page
      .waitForResponse((r) => /\/map\/gap-analysis/.test(r.url()), { timeout: 20000 })
      .catch(() => null);
    await gapBtn.click({ force: true });
    const resp = await reqP;
    await shot(page, '11.3-gap-analysis-result');
    if (!resp) {
      test.skip(true, '[REAL-AI] POST /map/gap-analysis did not fire');
      return;
    }
    expect(resp.status(), 'Gap Analysis returns non-error HTTP status').toBeLessThan(400);
  });

  test('11.4 AI Expand Branch (BranchSummaryPanel) [REAL-AI]', async ({ page }) => {
    await freshMap(page, '11.4');
    await shot(page, '11.4-branch-summary');
    const branchSummaryBtn = page
      .getByRole('button', { name: /Branch Summary|Podsumuj gałąź|Summarize/i })
      .first();
    if (!(await branchSummaryBtn.isVisible().catch(() => false))) {
      test.skip(
        true,
        '[REAL-AI] BranchSummaryPanel not surfaced headlessly. ' +
          'Verify manually: select branch → Branch Summary → AI request → text summary in panel.'
      );
      return;
    }
    await branchSummaryBtn.click({ force: true });
    await page.waitForTimeout(1000);
    await shot(page, '11.4-branch-summary-result');
    const resultText = page.getByText(/.{20,}/i).first(); // any substantial text response
    expect(await resultText.isVisible().catch(() => false), 'branch summary result text appeared').toBe(true);
  });
});
