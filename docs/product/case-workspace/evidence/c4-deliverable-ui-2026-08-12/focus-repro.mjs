// Focused repro: is the keyboard focus-restore failure real, or a
// headless/backgrounded-tab rAF-throttling artifact? Runs with headless:false
// (a real, foregrounded window) so requestAnimationFrame behaves the way it
// does for an actual human user.
import { chromium } from 'playwright';

const APP = 'http://127.0.0.1:4501';
const CASE_URL = `${APP}/zlecenia/case-94b37954-c4a1-4417-8eed-9edefd570f95?zakladka=rezultaty&widok-planu=prosty`;

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${APP}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'cw.local@local.test');
  await page.fill('input[type="password"]', 'CaseWorkspaceLocal!2026');
  await Promise.all([page.waitForURL(/\/chat/, { timeout: 15000 }), page.click('button[type="submit"]')]);
  await page.evaluate(() => localStorage.setItem('ff.caseWorkspace', '1'));

  await page.goto(CASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Powiązane obiekty', { timeout: 20000 });

  const vis = await page.evaluate(() => ({
    visibilityState: document.visibilityState,
    hidden: document.hidden,
    hasFocus: document.hasFocus(),
  }));
  console.log('VISIBILITY', JSON.stringify(vis));

  const btn = page.getByRole('button', { name: 'Otwórz obiekt: Decyzja' });
  await btn.scrollIntoViewIfNeeded();
  await btn.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  console.log('URL_AFTER_OPEN', page.url());

  await page.goBack({ waitUntil: 'networkidle' });

  // Poll every 100ms for up to 3s, log every activeElement transition.
  const trace = [];
  for (let i = 0; i < 30; i++) {
    const snap = await page.evaluate(() => ({
      tag: document.activeElement && document.activeElement.tagName,
      label:
        document.activeElement &&
        document.activeElement.getAttribute &&
        document.activeElement.getAttribute('aria-label'),
      outline: document.activeElement ? getComputedStyle(document.activeElement).outlineStyle : null,
    }));
    const last = trace[trace.length - 1];
    if (!last || last.tag !== snap.tag || last.label !== snap.label) trace.push({ t: i * 100, ...snap });
    await page.waitForTimeout(100);
  }
  console.log('FOCUS_TRACE', JSON.stringify(trace, null, 2));

  await browser.close();
})().catch((err) => {
  console.error('REPRO_FAILED', err);
  process.exit(1);
});
