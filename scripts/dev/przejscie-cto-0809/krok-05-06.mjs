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
  await zrzut('05f-plan-otwarty-doc', 'Plan otwarty w widoku dokumentu (dblclick z listy)');

  // Zakres inicjatyw
  const zakresTab = page.getByText('Zakres inicjatyw', { exact: true }).first();
  if (await zakresTab.count()) {
    await zakresTab.click();
    await page.waitForTimeout(2000);
    await zrzut('05g-zakres-inicjatyw', 'Sekcja "Zakres inicjatyw" planu');
  } else {
    await zrzut('05g-brak-zakres-inicjatyw', 'Brak zakladki "Zakres inicjatyw"');
  }

  // Pracuj z AI -> Analizuj (na sekcji Horyzont/dokumencie calym)
  const horyzontTab = page.getByText('Horyzont', { exact: true }).first();
  if (await horyzontTab.count()) { await horyzontTab.click(); await page.waitForTimeout(1000); }
  const pracujZAI = page.getByRole('button', { name: /Pracuj z AI/i }).first();
  if (await pracujZAI.count()) {
    await pracujZAI.click();
    await page.waitForTimeout(800);
    await zrzut('06a-pracuj-z-ai-menu', 'Menu "Pracuj z AI" otwarte na Planie');
    const uzupelnijCaly = page.getByText('Uzupełnij cały dokument', { exact: true });
    if (await uzupelnijCaly.count()) {
      await uzupelnijCaly.click();
      await page.waitForTimeout(1500);
      await zrzut('06b-brama-zgody', 'Brama zgody (jesli sie pojawia) przed generowaniem');
      // szukaj przycisku zgody/kontynuuj
      const zgoda = page.getByRole('button', { name: /Zgadzam się|Kontynuuj|Potwierdź|Rozpocznij|Generuj/i }).last();
      if (await zgoda.count()) {
        await zgoda.click();
        await page.waitForTimeout(2000);
        await zrzut('06c-po-zgodzie', 'Po potwierdzeniu bramy zgody — generator/postep');
        // czekaj na propozycje (moze potrwac, LLM call)
        await page.waitForTimeout(8000);
        await zrzut('06d-generator-propozycja', 'Generator — oczekiwana propozycja po czasie oczekiwania');
      }
    } else {
      await zrzut('06b-brak-opcji-uzupelnij', 'Brak opcji "Uzupelnij caly dokument" w menu Pracuj z AI');
    }
  } else {
    await zrzut('06a-brak-przycisku-pracuj-z-ai', 'Brak przycisku "Pracuj z AI" w widoku dokumentu planu');
  }

  await browser.close();
  fs.writeFileSync(`${OUT}/api-log-05-06.txt`, apiLog.join('\n\n') + '\n');
  console.log('GOTOWE 05-06.');
}

main().catch(async (err) => {
  console.error('AWARIA:', err);
  try { if (page) await zrzut('99-awaria-05-06', `Nieprzechwycony blad: ${String(err?.message || err).slice(0, 300)}`); } catch {}
  try { if (browser) await browser.close(); } catch {}
  fs.writeFileSync(`${OUT}/api-log-05-06.txt`, apiLog.join('\n\n') + '\n');
  process.exitCode = 1;
});
