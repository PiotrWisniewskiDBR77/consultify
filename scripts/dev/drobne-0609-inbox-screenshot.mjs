// Jednorazowy skrypt dowodowy dla ZLECENIE DROBNE-0609 część A.
// Renderuje realny ekran Skrzynki (My Work > Inbox) przy 1440px, loguje
// przez wstrzyknięcie localStorage z fixture auth-drobne.json, zapisuje
// zrzut do evidence/drobne-0609/. Do usunięcia po odbiorze (nie jest testem).
import { chromium } from 'playwright';
import fs from 'node:fs';

const authPath = '/private/tmp/stanowisko-noc/auth-drobne.json';
const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
const origin = auth.origins.find((o) => o.origin === 'http://localhost:3000');
const ls = Object.fromEntries(origin.localStorage.map((i) => [i.name, i.value]));

const outDir = '/private/tmp/wt-drobne/evidence/drobne-0609';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

// Musimy najpierw wejść na origin, żeby localStorage.setItem miał gdzie pisać.
await page.goto('http://127.0.0.1:3111/', { waitUntil: 'domcontentloaded' });
await page.evaluate((data) => {
  for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
}, ls);

await page.goto('http://127.0.0.1:3111/my-work', { waitUntil: 'networkidle' });
await page.waitForSelector('table thead th', { timeout: 15000 });
await page.waitForTimeout(1500);

await page.screenshot({ path: `${outDir}/A-skrzynka-1440-po.png`, fullPage: false });

// Pomiar tekstu kolumny OTRZYMANO (dowód liczbowy, nie tylko wzrokowy).
const measurement = await page.evaluate(() => {
  const ths = Array.from(document.querySelectorAll('table thead th'));
  const idx = ths.findIndex((th) => th.textContent.trim().toUpperCase().includes('OTRZYMANO'));
  const th = ths[idx];
  const td = document.querySelectorAll('table tbody tr:first-child td')[idx];
  const span = td ? td.querySelector('span') : null;
  return {
    headerText: th ? th.textContent.trim() : null,
    headerWidth: th ? th.getBoundingClientRect().width : null,
    cellWidth: td ? td.getBoundingClientRect().width : null,
    cellText: span ? span.textContent : null,
    cellTextWidth: span ? span.getBoundingClientRect().width : null,
    overflow: span ? getComputedStyle(span).overflow : null,
    textOverflow: span ? getComputedStyle(span).textOverflow : null,
  };
});

fs.writeFileSync(
  `${outDir}/A-pomiar-otrzymano.json`,
  JSON.stringify({ measurement, consoleErrors }, null, 2)
);

console.log(JSON.stringify({ measurement, consoleErrorsCount: consoleErrors.length }, null, 2));

await browser.close();
