// RN-G6-MATRIX — targeted keyboard-only probe #2. The first pass
// (runKeyboardProbe in rn-g6-uicx-matrix.mjs) discovered that Tab lands on
// the per-row kebab button (not an abstract "row"), and Enter on it opens a
// dropdown menu rather than navigating directly. This script follows that
// path all the way through: kebab -> menu -> "Open full tool" -> Esc
// behavior -> focus-return check.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.RN_G6_FRONTEND_URL || 'http://localhost:3201';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'qa', 'screens', 'rn-g6-uicx');

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[type="email"]', { timeout: 30000 });
await page.locator('input[type="email"]').first().fill('rn-g6-user-a-admin@consultify.local');
await page.locator('input[type="password"]').first().fill('RnG6Runtime!2026');
await page.locator('button[type="submit"]').first().click({ timeout: 15000 });
await page.waitForTimeout(3000);

await page.goto(`${BASE}/results/kpi?ff_resultsVNextKpi=1`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('text=KPI CODE', { timeout: 30000 }).catch(() => {});
const orgTab = page.locator('button:has-text("Org")').first();
await orgTab.click().catch(() => {});
await page.waitForSelector('text=KPI-', { timeout: 15000 }).catch(() => {});

const findings = {};

// Give the first data row a marker so we can check focus-return later.
await page.evaluate(() => {
  const firstRow = document.querySelector('tbody tr, [role="row"]');
  if (firstRow) firstRow.setAttribute('data-rn-g6-marker', 'first-row');
});

// Tab from body until we land on a button inside the marked row (its kebab).
let steps = 0;
let landedOnKebab = false;
for (let i = 0; i < 60; i++) {
  await page.keyboard.press('Tab');
  steps++;
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    const row = el?.closest('[data-rn-g6-marker="first-row"]');
    return { tag: el?.tagName, inMarkedRow: !!row, ariaLabel: el?.getAttribute('aria-label') };
  });
  if (info.inMarkedRow && info.tag === 'BUTTON') {
    landedOnKebab = true;
    break;
  }
}
findings.tabStepsToFirstRowKebab = steps;
findings.landedOnKebab = landedOnKebab;

if (landedOnKebab) {
  const kebabScreenshot = path.join(OUT_DIR, 'kbd2-focused-kebab.png');
  await page.screenshot({ path: kebabScreenshot });
  findings.focusedKebabScreenshot = kebabScreenshot;

  // Enter opens the dropdown
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const menuOpenShot = path.join(OUT_DIR, 'kbd2-menu-open.png');
  await page.screenshot({ path: menuOpenShot });
  const menuItemsText = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[role="menuitem"], [role="menu"] button, [role="menu"] *'))
      .filter((el) => el.textContent?.trim())
      .map((el) => el.textContent.trim());
    return [...new Set(items)].slice(0, 20);
  });
  findings.menuOpenScreenshot = menuOpenShot;
  findings.menuItemsVisible = menuItemsText;

  // Esc should close JUST the menu (one layer), focus returns to the kebab
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const afterEscInfo = await page.evaluate(() => {
    const menuStillOpen = !!document.querySelector('[role="menu"]');
    const el = document.activeElement;
    const row = el?.closest('[data-rn-g6-marker="first-row"]');
    return { menuStillOpen, focusReturnedToRowButton: !!row && el?.tagName === 'BUTTON' };
  });
  findings.escClosesMenuOneLayer = { menuStillOpenAfterEsc: afterEscInfo.menuStillOpen };
  findings.focusReturnsToTriggerAfterEscFromMenu = afterEscInfo.focusReturnedToRowButton;
  const afterEscShot = path.join(OUT_DIR, 'kbd2-after-esc-from-menu.png');
  await page.screenshot({ path: afterEscShot });
  findings.afterEscFromMenuScreenshot = afterEscShot;

  // Now actually navigate via keyboard: Enter to reopen, ArrowDown to
  // "Open full tool" (2nd item after "Open"), Enter to activate.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await page.keyboard.press('ArrowDown'); // first item ("Open")
  await page.keyboard.press('ArrowDown'); // second item ("Open full tool")
  const focusedMenuItemText = await page.evaluate(() => document.activeElement?.textContent?.trim());
  findings.focusedMenuItemBeforeActivate = focusedMenuItemText;
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
  const pathAfterKeyboardNav = await page.evaluate(() => window.location.pathname);
  findings.keyboardOnlyReachedFullTool = pathAfterKeyboardNav.includes('/results/kpi/');
  findings.pathAfterKeyboardNav = pathAfterKeyboardNav;
  const fullToolShot = path.join(OUT_DIR, 'kbd2-full-tool-via-keyboard.png');
  await page.screenshot({ path: fullToolShot });
  findings.fullToolViaKeyboardScreenshot = fullToolShot;

  if (findings.keyboardOnlyReachedFullTool) {
    // Esc here (no layer open) should be a no-op on URL.
    const before = pathAfterKeyboardNav;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => window.location.pathname);
    findings.escFromFullToolNoLayerNoOp = before === after;

    // Test Back-button focus/URL restoration + then re-enter, use the
    // in-page Back arrow via keyboard: Shift+Tab to top, find it — simpler:
    // just click it (mouse) to restore registry context for the next probe,
    // this part is about full-tool Esc behavior only.
  }
}

findings.consoleErrors = [...consoleErrors];
fs.writeFileSync(path.join(OUT_DIR, 'uicx-keyboard2-report.json'), JSON.stringify(findings, null, 2));
console.log(JSON.stringify(findings, null, 2));
await browser.close();
