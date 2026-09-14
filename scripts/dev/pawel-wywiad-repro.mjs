/* eslint-disable */
/**
 * Repro P-P03 / P-P04 (zgłoszenia Pawła 14.09) na harnessie dev-render
 * z REALNYM `DrdHttpMethodWorkspaceScreen` + atrapą serwera method-core.
 *
 * node scripts/dev/pawel-wywiad-repro.mjs <katalog-dowodow> <przyrostek>
 */
import { chromium } from 'playwright';
import path from 'path';

const outDir = process.argv[2];
const suffix = process.argv[3] || 'przed';
const URL =
  'http://localhost:4351/?screen=drd-http-workspace&lang=en&theme=dark&stage=inprogress&view=interview&lag=350';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="interview-focus-panel"]', { timeout: 30000 });
  await sleep(1200);

  const snap = async () => ({
    step: await page.locator('[data-testid="interview-focus-panel"]').innerText().then(
      (t) => (t.match(/Step \d+\/\d+/) || ['(brak)'])[0]
    ),
    loading: await page.locator('[data-testid="method-workspace-loading"]').count(),
    badge: await page
      .locator('text=/DANE Z SERWERA|SZKIC ODZYSKIWANIA|DANE LOKALNE/')
      .first()
      .innerText()
      .catch(() => '(brak)'),
    selected: await page
      .locator('[data-testid="answer-state-control"] button[aria-checked="true"]')
      .first()
      .innerText()
      .catch(() => '(nic)'),
  });

  console.log('STAN POCZATKOWY', JSON.stringify(await snap()));
  await page.screenshot({ path: path.join(outDir, `p03-00-start-${suffix}.png`) });

  // --- P-P03: wpisanie tekstu w polu odpowiedzi -----------------------------
  // Obserwator DOM — okno przejsciowego `loading` bywa krotsze niz 100 ms,
  // wiec odpytywanie co 100 ms je gubi (zmierzone). Liczymy kazda podmiane.
  await page.evaluate(() => {
    window.__hits = 0;
    window.__unmounts = 0;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="method-workspace-loading"]')) window.__hits++;
      if (!document.querySelector('[data-testid="interview-focus-panel"]')) window.__unmounts++;
    }).observe(document.body, { childList: true, subtree: true });
  });

  const ta = page.locator('[data-testid="interview-focus-panel"] textarea').first();
  await ta.click();
  await ta.type('Pilot test answer from Pawel repro', { delay: 25 });
  console.log('PO WPISANIU (0 ms)', JSON.stringify(await snap()));

  await sleep(4000);
  const hits = await page.evaluate(() => ({ loading: window.__hits, unmount: window.__unmounts }));
  console.log(
    'P-P03 WYGASZENIA POWLOKI ("Loading session…"):', hits.loading,
    '| ZNIKNIECIA PANELU WYWIADU:', hits.unmount
  );
  await sleep(800);
  const po03 = await snap();
  console.log('P-P03 PO AUTOZAPISIE', JSON.stringify(po03));
  await page.screenshot({ path: path.join(outDir, `p03-02-po-autozapisie-${suffix}.png`) });

  // --- P-P04: wybór "Confirmed" po wpisaniu tekstu --------------------------
  const ta2 = page.locator('[data-testid="interview-focus-panel"] textarea').first();
  await ta2.click();
  await ta2.type(' more', { delay: 25 });           // uzbraja debounce autozapisu
  await sleep(200);
  await page
    .locator('[data-testid="answer-state-control"] button', { hasText: 'Confirmed' })
    .first()
    .click();
  await sleep(300);
  const zaraz = await snap();
  console.log('P-P04 ZARAZ PO KLIKU', JSON.stringify(zaraz));
  await page.screenshot({ path: path.join(outDir, `p04-01-zaraz-po-kliku-${suffix}.png`) });
  await sleep(3000);
  const pozniej = await snap();
  console.log('P-P04 PO 3 s', JSON.stringify(pozniej));
  await page.screenshot({ path: path.join(outDir, `p04-02-po-3s-${suffix}.png`) });
  console.log(
    'P-P04 COFNIECIE WYBORU:',
    zaraz.selected !== pozniej.selected ? `TAK (${zaraz.selected} -> ${pozniej.selected})` : 'NIE'
  );
  console.log('KONSOLA-BLEDY', JSON.stringify(errors.slice(0, 10)));
  await browser.close();
})();
