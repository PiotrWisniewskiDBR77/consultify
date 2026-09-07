import { chromium } from 'playwright';
const AUTH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad/auth-audyt-3185.json';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: AUTH });
const page = await context.newPage();
await page.goto('http://localhost:3185/execution?tab=list', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await page.screenshot({ path: '/private/tmp/wt-fable-inicjatywy/evidence/odbior-noc-0809/realizacja/zoom-pill.png', clip: { x: 580, y: 420, width: 220, height: 40 } });
await browser.close();
