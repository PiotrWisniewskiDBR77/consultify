// Mobile: scroll the Powiązane obiekty table horizontally to bring the
// "Otwórz" column into view, confirming the open buttons are reachable
// (not just visually cut off) on a narrow viewport.
import { chromium } from 'playwright';
import fs from 'node:fs';

const APP = 'http://127.0.0.1:4501';
const OUT = process.argv[2];
const CASE_URL = `${APP}/zlecenia/case-94b37954-c4a1-4417-8eed-9edefd570f95?zakladka=rezultaty`;

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();
  await page.goto(`${APP}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.fill('input[type="email"]', 'cw.local@local.test');
  await page.fill('input[type="password"]', 'CaseWorkspaceLocal!2026');
  await Promise.all([page.waitForURL(/\/chat/, { timeout: 20000 }), page.click('button[type="submit"]')]);
  await page.evaluate(() => localStorage.setItem('ff.caseWorkspace', '1'));
  await page.goto(CASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('text=Powiązane obiekty', { timeout: 60000 });
  await page.locator('text=Powiązane obiekty').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

  // Scroll the table's own horizontal scroller (the row container) to the
  // far right so the Otwórz column + buttons are visible.
  const scrolled = await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll('h3,h2,heading')).find((h) =>
      h.textContent?.includes('Powiązane obiekty')
    );
    const region = heading?.closest('section') || heading?.parentElement;
    const scroller = region?.querySelector('[class*="overflow-x"]') || region?.querySelector('table')?.parentElement;
    if (scroller) {
      scroller.scrollLeft = scroller.scrollWidth;
      return { found: true, scrollLeft: scroller.scrollLeft, scrollWidth: scroller.scrollWidth };
    }
    return { found: false };
  });
  console.log('SCROLL_RESULT', JSON.stringify(scrolled));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/mobile-dark-otworz-column-scrolled.png` });

  await browser.close();
})().catch((err) => {
  console.error('MOBILE_SCROLL_FAILED', err);
  process.exit(1);
});
