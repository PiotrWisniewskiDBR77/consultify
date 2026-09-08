#!/usr/bin/env node
/**
 * D7 — POPRAWKI do pierwszego przebiegu galerii: kilka zrzutow wymagalo
 * dluzszego oczekiwania albo klikniecia zakladki/przelacznika, ktorego
 * pierwszy skrypt nie trafil. Nadpisuje TYLKO wymienione pliki.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3211';
const OUT = '/private/tmp/wt-d7/evidence/dane-pokazowe-en/d7-galeria';
const EMAIL = 'james.whitfield@northwind.example';
const PASSWORD = 'A6PjlLeXTqxXCuntABk';
const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g;

let page, context, browser;
const konsolaBledy = [];

function rejestrujKonsole() {
  page.on('console', (msg) => {
    if (msg.type() === 'error') konsolaBledy.push({ ts: Date.now(), text: msg.text() });
  });
  page.on('pageerror', (err) => konsolaBledy.push({ ts: Date.now(), text: `pageerror: ${err.message}` }));
}

async function dismissOverlays() {
  for (const txt of ['Skip for now', 'Pomiń na razie', 'Skip', 'Got it', 'Close']) {
    const el = page.getByText(txt, { exact: true }).first();
    if (await el.isVisible({ timeout: 1200 }).catch(() => false)) {
      await el.click({ force: true }).catch(() => {});
      await page.waitForTimeout(700);
    }
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
}

async function zrzut(nazwa, opis, bledyOd) {
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/${nazwa}.png`, fullPage: true });
  const tekst = await page.evaluate(() => document.body.innerText).catch(() => '');
  const trafienia = tekst.match(DIAKRYTYKI) || [];
  const slowaUnikalne = [...new Set(tekst.match(/\S*[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]\S*/g) || [])];
  const bledy = bledyOd ? konsolaBledy.filter((b) => b.ts >= bledyOd) : [];
  const wpis = {
    nazwa,
    opis,
    url: page.url(),
    czas: new Date().toISOString(),
    bledyKonsoli: bledy.map((b) => b.text),
    polskieDiakrytykiLiczba: trafienia.length,
    polskieSlowaUnikalne: slowaUnikalne.slice(0, 40),
  };
  fs.writeFileSync(`${OUT}/${nazwa}.png.json`, JSON.stringify(wpis, null, 2));
  console.log(`ZRZUT ${nazwa} (diakrytyki PL: ${trafienia.length}, bledy konsoli: ${bledy.length})`);
}

async function idz(sciezka, czekaj = 6000) {
  const bledyOd = Date.now();
  await page.goto(`${BASE}${sciezka}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => {
    console.error(`UWAGA nawigacja ${sciezka}: ${e.message}`);
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(czekaj);
  await dismissOverlays();
  return bledyOd;
}

async function zaloguj() {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(8000);
  await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('consultify-storage');
      const j = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      j.state = j.state || {};
      j.state.theme = 'light';
      localStorage.setItem('consultify-storage', JSON.stringify(j));
    } catch {}
    localStorage.setItem('i18nextLng', 'en');
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      if (u && u.id) localStorage.setItem(`consultify_onboarding_done:${u.id}`, '1');
    } catch {}
    localStorage.setItem('demo_tour_skipped', '1');
    localStorage.setItem('demo_tour_completed', '1');
    localStorage.setItem('teresa_onboarding_dismissed', '1');
    localStorage.setItem('consultify_teresa_onboarding_seen', '1');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await dismissOverlays();
}

async function main() {
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  page = await context.newPage();
  rejestrujKonsole();
  await zaloguj();

  // ===== 01 Chat — pokaz panel historii (3 watki) =====
  let t = await idz('/chat', 5000);
  const historyToggle = page.locator('button[title="History"], button[aria-label="History"]').first();
  if (await historyToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
    await historyToggle.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
  } else {
    // Ikona zegara obok "+" w pasku gornym.
    await page.locator('svg').filter({ hasText: '' }).first();
    const clockBtn = page.locator('header, [class*="topbar"], [class*="toolbar"]').first();
  }
  await zrzut('01-chat-lista', 'Chat — panel historii, 3 watki Northwind', t);

  // ===== 03b Interview — otworz panel podgladu =====
  t = await idz('/interview?tab=sessions', 6000);
  const wiersz = page.getByText('Plant operations', { exact: false }).first();
  if (await wiersz.isVisible({ timeout: 3000 }).catch(() => false)) {
    await wiersz.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  const showPanel = page.getByText('Show panel', { exact: true }).first();
  if (await showPanel.isVisible({ timeout: 2000 }).catch(() => false)) {
    await showPanel.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);
  }
  await dismissOverlays();
  await zrzut('03b-interview-podglad', 'Interview — panel podgladu sesji "Plant operations — Leeds"', t);

  // ===== 04 Tools — zakladka Sessions (3 sesje Northwind) =====
  t = await idz('/discovery-tools', 6000);
  const sessionsTab = page.getByRole('tab', { name: 'Sessions' }).first();
  const sessionsTab2 = page.getByText('Sessions', { exact: true }).first();
  if (await sessionsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await sessionsTab.click({ force: true }).catch(() => {});
  } else if (await sessionsTab2.isVisible({ timeout: 2000 }).catch(() => false)) {
    await sessionsTab2.click({ force: true }).catch(() => {});
  }
  await page.waitForTimeout(3000);
  await dismissOverlays();
  await zrzut('04-tools-lista', 'Tools — zakladka Sessions, 3 sesje Northwind', t);

  // ===== 05 Assessment — zakladka Processes (nasza sesja DRD) =====
  t = await idz('/assessment', 6000);
  const processesTab = page.getByRole('tab', { name: 'Processes' }).first();
  const processesTab2 = page.getByText('Processes', { exact: true }).first();
  if (await processesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await processesTab.click({ force: true }).catch(() => {});
  } else if (await processesTab2.isVisible({ timeout: 2000 }).catch(() => false)) {
    await processesTab2.click({ force: true }).catch(() => {});
  }
  await page.waitForTimeout(3000);
  await dismissOverlays();
  await zrzut('05-assessment-lista', 'Assessment — zakladka Processes, sesja DRD Northwind', t);

  // 05b — otworz raport sesji (drugi kluczowy podekran)
  const drdRow = page.getByText('DRD', { exact: false }).first();
  if (await drdRow.isVisible({ timeout: 3000 }).catch(() => false)) {
    await drdRow.click({ force: true }).catch(() => {});
    await page.waitForTimeout(4000);
    await dismissOverlays();
    await zrzut('05b-assessment-raport', 'Assessment — raport sesji DRD otwarty (jednostki 1A..)', t);
  } else {
    console.error('UWAGA: nie znalazlem wiersza DRD na liscie Processes.');
  }

  // ===== 06b Initiatives — drawer draft (dluzsze oczekiwanie, jak D3) =====
  t = await idz(`/initiatives?open=84baaa08-5249-42e4-a292-3921e67d29d1&mode=drawer`, 11000);
  await zrzut('06b-initiatives-podglad-draft', 'Initiatives — podglad "Customer Portal Redesign" (DRAFT)', t);

  await browser.close();
  console.log('GOTOWE POPRAWKI.');
}

main().catch((e) => {
  console.error('BLAD:', e);
  process.exit(1);
});
