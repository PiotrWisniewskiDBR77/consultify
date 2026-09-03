import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:5410';
const URL = `${BASE}/?screen=interview-preview-canon&lang=pl&theme=light&uwagi=0`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1200);
const wiersz = page.locator('table[data-min-table-width] tbody tr').first();
if ((await wiersz.count()) > 0) { await wiersz.click({timeout:5000}).catch(()=>{}); await page.waitForTimeout(500); }
const len = async () => (await page.evaluate(() => document.body.innerText)).length;
console.log('baseline', await len());
for (let runda = 0; runda < 2; runda++) {
  const kontrolki = page.locator('[aria-expanded="false"]');
  const ile = await kontrolki.count();
  console.log(`runda ${runda}: ${ile} kontrolek`);
  for (let i = 0; i < ile; i++) {
    const k = kontrolki.nth(i);
    if (!(await k.isVisible().catch(()=>false))) continue;
    const etykieta = await k.evaluate(el => el.getAttribute('aria-label') || el.getAttribute('title') || el.tagName).catch(()=>null);
    const przed = await len();
    await k.click({timeout:3000}).catch(()=>{});
    const poKliku = await len();
    await page.keyboard.press('Escape').catch(()=>{});
    const poEscape = await len();
    await page.mouse.click(2,2).catch(()=>{});
    const poRogu = await len();
    console.log(`  [${i}] "${etykieta}": przed=${przed} poKliku=${poKliku} poEscape=${poEscape} poRogu=${poRogu}`);
  }
}
await browser.close();
