#!/usr/bin/env node
/**
 * D6 — pomiar języka (innerText, bez polskich znaków diakrytycznych),
 * organizacja "northwind" po angielsku, ekrany Materiały/Spotkania/Czat/Moja
 * Praca (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §D6).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3201';
const OUT = '/private/tmp/wt-d6/evidence/dane-pokazowe-en/d6/pomiar-jezyka-innerText.txt';
const EMAIL = 'james.whitfield@northwind.example';
const PASSWORD = 'JPJxSySkX8jiM1OrORQ';
const MEETING_ID = '2e124a9f-30cd-5ea8-bf77-49441a1861bf';
const CONVERSATION_ID = '017b0fd4-655e-5072-8454-36b4c6817ef1';

const POLSKIE = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g;

let page, context, browser;
const wyniki = [];

async function zmierz(nazwa, url, postAction) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);
  if (postAction) await postAction();
  const text = await page.evaluate(() => document.body.innerText);
  const matches = text.match(POLSKIE) || [];
  wyniki.push({ nazwa, url, polskieZnaki: matches.length, przyklad: matches.slice(0, 20).join('') });
  console.log(`${nazwa}: ${matches.length} polskich znaków diakrytycznych`);
}

async function main() {
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(7000);
  await page.evaluate(() => {
    localStorage.setItem('i18nextLng', 'en');
    localStorage.setItem('demo_tour_skipped', '1');
    localStorage.setItem('demo_tour_completed', '1');
    localStorage.setItem('teresa_onboarding_dismissed', '1');
    localStorage.setItem('consultify_teresa_onboarding_seen', '1');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.keyboard.press('Escape').catch(() => {});

  await zmierz('materialy-lista', `${BASE}/reports`);
  await zmierz('spotkania-lista', `${BASE}/meetings`);
  await zmierz('spotkanie-notatka', `${BASE}/meetings/${MEETING_ID}`, async () => {
    const tab = page.getByText('Minutes', { exact: true }).first();
    if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tab.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1200);
    }
  });
  await zmierz('czat-watek', `${BASE}/chat/${CONVERSATION_ID}`);
  await zmierz('moja-praca-skrzynka', `${BASE}/my-work`);

  const tresc = wyniki
    .map(
      (w) =>
        `${w.nazwa} (${w.url})\n  polskie znaki: ${w.polskieZnaki}${w.przyklad ? `\n  przyklad: ${w.przyklad}` : ''}`
    )
    .join('\n\n');
  fs.writeFileSync(OUT, tresc + '\n');
  console.log('\nZapisano:', OUT);

  await browser.close();
}

main().catch((e) => {
  console.error('BŁĄD:', e);
  process.exit(1);
});
