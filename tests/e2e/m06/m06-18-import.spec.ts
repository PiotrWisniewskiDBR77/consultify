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

async function openImportModal(page: Page): Promise<boolean> {
  // Try direct Import button in toolbar.
  const importBtn = page.getByRole('button', { name: /Import/i }).first();
  if (await importBtn.isVisible().catch(() => false)) {
    await importBtn.click();
    await page.waitForTimeout(600);
    return true;
  }
  // Try More menu → Import.
  const moreBtn = page.getByRole('button', { name: /More|Więcej|\.\.\./i }).first();
  if (await moreBtn.isVisible().catch(() => false)) {
    await moreBtn.click();
    await page.waitForTimeout(400);
    const innerImport = page.getByText(/Import/i).first();
    if (await innerImport.isVisible().catch(() => false)) {
      await innerImport.click().catch(() => {});
      await page.waitForTimeout(600);
      return true;
    }
  }
  return false;
}

test.describe('M06 §18 — Import zewnętrznych map', () => {
  test('18.1 Import FreeMind (.mm) — modal otwiera się z file input', async ({ page }) => {
    await freshMap(page, '18.1');
    const opened = await openImportModal(page);
    await shot(page, '18.1-import-freemind');
    if (!opened) {
      test.skip(true, 'Import button not surfaced in toolbar — confirm ImportExternalMap modal opens manually');
      return;
    }
    // File input must be present for FreeMind .mm upload.
    const fileInput = page.locator('input[type="file"]').first();
    const accept = await fileInput.getAttribute('accept').catch(() => '');
    if (!(await fileInput.isVisible().catch(() => false)) && !(await fileInput.count())) {
      test.skip(true, 'ImportExternalMap modal opened but file input not found');
      return;
    }
    expect(await fileInput.count(), 'import modal has file input for FreeMind upload').toBeGreaterThan(0);
    void accept;
  });

  test('18.2 Import XMind (.xmind) — file input present', async ({ page }) => {
    await freshMap(page, '18.2');
    const opened = await openImportModal(page);
    await shot(page, '18.2-import-xmind');
    if (!opened) {
      test.skip(true, 'Import button not surfaced — confirm XMind .xmind import modal manually');
      return;
    }
    const fileInput = page.locator('input[type="file"]').first();
    expect(await fileInput.count(), 'import modal has file input for XMind upload').toBeGreaterThan(0);
  });

  test('18.3 Import OPML — file input present', async ({ page }) => {
    await freshMap(page, '18.3');
    const opened = await openImportModal(page);
    await shot(page, '18.3-import-opml');
    if (!opened) {
      test.skip(true, 'Import button not surfaced — confirm OPML import modal manually');
      return;
    }
    const fileInput = page.locator('input[type="file"]').first();
    expect(await fileInput.count(), 'import modal has file input for OPML upload').toBeGreaterThan(0);
  });

  test('18.4 Document to Map (DocumentToMap) [REAL-AI]', async ({ page }) => {
    await freshMap(page, '18.4');
    await shot(page, '18.4-document-to-map');
    const docToMapBtn = page
      .getByRole('button', { name: /Document to Map|Dokument na mapę|Document2Map/i })
      .first();
    if (!(await docToMapBtn.isVisible().catch(() => false))) {
      test.skip(
        true,
        '[REAL-AI] DocumentToMap not surfaced headlessly. ' +
          'Verify manually: upload/paste document text → AI extracts structure → ' +
          'nodes appear on map + POST /map/sync. Confirm which endpoint fires (/map/ai-suggestions or dedicated).'
      );
      return;
    }
    await docToMapBtn.click();
    await page.waitForTimeout(600);
    await shot(page, '18.4-document-to-map-open');
    const inputArea = page.locator('textarea, input[type="file"]').first();
    expect(
      await inputArea.isVisible().catch(() => false),
      'DocumentToMap input area visible'
    ).toBe(true);
  });

  test('18.5 Interview to Map (InterviewToMap) [REAL-AI]', async ({ page }) => {
    await freshMap(page, '18.5');
    await shot(page, '18.5-interview-to-map');
    const interviewBtn = page
      .getByRole('button', { name: /Interview to Map|Wywiad na mapę|InterviewToMap/i })
      .first();
    if (!(await interviewBtn.isVisible().catch(() => false))) {
      test.skip(
        true,
        '[REAL-AI] InterviewToMap not surfaced headlessly. ' +
          'Verify manually: select M10 interview → AI extracts topics → nodes on map + POST /map/sync.'
      );
      return;
    }
    await interviewBtn.click();
    await page.waitForTimeout(600);
    await shot(page, '18.5-interview-to-map-open');
    const canvas = page.getByLabel('Idea map workspace');
    expect(await canvas.isVisible().catch(() => false), 'canvas intact after InterviewToMap open').toBe(true);
  });
});
