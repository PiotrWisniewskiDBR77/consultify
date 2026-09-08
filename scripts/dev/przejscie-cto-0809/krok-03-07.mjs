#!/usr/bin/env node
/**
 * Przejscie CTO 08.09 — kroki 3-7 (Inicjatywy, ADMIN): Zatwierdz(blok), Wstrzymaj/Wznow,
 * Plan -> Pracuj z AI -> analiza obciazenia, widoki listy.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://127.0.0.1:3190';
const AUTH_ADMIN = `${SCRATCH}/auth-admin-przejscie.json`;
const OUT = '/private/tmp/wt-fable-inicjatywy/evidence/przejscie-cto-0809';
fs.mkdirSync(OUT, { recursive: true });

const ID_CYBER = '7eb944f9-c5b9-4162-8bff-23b0d620f9f3'; // Cybersecurity Enhancement Program, PENDING_APPROVAL
const ID_DEVOPS = 'd3bc32b2-ca68-456f-8af9-a432d6f10442'; // DevOps Transformation, IN_EXECUTION, on_hold=false

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

  // === KROK 3: Zatwierdz (wyszarzony, powod GATE_DECISION_REQUIRED) ===
  console.log('=== KROK 3 ===');
  await page.goto(`${BASE}/initiatives?open=${ID_CYBER}&mode=drawer`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  await zamknijOnboarding();
  await page.waitForTimeout(800);
  await zrzut('03a-cyber-podglad', 'Podglad "Cybersecurity Enhancement Program" (Do zatwierdzenia) — sekcja Zarzadzanie');

  const btnApprove = page.getByTestId('initiative-lifecycle-transition:APPROVED');
  const cntApprove = await btnApprove.count();
  console.log('przycisk APPROVE znaleziony:', cntApprove);
  if (cntApprove) {
    const disabled = await btnApprove.first().isDisabled();
    const powodEl = page.getByTestId('initiative-lifecycle-reason-transition:APPROVED');
    const powodTxt = (await powodEl.count()) ? await powodEl.first().innerText() : '(brak elementu powodu)';
    console.log('APPROVE disabled:', disabled, 'powod:', powodTxt);
    await btnApprove.first().scrollIntoViewIfNeeded();
    await zrzut('03b-cyber-zatwierdz-wyszarzony', `Przycisk "Zatwierdz" disabled=${disabled}. Powod: ${powodTxt}`, { disabled, powodTxt });
  } else {
    await zrzut('03b-brak-przycisku-approve', 'Brak przycisku APPROVE w sekcji Zarzadzanie');
  }

  // === KROK 4: Wstrzymaj / Wznow na "DevOps Transformation" (IN_EXECUTION) ===
  console.log('=== KROK 4 ===');
  await page.goto(`${BASE}/initiatives?open=${ID_DEVOPS}&mode=drawer`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  await zamknijOnboarding();
  await zrzut('04a-devops-przed-wstrzymaniem', 'Podglad "DevOps Transformation" (W realizacji) PRZED Wstrzymaj');

  const btnHold = page.getByTestId('initiative-lifecycle-flag:HOLD');
  const cntHold = await btnHold.count();
  console.log('przycisk HOLD znaleziony:', cntHold);
  if (cntHold) {
    await btnHold.first().click();
    await page.waitForTimeout(800);
    // moze pojawic sie dialog z powodem (requiresReason: true)
    const dialogInput = page.locator('textarea, input[type="text"]').last();
    const dialogVisible = await dialogInput.isVisible({ timeout: 2000 }).catch(() => false);
    if (dialogVisible) {
      await dialogInput.fill('Przejscie CTO 08.09 — test wstrzymania (do przywrocenia SQL po dowodzie).');
      await zrzut('04b-devops-dialog-powodu', 'Dialog powodu dla Wstrzymaj (requiresReason)');
      const potwierdz = page.getByRole('button', { name: /Wstrzymaj/i }).last();
      if (await potwierdz.count()) { await potwierdz.click(); await page.waitForTimeout(2000); }
    }
    await page.waitForTimeout(1500);
    await zrzut('04c-devops-po-wstrzymaniu', 'Po kliknieciu Wstrzymaj (przed reload)');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await zamknijOnboarding();
    await zrzut('04d-devops-po-reload-wstrzymana', 'Po reload — sprawdz pigulke "Wstrzymana" w podgladzie');

    // sprawdz liste
    await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await zamknijOnboarding();
    await zrzut('04e-lista-po-wstrzymaniu', 'Lista — DevOps Transformation powinien miec pigulke "Wstrzymana"');

    // teraz Wznow
    await page.goto(`${BASE}/initiatives?open=${ID_DEVOPS}&mode=drawer`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await zamknijOnboarding();
    const btnResume = page.getByTestId('initiative-lifecycle-flag:RESUME');
    const cntResume = await btnResume.count();
    console.log('przycisk RESUME znaleziony:', cntResume);
    if (cntResume) {
      await btnResume.first().click();
      await page.waitForTimeout(2000);
      await zrzut('04f-devops-po-wznowieniu', 'Po kliknieciu Wznow (przed reload)');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      await zamknijOnboarding();
      await zrzut('04g-devops-po-reload-wznowiona', 'Po reload — pigulka Wznowiona/W realizacji, bez Wstrzymana');
    } else {
      await zrzut('04f-brak-przycisku-resume', 'Brak przycisku RESUME po Wstrzymaniu');
    }
  } else {
    await zrzut('04b-brak-przycisku-hold', 'Brak przycisku HOLD na DevOps Transformation');
  }

  await browser.close();
  fs.writeFileSync(`${OUT}/api-log-03-04.txt`, apiLog.join('\n\n') + '\n');
  console.log('GOTOWE kroki 3-4.');
}

main().catch(async (err) => {
  console.error('AWARIA:', err);
  try {
    if (page) await zrzut('99-awaria-03-04', `Nieprzechwycony blad: ${String(err?.message || err).slice(0, 300)}`);
  } catch {}
  try { if (browser) await browser.close(); } catch {}
  fs.writeFileSync(`${OUT}/api-log-03-04.txt`, apiLog.join('\n\n') + '\n');
  process.exitCode = 1;
});
