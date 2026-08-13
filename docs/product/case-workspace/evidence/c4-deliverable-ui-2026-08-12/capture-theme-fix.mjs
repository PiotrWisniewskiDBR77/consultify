// Redo desktop + mobile four-states screenshots using the REAL theme
// toggle (profile menu -> Theme -> Light/Dark), not a localStorage hack.
// The hack only flipped a subset of tokens (avatar/badge colors) without
// removing the `dark` class from <html> on reload — confirmed by manually
// testing: removing the class directly DOES flip body background to white,
// so the CSS is fine, the earlier localStorage-write-then-reload path just
// didn't take effect through the app's own custom zustand-persist storage
// adapter (debounced/scheduled writes) the way a real toggle click does.
import { chromium } from 'playwright';
import fs from 'node:fs';

const APP = 'http://127.0.0.1:4501';
const OUT = process.argv[2];
if (!OUT) throw new Error('usage: node c4-theme-fix.mjs <outDir>');
fs.mkdirSync(OUT, { recursive: true });

const CASE_URL = `${APP}/zlecenia/case-94b37954-c4a1-4417-8eed-9edefd570f95?zakladka=rezultaty`;

async function loginAndSetFlag(page) {
  await page.goto(`${APP}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.fill('input[type="email"]', 'cw.local@local.test');
  await page.fill('input[type="password"]', 'CaseWorkspaceLocal!2026');
  await Promise.all([
    page.waitForURL(/\/chat/, { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.evaluate(() => localStorage.setItem('ff.caseWorkspace', '1'));
}

async function gotoResultsTab(page) {
  await page.goto(CASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('text=Powiązane obiekty', { timeout: 60000 });
  await page.locator('text=Powiązane obiekty').scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
}

// Opens the profile menu (avatar with initials "CW") and clicks the Light
// or Dark theme button (title="Light" / title="Dark").
async function setThemeViaRealToggle(page, mode, out) {
  const avatar = page.locator('button:has-text("CW")').first();
  const themeBtn = page.locator(`button[title="${mode === 'light' ? 'Light' : 'Dark'}"]`);
  for (let attempt = 0; attempt < 3; attempt++) {
    await avatar.click({ force: true });
    await page.waitForTimeout(600);
    if ((await themeBtn.count()) > 0) break;
    // menu didn't open (or closed itself) — click elsewhere to reset, retry
    await page.mouse.click(20, 20);
    await page.waitForTimeout(300);
  }
  if ((await themeBtn.count()) === 0) {
    await page.screenshot({ path: `${out}/DEBUG-menu-open-${mode}.png` });
    const titles = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button[title]')).map((b) => b.getAttribute('title'))
    );
    console.log('NO_THEME_BUTTON_FOUND titles=', JSON.stringify(titles));
    throw new Error('theme button not found after 3 attempts, see DEBUG screenshot + titles list above');
  }
  await themeBtn.click();
  await page.waitForTimeout(400);
  await page.mouse.click(20, 400); // click outside to close the dropdown
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch({ headless: false });

  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await loginAndSetFlag(page);
    await gotoResultsTab(page);

    const htmlClassBefore = await page.evaluate(() => document.documentElement.className);
    console.log('HTML_CLASS_BEFORE', htmlClassBefore);
    // Default is already dark (confirmed) — screenshot as-is, no toggle needed.
    await page.screenshot({ path: `${OUT}/desktop-dark-four-states-table.png` });

    // Light — open the menu ONCE, click Light, close, screenshot.
    await setThemeViaRealToggle(page, 'light', OUT);
    await page.locator('text=Powiązane obiekty').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/desktop-light-four-states-table.png` });
    console.log('HTML_CLASS_LIGHT', await page.evaluate(() => document.documentElement.className));
    console.log(
      'BODY_BG_LIGHT',
      await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    );

    await context.close();
  }

  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const page = await context.newPage();
    await loginAndSetFlag(page);
    await gotoResultsTab(page);

    await page.screenshot({ path: `${OUT}/mobile-dark-four-states-table.png` });

    await setThemeViaRealToggle(page, 'light', OUT);
    await page.locator('text=Powiązane obiekty').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/mobile-light-four-states-table.png` });

    await context.close();
  }

  await browser.close();
  console.log('DONE');
})().catch((err) => {
  console.error('THEME_FIX_FAILED', err);
  process.exit(1);
});
