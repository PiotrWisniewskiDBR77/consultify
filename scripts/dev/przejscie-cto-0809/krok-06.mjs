#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'node:fs';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://127.0.0.1:3190';
const AUTH_ADMIN = `${SCRATCH}/auth-admin-przejscie.json`;
const OUT = '/private/tmp/wt-fable-inicjatywy/evidence/przejscie-cto-0809';
fs.mkdirSync(OUT, { recursive: true });

const konsola = [];
const apiLog = [];
function wireLogging(page) {
  page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 400)); });
  page.on('response', async (r) => {
    const u = r.url();
    if (!/\/api\//.test(u)) return;
    const status = r.status();
    let timing = null;
    try { timing = r.request().timing(); } catch {}
    if (status >= 400) {
      let body = '';
      try { body = (await r.text()).slice(0, 400); } catch {}
      apiLog.push(`${new Date().toISOString()} ${r.request().method()} ${status} ${u.replace(BASE, '')}\n    ${body}`);
    }
    if (timing && timing.responseEnd > 2000) {
      apiLog.push(`${new Date().toISOString()} WOLNE ${r.request().method()} ${status} ${u.replace(BASE, '')} ${Math.round(timing.responseEnd)}ms`);
    }
  });
}

let page, context, browser;
async function zrzut(nazwa, opis, extra = {}) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
  fs.writeFileSync(`${sciezka}.json`, JSON.stringify({ nazwa, opis, url: page.url(), bledyKonsoli: [...konsola], czas: new Date().toISOString(), ...extra }, null, 2));
  console.log(`ZRZUT ${nazwa}: ${opis} (bledyKonsoli=${konsola.length})`);
  konsola.length = 0;
}
async function zamknijOnboarding() {
  const pomin = page.getByText('Pomiń na razie', { exact: true });
  const widoczny = await pomin.first().isVisible({ timeout: 2000 }).catch(() => false);
  if (widoczny) { await pomin.first().click({ force: true }); await page.waitForTimeout(500); }
}

async function main() {
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH_ADMIN, locale: 'pl-PL' });
  page = await context.newPage();
  wireLogging(page);

  await page.goto(`${BASE}/initiatives?tab=plan`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await zamknijOnboarding();
  const planRow = page.locator('table tbody tr', { hasText: 'Przejscie CTO 08.09' }).first();
  await planRow.waitFor({ timeout: 10000 });
  await planRow.dblclick();
  await page.waitForTimeout(2500);
  await zamknijOnboarding();

  // Zakres inicjatyw -> dodaj 2 inicjatywy
  await page.getByText('Zakres inicjatyw', { exact: true }).first().click();
  await page.waitForTimeout(1500);
  const select = page.locator('select').first();
  for (let i = 0; i < 2; i += 1) {
    const opcje = await select.locator('option').evaluateAll((els) => els.map((e) => ({ value: e.value, text: e.textContent })));
    const wybor = opcje.find((o) => o.value && o.value !== '');
    if (!wybor) break;
    await select.selectOption(wybor.value);
    await page.waitForTimeout(400);
    const dodajBtn = page.getByRole('button', { name: 'Dodaj inicjatywę' });
    await dodajBtn.click();
    await page.waitForTimeout(1200);
  }
  await zrzut('06a-zakres-z-inicjatywami', 'Zakres inicjatyw po dodaniu 2 pozycji');

  // Pracuj z AI -> Uzupelnij caly dokument -> Zatwierdz brame zgody
  const pracujZAI = page.getByRole('button', { name: /Pracuj z AI/i }).first();
  await pracujZAI.click();
  await page.waitForTimeout(600);
  await zrzut('06b-menu-pracuj-z-ai', 'Menu Pracuj z AI otwarte (po dodaniu inicjatyw)');
  const uzupelnijCaly = page.getByText('Uzupełnij cały dokument', { exact: true });
  await uzupelnijCaly.click();
  await page.waitForTimeout(1200);
  await zrzut('06c-brama-zgody', 'Brama zgody "Uruchomic AI?"');

  const zatwierdz = page.getByRole('button', { name: 'Zatwierdź' }).last();
  const cntZatwierdz = await zatwierdz.count();
  console.log('przycisk Zatwierdz w bramie:', cntZatwierdz);
  if (cntZatwierdz) {
    const t0 = Date.now();
    await zatwierdz.click();
    await page.waitForTimeout(2000);
    await zrzut('06d-po-zatwierdzeniu-generator-startuje', 'Zaraz po zatwierdzeniu bramy — generator startuje');
    // czekaj na wynik (LLM call, moze potrwac)
    let znaleziono = false;
    for (let i = 0; i < 12; i += 1) {
      await page.waitForTimeout(3000);
      const propozycja = page.getByText(/Propozycja|propozycję|Zastosuj|Przejrzyj/i);
      if (await propozycja.count()) { znaleziono = true; break; }
    }
    console.log('czas generowania ms:', Date.now() - t0, 'znaleziono propozycje:', znaleziono);
    await zrzut('06e-generator-wynik', `Wynik generatora po ${Date.now() - t0}ms (propozycja widoczna: ${znaleziono})`, { czasGenerowaniaMs: Date.now() - t0 });
  } else {
    await zrzut('06d-brak-przycisku-zatwierdz-brame', 'Brak przycisku Zatwierdz w bramie zgody');
  }

  await browser.close();
  fs.writeFileSync(`${OUT}/api-log-06.txt`, apiLog.join('\n\n') + '\n');
  console.log('GOTOWE krok 6.');
}

main().catch(async (err) => {
  console.error('AWARIA:', err);
  try { if (page) await zrzut('99-awaria-06', `Nieprzechwycony blad: ${String(err?.message || err).slice(0, 300)}`); } catch {}
  try { if (browser) await browser.close(); } catch {}
  fs.writeFileSync(`${OUT}/api-log-06.txt`, apiLog.join('\n\n') + '\n');
  process.exitCode = 1;
});
