import fs from 'node:fs';
import path from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const SHOTS = path.resolve('docs/qa/ideas-navigation-2026-08-09/screens');
const TRANSIENT_ID_PREFIX = 'qa-navigation-matrix-nonpersisted';
const TOOLS = [
  { id: 'mindmap', route: 'mindmap' },
  { id: 'whiteboard', route: 'whiteboard' },
  { id: 'process_flow', route: 'process-flow' },
  { id: 'table', route: 'table' },
] as const;
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;

async function localPinLogin(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  const logo = page.getByRole('button', { name: /Open quick PIN sign-in/i });
  await logo.dblclick();
  const pin = page.getByRole('textbox', { name: /Four-digit quick access PIN/i });
  await pin.fill('7778');
  // Four digits submit automatically. Pressing Enter races the route change
  // and can retry forever against a detached input.
  await expect(page).toHaveURL(/\/chat/, { timeout: 20000 });
}

async function openTransientWorkspace(
  page: Page,
  language: 'en' | 'pl',
  scenarioId = `${TRANSIENT_ID_PREFIX}-${language}`
) {
  await page.evaluate(
    ({ lang, id }) => {
      localStorage.setItem('i18nextLng', lang);
      localStorage.removeItem(`consultify.idea-active-tool.${id}`);
    },
    { lang: language, id: scenarioId }
  );
  console.log(`[ideas-matrix] navigate ${language}`);
  await page.goto(`/my-work/ideas/${scenarioId}/workspace/mindmap`, {
    waitUntil: 'domcontentloaded',
  });
  console.log('[ideas-matrix] wait canvas');
  await expect(page.getByTestId('mels-canvas')).toBeVisible({ timeout: 30000 });
  console.log('[ideas-matrix] wait inspector');
  await expect(page.getByTestId('mels-left-inspector-rail')).toBeVisible();
  console.log('[ideas-matrix] wait tool rail');
  await expect(page.locator('[data-mels-floating-rail-surface]')).toBeVisible();
  console.log('[ideas-matrix] workspace ready');
}

async function assertNoShellOverlap(page: Page) {
  const canvasNode = page.getByTestId('mels-canvas');
  const inspectorNode = page.getByTestId('mels-left-inspector-rail');
  const toolRailNode = page.locator('[data-mels-floating-rail-surface]');
  // A canonical route change remounts the tool subtree. Measure only after
  // the replacement shell is painted; otherwise boundingBox can observe the
  // intentional one-frame gap between the old and new representation.
  await expect(canvasNode).toBeVisible();
  await expect(inspectorNode).toBeVisible();
  await expect(toolRailNode).toBeVisible();
  const canvas = await canvasNode.boundingBox();
  const inspector = await inspectorNode.boundingBox();
  const toolRail = await toolRailNode.boundingBox();
  expect(canvas).not.toBeNull();
  expect(inspector).not.toBeNull();
  expect(toolRail).not.toBeNull();
  if (!canvas || !inspector || !toolRail) return;
  expect(inspector.x + inspector.width).toBeLessThanOrEqual(canvas.x + 1);
  expect(toolRail.x).toBeGreaterThanOrEqual(canvas.x);
  expect(toolRail.x + toolRail.width).toBeLessThanOrEqual(canvas.x + canvas.width + 1);
  expect(toolRail.width).toBeGreaterThanOrEqual(44);
  expect(toolRail.y).toBeGreaterThanOrEqual(canvas.y);
  expect(toolRail.y + toolRail.height).toBeLessThanOrEqual(canvas.y + canvas.height + 1);
}

