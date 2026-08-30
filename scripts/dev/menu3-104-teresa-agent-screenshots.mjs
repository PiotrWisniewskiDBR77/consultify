// Evidence capture for katalog=104-teresa-agent (3 owner notes: confirm chip,
// suggestion chips, agent-plan-canvas). Usage: node shot-104.mjs <outdir> <tag>
import fs from 'fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3020';
const OUT = process.argv[2] || '/private/tmp/m03/evidence/assessment/104-teresa-agent';
const TAG = process.argv[3] || 'przed';

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

async function shoot(screen, name, theme, waitSelector) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await context.newPage();
  const url = `${BASE}/?screen=${screen}&theme=${theme}&lang=pl`;
  console.log('navigating', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  if (waitSelector) {
    try {
      await page.waitForSelector(waitSelector, { timeout: 15000 });
    } catch (e) {
      console.log('WARN: selector not found', waitSelector, e.message);
    }
  }
  await page.waitForTimeout(500);
  const path = `${OUT}/${TAG}-${name}-${theme}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log('saved', path);
  await context.close();
}

await shoot('teresa-confirm-chip', '01-confirm-chip', 'light', 'text=Potwierdź');
await shoot('teresa-confirm-chip', '01-confirm-chip', 'dark', 'text=Potwierdź');

await shoot('teresa-chipy-sugestii', '02-chipy-sugestii', 'light', null);
await shoot('teresa-chipy-sugestii', '02-chipy-sugestii', 'dark', null);

await shoot('agent-plan-canvas', '03-agent-plan-canvas', 'light', null);
await shoot('agent-plan-canvas', '03-agent-plan-canvas', 'dark', null);

await browser.close();
console.log('DONE');
