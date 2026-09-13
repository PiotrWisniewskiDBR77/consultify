import { chromium } from 'playwright';
const [url, ...klik] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const bledy = [];
page.on('console', (m) => { if (m.type() === 'error') bledy.push(m.text()); });
page.on('pageerror', (e) => bledy.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(4500);
for (const k of klik) { await page.click(k, { timeout: 8000 }).catch((e)=>console.log('KLIK-BLAD', k, String(e).slice(0,80))); await page.waitForTimeout(1500); }
const wynik = await page.evaluate(() => {
  const meta = document.querySelector('[data-preview-block="meta"]');
  const naglowek = document.querySelector('[data-preview-block="header"]');
  const panel = document.querySelector('[data-preview-block="header"]')?.parentElement;
  const cialo = panel?.querySelector(':scope > div.flex-1');
  const tekst = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
  return {
    aside: document.querySelectorAll('aside[data-right-panel], [role="region"] aside').length,
    asideWszystkie: document.querySelectorAll('aside').length,
    stronaScroll: document.documentElement.scrollHeight,
    stronaClient: document.documentElement.clientHeight,
    naglowekTekst: tekst(naglowek),
    naglowekOpen: naglowek ? Array.from(naglowek.querySelectorAll('button')).map((b) => b.textContent.trim() || b.getAttribute('aria-label')) : null,
    metaTekst: tekst(meta),
    metaKlasaTrailing: meta?.querySelector(':scope > div > div.shrink-0 > span')?.className ?? null,
    whatsNext: tekst(document.querySelector('[data-preview-block="whatsnext"]')),
    relacje: tekst(document.querySelector('[data-preview-block="relations"]')),
    panelScroll: cialo ? { scrollHeight: cialo.scrollHeight, clientHeight: cialo.clientHeight } : null,
    liczbaOpen: Array.from(document.querySelectorAll('aside button, [data-preview-block] button')).filter((b) => /^(Open|Otwórz)$/i.test(b.textContent.trim())).length,
  };
});
/*
 * Bledy konsoli dziela sie na dwie rodziny i tylko jedna jest o produkcie:
 * harness nie ma backendu (`apiNoBackendPlugin` odsyla uczciwe 404), wiec
 * KAZDE wolanie /api konczy sie 404 w konsoli. Liczymy osobno bledy PRODUKTU.
 */
const brakBackendu = (t) =>
  /404 \(Not Found\)/.test(t) ||
  /HTTP 404 Not Found/.test(t) ||
  /DEV_RENDER_NO_BACKEND/.test(t) ||
  /Failed to fetch|ApiError|nieosiagalne|nieosi\u0105galne/i.test(t);
const bledyProduktu = bledy.filter((t) => !brakBackendu(t));
console.log(JSON.stringify({ ...wynik, bledyKonsoli: bledy.length, bledyProduktu: bledyProduktu.length, bledy: bledyProduktu.slice(0, 5) }, null, 2));
await browser.close();
