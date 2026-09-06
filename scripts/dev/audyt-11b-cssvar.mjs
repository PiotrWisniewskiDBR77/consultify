import { chromium } from 'playwright';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const composer = page.getByPlaceholder(/Zapytaj Teres/i);
await composer.click();
await composer.fill('testcss');
await page.locator('[data-testid="chat-send-btn"]').first().click();
await page.waitForTimeout(15000);
const info = await page.evaluate(() => {
  const aside = document.querySelector('[data-testid="chat-work-panel"]');
  const header = document.querySelector('[data-testid="canvas-header"]');
  const style = getComputedStyle(aside);
  const headerStyle = getComputedStyle(header);
  return {
    asideVar: style.getPropertyValue('--work-canvas-width'),
    asideWidthComputed: style.width,
    asideRect: aside.getBoundingClientRect().toJSON ? JSON.stringify(aside.getBoundingClientRect()) : null,
    headerWidth: headerStyle.width,
    headerOverflow: headerStyle.overflow,
    headerRect: JSON.stringify(header.getBoundingClientRect()),
    headerScrollWidth: header.scrollWidth,
    headerClientWidth: header.clientWidth,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
