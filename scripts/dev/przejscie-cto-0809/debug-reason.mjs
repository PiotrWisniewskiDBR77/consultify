import { chromium } from 'playwright';
const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://127.0.0.1:3190';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: `${SCRATCH}/auth-admin-przejscie.json`, locale: 'pl-PL' });
const page = await context.newPage();
await page.goto(`${BASE}/initiatives?open=7eb944f9-c5b9-4162-8bff-23b0d620f9f3&mode=drawer`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
const info = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="initiative-lifecycle-reason-transition:APPROVED"]');
  if (!el) return { found: false };
  const rect = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  let parent = el.parentElement;
  const parents = [];
  for (let i = 0; i < 4 && parent; i++) {
    const pr = parent.getBoundingClientRect();
    const pcs = getComputedStyle(parent);
    parents.push({ tag: parent.tagName, cls: parent.className, rect: { x: pr.x, y: pr.y, w: pr.width, h: pr.height }, overflow: pcs.overflow, overflowY: pcs.overflowY, display: pcs.display, maxHeight: pcs.maxHeight });
    parent = parent.parentElement;
  }
  return {
    found: true,
    text: el.innerText,
    rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    display: cs.display, visibility: cs.visibility, opacity: cs.opacity, color: cs.color,
    parents,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
