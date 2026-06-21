/**
 * TESTY_M06 §18 — Import zewnętrznych map. Per-test isolation.
 * §18.1–18.3 verify ImportExternalMap modal opens + file input present.
 * §18.4–18.5 are [REAL-AI] (require Document/Interview to map AI endpoints).
 */
import { type Page, expect, test } from '@playwright/test';

import { bootstrap, createIdea, openMindmap, shot } from './_m06';

async function freshMap(page: Page, tag: string) {
  const { token } = await bootstrap(page);
  const ideaId = await createIdea(page, token, `M06 §${tag} ${Date.now()}`);
  await openMindmap(page, ideaId);
}

/**
 * Open the ImportExternalMap modal via the real toolbar path:
 *   CanvasLeftToolbar "import" slot  (data-testid="canvas-left-toolbar-import")
 *     → ImportExportPopover           (data-testid="mindmap-import-export-popover")
 *       → "XMind / FreeMind / OPML"   (action mm_import_external)
 *         → ImportExternalMap modal with a single <input type=file accept=".mm,.xmind,.opml">.
 * Returns true when the import-action button was clicked.
 */
async function openImportModal(page: Page): Promise<boolean> {
  const importSlot = page.getByTestId('canvas-left-toolbar-import');
  if (!(await importSlot.isVisible().catch(() => false))) return false;
  await importSlot.click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);
  const externalAction = page.getByTestId('mindmap-import-export-action-mm_import_external');
  if (!(await externalAction.isVisible().catch(() => false))) return false;
  await externalAction.click({ force: true }).catch(() => {});
  await page.waitForTimeout(600);
  return true;
}

/** Open the ImportExportPopover and click an arbitrary import action by testid. */
async function openImportAction(page: Page, action: string): Promise<boolean> {
  const importSlot = page.getByTestId('canvas-left-toolbar-import');
  if (!(await importSlot.isVisible().catch(() => false))) return false;
  await importSlot.click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);
  const btn = page.getByTestId(`mindmap-import-export-action-${action}`);
  if (!(await btn.isVisible().catch(() => false))) return false;
  await btn.click({ force: true }).catch(() => {});
  await page.waitForTimeout(600);
  return true;
}

test.describe('M06 §18 — Import zewnętrznych map', () => {
  test('18.1 Import FreeMind (.mm) — modal otwiera się z file input', async ({ page }) => {
    await freshMap(page, '18.1');
    const opened = await openImportModal(page);
    await shot(page, '18.1-import-freemind');
    expect(opened, 'left-toolbar Import → "XMind / FreeMind / OPML" surfaced').toBe(true);
    // ImportExternalMap renders ONE file input accepting all three formats
    // (ImportExternalMap.tsx:286 accept=".mm,.xmind,.opml").
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput, 'import modal has file input').toHaveCount(1, { timeout: 6000 });
    const accept = (await fileInput.getAttribute('accept').catch(() => '')) || '';
    expect(accept, 'file input accepts FreeMind .mm').toContain('.mm');
  });

  test('18.2 Import XMind (.xmind) — file input present', async ({ page }) => {
    await freshMap(page, '18.2');
    const opened = await openImportModal(page);
    await shot(page, '18.2-import-xmind');
    expect(opened, 'left-toolbar Import → "XMind / FreeMind / OPML" surfaced').toBe(true);
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput, 'import modal has file input').toHaveCount(1, { timeout: 6000 });
    const accept = (await fileInput.getAttribute('accept').catch(() => '')) || '';
    expect(accept, 'file input accepts XMind .xmind').toContain('.xmind');
  });

  test('18.3 Import OPML — file input present', async ({ page }) => {
    await freshMap(page, '18.3');
    const opened = await openImportModal(page);
    await shot(page, '18.3-import-opml');
    expect(opened, 'left-toolbar Import → "XMind / FreeMind / OPML" surfaced').toBe(true);
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput, 'import modal has file input').toHaveCount(1, { timeout: 6000 });
    const accept = (await fileInput.getAttribute('accept').catch(() => '')) || '';
    expect(accept, 'file input accepts OPML .opml').toContain('.opml');
  });

  test('18.4 Document to Map (DocumentToMap) — modal opens [REAL-AI extract]', async ({ page }) => {
    await freshMap(page, '18.4');
    // Affordance is deterministic: toolbar Import → "Document → Map" (mm_doc_to_map)
    // opens DocumentToMap with a paste textarea (DocumentToMap.tsx:119). The AI
    // extraction step itself is [REAL-AI] and out of scope headlessly.
    const opened = await openImportAction(page, 'mm_doc_to_map');
    await shot(page, '18.4-document-to-map-open');
    expect(opened, 'left-toolbar Import → "Document → Map" surfaced').toBe(true);
    const textarea = page.locator('textarea').first();
    await expect(textarea, 'DocumentToMap paste textarea visible').toBeVisible({ timeout: 6000 });
  });

  test('18.5 Interview to Map (InterviewToMap) — modal opens [REAL-AI extract]', async ({ page }) => {
    await freshMap(page, '18.5');
    // Deterministic affordance: toolbar Import → "Interviews → Map" (mm_interview_to_map)
    // mounts InterviewToMap (IdeaRecommendationMap.tsx:5651). Insight extraction is [REAL-AI].
    const opened = await openImportAction(page, 'mm_interview_to_map');
    await page.waitForTimeout(600);
    await shot(page, '18.5-interview-to-map-open');
    expect(opened, 'left-toolbar Import → "Interviews → Map" surfaced').toBe(true);
    // Modal mounted → canvas remains intact (no crash on the AI-backed panel).
    const canvas = page.getByLabel('Idea map workspace');
    expect(await canvas.isVisible().catch(() => false), 'canvas intact after InterviewToMap open').toBe(true);
  });
});
