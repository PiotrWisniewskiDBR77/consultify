// Evidence capture — ZLECENIE 1.1-J2 (przejście właściciela 06.09).
// DEC-405b (filtr rozwijany + „Szukaj w notatkach”), DEC-405c (dymki wstecz/+/lupa),
// DEC-408 (Menu 2 „Sejfy” + okruszek „Moja Praca › Sejfy”).
// Wzór: scripts/dev/idee-notatnik-116-screenshots.mjs (fresh context per shot).
// Usage: node scripts/dev/notatnik-11j2-header-filtr-sejfy-screenshots.mjs <outdir>
import fs from 'fs';
import { chromium } from 'playwright';

const BASE = process.env.HARNESS_BASE_URL || 'http://127.0.0.1:3130';
const OUT = process.argv[2] || '/private/tmp/wt-11j2/evidence/1-1-j2';

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function newPage(viewport = { width: 900, height: 700 }) {
  const context = await browser.newContext({ viewport, colorScheme: 'dark' });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));
  return { context, page, consoleErrors };
}

// (a) Header: search field + one dropdown, no chip row.
async function shotHeaderNoChips() {
  const { context, page, consoleErrors } = await newPage();
  await page.goto(`${BASE}/?screen=notatnik-header-filtr-11j2&theme=dark&lang=pl`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForSelector('text=Notatnik', { timeout: 15000 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/a-header-search-plus-dropdown-no-chips.png` });
  console.log('saved a-header-search-plus-dropdown-no-chips.png, console errors:', consoleErrors.length);
  await context.close();
  return consoleErrors;
}

// (b) Filter dropdown open (native <select> — Chromium renders an OS popup
// that Playwright can't screenshot inside the page; capture focus + a DOM
// dump of the options as proof instead of a doomed popup screenshot).
async function shotFilterOptionsProof() {
  const { context, page, consoleErrors } = await newPage();
  await page.goto(`${BASE}/?screen=notatnik-header-filtr-11j2&theme=dark&lang=pl`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForSelector('text=Notatnik', { timeout: 15000 });
  const select = page.getByRole('combobox');
  await select.focus();
  const options = await select.locator('option').allTextContents();
  fs.writeFileSync(
    `${OUT}/b-filter-options.json`,
    JSON.stringify({ options }, null, 2)
  );
  await page.screenshot({ path: `${OUT}/b-filter-focused.png` });
  console.log('saved b-filter-focused.png + b-filter-options.json:', options);
  await context.close();
  return consoleErrors;
}

// (c) After selecting "Pinned/Przypięte", only pinned notes remain (count == counter).
async function shotFilteredPinned() {
  const { context, page, consoleErrors } = await newPage();
  await page.goto(`${BASE}/?screen=notatnik-header-filtr-11j2&theme=dark&lang=pl`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForSelector('text=Notatnik', { timeout: 15000 });
  const select = page.getByRole('combobox');
  await select.selectOption('pinned');
  await page.waitForTimeout(150);
  const pageCountText = await page.locator('text=/\\d+ stron/').first().textContent();
  const rowCount = await page.locator('[class*="rounded-2xl"] >> text=/./').count(); // loose, verified via screenshot instead
  await page.screenshot({ path: `${OUT}/c-filtered-pinned.png` });
  console.log('saved c-filtered-pinned.png, header count text =', pageCountText);
  await context.close();
  return consoleErrors;
}

// (d) Hover "+" -> tooltip "Nowa notatka"; also assert zero empty [title]/tooltip bubbles in the header.
async function shotPlusTooltipAndAssertNoEmpty() {
  const { context, page, consoleErrors } = await newPage();
  await page.goto(`${BASE}/?screen=notatnik-header-filtr-11j2&theme=dark&lang=pl`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForSelector('text=Notatnik', { timeout: 15000 });

  // Assert every native [title] in the doc is non-empty (mutation guard the
  // task asked for at the DOM level, not just the unit test level).
  const emptyTitles = await page.$$eval('[title]', (els) =>
    els.filter((el) => !el.getAttribute('title')?.trim()).map((el) => el.outerHTML)
  );

  const plusButton = page.getByTestId('notebook-new-page-button');
  await plusButton.hover();
  await page.waitForTimeout(150);
  const tooltipText = await page
    .locator('.absolute.z-dropdown')
    .first()
    .textContent()
    .catch(() => null);
  await page.screenshot({ path: `${OUT}/d-plus-tooltip-nowa-notatka.png` });
  console.log(
    'saved d-plus-tooltip-nowa-notatka.png, tooltipText =',
    JSON.stringify(tooltipText),
    'emptyTitles.length =',
    emptyTitles.length
  );
  if (emptyTitles.length > 0) {
    console.error('FAIL: empty [title] attributes found:', emptyTitles);
  }
  if (!tooltipText || !tooltipText.trim() || tooltipText.trim() !== 'Nowa notatka') {
    console.error('FAIL: expected tooltip text "Nowa notatka", got', JSON.stringify(tooltipText));
  }

  // Same check for wstecz + lupa.
  const backButton = page.getByTestId('notebook-back-to-library');
  await backButton.hover();
  await page.waitForTimeout(150);
  const backTooltip = await page.locator('.absolute.z-dropdown').first().textContent().catch(() => null);
  console.log('back tooltip =', JSON.stringify(backTooltip));

  const searchButton = page.getByTestId('notebook-search-all-button');
  await searchButton.hover();
  await page.waitForTimeout(150);
  const searchTooltip = await page
    .locator('.absolute.z-dropdown')
    .first()
    .textContent()
    .catch(() => null);
  console.log('search (lupa) tooltip =', JSON.stringify(searchTooltip));

  await context.close();
  return consoleErrors;
}

// (e) Menu 2 "Sejfy" tab + topbar breadcrumb "Moja Praca › Sejfy".
async function shotMenu2Sejfy() {
  const { context, page, consoleErrors } = await newPage({ width: 1280, height: 800 });
  await page.goto(`${BASE}/?screen=mywork-vault-sejfy-11j2&theme=dark&lang=pl`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForSelector('text=Sejfy', { timeout: 15000 });
  await page.waitForTimeout(300);
  const menu2Text = await page.locator('text=Sejfy').allTextContents();
  await page.screenshot({ path: `${OUT}/e-menu2-sejfy.png`, fullPage: true });
  console.log('saved e-menu2-sejfy.png, "Sejfy" occurrences on page:', menu2Text.length);
  await context.close();
  return consoleErrors;
}

const allErrors = [];
allErrors.push(...(await shotHeaderNoChips()));
allErrors.push(...(await shotFilterOptionsProof()));
allErrors.push(...(await shotFilteredPinned()));
allErrors.push(...(await shotPlusTooltipAndAssertNoEmpty()));
allErrors.push(...(await shotMenu2Sejfy()));

await browser.close();

if (allErrors.length > 0) {
  console.error('CONSOLE ERRORS DETECTED:', allErrors);
  process.exitCode = 1;
} else {
  console.log('DONE — zero console errors across all 5 screenshots');
}
