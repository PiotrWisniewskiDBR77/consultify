#!/usr/bin/env node
/**
 * D1 — zrzuty dowodowe organizacji "northwind" po angielsku (dark+light).
 * Login jako OWNER (james.whitfield@northwind.example), harness bez asysty właściciela.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3198';
const OUT = '/private/tmp/wt-d1/evidence/dane-pokazowe-en/d1';
fs.mkdirSync(OUT, { recursive: true });

const EMAIL = 'james.whitfield@northwind.example';
const PASSWORD = 'ZdXQ6OtkYGoLa6Kn0ik';

let page, context, browser;

async function zrzut(nazwa) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
  console.log(`ZRZUT ${nazwa}`);
}

async function dismissOverlays() {
  for (const txt of ['Skip for now', 'Pomiń na razie', 'Skip']) {
    const el = page.getByText(txt, { exact: true }).first();
    const visible = await el.isVisible({ timeout: 1500 }).catch(() => false);
    if (visible) {
      await el.click({ force: true }).catch(() => {});
      await page.waitForTimeout(800);
    }
  }
  // Close any dialog via Escape as a fallback.
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);
}

async function setTheme(theme) {
  await page.evaluate((t) => {
    try {
      const raw = localStorage.getItem('consultify-storage');
      const j = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      j.state = j.state || {};
      j.state.theme = t;
      localStorage.setItem('consultify-storage', JSON.stringify(j));
    } catch {}
  }, theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
}

async function main() {
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(7000);
  console.log('po logowaniu url:', page.url());

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
  console.log('po reload url:', page.url());
  await dismissOverlays();

  // --- Organizacja (profil + lista osób) ---
  await page.goto(`${BASE}/organization`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await dismissOverlays();
  await zrzut('01-organizacja-light');

  // --- Admin panel (uzytkownicy, role) ---
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await dismissOverlays();
  await zrzut('02-admin-panel-light');

  // Try to click Members section if not default
  const membersLink = page.getByText('Members', { exact: false }).first();
  const visible = await membersLink.isVisible({ timeout: 2000 }).catch(() => false);
  if (visible) {
    await membersLink.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);
    await zrzut('02b-admin-members-light');
  }

  // --- Ustawienia ---
  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await dismissOverlays();
  await zrzut('03-ustawienia-light');

  // --- Dark mode versions ---
  await setTheme('dark');
  await dismissOverlays();
  await page.goto(`${BASE}/organization`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await dismissOverlays();
  await zrzut('01-organizacja-dark');

  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await dismissOverlays();
  await zrzut('02-admin-panel-dark');

  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await dismissOverlays();
  await zrzut('03-ustawienia-dark');

  await browser.close();
}

main().catch((e) => {
  console.error('BŁĄD:', e);
  process.exit(1);
});
