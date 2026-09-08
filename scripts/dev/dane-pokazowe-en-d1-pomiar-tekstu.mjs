#!/usr/bin/env node
/**
 * D1 — prosty pomiar diakrytyków PL na renderowanym innerText (organization-schemat
 * pomiar-jezyka.mjs nie ma trybu tekstu strony — patrz jego nagłówek). Liczy wystąpienia
 * polskich znaków diakrytycznych w document.body.innerText dla trzech ekranów.
 */
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3198';
const EMAIL = 'james.whitfield@northwind.example';
const PASSWORD = 'ZdXQ6OtkYGoLa6Kn0ik';
const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g;

let page, context, browser;

async function main() {
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(7000);
  await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));

  for (const [nazwa, url] of [
    ['Organization', `${BASE}/organization`],
    ['Admin Panel (Members)', `${BASE}/admin`],
    ['Settings (Profile)', `${BASE}/settings`],
  ]) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    const text = await page.evaluate(() => document.body.innerText);
    const trafienia = text.match(DIAKRYTYKI) || [];
    const przykladySlow = [...new Set((text.match(/\S*[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]\S*/g) || []))].slice(0, 15);
    console.log(`\n=== ${nazwa} (${url}) ===`);
    console.log(`znaków diakrytycznych PL: ${trafienia.length}`);
    console.log(`przykładowe słowa PL: ${przykladySlow.join(', ') || '(brak)'}`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error('BŁĄD:', e);
  process.exit(1);
});
