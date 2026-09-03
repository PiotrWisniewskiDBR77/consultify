import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:5410';
const URL = `${BASE}/?screen=assessment-list&lang=pl&theme=light&uwagi=0`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1200);
const wiersz = page.locator('table[data-min-table-width] tbody tr').first();
await wiersz.click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(500);

const before = (await page.evaluate(() => document.body.innerText)).length;
const kontrolka = page.locator('[aria-expanded="false"]').first(); // "Szukaj"
await kontrolka.click({ timeout: 3000 });
await page.waitForTimeout(200);
const after1 = (await page.evaluate(() => document.body.innerText)).length;
console.log('before', before, 'after click 1 (search open)', after1);

// klik ponownie w TEN SAM element (teraz ma aria-expanded=true, ale wciaz ten sam element/selector unikalny wg roli)
const kontrolkaPonownie = page.locator('button[aria-label="Szukaj"], button[aria-label="Search"]').first();
await kontrolkaPonownie.click({ timeout: 3000 });
await page.waitForTimeout(200);
const after2 = (await page.evaluate(() => document.body.innerText)).length;
console.log('after click 2 (cofniecie)', after2, 'chip AI Triage obecny:', (await page.evaluate(()=>document.body.innerText)).includes('AI Triage'));
await browser.close();