test('Ideas navigation visual and geometry acceptance matrix', async ({ page }) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  console.log('[ideas-matrix] login');
  await localPinLogin(page);
  console.log('[ideas-matrix] authenticated');

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const language of ['en', 'pl'] as const) {
      console.log(`[ideas-matrix] ${viewport.width}x${viewport.height} ${language}`);
      for (const theme of ['light', 'dark'] as const) {
        for (const zoom of [1, 2] as const) {
          // Browser 200% zoom halves the CSS viewport while retaining the
          // physical display size. Playwright cannot change browser zoom on an
          // existing page, so use the equivalent CSS viewport for reflow.
          await page.setViewportSize({
            width: Math.round(viewport.width / zoom),
            height: Math.round(viewport.height / zoom),
          });
          // Each matrix cell is an independent user scenario. Reusing one
          // idea across theme/zoom cells would leak the previous cell's local
          // active-tool preference (usually Table) into the next hydrate and
          // manufacture a race that cannot occur between independent visits.
          await openTransientWorkspace(
            page,
            language,
            `${TRANSIENT_ID_PREFIX}-${viewport.width}x${viewport.height}-${language}-${theme}-${zoom}`
          );
          await page.evaluate((nextTheme) => {
            document.documentElement.classList.toggle('dark', nextTheme === 'dark');
            document.documentElement.style.colorScheme = nextTheme;
          }, theme);
          // Resize can move the switcher between its unified bottom-bar slot
          // and the compact canvas-safe portal. Let that real reflow finish so
          // pointer down/up cannot land on two different DOM hosts.
          await page.waitForTimeout(250);
          const switcher = page.getByTestId('idea-view-switcher');
          await expect(switcher).toBeVisible();
          const compactExpected =
            Math.round(viewport.width / zoom) < 768 ||
            Math.round(viewport.height / zoom) < 500;
          await expect(switcher).toHaveAttribute(
            'data-compact-viewport',
            String(compactExpected)
          );
          for (const tool of TOOLS) {
            console.log(
              `[ideas-matrix] case ${viewport.width}x${viewport.height} ${language} ${theme} ${zoom * 100}% ${tool.id}`
            );
            const trigger = page.getByTestId(`idea-view-switcher-${tool.id}`);
            if ((await trigger.getAttribute('aria-pressed')) !== 'true') {
              await trigger.click();
            }
            await expect(page).toHaveURL(new RegExp(`/workspace/${tool.route}`));
            await expect(page.getByTestId(`idea-view-switcher-${tool.id}`)).toHaveAttribute(
              'aria-pressed',
              'true'
            );
            await assertNoShellOverlap(page);
            await page.screenshot({
              path: path.join(
                SHOTS,
                `${viewport.width}x${viewport.height}__${language}__${theme}__${zoom * 100}__${tool.id}.png`
              ),
              fullPage: false,
            });
          }
          await page.setViewportSize(viewport);
        }
      }
    }
  }
});

test('Ideas context menu keyboard contract', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await localPinLogin(page);
  await openTransientWorkspace(page, 'en');
  const root = page.getByTestId('rf__node-root');
  await expect(root).toBeVisible();
  await root.focus();
  await page.keyboard.press('Shift+F10');
  const menu = page.getByTestId('mindmap-node-context-menu');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute('role', 'menu');
  const commands = menu.getByRole('menuitem');
  expect(await commands.count()).toBeGreaterThan(10);
  const enabledCommands = menu.locator('[role="menuitem"]:not(:disabled)');
  await expect(enabledCommands.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(enabledCommands.nth(1)).toBeFocused();
  await page.keyboard.press('End');
  await expect(enabledCommands.last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(root).toBeFocused();
});

test('Ideas axe critical and serious gate', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await localPinLogin(page);
  await openTransientWorkspace(page, 'en', `${TRANSIENT_ID_PREFIX}-axe`);
  const evidence: Array<{
    tool: (typeof TOOLS)[number]['id'];
    theme: 'light' | 'dark';
    violations: unknown[];
  }> = [];

  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((nextTheme) => {
      document.documentElement.classList.toggle('dark', nextTheme === 'dark');
      document.documentElement.style.colorScheme = nextTheme;
    }, theme);
    // MainLayout and shared controls animate theme colors for 300 ms. Axe must
    // assess the settled theme, not an in-between blended frame whose contrast
    // can momentarily read 4.49:1 despite both endpoints passing.
    await page.waitForTimeout(400);
    for (const tool of TOOLS) {
      const trigger = page.getByTestId(`idea-view-switcher-${tool.id}`);
      if ((await trigger.getAttribute('aria-pressed')) !== 'true') await trigger.click();
      await expect(page).toHaveURL(new RegExp(`/workspace/${tool.route}`));
      await page.waitForTimeout(100);
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = result.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious'
      );
      evidence.push({ tool: tool.id, theme, violations: blocking });
    }
  }

  fs.writeFileSync(
    path.resolve('docs/qa/ideas-navigation-2026-08-09/axe-results.json'),
    `${JSON.stringify(evidence, null, 2)}\n`
  );
  expect(evidence.flatMap((entry) => entry.violations)).toEqual([]);
});
