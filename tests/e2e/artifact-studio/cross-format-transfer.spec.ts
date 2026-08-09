import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

import {
  seedDocumentArtifact,
  setupDocumentStudioSession,
} from '../documents/_document-studio-helpers';
import { dismissOverlayIfPresent } from '../smoke/work-canvas-helpers';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

async function createDeck(page: Page, token: string, title?: string): Promise<string> {
  const response = await page.request.post(`${API_BASE_URL}/api/presentations/decks`, {
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: {
      title: title || `Transfer contract PPT ${Date.now()}`,
      theme: 'modern',
      source: 'artifact-studio-transfer-e2e',
      slides: [{ type: 'content', content: { title: 'Decision', bullets: ['Evidence'] } }],
    },
  });
  expect(response.ok()).toBe(true);
  return String(((await response.json()) as any)?.data?.id || '');
}

async function createWorkbook(page: Page, token: string, title?: string): Promise<string> {
  const response = await page.request.post(`${API_BASE_URL}/api/workbook/blank`, {
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { title: title || `Transfer contract XLSX ${Date.now()}` },
  });
  expect(response.status()).toBe(201);
  return String(((await response.json()) as { id?: string }).id || '');
}

async function navigateSpa(page: Page, path: string): Promise<void> {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

async function assertSharedShellContract(shell: Locator, menu2: Locator): Promise<void> {
  await expect(shell.getByTestId('artifact-menu3')).toHaveCount(1);
  await expect(shell.getByTestId('mels-left-rail')).toHaveCount(1);
  await expect(shell.getByTestId('mels-right-rail')).toHaveCount(0);
  await expect(shell.getByTestId('mels-left-inspector-rail')).toHaveCount(0);
  await expect(shell.getByTestId('artifact-studio-bottom-bar')).toBeVisible();

  const menu2Box = await menu2.boundingBox();
  expect(menu2Box?.height ?? 0, 'Menu2 must remain one compact line in every format').toBeLessThanOrEqual(
    58
  );
  await expect(shell.getByTestId('artifact-menu3').getByText('Teresa', { exact: true })).toHaveCount(
    0
  );
}

async function assertNoBlockingAxeViolations(page: Page, include: string): Promise<void> {
  const result = await new AxeBuilder({ page })
    .include(include)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = result.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious'
  );
  const summary = blocking.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => ({ target: node.target, html: node.html })),
  }));
  expect(summary, `blocking axe violations in ${include}`).toEqual([]);
}

