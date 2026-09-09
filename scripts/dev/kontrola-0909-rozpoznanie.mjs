/**
 * KONTROLA 09.09 — rozpoznanie: wchodzi na ekran, wypisuje przyciski/zakładki
 * i robi zrzut. Służy do zaplanowania przepływu zapisu, nie jest dowodem.
 * Użycie: node scripts/dev/kontrola-0909-rozpoznanie.mjs "/initiatives" nazwa
 */
import { otworz, zaloguj, zrzut, nowyLog, BASE } from './kontrola-0909-wspolne.mjs';

const route = process.argv[2] || '/initiatives';
const nazwa = process.argv[3] || 'rozpoznanie';
const log = nowyLog();
const { browser, page } = await otworz(log);
await zaloguj(page);
await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);
await page.keyboard.press('Escape').catch(() => {});
const info = await page.evaluate(() => ({
  url: location.href,
  naglowek: (document.querySelector('h1,h2')?.innerText || '').slice(0, 120),
  przyciski: [...document.querySelectorAll('button')]
    .map((b) => (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' '))
    .filter(Boolean).slice(0, 60),
  zakladki: [...document.querySelectorAll('[role="tab"]')].map((x) => x.innerText.trim()).slice(0, 20),
  wierszy: document.querySelectorAll('tbody tr').length,
  naglowkiKolumn: [...document.querySelectorAll('thead th')].map((x) => x.innerText.trim()).slice(0, 25),
}));
console.log(JSON.stringify(info, null, 1));
console.log('KONSOLA:', log.konsola.length, log.konsola.slice(0, 5));
console.log('4xx/5xx:', log.siec.filter((s) => s.status >= 400).map((s) => `${s.status} ${s.metoda} ${s.url}`).slice(0, 12));
await zrzut(page, nazwa, 'rozpoznanie');
await browser.close();
