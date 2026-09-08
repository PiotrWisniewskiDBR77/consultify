import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:3187';
const EMAIL = process.env.EMAIL;
const OUT = process.env.OUTAUTH;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);
await page.fill('input[type="email"], input[name="email"]', EMAIL);
await page.fill('input[type="password"], input[name="password"]', 'AudytDBR77!2026');
await page.click('button[type="submit"]');
await page.waitForTimeout(7000);
console.log('url:', page.url());
await page.evaluate(() => {
  try {
    const raw = localStorage.getItem('consultify-storage');
    const j = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    j.state = j.state || {}; j.state.theme = 'light';
    localStorage.setItem('consultify-storage', JSON.stringify(j));
  } catch {}
  localStorage.setItem('i18nextLng', 'pl');
  const u = JSON.parse(localStorage.getItem('user') || '{}');
  if (u && u.id) localStorage.setItem(`consultify_onboarding_done:${u.id}`, '1');
  localStorage.setItem('demo_tour_skipped', '1');
  localStorage.setItem('demo_tour_completed', '1');
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await ctx.storageState({ path: OUT });
console.log('zapisano', OUT, page.url());
await browser.close();
