/* eslint-disable */
/**
 * RN-G5 F0 reverify — pomocniczy skrypt (poza shot.mjs, bo shot.mjs nie
 * wspiera realnego page.reload()). Weryfikuje TYLKO: czy ustawienie
 * kolumn/pstryczka przeżywa PRAWDZIWE przeładowanie strony (nie SPA-nawigację).
 *
 * node dev-render/verify-reload-persist.mjs <url> --gear=x,y --uncheck=i,j,...
 *   --gear=x,y         współrzędne (CSS px) ikony ustawień widoku (kółko zębate)
 *   --uncheck=i,j      indeksy checkboxów do kliknięcia (0-based, w kolejności DOM)
 *   --shot=<plik.png>  zrzut PO przeładowaniu (opcjonalny)
 *
 * Na stdout: stan checkboxów PRZED zamknięciem panelu, PO reload, oraz
 * KONSOLA-BLEDY / SIEC-4XX5XX (jak w shot.mjs) zebrane z obu faz (przed i po reload).
 */
import { chromium } from 'playwright';

(async () => {
  const [url, ...rest] = process.argv.slice(2);
  const opt = (name, def) => {
    const hit = rest.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : def;
  };
  const [gx, gy] = (opt('gear', '0,0')).split(',').map(Number);
  const uncheckIdx = (opt('uncheck', '')).split(',').filter(Boolean).map(Number);
  const shotPath = opt('shot', null);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const errors = [];
  const netErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 300)));
  page.on('response', (res) => { if (res.status() >= 400) netErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`); });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('http://localhost') || u.startsWith('http://127.0.0.1') || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    return route.abort();
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);

  await page.mouse.click(gx, gy);
  await page.waitForTimeout(400);
  const before = await page.evaluate((idxs) => {
    const cb = document.querySelectorAll('input[type=checkbox]');
    idxs.forEach((i) => cb[i]?.click());
    return [...cb].map((c) => c.checked);
  }, uncheckIdx);
  console.log('PRZED-RELOAD checkboxy:', JSON.stringify(before));

  await page.waitForTimeout(500);
  await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(3000);

  // Re-open the panel to read the persisted checkbox state after reload.
  await page.mouse.click(gx, gy);
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => {
    const cb = document.querySelectorAll('input[type=checkbox]');
    return [...cb].map((c) => c.checked);
  });
  console.log('PO-RELOAD checkboxy:', JSON.stringify(after));

  if (shotPath) await page.screenshot({ path: shotPath });
  if (errors.length) console.log('KONSOLA-BLEDY:\n' + errors.join('\n'));
  if (netErrors.length) console.log('SIEC-4XX5XX:\n' + netErrors.join('\n'));
  console.log('OK');
  await browser.close();
})();
