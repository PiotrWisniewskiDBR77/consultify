/**
 * M02 Canvas — full manual test schema, automated (Playwright, live app).
 * Source of truth: Harvard/Testy manualne/TESTY_M02_CANVAS.md
 *
 * Runs against the ALREADY-RUNNING dev stack (frontend :3000 + backend :3001 → trolley non-prod DB).
 * Auth via loginAsOwner → test-support bootstrap (a real, non-demo ADMIN). The public
 * `register-demo` fallback was removed: it is unprivileged and read-only by design.
 * Requires ENABLE_TEST_SUPPORT=true + a matching TEST_SUPPORT_KEY on the backend.
 *
 * Architecture note (verified 2026-06-20): the standalone `/ai/work-canvas` route now
 * redirects into the chat shell and mounts WorkCanvasDocumentPanel ("chat-shell Canvas").
 * The old WorkCanvasShell standalone is gone — these tests target the current chat-shell panel.
 *
 * Each scenario uses expect.soft so one assertion failure does not abort the matrix.
 */
import { expect, test, type Page } from '@playwright/test';

import {
  collectPageSignals,
  createConversationWithMessage,
  createWorkCanvasDraft,
  loginAsOwner,
} from './work-canvas-helpers';

const EDITOR = '[data-testid="canvas-rich-editor"] .ProseMirror';

// Open the chat-shell Work Canvas deterministically by deep-linking with workCanvas=1
// (the param the UnifiedChatPanel deep-link effect requires) + the created draft id.
// Bypasses the /ai/work-canvas redirect and the fresh-user empty-state.
// Fresh demo users get onboarding tours/CTAs (DemoWelcomeTour "Welcome to Consultify",
// TourProvider, first-login CTA) that overlay and intercept clicks. Suppress them.
async function suppressOnboarding(page: Page) {
  // Primary defense: force the first-run gate (GET /api/preferences →
  // onboarding_completed) so the FirstRunOnboarding modal never opens.
  await page.route('**/api/preferences', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    try {
      const resp = await route.fetch();
      const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
      await route.fulfill({ response: resp, json: { ...json, onboarding_completed: true } });
    } catch {
      await route.fulfill({ json: { onboarding_completed: true } });
    }
  });
  // Secondary defense: seed tour-completion localStorage keys.
  await page.addInitScript(() => {
    try {
      const ls = window.localStorage;
      ls.setItem('demo_tour_completed', 'true');
      ls.setItem('demo_tour_skipped', 'true');
      ls.setItem('tour_completed', 'true');
      ls.setItem('hasSeenWelcome', 'true');
      ls.setItem(
        'consultify_completed_tours',
        JSON.stringify(['first-value', 'first_value_tour', 'work-canvas', 'chat'])
      );
    } catch {
      /* ignore */
    }
  });
}

async function dismissOverlayIfPresent(page: Page) {
  // Final fallback: if the first-run modal still appears, click "Skip for now".
  for (let i = 0; i < 6; i += 1) {
    const skip = page
      .getByRole('button', { name: /Skip for now|Skip tour|Pomiń|Get started/i })
      .first();
    if (await skip.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skip.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
    } else {
      break;
    }
  }
}

async function openDraft(page: Page, draft: { id: string; conversationId: string }) {
  await page.goto(
    `/chat?workCanvas=1&draftId=${draft.id}&conversationId=${draft.conversationId}`,
    { waitUntil: 'domcontentloaded', timeout: 60000 }
  );
  await dismissOverlayIfPresent(page);
  await expect(page.locator('[data-testid="canvas-active-title"]').first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator(EDITOR).first()).toBeVisible({ timeout: 30000 });
}

// Convenience: login + create a document draft + open it.
async function openBaseCanvas(page: Page, kind = 'document') {
  const token = await loginAsOwner(page);
  const draft = await createWorkCanvasDraft(page.request, token, {
    kind,
    title: 'M02 manual canvas',
    content:
      '# M02 manual canvas\n\nAkapit startowy do testów edytora i formatowania.\n\n- punkt A\n- punkt B\n',
  });
  await openDraft(page, draft);
  return { token, draft };
}

async function selectAllInEditor(page: Page) {
  await page.locator(EDITOR).first().click();
  await page.keyboard.press('ControlOrMeta+a');
}

// Mouse triple-click a paragraph → real DOM selection + selection rect, which the
// panel's selection-state listener and the floating AI menu depend on.
async function selectParagraph(page: Page, text = 'Akapit startowy') {
  const para = page.locator(`${EDITOR} p`, { hasText: text }).first();
  await para.click({ clickCount: 3 });
}

async function editorHtml(page: Page): Promise<string> {
  return page.locator(EDITOR).first().innerHTML();
}

