// Interaction evidence for D-104 (2026-08-30) — suggestion-chip toggle.
// Proves: (1) toggle is reachable via ToolsMenu (Pen icon) in the composer,
// (2) clicking it hides the chips immediately, (3) the choice persists across
// a full page reload (localStorage-backed aiConfig, same as every other AI
// mode). Usage: node menu3-104-suggestions-toggle-screenshots.mjs <outdir>
import fs from 'fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3020';
const OUT = process.argv[2] || '/private/tmp/m03/evidence/assessment/104-teresa-agent';

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
const page = await context.newPage();

const url = `${BASE}/?screen=teresa-chipy-sugestii&theme=light&lang=pl`;
console.log('navigating', url);
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(500);

// Panel B (insight context, right side) is the one where chips must survive.
// Focus its composer textarea to reveal the (opacity-0-by-default) action bar.
const rightTextarea = page.locator('textarea').nth(1);
await rightTextarea.click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/toggle-01-composer-focused.png`, fullPage: true });

// Open ToolsMenu (data-testid="chat-tools-button") in the right panel.
const toolsButtons = page.locator('[data-testid="chat-tools-button"]');
const rightToolsButton = toolsButtons.nth(1);
await rightToolsButton.click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/toggle-02-menu-open.png`, fullPage: true });

// Click the new "Chipy sugestii" row.
await page.getByText('Chipy sugestii', { exact: true }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/toggle-03-after-click-menu-still-open.png`, fullPage: true });

// Close the menu (click elsewhere) and confirm chips are gone.
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/toggle-04-chips-hidden.png`, fullPage: true });

// Reload — persistence check.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/toggle-05-after-reload-still-hidden.png`, fullPage: true });

await browser.close();
console.log('DONE');
