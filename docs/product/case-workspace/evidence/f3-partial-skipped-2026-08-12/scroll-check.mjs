import { chromium } from 'playwright';
const APP = 'http://127.0.0.1:4501';
const CASE_ID = 'case-b0ffee7b-6e32-46e6-a9cd-ddc08154c028';
const OUT = process.cwd();

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();
  await page.goto(`${APP}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'cw.local@local.test');
  await page.fill('input[type="password"]', 'CaseWorkspaceLocal!2026');
  await Promise.all([page.waitForURL(/\/chat/, { timeout: 15000 }), page.click('button[type="submit"]')]);
  await page.evaluate(() => localStorage.setItem('ff.caseWorkspace', '1'));
  await page.goto(`${APP}/zlecenia/${CASE_ID}?zakladka=rezultaty`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Wyniki wykonania kroków', { timeout: 20000 });
  await page.locator('text=Pominięty').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  // Scroll the table container horizontally to reveal STATUS AKCEPTACJI column.
  const tableScroller = page.locator('text=Pominięty').first().locator('xpath=ancestor::*[contains(@class,"overflow")][1]');
  await tableScroller.evaluate((el) => { el.scrollLeft = el.scrollWidth; }).catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/mobile-dark-node-results-scrolled-right.png` });
  await browser.close();
})();
