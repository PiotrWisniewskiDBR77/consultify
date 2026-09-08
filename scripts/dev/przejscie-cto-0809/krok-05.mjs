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

  console.log('=== KROK 5: Plan tab ===');
  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await zamknijOnboarding();
  const planTab = page.getByRole('tab', { name: 'Plan' }).or(page.getByText('Plan', { exact: true }));
  await planTab.first().click();
  await page.waitForTimeout(2500);
  await zamknijOnboarding();
  await zrzut('05a-plan-lista', 'Zakladka Plan — lista planow (przed utworzeniem)');

  const nowyPlanBtn = page.getByRole('button', { name: /Nowy plan/i });
  const cntNowyPlan = await nowyPlanBtn.count();
  console.log('przycisk Nowy plan:', cntNowyPlan);
  if (cntNowyPlan) {
    await nowyPlanBtn.first().click();
    await page.waitForTimeout(1500);
    await zrzut('05b-plan-formularz-nowy', 'Formularz "Nowy plan" otwarty');

    // wypelnij nazwe (aria-label dokladny)
    const nazwaInput = page.locator('input[aria-label="Nazwa planu nadana przez Ciebie"]');
    const nazwaPlann = `Przejscie CTO 08.09 — plan testowy ${Date.now()}`;
    if (await nazwaInput.count()) {
      await nazwaInput.click();
      await nazwaInput.fill(nazwaPlann);
      await page.waitForTimeout(400);
    }
    await zrzut('05c-plan-formularz-wypelniony', 'Formularz z nazwa planu wypelniona');

    // szukaj przycisku Utworz/Zapisz w formularzu
    const utworz = page.getByRole('button', { name: /Utwórz plan|Zapisz|Stwórz plan|Dalej/i }).last();
    if (await utworz.count()) {
      await utworz.waitFor({ state: 'attached', timeout: 5000 });
      const jestWlaczony = await utworz.isEnabled().catch(() => false);
      console.log('przycisk Utworz plan wlaczony:', jestWlaczony);
      if (jestWlaczony) {
        await utworz.click();
        await page.waitForTimeout(3000);
        await zrzut('05d-plan-po-utworzeniu', 'Po utworzeniu planu — karta planu');
      } else {
        await zrzut('05d-przycisk-utworz-wylaczony', 'Przycisk "Utworz plan" pozostaje wylaczony mimo wypelnionej nazwy');
      }
    } else {
      await zrzut('05d-brak-przycisku-utworz', 'Brak przycisku tworzenia planu w formularzu');
    }
  } else {
    await zrzut('05b-brak-przycisku-nowy-plan', 'Brak przycisku "Nowy plan"');
  }

  // Sprobuj "Pracuj z AI"
  const pracujZAI = page.getByRole('button', { name: /Pracuj z AI/i }).or(page.getByText('Pracuj z AI'));
  const cntAI = await pracujZAI.count();
  console.log('przycisk Pracuj z AI:', cntAI);
  if (cntAI) {
    await pracujZAI.first().click();
    await page.waitForTimeout(1500);
    await zrzut('05e-pracuj-z-ai-brama-zgody', 'Brama zgody / okno Pracuj z AI');
  } else {
    await zrzut('05e-brak-pracuj-z-ai', 'Brak przycisku "Pracuj z AI" na widocznym ekranie');
  }

  await browser.close();
  fs.writeFileSync(`${OUT}/api-log-05.txt`, apiLog.join('\n\n') + '\n');
  console.log('GOTOWE krok 5.');
}

main().catch(async (err) => {
  console.error('AWARIA:', err);
  try { if (page) await zrzut('99-awaria-05', `Nieprzechwycony blad: ${String(err?.message || err).slice(0, 300)}`); } catch {}
  try { if (browser) await browser.close(); } catch {}
  fs.writeFileSync(`${OUT}/api-log-05.txt`, apiLog.join('\n\n') + '\n');
  process.exitCode = 1;
});
