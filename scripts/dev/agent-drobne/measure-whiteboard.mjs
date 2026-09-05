import { chromium } from 'playwright';

const base = 'http://localhost:4777';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const page = await ctx.newPage();
await page.goto(base + '/?screen=whiteboard-canvas', { waitUntil: 'load' });
await page.waitForTimeout(8000);
const sticky = page.locator('text=Klient nie ma spisanej dokumentacji procesu').first();
await sticky.waitFor({ state: 'visible', timeout: 15000 });
await sticky.click();
await page.waitForTimeout(1000);

const bar = page.locator('[aria-label="Akcje zaznaczenia"]').first();
const barBox = await bar.boundingBox();
console.log('selectionBar box:', barBox);

// find canvas container - the flex-1 area holding react-flow
const canvasContainer = page.locator('.react-flow').first();
const canvasBox = await canvasContainer.boundingBox();
console.log('reactflow canvas box:', canvasBox);

if (barBox && canvasBox) {
  const overflowLeft = canvasBox.x - barBox.x;
  const overflowRight = (barBox.x + barBox.width) - (canvasBox.x + canvasBox.width);
  console.log('overflowLeft(px, +=overflow):', overflowLeft, 'overflowRight:', overflowRight);
}
await browser.close();
