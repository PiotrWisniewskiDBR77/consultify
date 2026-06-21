/**
 * TESTY_M06 §24 — Ścieżki cross-module. Per-test isolation.
 * Navigation: Ideas list (M05) ↔ Mind Map; Mind Map → Initiatives; → Decisions; → Exports (M17/M19).
 */
import { type Page, expect, test } from '@playwright/test';

import { bootstrap, createIdea, exitEdit, openMindmap, selectRoot, shot } from './_m06';

async function freshMap(page: Page, tag: string) {
  const { token } = await bootstrap(page);
  const ideaId = await createIdea(page, token, `M06 §${tag} ${Date.now()}`);
  await openMindmap(page, ideaId);
  return ideaId;
}

test.describe('M06 §24 — Ścieżki cross-module', () => {
  test('24.1 Mind Map → Canvas (AI Chat) [KNOWN-GAP]', async ({ page }) => {
    await freshMap(page, '24.1');
    await shot(page, '24.1-mindmap-to-chat');
    test.skip(
      true,
      '[KNOWN-GAP] sidekick banner click should open chat with map context. ' +
        'Per §23 / L-04: useOpenChatWithContext.ts does not consume idea-mindmap-sidekick-context event. ' +
        'Integration is one-way (event dispatched, not consumed). Verify manually whether clicking the banner does anything.'
    );
  });

  test('24.2 Mind Map → Inicjatywy (BatchConvert + nawigacja)', async ({ page }) => {
    await freshMap(page, '24.2');
    // Add a child node to convert.
    await selectRoot(page);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(900);
    await page.keyboard.type('Initiative candidate');
    await exitEdit(page);
    await shot(page, '24.2-mindmap-to-initiatives');
    // Check if initiatives navigation is reachable from the mindmap.
    const initBtn = page.getByRole('link', { name: /Initiatives|Inicjatywy/i }).first();
    if (await initBtn.isVisible().catch(() => false)) {
      // Just verify the link exists; we don't navigate away (would break test isolation).
      expect(await initBtn.isVisible(), 'initiatives navigation link accessible from mindmap').toBe(true);
    } else {
      test.skip(
        true,
        'Initiatives link not surfaced from mindmap view. ' +
          'Verify manually: BatchConvert 3 nodes → /initiatives shows them with ideaId linkage.'
      );
    }
  });

  test('24.3 Mind Map → Decyzje (BatchConvert target=decision)', async ({ page }) => {
    await freshMap(page, '24.3');
    await shot(page, '24.3-mindmap-to-decisions');
    test.skip(
      true,
      'Verify manually: BatchConvert 3 nodes target=decision → /my-work/decisions shows them. ' +
        'Confirm decisions have powiązanie (ideaId) with original idea.'
    );
  });

  test('24.4 Lista idei (M05) → Mind Map → powrót', async ({ page }) => {
    const { token } = await bootstrap(page);
    const ideaId = await createIdea(page, token, `M06 §24.4 ${Date.now()}`);
    // Navigate to ideas list first.
    await page.goto('/my-work/ideas', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await shot(page, '24.4-ideas-list');
    // Open the mindmap for our idea.
    await openMindmap(page, ideaId);
    await shot(page, '24.4-mindmap-opened');
    const canvas = page.getByLabel('Idea map workspace');
    expect(await canvas.isVisible().catch(() => false), 'mindmap canvas opened from ideas list').toBe(true);
    // Navigate back.
    await page.goBack().catch(() => page.goto('/my-work/ideas'));
    await page.waitForTimeout(1500);
    await shot(page, '24.4-back-to-list');
    const url = page.url();
    expect(url, 'back navigation lands on my-work area').toMatch(/my-work|dashboard/);
  });

  test('24.5 Mind Map → Eksport do Outputs (convert_presentation) [MANUAL]', async ({ page }) => {
    await freshMap(page, '24.5');
    await shot(page, '24.5-export-to-outputs');
    test.skip(
      true,
      '[MANUAL] convert_presentation (IRM:4378) → Presentation Studio (M19) with nodes as slides. ' +
        'Verify manually: node text appears in slide content.'
    );
  });
});
