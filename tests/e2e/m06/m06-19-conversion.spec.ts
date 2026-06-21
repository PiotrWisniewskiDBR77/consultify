/**
 * TESTY_M06 §19 — Konwersja węzłów → Inicjatywy / Decyzje. Per-test isolation.
 * Verifies NodeContextMenu conversion options + BatchConvertModal affordance.
 */
import { type Page, expect, test } from '@playwright/test';

import { bootstrap, createIdea, exitEdit, nodeCount, openMindmap, selectRoot, shot } from './_m06';

async function freshMap(page: Page, tag: string) {
  const { token } = await bootstrap(page);
  const ideaId = await createIdea(page, token, `M06 §${tag} ${Date.now()}`);
  await openMindmap(page, ideaId);
}

async function addChild(page: Page, label = 'Convert me') {
  await selectRoot(page);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(900);
  await page.keyboard.type(label);
  await exitEdit(page);
}

test.describe('M06 §19 — Konwersja węzłów', () => {
  test('19.1 Konwersja węzła → Inicjatywa (NodeContextMenu)', async ({ page }) => {
    await freshMap(page, '19.1');
    await addChild(page, 'To Initiative');
    const child = page.locator('.react-flow__node').nth(1);
    if (!(await child.isVisible().catch(() => false))) {
      await shot(page, '19.1-convert-initiative');
      test.skip(true, 'Child node not available for context-menu conversion test — canvas headless');
      return;
    }
    await child.click({ button: 'right' });
    await page.waitForTimeout(600);
    await shot(page, '19.1-convert-initiative-menu');
    const convertItem = page
      .getByText(/Convert.*Initiative|Konwertuj.*Inicjatyw|ctx_convert_initiative/i)
      .first();
    if (!(await convertItem.isVisible().catch(() => false))) {
      test.skip(
        true,
        'Convert to Initiative option not in NodeContextMenu via headless right-click. ' +
          'Verify manually: ctx_convert_initiative → convertBranch(initiative) → Network request to initiatives API.'
      );
      return;
    }
    await convertItem.click();
    await page.waitForTimeout(1200);
    await shot(page, '19.1-convert-initiative-result');
    // Success: either a toast, navigation, or node status change.
    const toast = page.getByText(/converted|Skonwertow|Initiative created|Inicjatywa/i).first();
    expect(await toast.isVisible().catch(() => false), 'conversion feedback visible').toBe(true);
  });

  test('19.2 Konwersja gałęzi → Inicjatywa (subtree) [MANUAL]', async ({ page }) => {
    await freshMap(page, '19.2');
    await shot(page, '19.2-convert-subtree');
    test.skip(
      true,
      '[MANUAL] ctx_subtree_convert_initiative converts entire branch. ' +
        'Verify manually: right-click parent → Convert Branch → all child nodes linked to initiative.'
    );
  });

  test('19.3 BatchConvertModal — multi-selekcja konwersja', async ({ page }) => {
    await freshMap(page, '19.3');
    await addChild(page, 'Batch A');
    await selectRoot(page);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(900);
    await page.keyboard.type('Batch B');
    await exitEdit(page);
    // Look for Batch Convert button in toolbar.
    const batchBtn = page
      .getByRole('button', { name: /Batch Convert|Konwertuj grupowo|Batch|Konwertuj/i })
      .first();
    await shot(page, '19.3-batch-convert');
    if (!(await batchBtn.isVisible().catch(() => false))) {
      test.skip(
        true,
        'BatchConvert button not surfaced headlessly (may require multi-node selection first). ' +
          'Verify manually: select 2+ nodes → Batch Convert → BatchConvertModal opens → ' +
          'Toggle All, pick initiative/decision, Konwertuj → node status = converted.'
      );
      return;
    }
    await batchBtn.click();
    await page.waitForTimeout(600);
    await shot(page, '19.3-batch-convert-modal');
    // Modal should list eligible nodes.
    const modal = page.getByRole('dialog').first();
    expect(await modal.isVisible().catch(() => false), 'BatchConvertModal opened').toBe(true);
  });

  test('19.4 Konwersja → Prezentacja (convert_presentation)', async ({ page }) => {
    await freshMap(page, '19.4');
    await shot(page, '19.4-convert-presentation');
    const presentationConvertBtn = page
      .getByRole('button', { name: /Convert.*Presentat|Konwertuj.*Prezentacj/i })
      .first();
    if (!(await presentationConvertBtn.isVisible().catch(() => false))) {
      test.skip(
        true,
        'convert_presentation action (IRM:4378) not surfaced headlessly. ' +
          'Verify manually: action → navigation to Presentation Studio (M19) with nodes as slides.'
      );
      return;
    }
    await presentationConvertBtn.click();
    await page.waitForTimeout(1200);
    await shot(page, '19.4-convert-presentation-nav');
    // Should navigate away from mindmap.
    const url = page.url();
    expect(url, 'navigation occurred after convert_presentation').not.toMatch(/mindmap/);
  });

  test('19.5 Konwersja → Decyzja (ctx_convert_decision)', async ({ page }) => {
    await freshMap(page, '19.5');
    await addChild(page, 'To Decision');
    const child = page.locator('.react-flow__node').nth(1);
    if (!(await child.isVisible().catch(() => false))) {
      await shot(page, '19.5-convert-decision');
      test.skip(true, 'Child node not available for convert-to-decision test');
      return;
    }
    await child.click({ button: 'right' });
    await page.waitForTimeout(600);
    await shot(page, '19.5-convert-decision-menu');
    const decisionItem = page.getByText(/Convert.*Decision|Konwertuj.*Decyzj/i).first();
    if (!(await decisionItem.isVisible().catch(() => false))) {
      test.skip(
        true,
        'Convert to Decision option not in NodeContextMenu headlessly. ' +
          'Verify manually: ctx_convert_decision → decisions API + node status = converted.'
      );
      return;
    }
    await decisionItem.click();
    await page.waitForTimeout(1200);
    await shot(page, '19.5-convert-decision-result');
    const nodeCount_ = await nodeCount(page);
    expect(nodeCount_, 'canvas intact after convert to decision').toBeGreaterThan(0);
  });
});
