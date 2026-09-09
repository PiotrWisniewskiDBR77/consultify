/**
 * DOWÓD JĘZYKOWY paczki J-DOG-A (DEC-453).
 *
 * Wzór: `scripts/dev/jezyk-j16-zrzuty.mjs` / `scripts/dev/jezyk-j15-zrzuty.mjs`.
 * Robi zrzuty kluczowych ekranów paczki J-DOG-A (02 My Work — CaseWorkspace za
 * flagą `ff_zlecenia=1`; 15 Settings — Enterprise Onboarding Wizard) w wybranym
 * języku konta i liczy obce słowa w chrome interfejsu (nie w danych zlecenia —
 * nazwa/cel/kroki planu to treść użytkownika, świadomie zostaje po polsku).
 *
 * Słownik „polskiego"/„angielskiego" jest TEN SAM co w `scripts/i18n/pomiar-jezyka.mjs`.
 *
 * Wymaga: API na J_BASE_API (domyślnie :4206), Vite na J_BASE (domyślnie :3224),
 * kopia bazy z contem `audyt@dbr77.local` (OWNER, organization_members ACTIVE)
 * i co najmniej jednym `case_core` dla tej organizacji.
 *
 * Użycie: node scripts/dev/jezyk-jdog-a-zrzuty.mjs <katalog-wyjściowy> <pl,en>
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

import { wykryjPolski, wykryjAngielski } from '../i18n/pomiar-jezyka.mjs';

const BASE = process.env.J_BASE || 'http://127.0.0.1:3224';
const DB = process.env.J_DB || 'consultify_kopia_d25';
const PG_PORT = process.env.J_PG_PORT || '54418';
const KONTO = 'audyt@dbr77.local';
const HASLO = 'AudytDBR77!2026';
const CASE_ID =
  process.env.J_CASE_ID || 'a3e05d4a-5397-419d-b486-8e44366c0063--acceptance--case';
const OUT = process.argv[2] || 'evidence/jezyk-jdog-a/po';
const LANGS = (process.argv[3] || 'en').split(',');
fs.mkdirSync(OUT, { recursive: true });

const sql = (q) =>
  execSync(
    `docker exec consultify-pg18 psql -U postgres -p 5432 -d ${DB} -Atc "${q.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8' }
  ).trim();

/** Nazwy własne / skróty tożsame w obu językach — nie liczymy ich jako obce słowo. */
const NEUTRALNE =
  /^(status|data|ok|pdf|ai|qa|kpi|roi|crm|id|url|api|consultify|dbr77|teresa|beta|v\d+|\d+%?|active|draft|closed|blocked|transformation)$/i;

const b = await chromium.launch();
let c;
let p;

async function nowaSesja(lang) {
  sql(`UPDATE users SET language='${lang}' WHERE email='${KONTO}'`);
  sql(
    `INSERT INTO user_preferences (user_id,key,value) VALUES ('audyt-jdog-a','onboarding_completed','true') ON CONFLICT (user_id,key) DO UPDATE SET value='true'`
  );
  if (c) await c.close();
  c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  p = await c.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1000);
  await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
  await p.locator('input[type="email"]').first().fill(KONTO);
  await p.locator('input[type="password"]').first().fill(HASLO);
  await p.locator('input[type="password"]').first().press('Enter');
  await p.waitForURL((u) => !String(u).includes('/login'), { timeout: 40000 });
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    const K = 'consultify-storage';
    const r = localStorage.getItem(K);
    const o = r ? JSON.parse(r) : { state: {}, version: 0 };
    o.state = { ...(o.state || {}), theme: 'light' };
    localStorage.setItem(K, JSON.stringify(o));
  });
  await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
}

/** Napisy chrome interfejsu — bez komórek z DANYMI (dane wiersza to case_name/goal/steps). */
async function napisyUi() {
  return p.evaluate(() => {
    const sel =
      'button, [role=tab], [role=menuitem], th, label, h1, h2, h3, nav a, [aria-label], [placeholder]';
    const out = new Set();
    for (const el of Array.from(document.querySelectorAll(sel))) {
      if (!(el instanceof HTMLElement)) continue;
      const aria = el.getAttribute('aria-label');
      const ph = el.getAttribute('placeholder');
      if (aria) out.add(aria.trim());
      if (ph) out.add(ph.trim());
      const visible = el.offsetParent !== null || el.getBoundingClientRect().width > 0;
      if (!visible) continue;
      const t = (el.innerText || '').trim();
      if (t && t.length < 120 && !t.includes('\n')) out.add(t);
    }
    return Array.from(out);
  });
}

const raport = [];

async function ekran(nazwa, lang, akcja) {
  try {
    await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
    await akcja();
    await p.waitForTimeout(1800);
    // Modal pierwszego uruchomienia — próbuj zamknąć, jeśli obecny.
    const skip = p.getByRole('button', { name: /Skip for now|Pomiń na razie/i });
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
      await p.waitForTimeout(500);
    }
    await p.screenshot({ path: `${OUT}/${nazwa}-${lang}.png`, fullPage: false });
    const napisy = (await napisyUi()).filter((t) => t && !NEUTRALNE.test(t));
    const pl = napisy.filter((t) => wykryjPolski(t));
    const en = napisy.filter((t) => wykryjAngielski(t));
    raport.push({
      lang,
      ekran: nazwa,
      napisowUi: napisy.length,
      polskichUi: pl.length,
      polskie: pl.slice(0, 40),
      angielskichUi: en.length,
    });
  } catch (e) {
    raport.push({ lang, ekran: nazwa, blad: String(e.message).slice(0, 200) });
  }
}

for (const lang of LANGS) {
  await nowaSesja(lang);

  await ekran('01-lista-zlecen', lang, async () => {
    await p.goto(`${BASE}/zlecenia?ff_zlecenia=1`, { waitUntil: 'networkidle' });
  });

  await ekran('02-szczegol-zlecenia-plan', lang, async () => {
    await p.goto(`${BASE}/zlecenia/${CASE_ID}?zakladka=plan&widok-planu=prosty&ff_zlecenia=1`, {
      waitUntil: 'networkidle',
    });
  });

  await ekran('03-szczegol-zlecenia-execution', lang, async () => {
    await p.goto(`${BASE}/zlecenia/${CASE_ID}?zakladka=realizacja&ff_zlecenia=1`, {
      waitUntil: 'networkidle',
    });
  });

  await ekran('04-szczegol-zlecenia-results', lang, async () => {
    await p.goto(`${BASE}/zlecenia/${CASE_ID}?zakladka=rezultaty&ff_zlecenia=1`, {
      waitUntil: 'networkidle',
    });
  });

  await ekran('05-plotno-planu-ekspercki', lang, async () => {
    await p.goto(`${BASE}/zlecenia/${CASE_ID}?zakladka=plan&widok-planu=ekspercki&ff_zlecenia=1`, {
      waitUntil: 'networkidle',
    });
  });

  await ekran('06-onboarding-enterprise', lang, async () => {
    await p.goto(`${BASE}/partner/onboarding`, { waitUntil: 'networkidle' });
  });
}

sql(`UPDATE users SET language='en' WHERE email='${KONTO}'`);
await b.close();
fs.writeFileSync(`${OUT}/liczniki.json`, JSON.stringify(raport, null, 1));
console.log(
  JSON.stringify(
    raport.map((r) => ({ e: r.ekran, l: r.lang, pl: r.polskichUi ?? r.blad, en: r.angielskichUi })),
    null,
    0
  )
);
