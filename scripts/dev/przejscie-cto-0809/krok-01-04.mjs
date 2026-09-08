#!/usr/bin/env node
/**
 * Przejscie CTO 08.09 — kroki 1-4 (Inicjatywy, ADMIN).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://127.0.0.1:3190';
const AUTH_ADMIN = `${SCRATCH}/auth-admin-przejscie.json`;
const OUT = '/private/tmp/wt-fable-inicjatywy/evidence/przejscie-cto-0809';
fs.mkdirSync(OUT, { recursive: true });

function sql(query) {
  const escaped = query.replace(/'/g, "'\\''");
  const out = execSync(`docker exec consultify-pg18 psql -U postgres -d consultify_kopia_final -Atc '${escaped}'`, { encoding: 'utf8' });
  return out.trim();
}

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
  const dane = { nazwa, opis, url: page.url(), bledyKonsoli: [...konsola], czas: new Date().toISOString(), ...extra };
  fs.writeFileSync(`${sciezka}.json`, JSON.stringify(dane, null, 2));
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

  // === KROK 1: Lista /initiatives, chipy z liczbami, pigulka Wstrzymana ===
  console.log('=== KROK 1 ===');
  const t0 = Date.now();
  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  await zamknijOnboarding();
  await page.waitForTimeout(800);
  console.log('krok1 czas ladowania ms:', Date.now() - t0);
  await zrzut('01-lista-initiatives', 'Lista Inicjatyw — widok domyslny z chipami statusow', { czasLadowaniaMs: Date.now() - t0 });

  // sprobuj znalezc pigulke "Wstrzymana" na liscie (dla on_hold initiatives)
  const pigulkaWstrzymana = page.getByText('Wstrzymana', { exact: true });
  const liczbaWstrzymanych = await pigulkaWstrzymana.count();
  console.log('liczba pigulek "Wstrzymana" na liscie:', liczbaWstrzymanych);
  if (liczbaWstrzymanych > 0) {
    await zrzut('01b-lista-pigulka-wstrzymana', 'Lista — widoczna pigulka "Wstrzymana" dla inicjatywy on_hold');
  }

  // === KROK 2: Szkic BEZ autora "API Gateway v2" -> podglad -> Zarzadzanie -> Do zatwierdzenia ===
  console.log('=== KROK 2 ===');
  await zamknijOnboarding();
  // szukaj po nazwie w tabeli
  const szukaj = page.locator('#modulehub-command-search');
  const searchToggle = page.locator('button[aria-label="Szukaj"]');
  if (await searchToggle.count()) {
    const expanded = await searchToggle.first().getAttribute('aria-expanded');
    if (expanded !== 'true') { await searchToggle.first().click(); await page.waitForTimeout(500); }
  }
  if (await szukaj.count()) {
    await szukaj.fill('API Gateway v2');
    await page.waitForTimeout(2000);
  }
  await zamknijOnboarding();
  const wiersz = page.locator('table tbody tr, [role="row"]', { hasText: 'API Gateway v2' }).first();
  const wierszIstnieje = await wiersz.count();
  console.log('wiersz API Gateway v2 istnieje:', wierszIstnieje);
  if (wierszIstnieje) {
    await wiersz.click();
    await page.waitForTimeout(2500);
    await zamknijOnboarding();
    await zrzut('02a-podglad-api-gateway-przed', 'Podglad "API Gateway v2" (szkic bez autora) PRZED akcja — sekcja Zarzadzanie');

    const btnSubmit = page.getByTestId('initiative-lifecycle-SUBMIT_FOR_REVIEW');
    const btnSubmitCount = await btnSubmit.count();
    console.log('przycisk SUBMIT_FOR_REVIEW znaleziony:', btnSubmitCount);
    if (btnSubmitCount) {
      const disabled = await btnSubmit.first().isDisabled();
      console.log('SUBMIT_FOR_REVIEW disabled:', disabled);
      const powodEl = page.getByTestId('initiative-lifecycle-reason-SUBMIT_FOR_REVIEW');
      const powodTxt = (await powodEl.count()) ? await powodEl.first().innerText() : '(brak elementu powodu)';
      console.log('powod blokady:', powodTxt);
      fs.writeFileSync(`${OUT}/krok2-info.json`, JSON.stringify({ disabled, powodTxt }, null, 2));
      if (!disabled) {
        await btnSubmit.first().click();
        await page.waitForTimeout(2000);
        await zrzut('02b-podglad-api-gateway-po-kliknieciu', 'Po kliknieciu "Do zatwierdzenia"');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2500);
        await zamknijOnboarding();
        await zrzut('02c-podglad-api-gateway-po-reload', 'Po reload — sprawdzenie pigulki statusu');
      } else {
        await zrzut('02b-podglad-api-gateway-zablokowany', `Przycisk "Do zatwierdzenia" wyszarzony. Powod: ${powodTxt}`);
      }
    } else {
      await zrzut('02b-brak-przycisku-submit', 'Brak przycisku SUBMIT_FOR_REVIEW w sekcji Zarzadzanie (sprawdz stan actions.length===0)');
    }
  } else {
    await zrzut('02-brak-wiersza-api-gateway', 'Nie znaleziono wiersza "API Gateway v2" na liscie po wyszukaniu');
  }

  await browser.close();
  fs.writeFileSync(`${OUT}/api-log-01-04.txt`, apiLog.join('\n\n') + '\n');
  console.log('GOTOWE kroki 1-2.');
}

main().catch(async (err) => {
  console.error('AWARIA:', err);
  try {
    if (page) await zrzut('99-awaria-01-04', `Nieprzechwycony blad: ${String(err?.message || err).slice(0, 300)}`);
  } catch {}
  try { if (browser) await browser.close(); } catch {}
  fs.writeFileSync(`${OUT}/api-log-01-04.txt`, apiLog.join('\n\n') + '\n');
  process.exitCode = 1;
});