test.describe('Artifact Studio cross-format transfer contract', () => {
  test.setTimeout(180_000);

  test('keeps one-line Menu2 and one working canvas across the runtime viewport matrix', async ({
    page,
  }) => {
    const token = await setupDocumentStudioSession(page);
    const [{ artifactId }, deckId, workbookId] = await Promise.all([
      seedDocumentArtifact(page.request, token, {
        title: `Responsive DOC ${Date.now()}`,
        documentType: 'business_case',
        language: 'pl',
      }),
      createDeck(page, token, `Responsive PPT ${Date.now()}`),
      createWorkbook(page, token, `Responsive XLSX ${Date.now()}`),
    ]);

    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 1024, height: 768 },
    ];
    const formats = [
      {
        path: `/document-studio/${encodeURIComponent(artifactId)}?ff_artifactStudio=1&ff_documentStudioV2=1`,
        shellTestId: 'document-studio-mels-shell',
        canvas: (shell: Locator) => shell.getByRole('main', { name: 'Document Studio canvas' }),
        menu2: (shell: Locator) => shell.getByTestId('mels-topbar'),
      },
      {
        path: `/presentations/builder/${deckId}?ff_artifactStudio=1&ff_presentationStudioV2=1`,
        shellTestId: 'deck-builder-mels-view',
        canvas: (shell: Locator) => shell.getByRole('main', { name: 'Prezentacje canvas' }),
        menu2: (shell: Locator) => shell.getByRole('toolbar', { name: 'Prezentacje top bar' }),
      },
      {
        path: `/excele?artifactId=${workbookId}&ff_excele=1&ff_artifactStudio=1&ff_spreadsheetStudioV2=1`,
        shellTestId: 'spreadsheet-artifact-studio',
        canvas: (shell: Locator) => shell.getByTestId('spreadsheet-canvas'),
        menu2: (shell: Locator) => shell.getByRole('toolbar', { name: 'Arkusze top bar' }),
      },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const format of formats) {
        await page.goto(format.path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await dismissOverlayIfPresent(page);
        const shell = page.getByTestId(format.shellTestId);
        await expect(shell).toBeVisible({ timeout: 30_000 });
        await assertSharedShellContract(shell, format.menu2(shell));

        const canvas = format.canvas(shell);
        await expect(canvas).toBeVisible();
        const canvasBox = await canvas.boundingBox();
        expect(canvasBox?.width ?? 0, `${format.shellTestId} canvas at ${viewport.width}px`).toBeGreaterThan(
          viewport.width >= 1280 ? 600 : 480
        );
        expect(canvasBox?.height ?? 0).toBeGreaterThan(320);
      }
    }
  });

  test('keeps the canonical shell positions across DOC, PPT and XLSX in one session', async ({
    page,
  }) => {
    const token = await setupDocumentStudioSession(page);
    const [{ artifactId }, deckId, workbookId] = await Promise.all([
      seedDocumentArtifact(page.request, token, {
        title: `Transfer contract DOC ${Date.now()}`,
        documentType: 'business_case',
        language: 'pl',
      }),
      createDeck(page, token),
      createWorkbook(page, token),
    ]);

    await page.goto(
      `/document-studio/${encodeURIComponent(artifactId)}?ff_artifactStudio=1&ff_documentStudioV2=1`,
      { waitUntil: 'domcontentloaded', timeout: 60_000 }
    );
    const docShell = page.getByTestId('document-studio-mels-shell');
    await expect(docShell).toHaveAttribute('data-artifact-studio', 'true', { timeout: 30_000 });
    await assertSharedShellContract(docShell, docShell.getByTestId('mels-topbar'));
    await expect(docShell.getByRole('button', { name: 'Teresa', exact: true })).toBeVisible();

    await page.goto(
      `/presentations/builder/${deckId}?ff_artifactStudio=1&ff_presentationStudioV2=1`,
      { waitUntil: 'domcontentloaded', timeout: 60_000 }
    );
    await dismissOverlayIfPresent(page);
    const pptShell = page.getByTestId('deck-builder-mels-view');
    await expect(pptShell).toHaveAttribute('data-artifact-studio', 'true', { timeout: 30_000 });
    await assertSharedShellContract(
      pptShell,
      pptShell.getByRole('toolbar', { name: 'Prezentacje top bar' })
    );
    await expect(pptShell.getByRole('button', { name: 'Ask Teresa', exact: true })).toBeVisible();
    await expect(pptShell.getByRole('button', { name: 'Notes', exact: true })).toBeVisible();

    await page.goto(
      `/excele?artifactId=${workbookId}&ff_excele=1&ff_artifactStudio=1&ff_spreadsheetStudioV2=1`,
      { waitUntil: 'domcontentloaded', timeout: 60_000 }
    );
    await dismissOverlayIfPresent(page);
    const xlsxShell = page.getByTestId('spreadsheet-artifact-studio');
    await expect(xlsxShell).toHaveAttribute('data-artifact-studio', 'true', { timeout: 30_000 });
    await assertSharedShellContract(
      xlsxShell,
      xlsxShell.getByRole('toolbar', { name: 'Arkusze top bar' })
    );
    await expect(xlsxShell.getByRole('button', { name: 'Teresa', exact: true })).toBeVisible();
  });

  test('rehearses V2 to legacy to V2 rollback without losing artifact identity', async ({ page }) => {
    const token = await setupDocumentStudioSession(page);
    const stamp = Date.now();
    const docTitle = `Rollback rehearsal DOC ${stamp}`;
    const deckTitle = `Rollback rehearsal PPT ${stamp}`;
    const workbookTitle = `Rollback rehearsal XLSX ${stamp}`;
    const [{ artifactId }, deckId, workbookId] = await Promise.all([
      seedDocumentArtifact(page.request, token, {
        title: docTitle,
        documentType: 'business_case',
        language: 'pl',
      }),
      createDeck(page, token, deckTitle),
      createWorkbook(page, token, workbookTitle),
    ]);

    const journeys = [
      {
        name: 'DOC',
        v2: `/document-studio/${encodeURIComponent(artifactId)}?ff_artifactStudio=1&ff_documentStudioV2=1`,
        legacy: `/document-studio/${encodeURIComponent(artifactId)}?ff_artifactStudio=1&ff_documentStudioV2=0`,
        v2Shell: 'document-studio-mels-shell',
        legacyReady: (activePage: Page) => activePage.getByTestId('document-studio-mels-shell'),
        title: docTitle,
        identity: artifactId,
      },
      {
        name: 'PPT',
        v2: `/presentations/builder/${deckId}?ff_artifactStudio=1&ff_presentationStudioV2=1`,
        legacy: `/presentations/builder/${deckId}?ff_artifactStudio=1&ff_presentationStudioV2=0`,
        v2Shell: 'deck-builder-mels-view',
        legacyReady: (activePage: Page) =>
          activePage.getByRole('toolbar', { name: 'Prezentacje top bar' }),
        title: deckTitle,
        identity: deckId,
      },
      {
        name: 'XLSX',
        v2: `/excele?artifactId=${workbookId}&ff_excele=1&ff_artifactStudio=1&ff_spreadsheetStudioV2=1`,
        legacy: `/excele?artifactId=${workbookId}&ff_excele=1&ff_artifactStudio=1&ff_spreadsheetStudioV2=0`,
        v2Shell: 'spreadsheet-artifact-studio',
        legacyReady: (activePage: Page) => activePage.getByRole('button', { name: /Task Progress/ }),
        title: workbookTitle,
        identity: workbookId,
      },
    ];

    for (const journey of journeys) {
      await page.goto(journey.v2, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await dismissOverlayIfPresent(page);
      const firstV2 = page.getByTestId(journey.v2Shell);
      await expect(firstV2, `${journey.name} V2 before rollback`).toBeVisible({ timeout: 30_000 });
      await expect(firstV2).toHaveAttribute('data-artifact-studio', 'true');
      await expect(page.getByText(journey.title, { exact: false }).first()).toBeVisible();
      expect(page.url()).toContain(journey.identity);

      await page.goto(journey.legacy, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await dismissOverlayIfPresent(page);
      await expect(journey.legacyReady(page), `${journey.name} legacy after kill-switch`).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator('[data-testid="artifact-menu3"]:visible')).toHaveCount(0);
      await expect(page.getByText(journey.title, { exact: false }).first()).toBeVisible();
      expect(page.url()).toContain(journey.identity);

      await page.goto(journey.v2, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await dismissOverlayIfPresent(page);
      const restoredV2 = page.getByTestId(journey.v2Shell);
      await expect(restoredV2, `${journey.name} V2 after rollback reversal`).toBeVisible({
        timeout: 30_000,
      });
      await expect(restoredV2).toHaveAttribute('data-artifact-studio', 'true');
      await expect(restoredV2.getByTestId('artifact-menu3')).toHaveCount(1);
      await expect(page.getByText(journey.title, { exact: false }).first()).toBeVisible();
      expect(page.url()).toContain(journey.identity);
    }
  });

  test('opens the shared DOC and PPT context menu with pointer and Shift+F10', async ({ page }) => {
    const token = await setupDocumentStudioSession(page);
    const [{ artifactId }, deckId] = await Promise.all([
      seedDocumentArtifact(page.request, token, {
        title: `Context contract DOC ${Date.now()}`,
        documentType: 'business_case',
        language: 'pl',
      }),
      createDeck(page, token, `Context contract PPT ${Date.now()}`),
    ]);

    await page.goto(
      `/document-studio/${encodeURIComponent(artifactId)}?ff_artifactStudio=1&ff_documentStudioV2=1`,
      { waitUntil: 'domcontentloaded', timeout: 60_000 }
    );
    const docShell = page.getByTestId('document-studio-mels-shell');
    await expect(docShell).toBeVisible({ timeout: 30_000 });
    const docSurface = docShell.getByTestId('artifact-context-command-surface');
    await docSurface.click({ button: 'right', position: { x: 320, y: 260 } });
    const docMenu = docShell.getByRole('menu', { name: 'Menu kontekstowe dokumentu' });
    await expect(docMenu).toBeVisible();
    await expect(docMenu.getByRole('menuitem', { name: 'Tekst' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(docMenu).toBeHidden();

    await navigateSpa(
      page,
      `/presentations/builder/${deckId}?ff_artifactStudio=1&ff_presentationStudioV2=1`
    );
    const pptShell = page.getByTestId('deck-builder-mels-view');
    await expect(pptShell).toBeVisible({ timeout: 30_000 });
    const pptCanvas = pptShell.getByRole('main', { name: 'Prezentacje canvas' });
    const pptSurface = pptShell.getByTestId('artifact-context-command-surface');
    await pptSurface.focus();
    await expect(pptSurface).toBeFocused();
    await pptSurface.press('Shift+F10');
    const pptMenu = pptShell.getByRole('menu', { name: 'Menu kontekstowe prezentacji' });
    await expect(pptMenu).toBeVisible();
    await expect(pptMenu.getByRole('menuitem', { name: 'Nowy slajd' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(pptMenu).toBeHidden();
    await expect(pptSurface).toBeFocused();
  });

  test('has no critical or serious axe violations in the mounted DOC, PPT and XLSX studios', async ({
    page,
  }) => {
    const token = await setupDocumentStudioSession(page);
    const [{ artifactId }, deckId, workbookId] = await Promise.all([
      seedDocumentArtifact(page.request, token, {
        title: `Accessibility DOC ${Date.now()}`,
        documentType: 'business_case',
        language: 'pl',
      }),
      createDeck(page, token),
      createWorkbook(page, token),
    ]);

    await page.goto(
      `/document-studio/${encodeURIComponent(artifactId)}?ff_artifactStudio=1&ff_documentStudioV2=1`,
      { waitUntil: 'domcontentloaded', timeout: 60_000 }
    );
    await expect(page.getByTestId('document-studio-mels-shell')).toBeVisible({ timeout: 30_000 });
    await assertNoBlockingAxeViolations(page, '[data-testid="document-studio-mels-shell"]');

    await page.goto(
      `/presentations/builder/${deckId}?ff_artifactStudio=1&ff_presentationStudioV2=1`,
      { waitUntil: 'domcontentloaded', timeout: 60_000 }
    );
    await dismissOverlayIfPresent(page);
    await expect(page.getByTestId('deck-builder-mels-view')).toBeVisible({ timeout: 30_000 });
    await assertNoBlockingAxeViolations(page, '[data-testid="deck-builder-mels-view"]');

    await page.goto(
      `/excele?artifactId=${workbookId}&ff_excele=1&ff_artifactStudio=1&ff_spreadsheetStudioV2=1`,
      { waitUntil: 'domcontentloaded', timeout: 60_000 }
    );
    await dismissOverlayIfPresent(page);
    await expect(page.getByTestId('spreadsheet-artifact-studio')).toBeVisible({ timeout: 30_000 });
    await assertNoBlockingAxeViolations(page, '[data-testid="spreadsheet-artifact-studio"]');
  });

  test('exposes stable screen-reader landmarks and named primary controls in every studio', async ({
    page,
  }) => {
    const token = await setupDocumentStudioSession(page);
    const [{ artifactId }, deckId, workbookId] = await Promise.all([
      seedDocumentArtifact(page.request, token, {
        title: `Screen reader DOC ${Date.now()}`,
        documentType: 'business_case',
        language: 'pl',
      }),
      createDeck(page, token, `Screen reader PPT ${Date.now()}`),
      createWorkbook(page, token, `Screen reader XLSX ${Date.now()}`),
    ]);

    const formats = [
      {
        path: `/document-studio/${encodeURIComponent(artifactId)}?ff_artifactStudio=1&ff_documentStudioV2=1`,
        shell: 'document-studio-mels-shell',
        main: 'Document Studio canvas',
        topbar: 'Document Studio top bar',
        contextTools: 'Narzędzia dokumentu',
        teresa: 'Teresa',
      },
      {
        path: `/presentations/builder/${deckId}?ff_artifactStudio=1&ff_presentationStudioV2=1`,
        shell: 'deck-builder-mels-view',
        main: 'Prezentacje canvas',
        topbar: 'Prezentacje top bar',
        contextTools: 'Narzędzia prezentacji',
        teresa: 'Ask Teresa',
      },
      {
        path: `/excele?artifactId=${workbookId}&ff_excele=1&ff_artifactStudio=1&ff_spreadsheetStudioV2=1`,
        shell: 'spreadsheet-artifact-studio',
        main: 'Arkusze canvas',
        topbar: 'Arkusze top bar',
        contextTools: 'Narzędzia arkusza',
        teresa: 'Teresa',
      },
    ];

    for (const format of formats) {
      await page.goto(format.path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await dismissOverlayIfPresent(page);
      const shell = page.getByTestId(format.shell);
      await expect(shell).toBeVisible({ timeout: 30_000 });
      await expect(shell.getByRole('main', { name: format.main })).toHaveCount(1);
      await expect(shell.getByRole('toolbar', { name: format.topbar })).toHaveCount(1);
      await expect(shell.getByTestId('artifact-menu3')).toHaveRole('toolbar');
      await expect(shell.getByTestId('artifact-menu3')).toHaveAttribute(
        'aria-label',
        format.contextTools
      );
      await expect(shell.getByRole('button', { name: format.teresa, exact: true })).toHaveCount(1);

      const unnamedInteractive = shell.locator(
        'button:not([aria-label]):not([aria-labelledby]), a:not([aria-label]):not([aria-labelledby]), input:not([aria-label]):not([aria-labelledby]):not([placeholder]), select:not([aria-label]):not([aria-labelledby])'
      );
      const unnamedVisible = await unnamedInteractive.evaluateAll((elements) =>
        elements
          .filter((element) => {
            const node = element as HTMLElement;
            const style = window.getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
          })
          .filter((element) => !(element.textContent || '').trim())
          .map((element) => element.outerHTML)
      );
      expect(unnamedVisible, `${format.shell} contains unnamed visible controls`).toEqual([]);
    }
  });

  test('reuses one global Teresa conversation while updating DOC, PPT and XLSX context', async ({
    page,
  }) => {
    const token = await setupDocumentStudioSession(page);
    const stamp = Date.now();
    const docTitle = `Teresa continuity DOC ${stamp}`;
    const deckTitle = `Teresa continuity PPT ${stamp}`;
    const workbookTitle = `Teresa continuity XLSX ${stamp}`;
    const [{ artifactId }, deckId, workbookId] = await Promise.all([
      seedDocumentArtifact(page.request, token, {
        title: docTitle,
        documentType: 'business_case',
        language: 'pl',
      }),
      createDeck(page, token, deckTitle),
      createWorkbook(page, token, workbookTitle),
    ]);

    let conversationCreates = 0;
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (request.method() === 'POST' && /\/api\/conversations\/?$/.test(pathname)) {
        conversationCreates += 1;
      }
    });

    await page.goto(
      `/document-studio/${encodeURIComponent(artifactId)}?ff_artifactStudio=1&ff_documentStudioV2=1`,
      { waitUntil: 'domcontentloaded', timeout: 60_000 }
    );
    const docShell = page.getByTestId('document-studio-mels-shell');
    await expect(docShell).toBeVisible({ timeout: 30_000 });
    await docShell.getByRole('button', { name: 'Teresa', exact: true }).click();
    await expect(page.locator('textarea[data-testid="chat-input"]:visible').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(docTitle, { exact: false }).last()).toBeVisible();
    await expect.poll(() => conversationCreates).toBe(1);

    await page.getByRole('button', { name: 'Close AI panel' }).click();
    await navigateSpa(
      page,
      `/presentations/builder/${deckId}?ff_artifactStudio=1&ff_presentationStudioV2=1`
    );
    await dismissOverlayIfPresent(page);
    const pptShell = page.getByTestId('deck-builder-mels-view');
    await expect(pptShell).toBeVisible({ timeout: 30_000 });
    await pptShell.getByRole('button', { name: 'Ask Teresa', exact: true }).click();
    await expect(page.locator('textarea[data-testid="chat-input"]:visible').first()).toBeVisible();
    await expect(page.getByText(deckTitle, { exact: false }).last()).toBeVisible();
    await expect.poll(() => conversationCreates).toBe(1);

    await page.getByRole('button', { name: 'Close AI panel' }).click();
    await navigateSpa(
      page,
      `/excele?artifactId=${workbookId}&ff_excele=1&ff_artifactStudio=1&ff_spreadsheetStudioV2=1`
    );
    await dismissOverlayIfPresent(page);
    const xlsxShell = page.getByTestId('spreadsheet-artifact-studio');
    await expect(xlsxShell).toBeVisible({ timeout: 30_000 });
    await xlsxShell.getByRole('button', { name: 'Teresa', exact: true }).click();
    await expect(page.locator('textarea[data-testid="chat-input"]:visible').first()).toBeVisible();
    await expect(page.getByText(workbookTitle, { exact: false }).last()).toBeVisible();
    await expect.poll(() => conversationCreates).toBe(1);
  });
});
