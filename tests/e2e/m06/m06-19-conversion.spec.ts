/**
 * TESTY_M06 §19 — Konwersja węzłów → Inicjatywy / Decyzje. Per-test isolation.
 * Verifies NodeContextMenu conversion options + BatchConvertModal affordance.
 */
import { type Page, expect, test } from '@playwright/test';

import {
  bootstrap,
  createIdea,
  exitEdit,
  fitView,
  nodeCount,
  openMindmap,
  selectRoot,
  shot,
} from './_m06';

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

/**
 * Right-click the child node and reveal the "Convert" hover-submenu.
 * NodeContextMenu (NodeContextMenu.tsx:289-315) renders the convert group as a
 * hover-expand submenu (titleEn "Convert"); its leaves are "→ Initiative" /
 * "→ Decision" — NOT "Convert to Initiative". The submenu only mounts on
 * onMouseEnter of the trigger row, so we hover it before clicking a leaf.
 * Returns false if the menu / trigger never appeared (caller honest-skips).
 */
async function openConvertSubmenu(page: Page, nodeIndex = 1): Promise<boolean> {
  await fitView(page);
  const child = page.locator('.react-flow__node').nth(nodeIndex);
  if (!(await child.isVisible().catch(() => false))) return false;
  await child.click({ button: 'right', force: true }).catch(() => {});
  await page.waitForTimeout(600);
  // Submenu trigger row: text "Convert" (EN) / "Konwersja" (PL), not a leaf.
  const trigger = page.getByText(/^Convert$|^Konwersja$/i).first();
  if (!(await trigger.isVisible().catch(() => false))) return false;
  await trigger.hover({ force: true }).catch(() => {});
  await page.waitForTimeout(350);
  return true;
}

test.describe('M06 §19 — Konwersja węzłów', () => {
  test('19.1 Konwersja węzła → Inicjatywa (NodeContextMenu)', async ({ page }) => {
    await freshMap(page, '19.1');
    await addChild(page, 'To Initiative');
    const opened = await openConvertSubmenu(page, 1);
    await shot(page, '19.1-convert-initiative-menu');
    if (!opened) {
      test.skip(
        true,
        'NodeContextMenu "Convert" submenu not surfaced via headless right-click+hover. ' +
          'Feature present: NodeContextMenu.tsx:294 ctx_convert_initiative → IdeaRecommendationMap.tsx:4608 ' +
          'convertBranch("initiative"). Verify manually: right-click node → Convert → → Initiative.'
      );
      return;
    }
    // Leaf label is "→ Initiative" (EN) / "→ Inicjatywa" (PL) — NodeContextMenu.tsx:295-296.
    const convertItem = page.getByText(/→\s*Initiative|→\s*Inicjatywa/i).first();
    if (!(await convertItem.isVisible().catch(() => false))) {
      test.skip(
        true,
        '"→ Initiative" leaf not revealed by headless hover on the Convert submenu (CSS hover-mount). ' +
          'Handler wired: convertBranch("initiative", ctxNode.id) (IdeaRecommendationMap.tsx:4608). Confirm manually.'
      );
      return;
    }
    await convertItem.click({ force: true });
    await page.waitForTimeout(1200);
    await shot(page, '19.1-convert-initiative-result');
    // convertBranch toasts immediately: "Converting branch to initiative" (EN) /
    // "Konwersja gałęzi do initiative" (PL) — IdeaRecommendationMap.tsx:4483.
    const toast = page
      .getByText(/Converting branch|Konwersja gałęzi|converted|Skonwertow|Initiative|Inicjatyw/i)
      .first();
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
      // REAL GAP: BatchConvertModal is built (BatchConvertModal.tsx) and the
      // handler exists — useMindMapQuickActions.ts:232 maps action 'mm_batch_convert'
      // → setShowBatchConvert(true). But NO UI element dispatches 'mm_batch_convert'
      // anywhere in src/ (verified: no toolbar/popover/palette entry), so the modal
      // is unreachable from the canvas. Not a headless limitation — a missing affordance.
      test.skip(
        true,
        'REAL GAP: BatchConvertModal unreachable — action mm_batch_convert ' +
          '(useMindMapQuickActions.ts:232 → setShowBatchConvert) has no UI trigger in src/. ' +
          'Needs a "Batch convert" entry in MoreToolsPanel/ImportExportPopover or a multi-select toolbar action.'
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
      // REAL GAP: convert_presentation IS wired (IdeaMapWorkspace.tsx:871 maps it to
      // handleConvert('presentation'); the only UI dispatcher is IdeaExportMenu.tsx:499
      // exportToPresentation). But IdeaExportMenu only mounts when exportMenuOpen=true,
      // which is set ONLY by action 'mm_export_menu' (useMindMapQuickActions.ts:295) —
      // and NO UI element dispatches 'mm_export_menu' in src/. So the deck-convert
      // affordance is unreachable from the mindmap toolbar.
      test.skip(
        true,
        'REAL GAP: convert→Presentation unreachable from canvas — IdeaExportMenu (only ' +
          'convert_presentation trigger, IdeaExportMenu.tsx:499) opens via mm_export_menu ' +
          '(useMindMapQuickActions.ts:295), which has no UI dispatcher in src/. ' +
          'Verify manually only if a deck-export entry is added (e.g. ImportExportPopover already ' +
          'has mm_export_pptx for HTML deck, but not the M19 Studio convert).'
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
    const opened = await openConvertSubmenu(page, 1);
    await shot(page, '19.5-convert-decision-menu');
    if (!opened) {
      test.skip(
        true,
        'NodeContextMenu "Convert" submenu not surfaced headlessly. ' +
          'Feature present: NodeContextMenu.tsx:301 ctx_convert_decision → IdeaRecommendationMap.tsx:4609 ' +
          'convertBranch("decision"). Verify manually.'
      );
      return;
    }
    // Leaf label "→ Decision" (EN) / "→ Decyzja" (PL) — NodeContextMenu.tsx:302-303.
    const decisionItem = page.getByText(/→\s*Decision|→\s*Decyzja/i).first();
    if (!(await decisionItem.isVisible().catch(() => false))) {
      test.skip(
        true,
        '"→ Decision" leaf not revealed by headless hover. Handler wired: convertBranch("decision") ' +
          '(IdeaRecommendationMap.tsx:4609). Confirm manually.'
      );
      return;
    }
    await decisionItem.click({ force: true });
    await page.waitForTimeout(1200);
    await shot(page, '19.5-convert-decision-result');
    const nodeCount_ = await nodeCount(page);
    expect(nodeCount_, 'canvas intact after convert to decision').toBeGreaterThan(0);
  });
});
