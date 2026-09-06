/* eslint-disable */
// MVP 1.1-E: weryfikacja end-to-end w REALNEJ aplikacji (nie w harnessu z noop).
// Loguje się cookies z auth-11e.json, wysyła krótkie pytanie, czeka na krótką
// odpowiedź, klika "Ponów odpowiedź" w widocznym rzędzie akcji (bez rozwijania)
// i potwierdza że leci NOWE żądanie POST /api/ai/chat/stream.
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT_DIR = 'evidence/1-1-e';
fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    storageState: '/private/tmp/stanowisko-noc/auth-11e.json',
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  const lsData = JSON.parse(fs.readFileSync(`${OUT_DIR}/localstorage-3090.json`, 'utf8'));
  await page.goto('http://localhost:3121/login', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.evaluate((data) => {
    for (const [k, v] of Object.entries(data)) {
      try { window.localStorage.setItem(k, v); } catch (e) {}
    }
  }, lsData);
  console.log('LOCALSTORAGE WSTRZYKNIETY:', Object.keys(lsData).length, 'kluczy');
  const chatStreamRequests = [];
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + String(e).slice(0, 300)));
  page.on('request', (req) => {
    if (req.url().includes('/api/ai/chat/stream') && req.method() === 'POST') {
      chatStreamRequests.push({ url: req.url(), postData: req.postData()?.slice(0, 500) });
    }
  });

  await page.goto('http://localhost:3121/chat', { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => {
    console.log('GOTO-BLAD', String(e).split('\n')[0]);
  });
  await page.waitForTimeout(2500);
  console.log('URL PO WEJSCIU:', page.url());

  // Znajdź pole kompozytora i wyślij krótkie pytanie.
  const composer = page.locator('textarea, [contenteditable="true"]').first();
  await composer.click({ timeout: 10000 }).catch((e) => console.log('KLIK-KOMPOZYTOR-BLAD', String(e).split('\n')[0]));
  await composer.fill('Odpowiedz jednym krótkim zdaniem: ile to 2+2?').catch(() => {});
  await page.keyboard.press('Enter').catch(() => {});

  await page.waitForTimeout(9000);
  await page.screenshot({ path: `${OUT_DIR}/e2e-po-wyslaniu.png` });

  const regenBtn = page.locator('[data-testid="message-action-regenerate"]').last();
  const regenVisibleWithoutExpand = await regenBtn.isVisible().catch(() => false);
  console.log('PONOW-ODPOWIEDZ WIDOCZNY BEZ ROZWIJANIA:', regenVisibleWithoutExpand);
  console.log('aria-label:', await regenBtn.getAttribute('aria-label').catch(() => null));
  console.log('title:', await regenBtn.getAttribute('title').catch(() => null));

  const beforeClickCount = chatStreamRequests.length;
  if (regenVisibleWithoutExpand) {
    await regenBtn.scrollIntoViewIfNeeded().catch(() => {});
    await regenBtn.click({ timeout: 10000 }).catch((e) => console.log('KLIK-PONOW-BLAD', String(e).split('\n')[0]));
  }
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT_DIR}/e2e-po-ponow.png` });

  console.log('ZADANIA-STREAM-PRZED-KLIKIEM:', beforeClickCount);
  console.log('ZADANIA-STREAM-PO-KLIKU:', chatStreamRequests.length);
  console.log('ZADANIA-STREAM-JSON:', JSON.stringify(chatStreamRequests, null, 2));
  console.log('KONSOLA-BLEDY:', JSON.stringify(consoleErrors));

  fs.writeFileSync(
    `${OUT_DIR}/e2e-post-requests.json`,
    JSON.stringify({ chatStreamRequests, consoleErrors, regenVisibleWithoutExpand }, null, 2)
  );

  await browser.close();
})();