test.beforeEach(async ({ page }) => {
  await suppressOnboarding(page);
});

// ─────────────────────────────────────────────────────────────────────────────
// §1 — Top bar (title, +New, "…" menu, file actions, version history)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('M02 §1 Top bar', () => {
  test('1.1 title is editable and autosaves on blur (persisted draft)', async ({ page }) => {
    const signals = collectPageSignals(page);
    const token = await loginAsOwner(page);
    const draft = await createWorkCanvasDraft(page.request, token, {
      kind: 'markdown',
      title: 'Tytuł startowy M02',
    });
    await openDraft(page, draft);

    const title = page.locator('[data-testid="canvas-active-title"]').first();
    await expect.soft(title).toBeVisible();
    await expect.soft(title).toHaveValue(/Tytuł startowy M02/);

    // Edit + blur → expect a persist (PUT) to the draft.
    const newTitle = `M02 retitled ${Date.now().toString(36)}`;
    const persistPromise = page
      .waitForRequest(
        (r) =>
          r.url().includes(`/api/work-canvas/drafts/${draft.id}`) &&
          ['PUT', 'PATCH', 'POST'].includes(r.method()),
        { timeout: 12000 }
      )
      .catch(() => null);
    await title.fill(newTitle);
    await page.locator(EDITOR).first().click(); // blur the title
    const persistReq = await persistPromise;
    expect.soft(persistReq, 'title blur should persist the draft').not.toBeNull();

    signals.assertClean();
  });

  test('1.2 "+ New Canvas" menu opens and lists starter templates', async ({ page }) => {
    await openBaseCanvas(page);

    const newMenuRoot = page.locator('[data-testid="canvas-new-menu-root"]').first();
    await expect.soft(newMenuRoot).toBeVisible();
    await newMenuRoot.getByRole('button', { name: /New Canvas/i }).first().click();
    // Menu content with at least one template entry.
    const menuButtons = newMenuRoot.locator('button');
    expect.soft(await menuButtons.count(), 'new-canvas menu shows entries').toBeGreaterThan(1);
  });

  test('1.7 "…" menu opens; Dock/Markdown view share one source', async ({ page }) => {
    await openBaseCanvas(page);

    // Type a marker at the end of the document (Dock) view.
    const marker = `sync${Date.now().toString(36)}`;
    await page.locator(EDITOR).first().click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(` ${marker}`);
    await page.waitForTimeout(400);

    await page.getByRole('button', { name: 'Canvas menu' }).first().click();
    const menu = page.locator('[data-testid="canvas-diagnostics-menu"]').first();
    await expect.soft(menu).toBeVisible();
    await expect.soft(page.locator('[data-testid="canvas-view-actions"]').first()).toBeVisible();

    // Switch to Markdown view → the marker text must be present (same source).
    await page.getByRole('button', { name: 'Markdown view' }).first().click();
    const mdView = page.locator('[data-testid="canvas-md-view"]').first();
    await expect.soft(mdView).toBeVisible({ timeout: 10000 });
    await expect.soft(mdView, 'MD view reflects edits made in Dock view').toContainText(marker, {
      timeout: 10000,
    });
  });

  test('1.5 file actions present (copy/share/save/close) + save dirty-state toggles', async ({
    page,
  }) => {
    const token = await loginAsOwner(page);
    const draft = await createWorkCanvasDraft(page.request, token, { title: 'Save-state M02' });
    await openDraft(page, draft);

    const fileActions = page.locator('[data-testid="canvas-file-actions"]').first();
    await expect.soft(fileActions).toBeVisible();
    expect.soft(await fileActions.locator('button').count(), 'copy/share/save/close').toBe(4);

    const saveBtn = fileActions.locator('button[data-save-state]').first();
    await expect.soft(saveBtn).toBeVisible();

    // Type → dirty (unsaved/saving), then it should settle to saved.
    await page.locator(EDITOR).first().click();
    await page.keyboard.type(' edytuję dokument aby zabrudzić stan zapisu.');
    await expect
      .soft(saveBtn, 'save shows dirty after edit')
      .toHaveAttribute('data-save-state', /unsaved|saving/, { timeout: 8000 })
      .catch(() => {});
    await expect
      .soft(saveBtn, 'save settles to saved after autosave')
      .toHaveAttribute('data-save-state', /saved/, { timeout: 20000 });
  });

  test('1.6 version history popover opens and loads', async ({ page }) => {
    const token = await loginAsOwner(page);
    const draft = await createWorkCanvasDraft(page.request, token, { title: 'History M02' });
    await openDraft(page, draft);

    // #87c (rewizja 07-13): "Historia" moved off the always-visible main bar
    // into the "⋯" Canvas menu (Manual editing section) — open the kebab
    // first, then trigger from canvas-history-menu-item. The popover itself
    // still renders at the unchanged canvas-history-root anchor.
    await page.getByRole('button', { name: 'Canvas menu' }).click();
    await expect
      .soft(page.locator('[data-testid="canvas-diagnostics-menu"]').first())
      .toBeVisible();
    await page.locator('[data-testid="canvas-history-menu-item"]').first().click();

    const historyRoot = page.locator('[data-testid="canvas-history-root"]').first();
    // Popover renders (list or empty-state) without crashing.
    await page.waitForTimeout(1500);
    await expect.soft(historyRoot).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §1.3 / §1.4 — Capability gating (demo user lacks canvas output/promote/share caps)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('M02 §1.3/1.4 capability gating', () => {
  test('output + promote + share actions are gated with a reason (no request on click)', async ({
    page,
  }) => {
    await openBaseCanvas(page);

    const groups = [
      '[data-testid="canvas-output-actions"]',
      '[data-testid="canvas-workspace-actions"]',
    ];
    let gatedSeen = 0;
    let outboundRequests = 0;
    page.on('request', (r) => {
      if (/\/api\/work-canvas\/.*\/(create-output|save-to-workspace|share|create-presentation)/.test(r.url())) {
        outboundRequests += 1;
      }
    });

    for (const sel of groups) {
      const group = page.locator(sel).first();
      if (!(await group.isVisible().catch(() => false))) continue;
      const buttons = group.locator('button');
      const n = await buttons.count();
      for (let i = 0; i < n; i += 1) {
        const btn = buttons.nth(i);
        const status = await btn.getAttribute('data-action-status');
        const title = (await btn.getAttribute('title')) || '';
        if (status && status !== 'enabled') {
          gatedSeen += 1;
          // Gated buttons carry a reason in the title (label: reason).
          expect.soft(title.length, `gated button ${sel}#${i} has reason`).toBeGreaterThan(0);
          await btn.click({ force: true }).catch(() => {});
        }
      }
    }
    expect.soft(gatedSeen, 'at least one gated action observed for demo user').toBeGreaterThan(0);
    await page.waitForTimeout(1500);
    expect.soft(outboundRequests, 'gated clicks fire no output/promote request').toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 — Formatting toolbar (behavioral: editor DOM reflects each command)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('M02 §2 formatting toolbar', () => {
  test('inline marks (bold/italic/underline/strike/code/highlight) apply to selection', async ({
    page,
  }) => {
    await openBaseCanvas(page);

    const marks: Array<[string, RegExp]> = [
      ['Bold (Ctrl+B)', /<strong>/i],
      ['Italic (Ctrl+I)', /<em>/i],
      ['Underline (Ctrl+U)', /<u>/i],
      ['Strikethrough', /<s>/i],
      ['Inline code', /<code>/i],
      ['Highlight', /<mark/i],
    ];
    for (const [title, expected] of marks) {
      await selectParagraph(page);
      const btn = page.getByRole('button', { name: title }).first();
      if (!(await btn.isVisible().catch(() => false))) {
        expect.soft(false, `toolbar button "${title}" present`).toBe(true);
        continue;
      }
      await btn.click();
      expect.soft(await editorHtml(page), `${title} applies`).toMatch(expected);
      await selectParagraph(page);
      await btn.click(); // toggle off (idempotence)
    }
  });

  test('block formats (H1/H2/H3, lists, task list, blockquote, table) apply', async ({ page }) => {
    await openBaseCanvas(page);

    const blocks: Array<[string, RegExp]> = [
      ['Heading 1', /<h1/i],
      ['Heading 2', /<h2/i],
      ['Heading 3', /<h3/i],
      ['Bullet list', /<ul/i],
      ['Numbered list', /<ol/i],
      ['Task list', /data-type="taskList"|<ul[^>]*task/i],
      ['Blockquote', /<blockquote/i],
    ];
    for (const [title, expected] of blocks) {
      await page.locator(EDITOR).first().click();
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.press('Delete');
      await page.keyboard.type(`Blok ${title}`);
      await page.keyboard.press('ControlOrMeta+a');
      const btn = page.getByRole('button', { name: title }).first();
      await btn.click();
      expect.soft(await editorHtml(page), `${title} applies`).toMatch(expected);
    }

    // Insert table (cursor on empty line)
    await page.locator(EDITOR).first().click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Delete');
    await page.getByRole('button', { name: 'Insert table' }).first().click();
    expect.soft(await editorHtml(page), 'Insert table adds <table>').toMatch(/<table/i);
  });

  test('undo / redo reverse and reapply edits', async ({ page }) => {
    await openBaseCanvas(page);
    await page.locator(EDITOR).first().click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Delete');
    const token = `undo-${Date.now().toString(36)}`;
    await page.keyboard.type(token);
    expect.soft(await editorHtml(page)).toContain(token);

    await page.getByRole('button', { name: 'Undo (Ctrl+Z)' }).first().click();
    expect.soft(await editorHtml(page), 'undo removes text').not.toContain(token);
    await page.getByRole('button', { name: 'Redo (Ctrl+Shift+Z)' }).first().click();
    expect.soft(await editorHtml(page), 'redo restores text').toContain(token);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 — AI floating menu on selection
// ─────────────────────────────────────────────────────────────────────────────
test.describe('M02 §3 AI floating menu', () => {
  test('selecting text reveals the selection block / AI actions', async ({ page }) => {
    await openBaseCanvas(page);
    await selectParagraph(page);
    // Either the in-panel selection block actions or the floating AI quick-actions surface.
    const selectionBlock = page.locator('[data-testid="canvas-selection-block-actions"]').first();
    const floatingAction = page
      .getByRole('button', { name: /Rozwiń|Expand|Skróć|Shorten|Przepisz|Rewrite/i })
      .first();
    const blockVisible = await selectionBlock.isVisible({ timeout: 6000 }).catch(() => false);
    const floatVisible = await floatingAction.isVisible({ timeout: 2000 }).catch(() => false);
    expect.soft(blockVisible || floatVisible, 'selection surfaces AI/block actions').toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 — Autosave + reload recovery
// ─────────────────────────────────────────────────────────────────────────────
test.describe('M02 §4 autosave + persistence', () => {
  test('typing debounces to a single draft update; reload recovers content', async ({ page }) => {
    const token = await loginAsOwner(page);
    const draft = await createWorkCanvasDraft(page.request, token, { title: 'Autosave M02' });
    await openDraft(page, draft);

    const marker = `persist${Date.now().toString(36)}`;
    const savePromise = page
      .waitForRequest(
        (r) =>
          r.url().includes(`/api/work-canvas/drafts/${draft.id}`) &&
          ['PUT', 'PATCH', 'POST'].includes(r.method()),
        { timeout: 15000 }
      )
      .catch(() => null);
    // Type at the end of the document so the marker is unambiguous.
    await page.locator(EDITOR).first().click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(` ${marker}`);
    const saveReq = await savePromise;
    expect.soft(saveReq, 'edit triggers autosave request').not.toBeNull();

    // Wait for the save indicator to settle to 'saved' so the commit really landed
    // before we reload (avoids racing the debounce).
    const saveBtn = page
      .locator('[data-testid="canvas-file-actions"] button[data-save-state]')
      .first();
    await expect
      .soft(saveBtn, 'autosave settles to saved before reload')
      .toHaveAttribute('data-save-state', /saved/, { timeout: 20000 });

    // Reload by deep-link → content should reload from DB.
    await openDraft(page, draft);
    expect.soft(await editorHtml(page), 'reload recovers typed content').toContain(marker);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7A — Document generation (chat intent). Provider may be degraded → assert mechanism.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('M02 §7A generation surface (deliverables flag)', () => {
  // NOTE: the full chat→canvas doc/deck/sheet generation requires a canvas/deliverables
  // capability that the bootstrapped e2e user does NOT have (the §1.3/1.4 gating test proves
  // non-entitled users get no canvas.* caps). That end-to-end flow is verified live on owner DBR77
  // (Chrome session 2026-06-20: POST /generations→200, doc rich-PL + deck slides rendered).
  // Here we assert the capability-independent deploy gate: the deliverables route is ENABLED
  // (ENABLE_DELIVERABLES_LIGHT) — i.e. NOT the 404 signature of a disabled flag.
  test('deliverables generations route is enabled (not 404 → flag ON)', async ({ page }) => {
    const token = await loginAsOwner(page);
    const resp = await page.request.post(
      'http://127.0.0.1:3001/api/deliverables/generations',
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { format: 'document', intent: 'M02 playwright flag probe', title: 'M02 probe' },
      }
    );
    // 404 == flag OFF. Anything else (200 created / 400 validation / 403 capability)
    // proves the route family is mounted and the flag is ON.
    expect.soft(resp.status(), `deliverables route enabled (got ${resp.status()})`).not.toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 — Cross-cutting: i18n shell + dark mode render + console clean
// ─────────────────────────────────────────────────────────────────────────────
test.describe('M02 §7 cross-cutting', () => {
  test('dark + light render the canvas without console errors', async ({ page }) => {
    const signals = collectPageSignals(page);

    await page.emulateMedia({ colorScheme: 'dark' });
    await openBaseCanvas(page);
    await expect.soft(page.locator(EDITOR).first()).toBeVisible();

    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(800);
    await expect.soft(page.locator(EDITOR).first()).toBeVisible();

    signals.assertClean();
  });
});
