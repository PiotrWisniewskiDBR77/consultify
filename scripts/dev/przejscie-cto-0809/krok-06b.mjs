#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'node:fs';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://127.0.0.1:3190';
const AUTH_ADMIN = `${SCRATCH}/auth-admin-przejscie.json`;
const OUT = '/private/tmp/wt-fable-inicjatywy/evidence/przejscie-cto-0809';

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

  const pracujZAI = page.getByRole('button', { name: /Pracuj z AI/i }).first();
  await pracujZAI.click();
  await page.waitForTimeout(600);
  await page.getByText('Uzupełnij cały dokument', { exact: true }).click();
  await page.waitForTimeout(1200);
  const zatwierdzBrama = page.getByRole('button', { name: 'Zatwierdź' }).last();
  if (await zatwierdzBrama.count()) { await zatwierdzBrama.click(); await page.waitForTimeout(1500); }

  // W modalu Generator planu: zaznacz oba checkboxy
  const checkboxy = page.locator('input[type="checkbox"]');
  const liczbaCheck = await checkboxy.count();
  console.log('liczba checkboxow w generatorze:', liczbaCheck);
  for (let i = 0; i < liczbaCheck; i += 1) {
    const cb = checkboxy.nth(i);
    const zaznaczony = await cb.isChecked().catch(() => false);
    if (!zaznaczony) await cb.check({ force: true }).catch(() => {});
  }
  await zrzut('06f-generator-zaznaczone', 'Generator planu — zaznaczone inicjatywy przed generowaniem');

  const generujBtn = page.getByRole('button', { name: 'Generuj propozycję' });
  const cntGeneruj = await generujBtn.count();
  console.log('przycisk Generuj propozycje:', cntGeneruj);
  if (cntGeneruj) {
    const wlaczony = await generujBtn.isEnabled().catch(() => false);
    console.log('Generuj propozycje wlaczony:', wlaczony);
    if (wlaczony) {
      const t0 = Date.now();
      await generujBtn.click();
      await page.waitForTimeout(3000);
      await zrzut('06g-generowanie-w-toku', 'Generowanie propozycji w toku');
      // czekaj do 60s na wynik
      let gotowe = false;
      for (let i = 0; i < 20; i += 1) {
        await page.waitForTimeout(3000);
        const zatwierdzKrok5 = page.getByRole('button', { name: /^Zatwierdź$/ }).last();
        const wlaczonyZatw = await zatwierdzKrok5.isEnabled().catch(() => false);
        if (wlaczonyZatw) { gotowe = true; break; }
      }
      console.log('czas generowania propozycji ms:', Date.now() - t0, 'gotowe:', gotowe);
      await zrzut('06h-propozycja-gotowa', `Propozycja gotowa=${gotowe} po ${Date.now() - t0}ms`, { czasMs: Date.now() - t0 });

      if (gotowe) {
        const zatwierdzKoncowy = page.getByRole('button', { name: /^Zatwierdź$/ }).last();
        await zatwierdzKoncowy.click();
        await page.waitForTimeout(2500);
        await zrzut('06i-po-zatwierdzeniu-propozycji', 'Po zatwierdzeniu propozycji generatora');
      }
    } else {
      await zrzut('06g-generuj-wylaczony', 'Przycisk "Generuj propozycje" wylaczony mimo zaznaczenia');
    }
  }

  // Obciazenie rol
  const obciazenieTab = page.getByText('Obciążenie ról', { exact: true }).first();
  if (await obciazenieTab.count()) {
    await obciazenieTab.click();
    await page.waitForTimeout(2500);
    await zrzut('07a-obciazenie-rol', 'Sekcja "Obciazenie rol" po propozycji planu');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await zamknijOnboarding();
    await zrzut('07b-obciazenie-rol-po-reload', 'Obciazenie rol po reload — wartosc FTE trwala?');
  } else {
    await zrzut('07a-brak-obciazenie-rol', 'Brak zakladki Obciazenie rol');
  }

  await browser.close();
  fs.writeFileSync(`${OUT}/api-log-06b.txt`, apiLog.join('\n\n') + '\n');
  console.log('GOTOWE krok 6b/7.');
}

main().catch(async (err) => {
  console.error('AWARIA:', err);
  try { if (page) await zrzut('99-awaria-06b', `Nieprzechwycony blad: ${String(err?.message || err).slice(0, 300)}`); } catch {}
  try { if (browser) await browser.close(); } catch {}
  fs.writeFileSync(`${OUT}/api-log-06b.txt`, apiLog.join('\n\n') + '\n');
  process.exitCode = 1;
});
